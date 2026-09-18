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

## 部署方案：Cloudflare + Supabase（全免费）

### 第一步：创建 Supabase 数据库

1. 打开 https://supabase.com → 注册或登录
2. 点击 **New project**（新建项目）
   - Project name：填 `ink-pub`（任意名字）
   - Database password：记牢这个密码
   - Region：选 **East US**（延迟最低）
   - 点击 **Create new project**，等 1~2 分钟
3. 创建完成后，左侧菜单点击 **SQL Editor**
4. 打开本仓库的 **`SUPABASE.sql`** 文件，全选复制，粘贴到 SQL Editor，点击 **Run**
5. 记录以下信息（左侧菜单 **Settings** → **API**）：
   - **Project URL**（类似 `https://xxxxx.supabase.co`）
   - **api_key**（选 `service_role`，复制这一串）

---

### 第二步：部署前端 → Cloudflare Pages

1. 打开 https://dash.cloudflare.com → 左下角点 **Workers 和 Pages**
2. 点击顶部 **创建** → **Pages** → **连接到 Git**
3. 授权 GitHub，选择仓库 **xiaomayu1/xiaomayu1.github.io**
4. 配置构建设置：

   | 选项 | 填写内容 |
   |------|---------|
   | 生产分支 | `main` |
   | 构建命令 | `node cf-pages-build/build.js` |
   | 构建输出目录 | `_site` |
   | 构建缓存关键词 | （留空） |

5. 点击 **保存并部署**
6. 等待约 30 秒，部署成功后会显示地址，类似：
   `https://墨韵.pages.dev`

---

### 第三步：部署后端 → Cloudflare Workers

1. 回到 **Workers 和 Pages** 页面
2. 点击顶部 **创建** → **Worker** → **从 Git 创建**
3. 选择同一个仓库 `xiaomayu1/xiaomayu1.github.io`
4. 配置构建设置：

   | 选项 | 填写内容 |
   |------|---------|
   | 生产分支 | `main` |
   | 构建命令 | `npm install --prefix workers` |
   | 入口文件 | `workers/index.js` |
   | 构建输出目录 | （留空） |

5. 点击 **保存并部署**
6. 部署完成后，进入该 Worker 的 **设置** 页面
7. 找到 **变量** 部分，点击 **添加变量**，添加以下三个：

   | 变量名 | 值 |
   |--------|-----|
   | `SUPABASE_URL` | 第一步复制的 Project URL（`https://xxxxx.supabase.co`） |
   | `SUPABASE_KEY` | 第一步复制的 service_role 密钥 |
   | `JWT_SECRET` | 随便输一串随机字符，比如 `moyun-secret-2026` |

8. 点击 **保存**，然后点顶部 **部署** → **重新部署**

9. 部署成功后，在 Worker 详情页顶部会显示域名，类似：
   `https://墨韵.xiaomayu1.workers.dev`
   （复制这个地址，后面要用）

---

### 第四步：连接前端和后端

有两种方式，任选一种：

**方式 A：改代码（推荐，一劳永逸）**

1. 用任意文本编辑器打开 `frontend/public/js/app.js`
2. 找到第 2 行：
   ```js
   const API = '';
   ```
3. 改成你的 Worker 地址：
   ```js
   const API = 'https://墨韵.xiaomayu1.workers.dev';
   ```
4. 保存后，回到 Cloudflare Pages → 你的页面 → **部署** → **触发部署**
5. 等待 30 秒，刷新页面即可

**方式 B：不改代码，用 URL 参数**

访问时直接在地址后面加 `?api=你的Worker地址`：
```
https://墨韵.pages.dev/?api=https://墨韵.xiaomayu1.workers.dev
```

---

### 第五步：测试

1. 打开你的 Pages 地址
2. 点击右上角 **注册**，创建第一个账号
3. 登录后点击右上角 **✏ 写**，发表第一首诗
4. 邀请朋友注册，大家一起写诗！

---

## 本地运行

### 前端
```bash
cd e:/web/frontend/public
npx serve .
# 浏览器打开 http://localhost:3000
```

### 后端（Worker 本地调试）
```bash
cd e:/web/workers
npm install

# 创建 .dev.vars 文件，填入环境变量：
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_KEY=your-service-role-key
# JWT_SECRET=moyun-secret-2026

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
| 数据库 | Supabase（PostgreSQL） |
| 认证 | bcryptjs + jsonwebtoken（JWT） |
| 部署 | Cloudflare Pages + Cloudflare Workers |
| 字体 | Noto Serif SC（Google Fonts） |

---

## 文件说明

```
e:/web/
├── SUPABASE.sql           ← Supabase 建表 SQL（在 SQL Editor 执行）
├── cf-pages-build/        ← Pages 构建脚本
│   ├── build.js
│   └── package.json
├── frontend/public/       ← 前端代码（由 Pages 托管）
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── workers/               ← Cloudflare Workers 后端
│   ├── index.js           ← Worker 主入口
│   └── package.json
├── wrangler.toml          ← Workers 配置
├── backend/               ← 本地开发用 Express 后端（可忽略）
└── README.md
```
