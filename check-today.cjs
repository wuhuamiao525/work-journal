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
const yesterday = '2026-03-09'; // 昨天周一
const lastWorkday = '2026-03-09'; // 上一个工作日就是昨天

console.log('========== 检查自动同步 ==========');
console.log(`今天: ${today} (周二)`);
console.log(`昨天: ${yesterday} (周一)`);
console.log(`上一个工作日: ${lastWorkday} (周一)`);

// 检查今天的数据
const todayRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = 1').get(today);

if (todayRow) {
  const meetings = safeParse(todayRow.meetings);
  const projects = safeParse(todayRow.projects);
  const todos = safeParse(todayRow.todos);

  console.log(`\n✅ ${today} 有数据:`);
  console.log(`  会议: ${meetings.length}个`);
  console.log(`  项目: 进行中${projects.inProgress?.length || 0}, 已交付${projects.delivered?.length || 0}, 已验收${projects.accepted?.length || 0}`);
  console.log(`  待办: ${todos.length}个`);
  console.log(`  最后修改时间: ${todayRow.last_modified}`);
  console.log(`  创建时间: ${todayRow.created_at || '未知'}`);

  // 判断是否是自动同步的数据
  const createdTime = new Date(todayRow.last_modified);
  const hour = createdTime.getHours();
  console.log(`\n  修改时间的小时: ${hour}点`);
  if (hour >= 0 && hour <= 6) {
    console.log(`  ⚠️ 可能是自动同步创建的数据（凌晨0-6点之间）`);
  }
} else {
  console.log(`\n❌ ${today} 没有数据`);
  console.log('  自动同步可能没有触发，或者上一个工作日没有数据');
}

// 检查昨天（上一个工作日）的数据
const lastRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = 1').get(yesterday);

if (lastRow) {
  const meetings = safeParse(lastRow.meetings);
  const projects = safeParse(lastRow.projects);
  const todos = safeParse(lastRow.todos);

  console.log(`\n${yesterday} 的数据（昨天，上一个工作日）:`);
  console.log(`  会议: ${meetings.length}个 (未完成: ${meetings.filter(m => !m.completed).length})`);
  console.log(`  项目: 进行中${projects.inProgress?.length || 0}, 已交付${projects.delivered?.length || 0}, 已验收${projects.accepted?.length || 0}`);
  console.log(`  待办: ${todos.length}个`);

  // 统计未完成的待办任务
  let uncompletedTaskCount = 0;
  todos.forEach(tp => {
    if (tp.tasks) {
      uncompletedTaskCount += tp.tasks.filter(t => !t.completed).length;
    }
  });
  console.log(`  未完成的待办任务: ${uncompletedTaskCount}个`);
} else {
  console.log(`\n${yesterday} 没有数据`);
}

db.close();
