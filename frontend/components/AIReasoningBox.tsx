"use client";
import { useEffect, useState, useRef } from "react";
import { Cpu, Terminal } from "lucide-react";

interface AIReasoningBoxProps {
  text?: string;
  title?: string;
  speed?: number;
  onDone?: () => void;
}

export default function AIReasoningBox({
  text = "",
  title = "AI REASONING",
  speed = 18,
  onDone = () => {},
}: AIReasoningBoxProps) {
  const [displayed, setDisplayed] = useState<string>("");
  const [done, setDone] = useState<boolean>(false);
  const [cursor, setCursor] = useState<boolean>(true);
  const indexRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cursorRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const type = (): void => {
      if (indexRef.current < text.length) {
        const chunk = text.slice(0, indexRef.current + 1);
        setDisplayed(chunk);
        indexRef.current += 1;
        const char = text[indexRef.current - 1];
        const delay = /[.,!?;:]/.test(char) ? speed * 4 : speed;
        timerRef.current = setTimeout(type, delay);
      } else {
        setDone(true);
        onDone?.();
      }
    };

    timerRef.current = setTimeout(type, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, speed, onDone]);

  useEffect(() => {
    cursorRef.current = setInterval(() => setCursor((c) => !c), 530);
    return () => { if (cursorRef.current) clearInterval(cursorRef.current); };
  }, []);

  return (
    <div
      className="rounded-r-xl rounded-bl-xl p-5 font-mono"
      style={{
        background: `rgba(var(--bg-primary-rgb), 0.5)`,
        border: `1px solid rgba(var(--color-primary-rgb), 0.2)`,
        borderLeft: `3px solid var(--color-primary)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{
            background: `rgba(var(--color-primary-rgb), 0.1)`,
            border: `1px solid rgba(var(--color-primary-rgb), 0.2)`,
          }}
        >
          <Cpu
            size={11}
            style={{ color: "var(--color-primary)", animation: "aipulse 2s ease-in-out infinite" }}
          />
          <span
            className="text-[9px] font-mono uppercase tracking-[0.2em]"
            style={{ color: "var(--color-primary)" }}
          >
            {title}
          </span>
        </div>
        <Terminal size={13} className="ml-auto" style={{ color: "var(--text-subtle)" }} />
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(var(--color-danger-rgb),0.6)" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(var(--color-warning-rgb),0.6)" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(var(--color-success-rgb),0.6)" }} />
        </div>
      </div>

      {/* Typed content */}
      <div
        className="text-[12px] leading-[1.8] min-h-[3rem]"
        style={{ color: `rgba(var(--color-primary-rgb), 0.8)` }}
      >
        <span>{displayed}</span>
        {!done && (
          <span
            className="inline-block w-[2px] h-[14px] ml-0.5 align-middle"
            style={{
              background: "var(--color-primary)",
              opacity: cursor ? 1 : 0,
              transition: "opacity 0.1s",
            }}
          />
        )}
      </div>

      {done && (
        <div
          className="mt-3 pt-3 flex items-center gap-2"
          style={{ borderTop: `1px solid rgba(var(--border-base), 0.05)` }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-success)" }} />
          <span
            className="text-[9px] font-mono uppercase tracking-widest"
            style={{ color: "var(--color-success)" }}
          >
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
