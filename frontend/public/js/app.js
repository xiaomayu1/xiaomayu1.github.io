const API = '';

/* ===== UTILS ===== */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
}

async function api(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + url, { ...options, headers });
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '服务器错误' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ===== APP ===== */
class App {
  constructor() {
    this.poems = [];
    this.category = 'all';
    this.sort = 'newest';
    this.search = '';
    this.currentPoem = null;
    this.editingId = null;
    this.user = null;
    this.userProfile = null;
    this.commentReplies = {};
    this.limit = 12;
    this._confirmResolve = null;
    this.init();
  }

  async init() {
    this.cacheDOM();
    this.bindEvents();
    this.loadTheme();
    await this.checkAuth();
    await this.fetchAll();
    this.render();
    this.animateStats();
  }

  cacheDOM() {
    const $ = id => document.getElementById(id);
    this.d = {
      nav: $('nav'), grid: $('poemsGrid'), empty: $('emptyState'),
      loadMore: $('loadMore'), loadMoreBtn: $('loadMoreBtn'),
      search: $('searchInput'), sort: $('sortSelect'),
      tabs: document.querySelectorAll('.tab'),
      tagsCloud: $('tagsCloud'),
      heroWrite: $('heroWrite'), writeBtn: $('writeBtn'),
      // Auth
      authModal: $('authModal'), authClose: $('authClose'), authBackdrop: $('authBackdrop'),
      loginForm: $('loginForm'), registerForm: $('registerForm'),
      loginUsername: $('loginUsername'), loginPassword: $('loginPassword'),
      regDisplayName: $('regDisplayName'), regUsername: $('regUsername'), regPassword: $('regPassword'),
      loginSubmit: $('loginSubmit'), registerSubmit: $('registerSubmit'),
      showRegister: $('showRegister'), showLogin: $('showLogin'),
      authButtons: $('authButtons'), userMenu: $('userMenu'),
      userAvatar: $('userAvatar'), loginBtn: $('loginBtn'), registerBtn: $('registerBtn'),
      // Writer
      writerModal: $('writerModal'), writerClose: $('writerClose'),
      writerCancel: $('writerCancel'), writerSubmit: $('writerSubmit'),
      writerHeadline: $('writerHeadline'),
      fTitle: $('fTitle'), fCategory: $('fCategory'),
      fTags: $('fTags'), fContent: $('fContent'),
      // Reader
      readModal: $('readModal'), readClose: $('readClose'),
      readBody: $('readBody'), readFooter: $('readFooter'),
      likeBtn: $('likeBtn'), likeCount: $('likeCount'),
      editBtn: $('editBtn'), deleteBtn: $('deleteBtn'),
      // Comments
      commentsSection: $('commentsSection'), commentsCount: $('commentsCount'),
      commentInput: $('commentInput'), commentInputWrap: $('commentInputWrap'),
      commentSend: $('commentSend'), commentsList: $('commentsList'),
      // Profile
      profileModal: $('profileModal'), profileClose: $('profileClose'),
      profileBackdrop: $('profileBackdrop'), profileBody: $('profileBody'),
      // Confirm
      confirmModal: $('confirmModal'), confirmText: $('confirmText'),
      confirmOk: $('confirmOk'), confirmCancel: $('confirmCancel'), confirmBackdrop: $('confirmBackdrop'),
      // Toast
      toast: $('toast'), toastMsg: document.querySelector('.toast-msg'),
    };
  }

