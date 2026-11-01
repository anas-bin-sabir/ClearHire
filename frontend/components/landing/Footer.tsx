import Link from 'next/link'

const COLUMNS = [
  { title: 'Product', links: [{ label: 'How it works', href: '#how-it-works' }, { label: 'What it does', href: '#features' }, { label: 'Trust', href: '#security' }] },
  { title: 'Account', links: [{ label: 'Sign in', href: '/login' }, { label: 'Create an account', href: '/signup' }] },
]

export default function Footer() {
  return (
    <footer id="footer">
      <section className="bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-xl text-[48px] text-fg sm:text-[64px]">Post your first project today.</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-lg btn-primary">Get started</Link>
            <Link href="/login" className="btn btn-lg btn-secondary">Sign in</Link>
          </div>
        </div>
      </section>
      <div className="bg-canvas">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 pb-8 pt-16 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="max-w-sm text-[14px] leading-relaxed text-fg-2">Describe the work, get a ranked shortlist with evidence, and build a team inside your budget.</p>
            <p className="font-display mt-6 text-[64px] leading-[0.9] text-fg min-[400px]:text-[88px] sm:text-[120px]">ClearHire</p>
          </div>
          <nav aria-label="Footer" className="flex gap-16">
            {COLUMNS.map(c => (
              <div key={c.title}>
                <p className="text-[13px] font-semibold text-fg">{c.title}</p>
                <ul className="mt-3 space-y-2">
                  {c.links.map(l => (
                    <li key={l.href}><a href={l.href} className="text-[13px] text-fg-2 hover:text-fg">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <p className="border-t border-line pt-5 text-xs text-fg-2 md:col-span-2">Built with FastAPI, PostgreSQL with pgvector, Neo4j, Next.js and Gemini or Claude.</p>
        </div>
      </div>
    </footer>
  )
}
