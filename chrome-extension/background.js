// Injected into page MAIN world via chrome.scripting.executeScript. Intercepts hover_card and comment/page APIs.
// Must be a standalone function — no closures, no external references.
function interceptXhsApis() {
  if (window.__xhs_intercept_installed) return;
  window.__xhs_intercept_installed = true;

  const HOVER_CARD = 'edith.xiaohongshu.com/api/sns/web/v1/user/hover_card';
  const COMMENT_PAGE = 'edith.xiaohongshu.com/api/sns/web/v2/comment/page';

  console.log('[XHS-INTERCEPT] installed, patching fetch + XHR');

  function matchSource(url) {
    if (url.includes(HOVER_CARD)) return 'xhs-hover-card';
    if (url.includes(COMMENT_PAGE)) return 'xhs-comment-page';
    return null;
  }

  function processPayload(url, data) {
    const source = matchSource(url);
    if (source === 'xhs-comment-page') {
      console.log('[XHS-INTERCEPT] comment page data, comments:', data.data?.comments?.length);
    } else if (source === 'xhs-hover-card') {
      console.log('[XHS-INTERCEPT] hover card data, nickname:', data.data?.basic_info?.nickname);
    }
    window.postMessage({ source, payload: data }, '*');
  }

  // Patch fetch
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const promise = originalFetch.apply(this, args);
    const source = matchSource(url);
    if (source) {
      console.log('[XHS-INTERCEPT] fetch', source, url.slice(0, 120));
      promise.then(response => {
        if (response && response.clone) {
          response.clone().json().then(data => processPayload(url, data)).catch(() => {});
        }
      }).catch(() => {});
    }
    return promise;
  };

  // Patch XHR
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__xhs_url = url;
    return origOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const url = this.__xhs_url || '';
    const source = matchSource(url);
    if (source) {
      console.log('[XHS-INTERCEPT] XHR', source, url.slice(0, 120));
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          processPayload(url, data);
        } catch(e) { console.error('[XHS-INTERCEPT] XHR parse error', e); }
      });
    }
    return origSend.apply(this, args);
  };

  console.log('[XHS-INTERCEPT] setup complete');
}

let simulationState = {
  running: false,
  tabId: null,
  currentKeywordIndex: 0,
  keywords: [],
  config: {}
};

let currentStatus = { step: 'idle', message: '' };
let globalStats = { viewedPosts: 0, scrolledComments: 0, followedAuthors: 0, commentsPosted: 0, commentsLiked: 0 };
let repeatTimer = null;
let syncTimer = null;
let syncRunning = false;

async function syncRecords() {
  if (syncRunning) return;
  syncRunning = true;

  try {
    const cfg = await chrome.storage.sync.get(['backendUrl']);
    const base = (cfg.backendUrl || '').trim().replace(/\/+$/, '');
    if (!base) { syncRunning = false; return; }

    const local = await chrome.storage.local.get([
      'collectedUsers', 'scrapedNotes', 'scrapedComments', 'aiGeneratedComments'
    ]);

    const batches = [];

    // Users
    const users = local.collectedUsers || [];
    if (users.length > 0) {
      // Convert notes array to JSON string for each user
      const payload = users.map(u => ({
        ...u,
        notes: typeof u.notes === 'string' ? u.notes : JSON.stringify(u.notes || [])
      }));
      batches.push({ key: 'collectedUsers', url: base + '/api/xhs-users', body: payload });
    }

    // Notes
    const notes = local.scrapedNotes || [];
    if (notes.length > 0) {
      batches.push({ key: 'scrapedNotes', url: base + '/api/notes', body: notes });
    }

    // Comments
    const comments = local.scrapedComments || [];
    if (comments.length > 0) {
      batches.push({ key: 'scrapedComments', url: base + '/api/comments', body: comments });
    }

    // AI Comments
    const aiComments = local.aiGeneratedComments || [];
    if (aiComments.length > 0) {
      const payload = aiComments.map(c => ({
        id: c.id || '',
        noteTitle: c.noteTitle || '',
        noteContent: c.noteContent || '',
        comment: c.comment || '',
        noteUrl: c.noteUrl || ''
      }));
      batches.push({ key: 'aiGeneratedComments', url: base + '/api/ai-comments', body: payload });
    }

    for (const batch of batches) {
      const bodyText = JSON.stringify(batch.body);
      console.log('[SYNC] POST', batch.url, 'body:', bodyText.slice(0, 500) + (bodyText.length > 500 ? '...' : ''));
      try {
        const resp = await fetch(batch.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText
        });
        const respText = await resp.text();
        console.log('[SYNC] response', batch.url, 'status:', resp.status, 'body:', respText.slice(0, 300));
        if (resp.ok) {
          await chrome.storage.local.set({ [batch.key]: [] });
          console.log('[SYNC] posted', batch.body.length, 'records to', batch.url);
        } else {
          console.error('[SYNC] failed', batch.url, resp.status, respText);
        }
      } catch (e) {
        console.error('[SYNC] error posting to', batch.url, e.message);
      }
    }
  } catch (e) {
    console.error('[SYNC] error', e.message);
  } finally {
    syncRunning = false;
  }
}

