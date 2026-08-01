"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/app/ThemeContextHelper";
import { Moon, Sun } from "lucide-react";

export default function Navbar() {
  const { dark, setDark } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on outside click, Escape, lock scroll, and trap focus while open
  useEffect(() => {
    if (!mobileOpen) return;

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];

    getFocusable()[0]?.focus();

    const onPointerDown = (e: MouseEvent) => {
      if (panel && !panel.contains(e.target as Node) && hamburgerRef.current !== e.target) {
        setMobileOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [mobileOpen]);

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
          ref={hamburgerRef}
          className="md:hidden p-2 rounded-lg dark:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
        >
          <div className={`w-5 h-0.5 bg-current mb-1 transition-transform ${mobileOpen ? "rotate-45 translate-y-1.5" : ""}`} />
          <div className={`w-5 h-0.5 bg-current mb-1 transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
          <div className={`w-5 h-0.5 bg-current transition-transform ${mobileOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
        </button>
      </div>

      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        className={`md:hidden fixed inset-0 top-16 bg-black/40 transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile slide-in panel */}
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`md:hidden fixed top-16 right-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-navy-900 border-l border-black/5 dark:border-white/5 shadow-xl px-6 py-6 flex flex-col gap-4 transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-electric-400 dark:hover:text-electric-300 transition-colors"
          >
            {l.label}
          </a>
        ))}
        <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
        <a
          href="/login"
          onClick={() => setMobileOpen(false)}
          className="text-sm font-medium text-slate-600 dark:text-slate-400"
        >
          Login
        </a>
        <a
          href="/signup"
          onClick={() => setMobileOpen(false)}
          className="px-4 py-2 text-sm font-semibold text-center bg-mint-400 hover:bg-mint-500 text-navy-900 rounded-lg transition-colors"
        >
          Start Free →
        </a>
      </div>
    </nav>
  );
}
