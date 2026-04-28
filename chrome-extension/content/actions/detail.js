window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.detail = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug, updateStatus } = window.XHS.utils;
  const { waitForElement } = window.XHS.wait;
  const { setupIntercept, teardownIntercept, getUserData } = window.XHS.intercept;

  async function scrollComments() {
    const scrollSelectors = [
      '.noteContainer',
      '.note-detail-mask',
      'div[class*="detail"]',
      'div[class*="note"]',
      'div[class*="modal"]',
      'div[class*="layer"]',
      'div[class*="overlay"]',
      'div[class*="comment"]',
      'div[class*="interaction"]',
      'div[class*="dialog"]',
      'div[class*="scroll"]',
      'div[class*="body"]',
      'div[class*="content"]'
    ];

    sendDebug(`[ACTION] 在详情页中查找可滚动区域`,
      `尝试 ${scrollSelectors.length} 个选择器...`);

    let scrollArea = null;
    let maxScroll = 0;
    let matchedSelector = '';

    for (const s of scrollSelectors) {
      const els = document.querySelectorAll(s);
      for (const el of els) {
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable > 50 && el.offsetParent !== null) {
          if (scrollable > maxScroll) {
            scrollArea = el;
            maxScroll = scrollable;
            matchedSelector = s;
          }
        }
      }
    }

    if (!scrollArea) {
      scrollArea = document.body;
      maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
      sendDebug(`[FALLBACK] 未找到详情页滚动区域`,
        `原因: ${scrollSelectors.length} 个选择器均未匹配到可见的可滚动元素`);
      sendDebug(`[FALLBACK] 使用 document.body`,
        `可滚动: ${maxScroll}px, tag: body`);
    } else {
      const tag = scrollArea.tagName.toLowerCase();
      const klass = scrollArea.className || '';
      sendDebug(`[OK] 找到滚动区域`,
        `匹配选择器: "${matchedSelector}", tag: <${tag}>, class: "${klass}", 可滚动: ${maxScroll}px`);
    }

    if (maxScroll <= 5) {
      sendDebug(`[SKIP] 无可滚动内容`,
        `原因: 最大滚动高度为 ${maxScroll}px`);
      return;
    }

    const steps = Math.min(Math.ceil(maxScroll / 200), 25);
    sendDebug(`[ACTION] 开始滚动`,
      `总计: ${maxScroll}px, 步数: ${steps}, 步长: ~150-300px`);

    for (let i = 0; i < steps && !S.stopRequested; i++) {
      const remaining = maxScroll - scrollArea.scrollTop;
      if (remaining <= 0) {
        sendDebug(`[DONE] 已到达滚动区域底部`,
          `scrollTop: ${scrollArea.scrollTop}, maxScroll: ${maxScroll}`);
        break;
      }
      const stepSize = Math.min(150 + random(0, 150), remaining);
      scrollArea.scrollTop += stepSize;
      S.stats.scrolledComments++;
      const pct = Math.round((scrollArea.scrollTop / maxScroll) * 100);
      updateStatus('scrolling', `滚动中... ${pct}%`);
      if (i === 0 || i === steps - 1 || i % 5 === 0) {
        sendDebug(`  滚动步骤 ${i + 1}/${steps}`,
          `scrollTop: ${scrollArea.scrollTop}/${maxScroll} (${pct}%), stepSize: ${stepSize}px`);
      }
      await sleep(500 + random(0, 500));
    }

    const finalPct = Math.round((scrollArea.scrollTop / maxScroll) * 100);
    sendDebug(`[OK] 滚动完成`,
      `到达 ${scrollArea.scrollTop}/${maxScroll}px (${finalPct}%), 总滚动次数: ${S.stats.scrolledComments}`);
  }

  async function closeModal() {
    sendDebug(`[ACTION] 关闭详情页`, `策略: 点击 .note-detail-mask 内的 .close-circle`);

    const closeBtn = await waitForElement('.note-detail-mask .close-circle', 8000, '.note-detail-mask .close-circle');

    if (closeBtn) {
      const visible = closeBtn.offsetParent !== null;
      const rect = closeBtn.getBoundingClientRect();
      const tag = closeBtn.tagName.toLowerCase();
      sendDebug(`[OK] 在 .note-detail-mask 内找到 .close-circle`,
        `tag: <${tag}>, visible: ${visible}, 位置: (${Math.round(rect.left)},${Math.round(rect.top)}), 尺寸: ${Math.round(rect.width)}x${Math.round(rect.height)}`);

      sendDebug(`[ACTION] 点击 .close-circle`, `调用 .click()`);
      closeBtn.click();
      await sleep(1000 + random(0, 1500));

      sendDebug(`[ACTION] 等待详情页关闭`,
        `等待 .note-detail-mask 消失且 .feeds-container 重新出现, timeout: 10s`);
      const startWait = Date.now();
      let backToResults = false;
      while (Date.now() - startWait < 10000) {
        const maskGone = !document.querySelector('.note-detail-mask');
        const feedsBack = document.querySelector('.feeds-container');
        if (maskGone && feedsBack) {
          backToResults = true;
          break;
        }
        await sleep(300);
      }

      if (backToResults) {
        sendDebug(`[OK] 已返回搜索结果页`,
          `.note-detail-mask 已移除, .feeds-container 重新出现`);
        return true;
      } else {
        sendDebug(`[WARN] 详情页可能未正常关闭`,
          `原因: .note-detail-mask 或 .feeds-container 状态异常`);
      }
    } else {
      sendDebug(`[FAIL] 在 .note-detail-mask 内未找到 .close-circle`,
        `原因: document.querySelector('.note-detail-mask .close-circle') 在 8 秒内返回 null`);
    }

    // Fallback: navigate back via history
    sendDebug(`[FALLBACK] 通过浏览器历史返回`,
      `调用 history.back()`);
    window.history.back();
    await sleep(1500 + random(0, 1000));

    const feedsBack = await waitForElement('.feeds-container', 10000, '.feeds-container');
    if (feedsBack) {
      sendDebug(`[OK] 通过 history.back() 返回搜索结果页`);
    } else {
      sendDebug(`[WARN] history.back() 后仍不在搜索结果页`);
    }

    return true;
  }

  function findScrollArea() {
    const scrollSelectors = [
      '.noteContainer',
      '.note-detail-mask',
      'div[class*="detail"]',
      'div[class*="note"]',
      'div[class*="modal"]',
      'div[class*="layer"]',
      'div[class*="overlay"]',
      'div[class*="comment"]',
      'div[class*="interaction"]',
      'div[class*="dialog"]',
      'div[class*="scroll"]',
      'div[class*="body"]',
      'div[class*="content"]'
    ];

    let scrollArea = null;
    let maxScroll = 0;
    let matchedSelector = '';

    for (const s of scrollSelectors) {
      const els = document.querySelectorAll(s);
      for (const el of els) {
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable > 50 && el.offsetParent !== null) {
          if (scrollable > maxScroll) {
            scrollArea = el;
            maxScroll = scrollable;
            matchedSelector = s;
          }
        }
      }
    }

    if (!scrollArea) {
      scrollArea = document.body;
      maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
    }

    return { scrollArea, maxScroll, matchedSelector };
  }

  function getVisibleAvatarLinks() {
    const imgs = document.querySelectorAll('.comments-container .avatar-item');
    const links = [];
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      if (r.width > 5 && r.height > 5 && r.top < window.innerHeight && r.bottom > 0) {
        const a = img.closest('a');
        if (a) links.push(a);
      }
    }
    return links;
  }

  async function hoverAvatar(link) {
    const r = link.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const href = link.getAttribute('href') || '';
    const img = link.querySelector('img');
    const imgSrc = img ? img.getAttribute('src') || '' : '';

    sendDebug(`    悬停`, `href: "${href}", img: "${imgSrc.slice(0, 60)}...", 位置: (${Math.round(cx)},${Math.round(cy)}), 尺寸: ${Math.round(r.width)}x${Math.round(r.height)}`);

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

    // Also dispatch on the inner img first to trigger Vue's delegated handlers
    if (img) {
      img.dispatchEvent(new PointerEvent('pointerover', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
      img.dispatchEvent(new PointerEvent('pointerenter', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
      img.dispatchEvent(new MouseEvent('mouseover', eventInit));
      img.dispatchEvent(new MouseEvent('mouseenter', eventInit));
    }

    // Dispatch on the <a> link
    link.dispatchEvent(new PointerEvent('pointerover', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
    link.dispatchEvent(new PointerEvent('pointerenter', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
    link.dispatchEvent(new MouseEvent('mouseover', eventInit));
    link.dispatchEvent(new MouseEvent('mouseenter', eventInit));

    // Also try the parent .avatar container
    const avatarContainer = link.closest('.avatar');
    if (avatarContainer && avatarContainer !== link) {
      avatarContainer.dispatchEvent(new PointerEvent('pointerover', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
      avatarContainer.dispatchEvent(new PointerEvent('pointerenter', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
      avatarContainer.dispatchEvent(new MouseEvent('mouseover', eventInit));
      avatarContainer.dispatchEvent(new MouseEvent('mouseenter', eventInit));
    }

    // Sustain hover with periodic pointermove during the wait
    for (let t = 0; t < 6; t++) {
      link.dispatchEvent(new PointerEvent('pointermove', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
      link.dispatchEvent(new MouseEvent('mousemove', eventInit));
      await sleep(500 + random(0, 200));
    }
  }

  async function collectUserInfo() {
    const MAX_SCROLLS = 10;

    sendDebug(`[ACTION] 收集用户信息`, `滚动并悬停可见评论头像`);

    const { scrollArea, maxScroll, matchedSelector } = findScrollArea();

    if (maxScroll <= 5) {
      sendDebug(`[SKIP] 无可滚动内容`, `最大滚动高度: ${maxScroll}px`);
      return [];
    }

    sendDebug(`[OK] 找到滚动区域`, `匹配: "${matchedSelector}", 可滚动: ${maxScroll}px, 最多 ${MAX_SCROLLS} 次滚动`);

    setupIntercept();
    const seen = new Set();

    for (let step = 0; step < MAX_SCROLLS && !S.stopRequested; step++) {
      const remaining = maxScroll - scrollArea.scrollTop;
      if (remaining <= 0) {
        sendDebug(`[DONE] 已到达底部`, `scrollTop: ${scrollArea.scrollTop}/${maxScroll}`);
        break;
      }

      // Scroll a step
      const stepSize = Math.min(200 + random(0, 150), remaining);
      scrollArea.scrollTop += stepSize;
      S.stats.scrolledComments++;
      const pct = Math.round((scrollArea.scrollTop / maxScroll) * 100);
      updateStatus('scrolling', `滚动中... ${pct}%`);
      sendDebug(`  滚动 ${step + 1}/${MAX_SCROLLS}`, `scrollTop: ${scrollArea.scrollTop}/${maxScroll} (${pct}%)`);
      await sleep(500 + random(0, 500));

      // Find and hover visible avatars not yet seen
      const visible = getVisibleAvatarLinks();
      let hoveredThisStep = 0;

      for (const avatar of visible) {
        if (S.stopRequested) break;

        // Use the avatar element itself as identity key
        const key = avatar.getAttribute('data-user-id') ||
          avatar.querySelector('img')?.getAttribute('src') ||
          avatar.outerHTML.slice(0, 100);

        if (seen.has(key)) continue;
        seen.add(key);

        await hoverAvatar(avatar);
        hoveredThisStep++;
      }

      if (hoveredThisStep > 0) {
        sendDebug(`  悬停 ${hoveredThisStep} 个新头像`, `累计已处理: ${seen.size}`);
      }
    }

    const users = getUserData();
    teardownIntercept();

    sendDebug(`[OK] 用户信息收集完成`, `共 ${users.length} 个用户, 滚动: ${S.stats.scrolledComments}次, 悬停: ${seen.size}个`);
    return users;
  }

  return { scrollComments, closeModal, collectUserInfo };
})();
