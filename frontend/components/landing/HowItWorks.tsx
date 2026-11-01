const STEPS = [
  {
    title: 'Describe the project',
    body: 'Write a brief or fill in a form. ClearHire extracts the required skills, budget, deadline and team size, and shows you what it understood before anything is saved.',
  },
  {
    title: 'Shortlist and rank',
    body: 'Profiles are retrieved by meaning, not keywords, then scored on skill coverage, rate fit, rating and trust. The skill graph counts related skills, so React work can surface a Next.js specialist.',
  },
  {
    title: 'Explain with evidence',
    body: 'When an Anthropic key is configured, a model re-reads the top candidates against your brief. Each strength or risk it gives must cite a profile field or graph fact; claims without a valid citation are removed.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-4 bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <h2 className="max-w-xl text-[32px] font-bold leading-tight tracking-tight text-fg sm:text-[40px]">How a search works</h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-2">Three steps from a description to a ranked shortlist you can check.</p>
        <ol className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-fg pt-5">
              <p className="text-sm font-bold tabular-nums text-primary-ink">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-2 text-lg font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
