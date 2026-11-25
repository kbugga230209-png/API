'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.setItem('bb-theme', next ? 'dark' : 'light');
    } catch {
      // storage may be blocked in private mode
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {mounted ? (dark ? '☀︎' : '☾') : '☾'}
    </button>
  );
}
