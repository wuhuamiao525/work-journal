const Database = require('better-sqlite3');
const db = new Database('./database/work-journal.db');

// 查看2月28日的数据
const row = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = 1').get('2026-02-28');

if (row) {
  console.log('========== 2026-02-28 ==========');

  const meetings = JSON.parse(row.meetings);
  const projects = JSON.parse(row.projects);
  const todos = JSON.parse(row.todos);

  console.log(`\n会议数据类型: ${typeof meetings}, 是否是数组: ${Array.isArray(meetings)}`);
  console.log(`会议总数: ${meetings.length}`);
  console.log('meetings 原始值（前200字符）:', JSON.stringify(meetings).substring(0, 200));

  if (Array.isArray(meetings) && meetings.length > 0) {
    console.log('\n前3个会议:');
    meetings.slice(0, 3).forEach((m, i) => {
      console.log(`  ${i+1}. ${JSON.stringify(m, null, 2)}`);
    });
  }

  console.log(`\n项目数据类型: ${typeof projects}`);
  console.log('projects 原始值（前200字符）:', JSON.stringify(projects).substring(0, 200));

  if (typeof projects === 'object' && projects !== null) {
    console.log(`\n项目统计:`);
    console.log(`  进行中: ${projects.inProgress?.length || 0}个`);
    console.log(`  已交付: ${projects.delivered?.length || 0}个`);
    console.log(`  已验收: ${projects.accepted?.length || 0}个`);

    if (Array.isArray(projects.inProgress) && projects.inProgress.length > 0) {
      console.log('前3个进行中项目:');
      projects.inProgress.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i+1}. ${JSON.stringify(p, null, 2)}`);
      });
    }
  }

  console.log(`\n待办数据类型: ${typeof todos}, 是否是数组: ${Array.isArray(todos)}`);
  console.log('todos 原始值（前200字符）:', JSON.stringify(todos).substring(0, 200));

  if (Array.isArray(todos) && todos.length > 0) {
    console.log(`\n待办总数: ${todos.length}`);
    console.log('前2个待办:');
    todos.slice(0, 2).forEach((t, i) => {
      console.log(`  ${i+1}. ${JSON.stringify(t, null, 2)}`);
    });
  }
} else {
  console.log('2026-02-28: 无数据');
}

db.close();
