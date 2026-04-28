window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.comment = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug } = window.XHS.utils;
  const { waitForElement } = window.XHS.wait;

  function pickComment(textsRaw) {
    if (!textsRaw) return null;
    // Split by comma, newline, or Chinese comma
    const texts = textsRaw.split(/[,，\n]+/).map(s => s.trim()).filter(Boolean);
    if (texts.length === 0) return null;
    return texts[Math.floor(Math.random() * texts.length)];
  }

  async function postComment() {
    // Check daily rate limit
    const today = new Date().toISOString().slice(0, 10);
    const countKey = `commentCount_${today}`;
    let limit = 3;
    let current = 0;
    let commentText = null;

    try {
      const cfg = await chrome.storage.sync.get(['commentTexts', 'maxCommentsPerDay']);
      limit = Math.max(1, parseInt(cfg.maxCommentsPerDay) || 3);
      commentText = pickComment(cfg.commentTexts);
    } catch (e) {
      sendDebug(`[WARN] 无法读取评论设置`, `error: ${e.message}`);
      return { action: 'skip', reason: 'config-error' };
    }

    if (!commentText) {
      sendDebug(`[SKIP] 无评论内容`, `未配置评论文本`);
      return { action: 'skip', reason: 'no-texts' };
    }

    if (limit === 0) {
      sendDebug(`[SKIP] 评论已禁用`, `maxCommentsPerDay 设为 0`);
      return { action: 'skip', reason: 'disabled' };
    }

    try {
      const data = await chrome.storage.local.get(countKey);
      current = data[countKey] || 0;
    } catch (e) {
      sendDebug(`[WARN] 无法读取评论计数`, `error: ${e.message}`);
    }

    if (current >= limit) {
      sendDebug(`[SKIP] 已达每日评论上限`, `已评论: ${current}, 上限: ${limit}`);
      return { action: 'skip', reason: 'daily-limit', current, limit };
    }

    // Find comment input — try multiple selectors
    const inputSelectors = [
      '#noteContainer textarea',
      '#noteContainer [contenteditable="true"]',
      '.noteContainer textarea',
      'textarea[placeholder*="评论"]',
      '[placeholder*="评论"]',
      '.comment-area textarea',
      '.comment-input textarea',
      'div[contenteditable="true"][class*="comment"]',
      '#noteContainer div[contenteditable="true"]'
    ];

    let input = null;
    let matchedInputSel = '';
    for (const sel of inputSelectors) {
      input = document.querySelector(sel);
      if (input) {
        matchedInputSel = sel;
        break;
      }
    }

    if (!input) {
      sendDebug(`[SKIP] 未找到评论输入框`, `尝试了 ${inputSelectors.length} 个选择器`);
      return { action: 'skip', reason: 'no-input' };
    }

    const tag = input.tagName.toLowerCase();
    const placeholder = input.getAttribute('placeholder') || '';
    const isContentEditable = input.getAttribute('contenteditable') === 'true';
    sendDebug(`[ACTION] 输入评论`, `selector: "${matchedInputSel}", tag: <${tag}>, placeholder: "${placeholder}", comment: "${commentText}"`);

    // Focus and type
    input.focus();
    await sleep(200 + random(0, 300));

    if (isContentEditable || tag === 'div') {
      // contenteditable div — use innerText
      input.innerText = commentText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // textarea — type character by character
      input.value = '';
      for (let ci = 0; ci < commentText.length; ci++) {
        input.value += commentText[ci];
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(60 + random(0, 80));
      }
    }

    await sleep(500 + random(0, 500));

    // Find submit button
    const btnSelectors = [
      '#noteContainer button[class*="submit"]',
      '#noteContainer button[class*="send"]',
      '.noteContainer button[class*="submit"]',
      '.noteContainer button[class*="send"]',
      'button[class*="submit"]',
      'button[class*="send"]'
    ];

    let btn = null;
    let matchedBtnSel = '';
    for (const sel of btnSelectors) {
      const buttons = document.querySelectorAll(sel);
      for (const b of buttons) {
        const txt = (b.textContent || '').trim();
        if (txt.includes('发送') || txt.includes('评论') || txt.includes('评') || txt.includes('发')) {
          btn = b;
          matchedBtnSel = sel;
          break;
        }
      }
      if (btn) break;
    }

    if (!btn) {
      sendDebug(`[SKIP] 未找到评论提交按钮`, `尝试了 ${btnSelectors.length} 个选择器`);
      return { action: 'skip', reason: 'no-button' };
    }

    const btnTag = btn.tagName.toLowerCase();
    const btnText = (btn.textContent || '').trim();
    sendDebug(`[ACTION] 点击提交按钮`, `selector: "${matchedBtnSel}", tag: <${btnTag}>, text: "${btnText}"`);

    btn.click();
    await sleep(800 + random(0, 1000));

    // Update count
    try {
      await chrome.storage.local.set({ [countKey]: current + 1 });
    } catch (e) {
      sendDebug(`[WARN] 无法保存评论计数`, `error: ${e.message}`);
    }

    S.stats.commentsPosted = (S.stats.commentsPosted || 0) + 1;
    sendDebug(`[OK] 已评论`, `内容: "${commentText}", 今日: ${current + 1}/${limit}`);
    return { action: 'commented', text: commentText, current: current + 1, limit };
  }

  return { postComment };
})();
