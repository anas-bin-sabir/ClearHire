'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

/** Switches the workspace between light and dim. The navy frame stays dark either way. */
export default function ThemeToggle({ className = 'btn-dark' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-icon ${className}`}
      aria-label={dark ? 'Use light workspace' : 'Use dark workspace'}
      title={dark ? 'Use light workspace' : 'Use dark workspace'}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </button>
  )
}
