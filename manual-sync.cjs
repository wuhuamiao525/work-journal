/**
 * 手动同步脚本
 * 使用方法：node manual-sync.cjs [日期]
 * 例如：node manual-sync.cjs 2026-03-11
 * 如果不指定日期，默认同步今天
 */

const Database = require('better-sqlite3');
const db = new Database('./database/work-journal.db');

// 辅助函数：解析可能双重序列化的JSON
function safeParse(jsonStr) {
  let data = JSON.parse(jsonStr);
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  return data;
}

// 获取日期参数，如果没有则使用今天
const targetDateArg = process.argv[2];
const targetDate = targetDateArg || new Date().toISOString().split('T')[0];

// 计算昨天的日期
const targetDateObj = new Date(targetDate);
const yesterdayObj = new Date(targetDateObj);
yesterdayObj.setDate(yesterdayObj.getDate() - 1);
const yesterday = yesterdayObj.toISOString().split('T')[0];

const userId = 1;

console.log('==========================================');
console.log('手动同步数据');
console.log('==========================================');
console.log(`目标日期（今天）: ${targetDate}`);
console.log(`源日期（昨天）: ${yesterday}`);
console.log('');

// 1. 检查今天的数据
let todayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, targetDate);
let todayMeetings = [];
let todayProjects = { inProgress: [], delivered: [], accepted: [] };
let todayTodos = [];
let todayDiary = '';

if (todayRow) {
  todayMeetings = safeParse(todayRow.meetings);
  todayProjects = safeParse(todayRow.projects);
  todayTodos = safeParse(todayRow.todos);
  todayDiary = todayRow.diary || '';

  console.log(`${targetDate} 当前数据:`);
  console.log(`  会议: ${todayMeetings.length}个`);
  console.log(`  项目: 进行中${todayProjects.inProgress?.length || 0}, 已交付${todayProjects.delivered?.length || 0}, 已验收${todayProjects.accepted?.length || 0}`);
  console.log(`  待办: ${todayTodos.length}个项目`);
} else {
  console.log(`${targetDate} 没有数据`);
}

// 2. 获取昨天的数据
const yesterdayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, yesterday);

if (!yesterdayRow) {
  console.log(`\n❌ 错误: ${yesterday} 没有数据，无法同步`);
  db.close();
  process.exit(1);
}

const sourceMeetings = safeParse(yesterdayRow.meetings);
const sourceProjects = safeParse(yesterdayRow.projects);
const sourceTodos = safeParse(yesterdayRow.todos);

console.log(`\n${yesterday} 的数据:`);
console.log(`  会议: ${sourceMeetings.length}个 (未完成: ${sourceMeetings.filter(m => !m.completed).length})`);
console.log(`  项目: 进行中${sourceProjects.inProgress?.length || 0}, 已交付${sourceProjects.delivered?.length || 0}, 已验收${sourceProjects.accepted?.length || 0}`);
console.log(`  待办: ${sourceTodos.length}个项目`);

// 3. 合并策略
console.log('\n==========================================');
console.log('开始合并数据...');
console.log('==========================================');

// 会议：合并今天已有的 + 昨天未完成的（去重）
let finalMeetings = [...todayMeetings];
const existingMeetingKeys = new Set(todayMeetings.map(m => `${m.name}-${m.time}`));

const newMeetings = sourceMeetings
  .filter(m => !m.completed)
  .filter(m => !existingMeetingKeys.has(`${m.name}-${m.time}`));

finalMeetings = [...finalMeetings, ...newMeetings];
console.log(`\n✅ 会议: 保留${todayMeetings.length}个, 新增${newMeetings.length}个, 总计${finalMeetings.length}个`);

// 项目：如果今天为空则复制昨天的，否则保留今天的
let finalProjects = todayProjects;
const todayProjectCount =
  (todayProjects.inProgress?.length || 0) +
  (todayProjects.delivered?.length || 0) +
  (todayProjects.accepted?.length || 0);

const sourceProjectCount =
  (sourceProjects.inProgress?.length || 0) +
  (sourceProjects.delivered?.length || 0) +
  (sourceProjects.accepted?.length || 0);

if (todayProjectCount === 0 && sourceProjectCount > 0) {
  finalProjects = {
    inProgress: sourceProjects.inProgress || [],
    delivered: sourceProjects.delivered || [],
    accepted: sourceProjects.accepted || []
  };
  console.log(`✅ 项目: 从昨天复制${sourceProjectCount}个项目`);
} else {
  console.log(`✅ 项目: 保留今天的${todayProjectCount}个项目`);
}

// 待办：如果今天为空则复制昨天的，否则保留今天的
let finalTodos = todayTodos;

if (todayTodos.length === 0 && sourceTodos.length > 0) {
  finalTodos = sourceTodos.map(todoProject => {
    return {
      ...todoProject,
      tasks: (todoProject.tasks || []).filter(task => !task.completed)
    };
  }).filter(todoProject => todoProject.tasks.length > 0);

  const taskCount = finalTodos.reduce((sum, tp) => sum + tp.tasks.length, 0);
  console.log(`✅ 待办: 从昨天复制${finalTodos.length}个项目, ${taskCount}个任务`);
} else {
  console.log(`✅ 待办: 保留今天的${todayTodos.length}个项目`);
}

// 4. 保存到数据库
console.log('\n==========================================');
console.log('保存到数据库...');
console.log('==========================================');

const stmt = db.prepare(`
  INSERT OR REPLACE INTO work_journals
  (user_id, date, meetings, projects, todos, diary, last_modified)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const result = stmt.run(
  userId,
  targetDate,
  JSON.stringify(finalMeetings),
  JSON.stringify(finalProjects),
  JSON.stringify(finalTodos),
  todayDiary,
  new Date().toISOString()
);

console.log(`✅ 保存成功，受影响行数: ${result.changes}`);

// 5. 验证
const verifyRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, targetDate);
if (verifyRow) {
  const verifyMeetings = safeParse(verifyRow.meetings);
  const verifyProjects = safeParse(verifyRow.projects);
  const verifyTodos = safeParse(verifyRow.todos);

  console.log('\n==========================================');
  console.log('验证结果');
  console.log('==========================================');
  console.log(`${targetDate} 最终数据:`);
  console.log(`  ✅ 会议: ${verifyMeetings.length}个`);
  console.log(`  ✅ 项目: 进行中${verifyProjects.inProgress?.length || 0}, 已交付${verifyProjects.delivered?.length || 0}, 已验收${verifyProjects.accepted?.length || 0}`);
  console.log(`  ✅ 待办: ${verifyTodos.length}个项目, ${verifyTodos.reduce((sum, tp) => sum + (tp.tasks?.length || 0), 0)}个任务`);
}

db.close();

console.log('\n==========================================');
console.log('✅ 同步完成！');
console.log('==========================================');
console.log('请刷新浏览器页面（Ctrl+F5）');
console.log('');
