/**
 * 工作日志系统后端服务
 * 使用 Express + SQLite
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors()); // 允许跨域请求
app.use(bodyParser.json({ limit: '10mb' })); // 解析 JSON 请求体
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// 初始化数据库
const db = require('./db');
db.initDatabase();

// 启动自动同步定时任务
const autoSyncScheduler = require('./autoSyncScheduler');
autoSyncScheduler.startScheduler();

// 导入路由
const authRoutes = require('./routes/auth');
const journalRoutes = require('./routes/journal');
const tasksRoutes = require('./routes/tasks');

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Work Journal API is running' });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/tasks', tasksRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📝 API endpoints:`);
  console.log(`   - POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   - GET  http://localhost:${PORT}/health`);
});
