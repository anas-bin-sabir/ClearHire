"use client";

import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Search, Users, ShieldAlert, Share2,
  FolderOpen, Settings, BarChart3, Database,
  ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { getSession, isAdmin } from "@/utils/clearhire-auth";

interface RouteItem  { href: string; label: string; icon: React.ComponentType<{ size: number; className?: string }>; }
interface RouteSection { section: string; items: RouteItem[]; adminOnly?: boolean; }

const ALL_ROUTES: RouteSection[] = [
  {
    section: "Intelligence",
    items: [
      { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
      { href: "/search",       label: "Talent Search",  icon: Search },
      { href: "/team-builder", label: "Team Builder",   icon: Users },
      { href: "/fraud",        label: "Fraud Lab",      icon: ShieldAlert },
      { href: "/graph",        label: "Skill Graph",    icon: Share2 },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/projects",  label: "Projects",  icon: FolderOpen },
      { href: "/settings",  label: "Settings",  icon: Settings },
    ],
  },
  {
    section: "Admin",
    adminOnly: true,
    items: [
      { href: "/analytics",     label: "Analytics",     icon: BarChart3 },
      { href: "/data-manager",  label: "Data Manager",  icon: Database },
    ],
  },
];

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const session = getSession();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 68 : 256 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex flex-col h-screen sticky top-0 bg-card-elevated overflow-hidden z-40 flex-shrink-0"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
            <Sparkles size={15} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="ml-3 min-w-0"
              >
                <span className="block font-semibold text-sm text-foreground tracking-tight">
                  ClearHire
                </span>
                <span className="block text-[10px] text-muted font-medium">
                  AI Hiring Intelligence
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-5">
          {ALL_ROUTES.map((section) => {
            if (section.adminOnly && !isAdmin(session)) return null;
            return (
              <div key={section.section}>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted/60"
                    >
                      {section.section}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="space-y-0.5">
                  {section.items.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        title={collapsed ? label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                          "transition-all duration-150 text-sm font-medium",
                          active
                            ? "bg-primary/12 text-primary"
                            : "text-muted hover:text-foreground hover:bg-background/40",
                        ].join(" ")}
                      >
                        <Icon size={17} className="flex-shrink-0" />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -4 }}
                              className="whitespace-nowrap"
                            >
                              {label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center h-12 flex-shrink-0 text-muted hover:text-foreground hover:bg-background/30 transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </motion.aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-card/95 flex items-center justify-around px-2 py-2"
        aria-label="Mobile navigation"
      >
        {ALL_ROUTES[0].items.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors",
                active ? "text-primary" : "text-muted",
              ].join(" ")}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
