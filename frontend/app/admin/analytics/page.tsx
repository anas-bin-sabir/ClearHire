'use client'

import { useEffect, useState } from 'react'
import { api, DayMetrics } from '@/lib/api'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState, Notice, Skeleton } from '@/components/ui/States'
import { BarChart3 } from 'lucide-react'

type MetricKey = 'searches' | 'teams' | 'fraud'

const METRICS: { key: MetricKey; title: string; help: string }[] = [
  { key: 'searches', title: 'Searches run', help: 'Client searches that returned ranked matches.' },
  { key: 'teams', title: 'Teams built', help: 'Team builder runs that produced a team.' },
  { key: 'fraud', title: 'Flagged for review', help: 'Profiles the fraud model flagged.' },
]

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-field border border-line bg-panel px-3 py-2 text-xs shadow-menu">
      <p className="text-base font-bold tabular-nums text-fg">{entry.value}</p>
      <p className="text-fg-2">{label}</p>
    </div>
  )
}

function MetricChart({ data, metric, total, days, dim }: { data: DayMetrics[]; metric: (typeof METRICS)[number]; total: number; days: number; dim: boolean }) {
  return (
    <section aria-labelledby={`m-${metric.key}`} className="rounded-panel border border-line-2 bg-panel p-5 shadow-card">
      <h2 id={`m-${metric.key}`} className="text-sm font-semibold text-fg">{metric.title}</h2>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-fg">{total.toLocaleString()}</p>
      <p className="text-xs text-fg-2">in the last {days} days. {metric.help}</p>
      <div className={`chart mt-4 h-44 transition-opacity duration-200 ${dim ? 'opacity-50' : ''}`} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={48} />
            <Tooltip content={ChartTooltip} cursor={{ className: 'chart-cursor' }} />
            <Line
              type="linear"
              dataKey={metric.key}
              name={metric.title}
              stroke="currentColor"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, className: 'chart-active-dot' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<DayMetrics[]>([])
  const [days, setDays] = useState<number>(7)
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const [totalSearches, setTotalSearches] = useState(0)
  const [totalTeams, setTotalTeams] = useState(0)
  const [totalFraud, setTotalFraud] = useState(0)

  const loadAnalytics = async (dVal: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.analytics(dVal)
      setData(res.data || [])
      setTotalSearches(res.total_searches || 0)
      setTotalTeams(res.total_teams || 0)
      setTotalFraud(res.total_fraud || 0)
      setLoading(false)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'Analytics couldn’t be loaded.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics(days)
  }, [days])

  const totals: Record<MetricKey, number> = { searches: totalSearches, teams: totalTeams, fraud: totalFraud }
  const firstLoad = loading && data.length === 0

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Daily platform activity: searches, team builds and fraud flags."
      />
      <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Time range"
            value={String(days)}
            onChange={v => setDays(Number(v))}
            options={[7, 14, 30].map(d => ({ value: String(d), label: `Last ${d} days` }))}
          />
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[{ value: 'chart', label: 'Charts' }, { value: 'table', label: 'Table' }]}
          />
          {loading && !firstLoad && <span role="status" className="text-xs text-fg-2">Updating…</span>}
        </div>

        {error && <Notice tone="danger">{error} Pick a range to try again.</Notice>}

        {firstLoad ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {METRICS.map(m => <Skeleton key={m.key} className="h-[300px] rounded-panel" />)}
          </div>
        ) : data.length === 0 ? (
          !error && <EmptyState icon={<BarChart3 aria-hidden />} title="No activity in this period" description="Searches, team builds and fraud flags appear here as they happen." />
        ) : view === 'chart' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {METRICS.map(m => (
              <MetricChart key={m.key} data={data} metric={m} total={totals[m.key]} days={days} dim={loading} />
            ))}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Daily activity, last {days} days</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    {METRICS.map(m => <th key={m.key} scope="col" className="text-right">{m.title}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => (
                    <tr key={row.label}>
                      <th scope="row" className="!bg-transparent text-left font-medium text-fg">{row.label}</th>
                      {METRICS.map(m => <td key={m.key} className="text-right tabular-nums text-fg">{row[m.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="text-left">Total</th>
                    {METRICS.map(m => <td key={m.key} className="border-t border-line text-right font-semibold tabular-nums text-fg">{totals[m.key]}</td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
