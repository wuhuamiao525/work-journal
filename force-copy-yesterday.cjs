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
console.log(`强制从 ${yesterday} 复制数据到 ${today}`);
console.log('========================================');

// 获取昨天的数据
const yesterdayRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, yesterday);

if (!yesterdayRow) {
  console.log(`❌ 错误：${yesterday} 没有数据！`);
  db.close();
  process.exit(1);
}

// 解析昨天的数据
const sourceMeetings = safeParse(yesterdayRow.meetings);
const sourceProjects = safeParse(yesterdayRow.projects);
const sourceTodos = safeParse(yesterdayRow.todos);

console.log(`\n源数据（${yesterday}）:`);
console.log(`  会议: ${sourceMeetings.length}个`);
console.log(`    - 未完成: ${sourceMeetings.filter(m => !m.completed).length}个`);
console.log(`  项目:`);
console.log(`    - 进行中: ${sourceProjects.inProgress?.length || 0}个`);
console.log(`    - 已交付: ${sourceProjects.delivered?.length || 0}个`);
console.log(`    - 已验收: ${sourceProjects.accepted?.length || 0}个`);
console.log(`  待办: ${sourceTodos.length}个项目`);

// 统计待办任务
let totalTasks = 0;
let uncompletedTasks = 0;
sourceTodos.forEach(tp => {
  if (tp.tasks) {
    totalTasks += tp.tasks.length;
    uncompletedTasks += tp.tasks.filter(t => !t.completed).length;
  }
});
console.log(`    - 总任务数: ${totalTasks}个`);
console.log(`    - 未完成任务: ${uncompletedTasks}个`);

// 过滤并复制数据
console.log('\n========================================');
console.log('开始复制...');
console.log('========================================');

// 1. 只复制未完成的会议
const targetMeetings = sourceMeetings.filter(m => !m.completed);
console.log(`\n1. 会议: 复制 ${targetMeetings.length} 个未完成的会议`);

// 2. 复制所有项目
const targetProjects = {
  inProgress: sourceProjects.inProgress || [],
  delivered: sourceProjects.delivered || [],
  accepted: sourceProjects.accepted || []
};
console.log(`2. 项目:`);
console.log(`   - 进行中: ${targetProjects.inProgress.length}个`);
console.log(`   - 已交付: ${targetProjects.delivered.length}个`);
console.log(`   - 已验收: ${targetProjects.accepted.length}个`);

// 打印项目详情
if (targetProjects.inProgress.length > 0) {
  console.log('   进行中项目详情:');
  targetProjects.inProgress.forEach((p, i) => {
    console.log(`     ${i+1}. ${p.name || p.projectName || '未命名'}`);
  });
}
if (targetProjects.delivered.length > 0) {
  console.log('   已交付项目详情:');
  targetProjects.delivered.forEach((p, i) => {
    console.log(`     ${i+1}. ${p.name || p.projectName || '未命名'}`);
  });
}
if (targetProjects.accepted.length > 0) {
  console.log('   已验收项目详情:');
  targetProjects.accepted.forEach((p, i) => {
    console.log(`     ${i+1}. ${p.name || p.projectName || '未命名'}`);
  });
}

// 3. 复制待办，只保留未完成的任务
const targetTodos = sourceTodos.map(todoProject => {
  const uncompletedTasks = (todoProject.tasks || []).filter(task => !task.completed);
  return {
    ...todoProject,
    tasks: uncompletedTasks
  };
}).filter(todoProject => todoProject.tasks.length > 0);

console.log(`3. 待办: 复制 ${targetTodos.length} 个有未完成任务的项目`);
targetTodos.forEach((tp, i) => {
  console.log(`   ${i+1}. ${tp.name}: ${tp.tasks.length}个未完成任务`);
});

// 删除今天的旧数据（如果存在）
console.log(`\n删除 ${today} 的旧数据...`);
const deleteResult = db.prepare('DELETE FROM work_journals WHERE user_id = ? AND date = ?').run(userId, today);
console.log(`  删除了 ${deleteResult.changes} 条记录`);

// 插入新数据
console.log(`\n插入新数据到 ${today}...`);
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

console.log(`  插入成功，受影响行数: ${result.changes}`);

// 验证
console.log('\n========================================');
console.log('验证数据');
console.log('========================================');

const verifyRow = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?').get(userId, today);
if (verifyRow) {
  const verifyMeetings = safeParse(verifyRow.meetings);
  const verifyProjects = safeParse(verifyRow.projects);
  const verifyTodos = safeParse(verifyRow.todos);

  console.log(`\n${today} 的数据:`);
  console.log(`  ✅ 会议: ${verifyMeetings.length}个`);
  console.log(`  ✅ 项目:`);
  console.log(`     - 进行中: ${verifyProjects.inProgress?.length || 0}个`);
  console.log(`     - 已交付: ${verifyProjects.delivered?.length || 0}个`);
  console.log(`     - 已验收: ${verifyProjects.accepted?.length || 0}个`);
  console.log(`  ✅ 待办: ${verifyTodos.length}个项目`);

  const verifyTaskCount = verifyTodos.reduce((sum, tp) => sum + (tp.tasks?.length || 0), 0);
  console.log(`     - 总任务数: ${verifyTaskCount}个`);

  if (verifyProjects.inProgress?.length > 0 || verifyProjects.delivered?.length > 0 || verifyProjects.accepted?.length > 0) {
    console.log('\n✅ 数据复制成功！');
  } else {
    console.log('\n⚠️ 警告：项目数据为空！');
  }
} else {
  console.log('\n❌ 错误：验证失败，未找到数据');
}

db.close();

console.log('\n========================================');
console.log('下一步操作:');
console.log('========================================');
console.log('1. 停止后端服务器（Ctrl+C）');
console.log('2. 重新启动后端服务器: npm run server');
console.log('3. 刷新浏览器页面（Ctrl+F5）');
console.log('========================================');
