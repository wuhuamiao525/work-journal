/**
 * 初始化管理员账号脚本
 * 运行: node server/init-admin.js
 */

const db = require('./db');

async function initAdmin() {
  try {
    // 初始化数据库
    db.initDatabase();

    // 创建默认管理员账号
    const username = 'admin';
    const password = 'admin123'; // 默认密码，首次登录后应修改
    const displayName = '管理员';

    console.log('正在创建管理员账号...');

    const userId = await db.createUser(username, password, displayName);

    console.log('✅ 管理员账号创建成功！');
    console.log(`   用户名: ${username}`);
    console.log(`   密码: ${password}`);
    console.log(`   用户ID: ${userId}`);
    console.log('');
    console.log('⚠️  请在首次登录后修改默认密码！');

    process.exit(0);
  } catch (error) {
    if (error.message === '用户名已存在') {
      console.log('ℹ️  管理员账号已存在，无需重复创建');
      process.exit(0);
    } else {
      console.error('❌ 创建管理员账号失败:', error.message);
      process.exit(1);
    }
  }
}

initAdmin();