function startSyncTimer() {
  stopSyncTimer();
  syncTimer = setInterval(syncRecords, 30_000);
}

function stopSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function loadStats() {
  const data = await chrome.storage.local.get('globalStats');
  if (data.globalStats) {
    globalStats = { ...globalStats, ...data.globalStats };
  }
}

// Load globalStats from storage on startup
loadStats();

// Start sync timer on load to flush any leftover data
startSyncTimer();

function broadcastUpdate() {
  chrome.runtime.sendMessage({
    type: 'statusUpdate',
    ...currentStatus,
    stats: globalStats,
    running: simulationState.running,
    keywords: simulationState.keywords,
    currentKeywordIndex: simulationState.currentKeywordIndex,
    config: simulationState.config
  }).catch(() => {});
}

function sendKeywordToContent() {
  const keyword = simulationState.keywords[simulationState.currentKeywordIndex];
  if (!keyword || !simulationState.tabId) return;

  chrome.tabs.sendMessage(simulationState.tabId, {
    type: 'runKeyword',
    keyword,
    config: simulationState.config
  }).catch(() => {
    // Content script not loaded yet — navigate to homepage
    chrome.tabs.update(simulationState.tabId, { url: 'https://www.xiaohongshu.com' });
  });
}

async function startSimulation(tabId) {
  const cfg = await chrome.storage.sync.get([
    'keywords', 'minDelay', 'maxDelay', 'scrollDelay', 'postsPerKeyword', 'repeatInterval', 'minFansToFollow'
  ]);

  const rawKeywords = cfg.keywords || [];
  const keywords = (Array.isArray(rawKeywords) ? rawKeywords : String(rawKeywords).split(',')).map(k => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    currentStatus = {
      step: 'error',
      message: '未配置关键词，请打开设置页面。',
      stats: { viewedPosts: 0, scrolledComments: 0 }
    };
    broadcastUpdate();
    return;
  }

  simulationState = {
    running: true,
    tabId,
    currentKeywordIndex: 0,
    keywords,
    config: {
      postsPerKeyword: Math.max(1, parseInt(cfg.postsPerKeyword) || 3),
      minDelay: Math.max(1000, parseInt(cfg.minDelay) || 3000),
      maxDelay: Math.max(2000, parseInt(cfg.maxDelay) || 8000),
      scrollDelay: Math.max(100, parseInt(cfg.scrollDelay) || 800),
      repeatInterval: cfg.repeatInterval || '',
      minFansToFollow: Math.max(0, parseInt(cfg.minFansToFollow) || 300),
    }
  };

  await chrome.storage.session.set({ simulation: { running: true } });

  startSyncTimer();

  // Clear previous session data
  await chrome.storage.local.set({ collectedUsers: [], scrapedComments: [], scrapedNotes: [], aiGeneratedComments: [], commentsMade: [] });

  currentStatus = {
    step: 'starting',
    message: `开始: ${keywords[0]}`
  };
  broadcastUpdate();

  // Check if already on xiaohongshu.com
  const tab = await chrome.tabs.get(tabId);
  if (tab.url && tab.url.includes('xiaohongshu.com')) {
    sendKeywordToContent();
  } else {
    chrome.tabs.update(tabId, { url: 'https://www.xiaohongshu.com' });
  }
}

async function stopSimulation() {
  simulationState.running = false;
  clearRepeatTimer();
  stopSyncTimer();
  await chrome.storage.session.set({ simulation: { running: false } });

  if (simulationState.tabId) {
    chrome.tabs.sendMessage(simulationState.tabId, { type: 'stop' }).catch(() => {});
  }

  currentStatus = { step: 'stopped', message: '模拟已停止' };
  broadcastUpdate();
}

