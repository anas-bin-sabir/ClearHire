'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative h-10 w-10 rounded-xl bg-ink-3 hover:bg-ink-3/80 border border-white/10 dark:border-white/5 flex items-center justify-center text-foreground transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer z-50 shrink-0"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'dark' ? (
          <motion.div
            key="moon"
            initial={{ y: -20, opacity: 0, rotate: -45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 20, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex items-center justify-center"
          >
            <Moon className="h-5 w-5 text-amber" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ y: -20, opacity: 0, rotate: 45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 20, opacity: 0, rotate: -45 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex items-center justify-center"
          >
            <Sun className="h-5 w-5 text-amber" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
