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

const today = '2026-03-10';
const yesterday = '2026-03-09';
const userId = 1;

console.log('========================================');
console.log('步骤1: 检查今天的数据');
console.log('========================================');

const todayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, today);

if (todayRow) {
  const meetings = safeParse(todayRow.meetings);
  const projects = safeParse(todayRow.projects);
  const todos = safeParse(todayRow.todos);

  console.log(`✅ 今天 ${today} 已有数据:`);
  console.log(`   会议: ${meetings.length}个`);
  console.log(`   项目: 进行中${projects.inProgress?.length || 0}, 已交付${projects.delivered?.length || 0}, 已验收${projects.accepted?.length || 0}`);
  console.log(`   待办: ${todos.length}个项目`);

  const hasRealData =
    meetings.length > 0 ||
    projects.inProgress?.length > 0 ||
    projects.delivered?.length > 0 ||
    projects.accepted?.length > 0 ||
    todos.length > 0;

  if (hasRealData) {
    console.log('\n✅ 数据正常！如果前端看不到，请尝试:');
    console.log('   1. 清除浏览器缓存（Ctrl+Shift+Delete）');
    console.log('   2. 硬刷新页面（Ctrl+F5）');
    console.log('   3. 重新登录');
    db.close();
    process.exit(0);
  } else {
    console.log('\n⚠️ 今天有数据但都是空的，需要重新复制');
    // 删除空数据
    db.prepare('DELETE FROM work_journals WHERE user_id = ? AND date = ?').run(userId, today);
    console.log('已删除空数据，准备重新复制...');
  }
} else {
  console.log(`❌ 今天 ${today} 没有数据，准备从昨天复制...`);
}

console.log('\n========================================');
console.log('步骤2: 从昨天复制数据到今天');
console.log('========================================');

// 获取昨天的数据
const yesterdayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, yesterday);

if (!yesterdayRow) {
  console.log(`❌ 昨天 ${yesterday} 也没有数据！无法复制`);
  db.close();
  process.exit(1);
}

// 解析昨天的数据
const sourceMeetings = safeParse(yesterdayRow.meetings);
const sourceProjects = safeParse(yesterdayRow.projects);
const sourceTodos = safeParse(yesterdayRow.todos);

console.log(`✅ 昨天 ${yesterday} 的数据:`);
console.log(`   会议: ${sourceMeetings.length}个 (未完成: ${sourceMeetings.filter(m => !m.completed).length})`);
console.log(`   项目: 进行中${sourceProjects.inProgress?.length || 0}, 已交付${sourceProjects.delivered?.length || 0}, 已验收${sourceProjects.accepted?.length || 0}`);
console.log(`   待办: ${sourceTodos.length}个项目`);

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

console.log(`\n准备复制到今天的数据:`);
console.log(`   会议: ${targetMeetings.length}个`);
console.log(`   项目: 进行中${targetProjects.inProgress.length}, 已交付${targetProjects.delivered.length}, 已验收${targetProjects.accepted.length}`);
console.log(`   待办: ${targetTodos.length}个项目`);

// 插入或替换今天的数据
const stmt = db.prepare(`
  INSERT OR REPLACE INTO work_journals
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

console.log('\n========================================');
console.log('✅ 数据复制完成！');
console.log('========================================');
console.log(`受影响的行数: ${result.changes}`);

// 验证
const verifyRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, today);
if (verifyRow) {
  const verifyMeetings = safeParse(verifyRow.meetings);
  const verifyProjects = safeParse(verifyRow.projects);
  const verifyTodos = safeParse(verifyRow.todos);

  console.log(`\n验证 ${today} 的数据:`);
  console.log(`   ✅ 会议: ${verifyMeetings.length}个`);
  console.log(`   ✅ 项目: 进行中${verifyProjects.inProgress?.length || 0}, 已交付${verifyProjects.delivered?.length || 0}, 已验收${verifyProjects.accepted?.length || 0}`);
  console.log(`   ✅ 待办: ${verifyTodos.length}个项目`);

  console.log('\n现在请:');
  console.log('   1. 重启后端服务器（停止并重新运行 npm run server）');
  console.log('   2. 清除浏览器缓存或硬刷新（Ctrl+F5）');
  console.log('   3. 如果还看不到，尝试重新登录');
}

db.close();
console.log('\n✅ 完成！');
