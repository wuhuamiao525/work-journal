console.log('1. Loading express...');
const express = require('express');
const app = express();

console.log('2. Loading dependencies...');
const cors = require('cors');
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json());

console.log('3. Loading auth routes...');
try {
  const authRoutes = require('./server/routes/auth');
  console.log('✅ Auth routes loaded:', typeof authRoutes);
  
  console.log('4. Registering auth routes...');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes registered');
  
  console.log('5. Starting server...');
  app.listen(3001, () => {
    console.log('✅ Server started on port 3001');
  });
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
