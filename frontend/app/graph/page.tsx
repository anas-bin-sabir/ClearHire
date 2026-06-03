"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Share2, ZoomIn, ZoomOut, Maximize2, X, Shield, Users, Layers, Network, RefreshCw } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import FraudGauge from "@/components/FraudGauge";
import { getGraph, mapGraphForUi } from "@/lib/api";

const EMPTY_GRAPH = { nodes: [], edges: [] };

const NODE_CFG = {
  freelancer: { colorVar: "var(--color-primary)", hexFallback: "#4B5BFF", size: 14 },
  skill: { colorVar: "var(--color-secondary)", hexFallback: "#A259FF", size: 11 },
  project: { colorVar: "var(--color-accent)", hexFallback: "#00BFA6", size: 13 },
};

const EDGE_CFG = {
  HAS_SKILL: { colorVar: "rgba(75,91,255,0.3)", dash: "" },
  RELATED_TO: { colorVar: "rgba(162,89,255,0.4)", dash: "4,4" },
  WORKED_ON: { colorVar: "rgba(0,191,166,0.35)", dash: "6,3" },
  REFERRED_BY: { colorVar: "rgba(239,68,68,0.35)", dash: "2,6" },
};

function useForce(nodes: any[], edges: any[], width: number, height: number) {
  const stateRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!width || !height || !nodes.length) return;
    const cx = width / 2, cy = height / 2;
    const ns = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(width, height) * 0.32;
      return { ...n, x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 60, y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 60, vx: 0, vy: 0 };
    });
    stateRef.current = ns;
    let iteration = 0;
    const step = () => {
      const s = stateRef.current;
      if (!s || iteration > 300) return;
      iteration++;
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          const dx = s[j].x - s[i].x, dy = s[j].y - s[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2200 / (dist * dist);
          const nx = (dx / dist) * force, ny = (dy / dist) * force;
          s[i].vx -= nx; s[i].vy -= ny; s[j].vx += nx; s[j].vy += ny;
        }
      }
      const idMap = Object.fromEntries(s.map((n: any) => [n.id, n]));
      for (const e of edges) {
        const a = idMap[e.source], b = idMap[e.target];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = e.type === "RELATED_TO" ? 100 : e.type === "HAS_SKILL" ? 120 : 150;
        const force = (dist - ideal) * 0.06;
        const nx = (dx / dist) * force, ny = (dy / dist) * force;
        a.vx += nx; a.vy += ny; b.vx -= nx; b.vy -= ny;
      }
      for (const n of s) { n.vx += (cx - n.x) * 0.008; n.vy += (cy - n.y) * 0.008; }
      const padding = 40;
      for (const n of s) { n.vx *= 0.78; n.vy *= 0.78; n.x = Math.max(padding, Math.min(width - padding, n.x + n.vx)); n.y = Math.max(padding, Math.min(height - padding, n.y + n.vy)); }
      stateRef.current = [...s];
      setTick((t) => t + 1);
      if (iteration < 300) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [width, height, nodes, edges]);

  return stateRef.current;
}

