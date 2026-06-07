'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { 
  LayoutDashboard, 
  UserCheck, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Network, 
  LogOut, 
  User as UserIcon,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export default function FreelancerSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-minimized') === 'true'
    }
    return false
  })

  const toggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev
      localStorage.setItem('sidebar-minimized', String(next))
      return next
    })
  }

  const navItems = [
    { label: 'Dashboard', href: '/freelancer/dashboard', icon: LayoutDashboard },
    { label: 'Edit Profile', href: '/freelancer/profile/edit', icon: UserCheck },
    { label: 'Trust Score', href: '/freelancer/trust-score', icon: ShieldCheck },
    { label: 'My Matches', href: '/freelancer/matches', icon: Zap },
    { label: 'My Contracts', href: '/freelancer/contracts', icon: FileText },
    { label: 'Skill Graph', href: '/freelancer/skill-graph', icon: Network },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className={`bg-ink-2 border-r border-white/5 flex flex-col h-full text-slate-300 relative transition-all duration-300 ease-in-out shrink-0 ${isMinimized ? 'w-20' : 'w-64'}`}>
      
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleMinimize}
        className="absolute top-10 -right-3 h-6 w-6 rounded-full border border-white/10 dark:border-white/5 bg-ink-3 hover:bg-ink-3/80 flex items-center justify-center cursor-pointer shadow-md text-foreground z-40 transition-all duration-200 hover:scale-105"
        aria-label="Toggle sidebar collapse"
      >
        {isMinimized ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* macOS dots */}
      <div className={`flex gap-1.5 px-6 pt-4 pb-2 ${isMinimized ? 'justify-center' : 'justify-start'}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-rose/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint/80" />
      </div>

      {/* Brand Header */}
      <div className={`pt-2 pb-5 border-b border-white/5 flex items-center gap-3 ${isMinimized ? 'justify-center px-4' : 'px-6'}`}>
        <img
          src="/clearhire-logo-rremoveBG.png"
          alt="ClearHire Logo"
          className="h-9 w-9 object-contain shrink-0"
        />
        {!isMinimized && (
          <div className="min-w-0">
            <h1 className="text-white font-bold tracking-tight truncate">ClearHire</h1>
            <span className="text-[10px] text-mint font-mono tracking-widest font-semibold uppercase block truncate">Freelancer Portal</span>
          </div>
        )}
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map(item => {
          const Active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                isMinimized 
                  ? 'justify-center p-3' 
                  : 'gap-3 px-4 py-3'
              } ${
                Active 
                  ? 'bg-mint/10 text-white border-l-2 border-mint' 
                  : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 transition-colors shrink-0 ${Active ? 'text-mint' : 'text-slate-400 group-hover:text-white'}`} />
              {!isMinimized && <span>{item.label}</span>}
              {isMinimized && (
                <span className="sidebar-tooltip group-hover:scale-100">
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Session Profile & Signout */}
      {isMinimized ? (
        <div className="p-4 border-t border-white/5 bg-ink/40 flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="h-9 w-9 rounded-full bg-ink-3 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer">
              <UserIcon className="h-4.5 w-4.5" />
            </div>
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-ink-2" />
            <span className="sidebar-tooltip group-hover:scale-100">
              {session?.user?.name || 'Freelancer'} ({session?.user?.email || 'freelancer@demo.com'})
            </span>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <ThemeToggle />
            <div className="relative group">
              <button 
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="btn btn-sm btn-ghost h-10 w-10 p-0 rounded-xl flex items-center justify-center cursor-pointer"
                aria-label="Sign Out"
              >
                <LogOut className="h-4.5 w-4.5 text-rose" />
              </button>
              <span className="sidebar-tooltip group-hover:scale-100">
                Sign Out
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-white/5 bg-ink/40">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-ink-3 border border-white/10 flex items-center justify-center text-slate-300">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{session?.user?.name || 'Ali Raza'}</p>
              <p className="text-[10px] text-slate-500 truncate">{session?.user?.email || 'freelancer@demo.com'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex-1 btn btn-sm btn-ghost flex items-center justify-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
            <ThemeToggle />
          </div>
        </div>
      )}
    </aside>
  )
}
