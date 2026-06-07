"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/app/ThemeContextHelper";
import { Moon, Sun } from "lucide-react";

export default function Navbar() {
  const { dark, setDark } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Features",     href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Security",     href: "#security" },
    { label: "Docs",         href: "#footer" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "dark:bg-navy-900/90 bg-white/80 backdrop-blur-xl shadow-lg shadow-black/5 border-b border-black/5 dark:border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <img
            src="/clearhire-logo-rremoveBG.png"
            alt="CH Logo"
            className="w-8 h-8 object-contain shrink-0"
          />
          <span className="font-bold text-lg tracking-tight dark:text-white">
            Clear<span className="gradient-text-electric">Hire</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-electric-400 dark:hover:text-electric-300 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(!dark)}
            aria-label="Toggle dark mode"
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
              dark ? "bg-electric-400" : "bg-slate-200"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                dark ? "translate-x-5" : "translate-x-0.5"
              } flex items-center justify-center text-[10px]`}
            >
              {dark ? <Moon className="h-3 w-3 text-electric-500" /> : <Sun className="h-3 w-3 text-amber-500" />}
            </span>
          </button>

          <a
            href="/login"
            className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-electric-400 transition-colors"
          >
            Login
          </a>

          <a
            href="/signup"
            className="px-4 py-2 text-sm font-semibold bg-mint-400 hover:bg-mint-500 text-navy-900 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-95"
          >
            Start Free →
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg dark:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <div className={`w-5 h-0.5 bg-current mb-1 transition-transform ${mobileOpen ? "rotate-45 translate-y-1.5" : ""}`} />
          <div className={`w-5 h-0.5 bg-current mb-1 transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
          <div className={`w-5 h-0.5 bg-current transition-transform ${mobileOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-navy-900 border-t border-black/5 dark:border-white/5 px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              {l.label}
            </a>
          ))}
          <a href="/login" className="text-sm font-medium text-slate-600 dark:text-slate-400">Login</a>
          <a href="/signup" className="px-4 py-2 text-sm font-semibold text-center bg-mint-400 text-navy-900 rounded-lg">
            Start Free →
          </a>
        </div>
      )}
    </nav>
  );
}
