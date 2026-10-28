import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'repeet-theme';

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  void chrome.storage.local.set({ theme });
}

export function initTheme(): Theme {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
}

export function useTheme(): [Theme, () => void] {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === THEME_KEY &&
        (event.newValue === 'light' || event.newValue === 'dark')
      ) {
        setThemeState(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }, [theme]);

  return [theme, toggleTheme];
}
