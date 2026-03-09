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

// 从2026-02-28复制数据到2026-03-05
const sourceDate = '2026-02-28';
const targetDate = '2026-03-05';
const userId = 1;

console.log(`正在从 ${sourceDate} 复制数据到 ${targetDate}...`);

// 获取源数据
const sourceRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = ?').get(sourceDate, userId);

if (!sourceRow) {
  console.log(`❌ ${sourceDate} 没有数据！`);
  db.close();
  process.exit(1);
}

// 解析源数据
const sourceMeetings = safeParse(sourceRow.meetings);
const sourceProjects = safeParse(sourceRow.projects);
const sourceTodos = safeParse(sourceRow.todos);

console.log(`\n源数据统计:`);
console.log(`  会议: ${sourceMeetings.length}个`);
console.log(`  项目: 进行中${sourceProjects.inProgress?.length || 0}, 已交付${sourceProjects.delivered?.length || 0}, 已验收${sourceProjects.accepted?.length || 0}`);
console.log(`  待办: ${sourceTodos.length}个`);

// 过滤数据
// 1. 只复制未完成的会议
const targetMeetings = sourceMeetings.filter(m => !m.completed);

// 2. 复制所有项目
const targetProjects = {
  inProgress: sourceProjects.inProgress || [],
  delivered: sourceProjects.delivered || [],
  accepted: sourceProjects.accepted || []
};

// 3. 复制所有待办项目，但过滤掉已完成的任务
const targetTodos = sourceTodos.map(todoProject => {
  return {
    ...todoProject,
    tasks: (todoProject.tasks || []).filter(task => !task.completed)
  };
}).filter(todoProject => todoProject.tasks.length > 0); // 移除没有任务的项目

console.log(`\n目标数据统计:`);
console.log(`  会议: ${targetMeetings.length}个（过滤掉 ${sourceMeetings.length - targetMeetings.length} 个已完成）`);
console.log(`  项目: 进行中${targetProjects.inProgress.length}, 已交付${targetProjects.delivered.length}, 已验收${targetProjects.accepted.length}`);
console.log(`  待办: ${targetTodos.length}个项目`);

// 插入或更新目标日期的数据
const stmt = db.prepare(`
  INSERT OR REPLACE INTO work_journals
  (user_id, date, meetings, projects, todos, diary, last_modified)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const result = stmt.run(
  userId,
  targetDate,
  JSON.stringify(targetMeetings),
  JSON.stringify(targetProjects),
  JSON.stringify(targetTodos),
  '', // diary 清空
  new Date().toISOString()
);

console.log(`\n✅ 数据复制成功！`);
console.log(`受影响的行数: ${result.changes}`);

// 验证
const verifyRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = ?').get(targetDate, userId);
if (verifyRow) {
  const verifyMeetings = safeParse(verifyRow.meetings);
  const verifyProjects = safeParse(verifyRow.projects);
  const verifyTodos = safeParse(verifyRow.todos);

  console.log(`\n验证 ${targetDate} 数据:`);
  console.log(`  会议: ${verifyMeetings.length}个`);
  console.log(`  项目: 进行中${verifyProjects.inProgress?.length || 0}, 已交付${verifyProjects.delivered?.length || 0}, 已验收${verifyProjects.accepted?.length || 0}`);
  console.log(`  待办: ${verifyTodos.length}个`);
}

db.close();
console.log('\n✅ 完成！');