  bindEvents() {
    window.addEventListener('scroll', () => this.d.nav.classList.toggle('scrolled', scrollY > 10));
    this.d.themeBtn.addEventListener('click', () => this.toggleTheme());

    // Auth
    this.d.loginBtn.addEventListener('click', () => this.showLogin());
    this.d.registerBtn.addEventListener('click', () => this.showRegister());
    this.d.authClose.addEventListener('click', () => this.closeAuth());
    this.d.authBackdrop.addEventListener('click', () => this.closeAuth());
    this.d.showRegister.addEventListener('click', e => { e.preventDefault(); this.showRegister(); });
    this.d.showLogin.addEventListener('click', e => { e.preventDefault(); this.showLogin(); })
    this.d.loginSubmit.addEventListener('click', () => this.handleLogin());
    this.d.registerSubmit.addEventListener('click', () => this.handleRegister());
    [this.d.loginUsername, this.d.loginPassword, this.d.regPassword].forEach(el => {
      el.addEventListener('keydown', e => { if (e.key === 'Enter') el === this.d.regPassword ? this.handleRegister() : this.handleLogin(); });
    });

    // User avatar → own profile
    this.d.userAvatar.addEventListener('click', () => {
      if (this.user) this.openProfile(this.user.username);
    });

    // Write
    this.d.heroWrite.addEventListener('click', () => this.requireAuth(() => this.openWriter()));
    this.d.writeBtn.addEventListener('click', () => this.requireAuth(() => this.openWriter()));

    // Writer modal
    this.d.writerClose.addEventListener('click', () => this.closeWriter());
    this.d.writerCancel.addEventListener('click', () => this.closeWriter());
    this.d.writerModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeWriter());
    this.d.writerSubmit.addEventListener('click', () => this.handleSubmit());

    // Read modal
    this.d.readClose.addEventListener('click', () => this.closeReader());
    this.d.readModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeReader());

    // Comments
    this.d.commentSend.addEventListener('click', () => this.submitComment());
    this.d.commentInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.submitComment();
    });

    // Filters
    this.d.tabs.forEach(tab => tab.addEventListener('click', () => {
      this.d.tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      this.category = tab.dataset.cat;
      this.loadPoems();
    }));
    this.d.sort.addEventListener('change', e => { this.sort = e.target.value; this.loadPoems(); });
    let timer;
    this.d.search.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { this.search = e.target.value.trim(); this.loadPoems(); }, 300);
    });
    this.d.loadMoreBtn.addEventListener('click', () => { this.limit += 8; this.renderPoems(); });

    // Confirm
    this.d.confirmOk.addEventListener('click', () => {
      const resolve = this._confirmResolve;
      this.hideConfirm();
      if (resolve) resolve(true);
    });
    this.d.confirmCancel.addEventListener('click', () => this.hideConfirm());
    this.d.confirmBackdrop.addEventListener('click', () => this.hideConfirm());

    // Profile
    this.d.profileClose.addEventListener('click', () => this.closeProfile());
    this.d.profileBackdrop.addEventListener('click', () => this.closeProfile());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.closeReader(); this.closeWriter(); this.closeAuth(); this.hideConfirm(); this.closeProfile(); }
    });
  }

  /* ===== AUTH ===== */
  async checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      this.user = await api('/api/auth/me');
      this.setUserUI(true);
    } catch { localStorage.removeItem('token'); this.user = null; this.setUserUI(false); }
  }

  setUserUI(loggedIn) {
    this.d.authButtons.style.display = loggedIn ? 'none' : 'flex';
    this.d.userMenu.style.display = loggedIn ? 'flex' : 'none';
    if (loggedIn) {
      const initial = this.user.display_name ? this.user.display_name.charAt(0) : '?';
      this.d.userAvatar.textContent = initial;
      this.d.userAvatar.title = `${this.user.display_name}，点击查看主页`;
    }
  }

  showLogin() {
    this.d.loginForm.classList.remove('hidden');
    this.d.registerForm.classList.add('hidden');
    this.d.authModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.d.loginUsername.focus(), 100);
  }

  showRegister() {
    this.d.registerForm.classList.remove('hidden');
    this.d.loginForm.classList.add('hidden');
    this.d.authModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.d.regDisplayName.focus(), 100);
  }

  closeAuth() {
    this.d.authModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  async handleLogin() {
    const username = this.d.loginUsername.value.trim();
    const password = this.d.loginPassword.value;
    if (!username || !password) { this.showToast('请填写用户名和密码', true); return; }
    this.d.loginSubmit.disabled = true;
    this.d.loginSubmit.textContent = '登录中…';
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      localStorage.setItem('token', data.token);
      this.user = data.user;
      this.setUserUI(true);
      this.closeAuth();
      this.showToast(`欢迎回来，${data.user.display_name}！`);
      await this.loadPoems();
    } catch (e) {
      this.showToast(e.message === 'unauthorized' ? '用户名或密码错误' : e.message || '登录失败', true);
    } finally {
      this.d.loginSubmit.disabled = false;
      this.d.loginSubmit.textContent = '登录';
    }
  }

  async handleRegister() {
    const displayName = this.d.regDisplayName.value.trim();
    const username = this.d.regUsername.value.trim();
    const password = this.d.regPassword.value;
    if (!username || !password) { this.showToast('请填写用户名和密码', true); return; }
    if (username.length < 2) { this.showToast('用户名至少2个字符', true); return; }
    if (password.length < 3) { this.showToast('密码至少3个字符', true); return; }
    this.d.registerSubmit.disabled = true;
    this.d.registerSubmit.textContent = '注册中…';
    try {
      const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) });
      localStorage.setItem('token', data.token);
      this.user = data.user;
      this.setUserUI(true);
      this.closeAuth();
      this.showToast(`欢迎加入墨韵，${data.user.display_name}！`);
    } catch (e) {
      this.showToast(e.message === 'unauthorized' ? '该用户名已被注册' : e.message || '注册失败', true);
    } finally {
      this.d.registerSubmit.disabled = false;
      this.d.registerSubmit.textContent = '注册';
    }
  }

  requireAuth(fn) {
    if (!this.user) { this.showLogin(); this.showToast('请先登录再操作', true); return; }
    fn();
  }
}

