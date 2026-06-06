"use client"

import { useEffect, useState, useCallback } from "react"

interface AgentStatus {
  ran: boolean
  pipeline?: string
  ran_at?: string
  triggered_by?: string
  metadata?: Record<string, unknown>
}

interface Props {
  entityType: "freelancer" | "project"
  entityId: number
  /** Poll until agent completes, then stop. Default: true */
  pollUntilComplete?: boolean
}

const PIPELINE_LABELS: Record<string, string> = {
  fraud_detection:  "Fraud Agent",
  matching:         "Matching Agent",
  csp_team_builder: "CSP Agent",
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function AgentStatusBadge({
  entityType,
  entityId,
  pollUntilComplete = true,
}: Props) {
  const [status, setStatus]     = useState<AgentStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [, setTick]             = useState(0)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/search/agent-status/${entityType}/${entityId}`
      )
      if (!res.ok) return
      const data: AgentStatus = await res.json()
      setStatus(data)
      return data.ran
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    if (!entityId) return

    let stopped = false
    let pollInterval: ReturnType<typeof setInterval>

    fetchStatus().then((ran) => {
      if (!ran && pollUntilComplete && !stopped) {
        pollInterval = setInterval(async () => {
          const done = await fetchStatus()
          if (done && pollInterval) {
            clearInterval(pollInterval)
          }
        }, 3000)
      }
    })

    const tickInterval = setInterval(() => setTick((t) => t + 1), 30_000)

    return () => {
      stopped = true
      clearInterval(pollInterval)
      clearInterval(tickInterval)
    }
  }, [entityType, entityId, fetchStatus, pollUntilComplete])

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
        Agent running…
      </span>
    )
  }

  if (!status?.ran) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        ⏳ Agent running…
      </span>
    )
  }

  const label = PIPELINE_LABELS[status.pipeline ?? ""] ?? "Agent"
  const ago   = status.ran_at ? timeAgo(status.ran_at) : "recently"

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
      text-xs bg-green-50 text-green-700 border border-green-200">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      🤖 {label} · {ago}
    </span>
  )
}
