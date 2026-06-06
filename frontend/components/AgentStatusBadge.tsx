"use client"

type Pipeline = "fraud_detection" | "matching" | "csp_team_builder"

interface Props {
  pipeline: Pipeline
  ranAt?: string
  isRunning?: boolean
}

const PIPELINE_LABELS: Record<Pipeline, string> = {
  fraud_detection: "Fraud Agent",
  matching: "Matching Agent",
  csp_team_builder: "CSP Agent",
}

export function getTimeAgo(isoString: string): string {
  const s = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function AgentStatusBadge({ pipeline, ranAt, isRunning = false }: Props) {
  if (isRunning) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs animate-pulse"
        style={{
          background: "rgba(var(--color-warning-rgb), 0.1)",
          color: "var(--color-warning)",
          border: "1px solid rgba(var(--color-warning-rgb), 0.25)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-ping"
          style={{ background: "var(--color-warning)" }}
        />
        ⏳ Agent running…
      </span>
    )
  }

  if (!ranAt) return null

  const label = PIPELINE_LABELS[pipeline]
  const ago = getTimeAgo(ranAt)

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
      style={{
        background: "rgba(var(--color-success-rgb), 0.08)",
        color: "var(--text-muted)",
        border: "1px solid rgba(var(--color-success-rgb), 0.2)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: "var(--color-success)" }}
      />
      🤖 {label} · {ago}
    </span>
  )
}
