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

### 第一步：创建 Supabase 项目

1. 打开 https://supabase.com → Sign Up / Sign In
2. 点击 **New Project**，填写名称和数据库密码，选择区域（选 `East US` 或 `West Europe`）
3. 创建完成后，进入 **SQL Editor**，复制上方 `SUPABASE.sql` 文件内容，粘贴执行
4. 记录以下信息（Settings → API）：
   - **Project URL**（类似 `https://xxxxx.supabase.co`）
   - **API Key** → 选 `service_role`（注意：这是后端密钥，不要泄露到前端）

### 第二步：部署前端到 Cloudflare Pages

1. 打开 https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages**
2. 选择 **Connect to Git**，授权 GitHub，选择本仓库 `xiaomayu1/xiaomayu1-xiaomayu1.github.io`
3. 构建设置：
   - **Production branch**: `main`
   - **Build command**: `node cf-pages-build/build.js`
   - **Build output directory**: `_site`
   - 其余留空
4. 点击 **Save and Deploy**
5. 部署完成后获得地址：`https://墨韵.pages.dev`（或自定义域名）

### 第三步：部署后端到 Cloudflare Workers

1. 安装 Wrangler（全局）：
   ```bash
   npm install -g wrangler
   ```
2. 登录 Cloudflare：
   ```bash
   wrangler login
   ```
3. 进入 workers 目录并安装依赖：
   ```bash
   cd e:/web/workers
   npm install
   ```
4. 复制 `wrangler.toml` 到 workers 目录（或直接修改根目录的）：
   ```bash
   cp wrangler.toml workers/wrangler.toml
   ```
5. 设置环境变量（在 Cloudflare Dashboard 操作）：
   - 进入 **Workers & Pages** → 找到 `ink-pub` 服务 → **Settings** → **Variables**
   - 添加以下变量：
     | 变量名 | 值 |
     |--------|-----|
     | `SUPABASE_URL` | 你的 Supabase URL（如 `https://xxxxx.supabase.co`）|
     | `SUPABASE_KEY` | service_role 密钥 |
     | `JWT_SECRET` | 随机字符串（如用 `openssl rand -hex 32` 生成）|
6. 部署：
   ```bash
   cd e:/web/workers
   wrangler deploy
   ```
7. 部署成功后获得 Worker 地址：`https://墨韵.xiaomayu1.workers.dev`

### 第四步：配置前端连接后端

有两种方式连接前后端：

**方式 A：修改代码（推荐）**
编辑 `frontend/public/js/app.js` 第 2 行：
```js
const API = 'https://墨韵.xiaomayu1.workers.dev';
```
然后重新构建并部署 Pages：
```bash
node cf-pages-build/build.js
# 在 Cloudflare Dashboard 重新触发 Pages 部署
```

**方式 B：URL 参数（不改代码）**
访问时加 `?api=` 参数：
```
https://墨韵.pages.dev/?api=https://墨韵.xiaomayu1.workers.dev
```

---

## 本地运行

### 前端
```bash
cd e:/web/frontend/public
npx serve .
# 访问 http://localhost:3000
```

### 后端
```bash
cd e:/web/workers
# 设置环境变量后运行
wrangler dev
# 或手动设置：
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_KEY=your-service-role-key
export JWT_SECRET=random-secret
npx wrangler dev
```

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/poems` | 诗歌列表 |
| GET | `/api/poems/:id` | 单首诗歌 |
| POST | `/api/poems` | 发表诗歌（需登录） |
| PUT | `/api/poems/:id` | 编辑诗歌（仅作者） |
| DELETE | `/api/poems/:id` | 删除诗歌（仅作者） |
| POST | `/api/poems/:id/like` | 点赞（需登录） |
| POST | `/api/poems/:id/view` | 增加阅读 |
| GET | `/api/stats` | 站点统计 |
| GET | `/api/tags` | 标签列表 |

## 技术栈

- **前端**：纯 HTML/CSS/JavaScript
- **后端**：Cloudflare Workers + Node.js 兼容层
- **数据库**：Supabase（PostgreSQL）
- **认证**：bcryptjs + jsonwebtoken
- **部署**：Cloudflare Pages（前端）+ Cloudflare Workers（后端）
