"use client";
import { useState } from "react";
import {
  Home,
  Search,
  Users,
  ShieldAlert,
  Share2,
  Menu,
  X,
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ size: number }>;
}

const links: NavLink[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/team-builder", label: "Team Builder", icon: Users },
  { href: "/fraud", label: "Fraud Lab", icon: ShieldAlert },
  { href: "/graph", label: "Skill Graph", icon: Share2 },
];

export default function Nav() {
  const [open, setOpen] = useState<boolean>(false);
  const current =
    typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D14]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-black font-bold text-sm font-mono">
            C
          </div>
          <span className="font-mono font-bold text-white tracking-wider text-sm uppercase">
            ClearHire
          </span>
        </a>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = current === href;
            return (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-widest transition-all ${
                  active
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon size={14} />
                {label}
              </a>
            );
          })}
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden px-6 pb-4 space-y-1 border-t border-white/5">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Icon size={14} />
              {label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
