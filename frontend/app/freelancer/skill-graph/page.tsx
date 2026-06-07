'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, GraphResponse, GraphNode, GraphLink } from '@/lib/api'
import { Network, HelpCircle, PlusCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
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

export default function SkillGraphPage() {
  const { data: session } = useSession()
  const flId = session?.user && (session.user as any).freelancerId ? Number((session.user as any).freelancerId) : 1

  const svgRef = useRef<SVGSVGElement | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [mySkills, setMySkills] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  
  // Suggested skills to add (nodes connected to my current skills)
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([])
  
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadGraphData = async () => {
    try {
      const fl = await api.freelancers.get(flId)
      setMySkills(fl.skills || [])
      
      const graphData = await api.graph()
      
      // Localized filtering:
      // Keep freelancer node, direct skill nodes, direct project nodes connected to freelancer.
      const flNodeId = `F${flId}`
      
      const directLinks = graphData.links.filter(
        l => l.source === flNodeId || l.target === flNodeId
      )
      
      const connectedNodeIds = new Set<string>([flNodeId])
      directLinks.forEach(l => {
        connectedNodeIds.add(l.source)
        connectedNodeIds.add(l.target)
      })

      // Also get secondary skill connections (related skills of freelancer's skills)
      // to display suggested skill nodes
      const secondaryLinks = graphData.links.filter(
        l => l.type === 'RELATED_TO' && (connectedNodeIds.has(l.source) || connectedNodeIds.has(l.target))
      )
      
      secondaryLinks.forEach(l => {
        connectedNodeIds.add(l.source)
        connectedNodeIds.add(l.target)
      })

      const filteredNodes = graphData.nodes.filter(n => connectedNodeIds.has(n.id))
      const allFilteredLinks = [...directLinks, ...secondaryLinks]

      // Filter duplicate links
      const uniqueLinksMap = new Map<string, GraphLink>()
      allFilteredLinks.forEach(l => {
        const key = `${l.source}-${l.target}`
        uniqueLinksMap.set(key, l)
      })
      const filteredLinks = Array.from(uniqueLinksMap.values())

      renderD3Graph(filteredNodes, filteredLinks, flNodeId)
      
      // Calculate suggested skills: Skills connected to my skills but not in my skills
      const declaredSkillsSet = new Set(fl.skills || [])
      const suggestions = new Set<string>()
      
      secondaryLinks.forEach(l => {
        const srcNode = graphData.nodes.find(n => n.id === l.source)
        const tgtNode = graphData.nodes.find(n => n.id === l.target)
        if (srcNode?.type === 'skill' && tgtNode?.type === 'skill') {
          if (declaredSkillsSet.has(srcNode.name) && !declaredSkillsSet.has(tgtNode.name)) {
            suggestions.add(tgtNode.name)
          }
          if (declaredSkillsSet.has(tgtNode.name) && !declaredSkillsSet.has(srcNode.name)) {
            suggestions.add(srcNode.name)
          }
        }
      })
      
      setSuggestedSkills(Array.from(suggestions))
      setLoading(false)
    } catch (err) {
      console.error('Failed to load graph view:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGraphData()
  }, [flId])

  const renderD3Graph = (nodesData: GraphNode[], linksData: GraphLink[], flNodeId: string) => {
    if (!svgRef.current) return

    // Clear previous drawing
    d3.select(svgRef.current).selectAll('*').remove()

    const width = 600
    const height = 400

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')

    // Create a container group for zooming
    const container = svg.append('g')

    // Zooming support
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoomBehavior)

    // Deep clones to prevent d3 mutation issues
    const nodes: ExtendedNode[] = nodesData.map(d => ({ ...d }))
    const links: ExtendedLink[] = linksData.map(d => ({ ...d }))

    // Simulation forces
    const simulation = d3.forceSimulation<ExtendedNode>(nodes)
      .force('link', d3.forceLink<ExtendedNode, ExtendedLink>(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))

    // Arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#475569')

    // Render Links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('marker-end', d => d.type === 'RELATED_TO' ? 'url(#arrow)' : null)

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
      .call(d3.drag<SVGGElement, ExtendedNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any
      )

    // Draw node shapes
    node.append('circle')
      .attr('r', d => d.id === flNodeId ? 22 : d.type === 'skill' ? 16 : 14)
      .attr('fill', d => {
        if (d.id === flNodeId) return '#00d4a4' // Freelancer is mint color
        if (d.type === 'skill') return '#6366f1' // Skill is electric indigo
        return '#f59e0b' // Project is amber
      })
      .attr('stroke', d => d.id === flNodeId ? '#0e131f' : 'transparent')
      .attr('stroke-width', 2)
      .attr('filter', d => d.id === flNodeId ? 'drop-shadow(0 0 8px rgba(0, 212, 164, 0.4))' : 'none')

    // Node labels
    node.append('text')
      .text(d => d.name)
      .attr('y', d => d.id === flNodeId ? 32 : 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
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

  const handleAddSkill = async (skillName: string) => {
    setActionLoading(true)
    setSuccessMsg(null)
    try {
      const updatedSkills = [...mySkills, skillName]
      await api.freelancers.update(flId, { skills: updatedSkills })
      setSuccessMsg(`Skill "${skillName}" successfully added! Refreshing graph...`)
      setMySkills(updatedSkills)
      
      // Reload graph
      await loadGraphData()
      setActionLoading(false)
    } catch (err) {
      console.error('Failed to append skill:', err)
      setActionLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-radial from-slate-900/40 to-transparent p-6 border border-white/5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Network className="h-5.5 w-5.5 text-mint" /> Localized Skills Network
          </h2>
          <p className="text-xs text-slate-400 mt-1">Interactive graph showing connections to your skills and active projects.</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Main Grid: D3 Viewer Left, Info Panel Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left D3 Container */}
        <div className="lg:col-span-2 glass-card p-6 min-h-[450px] bg-slate-950/20 flex items-center justify-center relative overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-mint border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Drawing D3 force networks...</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full max-h-[400px]" />
          )}

          {/* D3 Instructions Overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-white/5 px-3 py-2 rounded-lg text-[10px] text-slate-400 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-slate-500" />
            <span>Click and drag nodes to inspect connections. Scroll/pinch to zoom.</span>
          </div>
        </div>

        {/* Right Info Sidebar Panels */}
        <div className="lg:col-span-1 space-y-6">
          {/* Selected Node details */}
          <div className="glass-card p-6 space-y-4 min-h-[180px]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
              Selected Item Details
            </h3>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Node Type</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      selectedNode.type === 'freelancer' ? 'bg-mint' : selectedNode.type === 'skill' ? 'bg-electric' : 'bg-amber'
                    }`} />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">{selectedNode.type}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Node Name</span>
                  <h4 className="text-base font-bold text-white mt-1">{selectedNode.name}</h4>
                </div>

                {selectedNode.type === 'skill' && (
                  <div className="pt-2">
                    {mySkills.includes(selectedNode.name) ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-mint/10 border border-mint/20 text-mint text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Already declared skill
                      </span>
                    ) : (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleAddSkill(selectedNode.name)}
                        className="btn btn-sm btn-primary bg-mint hover:bg-emerald-400 border-none text-ink font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> Suggest Add to Profile
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic py-6 text-center">
                Click on any node in the graph to view details and suggestions.
              </p>
            )}
          </div>

          {/* Suggested skills list */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
              Ontology Recommendations
            </h3>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Based on skill ontology links, we suggest declared experts consider appending:
            </p>

            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {suggestedSkills.length === 0 ? (
                <p className="text-slate-500 text-xs italic py-4 text-center">No new skill suggestions available.</p>
              ) : (
                suggestedSkills.map(skill => (
                  <div key={skill} className="flex justify-between items-center p-2 rounded-lg bg-slate-950/20 border border-white/3 text-xs">
                    <span className="text-slate-300 font-semibold">{skill}</span>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleAddSkill(skill)}
                      className="text-mint hover:text-emerald-400 font-medium cursor-pointer flex items-center gap-1"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
