"use client";

import { useEffect, useRef } from "react";
import { fraudThresholds, fraudRiskLevel } from "@/lib/theme";

interface FraudGaugeProps {
  score?: number;
  size?: number;
  thickness?: number;
  showLabel?: boolean;
  animated?: boolean;
  confidence?: string;
}

export default function FraudGauge({
  score = 0,
  size = 160,
  thickness = 10,
  showLabel = true,
  animated = true,
  confidence,
}: FraudGaugeProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const pct = Math.round(score * 100);
  const level = fraudRiskLevel(pct);

  const strokeClass =
    level === "low" ? "stroke-success" : level === "medium" ? "stroke-warning" : "stroke-danger";
  const textClass =
    level === "low" ? "text-success" : level === "medium" ? "text-warning" : "text-danger";

  const riskLabel =
    level === "low" ? "Low risk" : level === "medium" ? "Moderate risk" : "High risk";
  const riskDesc =
    level === "low"
      ? "Within acceptable range"
      : level === "medium"
        ? "Review recommended"
        : "Immediate attention required";

  const r = (size - thickness * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference - (pct / 100) * circumference;

  useEffect(() => {
    if (!circleRef.current) return;
    if (!animated) {
      circleRef.current.style.strokeDashoffset = `${targetOffset}`;
      return;
    }
    circleRef.current.style.strokeDashoffset = `${circumference}`;
    const start = performance.now();
    const duration = 1000;

    const raf = requestAnimationFrame(function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = circumference - eased * (circumference - targetOffset);
      if (circleRef.current) circleRef.current.style.strokeDashoffset = `${current}`;
      if (t < 1) requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [score, circumference, targetOffset, animated]);

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center"
      role="img"
      aria-label={`Fraud risk score ${pct} percent, ${riskLabel}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-border/40"
            strokeWidth={thickness}
          />
          <circle
            ref={circleRef}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className={strokeClass}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            style={{ transition: "stroke 0.4s ease" }}
          />
        </svg>

        {showLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
            <span className={`font-bold leading-none ${textClass}`} style={{ fontSize: size * 0.2 }}>
              {pct}%
            </span>
            <span className={`text-xs font-medium ${textClass}`}>{riskLabel}</span>
            <span className="text-[10px] text-muted text-center px-2">{riskDesc}</span>
          </div>
        )}
      </div>

      {confidence && (
        <div className="mt-3 px-3 py-1 rounded-full text-xs font-medium bg-card border border-border text-muted">
          Confidence: <span className="text-foreground capitalize">{confidence}</span>
        </div>
      )}

      <div className="flex gap-3 mt-3 text-[10px] text-muted" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success" /> 0–{fraudThresholds.low}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-warning" /> {fraudThresholds.low + 1}–{fraudThresholds.medium}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-danger" /> {fraudThresholds.medium + 1}–100
        </span>
      </div>
    </div>
  );
}
