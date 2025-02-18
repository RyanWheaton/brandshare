import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from './use-auth'

interface ThemeStore {
  theme: 'light' | 'dark' | 'system' | 'brand'
  setTheme: (theme: 'light' | 'dark' | 'system' | 'brand') => void
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'brand');

        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          root.classList.add(systemTheme);
          localStorage.removeItem('theme');
        } else {
          root.classList.add(theme);
          localStorage.setItem('theme', theme);
        }

        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
    }
  )
)