function logout() {
  localStorage.removeItem('token');
  window.app.user = null;
  window.app.setUserUI(false);
  window.app.showToast('已退出登录');
}

/* ===== DATA ===== */
App.prototype.fetchAll = async function() {
  try {
    const [poemsRes, statsRes, tagsRes] = await Promise.all([
      api('/api/poems?limit=100'),
      api('/api/stats'),
      api('/api/tags'),
    ]);
    this.poems = poemsRes;
    this.stats = statsRes;
    this.allTags = tagsRes;
    this.updateStats();
    this.renderTags();
  } catch (e) {
    if (e.message !== 'unauthorized') this.showToast('加载失败，请检查网络', true);
  }
};

App.prototype.loadPoems = async function() {
  try {
    const params = new URLSearchParams({ sort: this.sort, limit: this.limit });
    if (this.category !== 'all') params.set('category', this.category);
    if (this.search) params.set('q', this.search);
    this.poems = await api(`/api/poems?${params}`);
    this.renderPoems();
  } catch (e) { console.error(e); }
};

/* ===== RENDER ===== */
App.prototype.render = function() { this.renderPoems(); this.renderStats(); };

App.prototype.updateStats = function() {
  if (!this.stats) return;
  document.querySelectorAll('[data-target="stats.total"]').forEach(el => this.animateNum(el, this.stats.total || 0));
  document.querySelectorAll('[data-target="stats.totalLikes"]').forEach(el => this.animateNum(el, this.stats.totalLikes || 0));
  document.querySelectorAll('[data-target="stats.totalViews"]').forEach(el => this.animateNum(el, this.stats.totalViews || 0));
};

App.prototype.animateNum = function(el, target) {
  const dur = 1200, t0 = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

App.prototype.renderTags = function() {
  const tags = this.allTags || {};
  this.d.tagsCloud.innerHTML = Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t, c]) => `<span class="tag-item">${esc(t)} (${c})</span>`)
    .join('');
};

App.prototype.renderPoems = function() {
  const list = this.poems;
  const cats = ['all'];
  [...new Set(list.map(p => p.category))].forEach(c => cats.push(c));
  const tabHTML = cats.map(c =>
    `<button class="tab ${c === this.category ? 'active' : ''}" data-cat="${c}">${c === 'all' ? '全部' : c}</button>`
  ).join('');
  document.getElementById('filterTabs').innerHTML = tabHTML;
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    this.category = tab.dataset.cat;
    this.loadPoems();
  }));

  if (list.length === 0) {
    this.d.grid.innerHTML = '';
    this.d.empty.style.display = '';
    this.d.loadMore.style.display = 'none';
    return;
  }

  this.d.empty.style.display = 'none';
  this.d.grid.innerHTML = list.map((p, i) => this.poemCardHTML(p, i)).join('');
  this.d.grid.querySelectorAll('.poem-card').forEach(card => {
    card.addEventListener('click', () => this.openReader(+card.dataset.id));
  });
  this.d.loadMore.style.display = list.length >= this.limit ? '' : 'none';
};

