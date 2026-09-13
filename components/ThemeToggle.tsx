'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'menu-item' }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      setTheme('dark');
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
  };

  if (variant === 'menu-item') {
    return (
      <button type="button" className="mas-item" onClick={toggle}>
        {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        {theme === 'dark' ? 'Dark mode' : 'Light mode'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
