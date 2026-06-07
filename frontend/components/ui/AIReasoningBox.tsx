'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronDown } from 'lucide-react'

interface Props {
  explanation: string
  title?: string
  defaultOpen?: boolean
}

export function AIReasoningBox({ explanation, title = 'AI Reasoning', defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-indigo-500/10 hover:border-indigo-500/20 bg-indigo-500/3 rounded-xl overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white/90 cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <Sparkles className="h-4.5 w-4.5 text-electric animate-pulse" /> 
          {title}
        </span>
        <motion.div 
          animate={{ rotate: open ? 180 : 0 }} 
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed bg-slate-950/20 border-t border-white/3 pt-3">
              {explanation.split('\n').map((para, i) => (
                <p key={i} className={i > 0 ? 'mt-2.5' : ''}>
                  {para}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