App.prototype.poemCardHTML = function(p, i) {
  const excerpt = p.content.replace(/\n/g, ' ').substring(0, 100) + (p.content.length > 100 ? '…' : '');
  const authorInit = p.author ? p.author.charAt(0) : '?';
  const isOwner = this.user && p.user_id === this.user.id;
  return `
    <article class="poem-card" data-id="${p.id}" style="animation-delay:${i*0.05}s">
      <div class="poem-card-head">
        <h3 class="poem-card-title">${esc(p.title)}</h3>
        <span class="poem-type">${esc(p.category || '随笔')}</span>
      </div>
      <p class="poem-card-excerpt">${esc(excerpt)}</p>
      <div class="poem-card-foot">
        <div class="poem-meta">
          <div class="poem-author">${esc(authorInit)}</div>
          <span>${esc(p.author || '佚名')}</span>
          <span>·</span><span>${timeAgo(new Date(p.created_at).getTime())}</span>
          ${isOwner ? '<span class="owner-badge">我的</span>' : ''}
        </div>
        <div class="poem-stats">
          <span>♥ ${p.likes || 0}</span>
          <span>👁 ${p.views || 0}</span>
        </div>
      </div>
    </article>`;
};

/* ===== WRITER ===== */
App.prototype.openWriter = function(poem = null) {
  this.editingId = poem?.id || null;
  this.d.writerHeadline.textContent = poem ? '编辑诗歌' : '新诗';
  this.d.writerSubmit.textContent = poem ? '保存' : '发表';
  if (poem) {
    this.d.fTitle.value = poem.title;
    this.d.fCategory.value = poem.category || '随笔';
    this.d.fTags.value = Array.isArray(poem.tags) ? poem.tags.join(', ') : '';
    this.d.fContent.value = poem.content;
  } else {
    this.d.fTitle.value = '';
    this.d.fCategory.value = '随笔';
    this.d.fTags.value = '';
    this.d.fContent.value = '';
  }
  this.d.writerModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => this.d.fTitle.focus(), 100);
};

App.prototype.closeWriter = function() {
  this.d.writerModal.classList.remove('active');
  document.body.style.overflow = '';
};

