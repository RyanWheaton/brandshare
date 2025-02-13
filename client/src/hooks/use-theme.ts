import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        // Update localStorage and document class based on theme choice
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
          localStorage.setItem('theme', 'dark')
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark')
          localStorage.setItem('theme', 'light')
        } else {
          // For system preference
          localStorage.removeItem('theme')
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }
        set({ theme })
      },
    }),
    {
      name: 'theme-storage',
    }
  )
)