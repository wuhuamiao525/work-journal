/**
 * 用户认证 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken } = require('../middleware/auth');

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 验证用户密码
    const user = await db.verifyPassword(username, password);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成 JWT Token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 创建用户（管理员功能）
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为6位' });
    }

    // 创建用户
    const userId = await db.createUser(username, password, displayName);

    res.json({
      success: true,
      message: '用户创建成功',
      userId,
    });
  } catch (error) {
    if (error.message === '用户名已存在') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 获取所有用户列表（管理员功能）
router.get('/users', (req, res) => {
  try {
    const users = db.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

module.exports = router;
