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
 * 获取今日和逾期任务汇总（包含会议）
 * GET /api/tasks/daily-summary
 * Query参数:
 *   - date: 指定日期，默认今天 (格式: YYYY-MM-DD)
 */
router.get('/daily-summary', (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    console.log(`[API] 获取任务汇总 - 用户: ${userId}, 日期: ${targetDate}`);

    // 获取今日的会议安排
    const todayJournal = db.getJournalByDate(userId, targetDate);
    const todayMeetings = todayJournal?.meetings || [];
    
    // 获取所有日期的日志
    const allDates = db.getAllDates(userId);
    
    // 按项目分组的任务
    const tasksByProject = {};
    const seenTasks = new Map(); // 用于去重，key=taskId, value={task, date}
    let todayTotal = 0;
    let overdueTotal = 0;

    // 遍历所有日期的日志，提取待办任务（从最新到最旧）
    for (const date of allDates) {
      const journal = db.getJournalByDate(userId, date);
      if (!journal || !journal.todos || journal.todos.length === 0) {
        continue;
      }

      // 处理每个待办项目（每个 todo 是一个项目，包含多个 tasks）
      journal.todos.forEach(todo => {
        const projectName = todo.name || '未分类';

        // 跳过没有任务的项目
        if (!todo.tasks || todo.tasks.length === 0) {
          return;
        }

        // 遍历项目下的每个任务
        todo.tasks.forEach(task => {
          // 生成任务唯一键：使用项目名+任务内容（因为任务ID每次更新会变）
          const taskKey = `${projectName}:${task.content}`;
          
          // 调试：加密狗任务
          if (task.content && task.content.includes('加密狗')) {
            console.log(`[DEBUG] 遇到加密狗任务 - 日期:${date}, completedAt:${task.completedAt}, 已在map:${seenTasks.has(taskKey)}`);
          }
          
          // 去重：allDates 是倒序（从新到旧），第一次遇到的就是最新版本
          if (seenTasks.has(taskKey)) {
            // 已经处理过这个任务，跳过旧版本
            return;
          }
          
          // 首次遇到这个任务，记录下来（这是最新版本）
          // 包括已完成和未完成的任务，后续再过滤
          seenTasks.set(taskKey, { task, date, projectName });
        });
      });
    }

    // 处理去重后的任务
    seenTasks.forEach(({ task, date, projectName }) => {
      // 跳过已完成的任务（优先使用 completedAt 字段，如果没有则使用 completed 字段）
      if (task.completedAt || task.completed) {
        return;
      }

      const taskId = task.id || `${task.content}_${task.plannedDate || date}`;
      const dueDate = task.plannedDate || date; // 使用计划日期，如果没有则使用创建日期

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
        id: taskId,
        title: task.content,
        dueDate: dueDate,
        priority: task.priority || '中',
        status: task.status || '未开始',
        createdDate: date, // 记录是哪天创建的
        description: task.progress || task.description || ''
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
        projectCount: filteredProjects.length,
        meetingCount: todayMeetings.length
      },
      meetings: todayMeetings,
      tasksByProject: filteredProjects
    };

    console.log(`[API] 汇总完成 - 今日: ${todayTotal}, 逾期: ${overdueTotal}, 项目: ${filteredProjects.length}, 会议: ${todayMeetings.length}`);
    
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
