window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.comment = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug, incrementStat } = window.XHS.utils;
  const { waitForElement } = window.XHS.wait;

  function sendMessageAsync(msg, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), timeoutMs);
      chrome.runtime.sendMessage(msg, (response) => {
        clearTimeout(timer);
        resolve(response || { ok: false, error: 'no response' });
      });
    });
  }

  function pickComment(textsRaw) {
    if (!textsRaw) return null;
    const texts = textsRaw.split(/[,，\n]+/).map(s => s.trim()).filter(Boolean);
    if (texts.length === 0) return null;
    return texts[Math.floor(Math.random() * texts.length)];
  }

  async function generateAiComment(note) {
    if (!note || (!note.title && !note.content)) {
      sendDebug(`[AI] 跳过AI生成`, `原因: 笔记缺少标题和内容`);
      return { ok: false, error: 'no-note-data' };
    }

    sendDebug(`[AI] 请求生成评论`, `标题: "${(note.title || '').slice(0, 40)}"`);
    const resp = await sendMessageAsync({
      type: 'generateComment',
      title: note.title || '',
      content: note.content || ''
    });

    if (resp.ok && resp.comment) {
      sendDebug(`[AI] 生成成功`, `comment: "${resp.comment.slice(0, 60)}..."`);
    } else {
      sendDebug(`[AI] 生成失败`, `error: ${resp.error || 'unknown'}, 将回退到固定文本`);
    }

    return resp;
  }

  async function postComment(note) {
    // Use note_id as primary key, fall back to URL
    const noteId = note?.note_id || note?.url || '';
    const dedupKey = noteId || window.location.href;

    // Deduplicate: never comment on the same note twice
    if (dedupKey) {
      try {
        const { commentedNoteIds } = await chrome.storage.local.get('commentedNoteIds');
        const ids = commentedNoteIds || [];
        if (ids.includes(dedupKey)) {
          sendDebug(`[SKIP] 已评论过此笔记`, `key: ${dedupKey}`);
          return { action: 'skip', reason: 'already-commented', noteId: dedupKey };
        }
      } catch (e) {
        sendDebug(`[WARN] 无法读取已评论笔记列表`, `error: ${e.message}`);
      }
    }

    // Mark as seen immediately so we never re-attempt, even if comment fails
    if (dedupKey) {
      try {
        const { commentedNoteIds } = await chrome.storage.local.get('commentedNoteIds');
        const ids = commentedNoteIds || [];
        if (!ids.includes(dedupKey)) {
          ids.push(dedupKey);
          await chrome.storage.local.set({ commentedNoteIds: ids });
        }
      } catch (e) {
        sendDebug(`[WARN] 无法保存已评论笔记ID`, `error: ${e.message}`);
      }
    }

    // Check daily rate limit
    const today = new Date().toISOString().slice(0, 10);
    const countKey = `commentCount_${today}`;
    let limit = 3;
    let current = 0;
    let commentText = null;
    let isAiGenerated = false;

    try {
      const cfg = await chrome.storage.sync.get(['commentTexts', 'maxCommentsPerDay', 'deepseekApiKey']);
      limit = Math.max(1, parseInt(cfg.maxCommentsPerDay) || 3);
      const hasApiKey = !!(cfg.deepseekApiKey && cfg.deepseekApiKey.trim());

      if (limit === 0) {
        sendDebug(`[SKIP] 评论已禁用`, `maxCommentsPerDay 设为 0`);
        return { action: 'skip', reason: 'disabled' };
      }

      // Try AI generation first if API key is configured
      if (hasApiKey && note) {
        sendDebug(`[AI] 尝试使用DeepSeek生成评论`);
        const aiResp = await generateAiComment(note);
        if (aiResp.ok && aiResp.comment) {
          commentText = aiResp.comment;
          isAiGenerated = true;
        }
      }

      // Fallback to fixed texts
      if (!commentText) {
        if (!hasApiKey) {
          sendDebug(`[AI] 未配置API Key`, `使用固定评论文本`);
        }
        commentText = pickComment(cfg.commentTexts);
      }
    } catch (e) {
      sendDebug(`[WARN] 无法读取评论设置`, `error: ${e.message}`);
      return { action: 'skip', reason: 'config-error' };
    }

    if (!commentText) {
      sendDebug(`[SKIP] 无评论内容`, `未配置评论文本且AI生成失败`);
      return { action: 'skip', reason: 'no-texts' };
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
    sendDebug(`[ACTION] 输入评论`, `selector: "${matchedInputSel}", tag: <${tag}>, placeholder: "${placeholder}", AI: ${isAiGenerated}, comment: "${commentText}"`);

    // Focus and type
    input.focus();
    await sleep(200 + random(0, 300));

    if (isContentEditable || tag === 'div') {
      input.innerText = commentText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
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

    incrementStat('commentsPosted');

    // Store AI-generated comment for options page display
    if (isAiGenerated && note) {
      sendMessageAsync({
        type: 'aiGeneratedComment',
        noteTitle: note.title || '',
        noteContent: note.content || '',
        comment: commentText,
        noteUrl: note.url || window.location.href
      });
    }

    sendDebug(`[OK] 已评论`, `AI: ${isAiGenerated}, 内容: "${commentText}", 今日: ${current + 1}/${limit}`);
    return { action: 'commented', text: commentText, current: current + 1, limit, aiGenerated: isAiGenerated };
  }

  return { postComment };
})();
