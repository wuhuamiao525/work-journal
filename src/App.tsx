import React, { useState, useEffect } from 'react';
import WorkJournal from './workJournal';
import LoginPage from './auth/LoginPage';
import { AuthService } from './auth/AuthService';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查是否已登录
    const authenticated = AuthService.isAuthenticated();
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return null; // 或者显示一个加载指示器
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <WorkJournal onLogout={handleLogout} />
    </div>
  );
}

export default App;
