const Database = require('better-sqlite3');
const db = new Database('./database/work-journal.db');

// 准备数据
const testData = {
  meetings: [
    { id: '1', title: '项目评审会', time: '10:00', isCompleted: false },
    { id: '2', title: '团队周会', time: '14:00', isCompleted: false }
  ],
  projects: {
    inProgress: [
      { id: '1', name: '用户管理系统', progress: 60 },
      { id: '2', name: '数据分析平台', progress: 30 }
    ],
    delivered: [
      { id: '3', name: '报表生成工具', deliveryDate: '2026-02-25' }
    ],
    accepted: []
  },
  todos: [
    {
      id: '1',
      name: '用户管理系统',
      tasks: [
        { id: '1-1', content: '完成API文档', completed: false, createdAt: '2026-02-27T10:00:00Z' },
        { id: '1-2', content: '编写单元测试', completed: false, createdAt: '2026-02-27T10:00:00Z' }
      ],
      createdAt: '2026-02-27T10:00:00Z'
    }
  ]
};

// 插入到多个日期
const dates = ['2026-02-27', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'];
const stmt = db.prepare(`
  INSERT OR REPLACE INTO work_journals
  (user_id, date, meetings, projects, todos, diary, last_modified)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

dates.forEach(date => {
  stmt.run(
    1,
    date,
    JSON.stringify(testData.meetings),
    JSON.stringify(testData.projects),
    JSON.stringify(testData.todos),
    '',
    new Date().toISOString()
  );
  console.log(`✅ 插入数据到 ${date}`);
});

console.log('\n验证插入结果:');
const verify = db.prepare('SELECT date, meetings FROM work_journals WHERE user_id = 1 ORDER BY date DESC');
const rows = verify.all();
rows.forEach(row => {
  const m = JSON.parse(row.meetings);
  console.log(`${row.date}: 会议${m.length}个`);
});

db.close();
