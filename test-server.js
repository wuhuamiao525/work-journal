const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 测试路由
app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({ success: true, message: 'Test login works!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
});
