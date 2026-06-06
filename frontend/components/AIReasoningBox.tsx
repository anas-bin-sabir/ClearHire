"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface AIReasoningBoxProps {
  text?: string;
  title?: string;
  speed?: number;
  confidence?: number;
  timestamp?: string;
  onDone?: () => void;
}

export default function AIReasoningBox({
  text = "",
  title = "AI Analysis",
  speed = 14,
  confidence,
  timestamp,
  onDone = () => {},
}: AIReasoningBoxProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const type = () => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current += 1;
        const char = text[indexRef.current - 1];
        const delay = /[.,!?;:]/.test(char) ? speed * 3 : speed;
        timerRef.current = setTimeout(type, delay);
      } else {
        setDone(true);
        onDone?.();
      }
    };

    timerRef.current = setTimeout(type, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, speed, onDone]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-xl bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card-elevated">
        <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="primary">AI</Badge>
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {confidence != null && (
              <span className="text-xs text-muted">{Math.round(confidence * 100)}% confidence</span>
            )}
          </div>
          {timestamp && <p className="text-xs text-muted mt-0.5">{timestamp}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy analysis"
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-background/40 transition-colors"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-background/40 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-4">
          <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
            {displayed}
            {!done && (
              <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle animate-pulse" />
            )}
          </p>
          {done && (
            <div className="mt-4 pt-3 border-t border-border/15 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-xs font-medium text-success">Analysis complete</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