App.prototype.handleSubmit = async function() {
  const title = this.d.fTitle.value.trim();
  const content = this.d.fContent.value.trim();
  if (!title || !content) { this.showToast('请填写标题和正文', true); return; }
  if (!this.user) { this.closeWriter(); this.showLogin(); return; }
  const data = {
    title, content,
    category: this.d.fCategory.value,
    tags: this.d.fTags.value.split(',').map(t => t.trim()).filter(Boolean),
  };
  try {
    if (this.editingId) {
      await api(`/api/poems/${this.editingId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/api/poems', { method: 'POST', body: JSON.stringify(data) });
    }
    this.showToast(this.editingId ? '已更新' : '发表成功 ✓');
    this.closeWriter();
    await this.loadPoems();
    await this.fetchAll();
  } catch (e) {
    this.showToast(e.message === 'unauthorized' ? '请先登录' : e.message || '操作失败', true);
  }
};

/* ===== READER ===== */
App.prototype.openReader = async function(id) {
  let p = this.poems.find(x => x.id === id);
  if (!p) {
    try { p = await api(`/api/poems/${id}`); } catch { return; }
  }

  api(`/api/poems/${id}/view`, { method: 'POST' }).catch(() => {});
  this.currentPoem = p;
  this.commentReplies[id] = {};

  const isOwner = this.user && p.user_id === this.user.id;
  const typeLabel = p.category || '随笔';
  const date = formatDate(new Date(p.created_at).getTime());
  const authorInit = p.author ? p.author.charAt(0) : '?';

  this.d.readBody.innerHTML = `
    <span class="read-tag">${esc(typeLabel)}</span>
    <h1 class="read-title">${esc(p.title)}</h1>
    <div class="read-meta">
      <div class="poem-author" style="cursor:pointer" onclick="window.app.goToProfile('${esc(p.username || p.author)}')">${esc(authorInit)}</div>
      <span>${esc(p.author || '佚名')}</span>
      <span>·</span><span>${date}</span>
      <span>·</span><span>♥ ${p.likes||0}</span>
      <span>·</span><span>👁 ${p.views||0}</span>
    </div>
    <div class="read-content">${esc(p.content)}</div>
    ${(p.tags&&p.tags.length) ? `<div class="read-tags">${Array.isArray(p.tags) ? p.tags.map(t=>`<span class="tag-item">${esc(t)}</span>`).join('') : ''}</div>` : ''}
  `;

  this.d.likeCount.textContent = p.likes || 0;
  this.d.readFooter.innerHTML = `
    <button class="btn-like" id="likeBtn"><span class="like-heart">♥</span><span id="likeCount">${p.likes||0}</span></button>
    ${isOwner ? `
      <button class="btn-action" id="editBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        编辑
      </button>
      <button class="btn-delete" id="deleteBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        删除
      </button>
    ` : ''}
  `;

  this.d.likeBtn = this.d.readFooter.querySelector('#likeBtn');
  this.d.editBtn = this.d.readFooter.querySelector('#editBtn');
  this.d.deleteBtn = this.d.readFooter.querySelector('#deleteBtn');
  this.d.likeBtn.addEventListener('click', () => this.handleLike());
  if (this.d.editBtn) this.d.editBtn.addEventListener('click', () => { this.closeReader(); this.openWriter(this.currentPoem); });
  if (this.d.deleteBtn) this.d.deleteBtn.addEventListener('click', () => this.handleDelete());

  // Load comments
  this.d.commentsList.innerHTML = '<div class="comment-loading">加载中…</div>';
  this.loadComments(p.id);

  this.d.readModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

App.prototype.closeReader = function() {
  this.d.readModal.classList.remove('active');
  document.body.style.overflow = '';
};

App.prototype.goToProfile = async function(username) {
  this.closeReader();
  this.openProfile(username);
};

App.prototype.openProfile = async function(username) {
  try {
    const data = await api(`/api/users/${username}`);
    this.userProfile = data;
    const isSelf = this.user && data.username === this.user.username;

    this.d.profileBody.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${data.display_name ? data.display_name.charAt(0) : '?'}</div>
        <div class="profile-info">
          <h2 class="profile-name">${esc(data.display_name)}</h2>
          <p class="profile-username">@${esc(data.username)}</p>
          ${data.bio ? `<p class="profile-bio">${esc(data.bio)}</p>` : ''}
          <p class="profile-joined">加入于 ${formatDate(new Date(data.created_at).getTime())}</p>
        </div>
        ${isSelf ? `<button class="btn-profile-edit" id="profileEditBtn">编辑资料</button>` : ''}
      </div>
      <div class="profile-stats">
        <div class="ps-item"><span class="ps-num">${data.poem_count || 0}</span><span class="ps-lbl">首诗</span></div>
        <div class="ps-divider"></div>
        <div class="ps-item"><span class="ps-num">${data.collection_count || 0}</span><span class="ps-lbl">个集</span></div>
      </div>
      <h3 class="profile-section-title">作品</h3>
      <div class="profile-poems" id="profilePoems">
        ${(data.poems || []).map(p => `
          <div class="profile-poem-card" data-id="${p.id}">
            <div class="pp-title">${esc(p.title)}</div>
            <div class="pp-excerpt">${esc(p.content.replace(/\n/g,' ').substring(0,60))}…</div>
            <div class="pp-meta"><span>♥ ${p.likes||0}</span><span>👁 ${p.views||0}</span><span>${timeAgo(new Date(p.created_at).getTime())}</span></div>
          </div>
        `).join('')}
      </div>
    `;

    this.d.profileBody.querySelectorAll('.profile-poem-card').forEach(card => {
      card.addEventListener('click', () => { this.closeProfile(); this.openReader(+card.dataset.id); });
    });

    if (isSelf && this.d.profileEditBtn) {
      this.d.profileEditBtn.addEventListener('click', () => this.editProfile());
    }

    this.d.profileModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  } catch (e) {
    this.showToast(e.message || '加载失败', true);
  }
};

App.prototype.closeProfile = function() {
  this.d.profileModal.classList.remove('active');
  document.body.style.overflow = '';
};

App.prototype.editProfile = async function() {
  const bio = prompt('编辑个人简介（最多200字）：', this.userProfile?.bio || '');
  if (bio === null) return;
  try {
    await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ bio: bio.slice(0, 200) }) });
    this.user.bio = bio;
    this.showToast('资料已更新');
    await this.openProfile(this.user.username);
  } catch (e) {
    this.showToast(e.message || '更新失败', true);
  }
};

