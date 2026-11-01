'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  BarChart3,
  Briefcase,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import type { Role } from '@/lib/auth-users'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

const NAV: Record<Role, { area: string; items: NavItem[] }> = {
  client: {
    area: 'Client workspace',
    items: [
      { label: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard },
      { label: 'Post a project', href: '/client/projects/new', icon: PlusCircle },
      { label: 'Search & match', href: '/client/search', icon: Search },
      { label: 'Team builder', href: '/client/team-builder', icon: Users },
      { label: 'Contracts', href: '/client/contracts', icon: FileText },
    ],
  },
  freelancer: {
    area: 'Freelancer workspace',
    items: [
      { label: 'Dashboard', href: '/freelancer/dashboard', icon: LayoutDashboard },
      { label: 'Profile', href: '/freelancer/profile/edit', icon: UserCheck },
      { label: 'Trust score', href: '/freelancer/trust-score', icon: ShieldCheck },
      { label: 'Project matches', href: '/freelancer/matches', icon: Zap },
      { label: 'Contracts', href: '/freelancer/contracts', icon: FileText },
      { label: 'Skill graph', href: '/freelancer/skill-graph', icon: Network },
    ],
  },
  admin: {
    area: 'Admin console',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Fraud review', href: '/admin/fraud', icon: ShieldAlert },
      { label: 'Members', href: '/admin/members', icon: Users },
      { label: 'Projects', href: '/admin/projects', icon: Briefcase },
      { label: 'Knowledge graph', href: '/admin/graph', icon: Network },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { label: 'Data manager', href: '/admin/seed', icon: Database },
    ],
  },
}

const COLLAPSE_KEY = 'sidebar-minimized'
const collapseListeners = new Set<() => void>()

function subscribeCollapse(cb: () => void) {
  collapseListeners.add(cb)
  return () => collapseListeners.delete(cb)
}

/** Sidebar collapse preference, persisted under the same key the old sidebars used. */
function useCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    () => localStorage.getItem(COLLAPSE_KEY) === 'true',
    () => false,
  )
  const toggle = useCallback(() => {
    localStorage.setItem(COLLAPSE_KEY, String(!(localStorage.getItem(COLLAPSE_KEY) === 'true')))
    collapseListeners.forEach(l => l())
  }, [])
  return [collapsed, toggle]
}

function Brand({ area, compact }: { area: string; compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-control min-w-0" aria-label="ClearHire home">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-shell-2">
        <Image src="/clearhire-logo-rremoveBG.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[15px] font-bold tracking-tight text-on-dark">ClearHire</span>
          <span className="block truncate text-xs text-on-dark-2">{area}</span>
        </span>
      )}
    </Link>
  )
}

function NavList({
  items,
  compact,
  onNavigate,
}: {
  items: NavItem[]
  compact: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <ul className="space-y-1">
      {items.map(item => {
        const active = isActive(item.href)
        const Icon = item.icon
        return (
          <li key={item.href} className="group relative">
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              aria-label={compact ? item.label : undefined}
              className={`flex min-h-11 items-center rounded-control text-sm font-medium transition-colors duration-150 ${
                compact ? 'justify-center' : 'gap-3 px-3'
              } ${
                active
                  ? 'bg-primary text-on-dark'
                  : 'text-on-dark-2 hover:bg-shell-2/60 hover:text-on-dark'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!compact && <span className="truncate">{item.label}</span>}
            </Link>
            {compact && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-chip bg-panel px-2.5 py-1.5 text-xs font-semibold text-fg opacity-0 shadow-menu transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {item.label}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Account({ compact }: { compact: boolean }) {
  const { data: session } = useSession()
  const name = session?.user?.name ?? null
  const email = session?.user?.email ?? null

  return (
    <div className={`border-t border-line-dark pt-4 ${compact ? 'flex flex-col items-center gap-2' : ''}`}>
      {(name || email) && (
        <div className={`flex items-center gap-3 ${compact ? '' : 'mb-3 px-1'}`} title={compact ? [name, email].filter(Boolean).join(', ') : undefined}>
          <Avatar name={name ?? email ?? ''} tone="dark" />
          {!compact && (
            <div className="min-w-0">
              {name && <p className="truncate text-sm font-semibold text-on-dark">{name}</p>}
              {email && <p className="truncate text-xs text-on-dark-2">{email}</p>}
            </div>
          )}
        </div>
      )}
      <div className={`flex gap-2 ${compact ? 'flex-col' : ''}`}>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={`btn btn-dark ${compact ? 'btn-icon' : 'flex-1'}`}
          aria-label={compact ? 'Sign out' : undefined}
        >
          <LogOut aria-hidden />
          {!compact && 'Sign out'}
        </button>
        <ThemeToggle />
      </div>
    </div>
  )
}

export default function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const config = NAV[role]
  const [collapsed, toggleCollapsed] = useCollapsed()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const panel = drawerRef.current
    panel?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
      if (e.key === 'Tab' && panel) {
        const focusables = panel.querySelectorAll<HTMLElement>('a, button')
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [drawerOpen, closeDrawer])

  return (
    <div className="flex h-dvh flex-col bg-shell lg:flex-row lg:p-2.5">
      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between px-3 lg:hidden">
        <Brand area={config.area} />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="btn btn-icon btn-dark"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="mobile-nav"
        >
          <Menu aria-hidden />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-shell/70" onClick={closeDrawer} aria-hidden />
          <div
            ref={drawerRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-shell p-4"
            style={{ animation: 'rise 180ms ease-out' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <Brand area={config.area} />
              <button type="button" onClick={closeDrawer} className="btn btn-icon btn-dark" aria-label="Close navigation">
                <X aria-hidden />
              </button>
            </div>
            <nav aria-label="Primary" className="flex-1 overflow-y-auto">
              <NavList items={config.items} compact={false} onNavigate={() => setDrawerOpen(false)} />
            </nav>
            <Account compact={false} />
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside
        className={`hidden shrink-0 flex-col py-2 transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-16 px-1.5' : 'w-60 px-3'
        }`}
      >
        <div className={`mb-8 flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between'} pt-1`}>
          <Brand area={config.area} compact={collapsed} />
          <button
            type="button"
            onClick={toggleCollapsed}
            className="btn btn-icon btn-sm btn-ghost text-on-dark-2 hover:bg-shell-2 hover:text-on-dark"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </button>
        </div>
        <nav aria-label="Primary" className={`flex-1 ${collapsed ? '' : 'overflow-y-auto'}`}>
          <NavList items={config.items} compact={collapsed} />
        </nav>
        <Account compact={collapsed} />
      </aside>

      {/* Workspace */}
      <main
        id="main"
        className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-t-frame bg-canvas lg:rounded-frame"
      >
        {children}
      </main>
    </div>
  )
}
