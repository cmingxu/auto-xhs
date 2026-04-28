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

let currentStatus = { step: 'idle', message: '', stats: { viewedPosts: 0, scrolledComments: 0 } };

function broadcastUpdate() {
  chrome.runtime.sendMessage({
    type: 'statusUpdate',
    ...currentStatus,
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
    'keywords', 'minDelay', 'maxDelay', 'scrollDelay', 'postsPerKeyword'
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
    }
  };

  await chrome.storage.session.set({ simulation: { running: true } });

  // Clear previous session data
  await chrome.storage.local.set({ collectedUsers: [], scrapedComments: [], commentsMade: [] });

  currentStatus = {
    step: 'starting',
    message: `开始: ${keywords[0]}`,
    stats: { viewedPosts: 0, scrolledComments: 0, followedAuthors: 0, commentsPosted: 0 }
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
  await chrome.storage.session.set({ simulation: { running: false } });

  if (simulationState.tabId) {
    chrome.tabs.sendMessage(simulationState.tabId, { type: 'stop' }).catch(() => {});
  }

  currentStatus = { step: 'stopped', message: '模拟已停止', stats: currentStatus.stats };
  broadcastUpdate();
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
    simulationState.running = false;
    await chrome.storage.session.set({ simulation: { running: false } });
    currentStatus = {
      step: 'complete',
      message: '所有关键词已完成！',
      stats: currentStatus.stats
    };
    broadcastUpdate();
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
        message: msg.message || currentStatus.message,
        stats: msg.stats || currentStatus.stats
      };
      broadcastUpdate();
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

    case 'start':
      startSimulation(msg.tabId);
      sendResponse({ ok: true });
      break;

    case 'stop':
      stopSimulation();
      sendResponse({ ok: true });
      break;

    case 'getStatus':
      sendResponse({
        running: simulationState.running,
        ...currentStatus,
        keywords: simulationState.keywords,
        currentKeywordIndex: simulationState.currentKeywordIndex,
        config: simulationState.config
      });
      break;
  }
  return true;
});

// Cleanup if tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === simulationState.tabId) {
    simulationState.running = false;
    chrome.storage.session.set({ simulation: { running: false } });
    currentStatus = { step: 'stopped', message: '标签页已关闭', stats: currentStatus.stats };
  }
});
