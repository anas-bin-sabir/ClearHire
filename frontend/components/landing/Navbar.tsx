import Image from 'next/image'
import Link from 'next/link'

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'What it does', href: '#features' },
  { label: 'Trust', href: '#security' },
]

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-canvas">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-full" aria-label="ClearHire home">
          <Image src="/clearhire-logo-rremoveBG.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          <span className="font-display text-[24px] leading-none text-fg sm:text-[28px]">ClearHire</span>
        </Link>
        <ul className="hidden items-center gap-1 rounded-full bg-shell p-1.5 md:flex">
          {LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} className="block rounded-full px-4 py-1.5 text-[13px] font-medium text-on-dark-2 transition-colors duration-150 hover:text-primary">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost hidden text-fg sm:inline-flex">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">Get started</Link>
        </div>
      </nav>
    </header>
  )
}
