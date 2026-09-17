const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'moyun-secret-key-change-in-production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Ensure data directory exists (for fresh deployments)
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POEMS_FILE = path.join(DATA_DIR, 'poems.json');

function loadJSON(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch { return fallback; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Seed sample poems on first run
function seedPoems() {
  const poems = loadJSON(POEMS_FILE, []);
  if (poems.length > 0) return;
  const samples = [
    {
      id: 1, title: '静夜思', content: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
      author: '李白', userId: 'system', category: '古风', tags: ['思乡', '月亮', '经典'],
      likes: 1289, views: 5621, createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now()
    },
    {
      id: 2, title: '春晓', content: '春眠不觉晓，\n处处闻啼鸟。\n夜来风雨声，\n花落知多少。',
      author: '孟浩然', userId: 'system', category: '古风', tags: ['春天', '自然'],
      likes: 987, views: 4230, createdAt: Date.now() - 86400000 * 25, updatedAt: Date.now()
    },
    {
      id: 3, title: '水调歌头·明月几时有', content: '明月几时有？把酒问青天。\n不知天上宫阙，今夕是何年。\n我欲乘风归去，又恐琼楼玉宇，高处不胜寒。\n起舞弄清影，何似在人间。\n\n转朱阁，低绮户，照无眠。\n不应有恨，何事长向别时圆？\n人有悲欢离合，月有阴晴圆缺，此事古难全。\n但愿人长久，千里共婵娟。',
      author: '苏轼', userId: 'system', category: '古风', tags: ['月亮', '思念', '经典'],
      likes: 2156, views: 8934, createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now()
    },
    {
      id: 4, title: '雨后', content: '雨后的天空格外蓝\n像洗过的绸缎\n阳光透过云层\n洒下金色的碎片',
      author: '墨韵', userId: 'system', category: '现代诗', tags: ['雨后', '天空'],
      likes: 342, views: 1205, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now()
    },
    {
      id: 5, title: '致橡树', content: '我如果爱你——\n绝不像攀援的凌霄花\n借你的高枝炫耀自己\n\n我如果爱你——\n绝学啁啾的小鸟\n为绿荫重复单调的歌曲\n\n也都不止象泉源\n歇凉\n甚至日险\n宗\n你存在的根本\n你的皮\n在土里\n',
      author: '舒婷', userId: 'system', category: '现代诗', tags: ['爱情', '经典'],
      likes: 1567, views: 6789, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now()
    },
    {
      id: 6, title: '匆匆', content: '燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。\n但是，聪明的，你告诉我，我们的日子为什么一去不复返呢？',
      author: '朱自清', userId: 'system', category: '散文诗', tags: ['时间', '感悟'],
      likes: 876, views: 3456, createdAt: Date.now() - 86400000 * 1, updatedAt: Date.now()
    },
  ];
  saveJSON(POEMS_FILE, samples);
}
seedPoems();

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: '登录已过期' }); }
}

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password || password.length < 3) return res.status(400).json({ error: '用户名和密码不能为空（密码至少3位）' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20个字符' });

  const users = loadJSON(USERS_FILE, []);
  if (users.find(u => u.username === username)) return res.status(409).json({ error: '用户名已存在' });

  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username: username.trim(),
    displayName: (displayName || username.trim()).trim(),
    password: await bcrypt.hash(password, 10),
    createdAt: Date.now(),
  };
  users.push(user);
  saveJSON(USERS_FILE, users);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName } });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });

  const users = loadJSON(USERS_FILE, []);
  const user = users.find(u => u.username === username.trim());
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: '用户名或密码错误' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName } });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const users = loadJSON(USERS_FILE, []);
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ id: user.id, username: user.username, displayName: user.displayName });
});

app.post('/api/auth/logout', (req, res) => { res.json({ ok: true }); });

