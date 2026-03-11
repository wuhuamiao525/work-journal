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

const today = new Date().toISOString().split('T')[0]; // 2026-03-11
const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0]; // 2026-03-10
const userId = 1;

console.log(`今天: ${today}`);
console.log(`昨天: ${yesterday}`);
console.log('========================================');

// 检查今天的数据
const todayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, today);

if (todayRow) {
  const meetings = safeParse(todayRow.meetings);
  const projects = safeParse(todayRow.projects);
  const todos = safeParse(todayRow.todos);

  console.log(`✅ ${today} 已有数据:`);
  console.log(`  会议: ${meetings.length}个`);
  console.log(`  项目: 进行中${projects.inProgress?.length || 0}, 已交付${projects.delivered?.length || 0}, 已验收${projects.accepted?.length || 0}`);
  console.log(`  待办: ${todos.length}个项目`);

  const hasData = meetings.length > 0 ||
    (projects.inProgress?.length || 0) > 0 ||
    (projects.delivered?.length || 0) > 0 ||
    (projects.accepted?.length || 0) > 0 ||
    todos.length > 0;

  if (hasData) {
    console.log('\n数据已存在，无需同步');
    db.close();
    process.exit(0);
  }

  console.log('\n数据为空，删除并重新同步...');
  db.prepare('DELETE FROM work_journals WHERE user_id = ? AND date = ?').run(userId, today);
}

console.log(`\n从 ${yesterday} 复制数据到 ${today}...`);

// 获取昨天的数据
const yesterdayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, yesterday);

if (!yesterdayRow) {
  console.log(`❌ ${yesterday} 没有数据！`);
  db.close();
  process.exit(1);
}

// 解析昨天的数据
const sourceMeetings = safeParse(yesterdayRow.meetings);
const sourceProjects = safeParse(yesterdayRow.projects);
const sourceTodos = safeParse(yesterdayRow.todos);

console.log(`\n${yesterday} 的数据:`);
console.log(`  会议: ${sourceMeetings.length}个 (未完成: ${sourceMeetings.filter(m => !m.completed).length})`);
console.log(`  项目: 进行中${sourceProjects.inProgress?.length || 0}, 已交付${sourceProjects.delivered?.length || 0}, 已验收${sourceProjects.accepted?.length || 0}`);
console.log(`  待办: ${sourceTodos.length}个项目`);

// 过滤数据
const targetMeetings = sourceMeetings.filter(m => !m.completed);
const targetProjects = {
  inProgress: sourceProjects.inProgress || [],
  delivered: sourceProjects.delivered || [],
  accepted: sourceProjects.accepted || []
};
const targetTodos = sourceTodos.map(todoProject => {
  return {
    ...todoProject,
    tasks: (todoProject.tasks || []).filter(task => !task.completed)
  };
}).filter(todoProject => todoProject.tasks.length > 0);

console.log(`\n准备复制:`);
console.log(`  会议: ${targetMeetings.length}个`);
console.log(`  项目: 进行中${targetProjects.inProgress.length}, 已交付${targetProjects.delivered.length}, 已验收${targetProjects.accepted.length}`);
console.log(`  待办: ${targetTodos.length}个项目`);

// 插入数据
const stmt = db.prepare(`
  INSERT INTO work_journals
  (user_id, date, meetings, projects, todos, diary, last_modified)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const result = stmt.run(
  userId,
  today,
  JSON.stringify(targetMeetings),
  JSON.stringify(targetProjects),
  JSON.stringify(targetTodos),
  '',
  new Date().toISOString()
);

console.log(`\n✅ 复制成功！受影响行数: ${result.changes}`);

// 验证
const verifyRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, today);
if (verifyRow) {
  const verifyMeetings = safeParse(verifyRow.meetings);
  const verifyProjects = safeParse(verifyRow.projects);
  const verifyTodos = safeParse(verifyRow.todos);

  console.log(`\n验证 ${today}:`);
  console.log(`  ✅ 会议: ${verifyMeetings.length}个`);
  console.log(`  ✅ 项目: 进行中${verifyProjects.inProgress?.length || 0}, 已交付${verifyProjects.delivered?.length || 0}, 已验收${verifyProjects.accepted?.length || 0}`);
  console.log(`  ✅ 待办: ${verifyTodos.length}个项目, ${verifyTodos.reduce((sum, tp) => sum + (tp.tasks?.length || 0), 0)}个任务`);
}

db.close();
console.log('\n请刷新浏览器页面（Ctrl+F5）');
