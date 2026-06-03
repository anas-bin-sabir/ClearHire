"use client";
import { useState, useEffect, ReactNode } from "react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { setCachedSession } from "@/utils/clearhire-auth";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  department: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem("clearhire_sidebar");
    if (saved === "collapsed") setCollapsed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    const user = session.user as SessionUser;
    setCachedSession({
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      department: user.department,
    });
  }, [session, status, router]);

  const handleToggle = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("clearhire_sidebar", next ? "collapsed" : "open");
  };

  const authed = status === "authenticated" && !!session?.user;

  if (!mounted || !authed) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary animate-pulse" />
          <p className="text-[10px] font-mono text-[var(--text-subtle)] uppercase tracking-widest animate-pulse">
            Initializing Intelligence Systems...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar pageTitle={title} />

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 overflow-y-auto px-6 py-8 pb-24 md:pb-8"
        >
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              zIndex: 0,
            }}
          />
          <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
