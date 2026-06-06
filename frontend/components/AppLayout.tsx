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
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("clearhire_sidebar", next ? "collapsed" : "open");
  };

  const authed = status === "authenticated" && !!session?.user;

  if (!mounted || !authed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 animate-pulse" />
          <p className="text-sm text-muted animate-pulse">Loading ClearHire…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background relative z-[1]">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar pageTitle={title} />

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 md:pb-8"
        >
          <div className="max-w-7xl mx-auto">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
