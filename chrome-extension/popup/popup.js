const statusEl = document.getElementById('statusValue');
const postsEl = document.getElementById('postsViewed');
const commentsEl = document.getElementById('commentsScrolled');
const followedEl = document.getElementById('followedAuthors');
const commentsPostedEl = document.getElementById('commentsPosted');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressLabel = document.getElementById('progressLabel');
const actionBtn = document.getElementById('actionBtn');
const optionsLink = document.getElementById('openOptions');
const debugHeader = document.getElementById('debugHeader');
const debugBody = document.getElementById('debugBody');
const debugBadge = document.getElementById('debugBadge');
const debugToggle = document.getElementById('debugToggle');

const MAX_DEBUG_ENTRIES = 200;
let debugEntries = [];
let debugOpen = true;
let isRunning = false;

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

function addDebugEntry(msg, ts, detail) {
  const entry = { message: msg, timestamp: ts || Date.now(), detail: detail || '' };
  debugEntries.push(entry);
  if (debugEntries.length > MAX_DEBUG_ENTRIES) debugEntries.shift();

  if (!debugBody) return;

  const el = document.createElement('div');
  const cls = getDebugClass(msg);
  el.className = 'debug-entry' + (cls ? ' ' + cls : '');

  let html = `<span class="time">${fmtTime(entry.timestamp)}</span>`;
  let displayMsg = escapeHtml(entry.message).replace(/\[(\w+)\]/g, '<span class="tag">$1</span>');
  html += displayMsg;
  if (entry.detail) {
    html += `<div class="detail">${escapeHtml(entry.detail).replace(/,/g, ',<br>')}</div>`;
  }
  el.innerHTML = html;
  debugBody.appendChild(el);
  debugBody.scrollTop = debugBody.scrollHeight;
  debugBadge.textContent = debugEntries.length;

  updateActionPanel(msg, detail);
}

function updateActionPanel(msg, detail) {
  const curAction = document.getElementById('curAction');
  const curSelector = document.getElementById('curSelector');
  const curResult = document.getElementById('curResult');
  if (!curAction || !curSelector || !curResult) return;

  const actionMatch = msg.match(/\[(ACTION|STEP\s*\d+\/\d+)\]\s*(.+)/);
  if (actionMatch) { curAction.textContent = actionMatch[2]; curAction.className = 'action-value'; }

  if (detail) {
    const selMatch = detail.match(/selector:\s*([^,]+)/);
    if (selMatch) { curSelector.textContent = selMatch[1].trim(); curSelector.className = 'action-value selector'; }
  }

  const resultMatch = msg.match(/\[(OK|FAIL|TIMEOUT|WARN|SKIP|RETRY|FALLBACK|DONE|COMPLETE|ABORT|STOPPED|ERROR)\]/);
  if (resultMatch) {
    const tag = resultMatch[1];
    const labelMap = { OK:'成功', FAIL:'失败', TIMEOUT:'超时', WARN:'警告', SKIP:'跳过', RETRY:'重试', FALLBACK:'降级', DONE:'完成', COMPLETE:'完成', ABORT:'中止', STOPPED:'已停止', ERROR:'错误' };
    curResult.textContent = labelMap[tag] || tag;
    curResult.className = 'action-value ' + (
      ['OK','DONE','COMPLETE'].includes(tag) ? 'result-ok' :
      ['FAIL','TIMEOUT','ERROR','ABORT'].includes(tag) ? 'result-fail' :
      ['WARN','SKIP','RETRY','FALLBACK'].includes(tag) ? 'result-warn' : 'result-info'
    );
  }

  if (actionMatch && !resultMatch) { curResult.textContent = '执行中'; curResult.className = 'action-value result-info'; }
}

function getDebugClass(msg) {
  if (msg.startsWith('[FAIL]') || msg.includes('[TIMEOUT]') || msg.includes('[ABORT]')) return 'error';
  if (msg.startsWith('[WARN]') || msg.startsWith('[SKIP]') || msg.startsWith('[RETRY]') || msg.startsWith('[FALLBACK]')) return 'warn';
  if (msg.startsWith('[OK]') || msg.includes('[COMPLETE]') || msg.startsWith('[DONE]')) return 'done';
  if (msg.startsWith('[ACTION]') || msg.startsWith('[STEP')) return 'info';
  return '';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateUI(status) {
  isRunning = status.running;
  const step = status.step || 'idle';
  const keyword = status.keyword || '';
  statusEl.textContent = keyword ? `${keyword}: ${status.message || step}` : (status.message || step);
  statusEl.className = 'value ' + (
    ['running','starting','clicking','viewing','scrolling','closing','collecting'].includes(step) ? 'running' :
    step === 'stopped' || step === 'idle' ? 'stopped' :
    step === 'complete' ? 'complete' :
    step === 'error' ? 'error' : 'starting'
  );

  postsEl.textContent = status.stats?.viewedPosts ?? 0;
  commentsEl.textContent = status.stats?.scrolledComments ?? 0;
  followedEl.textContent = status.stats?.followedAuthors ?? 0;
  commentsPostedEl.textContent = status.stats?.commentsPosted ?? 0;

  const total = status.keywords?.length || 0;
  const current = status.currentKeywordIndex ?? 0;
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  progressFill.style.width = (step === 'complete' ? 100 : Math.min(progress, 100)) + '%';
  progressText.textContent = `${Math.min(current + (status.running ? 1 : 0), total)} / ${total}`;

  actionBtn.textContent = isRunning ? '停止模拟' : '开始模拟';
  actionBtn.className = isRunning ? 'btn btn-stop' : 'btn btn-start';
}

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'getStatus' });
  if (status) updateUI(status);
}

actionBtn.addEventListener('click', async () => {
  actionBtn.disabled = true;
  try {
    if (isRunning) {
      addDebugEntry('用户点击了停止', Date.now());
      await chrome.runtime.sendMessage({ type: 'stop' });
    } else {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) { actionBtn.disabled = false; return; }
      addDebugEntry(`用户点击了开始 (标签页: ${tabs[0].id})`, Date.now());
      await chrome.runtime.sendMessage({ type: 'start', tabId: tabs[0].id });
    }
  } catch (e) {
    statusEl.textContent = '错误: ' + e.message;
    statusEl.className = 'value error';
    addDebugEntry('错误: ' + e.message, Date.now());
  }
  actionBtn.disabled = false;
});

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

debugHeader.addEventListener('click', () => {
  debugOpen = !debugOpen;
  debugBody.classList.toggle('open', debugOpen);
  debugToggle.textContent = debugOpen ? '▼' : '▶';
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'statusUpdate') updateUI(msg);
  else if (msg.type === 'debugLog') addDebugEntry(msg.message, msg.timestamp, msg.detail);
});

refreshStatus().then(() => addDebugEntry('弹窗已打开', Date.now()));
