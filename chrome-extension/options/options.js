const DEFAULTS = {
  keywords: '穿搭, 旅行, 美食',
  postsPerKeyword: 3,
  minDelay: 3,
  maxDelay: 8,
  scrollDelay: 800,
  maxFollowsPerDay: 5,
  minFansToFollow: 300,
  commentTexts: '写得真好, 学到了, 太棒了',
  maxCommentsPerDay: 3,
  maxLikePerDay: 40,
  repeatInterval: '',
  deepseekApiKey: '',
  deepseekSystemPrompt: '你是一个社交媒体运营人员，你的目的是针对一个帖子进行评论',
  backendUrl: '',
  deepseekUserPrompt: '请根据以下帖子内容生成一条评论：\n标题：{title}\n内容：{content}\n\n要求：\n1. 评论要容易引起人的共鸣\n2. 评论内容要能激发人的情绪，比如通过赞扬，批评，不屑等内容\n3. 如果实在做不到以上两点，根据帖子内容进行提问（引流的味道不要太强烈）, 比如哪里可以买？ 楼主在哪？ 等\n4. 尽量按照真人的口吻回答，不要 AI 味道\n5. 要避免使用复杂标点符号\n6.可以增加简单emoji\n\n请以JSON格式回复，只返回JSON，不要包含其他内容：{"comment": "你的评论内容"}'
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
    if (tab === 'posts') loadNotes();
    if (tab === 'ai-comments') loadAiComments();
  });
});

// ── Settings form ──
const keywordsEl = document.getElementById('keywords');
const postsPerKeywordEl = document.getElementById('postsPerKeyword');
const minDelayEl = document.getElementById('minDelay');
const maxDelayEl = document.getElementById('maxDelay');
const scrollDelayEl = document.getElementById('scrollDelay');
const maxFollowsPerDayEl = document.getElementById('maxFollowsPerDay');
const minFansToFollowEl = document.getElementById('minFansToFollow');
const commentTextsEl = document.getElementById('commentTexts');
const maxCommentsPerDayEl = document.getElementById('maxCommentsPerDay');
const maxLikePerDayEl = document.getElementById('maxLikePerDay');
const repeatIntervalEl = document.getElementById('repeatInterval');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const toast = document.getElementById('toast');

const backendUrlEl = document.getElementById('backendUrl');
const deepseekApiKeyEl = document.getElementById('deepseekApiKey');
const deepseekSystemPromptEl = document.getElementById('deepseekSystemPrompt');
const deepseekUserPromptEl = document.getElementById('deepseekUserPrompt');
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
  minFansToFollowEl.value = data.minFansToFollow ?? DEFAULTS.minFansToFollow;
  commentTextsEl.value = data.commentTexts ?? DEFAULTS.commentTexts;
  maxCommentsPerDayEl.value = data.maxCommentsPerDay ?? DEFAULTS.maxCommentsPerDay;
  maxLikePerDayEl.value = data.maxLikePerDay ?? DEFAULTS.maxLikePerDay;
  repeatIntervalEl.value = data.repeatInterval ?? DEFAULTS.repeatInterval;
  backendUrlEl.value = data.backendUrl ?? DEFAULTS.backendUrl;
  deepseekApiKeyEl.value = data.deepseekApiKey ?? DEFAULTS.deepseekApiKey;
  deepseekSystemPromptEl.value = data.deepseekSystemPrompt ?? DEFAULTS.deepseekSystemPrompt;
  deepseekUserPromptEl.value = data.deepseekUserPrompt ?? DEFAULTS.deepseekUserPrompt;
}

