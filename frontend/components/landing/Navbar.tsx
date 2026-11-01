import Image from 'next/image'
import Link from 'next/link'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'What it does', href: '#features' },
  { label: 'Trust', href: '#security' },
]

/** Sits on the navy hero; no theme toggle here because the landing page is a fixed composition. */
export default function Navbar() {
  return (
    <header className="bg-shell">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3 rounded-control" aria-label="ClearHire home">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-shell-2">
            <Image src="/clearhire-logo-rremoveBG.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-on-dark">ClearHire</span>
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} className="rounded-control px-3 py-2 text-sm font-medium text-on-dark-2 transition-colors duration-150 hover:text-on-dark">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-dark">Sign in</Link>
          <Link href="/signup" className="btn btn-primary hidden sm:inline-flex">Get started</Link>
        </div>
      </nav>
    </header>
  )
}
