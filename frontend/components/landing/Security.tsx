const PRINCIPLES = [
  { title: 'Scores come with their reasons', body: 'A match score is never shown alone. The skills that matched, the gaps and the cited evidence sit next to it.' },
  { title: 'Machine output is marked', body: 'Anything the AI produced, from extracted requirements to match reasoning, carries a teal rule and says where it came from.' },
  { title: 'Flags are signals, not verdicts', body: 'A fraud flag lists the signals that triggered it and waits for a person to clear or keep it.' },
  { title: 'It works without the model', body: 'If the language model is unavailable, search falls back to the deterministic ranking with the same reasons format.' },
]

export default function Security() {
  return (
    <section id="security" className="scroll-mt-4 bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <h2 className="max-w-xl text-[32px] font-bold leading-tight tracking-tight text-fg sm:text-[40px]">Built to be checked</h2>
        <dl className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
          {PRINCIPLES.map(p => (
            <div key={p.title} className="ai-rule">
              <dt className="text-lg font-semibold text-fg">{p.title}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-fg-2">{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
