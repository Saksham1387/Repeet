import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/theme';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const [theme, toggleTheme] = useTheme();

  return (
    <button
      type="button"
      className={className ? `theme-toggle ${className}` : 'theme-toggle'}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
};
