/**
 * 获取API认证Token的辅助脚本
 */

const axios = require('axios');

async function getToken() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    if (response.data.token) {
      console.log('✅ Token获取成功：');
      console.log(response.data.token);
      console.log('\n使用方法：');
      console.log('在请求头中添加: Authorization: Bearer ' + response.data.token);
      return response.data.token;
    }
  } catch (error) {
    console.error('❌ 获取Token失败:', error.response?.data || error.message);
  }
}

getToken();
