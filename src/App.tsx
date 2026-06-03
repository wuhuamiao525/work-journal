import { useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import WorkJournal from './workJournal';
import LoginPage from './auth/LoginPage';
import { AuthService } from './auth/AuthService';
import { useTheme } from './hooks/useTheme';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { themeMode, toggleTheme } = useTheme();

  useEffect(() => {
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
    return null;
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          borderRadiusLG: 12,
          fontFamily: "'PingFang SC', 'HarmonyOS Sans', -apple-system, 'Segoe UI', sans-serif",
        },
        components: {
          Card: {
            headerBg: 'transparent',
          },
          Collapse: {
            headerBg: 'transparent',
          },
          Table: {
            cellPaddingBlock: 10,
          },
        },
      }}
    >
      {!isAuthenticated ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <WorkJournal onLogout={handleLogout} themeMode={themeMode} onToggleTheme={toggleTheme} />
      )}
    </ConfigProvider>
  );
}

export default App;
