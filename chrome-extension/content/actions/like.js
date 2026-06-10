window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.like = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug, incrementStat } = window.XHS.utils;

  // Extract user ID from a like wrapper's parent comment container.
  // data-user-id lives on div.avatar > a, which is more reliably present
  // than .author .name (the latter can be missing for blocked/deleted users).
  function extractUserId(likeWrapper) {
    const container = likeWrapper.closest('.comment-item, .parent-comment, [class*="comment"]');
    if (!container) return null;
    // Primary: div.avatar > a[data-user-id]
    const avatarLink = container.querySelector('.avatar > a[data-user-id]');
    if (avatarLink) return avatarLink.getAttribute('data-user-id');
    // Fallback: .author .name
    const nameEl = container.querySelector('.author .name');
    return nameEl?.getAttribute('data-user-id') || null;
  }

  function extractAuthorName(likeWrapper) {
    const container = likeWrapper.closest('.comment-item, .parent-comment, [class*="comment"]');
    if (!container) return '';
    const nameEl = container.querySelector('.author .name');
    return (nameEl?.textContent || '').trim();
  }

  // Fisher-Yates shuffle
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // opts.maxCount limits how many likes to perform in this call.
  // Useful for interleaving with scroll steps.
  async function likeComments(opts = {}) {
    const maxCount = opts.maxCount ?? Infinity;

    sendDebug(`[LIKE] ═══ likeComments 入口 ═══`, `maxCount=${maxCount}, stopRequested=${S.stopRequested}`);

    // Delay for DOM to settle before querying
    await sleep(400 + random(0, 300));

    const likeWrappers = document.querySelectorAll('span.like-wrapper');
    sendDebug(`[LIKE] DOM查询结果`, `选择器 span.like-wrapper 匹配 ${likeWrappers.length} 个元素`);

    if (likeWrappers.length === 0) {
      // Fallback: try div.like
      const fallbackDivs = document.querySelectorAll('div.like');
      sendDebug(`[LIKE] 回退检查`, `div.like 匹配 ${fallbackDivs.length} 个, .comment-item 匹配 ${document.querySelectorAll('.comment-item').length} 个`);
      sendDebug(`[SKIP] 未找到评论点赞按钮`, `选择器: span.like-wrapper`);
      return { action: 'skip', reason: 'no-like-buttons' };
    }

    // Build candidate list — like-active is always present on XHS page,
    // so we rely on our own per-user/day dedup instead of the CSS class.
    const candidates = [];
    for (const wrapper of likeWrappers) {
      const userId = extractUserId(wrapper);
      sendDebug(`[LIKE] 检查 wrapper`, `userId=${userId || 'null'}, classes=${Array.from(wrapper.classList).join(' ')}`);
      candidates.push({ wrapper, userId });
    }

    sendDebug(`[ACTION] 评论点赞检查`,
      `共 ${likeWrappers.length} 条评论, 候选: ${candidates.length}`);

    if (candidates.length === 0) {
      sendDebug(`[SKIP] 未找到可点赞评论`, ``);
      return { action: 'skip', reason: 'no-candidates' };
    }

    // Deduplicate by user within this batch — only one like per user
    const seenUserIds = new Set();
    const deduped = [];
    for (const item of candidates) {
      if (item.userId && seenUserIds.has(item.userId)) continue;
      if (item.userId) seenUserIds.add(item.userId);
      deduped.push(item);
    }

    const dupesSkipped = candidates.length - deduped.length;
    if (dupesSkipped > 0) {
      sendDebug(`[ACTION] 去重`, `跳过 ${dupesSkipped} 条同用户评论, 剩余候选: ${deduped.length}`);
    }

    if (deduped.length === 0) {
      sendDebug(`[SKIP] 去重后无候选`, ``);
      return { action: 'skip', reason: 'all-duplicates' };
    }

    // Check daily rate limit
    const today = new Date().toISOString().slice(0, 10);
    const countKey = `likeCount_${today}`;
    let limit = 40;
    let current = 0;

    try {
      const cfg = await chrome.storage.sync.get('maxLikePerDay');
      limit = Math.max(0, parseInt(cfg.maxLikePerDay) ?? 40);
    } catch (e) {
      sendDebug(`[WARN] 无法读取点赞上限设置`, `error: ${e.message}, 使用默认值: ${limit}`);
    }

    if (limit === 0) {
      sendDebug(`[SKIP] 点赞已禁用`, `maxLikePerDay 设为 0`);
      return { action: 'skip', reason: 'disabled' };
    }

    try {
      const data = await chrome.storage.local.get(countKey);
      current = data[countKey] || 0;
    } catch (e) {
      sendDebug(`[WARN] 无法读取今日点赞计数`, `error: ${e.message}, 默认: 0`);
    }

    if (current >= limit) {
      sendDebug(`[SKIP] 已达每日点赞上限`, `已赞: ${current}, 上限: ${limit}`);
      return { action: 'skip', reason: 'daily-limit', current, limit };
    }

    // Check liked user IDs today — don't like the same user twice in a day
    const likedUsersKey = `likedUserIds_${today}`;
    let likedUserIds = [];
    try {
      const data = await chrome.storage.local.get(likedUsersKey);
      likedUserIds = data[likedUsersKey] || [];
    } catch (e) { /* ignore */ }
    const likedSet = new Set(likedUserIds);

    const freshCandidates = deduped.filter(c => !c.userId || !likedSet.has(c.userId));
    const alreadyLikedUsers = deduped.length - freshCandidates.length;
    if (alreadyLikedUsers > 0) {
      sendDebug(`[ACTION] 排除已赞用户`, `跳过 ${alreadyLikedUsers} 个今日已赞用户, 剩余: ${freshCandidates.length}`);
    }

    if (freshCandidates.length === 0) {
      sendDebug(`[SKIP] 无可点赞评论`, `今日已赞过所有这些用户`);
      return { action: 'skip', reason: 'all-users-liked-today' };
    }

    // Shuffle candidates for randomness
    shuffle(freshCandidates);

    const remaining = limit - current;
    // Randomly pick how many to like: between 1 and min(remaining, candidates, max ~30% of candidates)
    const maxToLike = Math.min(remaining, freshCandidates.length);
    const minToLike = Math.min(1, maxToLike);
    const toLike = Math.min(
      maxCount,
      Math.max(minToLike, Math.min(maxToLike, Math.ceil(freshCandidates.length * (0.15 + Math.random() * 0.35))))
    );

    sendDebug(`[ACTION] 随机点赞评论`,
      `选出 ${toLike}/${freshCandidates.length} 条 (去重后候选: ${freshCandidates.length}, 剩余额度: ${remaining})`);

    let liked = 0;
    const newLikedUserIds = [...likedUserIds];
    for (let i = 0; i < toLike && !S.stopRequested; i++) {
      const { wrapper, userId } = freshCandidates[i];
      const author = extractAuthorName(wrapper);

      sendDebug(`[LIKE] 点赞 ${i + 1}/${toLike}`, `作者: ${author || '未知'}, userId: ${userId || 'null'}, tagName: ${wrapper.tagName}, classes: ${Array.from(wrapper.classList).join(' ')}`);

      // Longer delay before clicking for observability
      await sleep(800 + random(0, 400));
      wrapper.click();
      sendDebug(`[LIKE] click() 已执行`, `元素: ${wrapper.tagName}.${Array.from(wrapper.classList).join('.')}`);
      liked++;
      incrementStat('commentsLiked');
      if (userId) newLikedUserIds.push(userId);
      await sleep(800 + random(0, 600));
    }

    // Persist counts
    try {
      await chrome.storage.local.set({
        [countKey]: current + liked,
        [likedUsersKey]: newLikedUserIds
      });
    } catch (e) {
      sendDebug(`[WARN] 无法保存点赞计数`, `error: ${e.message}`);
    }

    sendDebug(`[OK] 点赞完成`, `已赞: ${liked} 条, 今日: ${current + liked}/${limit}`);
    return { action: 'liked', liked, current: current + liked, limit };
  }

  return { likeComments };
})();
