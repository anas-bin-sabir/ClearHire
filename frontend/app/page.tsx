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
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500"
          style={{ animation: "chpulse 1.5s ease-in-out infinite" }}
        />
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
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
