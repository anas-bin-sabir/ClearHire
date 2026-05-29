"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Shield,
  Users,
  Layers,
  Network,
  RefreshCw,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FraudGauge from "@/components/FraudGauge";
import { getGraph, mapGraphForUi } from "@/lib/api";

const EMPTY_GRAPH = { nodes: [], edges: [] };

const NODE_CFG = {
  freelancer: { color: "#00D4FF", size: 14, shape: "circle" },
  skill: { color: "#7C3AED", size: 11, shape: "hex" },
  project: { color: "#F97316", size: 13, shape: "square" },
};

const EDGE_CFG = {
  HAS_SKILL: { color: "rgba(0,212,255,0.3)", dash: "" },
  RELATED_TO: { color: "rgba(124,58,237,0.4)", dash: "4,4" },
  WORKED_ON: { color: "rgba(249,115,22,0.35)", dash: "6,3" },
  REFERRED_BY: { color: "rgba(239,68,68,0.35)", dash: "2,6" },
};

// Simple force simulation
function useForce(nodes, edges, width, height) {
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!width || !height) return;
    const cx = width / 2,
      cy = height / 2;
    // init positions in a circle
    if (!nodes.length) return;
    const ns = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(width, height) * 0.32;
      return {
        ...n,
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 60,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
      };
    });
    stateRef.current = ns;

    let iteration = 0;
    const step = () => {
      const s = stateRef.current;
      if (!s || iteration > 300) return;
      iteration++;

      // Repulsion
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          const dx = s[j].x - s[i].x,
            dy = s[j].y - s[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2200 / (dist * dist);
          const nx = (dx / dist) * force,
            ny = (dy / dist) * force;
          s[i].vx -= nx;
          s[i].vy -= ny;
          s[j].vx += nx;
          s[j].vy += ny;
        }
      }

      // Attraction on edges
      const idMap = Object.fromEntries(s.map((n) => [n.id, n]));
      for (const e of edges) {
        const a = idMap[e.source],
          b = idMap[e.target];
        if (!a || !b) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal =
          e.type === "RELATED_TO" ? 100 : e.type === "HAS_SKILL" ? 120 : 150;
        const force = (dist - ideal) * 0.06;
        const nx = (dx / dist) * force,
          ny = (dy / dist) * force;
        a.vx += nx;
        a.vy += ny;
        b.vx -= nx;
        b.vy -= ny;
      }

      // Center gravity
      for (const n of s) {
        n.vx += (cx - n.x) * 0.008;
        n.vy += (cy - n.y) * 0.008;
      }

      // Integrate + damping + bounds
      const padding = 40;
      for (const n of s) {
        n.vx *= 0.78;
        n.vy *= 0.78;
        n.x = Math.max(padding, Math.min(width - padding, n.x + n.vx));
        n.y = Math.max(padding, Math.min(height - padding, n.y + n.vy));
      }

      stateRef.current = [...s];
      setTick((t) => t + 1);
      if (iteration < 300) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, nodes, edges]);

  return stateRef.current;
}