function clearRepeatTimer() {
  if (repeatTimer) {
    clearTimeout(repeatTimer);
    repeatTimer = null;
  }
}

async function handleKeywordComplete() {
  if (!simulationState.running) return;

  const nextIndex = simulationState.currentKeywordIndex + 1;
  if (nextIndex < simulationState.keywords.length) {
    simulationState.currentKeywordIndex = nextIndex;
    currentStatus.message = `当前: ${simulationState.keywords[nextIndex]}`;
    broadcastUpdate();
    sendKeywordToContent();
  } else {
    // All keywords done — always loop back, never stop on our own
    const intervalMin = parseInt(simulationState.config.repeatInterval) || 0;
    const waitMs = intervalMin > 0 ? intervalMin * 60 * 1000 : 3000;

    currentStatus = {
      step: 'waiting',
      message: intervalMin > 0
        ? `本轮完成，${intervalMin}分钟后重新开始...`
        : `本轮完成，即将重新开始...`
    };
    broadcastUpdate();

    repeatTimer = setTimeout(async () => {
      repeatTimer = null;
      if (!simulationState.running) return;

      simulationState.currentKeywordIndex = 0;
      currentStatus = {
        step: 'starting',
        message: `重新开始: ${simulationState.keywords[0]}`
      };
      broadcastUpdate();
      sendKeywordToContent();
    }, waitMs);
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'pageLoaded':
      if (simulationState.running && sender.tab?.id === simulationState.tabId) {
        sendKeywordToContent();
      }
      sendResponse({ ok: true });
      break;

    case 'statusUpdate':
      currentStatus = {
        step: msg.step || currentStatus.step,
        message: msg.message || currentStatus.message
      };
      broadcastUpdate();
      sendResponse({ ok: true });
      break;

    case 'incrementStat':
      if (msg.stat && globalStats.hasOwnProperty(msg.stat)) {
        globalStats[msg.stat] += (msg.value || 1);
        chrome.storage.local.set({ globalStats });
        broadcastUpdate();
      }
      sendResponse({ ok: true });
      break;

    case 'keywordComplete':
      handleKeywordComplete();
      sendResponse({ ok: true });
      break;

    case 'debugLog':
      chrome.runtime.sendMessage({
        type: 'debugLog',
        message: msg.message,
        detail: msg.detail || '',
        timestamp: msg.timestamp
      }).catch(() => {});
      sendResponse({ ok: true });
      break;

    case 'injectIntercept':
      (async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            func: interceptXhsApis
          });
          sendResponse({ ok: true });
        } catch(e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;

    case 'userData':
      // Persist to storage for options page, deduplicate by nickname
      (async () => {
        try {
          const { collectedUsers } = await chrome.storage.local.get('collectedUsers');
          const existing = collectedUsers || [];
          const map = new Map(existing.map(u => [u.nickname, u]));
          for (const u of msg.users) {
            if (u.nickname) map.set(u.nickname, u); // latest wins
          }
          const merged = Array.from(map.values());
          await chrome.storage.local.set({ collectedUsers: merged });
        } catch(e) { /* ignore */ }
      })();
      // Broadcast to sidebar
      chrome.runtime.sendMessage({
        type: 'userData',
        users: msg.users
      }).catch(() => {});
      sendResponse({ ok: true });
      break;

    case 'scrapedComments':
      // Persist scraped comments to storage, deduplicate by comment_id
      (async () => {
        try {
          const { scrapedComments } = await chrome.storage.local.get('scrapedComments');
          const existing = scrapedComments || [];
          const ids = new Set(existing.map(c => c.comment_id));
          let added = 0;
          for (const c of msg.comments) {
            if (!ids.has(c.comment_id)) {
              existing.push(c);
              ids.add(c.comment_id);
              added++;
            }
          }
          await chrome.storage.local.set({ scrapedComments: existing });
          if (added > 0) console.log('[BG] stored', added, 'new comments, total:', existing.length);
        } catch(e) { /* ignore */ }
      })();
      sendResponse({ ok: true });
      break;

    case 'scrapedNotes':
      // Persist scraped notes to storage, deduplicate by note_id or url
      (async () => {
        try {
          const { scrapedNotes } = await chrome.storage.local.get('scrapedNotes');
          const existing = scrapedNotes || [];
          const seen = new Set(existing.map(n => n.note_id || n.url));
          let added = 0;
          for (const n of msg.notes) {
            const key = n.note_id || n.url;
            if (!key || seen.has(key)) continue;
            existing.push(n);
            seen.add(key);
            added++;
          }
          await chrome.storage.local.set({ scrapedNotes: existing });
          if (added > 0) console.log('[BG] stored', added, 'new notes, total:', existing.length);
        } catch(e) { /* ignore */ }
      })();
      sendResponse({ ok: true });
      break;

    case 'commentMade':
      // Persist to storage for options page
      (async () => {
        try {
          const { commentsMade } = await chrome.storage.local.get('commentsMade');
          const list = commentsMade || [];
          list.push({ text: msg.text, timestamp: msg.timestamp || Date.now() });
          await chrome.storage.local.set({ commentsMade: list });
        } catch(e) { /* ignore */ }
      })();
      sendResponse({ ok: true });
      break;

    case 'generateComment':
      // Proxy DeepSeek API call
      (async () => {
        try {
          const cfg = await chrome.storage.sync.get([
            'deepseekApiKey', 'deepseekSystemPrompt', 'deepseekUserPrompt'
          ]);
          const apiKey = cfg.deepseekApiKey;
          if (!apiKey) {
            sendResponse({ ok: false, error: '未配置 DeepSeek API Key' });
            return;
          }

          const systemPrompt = cfg.deepseekSystemPrompt || '你是一个社交媒体运营人员，你的目的是针对一个帖子进行评论';
          let userPrompt = cfg.deepseekUserPrompt || '请根据以下帖子内容生成一条评论：\n标题：{title}\n内容：{content}';
          userPrompt = userPrompt.replace(/\{title\}/g, msg.title || '').replace(/\{content\}/g, msg.content || '');

          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 15000);

          let resp;
          try {
            resp = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ],
                temperature: 0.9,
                max_tokens: 200
              }),
              signal: ctrl.signal
            });
          } finally {
            clearTimeout(timer);
          }

          if (!resp.ok) {
            const errText = await resp.text();
            console.error('[BG] DeepSeek API error', resp.status, errText);
            sendResponse({ ok: false, error: `API error ${resp.status}: ${errText}` });
            return;
          }

          const data = await resp.json();
          const rawContent = data.choices?.[0]?.message?.content || '';

          // Try to parse JSON response, otherwise use raw content
          let comment = rawContent;
          try {
            const parsed = JSON.parse(rawContent);
            if (parsed.comment) comment = parsed.comment;
          } catch (e) {
            // Not JSON, use raw content directly
            comment = rawContent.trim();
          }

          console.log('[BG] AI generated comment:', comment.slice(0, 80));
          sendResponse({ ok: true, comment });
        } catch (e) {
          console.error('[BG] generateComment error', e);
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;

    case 'aiGeneratedComment':
      // Store AI-generated comment
      (async () => {
        try {
          const { aiGeneratedComments } = await chrome.storage.local.get('aiGeneratedComments');
          const list = aiGeneratedComments || [];
          list.push({
            id: 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            noteTitle: msg.noteTitle || '',
            noteContent: (msg.noteContent || '').slice(0, 300),
            comment: msg.comment || '',
            noteUrl: msg.noteUrl || '',
            timestamp: Date.now()
          });
          await chrome.storage.local.set({ aiGeneratedComments: list });
          console.log('[BG] stored AI comment, total:', list.length);
        } catch(e) { /* ignore */ }
      })();
      sendResponse({ ok: true });
      break;

    case 'start':
      startSimulation(msg.tabId);
      sendResponse({ ok: true });
      break;

    case 'stop':
      stopSimulation();
      sendResponse({ ok: true });
      break;

    case 'getStatus':
      loadStats().then(() => {
        sendResponse({
          running: simulationState.running,
          ...currentStatus,
          stats: globalStats,
          keywords: simulationState.keywords,
          currentKeywordIndex: simulationState.currentKeywordIndex,
          config: simulationState.config
        });
      });
      return true; // Keep message channel open for async response
  }
  return true;
});

// Cleanup if tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === simulationState.tabId) {
    simulationState.running = false;
    chrome.storage.session.set({ simulation: { running: false } });
    currentStatus = { step: 'stopped', message: '标签页已关闭' };
  }
});
