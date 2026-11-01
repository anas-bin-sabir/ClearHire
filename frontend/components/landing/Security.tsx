import { Quote } from 'lucide-react'

const PRINCIPLES = [
  { title: 'Scores come with their reasons', body: 'A match score is never shown alone. The skills that matched, the gaps and the cited evidence sit next to it.' },
  { title: 'Machine output is marked', body: 'Anything the AI produced, from extracted requirements to match reasoning, carries a lime rule and says where it came from.' },
  { title: 'Flags are signals, not verdicts', body: 'A fraud flag lists the signals that triggered it and waits for a person to clear or keep it.' },
  { title: 'It works without the model', body: 'If the language model is unavailable, search falls back to the deterministic ranking with the same reasons format.' },
]

export default function Security() {
  const [lead, ...rest] = PRINCIPLES
  return (
    <section id="security" className="scroll-mt-4 bg-shell text-on-dark">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex items-start justify-between gap-6">
          <h2 className="max-w-2xl text-[44px] sm:text-[56px]">Built to be checked, by the people who use it</h2>
          <Quote aria-hidden className="hidden h-20 w-20 shrink-0 rotate-180 fill-signal text-signal sm:block" />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <article className="relative">
            <div className="notch h-full overflow-hidden bg-shell-2 [--notch-w:28%]">
              <div className="bg-signal px-6 pb-5 pt-6">
                <h3 className="font-display pr-[30%] text-[24px] leading-tight text-fg">{lead.title}</h3>
              </div>
              <p className="px-6 py-5 text-[14px] leading-relaxed">{lead.body}</p>
            </div>
          </article>
          {rest.map(p => (
            <article key={p.title} className="relative">
              <div className="notch h-full bg-canvas p-6 text-fg [--notch-w:28%]">
                <h3 className="font-display pr-[30%] text-[24px] leading-tight">{p.title}</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-fg-2">{p.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
