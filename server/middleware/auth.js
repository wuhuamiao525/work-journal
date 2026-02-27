/**
 * JWT 认证中间件
 */

const jwt = require('jsonwebtoken');

// JWT 密钥（生产环境应该使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'work-journal-secret-key-change-in-production';

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
    JWT_SECRET,
    { expiresIn: '7d' } // 7天过期
  );
}

// 验证 JWT Token 中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '认证令牌无效或已过期' });
    }

    req.user = user; // 将用户信息附加到请求对象
    next();
  });
}

module.exports = {
  generateToken,
  authenticateToken,
  JWT_SECRET,
};