export default function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<any>(EMPTY_GRAPH);
  const [graphSource, setGraphSource] = useState("");
  const [graphLoading, setGraphLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    try {
      const data = await getGraph();
      const mapped = mapGraphForUi(data);
      setGraphData(mapped);
      setGraphSource(mapped.source || data.source || "");
    } catch { setGraphData(EMPTY_GRAPH); }
    finally { setGraphLoading(false); }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [filters, setFilters] = useState({ freelancer: true, skill: true, project: true });
  const [showFraud, setShowFraud] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const positions = useForce(graphData.nodes, graphData.edges, dims.w, dims.h);
  const posMap = positions ? Object.fromEntries(positions.map((n: any) => [n.id, { x: n.x, y: n.y }])) : {};
  const visNodes = graphData.nodes.filter((n: any) => filters[n.type as keyof typeof filters]);
  const visEdges = graphData.edges.filter((e: any) => {
    const sn = graphData.nodes.find((n: any) => n.id === e.source);
    const tn = graphData.nodes.find((n: any) => n.id === e.target);
    return sn && tn && filters[sn.type as keyof typeof filters] && filters[tn.type as keyof typeof filters];
  });

  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom((z) => Math.max(0.4, Math.min(3, z - e.deltaY * 0.001))); };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as Element).tagName === "svg" || (e.target as Element).tagName === "line") {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => { if (!dragging || !dragStart) return; setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => { setDragging(false); setDragStart(null); };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const fraudNodes = graphData.nodes.filter((n: any) => n.type === "freelancer" && n.fraud > 0.6).map((n: any) => n.id);
  const hexPath = (cx: number, cy: number, r: number) => {
    const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 6; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; });
    return `M${pts.join("L")}Z`;
  };

  const btnStyle = { background: `rgba(var(--border-base), 0.05)`, border: `1px solid rgba(var(--border-base), 0.08)` };
  const panelStyle = { background: `rgba(var(--bg-secondary-rgb), 0.7)`, border: `1px solid rgba(var(--border-base), 0.06)` };

  return (
    <AppLayout title="Skill Graph">
      <div className="flex flex-col" style={{ height: "calc(100vh - 120px)", gap: 16 }}>
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Network size={18} style={{ color: "var(--color-secondary)" }} /> Knowledge Graph
            </h1>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-subtle)" }}>
              {visNodes.length} nodes · {visEdges.length} edges · source: {graphSource || "loading"} · Force-directed simulation
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[
              { onClick: () => { resetView(); loadGraph(); }, icon: <RefreshCw size={15} className={graphLoading ? "animate-spin" : ""} />, disabled: graphLoading, title: "Reload graph" },
              { onClick: () => setZoom((z) => Math.min(3, z + 0.2)), icon: <ZoomIn size={15} /> },
              { onClick: () => setZoom((z) => Math.max(0.4, z - 0.2)), icon: <ZoomOut size={15} /> },
            ].map((btn, i) => (
              <button key={i} onClick={btn.onClick} disabled={(btn as any).disabled} className="p-2 rounded-xl transition-colors disabled:opacity-40" style={{ ...btnStyle, color: "var(--text-muted)" }} title={(btn as any).title}>
                {btn.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Filter Panel */}
          <div className="flex-shrink-0 w-48 space-y-3">
            <div className="p-4 rounded-2xl space-y-3" style={panelStyle}>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "var(--text-subtle)" }}>Node Types</p>
              {[
                { type: "freelancer", label: "Freelancers", icon: Users, cfg: NODE_CFG.freelancer },
                { type: "skill", label: "Skills", icon: Layers, cfg: NODE_CFG.skill },
                { type: "project", label: "Projects", icon: Maximize2, cfg: NODE_CFG.project },
              ].map(({ type, label, icon: Icon, cfg }) => (
                <button key={type} onClick={() => setFilters((f) => ({ ...f, [type]: !f[type as keyof typeof f] }))} className="w-full flex items-center gap-2.5 text-left transition-opacity" style={{ opacity: filters[type as keyof typeof filters] ? 1 : 0.4 }}>
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: cfg.hexFallback }} />
                  <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <div className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center" style={{ background: filters[type as keyof typeof filters] ? `${cfg.hexFallback}20` : "transparent", borderColor: filters[type as keyof typeof filters] ? cfg.hexFallback : `rgba(var(--border-base), 0.15)` }}>
                    {filters[type as keyof typeof filters] && <div className="w-2 h-2 rounded-sm" style={{ background: cfg.hexFallback }} />}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 rounded-2xl space-y-3" style={panelStyle}>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "var(--text-subtle)" }}>Edge Types</p>
              {Object.entries(EDGE_CFG).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-2">
                  <svg width="20" height="10">
                    <line x1="0" y1="5" x2="20" y2="5" stroke={cfg.colorVar.replace("0.3", "0.8").replace("0.4", "0.8").replace("0.35", "0.8")} strokeWidth="2" strokeDasharray={cfg.dash} />
                  </svg>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{type.replace("_", " ")}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowFraud((v) => !v)}
              className="w-full p-3 rounded-2xl text-left transition-all"
              style={{
                background: showFraud ? `rgba(var(--color-danger-rgb), 0.1)` : `rgba(var(--bg-secondary-rgb), 0.7)`,
                border: `1px solid ${showFraud ? `rgba(var(--color-danger-rgb), 0.3)` : `rgba(var(--border-base), 0.06)`}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Shield size={13} style={{ color: showFraud ? "var(--color-danger)" : "var(--text-subtle)" }} />
                <span className="text-xs font-mono" style={{ color: showFraud ? "var(--color-danger)" : "var(--text-muted)" }}>Fraud Cluster</span>
                <div className="ml-auto w-4 h-4 rounded border flex items-center justify-center" style={{ background: showFraud ? `rgba(var(--color-danger-rgb), 0.2)` : "transparent", borderColor: showFraud ? "var(--color-danger)" : `rgba(var(--border-base), 0.15)` }}>
                  {showFraud && <div className="w-2 h-2 rounded-sm" style={{ background: "var(--color-danger)" }} />}
                </div>
              </div>
              <p className="text-[9px] font-mono mt-1" style={{ color: "var(--text-subtle)" }}>Highlight fraud risk &gt;60%</p>
            </button>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 relative rounded-2xl overflow-hidden"
            style={{ background: `rgba(var(--bg-primary-rgb), 0.9)`, border: `1px solid rgba(var(--border-base), 0.06)`, cursor: dragging ? "grabbing" : "grab" }}
            ref={containerRef}
            onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.04 }}>
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={NODE_CFG.freelancer.hexFallback} strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {positions && dims.w > 0 && (
              <svg className="absolute inset-0 w-full h-full" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "center", transition: dragging ? "none" : "transform 0.05s" }}>
                {showFraud && fraudNodes.map((id: string) => {
                  const pos = posMap[id];
                  if (!pos) return null;
                  return <circle key={`halo-${id}`} cx={pos.x} cy={pos.y} r={26} fill={`rgba(var(--color-danger-rgb),0.08)`} stroke={`rgba(var(--color-danger-rgb),0.3)`} strokeWidth="1" strokeDasharray="4,3" />;
                })}

                {visEdges.map((e: any, i: number) => {
                  const sp = posMap[e.source], tp = posMap[e.target];
                  if (!sp || !tp) return null;
                  const cfg = EDGE_CFG[e.type as keyof typeof EDGE_CFG] ?? EDGE_CFG.HAS_SKILL;
                  return <line key={i} x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y} stroke={cfg.colorVar} strokeWidth="1.5" strokeDasharray={cfg.dash} />;
                })}

                {visNodes.map((node: any) => {
                  const pos = posMap[node.id];
                  if (!pos) return null;
                  const cfg = NODE_CFG[node.type as keyof typeof NODE_CFG];
                  const isFraud = showFraud && node.fraud > 0.6;
                  const isHovered = hoveredId === node.id;
                  const isSelected = selected?.id === node.id;
                  const size = cfg.size * (isHovered || isSelected ? 1.5 : 1);
                  const color = isFraud ? NODE_CFG.freelancer.hexFallback : cfg.hexFallback;

                  return (
                    <g key={node.id} onClick={(e) => { e.stopPropagation(); setSelected(node); }} onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)} style={{ cursor: "pointer" }}>
                      {node.type === "freelancer" && <circle cx={pos.x} cy={pos.y} r={size} fill={color + "30"} stroke={isFraud ? NODE_CFG.freelancer.hexFallback : color} strokeWidth={isSelected ? 2.5 : 1.5} style={{ transition: "r 0.15s" }} />}
                      {node.type === "skill" && <path d={hexPath(pos.x, pos.y, size)} fill={color + "25"} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} style={{ transition: "d 0.15s" }} />}
                      {node.type === "project" && <rect x={pos.x - size} y={pos.y - size} width={size * 2} height={size * 2} rx={3} fill={color + "25"} stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />}
                      {(isHovered || isSelected) && <text x={pos.x} y={pos.y + cfg.size + 14} textAnchor="middle" fill={color} fontSize="10" fontFamily="Space Mono, monospace" style={{ pointerEvents: "none" }}>{node.label}</text>}
                      {isFraud && <text x={pos.x + size} y={pos.y - size} fontSize="9" fill={NODE_CFG.freelancer.hexFallback} style={{ pointerEvents: "none" }}>⚠</text>}
                    </g>
                  );
                })}
              </svg>
            )}

            {(!positions || dims.w === 0) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-subtle)" }}>Initializing force simulation...</p>
              </div>
            )}

            <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg font-mono text-[10px]" style={{ background: `rgba(var(--bg-primary-rgb), 0.5)`, border: `1px solid rgba(var(--border-base), 0.06)`, color: "var(--text-subtle)" }}>
              {Math.round(zoom * 100)}%
            </div>

            <div className="absolute bottom-4 left-4 p-3 rounded-xl space-y-2" style={{ background: `rgba(var(--bg-primary-rgb), 0.85)`, border: `1px solid rgba(var(--border-base), 0.06)` }}>
              {[
                { shape: "circle", cfg: NODE_CFG.freelancer, label: "Freelancer" },
                { shape: "hex", cfg: NODE_CFG.skill, label: "Skill" },
                { shape: "square", cfg: NODE_CFG.project, label: "Project" },
              ].map(({ shape, cfg, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <svg width="14" height="14">
                    {shape === "circle" && <circle cx="7" cy="7" r="5" fill={cfg.hexFallback + "30"} stroke={cfg.hexFallback} strokeWidth="1.5" />}
                    {shape === "hex" && <path d={hexPath(7, 7, 5.5)} fill={cfg.hexFallback + "25"} stroke={cfg.hexFallback} strokeWidth="1.5" />}
                    {shape === "square" && <rect x="2" y="2" width="10" height="10" rx="2" fill={cfg.hexFallback + "25"} stroke={cfg.hexFallback} strokeWidth="1.5" />}
                  </svg>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Node Detail Panel */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                className="w-64 flex-shrink-0 rounded-2xl flex flex-col overflow-hidden"
                style={{ background: `rgba(var(--bg-surface-rgb), 0.95)`, border: `1px solid rgba(var(--border-base), 0.08)` }}
              >
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid rgba(var(--border-base), 0.06)` }}>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Node Detail</span>
                  <button onClick={() => setSelected(null)} className="transition-colors" style={{ color: "var(--text-subtle)" }}><X size={14} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: "none" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NODE_CFG[selected.type as keyof typeof NODE_CFG]?.hexFallback }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: NODE_CFG[selected.type as keyof typeof NODE_CFG]?.hexFallback }}>{selected.type}</span>
                  </div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{selected.label}</h3>

                  {selected.type === "freelancer" && (
                    <>
                      <FraudGauge score={selected.fraud} size={100} thickness={8} />
                      <div className="space-y-1 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                        <div className="flex justify-between">
                          <span>Fraud Score</span>
                          <span style={{ color: selected.fraud > 0.6 ? "var(--color-danger)" : "var(--color-success)" }}>{Math.round(selected.fraud * 100)}%</span>
                        </div>
                        {selected.fraud > 0.6 && (
                          <div className="flex items-center gap-1 text-[10px] pt-1" style={{ color: "var(--color-danger)" }}>
                            <Shield size={10} /> High risk — review recommended
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Connections</p>
                    {graphData.edges.filter((e: any) => e.source === selected.id || e.target === selected.id).slice(0, 8).map((e: any, i: number) => {
                      const otherId = e.source === selected.id ? e.target : e.source;
                      const other = graphData.nodes.find((n: any) => n.id === otherId);
                      const cfg = EDGE_CFG[e.type as keyof typeof EDGE_CFG] ?? EDGE_CFG.HAS_SKILL;
                      return (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                          <svg width="16" height="10">
                            <line x1="0" y1="5" x2="16" y2="5" stroke={cfg.colorVar.replace("0.3", "0.7").replace("0.4", "0.7").replace("0.35", "0.7")} strokeWidth="1.5" strokeDasharray={cfg.dash} />
                          </svg>
                          <span className="uppercase text-[9px]" style={{ color: "var(--text-subtle)" }}>{e.type.replace("_", " ")}</span>
                          <button onClick={() => setSelected(other)} className="truncate text-left flex-1 transition-colors" style={{ color: "var(--text-secondary)" }}>
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
