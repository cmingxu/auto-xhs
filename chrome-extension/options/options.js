const DEFAULTS = {
  keywords: '穿搭, 旅行, 美食',
  postsPerKeyword: 3,
  minDelay: 3,
  maxDelay: 8,
  scrollDelay: 800,
  maxFollowsPerDay: 5,
  commentTexts: '写得真好, 学到了, 太棒了',
  maxCommentsPerDay: 3
};

const PAGE_SIZE = 20;

// ── Tab switching ──
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + tab).classList.add('active');
    if (tab === 'users') loadUsers();
    if (tab === 'comments') loadComments();
  });
});

// ── Settings form ──
const keywordsEl = document.getElementById('keywords');
const postsPerKeywordEl = document.getElementById('postsPerKeyword');
const minDelayEl = document.getElementById('minDelay');
const maxDelayEl = document.getElementById('maxDelay');
const scrollDelayEl = document.getElementById('scrollDelay');
const maxFollowsPerDayEl = document.getElementById('maxFollowsPerDay');
const commentTextsEl = document.getElementById('commentTexts');
const maxCommentsPerDayEl = document.getElementById('maxCommentsPerDay');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const toast = document.getElementById('toast');

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

async function loadSettings() {
  const data = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  keywordsEl.value = data.keywords ?? DEFAULTS.keywords;
  postsPerKeywordEl.value = data.postsPerKeyword ?? DEFAULTS.postsPerKeyword;
  minDelayEl.value = data.minDelay ?? DEFAULTS.minDelay;
  maxDelayEl.value = data.maxDelay ?? DEFAULTS.maxDelay;
  scrollDelayEl.value = data.scrollDelay ?? DEFAULTS.scrollDelay;
  maxFollowsPerDayEl.value = data.maxFollowsPerDay ?? DEFAULTS.maxFollowsPerDay;
  commentTextsEl.value = data.commentTexts ?? DEFAULTS.commentTexts;
  maxCommentsPerDayEl.value = data.maxCommentsPerDay ?? DEFAULTS.maxCommentsPerDay;
}

async function saveSettings() {
  const values = {
    keywords: keywordsEl.value.trim(),
    postsPerKeyword: parseInt(postsPerKeywordEl.value) || DEFAULTS.postsPerKeyword,
    minDelay: Math.max(1, parseInt(minDelayEl.value) || DEFAULTS.minDelay),
    maxDelay: Math.max(2, parseInt(maxDelayEl.value) || DEFAULTS.maxDelay),
    scrollDelay: Math.max(100, parseInt(scrollDelayEl.value) || DEFAULTS.scrollDelay),
    maxFollowsPerDay: Math.max(0, parseInt(maxFollowsPerDayEl.value) ?? DEFAULTS.maxFollowsPerDay),
    commentTexts: commentTextsEl.value.trim(),
    maxCommentsPerDay: Math.max(0, parseInt(maxCommentsPerDayEl.value) ?? DEFAULTS.maxCommentsPerDay),
  };
  if (values.maxDelay <= values.minDelay) {
    values.maxDelay = values.minDelay + 2;
    maxDelayEl.value = values.maxDelay;
  }
  await chrome.storage.sync.set(values);
  showToast('设置已保存！');
}

function resetDefaults() {
  keywordsEl.value = DEFAULTS.keywords;
  postsPerKeywordEl.value = DEFAULTS.postsPerKeyword;
  minDelayEl.value = DEFAULTS.minDelay;
  maxDelayEl.value = DEFAULTS.maxDelay;
  scrollDelayEl.value = DEFAULTS.scrollDelay;
  maxFollowsPerDayEl.value = DEFAULTS.maxFollowsPerDay;
  commentTextsEl.value = DEFAULTS.commentTexts;
  maxCommentsPerDayEl.value = DEFAULTS.maxCommentsPerDay;
  showToast('已恢复默认值（尚未保存）');
}

minDelayEl.addEventListener('change', () => {
  const min = parseInt(minDelayEl.value) || 1;
  const max = parseInt(maxDelayEl.value) || 8;
  if (max <= min) maxDelayEl.value = min + 2;
});
maxDelayEl.addEventListener('change', () => {
  const min = parseInt(minDelayEl.value) || 1;
  const max = parseInt(maxDelayEl.value) || 8;
  if (max <= min) maxDelayEl.value = min + 2;
});

saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetDefaults);

// ── Helpers ──
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}

// ── Pagination ──
function renderPagination(containerId, page, totalPages, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>`;

  const maxButtons = 7;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

  if (start > 1) {
    html += `<button class="page-btn" data-page="1">1</button>`;
    if (start > 2) html += `<span class="page-info">…</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="page-info">…</span>`;
    html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>`;

  container.innerHTML = html;
  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
  });
}

// ═══════════════════════════════════════════
// User list
// ═══════════════════════════════════════════
let userPage = 1;
let userSelected = new Set();
let allUsers = [];

const userSelectAll = document.getElementById('userSelectAll');
const userDeleteSelected = document.getElementById('userDeleteSelected');
const userDeleteAll = document.getElementById('userDeleteAll');
const userList = document.getElementById('userList');
const userCount = document.getElementById('userCount');
const userPagination = document.getElementById('userPagination');

function renderUserCards(users) {
  if (users.length === 0) {
    userList.innerHTML = '<div class="empty-state">暂无用户数据</div>';
    return;
  }
  const html = users.map(u => {
    const checked = userSelected.has(u.nickname) ? ' checked' : '';
    const stats = [
      `<span>关注: ${u.follows || '0'}</span>`,
      `<span>粉丝: ${u.fans || '0'}</span>`,
      `<span>互动: ${u.interaction || '0'}</span>`
    ].join('');
    const notes = (u.notes || []).slice(0, 3).map(n =>
      `<img class="user-note-cover" src="${esc(n.cover)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    ).join('');
    return `
      <div class="user-card">
        <input type="checkbox" class="user-checkbox" data-id="${esc(u.nickname)}"${checked}>
        <img class="user-avatar" src="${esc(u.images)}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="user-info">
          <div class="user-nickname">${esc(u.nickname)}</div>
          <div class="user-desc">${esc(u.desc || '无简介')}</div>
          <div class="user-stats">${stats}</div>
          ${notes ? `<div class="user-notes">${notes}</div>` : ''}
        </div>
      </div>`;
  }).join('');
  userList.innerHTML = html;

  // Bind checkbox events
  userList.querySelectorAll('.user-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) userSelected.add(id);
      else userSelected.delete(id);
      updateUserToolbar();
    });
  });
}

function updateUserToolbar() {
  const pageUsers = getPageUsers();
  const allChecked = pageUsers.length > 0 && pageUsers.every(u => userSelected.has(u.nickname));
  userSelectAll.checked = allChecked;
  userDeleteSelected.disabled = userSelected.size === 0;
  userCount.textContent = allUsers.length;
}

function getPageUsers() {
  const start = (userPage - 1) * PAGE_SIZE;
  return allUsers.slice(start, start + PAGE_SIZE);
}

function renderUserPage() {
  const totalPages = Math.ceil(allUsers.length / PAGE_SIZE) || 1;
  if (userPage > totalPages) userPage = totalPages;

  const pageUsers = getPageUsers();
  renderUserCards(pageUsers);
  updateUserToolbar();
  renderPagination('userPagination', userPage, totalPages, (p) => {
    userPage = p;
    renderUserPage();
  });
}

async function loadUsers() {
  const { collectedUsers } = await chrome.storage.local.get('collectedUsers');
  allUsers = (collectedUsers || []).slice().reverse();
  userPage = 1;
  userSelected.clear();
  renderUserPage();
}

userSelectAll.addEventListener('change', () => {
  const pageUsers = getPageUsers();
  if (userSelectAll.checked) {
    pageUsers.forEach(u => userSelected.add(u.nickname));
  } else {
    pageUsers.forEach(u => userSelected.delete(u.nickname));
  }
  renderUserPage();
});

userDeleteSelected.addEventListener('click', async () => {
  if (userSelected.size === 0) return;
  allUsers = allUsers.filter(u => !userSelected.has(u.nickname));
  userSelected.clear();
  await chrome.storage.local.set({ collectedUsers: allUsers.slice().reverse() });
  if (getPageUsers().length === 0 && userPage > 1) userPage--;
  renderUserPage();
  showToast(`已删除选中用户`);
});

userDeleteAll.addEventListener('click', async () => {
  if (allUsers.length === 0) return;
  if (!confirm(`确定要删除全部 ${allUsers.length} 个用户吗？`)) return;
  allUsers = [];
  userSelected.clear();
  userPage = 1;
  await chrome.storage.local.set({ collectedUsers: [] });
  renderUserPage();
  showToast('已删除全部用户');
});

// ═══════════════════════════════════════════
// Comment list (scraped comments)
// ═══════════════════════════════════════════
let commentPage = 1;
let commentSelected = new Set();
let allComments = [];

const commentSelectAll = document.getElementById('commentSelectAll');
const commentDeleteSelected = document.getElementById('commentDeleteSelected');
const commentDeleteAll = document.getElementById('commentDeleteAll');
const commentList = document.getElementById('commentList');
const commentCountEl = document.getElementById('commentCount');
const commentPagination = document.getElementById('commentPagination');

function renderCommentCards(comments) {
  if (comments.length === 0) {
    commentList.innerHTML = '<div class="empty-state">暂无评论数据</div>';
    return;
  }
  const html = comments.map(c => {
    const checked = commentSelected.has(c.comment_id) ? ' checked' : '';
    return `
      <div class="comment-card">
        <input type="checkbox" class="comment-checkbox" data-id="${esc(c.comment_id)}"${checked}>
        <img class="comment-avatar" src="${esc(c.image)}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="comment-body">
          <div class="comment-author">${esc(c.nickname || '匿名')}</div>
          <div class="comment-text">${esc(c.content)}</div>
          <div class="comment-meta">
            <span>${fmtTime(c.create_time * 1000)}</span>
            ${c.ip_location ? `<span>${esc(c.ip_location)}</span>` : ''}
          </div>
        </div>
        <div class="comment-likes">${c.like_count || '0'} 赞</div>
      </div>`;
  }).join('');
  commentList.innerHTML = html;

  commentList.querySelectorAll('.comment-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) commentSelected.add(id);
      else commentSelected.delete(id);
      updateCommentToolbar();
    });
  });
}

function updateCommentToolbar() {
  const pageComments = getPageComments();
  const allChecked = pageComments.length > 0 && pageComments.every(c => commentSelected.has(c.comment_id));
  commentSelectAll.checked = allChecked;
  commentDeleteSelected.disabled = commentSelected.size === 0;
  commentCountEl.textContent = allComments.length;
}

function getPageComments() {
  const start = (commentPage - 1) * PAGE_SIZE;
  return allComments.slice(start, start + PAGE_SIZE);
}

function renderCommentPage() {
  const totalPages = Math.ceil(allComments.length / PAGE_SIZE) || 1;
  if (commentPage > totalPages) commentPage = totalPages;

  const pageComments = getPageComments();
  renderCommentCards(pageComments);
  updateCommentToolbar();
  renderPagination('commentPagination', commentPage, totalPages, (p) => {
    commentPage = p;
    renderCommentPage();
  });
}

async function loadComments() {
  const { scrapedComments } = await chrome.storage.local.get('scrapedComments');
  allComments = (scrapedComments || []).slice().reverse();
  commentPage = 1;
  commentSelected.clear();
  renderCommentPage();
}

commentSelectAll.addEventListener('change', () => {
  const pageComments = getPageComments();
  if (commentSelectAll.checked) {
    pageComments.forEach(c => commentSelected.add(c.comment_id));
  } else {
    pageComments.forEach(c => commentSelected.delete(c.comment_id));
  }
  renderCommentPage();
});

commentDeleteSelected.addEventListener('click', async () => {
  if (commentSelected.size === 0) return;
  allComments = allComments.filter(c => !commentSelected.has(c.comment_id));
  commentSelected.clear();
  await chrome.storage.local.set({ scrapedComments: allComments.slice().reverse() });
  if (getPageComments().length === 0 && commentPage > 1) commentPage--;
  renderCommentPage();
  showToast('已删除选中评论');
});

commentDeleteAll.addEventListener('click', async () => {
  if (allComments.length === 0) return;
  if (!confirm(`确定要删除全部 ${allComments.length} 条评论吗？`)) return;
  allComments = [];
  commentSelected.clear();
  commentPage = 1;
  await chrome.storage.local.set({ scrapedComments: [] });
  renderCommentPage();
  showToast('已删除全部评论');
});

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadUsers();
  loadComments();
});
