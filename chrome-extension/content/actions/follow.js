window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.follow = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug } = window.XHS.utils;

  async function followAuthor() {
    // Try multiple selectors — the button may be in different containers
    const selectors = [
      '#noteContainer .note-detail-follow-btn button.follow-button',
      '#noteContainer .note-detail-follow-btn',
      '.note-detail-follow-btn',
      '#noteContainer button[class*="follow"]',
      'button[class*="follow"]'
    ];

    let btn = null;
    let matchedSel = '';
    for (const sel of selectors) {
      btn = document.querySelector(sel);
      if (btn) {
        matchedSel = sel;
        break;
      }
    }

    if (!btn) {
      sendDebug(`[SKIP] 未找到关注按钮`, `尝试了 ${selectors.length} 个选择器`);
      return { action: 'skip', reason: 'no-button' };
    }

    // Log full element info for debugging
    const tag = btn.tagName.toLowerCase();
    const classes = btn.className || '';
    const text = (btn.textContent || '').trim();
    const innerText = (btn.innerText || '').trim();
    const html = btn.outerHTML.slice(0, 200);

    sendDebug(`[ACTION] 检查关注状态`,
      `tag: <${tag}>, class: "${classes}", textContent: "${text}", innerText: "${innerText}"`);
    sendDebug(`[ACTION] 按钮HTML`, html);

    // Already following — skip
    if (text.includes('已关注') || text.includes('正在关注') || text.includes('取消关注') ||
        innerText.includes('已关注') || innerText.includes('正在关注') || innerText.includes('取消关注')) {
      sendDebug(`[SKIP] 已关注该作者`, `textContent: "${text}", innerText: "${innerText}"`);
      return { action: 'skip', reason: 'already-following' };
    }

    if (!text.includes('关注') && !innerText.includes('关注')) {
      sendDebug(`[WARN] 关注按钮文本异常`,
        `期望包含"关注", textContent: "${text}", innerText: "${innerText}"`);
      return { action: 'skip', reason: 'unexpected-text' };
    }

    // Check daily rate limit — use chrome.storage.local (session is not available in content scripts)
    const today = new Date().toISOString().slice(0, 10);
    const countKey = `followCount_${today}`;
    let limit = 5;
    let current = 0;

    try {
      const cfg = await chrome.storage.sync.get('maxFollowsPerDay');
      limit = Math.max(1, parseInt(cfg.maxFollowsPerDay) || 5);
    } catch (e) {
      sendDebug(`[WARN] 无法读取关注上限设置`, `error: ${e.message}, 使用默认值: ${limit}`);
    }

    try {
      const data = await chrome.storage.local.get(countKey);
      current = data[countKey] || 0;
    } catch (e) {
      sendDebug(`[WARN] 无法读取今日关注计数`, `error: ${e.message}, 默认: 0`);
    }

    sendDebug(`[ACTION] 关注上限检查`, `今日已关注: ${current}, 上限: ${limit}`);

    if (current >= limit) {
      sendDebug(`[SKIP] 已达每日关注上限`, `已关注: ${current}, 上限: ${limit}`);
      return { action: 'skip', reason: 'daily-limit', current, limit };
    }

    // Follow
    sendDebug(`[ACTION] 点击关注按钮`, `selector: "${matchedSel}", 文本: "${text}", 今日: ${current}/${limit}`);
    btn.click();
    await sleep(800 + random(0, 1200));

    // Verify the click worked — button text should change
    const newText = (btn.textContent || '').trim();
    if (newText === text) {
      sendDebug(`[WARN] 点击后按钮文本未改变`, `仍为: "${newText}" — 可能点击未生效`);
    } else {
      sendDebug(`[OK] 按钮文本已改变`, `"${text}" → "${newText}"`);
    }

    // Update count
    try {
      await chrome.storage.local.set({ [countKey]: current + 1 });
    } catch (e) {
      sendDebug(`[WARN] 无法保存关注计数`, `error: ${e.message}`);
    }
    sendDebug(`[OK] 已关注`, `今日关注: ${current + 1}/${limit}`);

    S.stats.followedAuthors = (S.stats.followedAuthors || 0) + 1;
    return { action: 'followed', current: current + 1, limit };
  }

  return { followAuthor };
})();
