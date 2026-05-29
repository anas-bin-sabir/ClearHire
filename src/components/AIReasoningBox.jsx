"use client";
import { useEffect, useState, useRef } from "react";
import { Cpu, Terminal } from "lucide-react";

export default function AIReasoningBox({
  text = "",
  title = "AI REASONING",
  speed = 18,
  onDone,
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [cursor, setCursor] = useState(true);
  const indexRef = useRef(0);
  const timerRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const type = () => {
      if (indexRef.current < text.length) {
        const chunk = text.slice(0, indexRef.current + 1);
        setDisplayed(chunk);
        indexRef.current += 1;
        // Variable speed: faster on spaces/punctuation for natural feel
        const char = text[indexRef.current - 1];
        const delay = /[.,!?;:]/.test(char) ? speed * 4 : speed;
        timerRef.current = setTimeout(type, delay);
      } else {
        setDone(true);
        onDone?.();
      }
    };

    timerRef.current = setTimeout(type, 300);
    return () => clearTimeout(timerRef.current);
  }, [text, speed]);

  // Cursor blink
  useEffect(() => {
    cursorRef.current = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(cursorRef.current);
  }, []);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.5)",
        border: "1px solid rgba(0,212,255,0.2)",
        borderLeft: "3px solid #00D4FF",
      }}
      className="rounded-r-xl rounded-bl-xl p-5 font-mono"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20">
          <Cpu
            size={11}
            className="text-cyan-400"
            style={{ animation: "aipulse 2s ease-in-out infinite" }}
          />
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-400">
            {title}
          </span>
        </div>
        <Terminal size={13} className="text-slate-600 ml-auto" />
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
        </div>
      </div>

      {/* Typed content */}
      <div className="text-[12px] leading-[1.8] text-cyan-100/80 min-h-[3rem]">
        <span>{displayed}</span>
        {!done && (
          <span
            className="inline-block w-[2px] h-[14px] bg-cyan-400 ml-0.5 align-middle"
            style={{ opacity: cursor ? 1 : 0, transition: "opacity 0.1s" }}
          />
        )}
      </div>

      {done && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            Analysis complete
          </span>
        </div>
      )}

      <style>{`
        @keyframes aipulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
