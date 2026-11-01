'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, GraphResponse, GraphNode, GraphLink, GraphQuery } from '@/lib/api'
import { Crosshair, Eye, RotateCcw } from 'lucide-react'
import * as d3 from 'd3'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, Spinner } from '@/components/ui/States'
import { fitToView, graphPalette, NODE_TYPE_LABEL } from '@/lib/graphColors'
import { fraudLabel, fraudTone } from '@/lib/utils'

interface ExtendedNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: GraphNode['type']
  fraud_score?: number | null
}

interface ExtendedLink extends d3.SimulationLinkDatum<ExtendedNode> {
  source: string | ExtendedNode
  target: string | ExtendedNode
  type: string
  weight?: number | null
  properties?: Record<string, unknown>
}

type PaletteKey = keyof ReturnType<typeof graphPalette>

/** Edge styling and legend text, one entry per relationship type. Colors come from the palette. */
const EDGE_STYLES: Record<string, { color: PaletteKey; cssVar: string; dash?: string; width: number; label: string; help: string }> = {
  HAS_SKILL: { color: 'skill', cssVar: '--teal', width: 1.2, label: 'Has skill', help: 'Freelancer lists the skill' },
  RELATED_TO: { color: 'skill', cssVar: '--teal', dash: '4 3', width: 1.2, label: 'Related to', help: 'Skill ontology edge (weight = thickness)' },
  REQUIRES: { color: 'project', cssVar: '--color-star', width: 1.4, label: 'Requires', help: 'Project needs the skill (dotted = nice to have)' },
  WORKED_ON: { color: 'you', cssVar: '--primary', width: 1.6, label: 'Worked on', help: 'Contract (solid = completed)' },
  POSTED: { color: 'muted', cssVar: '--text-secondary', width: 1, label: 'Posted', help: 'Client posted the project' },
  COLLABORATED_WITH: { color: 'you', cssVar: '--primary', width: 3, label: 'Collaborated with', help: 'Completed a project together' },
}

function edgeStyle(type: string) {
  return EDGE_STYLES[type] ?? { color: 'link' as PaletteKey, cssVar: '--border-strong', width: 1, label: type, help: '' }
}

/** Freelancer fill by fraud score, in the same bands as the fraud badges. */
function freelancerColor(score: number | null | undefined, palette: ReturnType<typeof graphPalette>) {
  const s = score ?? 0
  if (s > 0.65) return palette.flagged
  if (s > 0.35) return palette.warn
  return palette.you
}

/** "f-12" -> 12 */
function numericId(nodeId: string): number | null {
  const n = Number(nodeId.split('-')[1])
  return Number.isFinite(n) ? n : null
}