/* ===== COMMENTS ===== */
App.prototype.loadComments = async function(poemId) {
  try {
    const comments = await api(`/api/poems/${poemId}/comments`);
    this.currentComments = comments || [];
    this.d.commentsCount.textContent = `${this.currentComments.length} 条评论`;
    this.renderComments();
  } catch { this.d.commentsList.innerHTML = ''; }
};

App.prototype.renderComments = function() {
  if (!this.currentComments || this.currentComments.length === 0) {
    this.d.commentsList.innerHTML = '<p class="no-comments">暂无评论，来发表第一条评论吧</p>';
    return;
  }
  this.d.commentsList.innerHTML = this.currentComments.map(c => this.commentHTML(c)).join('');
  this.d.commentsList.querySelectorAll('.reply-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      this.toggleReplies(c.id);
    });
  });
  this.d.commentsList.querySelectorAll('.reply-submit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const input = btn.closest('.reply-form').querySelector('.reply-input');
      this.submitReply(c.id, input.value.trim(), input);
    });
  });
};

App.prototype.commentHTML = function(c) {
  const initial = c.display_name ? c.display_name.charAt(0) : '?';
  const replyCount = this.commentReplies[c.id]?.length || 0;
  const repliesHTML = (this.commentReplies[c.id] || []).map(r => this.replyHTML(r)).join('');
  return `
    <div class="comment-item" data-id="${c.id}">
      <div class="comment-top">
        <div class="comment-author" onclick="window.app.goToProfile('${esc(c.username)}')" style="cursor:pointer">
          <div class="comment-avatar">${esc(initial)}</div>
          <span class="comment-name">${esc(c.display_name)}</span>
        </div>
        <span class="comment-time">${timeAgo(new Date(c.created_at).getTime())}</span>
      </div>
      <p class="comment-content">${esc(c.content)}</p>
      <div class="comment-actions">
        <button class="comment-action reply-toggle" data-parent="${c.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/></svg>
          回复${replyCount > 0 ? `(${replyCount})` : ''}
        </button>
        ${this.user && c.user_id === this.user.id ? `<button class="comment-action comment-delete" data-id="${c.id}">删除</button>` : ''}
      </div>
      <div class="comment-replies" id="replies-${c.id}" style="display:none">${repliesHTML}</div>
    </div>`;
};

App.prototype.replyHTML = function(r) {
  const initial = r.display_name ? r.display_name.charAt(0) : '?';
  return `
    <div class="reply-item">
      <div class="reply-top">
        <span class="reply-author" onclick="window.app.goToProfile('${esc(r.username)}')" style="cursor:pointer">${esc(r.display_name)}</span>
        <span class="reply-time">${timeAgo(new Date(r.created_at).getTime())}</span>
      </div>
      <p class="reply-content">${esc(r.content)}</p>
      ${this.user && r.user_id === this.user.id ? `<button class="reply-delete" data-id="${r.id}">删除</button>` : ''}
    </div>`;
};

App.prototype.toggleReplies = async function(parentId) {
  const el = document.getElementById(`replies-${parentId}`);
  if (!el) return;
  if (el.style.display === 'none') {
    if (!this.commentReplies[parentId]) {
      try { this.commentReplies[parentId] = await api(`/api/comments/${parentId}/replies`); } catch { this.commentReplies[parentId] = []; }
    }
    el.innerHTML = this.commentReplies[parentId].map(r => this.replyHTML(r)).join('') + this.replyInputHTML(parentId);
    el.style.display = '';
    el.querySelectorAll('.reply-delete').forEach(btn => {
      btn.addEventListener('click', () => this.deleteReply(parentId, +btn.dataset.id));
    });
  } else {
    el.style.display = 'none';
  }
};

App.prototype.replyInputHTML = function(parentId) {
  return `
    <div class="reply-form">
      <input class="reply-input" placeholder="回复…" maxlength="200">
      <button class="reply-submit" data-parent="${parentId}">发送</button>
    </div>`;
};

