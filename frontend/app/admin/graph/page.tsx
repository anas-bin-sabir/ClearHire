'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, GraphResponse, GraphNode, GraphLink } from '@/lib/api'
import { Network, HelpCircle, Eye, ShieldAlert, Award } from 'lucide-react'
import * as d3 from 'd3'

interface ExtendedNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: 'freelancer' | 'skill' | 'project'
  fraud_score?: number
}

interface ExtendedLink extends d3.SimulationLinkDatum<ExtendedNode> {
  source: string | ExtendedNode
  target: string | ExtendedNode
  type: string
}

export default function AdminGraphPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dataSource, setDataSource] = useState<string>('postgres')

  useEffect(() => {
    let active = true

    api.graph()
      .then(res => {
        if (!active) return
        setDataSource(res.source)
        renderFullD3Graph(res.nodes, res.links)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load full graph:', err)
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const renderFullD3Graph = (nodesData: GraphNode[], linksData: GraphLink[]) => {
    if (!svgRef.current) return

    // Clear previous drawing
    d3.select(svgRef.current).selectAll('*').remove()

    const width = 800
    const height = 500

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')

    // Zoom container
    const container = svg.append('g')

    // Zooming behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoomBehavior)

    const nodes: ExtendedNode[] = nodesData.map(d => ({ ...d }))
    const links: ExtendedLink[] = linksData.map(d => ({ ...d }))

    // Simulation settings
    const simulation = d3.forceSimulation<ExtendedNode>(nodes)
      .force('link', d3.forceLink<ExtendedNode, ExtendedLink>(links).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))

    // Arrow marker defs
    svg.append('defs').append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#334155')

    // Render Links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#graph-arrow)')

    // Render Nodes
    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group cursor-pointer')
      .on('click', (event, d) => {
        setSelectedNode(d)
      })
      .on('dblclick', (event, d) => {
        if (d.type === 'freelancer') {
          // Double click freelancer node goes to profile inspector
          const flId = d.id.replace('F', '')
          router.push(`/admin/members?q=${flId}`)
        }
      })
      .call(d3.drag<SVGGElement, ExtendedNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any
      )

    // Draw node shapes
    node.each(function(d) {
      const el = d3.select(this)
      
      if (d.type === 'freelancer') {
        // Freelancers are circles colored by fraud score intensity (green to rose)
        const interpolator = d3.interpolateRgb('#10b981', '#f43f5e')
        const color = interpolator(d.fraud_score || 0)
        
        el.append('circle')
          .attr('r', 16)
          .attr('fill', color)
          .attr('stroke', 'rgba(255, 255, 255, 0.1)')
          .attr('stroke-width', 1.5)
          .attr('filter', 'drop-shadow(0 0 6px ' + color + '40)')
      } 
      else if (d.type === 'skill') {
        // Skills are blue diamonds (rendered as rotated squares)
        el.append('rect')
          .attr('width', 22)
          .attr('height', 22)
          .attr('x', -11)
          .attr('y', -11)
          .attr('transform', 'rotate(45)')
          .attr('fill', '#3b82f6')
          .attr('stroke', 'rgba(255, 255, 255, 0.1)')
          .attr('stroke-width', 1.5)
          .attr('filter', 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.25))')
      } 
      else {
        // Projects are amber squares
        el.append('rect')
          .attr('width', 24)
          .attr('height', 24)
          .attr('x', -12)
          .attr('y', -12)
          .attr('fill', '#f59e0b')
          .attr('stroke', 'rgba(255, 255, 255, 0.1)')
          .attr('stroke-width', 1.5)
          .attr('filter', 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.25))')
      }
    })

    // Node labels
    node.append('text')
      .text(d => d.name)
      .attr('y', 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', '500')
      .attr('fill', '#cbd5e1')
      .attr('font-family', 'system-ui, sans-serif')

    // Simulation updates
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y)

      node
        .attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Drag behavior implementations
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Network className="h-5.5 w-5.5 text-rose" /> Enterprise Knowledge Graph
          </h2>
          <p className="text-xs text-slate-400 mt-1">Full skill ontology mapping and contract relationship graph details.</p>
        </div>

        {/* Source badge */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider border uppercase ${
          dataSource.toLowerCase() === 'neo4j'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          Datastore Source: {dataSource}
        </span>
      </div>

      {/* Main Grid: D3 left, Legend & Info Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* D3 Canvas container */}
        <div className="lg:col-span-3 glass-card p-6 min-h-[520px] bg-slate-950/20 flex items-center justify-center relative overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-rose border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-slate-500">Calculating force dimensions...</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full max-h-[460px]" />
          )}

          {/* Controls Overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-white/5 px-3 py-2 rounded-lg text-[10px] text-slate-400 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-slate-500" />
            <span>Click and drag nodes. Scroll/pinch to zoom. Double-click freelancer circles to view profiles.</span>
          </div>
        </div>

        {/* Right Info panels */}
        <div className="lg:col-span-1 space-y-6">
          {/* Legend panel */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
              Graph Legend
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/10 shrink-0" />
                <div>
                  <span className="font-semibold block">Freelancer Node</span>
                  <span className="text-[10px] text-slate-500 block">Circle color intensity signifies fraud rating score.</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 bg-blue-500 transform rotate-45 shadow-md shadow-blue-500/10 shrink-0" />
                <div className="pl-0.5">
                  <span className="font-semibold block">Skill Node</span>
                  <span className="text-[10px] text-slate-500 block">Ontology classes (React, FastAPI, etc.).</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 bg-amber-500 shadow-md shadow-amber-500/10 shrink-0" />
                <div>
                  <span className="font-semibold block">Project Node</span>
                  <span className="text-[10px] text-slate-500 block">Job posts representing client allocations.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Details panel */}
          <div className="glass-card p-6 space-y-4 min-h-[200px]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
              Selected Node Info
            </h3>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Classification</span>
                  <span className="text-xs font-bold text-white block mt-1 uppercase tracking-wider">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Declared Label</span>
                  <h4 className="text-sm font-bold text-white mt-1">{selectedNode.name}</h4>
                </div>

                {selectedNode.type === 'freelancer' && (
                  <div className="space-y-3 border-t border-white/3 pt-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Risk Score:</span>
                      <span className={`font-mono font-bold ${
                        selectedNode.fraud_score && selectedNode.fraud_score > 0.65 ? 'text-rose-400' : selectedNode.fraud_score && selectedNode.fraud_score > 0.35 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {selectedNode.fraud_score ? `${Math.round(selectedNode.fraud_score * 100)}%` : '0%'}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const flId = selectedNode.id.replace('F', '')
                        router.push(`/admin/members?q=${flId}`)
                      }}
                      className="w-full btn btn-sm btn-ghost hover:bg-rose/10 hover:text-rose border-rose/15 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Inspect Profile
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic py-8 text-center">
                Select a node to inspect parameters.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
