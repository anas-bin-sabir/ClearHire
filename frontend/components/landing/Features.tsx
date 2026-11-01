import { Network, ShieldCheck, Users } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    title: 'Team builder',
    body: 'Set a budget, team size, hours and the skills you need. A constraint solver searches for a team that covers the skills within budget, shows which members have already completed projects together, and tells you when no team fits.',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud review',
    body: 'A Bayesian model scores every profile from signals such as account age, unverified identity, low response rate and rates out of line with experience. High scores are flagged for an admin to review, never auto-rejected.',
  },
  {
    icon: Network,
    title: 'Skill graph',
    body: 'Freelancers, skills, projects and clients live in one knowledge graph. Freelancers see related skills worth adding; admins can explore who has worked with whom.',
  },
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-4 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:py-28">
        <div>
          <h2 className="text-[32px] font-bold leading-tight tracking-tight text-fg sm:text-[40px]">Beyond a single hire</h2>
          <p className="mt-4 text-base leading-relaxed text-fg-2">The same matching engine powers team assembly, trust checks and the graph behind them.</p>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {FEATURES.map(f => (
            <li key={f.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-7">
              <span className="grid h-10 w-10 place-items-center rounded-control bg-primary-tint text-primary-ink">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-fg">{f.title}</h3>
                <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-fg-2">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