App.prototype.submitComment = async function() {
  const content = this.d.commentInput.value.trim();
  if (!content) return;
  if (!this.user) { this.closeReader(); this.showLogin(); return; }
  if (!this.currentPoem) return;
  this.d.commentInput.disabled = true;
  this.d.commentSend.disabled = true;
  try {
    await api(`/api/poems/${this.currentPoem.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    this.d.commentInput.value = '';
    await this.loadComments(this.currentPoem.id);
    this.showToast('评论成功');
  } catch (e) {
    this.showToast(e.message || '评论失败', true);
  } finally {
    this.d.commentInput.disabled = false;
    this.d.commentSend.disabled = false;
    this.d.commentInput.focus();
  }
};

App.prototype.submitReply = async function(parentId, content, inputEl) {
  if (!content) return;
  if (!this.user) { this.closeReader(); this.showLogin(); return; }
  try {
    await api(`/api/poems/${this.currentPoem.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parent_id: parentId })
    });
    delete this.commentReplies[parentId];
    await this.toggleReplies(parentId);
    // Re-open replies to show new one
    setTimeout(() => {
      const el = document.getElementById(`replies-${parentId}`);
      if (el) el.click && el.style.display !== 'none' && this.toggleReplies(parentId);
    }, 50);
    this.showToast('回复成功');
  } catch (e) {
    this.showToast(e.message || '回复失败', true);
  }
};

App.prototype.deleteComment = async function(commentId) {
  const ok = await this.showConfirm('确定要删除这条评论吗？');
  if (!ok) return;
  try {
    await api(`/api/comments/${commentId}`, { method: 'DELETE' });
    await this.loadComments(this.currentPoem.id);
    this.showToast('已删除');
  } catch (e) { this.showToast(e.message || '删除失败', true); }
};

App.prototype.deleteReply = async function(parentId, replyId) {
  try {
    await api(`/api/comments/${replyId}`, { method: 'DELETE' });
    if (this.commentReplies[parentId]) {
      this.commentReplies[parentId] = this.commentReplies[parentId].filter(r => r.id !== replyId);
      this.renderComments();
    }
  } catch (e) { this.showToast(e.message || '删除失败', true); }
};

/* ===== ACTIONS ===== */
App.prototype.handleLike = async function() {
  if (!this.user) { this.closeReader(); this.showLogin(); this.showToast('请先登录再点赞', true); return; }
  if (!this.currentPoem) return;
  try {
    const d = await api(`/api/poems/${this.currentPoem.id}/like`, { method: 'POST' });
    this.currentPoem.likes = d.likes;
    this.d.likeCount.textContent = d.likes;
    this.showToast('已点赞 ♥');
  } catch (e) { if (e.message !== 'unauthorized') this.showToast(e.message || '操作失败', true); }
};

App.prototype.handleDelete = async function() {
  if (!this.currentPoem) return;
  const ok = await this.showConfirm('确定要删除这首诗吗？\n此操作不可撤销。');
  if (!ok) return;
  try {
    await api(`/api/poems/${this.currentPoem.id}`, { method: 'DELETE' });
    this.showToast('已删除');
    this.closeReader();
    await this.loadPoems();
    await this.fetchAll();
  } catch (e) { this.showToast(e.message === 'unauthorized' ? '请先登录' : e.message || '删除失败', true); }
};

/* ===== THEME ===== */
App.prototype.toggleTheme = function() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};

App.prototype.loadTheme = function() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
};

/* ===== TOAST ===== */
App.prototype.showToast = function(msg, err = false) {
  this.d.toastMsg.textContent = msg;
  this.d.toast.classList.toggle('error', err);
  this.d.toast.classList.add('show');
  setTimeout(() => this.d.toast.classList.remove('show'), 2500);
};

/* ===== CONFIRM ===== */
App.prototype.showConfirm = function(msg) {
  return new Promise(resolve => {
    this._confirmResolve = resolve;
    this.d.confirmText.textContent = msg;
    this.d.confirmModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });
};

App.prototype.hideConfirm = function() {
  this.d.confirmModal.classList.remove('active');
  document.body.style.overflow = '';
  if (this._confirmResolve) { this._confirmResolve(false); this._confirmResolve = null; }
};

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
