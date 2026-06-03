"use client";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  ShieldAlert,
  Share2,
  FolderOpen,
  Settings,
  BarChart3,
  Database,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { getSession, isAdmin } from "@/utils/clearhire-auth";

interface RouteItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size: number }>;
}

interface RouteSection {
  section: string;
  items: RouteItem[];
  adminOnly?: boolean;
}

const ALL_ROUTES: RouteSection[] = [
  {
    section: "Intelligence",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/search", label: "Talent Search", icon: Search },
      { href: "/team-builder", label: "Team Builder", icon: Users },
      { href: "/fraud", label: "Fraud Lab", icon: ShieldAlert },
      { href: "/graph", label: "Skill Graph", icon: Share2 },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/projects", label: "Projects", icon: FolderOpen },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    section: "Admin",
    adminOnly: true,
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/data-manager", label: "Data Manager", icon: Database },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const session = getSession();

  const isActive = (href: string): boolean => pathname === href;

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden md:flex flex-col h-screen sticky top-0 border-r overflow-hidden z-40 flex-shrink-0"
        style={{
          background: "var(--bg-surface)",
          borderColor: `rgba(var(--border-base), 0.05)`,
        }}
      >
        <div
          className="flex items-center h-16 px-4 flex-shrink-0"
          style={{ borderBottom: `1px solid rgba(var(--border-base), 0.05)` }}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="ml-3 font-mono font-bold tracking-wider text-sm uppercase whitespace-nowrap"
                style={{ color: "var(--text-primary)" }}
              >
                ClearHire
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto scrollbar-none">
          {ALL_ROUTES.map((section) => {
            if (section.adminOnly && !isAdmin(session)) return null;
            return (
              <div key={section.section} className="mb-6">
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-4 mb-2"
                    >
                      <span
                        className="text-[9px] font-mono uppercase tracking-[0.2em]"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {section.section}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {section.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl mb-1 transition-all group relative"
                      style={
                        active
                          ? {
                              background: `rgba(var(--color-primary-rgb), 0.1)`,
                              color: "var(--color-primary)",
                              border: `1px solid rgba(var(--color-primary-rgb), 0.2)`,
                            }
                          : {
                              color: "var(--text-subtle)",
                              border: "1px solid transparent",
                            }
                      }
                      onMouseEnter={(e) => {
                        if (!active)
                          (e.currentTarget as HTMLAnchorElement).style.color =
                            "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          (e.currentTarget as HTMLAnchorElement).style.color =
                            "var(--text-subtle)";
                      }}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            transition={{ duration: 0.15 }}
                            className="text-xs font-medium whitespace-nowrap"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {active && (
                        <div
                          className="absolute right-2 w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--color-primary)" }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <button
          onClick={onToggle}
          className="flex items-center justify-center h-12 transition-colors flex-shrink-0"
          style={{
            borderTop: `1px solid rgba(var(--border-base), 0.05)`,
            color: "var(--text-subtle)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-secondary)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-subtle)")
          }
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </motion.aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl flex items-center justify-around px-2 py-2"
        style={{
          background: `rgba(var(--bg-surface-rgb), 0.95)`,
          borderTop: `1px solid rgba(var(--border-base), 0.05)`,
        }}
      >
        {ALL_ROUTES[0].items.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all"
              style={{ color: active ? "var(--color-primary)" : "var(--text-subtle)" }}
            >
              <Icon size={20} />
              <span className="text-[9px] font-mono uppercase tracking-wider">
                {label.split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
