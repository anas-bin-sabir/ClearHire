/** Example of a ranked result, built from the same parts as the search page. Not a real candidate. */
function ExampleResult() {
  const strengths = [
    { text: 'Has shipped FastAPI services in production', ref: 'f12.skills' },
    { text: 'Knows Kubernetes through Docker in the skill graph', ref: 'f12.graph:path:Kubernetes' },
    { text: 'Has worked with the same client before', ref: 'f12.graph:collab:31' },
  ]
  return (
    <figure className="rounded-panel bg-panel text-fg shadow-menu">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="truncate text-[13px] text-fg-2">“Backend engineer for an LLM claims service, under $90/hr”</p>
        <span className="shrink-0 rounded-chip bg-sunken px-2 py-0.5 text-xs font-semibold text-fg-2">Example</span>
      </div>
      <div className="grid grid-cols-[2.5rem_1fr] gap-x-3 px-5 py-5">
        <p className="text-[28px] font-bold leading-none tabular-nums text-fg-3" aria-label="Rank 1">01</p>
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="font-semibold">Candidate A</p>
              <p className="text-[13px] text-fg-2"><span className="tabular-nums">6 yrs</span> · <span className="tabular-nums">$75/hr</span></p>
            </div>
            <div className="w-full max-w-40 shrink-0 sm:w-28 sm:text-right">
              <p><span className="text-2xl font-bold leading-none tabular-nums">87</span> <span className="text-xs text-fg-2">match score</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                <div className="h-full w-[87%] rounded-full bg-teal" />
              </div>
            </div>
          </div>
          <div className="ai-rule mt-4 space-y-2">
            <p className="text-[13px] font-semibold text-teal-ink">Why this rank</p>
            <ul className="space-y-1.5">
              {strengths.map(s => (
                <li key={s.ref} className="text-[13px] leading-snug">
                  {s.text}{' '}
                  <code className="whitespace-nowrap rounded-[6px] bg-teal-tint px-1.5 py-0.5 font-mono text-[11px] text-teal-ink">{s.ref}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-line px-5 py-3 text-xs text-fg-2">
        Illustration of a search result. Every claim points at a field or graph fact it came from.
      </figcaption>
    </figure>
  )
}

export default function Hero() {
  return (
    <section className="bg-shell text-on-dark">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:pb-28 lg:pt-20">
        <div>
          <h1 className="max-w-xl text-[40px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
            Find the right people. Build the right team.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-on-dark-2">
            Describe the work in plain language. ClearHire ranks freelancers against it, shows the evidence behind every rank, and can assemble a whole team inside your budget.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/signup" className="btn btn-lg btn-primary">Get started</a>
            <a href="#how-it-works" className="btn btn-lg btn-dark">See how matching works</a>
          </div>
        </div>
        <ExampleResult />
      </div>
    </section>
  )
}
