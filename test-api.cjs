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

const targetDate = '2026-03-10';
const userId = 1;

console.log(`查询 ${targetDate} 的数据 (用户ID: ${userId})...`);

const row = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, targetDate);

if (!row) {
  console.log('❌ 数据库中没有数据！');
  db.close();
  process.exit(1);
}

console.log('\n✅ 找到数据！');
console.log('原始数据（前100字符）:');
console.log('  meetings:', row.meetings.substring(0, 100));
console.log('  projects:', row.projects.substring(0, 100));
console.log('  todos:', row.todos.substring(0, 100));

// 解析数据
const meetings = safeParse(row.meetings);
const projects = safeParse(row.projects);
const todos = safeParse(row.todos);

console.log('\n解析后的数据统计:');
console.log('  会议数量:', meetings.length);
console.log('  项目-进行中:', projects.inProgress?.length || 0);
console.log('  项目-已交付:', projects.delivered?.length || 0);
console.log('  项目-已验收:', projects.accepted?.length || 0);
console.log('  待办项目数:', todos.length);

// 打印项目详情
console.log('\n项目详情:');
if (projects.inProgress && projects.inProgress.length > 0) {
  console.log('  进行中的项目:');
  projects.inProgress.forEach((p, idx) => {
    console.log(`    ${idx + 1}. ${p.name || p.projectName || '未命名'}`);
  });
}
if (projects.delivered && projects.delivered.length > 0) {
  console.log('  已交付的项目:');
  projects.delivered.forEach((p, idx) => {
    console.log(`    ${idx + 1}. ${p.name || p.projectName || '未命名'}`);
  });
}
if (projects.accepted && projects.accepted.length > 0) {
  console.log('  已验收的项目:');
  projects.accepted.forEach((p, idx) => {
    console.log(`    ${idx + 1}. ${p.name || p.projectName || '未命名'}`);
  });
}

// 打印待办详情
console.log('\n待办项目详情:');
if (todos.length > 0) {
  todos.forEach((todo, idx) => {
    console.log(`  ${idx + 1}. ${todo.name} (${todo.tasks?.length || 0}个任务)`);
  });
}

db.close();
