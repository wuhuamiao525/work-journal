# 用户认证系统设置完成 ✅

## 🎉 已完成的功能

### 后端功能
- ✅ JWT Token 认证系统
- ✅ bcrypt 密码加密
- ✅ 用户表和数据隔离
- ✅ 认证中间件
- ✅ 用户登录/注册 API
- ✅ 日志API支持用户隔离

### 前端功能
- ✅ 登录页面（简洁风格）
- ✅ 认证服务（AuthService）
- ✅ 路由守卫
- ✅ 登出功能
- ✅ 用户信息显示
- ✅ API 请求自动携带 Token

## 🚀 快速开始

### 1. 初始化数据库（首次运行）
```bash
npm run init-admin
```

输出示例：
```
✅ 管理员账号创建成功！
   用户名: admin
   密码: admin123
   用户ID: 1
```

### 2. 启动后端服务
```bash
npm run server
```

### 3. 启动前端服务
```bash
npm run dev
```

### 4. 登录
- 访问: http://localhost:5173
- 用户名: `admin`
- 密码: `admin123`

## 📝 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin  | admin123 | 管理员 |

## 🔐 认证流程

1. **用户登录**
   - 前端发送用户名和密码到 `/api/auth/login`
   - 后端验证密码（bcrypt.compare）
   - 返回 JWT Token

2. **Token 存储**
   - Token 保存在 localStorage (`auth_token`)
   - 用户信息保存在 localStorage (`auth_user`)

3. **API 请求**
   - 所有 `/api/journals/*` 请求需要认证
   - 请求头携带: `Authorization: Bearer <token>`

4. **数据隔离**
   - 每个用户只能看到自己的数据
   - 通过 `user_id` 字段关联

## 🔧 创建新用户

### 方法1：使用 API
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "zhangsan",
    "password": "password123",
    "displayName": "张三"
  }'
```

### 方法2：修改初始化脚本
编辑 `server/init-admin.js`，修改默认用户信息。

## 📊 数据库结构

### 用户表 (users)
- id: 主键
- username: 用户名（唯一）
- password: 加密后的密码
- display_name: 显示名称
- created_at: 创建时间

### 日志表 (work_journals)
- id: 主键
- **user_id: 用户ID（外键）**
- date: 日期
- meetings, projects, todos, diary: JSON数据
- last_modified: 最后修改时间
- created_at: 创建时间
- **UNIQUE(user_id, date)**: 确保每个用户每天只有一条记录

## 🛡️ 安全特性

1. **密码加密**: bcrypt (rounds=10)
2. **Token 过期**: 7天自动过期
3. **数据隔离**: 用户数据完全分离
4. **API 保护**: 需要有效 Token
5. **SQL 注入防护**: 使用参数化查询

## 🐛 常见问题

### Q: 登录后提示"认证令牌无效"
**A**: Token 可能已过期，重新登录即可。

### Q: 如何重置管理员密码？
**A**: 删除数据库后重新运行 `npm run init-admin`
```bash
rm database/work-journal.db
npm run init-admin
```

### Q: 多个用户可以同时登录吗？
**A**: 可以，每个浏览器/设备都有独立的 Token。

### Q: 如何查看数据库内容？
**A**: 使用 SQLite 工具打开 `database/work-journal.db`
```bash
sqlite3 database/work-journal.db
SELECT * FROM users;
```

## 📂 新增文件列表

### 后端
- `server/middleware/auth.js` - JWT 认证中间件
- `server/routes/auth.js` - 认证 API 路由
- `server/init-admin.js` - 初始化管理员脚本

### 前端
- `src/auth/AuthService.ts` - 认证服务
- `src/auth/LoginPage.tsx` - 登录页面

### 修改文件
- `server/db.js` - 添加用户表和用户操作
- `server/routes/journal.js` - 添加认证中间件
- `server/index.js` - 添加认证路由
- `src/App.tsx` - 添加路由守卫
- `src/workJournal/index.tsx` - 添加登出功能
- `src/workJournal/services/api.ts` - 添加 Token 支持

## 🎯 下一步建议

1. **修改默认密码**: 首次登录后修改 admin 密码
2. **创建普通用户**: 为团队成员创建账号
3. **数据备份**: 定期备份 `database/work-journal.db`
4. **环境变量**: 生产环境使用环境变量设置 JWT_SECRET

## 📞 技术支持

如有问题，请检查：
1. 后端服务是否运行（http://localhost:3001/health）
2. 浏览器控制台错误信息
3. 服务器日志 `server.log`
