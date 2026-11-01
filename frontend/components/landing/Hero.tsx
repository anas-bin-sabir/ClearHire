/** Example of a ranked result, built from the same parts as the search page. Not a real candidate. */
function ExampleResult() {
  const strengths = [
    { text: 'Has shipped FastAPI services in production', ref: 'f12.skills' },
    { text: 'Knows Kubernetes through Docker in the skill graph', ref: 'f12.graph:path:Kubernetes' },
    { text: 'Has worked with the same client before', ref: 'f12.graph:collab:31' },
  ]
  return (
    <figure className="relative">
      <div className="notch bg-shell text-on-dark [--notch-w:30%]">
        <div className="px-5 pt-3.5 text-[13px] text-on-dark-2">
          <p className="truncate pr-[32%]">“Backend engineer for an LLM claims service, under $90/hr”</p>
        </div>
        <div className="grid grid-cols-[2.75rem_1fr] gap-x-3 px-5 pb-5 pt-6">
          <p className="font-display text-[34px] leading-none text-on-dark-2" aria-label="Rank 1">01</p>
          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-[22px] leading-tight">Candidate A</p>
                <p className="text-[13px] text-on-dark-2"><span className="tabular-nums">6 yrs</span>, <span className="tabular-nums">$75/hr</span></p>
              </div>
              <div className="w-full max-w-40 shrink-0 sm:w-28 sm:text-right">
                <p><span className="font-display text-[34px] leading-none tabular-nums text-primary">87</span> <span className="text-xs text-on-dark-2">match score</span></p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-shell-2" aria-hidden>
                  <div className="h-full w-[87%] rounded-full bg-primary" />
                </div>
              </div>
            </div>
            <div className="mt-4 border-l-4 border-primary pl-4">
              <p className="text-[13px] font-semibold text-primary">Why this rank</p>
              <ul className="mt-1.5 space-y-1.5">
                {strengths.map(s => (
                  <li key={s.ref} className="text-[13px] leading-snug">
                    {s.text}{' '}
                    <code className="whitespace-nowrap rounded-[6px] bg-shell-2 px-1.5 py-0.5 font-mono text-[11px] text-primary">{s.ref}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <figcaption className="border-t border-line-dark px-5 py-3 text-xs text-on-dark-2">
          Illustration of a search result. Every claim points at the field or graph fact it came from.
        </figcaption>
      </div>
      <span className="absolute right-0 top-0 flex h-11 w-[30%] items-center justify-center">
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">Example</span>
      </span>
    </figure>
  )
}

export default function Hero() {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8">
        <div className="grid grid-cols-1 items-end gap-10 rounded-frame bg-sunken p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)]">
          <div>
            <p className="max-w-md text-[15px] leading-relaxed text-fg-2">
              Describe the work in plain language. ClearHire ranks freelancers against it, shows the evidence behind every rank, and can assemble a whole team inside your budget.
            </p>
            <h1 className="mt-8 text-[56px] text-fg sm:text-[84px] lg:text-[96px]">
              Find the right people. Build the right team.
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/signup" className="btn btn-lg btn-primary">Get started</a>
              <a href="#how-it-works" className="btn btn-lg btn-secondary">See how matching works</a>
            </div>
          </div>
          <ExampleResult />
        </div>
      </div>
      <div className="bg-shell">
        <ul aria-label="Built with" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-10 gap-y-4 px-5 py-8 sm:px-8">
          {['FastAPI', 'PostgreSQL', 'pgvector', 'Neo4j', 'Gemini', 'Next.js'].map(t => (
            <li key={t} className="font-display text-[26px] leading-none text-on-dark-2">{t}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
