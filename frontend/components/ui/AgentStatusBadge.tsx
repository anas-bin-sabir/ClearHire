'use client'

import { useEffect, useState } from 'react'
import { api, AgentStatus } from '@/lib/api'
import { fmt } from '@/lib/utils'

interface Props {
  entityType: 'freelancer' | 'project'
  entityId: number
  pipeline: 'fraud_detection' | 'matching' | 'csp_team_builder'
}

export function AgentStatusBadge({ entityType, entityId, pipeline }: Props) {
  const [status, setStatus] = useState<AgentStatus | null>(null)

  useEffect(() => {
    let active = true
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      try {
        const s = await api.search.agentStatus(entityType, entityId)
        if (!active) return

        setStatus(s)
        if (!s.ran) {
          timeoutId = setTimeout(poll, 3000)   // keep polling until agent completes
        }
      } catch (err) {
        console.error('Failed to poll agent status:', err)
        if (active) {
          timeoutId = setTimeout(poll, 5000) // retry later on error
        }
      }
    }

    poll()

    return () => {
      active = false
      clearTimeout(timeoutId)
    }
  }, [entityType, entityId])

  const label = { 
    fraud_detection: 'Fraud Agent', 
    matching: 'Matching Agent', 
    csp_team_builder: 'CSP Agent' 
  }

  if (!status?.ran) {
    return (
      <span className="agent-badge pending">
        <span className="agent-dot" /> ⏳ {label[pipeline] ?? 'Agent'} running...
      </span>
    )
  }

  return (
    <span className="agent-badge">
      <span className="agent-dot" /> 🤖 {label[pipeline]} · {status.ran_at ? fmt.timeAgo(status.ran_at) : 'Just now'}
    </span>
  )
}
