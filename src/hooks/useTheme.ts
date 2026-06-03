import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'work_journal_theme';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light';
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeMode);
    // 同步 body 背景色，防止页面边缘出现白色
    document.body.style.backgroundColor = themeMode === 'dark' ? '#141414' : '#fff';
    // 写入 data-theme 属性，供 CSS 深色模式选择器使用（如热力图色阶）
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { themeMode, toggleTheme };
}
