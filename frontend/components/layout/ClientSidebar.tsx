'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { 
  LayoutDashboard, 
  PlusCircle, 
  Search, 
  Users, 
  FileText, 
  LogOut, 
  User as UserIcon,
  Sparkles
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

export default function ClientSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const navItems = [
    { label: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard },
    { label: 'Post a Job', href: '/client/projects/new', icon: PlusCircle },
    { label: 'Search & Match', href: '/client/search', icon: Search },
    { label: 'Team Builder', href: '/client/team-builder', icon: Users },
    { label: 'My Contracts', href: '/client/contracts', icon: FileText },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="w-64 bg-ink-2 border-r border-white/5 flex flex-col h-full text-slate-300">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-electric flex items-center justify-center text-white shadow-lg shadow-electric/25">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-white font-bold tracking-tight">ClearHire</h1>
          <span className="text-[10px] text-electric font-mono tracking-widest font-semibold uppercase">Client Hub</span>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map(item => {
          const Active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                Active 
                  ? 'bg-electric/10 text-white border-l-2 border-electric' 
                  : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 transition-colors ${Active ? 'text-electric' : 'text-slate-400 group-hover:text-white'}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User Session Profile & Signout */}
      <div className="p-4 border-t border-white/5 bg-ink/40">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-8 w-8 rounded-full bg-ink-3 border border-white/10 flex items-center justify-center text-slate-300">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{session?.user?.name || 'Sara Ahmed'}</p>
            <p className="text-[10px] text-slate-500 truncate">{session?.user?.email || 'client@demo.com'}</p>
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
    </aside>
  )
}
