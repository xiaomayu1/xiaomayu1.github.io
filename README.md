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

## 部署（两步走）

### 第一步：部署后端（Railway 免费）

1. 打开 [railway.app](https://railway.app) → Sign In with GitHub
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择本仓库，新建一个 Service，命名为 `ink-pub-backend`
4. Railway 会自动读取 `backend/render.yaml`，运行 `npm install && npm start`
5. 部署完成后，复制你的后端 URL（格式：`https://xxx.onrender.com`）

### 第二步：配置前端 API 地址

编辑 `frontend/public/js/app.js` 第 2 行，将空字符串改为你的后端 URL：

```js
const API = 'https://your-backend.onrender.com';
```

然后 push 到 GitHub，GitHub Pages 会自动部署。

**或者**：不修改代码，直接访问时加上 `?api=` 参数：
```
https://xiaomayu1.github.io/xiaomayu1-xiaomayu1.github.io/?api=https://your-backend.onrender.com
```

### GitHub Pages 设置

1. 打开 [GitHub Settings → Pages](https://github.com/xiaomayu1/xiaomayu1-xiaomayu1.github.io/settings/pages)
2. Source 选择 **GitHub Actions**
3. 稍等几分钟，页面会显示部署地址（通常是 `https://xiaomayu1.github.io/xiaomayu1-xiaomayu1.github.io/`）

---

## 本地运行

```bash
cd backend
npm install
npm start
# 浏览器打开 http://localhost:3001
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

- **前端**: 纯 HTML/CSS/JavaScript（无框架）
- **后端**: Node.js + Express
- **认证**: bcryptjs + jsonwebtoken
- **部署**: GitHub Pages（前端）+ Railway（后端）
- **字体**: Noto Serif SC / Noto Sans SC（Google Fonts）
