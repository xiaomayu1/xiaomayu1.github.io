# 墨韵 · 诗歌社区

多用户诗歌发布平台 — 每个人都可以注册账号、发表诗歌、管理自己的作品。

## 功能

- 👤 用户注册 / 登录（bcrypt 加密 + JWT）
- ✍️ 发表诗歌（标题、分类、集名、标签、正文）
- 📖 优雅阅读，支持点赞和浏览计数
- 🔐 只有作者本人可以编辑/删除自己的诗歌
- 🔍 按分类、标签搜索，按时间/热度排序
- 🏷️ 动态标签云
- 🌙 深色/浅色主题
- 📱 响应式设计

---

## 部署方案：Cloudflare（全免费，无第三方数据库）

### 前置：创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名：`xiaomayu1.github.io`（或任意名字）
3. 公开 → **Create repository**
4. 把代码推上去：
   ```bash
   cd e:/web
   git remote set-url origin https://github.com/xiaomayu1/xiaomayu1.github.io.git
   git push -u origin main
   ```

---

### 第一步：创建 D1 数据库

1. 打开 https://dash.cloudflare.com → 左下角 **Workers 和 Pages**
2. 左侧菜单点 **D1 数据库** → **创建数据库**
3. 名称填 `ink-pub-db`，区域选 **East US**，点击 **创建**
4. 记住数据库 ID（长字符串，如 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）

---

### 第二步：建表并导入数据

有两种方式：

**方式 A：用 Wrangler 命令行**
```bash
cd e:/web/workers
npm install
npx wrangler d1 execute ink-pub-db --file=d1/migrate.sql
```

**方式 B：用 Cloudflare Dashboard（推荐，不用命令行）**
1. 进入刚创建的 `ink-pub-db` 数据库
2. 点 **控制台** 标签页
3. 依次执行以下 SQL（复制粘贴，每次点 **运行**）：

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE poems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  user_id TEXT NOT NULL,
  collection TEXT DEFAULT '',
  category TEXT DEFAULT '随笔',
  tags TEXT DEFAULT '[]',
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_poems_category ON poems(category);
CREATE INDEX idx_poems_created_at ON poems(created_at DESC);
CREATE INDEX idx_poems_likes ON poems(likes DESC);
CREATE INDEX idx_users_username ON users(username);
```

然后在**数据**标签页，点 **插入行**，逐条添加示例诗歌（或直接用上面的 migrate.sql 批量导入）。

---

### 第三步：部署后端 Worker

1. 回到 **Workers 和 Pages** → **创建** → **Worker** → **从 Git 创建**
2. 选择你的 GitHub 仓库
3. 构建设置：

   | 选项 | 填写 |
   |------|------|
   | 生产分支 | `main` |
   | 构建命令 | `npm install --prefix workers` |
   | 入口文件 | `workers/index.js` |

4. 点 **保存并部署**
5. 部署完成后，进入该 Worker 的 **设置** 页面
6. 找到 **变量**，添加：

   | 变量名 | 值 |
   |--------|-----|
   | `JWT_SECRET` | 随机字符串，如 `moyun-2026-abc123` |

7. 找到 **D1 数据库绑定**，添加：
   - 变量名：`DB`
   - 数据库：选 `ink-pub-db`
   - 环境绑定：生产环境
8. 点 **保存** → 顶部 **部署** → **重新部署**

9. 获得 Worker 地址，记录：`https://墨韵.xiaomayu1.workers.dev`

---

### 第四步：部署前端 Pages

1. 回到 **Workers 和 Pages** → **创建** → **Pages** → **连接到 Git**
2. 选择同一个仓库
3. 构建设置：

   | 选项 | 填写 |
   |------|------|
   | 生产分支 | `main` |
   | 构建命令 | `node cf-pages-build/build.js` |
   | 构建输出目录 | `_site` |

4. 点 **保存并部署**
5. 获得 Pages 地址：`https://墨韵.pages.dev`

---

### 第五步：连接前后端

1. 打开本地 `frontend/public/js/app.js`
2. 找到第 2 行：
   ```js
   const API = '';
   ```
3. 改成你的 Worker 地址：
   ```js
   const API = 'https://墨韵.xiaomayu1.workers.dev';
   ```
4. 保存后推送到 GitHub，Pages 会自动重新部署

---

### 测试

1. 访问你的 Pages 地址
2. 右上角注册账号
3. 登录后点 **✏ 写** 发表第一首诗
4. 邀请朋友一起玩！

---

## 本地开发

### 前端
```bash
cd e:/web/frontend/public
npx serve .
# 访问 http://localhost:3000
```

### 后端（本地调试）
```bash
cd e:/web/workers
npm install

# 创建本地 D1 数据库
npx wrangler d1 create ink-pub-db-local
npx wrangler d1 execute ink-pub-db-local --file=d1/migrate.sql

# 修改 wrangler.toml 里的 database_id 为本地 ID
# 然后运行：
npx wrangler dev
# 访问 http://localhost:8787
```

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET | `/api/poems` | 诗歌列表 |
| GET | `/api/poems/:id` | 单首诗歌详情 |
| POST | `/api/poems` | 发表诗歌（需登录） |
| PUT | `/api/poems/:id` | 编辑诗歌（仅作者） |
| DELETE | `/api/poems/:id` | 删除诗歌（仅作者） |
| POST | `/api/poems/:id/like` | 点赞（需登录） |
| POST | `/api/poems/:id/view` | 增加浏览计数 |
| GET | `/api/stats` | 站点统计 |
| GET | `/api/tags` | 标签列表 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 纯 HTML / CSS / JavaScript |
| 后端 | Cloudflare Workers（Node.js 兼容） |
| 数据库 | Cloudflare D1（SQLite） |
| 认证 | bcryptjs + jsonwebtoken（JWT） |
| 部署 | Cloudflare Pages（前端）+ Cloudflare Workers（后端） |
| 字体 | Noto Serif SC（Google Fonts） |

---

## 文件说明

```
e:/web/
├── SUPABASE.sql           ← 已废弃（改用 D1）
├── cf-pages-build/        ← Pages 构建脚本
│   ├── build.js
│   └── package.json
├── workers/               ← Cloudflare Workers 后端
│   ├── index.js           ← Worker 主入口
│   ├── package.json
│   └── d1/
│       └── migrate.sql    ← D1 建表和初始化 SQL
├── wrangler.toml          ← Workers 配置模板
├── backend/               ← 已废弃
└── frontend/public/       ← 前端代码
    ├── index.html
    ├── css/style.css
    └── js/app.js
```
