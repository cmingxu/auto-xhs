window.XHS = window.XHS || {};

(function() {
  const S = window.XHS.state;
  const { sleep, random, sendMessage, incrementStat, updateStatus, sendDebug } = window.XHS.utils;
  const { performSearch } = window.XHS.actions.search;
  const { waitForResults, getPostItems, scrollFeed } = window.XHS.actions.feed;
  const { clickPost } = window.XHS.actions.feed;
  const { closeModal, collectUserInfo, extractNote } = window.XHS.actions.detail;
  const { followAuthor } = window.XHS.actions.follow;
  const { postComment } = window.XHS.actions.comment;
  const { likeComments } = window.XHS.actions.like;

  async function simulateKeyword(keyword, config) {
    S.resetForKeyword(keyword, config);

    updateStatus('searching', `搜索中: ${keyword}`);
    sendDebug(`\n═══════════════════════════════════════`);
    sendDebug(`[START] 开始模拟关键词`, `关键词: "${keyword}"`);
    sendDebug(`[CONFIG]`, JSON.stringify(config, null, 2));
    sendDebug(`═══════════════════════════════════════`);

    // ── Step 1: Search ──
    sendDebug(`[STEP 1/3] 搜索`, `动作: 在 #search-input 中输入 "${keyword}" 并回车`);
    const searched = await performSearch(keyword);
    if (!searched) {
      updateStatus('error', `未找到搜索输入框，跳过: ${keyword}`);
      sendDebug(`[ABORT] 模拟在第 1/3 步中止`,
        `原因: performSearch() 返回 false — #search-input 不可用`);
      sendMessage({ type: 'keywordComplete' });
      return;
    }
    sendDebug(`[STEP 1/3] 搜索完成`, `关键词 "${keyword}" 已提交`);

    // ── Step 2: Wait for results ──
    sendDebug(`[STEP 2/3] 等待结果`, `动作: 等待 .feeds-container > .note-item`);
    const ready = await waitForResults();
    if (!ready) {
      updateStatus('error', `无搜索结果，跳过: ${keyword}`);
      sendDebug(`[ABORT] 模拟在第 2/3 步中止`,
        `原因: waitForResults() 返回 false — 未出现 .note-item`);
      sendMessage({ type: 'keywordComplete' });
      return;
    }
    sendDebug(`[STEP 2/3] 结果就绪`, `关键词 "${keyword}" 返回了结果`);

    // ── Scroll feed to load more posts ──
    updateStatus('scrolling', `滚动加载更多笔记...`);
    await scrollFeed();

    // ── Step 3: View posts ──
    const limit = config?.postsPerKeyword || 3;

    // Pick random indices from available posts
    const { all: totalPosts } = getPostItems();
    const availableCount = Math.min(limit, totalPosts);
    const allIndices = Array.from({ length: totalPosts }, (_, i) => i);
    // Fisher-Yates shuffle then take first availableCount
    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }
    const pickedIndices = allIndices.slice(0, availableCount);

    sendDebug(`[STEP 3/3] 浏览笔记`, `动作: 随机选 ${availableCount}/${totalPosts} 篇笔记`);
    sendDebug(`[STEP 3/3]`, `每关键词笔记数: ${limit}, 选中索引: [${pickedIndices.join(', ')}]`);

    for (let stepIdx = 0; stepIdx < pickedIndices.length && !S.stopRequested; stepIdx++) {
      const postIndex = pickedIndices[stepIdx];
      updateStatus('clicking', `笔记 ${stepIdx + 1}/${availableCount}`);
      sendDebug(`\n  ── 笔记 ${stepIdx + 1}/${availableCount} (索引 ${postIndex}) ──`);

      if (stepIdx > 0) {
        const pause = 2000 + random(0, 3000);
        sendDebug(`  [ACTION] 笔记间隔暂停`,
          `等待 ${Math.round(pause / 1000)}秒`);
        await sleep(pause);
      }

      sendDebug(`  [ACTION] 打开笔记`, `索引: ${postIndex}, 方式: 点击 .note-item[${postIndex}] 内的 a.cover`);
      const opened = await clickPost(postIndex);
      if (!opened) {
        updateStatus('warning', `笔记 ${stepIdx + 1} 打开失败`);
        sendDebug(`  [SKIP] 笔记 ${stepIdx + 1} 将被跳过`,
          `原因: clickPost(${postIndex}) 返回 false — 详情页未出现`);
        continue;
      }

      incrementStat('viewedPosts');
      updateStatus('viewing', `正在浏览笔记 ${stepIdx + 1}`);
      sendDebug(`  [OK] 笔记 ${stepIdx + 1} (索引 ${postIndex}) 打开成功`,
        `已打开笔记`);

      // Render pause
      const renderPause = 1500 + random(0, 2000);
      sendDebug(`  [ACTION] 等待详情页渲染`,
        `等待 ${Math.round(renderPause / 1000)}秒 加载内容`);
      await sleep(renderPause);

      // Extract note content from DOM
      sendDebug(`  [ACTION] 提取笔记内容`);
      const note = extractNote();

      // Follow author — decides based on fans count from hover card
      sendDebug(`  [ACTION] 检查关注状态`);
      await followAuthor(S.config);

      // Scroll comments & collect user info from hover cards
      updateStatus('scrolling', `正在滚动并收集用户信息 ${stepIdx + 1}`);
      sendDebug(`  [ACTION] 滚动评论区并收集用户信息`);
      const users = await collectUserInfo();
      if (users.length > 0) {
        sendMessage({ type: 'userData', users });
      }

      // Post a comment (pass note data for AI generation)
      sendDebug(`  [ACTION] 发布评论`);
      const commentResult = await postComment(note);
      if (commentResult?.action === 'commented') {
        sendMessage({ type: 'commentMade', text: commentResult.text, timestamp: Date.now() });
      }

      // Read pause
      const readPause = 1500 + random(0, 3000);
      sendDebug(`  [ACTION] 阅读暂停`,
        `暂停 ${Math.round(readPause / 1000)}秒 模拟阅读`);
      await sleep(readPause);

      // Close modal
      updateStatus('closing', `正在关闭笔记 ${stepIdx + 1}`);
      sendDebug(`  [ACTION] 关闭笔记 ${stepIdx + 1}`);
      await closeModal();
      sendDebug(`  [OK] 笔记 ${stepIdx + 1} (索引 ${postIndex}) 完成`);

      // Brief pause
      await sleep(1000 + random(0, 1500));
    }

    if (!S.stopRequested) {
      updateStatus('done', `已完成: ${keyword}`);
      sendDebug(`[COMPLETE] 关键词完成`, `关键词: "${keyword}"`);
    } else {
      sendDebug(`[STOPPED] 关键词被中断`, `关键词: "${keyword}", 原因: stopRequested 标志被设置`);
    }
    sendMessage({ type: 'keywordComplete' });
  }

  // Message handler
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'runKeyword':
        simulateKeyword(msg.keyword, msg.config);
        sendResponse({ ok: true });
        break;
      case 'stop':
        sendDebug(`[STOP] 收到后台停止指令`,
          `当前步骤: ${S.currentStep}, 关键词: ${S.currentKeyword}`);
        S.stopRequested = true;
        S.currentStep = 'stopped';
        updateStatus('stopped', '用户已停止');
        sendResponse({ ok: true });
        break;
      case 'getStatus':
        sendResponse({ step: S.currentStep, keyword: S.currentKeyword, running: !S.stopRequested });
        break;
    }
    return true;
  });

  // Bootstrap
  sendMessage({ type: 'pageLoaded', url: window.location.href });
  sendDebug(`[INIT] 内容脚本已加载`, `hostname: ${window.location.hostname}, url: ${window.location.href}`);
})();
