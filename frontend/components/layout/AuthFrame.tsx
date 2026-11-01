import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const POINTS = [
  { title: 'Ranked with reasons', body: 'Every match score comes with the strengths, risks and graph evidence behind it.' },
  { title: 'Teams, not just people', body: 'The team builder covers the skills you need inside your budget, and shows who has worked together before.' },
  { title: 'Fraud is a signal', body: 'Risky profiles are flagged for review with the signals that triggered them.' },
]

/** Navy brand panel beside the form, the same frame the workspace uses. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-shell lg:flex-row lg:p-2.5">
      <aside className="flex shrink-0 flex-col px-5 py-4 text-on-dark lg:w-[min(36rem,44%)] lg:px-10 lg:py-10">
        <Link href="/" className="flex w-fit items-center gap-3 rounded-control" aria-label="ClearHire home">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-shell-2">
            <Image src="/clearhire-logo-rremoveBG.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">ClearHire</span>
        </Link>

        <div className="hidden flex-1 flex-col justify-center lg:flex">
          <p className="max-w-md text-[40px] font-bold leading-[1.08] tracking-tight">
            Find the right people. Build the right team.
          </p>
          <ul className="mt-10 max-w-md space-y-6">
            {POINTS.map(p => (
              <li key={p.title} className="border-l-2 border-teal pl-4">
                <p className="text-[15px] font-semibold">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-on-dark-2">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main id="main" className="relative flex flex-1 items-start justify-center rounded-t-frame bg-canvas px-5 pb-12 pt-16 sm:items-center sm:py-12 sm:px-8 lg:rounded-frame">
        <div className="absolute right-4 top-4">
          <ThemeToggle className="btn-ghost" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
