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

// 从2026-03-06复制数据到2026-03-09
const sourceDate = '2026-03-06';
const targetDate = '2026-03-09';
const userId = 1;

console.log(`正在从 ${sourceDate} 复制交付项目和待办数据到 ${targetDate}...`);

// 获取源数据
const sourceRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = ?').get(sourceDate, userId);

if (!sourceRow) {
  console.log(`❌ ${sourceDate} 没有数据！`);
  db.close();
  process.exit(1);
}

// 解析源数据
const sourceProjects = safeParse(sourceRow.projects);
const sourceTodos = safeParse(sourceRow.todos);

console.log(`\n源数据统计（${sourceDate}）:`);
console.log(`  进行中项目: ${sourceProjects.inProgress?.length || 0}个`);
console.log(`  已交付项目: ${sourceProjects.delivered?.length || 0}个`);
console.log(`  已验收项目: ${sourceProjects.accepted?.length || 0}个`);
console.log(`  待办项目: ${sourceTodos.length}个`);

// 获取目标日期现有数据（如果有）
const targetRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = ?').get(targetDate, userId);

let targetMeetings = [];
let targetProjects = {
  inProgress: [],
  delivered: [],
  accepted: []
};
let targetTodos = [];

if (targetRow) {
  targetMeetings = safeParse(targetRow.meetings);
  targetProjects = safeParse(targetRow.projects);
  targetTodos = safeParse(targetRow.todos);
  console.log(`\n目标日期（${targetDate}）现有数据:`);
  console.log(`  会议: ${targetMeetings.length}个`);
  console.log(`  项目: 进行中${targetProjects.inProgress?.length || 0}, 已交付${targetProjects.delivered?.length || 0}, 已验收${targetProjects.accepted?.length || 0}`);
  console.log(`  待办: ${targetTodos.length}个`);
} else {
  console.log(`\n目标日期（${targetDate}）无数据，将创建新记录`);
}

// 复制所有项目类型（进行中、已交付、已验收）
const newInProgressProjects = sourceProjects.inProgress || [];
const newDeliveredProjects = sourceProjects.delivered || [];
const newAcceptedProjects = sourceProjects.accepted || [];

targetProjects.inProgress = [...(targetProjects.inProgress || []), ...newInProgressProjects];
targetProjects.delivered = [...(targetProjects.delivered || []), ...newDeliveredProjects];
targetProjects.accepted = [...(targetProjects.accepted || []), ...newAcceptedProjects];

// 复制待办项目，只保留未完成的任务
const newTodos = sourceTodos.map(todoProject => {
  return {
    ...todoProject,
    tasks: (todoProject.tasks || []).filter(task => !task.completed)
  };
}).filter(todoProject => todoProject.tasks.length > 0); // 移除没有未完成任务的项目

// 合并待办项目（去重，按项目名称）
const todoMap = new Map();

// 先添加目标日期的现有待办
targetTodos.forEach(todo => {
  todoMap.set(todo.name, todo);
});

// 再添加源日期的待办（会覆盖同名项目）
newTodos.forEach(todo => {
  if (todoMap.has(todo.name)) {
    // 如果已存在同名项目，合并任务
    const existing = todoMap.get(todo.name);
    const allTasks = [...existing.tasks, ...todo.tasks];
    // 去重任务（根据content）
    const taskMap = new Map();
    allTasks.forEach(task => {
      if (!taskMap.has(task.content) || !task.completed) {
        taskMap.set(task.content, task);
      }
    });
    existing.tasks = Array.from(taskMap.values());
  } else {
    todoMap.set(todo.name, todo);
  }
});

targetTodos = Array.from(todoMap.values());

console.log(`\n复制后统计:`);
console.log(`  进行中项目: ${targetProjects.inProgress.length}个（新增 ${newInProgressProjects.length} 个）`);
console.log(`  已交付项目: ${targetProjects.delivered.length}个（新增 ${newDeliveredProjects.length} 个）`);
console.log(`  已验收项目: ${targetProjects.accepted.length}个（新增 ${newAcceptedProjects.length} 个）`);
console.log(`  待办项目: ${targetTodos.length}个`);
console.log(`  待办任务总数: ${targetTodos.reduce((sum, tp) => sum + tp.tasks.length, 0)}个`);

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
  targetRow?.diary || '', // 保留原有日记
  new Date().toISOString()
);

console.log(`\n✅ 数据复制成功！`);
console.log(`受影响的行数: ${result.changes}`);

// 验证
const verifyRow = db.prepare('SELECT * FROM work_journals WHERE date = ? AND user_id = ?').get(targetDate, userId);
if (verifyRow) {
  const verifyProjects = safeParse(verifyRow.projects);
  const verifyTodos = safeParse(verifyRow.todos);

  console.log(`\n验证 ${targetDate} 数据:`);
  console.log(`  项目: 进行中${verifyProjects.inProgress?.length || 0}, 已交付${verifyProjects.delivered?.length || 0}, 已验收${verifyProjects.accepted?.length || 0}`);
  console.log(`  待办项目: ${verifyTodos.length}个`);
  console.log(`  待办任务数: ${verifyTodos.reduce((sum, tp) => sum + (tp.tasks?.length || 0), 0)}个`);
}

db.close();
console.log('\n✅ 完成！');
