'use client'

import { motion } from 'framer-motion'

const CIRCUMFERENCE = 220   // half-circle at r=70

interface Props {
  score: number
  confidence?: 'low' | 'medium' | 'high' | string | null
  size?: 'sm' | 'md' | 'lg'
}

export function FraudGauge({ score, confidence, size = 'md' }: Props) {
  const offset = CIRCUMFERENCE - CIRCUMFERENCE * Math.min(score, 1)
  const color = score > 0.65 ? '#F43F5E' : score > 0.35 ? '#F59E0B' : '#00D4A4'
  const dim = size === 'sm' ? 120 : size === 'lg' ? 200 : 160

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={dim} height={dim / 2 + 20} viewBox="0 0 160 90">
        {/* Track */}
        <path 
          d="M15,80 A65,65 0 0,1 145,80" 
          fill="none" 
          stroke="rgba(255, 255, 255, 0.08)" 
          strokeWidth="10" 
          strokeLinecap="round"
        />
        {/* Fill — animated */}
        <motion.path
          d="M15,80 A65,65 0 0,1 145,80"
          fill="none" 
          stroke={color} 
          strokeWidth="10" 
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Score text */}
        <text 
          x="80" 
          y="72" 
          textAnchor="middle" 
          fontSize="20" 
          fontWeight="700"
          fontFamily="ui-monospace, monospace" 
          fill="white"
        >
          {Math.round(score * 100)}%
        </text>
        <text 
          x="80" 
          y="86" 
          textAnchor="middle" 
          fontSize="9" 
          fill="#8892B0"
          letterSpacing="1" 
          fontFamily="ui-monospace, monospace"
        >
          FRAUD RISK
        </text>
      </svg>
      {confidence && (
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {confidence} confidence
        </span>
      )}
    </div>
  )
}
