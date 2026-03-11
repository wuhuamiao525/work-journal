/**
 * 待办任务汇总 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// 应用认证中间件
router.use(authenticateToken);

/**
 * 获取今日和逾期任务汇总
 * GET /api/tasks/daily-summary
 * Query参数:
 *   - date: 指定日期，默认今天 (格式: YYYY-MM-DD)
 */
router.get('/daily-summary', (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    console.log(`[API] 获取任务汇总 - 用户: ${userId}, 日期: ${targetDate}`);

    // 获取所有日期的日志
    const allDates = db.getAllDates(userId);
    
    // 按项目分组的任务
    const tasksByProject = {};
    let todayTotal = 0;
    let overdueTotal = 0;

    // 遍历所有日期的日志，提取待办任务
    for (const date of allDates) {
      const journal = db.getJournalByDate(userId, date);
      if (!journal || !journal.todos || journal.todos.length === 0) {
        continue;
      }

      // 处理每个待办任务
      journal.todos.forEach(todo => {
        // 跳过已完成的任务
        if (todo.completed) {
          return;
        }

        const projectName = todo.project || '未分类';
        const dueDate = todo.dueDate || date; // 如果没有截止日期，使用创建日期

        // 判断任务类型
        const isToday = dueDate === targetDate;
        const isOverdue = dueDate < targetDate;

        if (!isToday && !isOverdue) {
          return; // 跳过未来的任务
        }

        // 初始化项目分组
        if (!tasksByProject[projectName]) {
          tasksByProject[projectName] = {
            projectName,
            todayTasks: [],
            overdueTasks: []
          };
        }

        // 任务数据
        const taskInfo = {
          id: todo.id || `${date}-${todo.text}`,
          title: todo.text,
          dueDate: dueDate,
          priority: todo.priority || '中',
          status: todo.status || '未开始',
          createdDate: date, // 记录是哪天创建的
          description: todo.description || ''
        };

        // 分类存储
        if (isToday) {
          tasksByProject[projectName].todayTasks.push(taskInfo);
          todayTotal++;
        } else if (isOverdue) {
          tasksByProject[projectName].overdueTasks.push(taskInfo);
          overdueTotal++;
        }
      });
    }

    // 转换为数组并排序（按项目名称）
    const projectList = Object.values(tasksByProject).sort((a, b) => 
      a.projectName.localeCompare(b.projectName, 'zh-CN')
    );

    // 过滤掉没有任何任务的项目
    const filteredProjects = projectList.filter(
      p => p.todayTasks.length > 0 || p.overdueTasks.length > 0
    );

    // 返回结果
    const result = {
      date: targetDate,
      summary: {
        todayTotal,
        overdueTotal,
        projectCount: filteredProjects.length
      },
      tasksByProject: filteredProjects
    };

    console.log(`[API] 汇总完成 - 今日: ${todayTotal}, 逾期: ${overdueTotal}, 项目: ${filteredProjects.length}`);
    
    res.json(result);

  } catch (error) {
    console.error('[API] 获取任务汇总失败:', error);
    res.status(500).json({ error: 'Failed to get task summary' });
  }
});

/**
 * 获取所有未完成任务（不限日期）
 * GET /api/tasks/pending
 */
router.get('/pending', (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const allDates = db.getAllDates(userId);
    
    const pendingTasks = [];

    for (const date of allDates) {
      const journal = db.getJournalByDate(userId, date);
      if (!journal || !journal.todos) continue;

      journal.todos.forEach(todo => {
        if (!todo.completed) {
          pendingTasks.push({
            ...todo,
            createdDate: date,
            dueDate: todo.dueDate || date
          });
        }
      });
    }

    // 按截止日期排序
    pendingTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    res.json({ 
      total: pendingTasks.length,
      tasks: pendingTasks 
    });

  } catch (error) {
    console.error('[API] 获取待办任务失败:', error);
    res.status(500).json({ error: 'Failed to get pending tasks' });
  }
});

module.exports = router;
