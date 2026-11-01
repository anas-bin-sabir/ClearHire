import * as d3 from 'd3'
import type { GraphNode } from './api'

/** Zooms an svg so every positioned node fits inside its viewBox, with padding for labels. */
export function fitToView(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  nodes: { x?: number; y?: number }[],
  width: number,
  height: number,
  pad = 40,
) {
  const xs = nodes.map(n => n.x ?? 0)
  const ys = nodes.map(n => n.y ?? 0)
  if (xs.length === 0) return
  const [x0, x1] = [Math.min(...xs) - pad, Math.max(...xs) + pad]
  const [y0, y1] = [Math.min(...ys) - pad, Math.max(...ys) + pad]
  const k = Math.min(1.5, width / (x1 - x0), height / (y1 - y0))
  const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
  svg.transition().duration(200).call(zoom.transform, t)
}

/** Reads the palette from CSS variables so D3 drawings follow the theme. */
export function graphPalette() {
  const css = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback
  return {
    you: v('--primary', '#4F46E5'),
    freelancer: v('--text-secondary', '#64748B'),
    skill: v('--teal', '#14B8A6'),
    project: '#F59E0B',
    client: v('--navy-3', '#374151'),
    flagged: v('--status-danger', '#E11D48'),
    warn: v('--status-warn', '#B45309'),
    muted: v('--text-secondary', '#64748B'),
    link: v('--border-strong', '#CBD5E1'),
    label: v('--text-primary', '#111827'),
    halo: v('--bg-panel', '#FFFFFF'),
  }
}

export const NODE_TYPE_LABEL: Record<GraphNode['type'], string> = {
  freelancer: 'Freelancer',
  skill: 'Skill',
  project: 'Project',
  client: 'Client',
}
