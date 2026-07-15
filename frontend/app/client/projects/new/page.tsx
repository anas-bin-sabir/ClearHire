'use client'

import { useState } from 'react'
import { Briefcase, ListChecks, Sparkles } from 'lucide-react'
import { BriefProjectForm } from '@/components/projects/BriefProjectForm'
import { ManualProjectForm } from '@/components/projects/ManualProjectForm'

type Mode = 'brief' | 'manual'

export default function NewProjectPage() {
  const [mode, setMode] = useState<Mode>('brief')

  const tab = (value: Mode, label: string, Icon: typeof Sparkles) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
        mode === value
          ? 'bg-electric text-white border-electric'
          : 'bg-slate-900/60 text-slate-400 border-white/5 hover:border-white/10'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-electric" /> Post a Job
        </h2>
        <div role="tablist" className="flex gap-2">
          {tab('brief', 'Describe it', Sparkles)}
          {tab('manual', 'Fill a form', ListChecks)}
        </div>
      </div>
      {mode === 'brief' ? <BriefProjectForm /> : <ManualProjectForm />}
    </div>
  )
}
