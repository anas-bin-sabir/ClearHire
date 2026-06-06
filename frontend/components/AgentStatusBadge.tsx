"use client";

type Pipeline = "fraud_detection" | "matching" | "csp_team_builder";

interface Props {
  pipeline: Pipeline;
  ranAt?: string;
  isRunning?: boolean;
  confidence?: string;
}

const PIPELINE_LABELS: Record<Pipeline, string> = {
  fraud_detection: "Fraud Agent",
  matching: "Matching Agent",
  csp_team_builder: "CSP Agent",
};

export function getTimeAgo(isoString: string): string {
  const s = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s} seconds ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function AgentStatusBadge({ pipeline, ranAt, isRunning = false, confidence }: Props) {
  const label = PIPELINE_LABELS[pipeline];

  if (isRunning) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-warning/30 bg-warning/10">
        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" aria-hidden />
        <span className="text-xs font-medium text-warning">⏳ {label} running…</span>
      </div>
    );
  }

  if (!ranAt) return null;

  return (
    <div className="inline-flex flex-col gap-1 px-3 py-2 rounded-lg border border-success/25 bg-success/5">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
        <span className="text-xs font-medium text-foreground">🤖 {label}</span>
      </div>
      <span className="text-xs text-muted pl-3.5">Last run {getTimeAgo(ranAt)}</span>
      {confidence && (
        <span className="text-xs text-muted pl-3.5">
          Confidence: <span className="text-success font-medium capitalize">{confidence}</span>
        </span>
      )}
    </div>
  );
}