async function saveSettings() {
  const values = {
    keywords: keywordsEl.value.trim(),
    postsPerKeyword: parseInt(postsPerKeywordEl.value) || DEFAULTS.postsPerKeyword,
    minDelay: Math.max(1, parseInt(minDelayEl.value) || DEFAULTS.minDelay),
    maxDelay: Math.max(2, parseInt(maxDelayEl.value) || DEFAULTS.maxDelay),
    scrollDelay: Math.max(100, parseInt(scrollDelayEl.value) || DEFAULTS.scrollDelay),
    maxFollowsPerDay: Math.max(0, parseInt(maxFollowsPerDayEl.value) ?? DEFAULTS.maxFollowsPerDay),
    minFansToFollow: Math.max(0, parseInt(minFansToFollowEl.value) || DEFAULTS.minFansToFollow),
    commentTexts: commentTextsEl.value.trim(),
    maxCommentsPerDay: Math.max(0, parseInt(maxCommentsPerDayEl.value) ?? DEFAULTS.maxCommentsPerDay),
    maxLikePerDay: Math.max(0, parseInt(maxLikePerDayEl.value) ?? DEFAULTS.maxLikePerDay),
    repeatInterval: repeatIntervalEl.value,
    backendUrl: backendUrlEl.value.trim().replace(/\/+$/, ''),
    deepseekApiKey: deepseekApiKeyEl.value.trim(),
    deepseekSystemPrompt: deepseekSystemPromptEl.value.trim(),
    deepseekUserPrompt: deepseekUserPromptEl.value.trim()
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
  minFansToFollowEl.value = DEFAULTS.minFansToFollow;
  commentTextsEl.value = DEFAULTS.commentTexts;
  maxCommentsPerDayEl.value = DEFAULTS.maxCommentsPerDay;
  maxLikePerDayEl.value = DEFAULTS.maxLikePerDay;
  repeatIntervalEl.value = DEFAULTS.repeatInterval;
  backendUrlEl.value = DEFAULTS.backendUrl;
  deepseekApiKeyEl.value = DEFAULTS.deepseekApiKey;
  deepseekSystemPromptEl.value = DEFAULTS.deepseekSystemPrompt;
  deepseekUserPromptEl.value = DEFAULTS.deepseekUserPrompt;
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
          <div class="user-nickname">${u.user_id ? `<a href="https://www.xiaohongshu.com/user/profile/${esc(u.user_id)}" target="_blank" class="user-profile-link">${esc(u.nickname)}</a>` : esc(u.nickname)}</div>
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

// ═══════════════════════════════════════════
// Note list (scraped notes)
// ═══════════════════════════════════════════
let notePage = 1;
let noteSelected = new Set();
let allNotes = [];

const noteSelectAll = document.getElementById('noteSelectAll');
const noteDeleteSelected = document.getElementById('noteDeleteSelected');
const noteDeleteAll = document.getElementById('noteDeleteAll');
const noteList = document.getElementById('noteList');
const noteCountEl = document.getElementById('noteCount');
const notePagination = document.getElementById('notePagination');

function renderNoteCards(notes) {
  if (notes.length === 0) {
    noteList.innerHTML = '<div class="empty-state">暂无笔记数据</div>';
    return;
  }
  const html = notes.map(n => {
    const key = n.note_id || n.url;
    const checked = noteSelected.has(key) ? ' checked' : '';
    const tags = (n.tags || []).slice(0, 5).map(t => `<span class="note-card-tag">${esc(t)}</span>`).join('');
    const contentPreview = (n.content || '').slice(0, 150);
    return `
      <div class="note-card">
        <div class="note-card-header">
          <input type="checkbox" class="note-checkbox" data-id="${esc(key)}"${checked}>
          <div class="note-card-title">${esc(n.title || '无标题')}</div>
        </div>
        ${contentPreview ? `<div class="note-card-body">${esc(contentPreview)}${n.content.length > 150 ? '...' : ''}</div>` : ''}
        ${tags ? `<div class="note-card-tags">${tags}</div>` : ''}
        <div class="note-card-meta">
          ${n.date ? `<span>${esc(n.date)}</span>` : ''}
          ${n.url ? `<a class="note-card-url" href="${esc(n.url)}" target="_blank" title="${esc(n.url)}">${esc(n.url.replace('https://www.xiaohongshu.com',''))}</a>` : ''}
        </div>
      </div>`;
  }).join('');
  noteList.innerHTML = html;

  noteList.querySelectorAll('.note-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) noteSelected.add(id);
      else noteSelected.delete(id);
      updateNoteToolbar();
    });
  });
}

function updateNoteToolbar() {
  const pageNotes = getPageNotes();
  const allChecked = pageNotes.length > 0 && pageNotes.every(n => noteSelected.has(n.note_id || n.url));
  noteSelectAll.checked = allChecked;
  noteDeleteSelected.disabled = noteSelected.size === 0;
  noteCountEl.textContent = allNotes.length;
}

function getPageNotes() {
  const start = (notePage - 1) * PAGE_SIZE;
  return allNotes.slice(start, start + PAGE_SIZE);
}

function renderNotePage() {
  const totalPages = Math.ceil(allNotes.length / PAGE_SIZE) || 1;
  if (notePage > totalPages) notePage = totalPages;

  const pageNotes = getPageNotes();
  renderNoteCards(pageNotes);
  updateNoteToolbar();
  renderPagination('notePagination', notePage, totalPages, (p) => {
    notePage = p;
    renderNotePage();
  });
}

async function loadNotes() {
  const { scrapedNotes } = await chrome.storage.local.get('scrapedNotes');
  allNotes = (scrapedNotes || []).slice().reverse();
  notePage = 1;
  noteSelected.clear();
  renderNotePage();
}

noteSelectAll.addEventListener('change', () => {
  const pageNotes = getPageNotes();
  if (noteSelectAll.checked) {
    pageNotes.forEach(n => noteSelected.add(n.note_id || n.url));
  } else {
    pageNotes.forEach(n => noteSelected.delete(n.note_id || n.url));
  }
  renderNotePage();
});

noteDeleteSelected.addEventListener('click', async () => {
  if (noteSelected.size === 0) return;
  allNotes = allNotes.filter(n => !noteSelected.has(n.note_id || n.url));
  noteSelected.clear();
  await chrome.storage.local.set({ scrapedNotes: allNotes.slice().reverse() });
  if (getPageNotes().length === 0 && notePage > 1) notePage--;
  renderNotePage();
  showToast('已删除选中笔记');
});

