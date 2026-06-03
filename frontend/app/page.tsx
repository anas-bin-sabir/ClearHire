"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    router.replace(status === "authenticated" ? "/dashboard" : "/login");
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary"
          style={{ animation: "chpulse 1.5s ease-in-out infinite" }}
        />
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
          Initializing...
        </p>
      </div>
      <style>{`
        @keyframes chpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.92); }
        }
      `}</style>
    </div>
  );
}
