# 快速启动指南

## 第一次使用

### 1. 启动后端服务

打开一个终端窗口，运行：

```bash
npm run server
```

你应该看到类似下面的输出：

```
✅ Server is running on http://localhost:3001
📝 API endpoint: http://localhost:3001/api/journals
```

### 2. 启动前端应用

打开**另一个**终端窗口，运行：

```bash
npm run dev
```

你应该看到类似下面的输出：

```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. 访问应用

在浏览器中打开：`http://localhost:5173/`

## 常见问题

### Q: 前端提示"保存失败，请检查网络连接"

**A:** 确保后端服务器正在运行。检查 `http://localhost:3001/health` 是否可以访问。

### Q: 端口被占用

**A:** 
- 如果 3001 端口被占用，修改 `server/index.js` 中的 `PORT` 变量
- 同时修改 `src/workJournal/services/api.ts` 中的 `API_BASE_URL`

### Q: 数据存储在哪里？

**A:** 
- 主存储：`database/work-journal.db`（SQLite 数据库文件）
- 备份存储：浏览器 LocalStorage

### Q: 如何备份数据？

**A:** 复制 `database/work-journal.db` 文件到安全的地方。

### Q: 如何恢复数据？

**A:** 将备份的 `work-journal.db` 文件复制回 `database/` 目录。

## 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/` 目录中。

## 停止服务

在运行后端或前端的终端窗口中按 `Ctrl + C`。
