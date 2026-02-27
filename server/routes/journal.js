/**
 * 工作日志 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// 应用认证中间件到所有日志路由
router.use(authenticateToken);

// 获取指定日期的工作日志
router.get('/:date', (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id; // 从认证中间件获取用户ID

    const journal = db.getJournalByDate(userId, date);

    if (!journal) {
      // 如果不存在，返回空数据结构
      return res.json({
        date,
        meetings: [],
        projects: {
          inProgress: [],
          delivered: [],
          accepted: [],
        },
        todos: [],
        diary: '',
        lastModified: new Date().toISOString(),
      });
    }

    res.json(journal);
  } catch (error) {
    console.error('Error getting journal:', error);
    res.status(500).json({ error: 'Failed to get journal' });
  }
});

// 保存工作日志
router.post('/', (req, res) => {
  try {
    const journalData = req.body;
    const userId = req.user.id; // 从认证中间件获取用户ID

    // 验证必需字段
    if (!journalData.date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // 保存到数据库
    const success = db.saveJournal(userId, journalData);

    if (success) {
      res.json({ success: true, message: 'Journal saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save journal' });
    }
  } catch (error) {
    console.error('Error saving journal:', error);
    res.status(500).json({ error: 'Failed to save journal' });
  }
});

// 获取所有日期列表
router.get('/dates/all', (req, res) => {
  try {
    const userId = req.user.id; // 从认证中间件获取用户ID
    const dates = db.getAllDates(userId);
    res.json({ dates });
  } catch (error) {
    console.error('Error getting dates:', error);
    res.status(500).json({ error: 'Failed to get dates' });
  }
});

// 删除指定日期的工作日志
router.delete('/:date', (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id; // 从认证中间件获取用户ID
    const success = db.deleteJournalByDate(userId, date);

    if (success) {
      res.json({ success: true, message: 'Journal deleted successfully' });
    } else {
      res.status(404).json({ error: 'Journal not found' });
    }
  } catch (error) {
    console.error('Error deleting journal:', error);
    res.status(500).json({ error: 'Failed to delete journal' });
  }
});

module.exports = router;
