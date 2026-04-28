window.XHS = window.XHS || {};

window.XHS.intercept = (function() {
  const { sendDebug } = window.XHS.utils;

  let collectedUsers = [];
  let collectedComments = [];
  let listener = null;
  let injected = false;

  function handleMessage(event) {
    if (!event.data || !event.data.source) return;

    const { source, payload: data } = event.data;

    if (source === 'xhs-hover-card') {
      handleHoverCard(data);
    } else if (source === 'xhs-comment-page') {
      handleCommentPage(data);
    }
  }

  function handleHoverCard(data) {
    sendDebug(`[INTERCEPT] 收到 hover_card`, `success: ${data?.success}`);

    if (data && data.success && data.data) {
      const user = extractUserData(data.data);
      if (user) {
        collectedUsers.push(user);
        sendDebug(`[OK] 获取用户信息`, `nickname: ${user.nickname}, fans: ${user.fans}`);
      }
    }
  }

  function handleCommentPage(data) {
    if (!data || !data.success || !data.data) {
      sendDebug(`[INTERCEPT] 收到 comment/page (无效)`, `success: ${data?.success}`);
      return;
    }

    const comments = data.data.comments || [];
    if (comments.length === 0) {
      sendDebug(`[INTERCEPT] 收到 comment/page (空)`, `无评论`);
      return;
    }

    sendDebug(`[INTERCEPT] 收到 comment/page`, `${comments.length} 条评论`);

    const extracted = [];
    for (const c of comments) {
      const ui = c.user_info || {};
      const comment = {
        note_id: c.note_id || '',
        comment_id: c.id || '',
        create_time: c.create_time || 0,
        ip_location: c.ip_location || '',
        content: c.content || '',
        user_id: ui.user_id || '',
        nickname: ui.nickname || '',
        image: ui.image || '',
        xsec_token: ui.xsec_token || '',
        like_count: c.like_count || '0'
      };
      extracted.push(comment);

      // Cross-add user if not already collected
      const exists = collectedUsers.some(u => u.nickname === ui.nickname);
      if (!exists && ui.nickname) {
        collectedUsers.push({
          nickname: ui.nickname,
          images: ui.image || '',
          desc: '',
          follows: '0',
          fans: '0',
          interaction: '0',
          notes: []
        });
        sendDebug(`[OK] 从评论交叉添加用户`, `nickname: ${ui.nickname}`);
      }
    }

    collectedComments.push(...extracted);
    sendDebug(`[OK] 已提取评论`, `${extracted.length} 条, 累计: ${collectedComments.length}`);

    // Send to background for persistence
    try {
      chrome.runtime.sendMessage({ type: 'scrapedComments', comments: extracted }).catch(() => {});
    } catch(e) { /* ignore */ }
  }

  function extractUserData(data) {
    const basic = data.basic_info || {};
    const interact = data.interact_info || {};
    const notes = (data.notes || []).map(n => ({
      note_id: n.note_id || '',
      xsec_token: n.xsec_token || '',
      cover: (n.cover && n.cover.url_default) || ''
    }));

    return {
      nickname: basic.nickname || '',
      images: basic.images || '',
      desc: basic.desc || '',
      follows: interact.follows || '0',
      fans: interact.fans || '0',
      interaction: interact.interaction || '0',
      notes
    };
  }

  async function setupIntercept() {
    collectedUsers = [];
    collectedComments = [];

    if (!injected) {
      sendDebug(`[ACTION] 请求注入拦截脚本`, `via chrome.scripting.executeScript, world: MAIN`);
      const res = await chrome.runtime.sendMessage({ type: 'injectIntercept' });
      if (res?.ok) {
        injected = true;
        sendDebug(`[OK] 拦截脚本已注入`, `world: MAIN, 已安装 fetch/XHR 补丁`);
      } else {
        sendDebug(`[FAIL] 脚本注入失败`, `error: ${res?.error || 'unknown'}`);
      }
    } else {
      sendDebug(`[OK] 拦截脚本已存在`, `跳过重复注入`);
    }

    if (!listener) {
      listener = handleMessage;
      window.addEventListener('message', listener);
      sendDebug(`[ACTION] message 监听器已注册`);
    }
  }

  function teardownIntercept() {
    if (listener) {
      window.removeEventListener('message', listener);
      listener = null;
      sendDebug(`[ACTION] message 监听器已移除`);
    }
    sendDebug(`[OK] 拦截器已移除`, `用户: ${collectedUsers.length}, 评论: ${collectedComments.length}`);
  }

  function getUserData() {
    return collectedUsers;
  }

  function getCommentData() {
    return collectedComments;
  }

  return { setupIntercept, teardownIntercept, getUserData, getCommentData };
})();