export default function AdminGraphPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [query, setQuery] = useState<GraphQuery>({})
  const [focusKind, setFocusKind] = useState<'freelancer' | 'project'>('freelancer')
  const [focusInput, setFocusInput] = useState('')

  useEffect(() => {
    let active = true
    api.graph({ ...query, limit: 40 })
      .then(res => {
        if (!active) return
        setGraph(res)
        setError(null)
        setSelectedNode(null)
      })
      .catch(err => {
        console.error('Failed to load graph:', err)
        if (active) setError(err?.message || 'Failed to load graph')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query])

  const focusOn = useCallback((next: GraphQuery) => {
    setLoading(true)
    setQuery(next)
  }, [])

  const focusNode = useCallback((node: GraphNode) => {
    const id = numericId(node.id)
    if (id === null) return
    if (node.type === 'freelancer') focusOn({ freelancerId: id })
    else if (node.type === 'project') focusOn({ projectId: id })
  }, [focusOn])

  const submitFocus = (e: React.FormEvent) => {
    e.preventDefault()
    const id = Number(focusInput)
    if (!Number.isInteger(id) || id <= 0) return
    focusOn(focusKind === 'freelancer' ? { freelancerId: id } : { projectId: id })
  }

  const renderGraph = useCallback((nodesData: GraphNode[], linksData: GraphLink[], focus?: string | null) => {
    if (!svgRef.current) return
    const palette = graphPalette()
    d3.select(svgRef.current).selectAll('*').remove()

    const width = 800
    const height = 500
    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')
    const container = svg.append('g')
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on('zoom', event => container.attr('transform', event.transform))
    svg.call(zoomBehavior)

    const nodes: ExtendedNode[] = nodesData.map(d => ({ ...d }))
    const links: ExtendedLink[] = linksData.map(d => ({ ...d }))
    const focusNodeDatum = nodes.find(n => n.id === focus)
    if (focusNodeDatum) {
      focusNodeDatum.fx = width / 2
      focusNodeDatum.fy = height / 2
    }

    const simulation = d3.forceSimulation<ExtendedNode>(nodes)
      .force('link', d3.forceLink<ExtendedNode, ExtendedLink>(links).id(d => d.id)
        .distance(l => (l.type === 'RELATED_TO' ? 80 : 120)))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))

    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => palette[edgeStyle(d.type).color])
      .attr('stroke-opacity', 0.75)
      .attr('stroke-width', d => (d.type === 'RELATED_TO' && d.weight ? 0.6 + d.weight * 2.5 : edgeStyle(d.type).width))
      .attr('stroke-dasharray', d => {
        if (d.type === 'REQUIRES' && d.properties?.importance === 'nice') return '2 3'
        if (d.type === 'WORKED_ON' && d.properties?.status !== 'completed') return '5 3'
        return edgeStyle(d.type).dash ?? null
      })
    link.append('title').text(d => {
      const props = Object.entries(d.properties ?? {})
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      if (d.weight != null) props.unshift(`weight: ${d.weight}`)
      return [d.type, ...props].join('\n')
    })

    const node = container.append('g')
      .selectAll<SVGGElement, ExtendedNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'cursor-pointer')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `${NODE_TYPE_LABEL[d.type]}: ${d.name}`)
      .on('click', (_event, d) => setSelectedNode(d as GraphNode))
      .on('dblclick', (_event, d) => focusNode(d as GraphNode))
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setSelectedNode(d as GraphNode)
        }
      })
      .call(d3.drag<SVGGElement, ExtendedNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          if (d.id !== focus) {
            d.fx = null
            d.fy = null
          }
        }))

    node.each(function (d) {
      const el = d3.select(this)
      const ring = d.id === focus ? palette.label : palette.halo
      const ringWidth = d.id === focus ? 2.5 : 1.5
      if (d.type === 'freelancer') {
        el.append('circle').attr('r', 16).attr('fill', freelancerColor(d.fraud_score, palette))
          .attr('stroke', ring).attr('stroke-width', ringWidth)
      } else if (d.type === 'skill') {
        el.append('rect').attr('width', 20).attr('height', 20).attr('x', -10).attr('y', -10)
          .attr('transform', 'rotate(45)').attr('fill', palette.skill)
          .attr('stroke', ring).attr('stroke-width', ringWidth)
      } else if (d.type === 'client') {
        el.append('circle').attr('r', 11).attr('fill', palette.client)
          .attr('stroke', ring).attr('stroke-width', ringWidth)
      } else {
        el.append('rect').attr('width', 24).attr('height', 24).attr('x', -12).attr('y', -12).attr('rx', 4)
          .attr('fill', palette.project).attr('stroke', ring).attr('stroke-width', ringWidth)
      }
    })

    node.append('text')
      .text(d => d.name)
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', d => (d.id === focus ? '700' : '500'))
      .attr('fill', palette.label)
      .attr('paint-order', 'stroke')
      .attr('stroke', palette.halo)
      .attr('stroke-width', 3)
      .style('font-family', 'var(--font-sans)')

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as ExtendedNode).x ?? 0)
        .attr('y1', d => (d.source as ExtendedNode).y ?? 0)
        .attr('x2', d => (d.target as ExtendedNode).x ?? 0)
        .attr('y2', d => (d.target as ExtendedNode).y ?? 0)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })
    simulation.on('end', () => fitToView(svg, zoomBehavior, nodes, width, height))
  }, [focusNode])

  // Draw once loading finishes (the <svg> stays mounted under the loading overlay).
  useEffect(() => {
    if (!loading && graph) renderGraph(graph.nodes, graph.links, graph.focus)
  }, [loading, graph, renderGraph])

  const edgeCounts = (graph?.links ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1
    return acc
  }, {})
  const focusLabel = graph?.focus
    ? graph.nodes.find(n => n.id === graph.focus)?.name ?? graph.focus
    : null
  const selectedLinks = selectedNode
    ? (graph?.links ?? []).filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
    : []
  const nodeName = (id: string) => graph?.nodes.find(n => n.id === id)?.name ?? id

  const nodeLegend = [
    { label: 'Freelancer, low risk', swatch: 'h-3 w-3 rounded-full bg-primary' },
    { label: 'Freelancer, needs review', swatch: 'h-3 w-3 rounded-full bg-warn' },
    { label: 'Freelancer, flagged', swatch: 'h-3 w-3 rounded-full bg-danger' },
    { label: 'Skill', swatch: 'h-2.5 w-2.5 rotate-45 bg-teal' },
    { label: 'Project', swatch: 'h-3 w-3 rounded-[3px] bg-star' },
    { label: 'Client', swatch: 'h-2.5 w-2.5 rounded-full bg-shell-3' },
  ]

  return (
    <>
      <PageHeader
        title="Knowledge graph"
        description={
          focusLabel
            ? <>Around <span className="font-semibold text-fg">{focusLabel}</span>: skills, related skills, projects and collaborators.</>
            : 'An overview sample of freelancers, their skills and the skill ontology. Focus on a freelancer or project to see its neighbourhood.'
        }
        actions={
          graph ? (
            <Badge tone={graph.source === 'neo4j' ? 'ok' : 'warn'}>
              Source: <span className="font-mono">{graph.source}</span>
            </Badge>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-8 sm:py-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <form onSubmit={submitFocus} className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="focus-kind" className="field-label">Focus on</label>
                <select
                  id="focus-kind"
                  value={focusKind}
                  onChange={e => setFocusKind(e.target.value as 'freelancer' | 'project')}
                  className="input w-36"
                >
                  <option value="freelancer">Freelancer</option>
                  <option value="project">Project</option>
                </select>
              </div>
              <div>
                <label htmlFor="focus-id" className="field-label">ID</label>
                <input
                  id="focus-id"
                  type="number"
                  min={1}
                  value={focusInput}
                  onChange={e => setFocusInput(e.target.value)}
                  placeholder="12"
                  className="input w-24 tabular-nums"
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                <Crosshair aria-hidden /> Focus
              </button>
            </form>
            {graph?.focus && (
              <button type="button" onClick={() => focusOn({})} className="btn btn-ghost">
                <RotateCcw aria-hidden /> Back to overview
              </button>
            )}
          </div>

          {error && <ErrorState message={`The graph couldn’t be loaded: ${error}`} />}

          <section aria-label="Graph" className="overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            <p className="border-b border-line px-5 py-3 text-xs text-fg-2">
              Drag nodes, scroll to zoom, hover an edge for details. Double-click a freelancer or project to focus on it.
            </p>
            <div className="relative aspect-[8/5] min-h-80 w-full bg-canvas">
              <svg ref={svgRef} className="absolute inset-0 h-full w-full" role="group" aria-label="Knowledge graph" />
              {loading && (
                <p role="status" className="absolute inset-0 grid place-items-center bg-canvas/70 text-sm text-fg-2">
                  <span className="flex items-center gap-2"><Spinner /> Loading the graph</span>
                </p>
              )}
              {!loading && !error && graph && graph.nodes.length === 0 && (
                <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-2">
                  The graph is empty. Seed the database from the data manager.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <Panel title="Selected node">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <Badge>{NODE_TYPE_LABEL[selectedNode.type]}</Badge>
                  <p className="mt-2 text-base font-semibold text-fg">{selectedNode.name}</p>
                  <p className="font-mono text-xs text-fg-2">{selectedNode.id}</p>
                </div>

                {selectedNode.type === 'freelancer' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-fg-2">Fraud risk</span>
                    <Badge tone={fraudTone(selectedNode.fraud_score ?? 0)}>
                      <span className="tabular-nums">{Math.round((selectedNode.fraud_score ?? 0) * 100)}%</span> {fraudLabel(selectedNode.fraud_score ?? 0).toLowerCase()}
                    </Badge>
                  </div>
                )}

                {selectedLinks.length > 0 && (
                  <div>
                    <p className="text-[13px] font-semibold text-fg">Connections</p>
                    <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto text-[13px] text-fg-2">
                      {selectedLinks.slice(0, 12).map((l, i) => {
                        const other = l.source === selectedNode.id ? l.target : l.source
                        const count = l.properties?.count
                        return (
                          <li key={i} className="flex items-center gap-2">
                            <span aria-hidden className="h-0.5 w-3 shrink-0" style={{ background: `var(${edgeStyle(l.type).cssVar})` }} />
                            <span className="min-w-0 truncate">
                              <span className="text-fg-3">{edgeStyle(l.type).label.toLowerCase()}</span> <span className="text-fg">{nodeName(other)}</span>
                              {typeof count === 'number' && <span className="tabular-nums"> ×{count}</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {(selectedNode.type === 'freelancer' || selectedNode.type === 'project') && (
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.id !== graph?.focus && (
                      <button type="button" onClick={() => focusNode(selectedNode)} className="btn btn-sm btn-secondary">
                        <Crosshair aria-hidden /> Focus here
                      </button>
                    )}
                    {selectedNode.type === 'freelancer' && (
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/members?q=${numericId(selectedNode.id) ?? ''}`)}
                        className="btn btn-sm btn-ghost"
                      >
                        <Eye aria-hidden /> Open in members
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-fg-2">Select a node to inspect it.</p>
            )}
          </Panel>

          <Panel title="Legend">
            <ul className="space-y-2 text-[13px] text-fg">
              {nodeLegend.map(n => (
                <li key={n.label} className="flex items-center gap-3">
                  <span className="grid w-4 shrink-0 place-items-center"><span aria-hidden className={n.swatch} /></span>
                  {n.label}
                </li>
              ))}
            </ul>
            <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
              {Object.entries(EDGE_STYLES).map(([type, style]) => (
                <li key={type} className="flex items-start gap-3 text-[13px]">
                  <svg width="24" height="10" className="mt-1 shrink-0" aria-hidden>
                    <line x1="0" y1="5" x2="24" y2="5" style={{ stroke: `var(${style.cssVar})` }}
                      strokeWidth={Math.min(style.width, 3)} strokeDasharray={style.dash} />
                  </svg>
                  <span className="min-w-0">
                    <span className="font-medium text-fg">{style.label}</span>
                    <span className="tabular-nums text-fg-2"> ({edgeCounts[type] ?? 0})</span>
                    <span className="block text-xs text-fg-2">{style.help}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  )
}