noteDeleteAll.addEventListener('click', async () => {
  if (allNotes.length === 0) return;
  if (!confirm(`确定要删除全部 ${allNotes.length} 条笔记吗？`)) return;
  allNotes = [];
  noteSelected.clear();
  notePage = 1;
  await chrome.storage.local.set({ scrapedNotes: [] });
  renderNotePage();
  showToast('已删除全部笔记');
});

// ═══════════════════════════════════════════
// AI Comment list
// ═══════════════════════════════════════════
let aiCommentPage = 1;
let aiCommentSelected = new Set();
let allAiComments = [];

const aiCommentSelectAll = document.getElementById('aiCommentSelectAll');
const aiCommentDeleteSelected = document.getElementById('aiCommentDeleteSelected');
const aiCommentDeleteAll = document.getElementById('aiCommentDeleteAll');
const aiCommentList = document.getElementById('aiCommentList');
const aiCommentCountEl = document.getElementById('aiCommentCount');
const aiCommentPagination = document.getElementById('aiCommentPagination');

function renderAiCommentCards(comments) {
  if (comments.length === 0) {
    aiCommentList.innerHTML = '<div class="empty-state">暂无 AI 评论数据</div>';
    return;
  }
  const html = comments.map((c, idx) => {
    const key = c.id || String(idx);
    const checked = aiCommentSelected.has(key) ? ' checked' : '';
    const noteTitle = esc(c.noteTitle || '无标题');
    const commentText = esc(c.comment || '');
    const noteUrl = esc(c.noteUrl || '');
    return `
      <div class="ai-comment-card">
        <div class="ai-comment-card-header">
          <input type="checkbox" class="ai-comment-checkbox" data-id="${key}"${checked}>
          <div class="ai-comment-note-title">${noteTitle}</div>
        </div>
        <div class="ai-comment-text">${commentText}</div>
        <div class="ai-comment-meta">
          <span>${fmtTime(c.timestamp || 0)}</span>
          ${noteUrl ? `<a class="ai-comment-url" href="${noteUrl}" target="_blank" title="${noteUrl}">${esc(noteUrl.replace('https://www.xiaohongshu.com',''))}</a>` : ''}
        </div>
      </div>`;
  }).join('');
  aiCommentList.innerHTML = html;

  aiCommentList.querySelectorAll('.ai-comment-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) aiCommentSelected.add(id);
      else aiCommentSelected.delete(id);
      updateAiCommentToolbar();
    });
  });
}

function updateAiCommentToolbar() {
  const pageComments = getPageAiComments();
  const allChecked = pageComments.length > 0 && pageComments.every(c => aiCommentSelected.has(c.id || ''));
  aiCommentSelectAll.checked = allChecked;
  aiCommentDeleteSelected.disabled = aiCommentSelected.size === 0;
  aiCommentCountEl.textContent = allAiComments.length;
}

function getPageAiComments() {
  const start = (aiCommentPage - 1) * PAGE_SIZE;
  return allAiComments.slice(start, start + PAGE_SIZE);
}

function renderAiCommentPage() {
  const totalPages = Math.ceil(allAiComments.length / PAGE_SIZE) || 1;
  if (aiCommentPage > totalPages) aiCommentPage = totalPages;

  const pageComments = getPageAiComments();
  renderAiCommentCards(pageComments);
  updateAiCommentToolbar();
  renderPagination('aiCommentPagination', aiCommentPage, totalPages, (p) => {
    aiCommentPage = p;
    renderAiCommentPage();
  });
}

async function loadAiComments() {
  const { aiGeneratedComments } = await chrome.storage.local.get('aiGeneratedComments');
  allAiComments = (aiGeneratedComments || []).slice().reverse();
  aiCommentPage = 1;
  aiCommentSelected.clear();
  renderAiCommentPage();
}

aiCommentSelectAll.addEventListener('change', () => {
  const pageComments = getPageAiComments();
  if (aiCommentSelectAll.checked) {
    pageComments.forEach(c => aiCommentSelected.add(c.id || ''));
  } else {
    pageComments.forEach(c => aiCommentSelected.delete(c.id || ''));
  }
  renderAiCommentPage();
});

aiCommentDeleteSelected.addEventListener('click', async () => {
  if (aiCommentSelected.size === 0) return;
  allAiComments = allAiComments.filter(c => !aiCommentSelected.has(c.id || ''));
  aiCommentSelected.clear();
  await chrome.storage.local.set({ aiGeneratedComments: allAiComments.slice().reverse() });
  if (getPageAiComments().length === 0 && aiCommentPage > 1) aiCommentPage--;
  renderAiCommentPage();
  showToast('已删除选中AI评论');
});

aiCommentDeleteAll.addEventListener('click', async () => {
  if (allAiComments.length === 0) return;
  if (!confirm(`确定要删除全部 ${allAiComments.length} 条AI评论吗？`)) return;
  allAiComments = [];
  aiCommentSelected.clear();
  aiCommentPage = 1;
  await chrome.storage.local.set({ aiGeneratedComments: [] });
  renderAiCommentPage();
  showToast('已删除全部AI评论');
});

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadUsers();
  loadComments();
  loadNotes();
  loadAiComments();
});
