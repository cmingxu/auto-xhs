window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.follow = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug, incrementStat } = window.XHS.utils;

  function findAuthorElement() {
    // Try avatar selectors first
    const avatarSelectors = [
      '.note-detail-header .author .avatar',
      '.author-container .author-wrapper .avatar',
      '.author-container .avatar',
      '.note-info .author .avatar',
      '.note-detail-interactive .author .avatar',
      '.bottom-container .author .avatar',
      '.note-detail-mask .author .avatar',
      '#noteContainer .author .avatar',
      '.author .avatar-item',
      '.author .avatar'
    ];

    for (const sel of avatarSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Fallback: find any avatar image near the follow button area
    const containers = document.querySelectorAll('.note-detail-header, .author-container, .author-wrapper, [class*="author"]');
    for (const c of containers) {
      const avatar = c.querySelector('img[class*="avatar"], .avatar-item, .avatar');
      if (avatar) return avatar;
    }

    // Last resort: look for an <a> with an <img> inside the note container header area
    const noteContainer = document.querySelector('#noteContainer, .note-detail-mask');
    if (noteContainer) {
      const imgs = noteContainer.querySelectorAll('img');
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        // Author avatar is typically in the top portion of the detail view
        if (r.width > 20 && r.height > 20 && r.top < window.innerHeight * 0.3 && img.offsetParent !== null) {
          return img.closest('a') || img;
        }
      }
    }

    return null;
  }

  async function hoverElement(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: cx,
      clientY: cy,
      pageX: cx + window.scrollX,
      pageY: cy + window.scrollY,
      view: window
    };

    const pointerInit = { ...eventInit, pointerId: 1, pointerType: 'mouse' };

    const targets = [el];
    // If it's an img inside a link, also target the link
    const link = el.closest('a');
    if (link && link !== el) targets.unshift(link);
    // Also target the parent container
    const parent = el.closest('.author, .author-wrapper, .author-container');
    if (parent && !targets.includes(parent)) targets.push(parent);

    for (const target of targets) {
      target.dispatchEvent(new PointerEvent('pointerover', pointerInit));
      target.dispatchEvent(new PointerEvent('pointerenter', pointerInit));
      target.dispatchEvent(new MouseEvent('mouseover', eventInit));
      target.dispatchEvent(new MouseEvent('mouseenter', eventInit));
    }

    // Sustain hover for 3 seconds to ensure the API fires
    for (let t = 0; t < 6; t++) {
      for (const target of targets) {
        target.dispatchEvent(new PointerEvent('pointermove', pointerInit));
        target.dispatchEvent(new MouseEvent('mousemove', eventInit));
      }
      await sleep(500 + random(0, 200));
    }
  }

  async function followAuthor(config) {
    const minFans = (config && config.minFansToFollow != null) ? config.minFansToFollow : 300;

    sendDebug(`[ACTION] 关注决策开始`, `最小粉丝阈值: ${minFans}`);

    // Step 1: Find author element & ensure intercept is running
    const authorEl = findAuthorElement();
    if (!authorEl) {
      sendDebug(`[SKIP] 未找到作者头像元素`, `无法触发 hover card 获取粉丝数`);
      return { action: 'skip', reason: 'no-author-avatar' };
    }

    const tag = authorEl.tagName.toLowerCase();
    const klass = authorEl.className || '';
    sendDebug(`[ACTION] 找到作者头像`, `tag: <${tag}>, class: "${klass}"`);

    // Set up intercept to catch the hover card response
    const { setupIntercept, getUserData } = window.XHS.intercept;
    await setupIntercept();

    // Step 2: Hover the author element to trigger hover card API
    const beforeCount = getUserData().length;
    sendDebug(`[ACTION] 悬停作者头像`, `等待 hover card 响应...`);
    await hoverElement(authorEl);

    // Step 3: Wait for hover card data
    const startWait = Date.now();
    let authorData = null;
    while (Date.now() - startWait < 5000) {
      const users = getUserData();
      // Check new users added since before the hover
      for (let i = beforeCount; i < users.length; i++) {
        const u = users[i];
        if (u.fans !== undefined && u.fans !== '0') {
          authorData = u;
          break;
        }
      }
      if (authorData) break;
      await sleep(300);
    }

    // Fallback: check all users (some may have been collected earlier)
    if (!authorData) {
      const users = getUserData();
      // Pick the user with the most data (likely the author)
      for (const u of users) {
        if (parseInt(u.fans) > 0) {
          authorData = u;
          break;
        }
      }
    }

    if (!authorData) {
      sendDebug(`[SKIP] 未获取到 hover card 数据`, `等待 5 秒后仍未收到作者信息`);
      return { action: 'skip', reason: 'no-hover-data' };
    }

    const fans = parseInt(authorData.fans) || 0;
    sendDebug(`[ACTION] 作者信息`, `昵称: ${authorData.nickname}, 粉丝: ${fans}, 阈值: ${minFans}`);

    // Step 4: Check fans threshold
    if (fans < minFans) {
      sendDebug(`[SKIP] 粉丝数不足`, `粉丝: ${fans} < 阈值: ${minFans}`);
      return { action: 'skip', reason: 'low-fans', fans, threshold: minFans };
    }

    sendDebug(`[OK] 粉丝数达标`, `粉丝: ${fans} >= 阈值: ${minFans}`);

    // Step 5: Find and check follow button
    const btnSelectors = [
      '#noteContainer .note-detail-follow-btn button.follow-button',
      '#noteContainer .note-detail-follow-btn',
      '.note-detail-follow-btn',
      '#noteContainer button[class*="follow"]',
      'button[class*="follow"]'
    ];

    let btn = null;
    let matchedSel = '';
    for (const sel of btnSelectors) {
      btn = document.querySelector(sel);
      if (btn) {
        matchedSel = sel;
        break;
      }
    }

    if (!btn) {
      sendDebug(`[SKIP] 未找到关注按钮`, `尝试了 ${btnSelectors.length} 个选择器`);
      return { action: 'skip', reason: 'no-button' };
    }

    const btnText = (btn.textContent || '').trim();
    const btnInnerText = (btn.innerText || '').trim();

    sendDebug(`[ACTION] 检查关注按钮`, `text: "${btnText}", innerText: "${btnInnerText}"`);

    if (btnText.includes('已关注') || btnText.includes('正在关注') || btnText.includes('取消关注') ||
        btnInnerText.includes('已关注') || btnInnerText.includes('正在关注') || btnInnerText.includes('取消关注')) {
      sendDebug(`[SKIP] 已关注该作者`, ``);
      return { action: 'skip', reason: 'already-following' };
    }

    if (!btnText.includes('关注') && !btnInnerText.includes('关注')) {
      sendDebug(`[WARN] 关注按钮文本异常`, `textContent: "${btnText}", innerText: "${btnInnerText}"`);
      return { action: 'skip', reason: 'unexpected-text' };
    }

    // Step 6: Check daily rate limit
    const today = new Date().toISOString().slice(0, 10);
    const countKey = `followCount_${today}`;
    let limit = 5;
    let current = 0;

    try {
      const cfg = await chrome.storage.sync.get('maxFollowsPerDay');
      limit = Math.max(1, parseInt(cfg.maxFollowsPerDay) || 5);
    } catch (e) {
      sendDebug(`[WARN] 无法读取关注上限设置`, `使用默认值: ${limit}`);
    }

    try {
      const data = await chrome.storage.local.get(countKey);
      current = data[countKey] || 0;
    } catch (e) {
      sendDebug(`[WARN] 无法读取今日关注计数`, `默认: 0`);
    }

    sendDebug(`[ACTION] 关注上限检查`, `今日已关注: ${current}, 上限: ${limit}`);

    if (current >= limit) {
      sendDebug(`[SKIP] 已达每日关注上限`, `已关注: ${current}, 上限: ${limit}`);
      return { action: 'skip', reason: 'daily-limit', current, limit };
    }

    // Step 7: Click follow
    sendDebug(`[ACTION] 点击关注按钮`, `selector: "${matchedSel}", 今日: ${current}/${limit}`);
    btn.click();
    await sleep(800 + random(0, 1200));

    const newText = (btn.textContent || '').trim();
    if (newText === btnText) {
      sendDebug(`[WARN] 点击后按钮文本未改变`, `仍为: "${newText}"`);
    } else {
      sendDebug(`[OK] 按钮文本已改变`, `"${btnText}" → "${newText}"`);
    }

    try {
      await chrome.storage.local.set({ [countKey]: current + 1 });
    } catch (e) {
      sendDebug(`[WARN] 无法保存关注计数`, ``);
    }

    sendDebug(`[OK] 已关注`, `今日关注: ${current + 1}/${limit}`);
    incrementStat('followedAuthors');
    return { action: 'followed', current: current + 1, limit };
  }

  return { followAuthor };
})();
