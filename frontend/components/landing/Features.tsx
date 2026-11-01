import { Network, ShieldCheck, Users } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    title: 'Team builder',
    body: 'A constraint solver finds a team that covers your skills within budget, shows who has already worked together, and tells you when no team fits.',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud review',
    body: 'A Bayesian model scores profiles from signals such as account age, unverified identity and rates out of line with experience. High scores go to an admin, never auto-rejected.',
  },
  {
    icon: Network,
    title: 'Skill graph',
    body: 'Freelancers, skills, projects and clients share one knowledge graph. Freelancers see related skills worth adding; admins see who has worked with whom.',
  },
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-4 bg-canvas">
      <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8 lg:py-24">
        <h2 className="text-center text-[44px] text-fg sm:text-[56px]">Beyond a single hire</h2>
        <ul className="mt-10 space-y-4">
          {FEATURES.map(f => (
            <li key={f.title} className="grid grid-cols-[3rem_1fr] items-center gap-x-5 gap-y-2 rounded-panel bg-shell p-3 pr-6 text-on-dark md:grid-cols-[3rem_14rem_1fr]">
              <span className="grid h-12 w-12 place-items-center rounded-field bg-primary text-on-primary">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-[24px] leading-none">{f.title}</h3>
              <p className="col-span-2 text-[14px] leading-relaxed text-on-dark-2 md:col-span-1 md:border-l md:border-line-dark md:pl-6">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
