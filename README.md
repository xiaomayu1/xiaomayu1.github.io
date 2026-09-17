# 墨韵 · 诗歌社区

多用户诗歌发布平台 — 每个人都可以注册账号、发表诗歌、管理自己的作品。

## 功能

- 👤 用户注册 / 登录（密码加密存储）
- ✍️ 发表诗歌（标题、分类、集名、标签、正文）
- 📖 优雅阅读体验，支持点赞、浏览计数
- 🔐 只有作者本人可以编辑/删除自己的诗歌
- 🔍 按分类、标签搜索，按时间/热度排序
- 🏷️ 动态标签云
- 🌙 深色/浅色主题
- 📱 响应式设计

## 本地运行

```bash
cd backend
npm install
npm start
# 打开 http://localhost:3001
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户 |
| GET/POST | `/api/poems` | 诗歌列表 / 发表 |
| GET/PUT/DELETE | `/api/poems/:id` | 获取 / 编辑(仅作者) / 删除(仅作者) |
| POST | `/api/poems/:id/like` | 点赞(需登录) |
| POST | `/api/poems/:id/view` | 增加阅读 |
| GET | `/api/stats` | 站点统计 |

## GitHub Pages 部署

1. 推送代码到 GitHub
2. Settings → Pages → Source: main branch
3. 后端部署到 Railway / Render / Vercel
4. 修改 `app.js` 中 `API` 变量指向后端地址
