# 每日工作日记系统

一个基于 React + Express + SQLite 的工作日志管理系统，支持会议安排、项目管理、待办事项和工作日记记录。

## 功能特性

- ✅ **用户认证系统**（JWT Token + bcrypt加密）
- ✅ **多用户支持**（每个用户独立的数据空间）
- ✅ 会议安排管理（支持日期时间选择）
- ✅ 项目人员安排
- ✅ 交付项目待办管理
- ✅ 工作日记记录
- ✅ 数据持久化到 SQLite 数据库
- ✅ 自动同步昨日未完成任务
- ✅ LocalStorage 备份机制

## 技术栈

### 前端
- React 18
- TypeScript
- Ant Design 5
- Dayjs
- Vite

### 后端
- Node.js
- Express
- Better-SQLite3
- JWT (jsonwebtoken)
- bcrypt (密码加密)
- CORS

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化管理员账号（首次运行）

```bash
npm run init-admin
```

这将创建默认管理员账号：
- **用户名**: admin
- **密码**: admin123

⚠️ **重要**：首次登录后请立即修改默认密码！

### 3. 启动后端服务器

```bash
npm run server
```

后端服务器将在 `http://localhost:3001` 启动

### 4. 启动前端开发服务器

在另一个终端窗口运行：

```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动

### 5. 同时启动前后端（Windows）

```bash
npm run dev:all
```

### 6. 访问应用

打开浏览器访问 `http://localhost:5173`，使用管理员账号登录。

## API 接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 创建新用户（管理员功能）
- `GET /api/auth/users` - 获取用户列表（管理员功能）

### 日志接口（需要认证）
- `GET /api/journals/:date` - 获取指定日期的工作日志
- `POST /api/journals` - 保存工作日志
- `GET /api/journals/dates/all` - 获取所有日期列表
- `DELETE /api/journals/:date` - 删除指定日期的工作日志

### 其他
- `GET /health` - 健康检查

## 数据存储

### 用户数据
- **用户信息**: 存储在 SQLite 数据库的 `users` 表
- **密码**: 使用 bcrypt 加密存储

### 工作日志
系统采用双重存储机制：
1. **主存储**：SQLite 数据库（`database/work-journal.db`）
   - 每个用户的数据完全隔离
   - 通过 `user_id` 字段关联到具体用户
2. **备份存储**：LocalStorage（前缀：`workJournal_backup_`）
   - 当 API 请求失败时自动降级
   - 用户切换后自动清理

## 安全性

- ✅ 密码使用 bcrypt 加密（bcrypt rounds: 10）
- ✅ JWT Token 认证（7天有效期）
- ✅ 用户数据完全隔离
- ✅ API 请求需要携带有效 Token
- ✅ Token 存储在 localStorage

## 用户管理

### 创建新用户

使用管理员账号登录后，可以通过API创建新用户：

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"password123","displayName":"新用户"}'
```

### 修改密码

目前需要通过数据库直接操作，或者重新创建用户。

## 数据库架构

### users 表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

### work_journals 表
```sql
CREATE TABLE work_journals (
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
```

## License

MIT
