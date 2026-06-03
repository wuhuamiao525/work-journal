/**
 * 后端自动同步调度器
 * 每天凌晨1点自动执行数据同步
 */

const cron = require('node-cron');
const db = require('./db');

// 辅助函数：解析可能双重序列化的JSON
function safeParse(jsonStr) {
  try {
    let data = JSON.parse(jsonStr);
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    return data;
  } catch (error) {
    console.error('[AutoSync] JSON解析错误:', error);
    return null;
  }
}

// 判断是否为工作日（周一到周五）
function isWorkday(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

// 获取上一个工作日
function getPreviousWorkday(date) {
  let previous = new Date(date);
  previous.setDate(previous.getDate() - 1);

  while (!isWorkday(previous)) {
    previous.setDate(previous.getDate() - 1);
  }

  return previous.toISOString().split('T')[0];
}

// 执行自动同步
async function executeAutoSync() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  console.log('\n========================================');
  console.log('[后端自动同步] 开始执行');
  console.log('[后端自动同步] 当前时间:', now.toLocaleString('zh-CN'));
  console.log('[后端自动同步] 今天:', today);
  console.log('========================================');

  // 检查是否为工作日
  if (!isWorkday(now)) {
    console.log('[后端自动同步] ❌ 今天不是工作日，跳过同步');
    return;
  }

  console.log('[后端自动同步] ✅ 今天是工作日');

  const userId = 1; // 默认用户ID

  try {
    // 检查今天的数据
    const todayData = db.getJournalByDate(userId, today);

    let todayProjectCount = 0;
    let todayTodoCount = 0;

    if (todayData) {
      todayProjectCount =
        (todayData.projects.inProgress?.length || 0) +
        (todayData.projects.delivered?.length || 0) +
        (todayData.projects.accepted?.length || 0);
      todayTodoCount = todayData.todos?.length || 0;

      console.log('[后端自动同步] 今天的数据:');
      console.log('  - 会议:', todayData.meetings?.length || 0);
      console.log('  - 项目:', todayProjectCount);
      console.log('  - 待办:', todayTodoCount);
    } else {
      console.log('[后端自动同步] 今天没有数据');
    }

    // 获取昨天的数据
    const yesterday = getPreviousWorkday(now);
    console.log('[后端自动同步] 上一个工作日:', yesterday);

    const yesterdayData = db.getJournalByDate(userId, yesterday);

    if (!yesterdayData) {
      console.log('[后端自动同步] ❌ 上一个工作日没有数据，跳过同步');
      return;
    }

    const yesterdayProjectCount =
      (yesterdayData.projects.inProgress?.length || 0) +
      (yesterdayData.projects.delivered?.length || 0) +
      (yesterdayData.projects.accepted?.length || 0);
    const yesterdayTodoCount = yesterdayData.todos?.length || 0;

    console.log('[后端自动同步] 上一个工作日的数据:');
    console.log('  - 会议:', yesterdayData.meetings?.length || 0);
    console.log('  - 项目:', yesterdayProjectCount);
    console.log('  - 待办:', yesterdayTodoCount);

    // 判断是否需要同步
    const needsSyncProjects = todayProjectCount === 0 && yesterdayProjectCount > 0;
    const needsSyncTodos = todayTodoCount === 0 && yesterdayTodoCount > 0;

    if (!needsSyncProjects && !needsSyncTodos) {
      console.log('[后端自动同步] ✅ 今天已有完整数据，无需同步');
      return;
    }

    console.log('[后端自动同步] 开始合并数据...');
    console.log('  - 需要同步项目:', needsSyncProjects);
    console.log('  - 需要同步待办:', needsSyncTodos);

    // 合并会议：保留今天的 + 添加昨天未完成的（去重）
    let finalMeetings = todayData?.meetings || [];
    const existingMeetingKeys = new Set(finalMeetings.map(m => `${m.name}-${m.time}`));

    const newMeetings = (yesterdayData.meetings || [])
      .filter(m => !m.completed)
      .filter(m => !existingMeetingKeys.has(`${m.name}-${m.time}`));

    finalMeetings = [...finalMeetings, ...newMeetings];
    console.log('  ✅ 会议: 保留', todayData?.meetings?.length || 0, '个, 新增', newMeetings.length, '个');

    // 项目：如果今天为空则复制昨天的
    let finalProjects = todayData?.projects || { inProgress: [], delivered: [], accepted: [] };

    if (todayProjectCount === 0 && yesterdayProjectCount > 0) {
      finalProjects = yesterdayData.projects;
      console.log('  ✅ 项目: 从昨天复制', yesterdayProjectCount, '个');
    } else {
      console.log('  ✅ 项目: 保留今天的', todayProjectCount, '个');
    }

    // 待办：如果今天为空则复制昨天的（只保留未完成的任务，保留plannedDate等所有字段）
    let finalTodos = todayData?.todos || [];

    if (todayTodoCount === 0 && yesterdayTodoCount > 0) {
      finalTodos = (yesterdayData.todos || []).map(todoProject => {
        return {
          ...todoProject,
          // filter保留未完成的任务，所有字段（包括plannedDate）都会保留
          tasks: (todoProject.tasks || []).filter(task => !task.completed)
        };
      }).filter(todoProject => todoProject.tasks.length > 0);

      const taskCount = finalTodos.reduce((sum, tp) => sum + tp.tasks.length, 0);
      console.log('  ✅ 待办: 从昨天复制', finalTodos.length, '个项目,', taskCount, '个任务（保留plannedDate）');
    } else {
      console.log('  ✅ 待办: 保留今天的', todayTodoCount, '个');
    }

    // 保存到数据库
    db.saveJournal(userId, {
      date: today,
      meetings: finalMeetings,
      projects: finalProjects,
      todos: finalTodos,
      diary: todayData?.diary || ''
    });

    console.log('\n[后端自动同步] ✅ 同步完成！');
    console.log('========================================\n');

  } catch (error) {
    console.error('[后端自动同步] ❌ 同步失败:', error);
  }
}

// 启动定时任务
function startScheduler() {
  // 每天凌晨1点执行
  const task = cron.schedule('0 1 * * *', () => {
    console.log('\n[后端自动同步] 定时任务触发');
    executeAutoSync();
  }, {
    timezone: "Asia/Shanghai"
  });

  console.log('========================================');
  console.log('[后端自动同步] 定时任务已启动');
  console.log('[后端自动同步] 执行时间: 每天凌晨1点');
  console.log('========================================');

  // 启动时立即检查一次（可选）
  console.log('[后端自动同步] 启动时立即检查一次...');
  executeAutoSync();

  return task;
}

module.exports = {
  startScheduler,
  executeAutoSync
};
