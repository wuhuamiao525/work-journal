# 登录问题排查指南

## 快速解决方案

### 方案 1: 清除浏览器缓存

1. **打开浏览器开发者工具**: 按 `F12`
2. **打开Application标签** (Chrome) 或 **Storage标签** (Firefox)
3. **清除LocalStorage**:
   - 找到 `http://localhost:5173`
   - 删除所有 localStorage 项目
4. **硬刷新页面**: `Ctrl + Shift + R`

### 方案 2: 使用无痕模式

1. 打开浏览器的无痕/隐私窗口
2. 访问 `http://localhost:5173`
3. 尝试登录

### 方案 3: 手动清理并重启

```bash
# 1. 停止所有服务
pkill -f "node.*server"

# 2. 清除数据库(可选，会丢失所有数据)
rm -f database/work-journal.db

# 3. 重新初始化
npm run init-admin

# 4. 启动后端
npm run server
```

然后刷新浏览器页面。

## 详细排查步骤

### 1. 确认后端运行

```bash
# 测试健康检查
curl http://localhost:3001/health

# 应该返回:
# {"status":"ok","message":"Work Journal API is running"}
```

### 2. 测试登录API

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 应该返回 token
```

### 3. 检查浏览器控制台

1. 按 `F12` 打开开发者工具
2. 切换到 **Console** 标签
3. 查看是否有红色错误信息
4. 切换到 **Network** 标签
5. 点击登录按钮
6. 查看 `login` 请求的状态

常见错误:
- `CORS error`: 后端CORS配置问题
- `404 Not Found`: 后端未运行或路由错误
- `Failed to fetch`: 后端未运行

### 4. 检查端口占用

```bash
# Windows
netstat -ano | findstr :3001

# 应该看到LISTENING状态
```

## 常见问题

### Q: 显示"未提供认证令牌"
**A**: LocalStorage中有旧token，清除缓存即可。

### Q: 登录按钮点击没反应
**A**: 
1. 检查浏览器控制台错误
2. 确认后端正在运行
3. 检查Network标签是否有请求发出

### Q: 显示"用户名或密码错误"
**A**: 
1. 确认使用正确的默认账号:
   - 用户名: `admin`
   - 密码: `admin123`
2. 或重新初始化: `npm run init-admin`

### Q: 页面一直显示加载中
**A**: 可能是API请求超时，检查后端是否运行。

## 完全重置系统

如果以上方法都不行，执行完全重置:

```bash
# 1. 停止所有进程
pkill -f "node"

# 2. 删除数据库
rm -f database/work-journal.db

# 3. 清除node_modules (可选)
# rm -rf node_modules
# npm install

# 4. 重新初始化
npm run init-admin

# 5. 启动服务
npm run server
# 在另一个终端:
npm run dev
```

然后:
1. 在浏览器中按 `Ctrl + Shift + Delete`
2. 清除所有浏览器数据
3. 访问 `http://localhost:5173`
4. 使用 admin/admin123 登录

## 联系支持

如果问题仍然存在，请提供:
1. 浏览器控制台的错误截图
2. Network标签的请求详情
3. `server.log` 文件内容
