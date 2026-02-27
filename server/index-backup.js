/**
 * 工作日志系统后端服务
 * 使用 Express + SQLite
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const authRoutes = require('./routes/auth');
const journalRoutes = require('./routes/journal');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors()); // 允许跨域请求
app.use(bodyParser.json({ limit: '10mb' })); // 解析 JSON 请求体
app.use(bodyParser.urlencoded({ extended: true }));

// 初始化数据库
db.initDatabase();

// API 路由
console.log('📌 Registering auth routes at /api/auth');
app.use('/api/auth', authRoutes);
console.log('📌 Registering journal routes at /api/journals');
app.use('/api/journals', journalRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Work Journal API is running' });
});

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
  console.log(`📝 API endpoint: http://localhost:${PORT}/api/journals`);
});
