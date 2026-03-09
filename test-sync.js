/**
 * 测试自动同步逻辑
 */

const dayjs = require('dayjs');

// 模拟 shouldSync 逻辑
function testShouldSync() {
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const dayOfWeek = now.day();

  console.log('=== 测试同步条件 ===\n');
  console.log('当前时间:', now.format('YYYY-MM-DD HH:mm:ss'));
  console.log('今天:', today);
  console.log('星期:', dayOfWeek, '(0=周日, 1-5=工作日, 6=周六)');

  // 检查是否工作日
  const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
  console.log('\n1. 是否工作日:', isWorkday ? '✅ 是' : '❌ 否');

  if (!isWorkday) {
    console.log('\n❌ 不是工作日，不会触发同步');
    return false;
  }

  console.log('\n2. 今天是工作日，继续检查...');
  console.log('\n✅ 满足同步条件');

  return true;
}

testShouldSync();
