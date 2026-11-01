import { FileText, ListOrdered, Quote } from 'lucide-react'

const STEPS = [
  {
    icon: FileText,
    title: 'Describe the project',
    body: 'Write a brief or fill in a form. ClearHire extracts the skills, budget, deadline and team size, and shows you what it understood before anything is saved.',
  },
  {
    icon: ListOrdered,
    title: 'Shortlist and rank',
    body: 'Profiles are retrieved by meaning, not keywords, then scored on skill coverage, rate fit, rating and trust. Related skills in the graph count too.',
  },
  {
    icon: Quote,
    title: 'Explain with evidence',
    body: 'With an Anthropic key configured, a model re-reads the top candidates. Every strength or risk must cite a profile field or graph fact; uncited claims are removed.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-4 bg-panel">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <h2 className="text-[44px] text-fg sm:text-[56px]">How a search works</h2>
        <ol className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="notch flex h-full flex-col bg-shell p-6 text-on-dark [--notch-h:56px] [--notch-w:34%]">
                <span className="grid h-11 w-11 place-items-center rounded-field bg-primary text-on-primary">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display mt-6 text-[26px] leading-tight">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-on-dark-2">{s.body}</p>
              </div>
              <span aria-hidden className="font-display absolute right-3 top-0 flex h-14 items-center text-[40px] leading-none text-line-strong">
                {String(i + 1).padStart(2, '0')}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