export default function GraphPage() {
  const containerRef = useRef(null);
  const [graphData, setGraphData] = useState(EMPTY_GRAPH);
  const [graphSource, setGraphSource] = useState("");
  const [graphLoading, setGraphLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    try {
      const data = await getGraph();
      const mapped = mapGraphForUi(data);
      setGraphData(mapped);
      setGraphSource(mapped.source || data.source || "");
    } catch {
      setGraphData(EMPTY_GRAPH);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    freelancer: true,
    skill: true,
    project: true,
  });
  const [showFraud, setShowFraud] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const positions = useForce(
    graphData.nodes,
    graphData.edges,
    dims.w,
    dims.h,
  );

  const posMap = positions
    ? Object.fromEntries(positions.map((n) => [n.id, { x: n.x, y: n.y }]))
    : {};

  const visNodes = graphData.nodes.filter((n) => filters[n.type]);

  const visEdges = graphData.edges.filter((e) => {
    const sn = graphData.nodes.find((n) => n.id === e.source);
    const tn = graphData.nodes.find((n) => n.id === e.target);
    return sn && tn && filters[sn.type] && filters[tn.type];
  });

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(3, z - e.deltaY * 0.001)));
  };

  const handleMouseDown = (e) => {
    if (
      e.target === e.currentTarget ||
      e.target.tagName === "svg" ||
      e.target.tagName === "line"
    ) {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e) => {
    if (!dragging || !dragStart) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => {
    setDragging(false);
    setDragStart(null);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const fraudNodes = graphData.nodes
    .filter((n) => n.type === "freelancer" && n.fraud > 0.6)
    .map((n) => n.id);

  // Hexagon path helper
  const hexPath = (cx, cy, r) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    });
    return `M${pts.join("L")}Z`;
  };

  return (
    <AppLayout title="Skill Graph">
      <div
        className="flex flex-col"
        style={{ height: "calc(100vh - 120px)", gap: 16 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Network size={18} className="text-violet-400" /> Knowledge Graph
            </h1>
            <p className="text-slate-500 text-xs font-mono mt-0.5">
              {visNodes.length} nodes · {visEdges.length} edges · source:{" "}
              {graphSource || "loading"} · Force-directed simulation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetView();
                loadGraph();
              }}
              disabled={graphLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              title="Reload graph from API"
            >
              <RefreshCw
                size={15}
                className={graphLoading ? "animate-spin" : ""}
              />
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ZoomOut size={15} />
            </button>
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Filter Panel */}
          <div className="flex-shrink-0 w-48 space-y-3">
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(17,24,39,0.7)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                Node Types
              </p>
              {[
                {
                  type: "freelancer",
                  label: "Freelancers",
                  icon: Users,
                  color: "#00D4FF",
                },
                {
                  type: "skill",
                  label: "Skills",
                  icon: Layers,
                  color: "#7C3AED",
                },
                {
                  type: "project",
                  label: "Projects",
                  icon: Maximize2,
                  color: "#F97316",
                },
              ].map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() =>
                    setFilters((f) => ({ ...f, [type]: !f[type] }))
                  }
                  className="w-full flex items-center gap-2.5 text-left transition-opacity"
                  style={{ opacity: filters[type] ? 1 : 0.4 }}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-xs text-slate-300 flex-1">{label}</span>
                  <div
                    className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: filters[type] ? color + "20" : "transparent",
                      borderColor: filters[type]
                        ? color
                        : "rgba(255,255,255,0.15)",
                    }}
                  >
                    {filters[type] && (
                      <div
                        className="w-2 h-2 rounded-sm"
                        style={{ background: color }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(17,24,39,0.7)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                Edge Types
              </p>
              {Object.entries(EDGE_CFG).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-2">
                  <svg width="20" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="20"
                      y2="5"
                      stroke={cfg.color
                        .replace("0.3", "0.8")
                        .replace("0.4", "0.8")
                        .replace("0.35", "0.8")}
                      strokeWidth="2"
                      strokeDasharray={cfg.dash}
                    />
                  </svg>
                  <span className="text-[10px] font-mono text-slate-400">
                    {type.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowFraud((v) => !v)}
              className="w-full p-3 rounded-2xl text-left transition-all"
              style={{
                background: showFraud
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(17,24,39,0.7)",
                border: `1px solid ${showFraud ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Shield
                  size={13}
                  className={showFraud ? "text-red-400" : "text-slate-500"}
                />
                <span
                  className={`text-xs font-mono ${showFraud ? "text-red-300" : "text-slate-400"}`}
                >
                  Fraud Cluster
                </span>
                <div
                  className="ml-auto w-4 h-4 rounded border flex items-center justify-center"
                  style={{
                    background: showFraud
                      ? "rgba(239,68,68,0.2)"
                      : "transparent",
                    borderColor: showFraud
                      ? "#EF4444"
                      : "rgba(255,255,255,0.15)",
                  }}
                >
                  {showFraud && (
                    <div className="w-2 h-2 rounded-sm bg-red-400" />
                  )}
                </div>
              </div>
              <p className="text-[9px] font-mono text-slate-600 mt-1">
                Highlight fraud risk &gt;60%
              </p>
            </button>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 relative rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,13,20,0.9)",
              border: "1px solid rgba(255,255,255,0.06)",
              cursor: dragging ? "grabbing" : "grab",
            }}
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid bg */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ opacity: 0.04 }}
            >
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#00D4FF"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {positions && dims.w > 0 && (
              <svg
                className="absolute inset-0 w-full h-full"
                style={{
                  transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center",
                  transition: dragging ? "none" : "transform 0.05s",
                }}
              >
                <defs>
                  <filter id="glow-cyan">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glow-red">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Fraud cluster halo */}
                {showFraud &&
                  fraudNodes.map((id) => {
                    const pos = posMap[id];
                    if (!pos) return null;
                    return (
                      <circle
                        key={`halo-${id}`}
                        cx={pos.x}
                        cy={pos.y}
                        r={26}
                        fill="rgba(239,68,68,0.08)"
                        stroke="rgba(239,68,68,0.3)"
                        strokeWidth="1"
                        strokeDasharray="4,3"
                      />
                    );
                  })}

                {/* Edges */}
                {visEdges.map((e, i) => {
                  const sp = posMap[e.source],
                    tp = posMap[e.target];
                  if (!sp || !tp) return null;
                  const cfg = EDGE_CFG[e.type] ?? EDGE_CFG.HAS_SKILL;
                  return (
                    <line
                      key={i}
                      x1={sp.x}
                      y1={sp.y}
                      x2={tp.x}
                      y2={tp.y}
                      stroke={cfg.color}
                      strokeWidth="1.5"
                      strokeDasharray={cfg.dash}
                    />
                  );
                })}

                {/* Nodes */}
                {visNodes.map((node) => {
                  const pos = posMap[node.id];
                  if (!pos) return null;
                  const cfg = NODE_CFG[node.type];
                  const isFraud = showFraud && node.fraud > 0.6;
                  const isHovered = hoveredId === node.id;
                  const isSelected = selected?.id === node.id;
                  const size = cfg.size * (isHovered || isSelected ? 1.5 : 1);
                  const color = isFraud ? "#EF4444" : cfg.color;

                  return (
                    <g
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(node);
                      }}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{ cursor: "pointer" }}
                    >
                      {node.type === "freelancer" && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={size}
                          fill={color + "30"}
                          stroke={color}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          filter={
                            isHovered || isFraud ? "url(#glow-cyan)" : undefined
                          }
                          style={{ transition: "r 0.15s" }}
                        />
                      )}
                      {node.type === "skill" && (
                        <path
                          d={hexPath(pos.x, pos.y, size)}
                          fill={color + "25"}
                          stroke={color}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          filter={isHovered ? "url(#glow-cyan)" : undefined}
                          style={{ transition: "d 0.15s" }}
                        />
                      )}
                      {node.type === "project" && (
                        <rect
                          x={pos.x - size}
                          y={pos.y - size}
                          width={size * 2}
                          height={size * 2}
                          rx={3}
                          fill={color + "25"}
                          stroke={color}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          filter={isHovered ? "url(#glow-cyan)" : undefined}
                          style={{
                            transition:
                              "x 0.15s,y 0.15s,width 0.15s,height 0.15s",
                          }}
                        />
                      )}
                      {(isHovered || isSelected) && (
                        <text
                          x={pos.x}
                          y={pos.y + cfg.size + 14}
                          textAnchor="middle"
                          fill={color}
                          fontSize="10"
                          fontFamily="Space Mono, monospace"
                          style={{ pointerEvents: "none" }}
                        >
                          {node.label}
                        </text>
                      )}
                      {isFraud && (
                        <text
                          x={pos.x + size}
                          y={pos.y - size}
                          fontSize="9"
                          fill="#EF4444"
                          style={{ pointerEvents: "none" }}
                        >
                          ⚠
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Loading */}
            {(!positions || dims.w === 0) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-slate-600 font-mono text-xs uppercase tracking-[0.3em]">
                  Initializing force simulation...
                </p>
              </div>
            )}

            {/* Zoom badge */}
            <div
              className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg font-mono text-[10px] text-slate-500"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {Math.round(zoom * 100)}%
            </div>

            {/* Legend */}
            <div
              className="absolute bottom-4 left-4 p-3 rounded-xl space-y-2"
              style={{
                background: "rgba(10,13,20,0.85)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {[
                { shape: "circle", color: "#00D4FF", label: "Freelancer" },
                { shape: "hex", color: "#7C3AED", label: "Skill" },
                { shape: "square", color: "#F97316", label: "Project" },
              ].map(({ shape, color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <svg width="14" height="14">
                    {shape === "circle" && (
                      <circle
                        cx="7"
                        cy="7"
                        r="5"
                        fill={color + "30"}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                    )}
                    {shape === "hex" && (
                      <path
                        d={hexPath(7, 7, 5.5)}
                        fill={color + "25"}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                    )}
                    {shape === "square" && (
                      <rect
                        x="2"
                        y="2"
                        width="10"
                        height="10"
                        rx="2"
                        fill={color + "25"}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>
                  <span className="text-[10px] font-mono text-slate-400">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Node Detail Panel */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="w-64 flex-shrink-0 rounded-2xl flex flex-col overflow-hidden"
                style={{
                  background: "rgba(13,17,23,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Node Detail
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                  style={{ scrollbarWidth: "none" }}
                >
                  {/* Type badge */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: NODE_CFG[selected.type].color }}
                    />
                    <span
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: NODE_CFG[selected.type].color }}
                    >
                      {selected.type}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm">
                    {selected.label}
                  </h3>

                  {/* Freelancer-specific */}
                  {selected.type === "freelancer" && (
                    <>
                      <FraudGauge
                        score={selected.fraud}
                        size={100}
                        thickness={8}
                      />
                      <div className="space-y-1 text-[11px] font-mono text-slate-400">
                        <div className="flex justify-between">
                          <span>Fraud Score</span>
                          <span
                            style={{
                              color:
                                selected.fraud > 0.6 ? "#EF4444" : "#10B981",
                            }}
                          >
                            {Math.round(selected.fraud * 100)}%
                          </span>
                        </div>
                        {selected.fraud > 0.6 && (
                          <div className="flex items-center gap-1 text-red-400 text-[10px] pt-1">
                            <Shield size={10} /> High risk — review recommended
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Connected edges */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">
                      Connections
                    </p>
                    {graphData.edges
                      .filter(
                        (e) =>
                          e.source === selected.id || e.target === selected.id,
                      )
                      .slice(0, 8)
                      .map((e, i) => {
                        const otherId =
                          e.source === selected.id ? e.target : e.source;
                        const other = graphData.nodes.find(
                          (n) => n.id === otherId,
                        );
                        const cfg = EDGE_CFG[e.type] ?? EDGE_CFG.HAS_SKILL;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-[10px] font-mono"
                          >
                            <svg width="16" height="10">
                              <line
                                x1="0"
                                y1="5"
                                x2="16"
                                y2="5"
                                stroke={cfg.color
                                  .replace("0.3", "0.7")
                                  .replace("0.4", "0.7")
                                  .replace("0.35", "0.7")}
                                strokeWidth="1.5"
                                strokeDasharray={cfg.dash}
                              />
                            </svg>
                            <span className="text-slate-500 uppercase text-[9px]">
                              {e.type.replace("_", " ")}
                            </span>
                            <button
                              onClick={() => setSelected(other)}
                              className="text-slate-200 hover:text-cyan-400 transition-colors truncate text-left flex-1"
                            >
                              {other?.label}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
