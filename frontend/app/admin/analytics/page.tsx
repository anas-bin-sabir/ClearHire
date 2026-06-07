'use client'

import { useEffect, useState } from 'react'
import { api, TimeSeriesResponse, DayMetrics } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { 
  BarChart3, 
  Search, 
  Boxes, 
  ShieldAlert, 
  Calendar,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [data, setData] = useState<DayMetrics[]>([])
  const [days, setDays] = useState<number>(7)
  
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
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to retrieve time series analytics.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics(days)
  }, [days])

  // Custom tooltips styles
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg text-xs space-y-1 shadow-xl">
          <p className="font-bold text-white mb-1.5">{label}</p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex gap-4 items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <strong className="text-white font-mono">{entry.value}</strong>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-5.5 w-5.5 text-rose" /> Time Series Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-1">Review search match queries, constraint allocation builds, and risk alarms logged across nodes.</p>
        </div>

        {/* Toggle selectors */}
        <div className="flex bg-slate-950/40 p-1 border border-white/5 rounded-xl text-xs font-semibold shrink-0">
          {[7, 14, 30].map(val => (
            <button
              key={val}
              onClick={() => setDays(val)}
              className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                days === val 
                  ? 'bg-rose text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {val} Days
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Totals Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Total Search Runs"
          value={totalSearches}
          icon={Search}
          color="electric"
          description={`Logged search queries in last ${days}d`}
        />
        <StatCard 
          label="Total Team Builds"
          value={totalTeams}
          icon={Boxes}
          color="mint"
          description={`CSP generated allocations in last ${days}d`}
        />
        <StatCard 
          label="Total Risk Flags"
          value={totalFraud}
          icon={ShieldAlert}
          color="rose"
          description={`Bayesian alerts verified in last ${days}d`}
        />
      </div>

      {/* Recharts Area Chart */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-1.5 border-b border-white/5 pb-3">
          <Calendar className="h-4.5 w-4.5 text-rose" /> Activity Metrics Trend
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <div className="h-8 w-8 border-2 border-rose border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Calculating analytics timeline...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            No analytics data registered for this period.
          </div>
        ) : (
          <div className="h-[360px] w-full pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSearches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTeams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                
                <XAxis 
                  dataKey="label" 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                />
                
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 15 }} />

                <Area 
                  type="monotone" 
                  name="Searches Run"
                  dataKey="searches" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSearches)" 
                />
                <Area 
                  type="monotone" 
                  name="Teams Solved"
                  dataKey="teams" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTeams)" 
                />
                <Area 
                  type="monotone" 
                  name="Alarms Raised"
                  dataKey="fraud" 
                  stroke="#f43f5e" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorFraud)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