// --- Poems ---
app.get('/api/poems', (req, res) => {
  let poems = loadJSON(POEMS_FILE, []);
  const { category, tag, sort = 'newest', q, limit = 50 } = req.query;
  if (category) poems = poems.filter(p => p.category === category);
  if (tag) poems = poems.filter(p => (p.tags || []).includes(tag));
  if (q) {
    const k = q.toLowerCase();
    poems = poems.filter(p =>
      p.title.toLowerCase().includes(k) ||
      p.content.toLowerCase().includes(k) ||
      (p.collection || '').toLowerCase().includes(k) ||
      (p.author || '').toLowerCase().includes(k)
    );
  }
  poems.sort((a, b) => sort === 'likes'
    ? (b.likes||0) - (a.likes||0)
    : sort === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
  );
  res.json(poems.slice(0, +limit));
});

app.get('/api/poems/:id', (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const p = poems.find(x => x.id === +req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

app.post('/api/poems', authenticate, (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const { title, content, collection, category, tags } = req.body;
  if (!title || !content) return res.status(400).json({ error: '标题和正文不能为空' });

  const poem = {
    id: Date.now(),
    title: title.trim(),
    content: content.trim(),
    author: req.user.displayName,
    userId: req.user.id,
    collection: (collection || '').trim(),
    category: category || '随笔',
    tags: (tags || []).filter(Boolean),
    likes: 0,
    views: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  poems.unshift(poem);
  saveJSON(POEMS_FILE, poems);
  res.json(poem);
});

app.put('/api/poems/:id', authenticate, (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const i = poems.findIndex(x => x.id === +req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  if (poems[i].userId !== req.user.id) return res.status(403).json({ error: '无权编辑此诗' });

  const { title, content, collection, category, tags } = req.body;
  poems[i] = {
    ...poems[i],
    title: (title || poems[i].title).trim(),
    content: (content || poems[i].content).trim(),
    collection: (collection || poems[i].collection || '').trim(),
    category: category || poems[i].category,
    tags: tags || poems[i].tags,
    updatedAt: Date.now(),
  };
  saveJSON(POEMS_FILE, poems);
  res.json(poems[i]);
});

app.delete('/api/poems/:id', authenticate, (req, res) => {
  let poems = loadJSON(POEMS_FILE, []);
  const i = poems.findIndex(x => x.id === +req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  if (poems[i].userId !== req.user.id) return res.status(403).json({ error: '无权删除此诗' });

  poems = poems.filter(x => x.id !== +req.params.id);
  saveJSON(POEMS_FILE, poems);
  res.json({ ok: true });
});

app.post('/api/poems/:id/like', authenticate, (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const i = poems.findIndex(x => x.id === +req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  poems[i].likes = (poems[i].likes || 0) + 1;
  saveJSON(POEMS_FILE, poems);
  res.json({ likes: poems[i].likes });
});

app.post('/api/poems/:id/view', (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const i = poems.findIndex(x => x.id === +req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  poems[i].views = (poems[i].views || 0) + 1;
  saveJSON(POEMS_FILE, poems);
  res.json({ views: poems[i].views });
});

app.get('/api/stats', (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const cats = {}, tags = {};
  poems.forEach(p => {
    cats[p.category] = (cats[p.category]||0)+1;
    (p.tags||[]).forEach(t => tags[t] = (tags[t]||0)+1);
  });
  res.json({
    total: poems.length,
    totalLikes: poems.reduce((s,p) => s+(p.likes||0), 0),
    totalViews: poems.reduce((s,p) => s+(p.views||0), 0),
    categories: cats,
    tags,
  });
});

app.get('/api/tags', (req, res) => {
  const poems = loadJSON(POEMS_FILE, []);
  const tags = {};
  poems.forEach(p => (p.tags||[]).forEach(t => tags[t] = (tags[t]||0)+1));
  res.json(tags);
});

app.get('/api/users', (req, res) => {
  const users = loadJSON(USERS_FILE, []);
  res.json(users.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, createdAt: u.createdAt })));
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
