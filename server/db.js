/**
 * SQLite 数据库连接和初始化
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../database/work-journal.db');

// 创建数据库连接
const db = new Database(DB_PATH, { verbose: console.log });

// 初始化数据库表
function initDatabase() {
  try {
    // 检查 work_journals 表结构
    const tableInfo = db.prepare("PRAGMA table_info(work_journals)").all();
    const hasUserId = tableInfo.some(col => col.name === 'user_id');

    if (tableInfo.length > 0 && !hasUserId) {
      console.log('⚠️  旧表结构检测到，正在删除并重建表...');
      db.exec('DROP TABLE IF EXISTS work_journals');
    }
  } catch (error) {
    // 表不存在时忽略错误
  }

  // 创建用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建工作日志表（添加user_id字段）
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      meetings TEXT NOT NULL,
      projects TEXT NOT NULL,
      todos TEXT NOT NULL,
      diary TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, date)
    )
  `);

  console.log('✅ Database initialized successfully');
}

// ============ 用户相关操作 ============

// 创建用户
async function createUser(username, password, displayName = null) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const stmt = db.prepare(`
    INSERT INTO users (username, password, display_name)
    VALUES (?, ?, ?)
  `);

  try {
    const result = stmt.run(username, hashedPassword, displayName);
    return result.lastInsertRowid;
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('用户名已存在');
    }
    throw error;
  }
}

// 根据用户名查找用户
function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

// 根据ID查找用户
function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, display_name, created_at FROM users WHERE id = ?');
  return stmt.get(id);
}

// 验证用户密码
async function verifyPassword(username, password) {
  const user = getUserByUsername(username);
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  // 返回用户信息（不包含密码）
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    createdAt: user.created_at,
  };
}

// 获取所有用户
function getAllUsers() {
  const stmt = db.prepare('SELECT id, username, display_name, created_at FROM users');
  return stmt.all();
}

// ============ 工作日志相关操作 ============

// 获取指定用户和日期的工作日志
function getJournalByDate(userId, date) {
  // 确保userId是整数
  const userIdInt = parseInt(userId);
  const stmt = db.prepare('SELECT * FROM work_journals WHERE user_id = ? AND date = ?');
  const row = stmt.get(userIdInt, date);

  if (!row) {
    return null;
  }

  // 解析数据（可能需要双重解析，因为数据可能被双重序列化了）
  let meetings = JSON.parse(row.meetings);
  let projects = JSON.parse(row.projects);
  let todos = JSON.parse(row.todos);

  // 如果解析后还是字符串，再解析一次（处理双重序列化的历史数据）
  if (typeof meetings === 'string') {
    meetings = JSON.parse(meetings);
  }
  if (typeof projects === 'string') {
    projects = JSON.parse(projects);
  }
  if (typeof todos === 'string') {
    todos = JSON.parse(todos);
  }

  return {
    date: row.date,
    meetings: meetings,
    projects: projects,
    todos: todos,
    diary: row.diary,
    lastModified: row.last_modified,
  };
}

// 保存或更新工作日志
function saveJournal(userId, journalData) {
  // 自动修复已完成任务的completedAt字段
  const fixedTodos = (journalData.todos || []).map(todoProject => {
    const fixedTasks = (todoProject.tasks || []).map(task => {
      // 如果任务已完成但没有completedAt字段，补充完成时间
      if (task.completed && !task.completedAt) {
        // 获取昨天的日期时间
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split('T')[0];
        return {
          ...task,
          completedAt: `${yesterdayDate} 18:00:00`
        };
      }
      return task;
    });

    return {
      ...todoProject,
      tasks: fixedTasks
    };
  });

  const stmt = db.prepare(`
    INSERT INTO work_journals (user_id, date, meetings, projects, todos, diary, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      meetings = excluded.meetings,
      projects = excluded.projects,
      todos = excluded.todos,
      diary = excluded.diary,
      last_modified = excluded.last_modified
  `);

  const result = stmt.run(
    userId,
    journalData.date,
    JSON.stringify(journalData.meetings),
    JSON.stringify(journalData.projects),
    JSON.stringify(fixedTodos), // 使用修复后的todos
    journalData.diary,
    journalData.lastModified
  );

  return result.changes > 0;
}

// 获取指定用户的所有日期列表（倒序）
function getAllDates(userId) {
  const stmt = db.prepare('SELECT date FROM work_journals WHERE user_id = ? ORDER BY date DESC');
  const rows = stmt.all(userId);
  return rows.map(row => row.date);
}

// 删除指定用户和日期的工作日志
function deleteJournalByDate(userId, date) {
  const stmt = db.prepare('DELETE FROM work_journals WHERE user_id = ? AND date = ?');
  const result = stmt.run(userId, date);
  return result.changes > 0;
}

// 清空指定用户的所有数据
function clearAllJournals(userId) {
  const stmt = db.prepare('DELETE FROM work_journals WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes;
}

module.exports = {
  db,
  initDatabase,
  // 用户操作
  createUser,
  getUserByUsername,
  getUserById,
  verifyPassword,
  getAllUsers,
  // 日志操作
  getJournalByDate,
  saveJournal,
  getAllDates,
  deleteJournalByDate,
  clearAllJournals,
};
