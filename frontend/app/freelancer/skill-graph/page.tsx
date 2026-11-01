'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, GraphNode, GraphLink } from '@/lib/api'
import { Check, Plus } from 'lucide-react'
import * as d3 from 'd3'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, Notice, Spinner } from '@/components/ui/States'
import { fitToView, graphPalette, NODE_TYPE_LABEL } from '@/lib/graphColors'

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
}

export default function SkillGraphPage() {
  const { data: session } = useSession()
  const flId = session?.user?.freelancerId ? Number(session.user.freelancerId) : 1

  const svgRef = useRef<SVGSVGElement | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [mySkills, setMySkills] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  
  // Suggested skills to add (nodes connected to my current skills)
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([])
  
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nodeCount, setNodeCount] = useState(0)

  const renderD3Graph = (nodesData: GraphNode[], linksData: GraphLink[], flNodeId: string) => {
    if (!svgRef.current) return
    const color = graphPalette()

    // Clear previous drawing
    d3.select(svgRef.current).selectAll('*').remove()

    const width = 600
    const height = 400

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')

    const container = svg.append('g')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoomBehavior)

    // Deep clones to prevent d3 mutation issues
    const nodes: ExtendedNode[] = nodesData.map(d => ({ ...d }))
    const links: ExtendedLink[] = linksData.map(d => ({ ...d }))

    const simulation = d3.forceSimulation<ExtendedNode>(nodes)
      .force('link', d3.forceLink<ExtendedNode, ExtendedLink>(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))

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
      .attr('fill', color.link)

    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', color.link)
      .attr('stroke-width', 1.5)
      .attr('marker-end', d => d.type === 'RELATED_TO' ? 'url(#arrow)' : null)

    const drag = d3.drag<SVGGElement, ExtendedNode>()
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
        d.fx = null
        d.fy = null
      })

    const node = container.append('g')
      .selectAll<SVGGElement, ExtendedNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `${NODE_TYPE_LABEL[d.type]}: ${d.name}`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => setSelectedNode(d))
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setSelectedNode(d)
        }
      })
      .call(drag)

    node.append('circle')
      .attr('r', d => d.id === flNodeId ? 20 : d.type === 'skill' ? 14 : 12)
      .attr('fill', d => (d.id === flNodeId ? color.you : d.type === 'freelancer' ? color.freelancer : d.type === 'skill' ? color.skill : color.project))
      .attr('stroke', color.halo)
      .attr('stroke-width', 2)

    node.append('text')
      .text(d => d.name)
      .attr('y', d => d.id === flNodeId ? 32 : 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', d => (d.id === flNodeId ? '700' : '500'))
      .attr('fill', color.label)
      .attr('paint-order', 'stroke')
      .attr('stroke', color.halo)
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
  }

  const loadGraphData = async () => {
    try {
      const fl = await api.freelancers.get(flId)
      setMySkills(fl.skills || [])
      
      // The subgraph centred on this freelancer: their skills, related skills, projects and collaborators.
      const graphData = await api.graph({ freelancerId: flId })
      
      // Localized filtering:
      // Keep freelancer node, direct skill nodes, direct project nodes connected to freelancer.
      const flNodeId = `f-${flId}`
      
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

      setNodeCount(filteredNodes.length)
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
      setError(err instanceof Error && err.message.startsWith('403') ? 'This account isn’t linked to a freelancer profile, so there’s no skill graph to show.' : 'Your skill graph couldn’t be loaded. Refresh the page to try again.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGraphData()
  }, [flId])

  const handleAddSkill = async (skillName: string) => {
    setActionLoading(true)
    setSuccessMsg(null)
    setError(null)
    try {
      const updatedSkills = [...mySkills, skillName]
      await api.freelancers.update(flId, { skills: updatedSkills })
      setSuccessMsg(`${skillName} added to your profile.`)
      setMySkills(updatedSkills)
      
      // Reload graph
      await loadGraphData()
      setActionLoading(false)
    } catch (err) {
      console.error('Failed to append skill:', err)
      setError(`${skillName} wasn’t added to your profile. Try again.`)
      setActionLoading(false)
    }
  }

  const legend = [
    { label: 'You', cls: 'bg-primary' },
    { label: 'Other freelancer', cls: 'bg-fg-2' },
    { label: 'Skill', cls: 'bg-teal' },
    { label: 'Project', cls: 'bg-star' },
  ]

  return (
    <>
      <PageHeader
        title="Skill graph"
        description="Your skills and projects in ClearHire’s knowledge graph, plus related skills the graph links to yours. Adding a related skill can widen your matches."
      />
      <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {successMsg && <Notice tone="ok">{successMsg}</Notice>}
          {error && <ErrorState message={error} />}

          <section aria-label="Graph" className="overflow-hidden rounded-panel border border-line-2 bg-panel shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <ul className="flex flex-wrap gap-4 text-[13px] text-fg-2" aria-label="Legend">
                {legend.map(l => (
                  <li key={l.label} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${l.cls}`} aria-hidden />
                    {l.label}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg-2">Drag to rearrange. Scroll or pinch to zoom. Select a node for details.</p>
            </div>
            <div className="relative aspect-[3/2] min-h-72 w-full bg-canvas">
              {/* The svg stays mounted so D3 can draw as soon as data arrives. */}
              <svg ref={svgRef} className="absolute inset-0 h-full w-full" role="group" aria-label="Your skill graph" />
              {loading && (
                <p role="status" className="absolute inset-0 grid place-items-center text-sm text-fg-2">
                  <span className="flex items-center gap-2"><Spinner /> Loading your graph</span>
                </p>
              )}
              {!loading && !error && nodeCount <= 1 && (
                <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-2">
                  The graph has no connections for your profile yet. Add skills on your profile to appear here.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <Panel title="Selected node">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge>{NODE_TYPE_LABEL[selectedNode.type]}</Badge>
                </div>
                <p className="text-base font-semibold text-fg">{selectedNode.name}</p>
                {selectedNode.type === 'skill' && (
                  mySkills.includes(selectedNode.name) ? (
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                      <Check className="h-4 w-4" aria-hidden /> On your profile
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleAddSkill(selectedNode.name)}
                      className="btn btn-sm btn-primary"
                    >
                      <Plus aria-hidden /> Add to my profile
                    </button>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-fg-2">Select a node in the graph to see what it is.</p>
            )}
          </Panel>

          <Panel title="Related skills" description="Linked to skills you already list, according to the skill ontology.">
            {suggestedSkills.length === 0 ? (
              <p className="text-sm text-fg-2">{loading ? 'Loading…' : 'No related skills to suggest right now.'}</p>
            ) : (
              <ul className="-my-2 max-h-72 divide-y divide-line overflow-y-auto">
                {suggestedSkills.map(skill => (
                  <li key={skill} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm font-medium text-fg">{skill}</span>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleAddSkill(skill)}
                      className="btn btn-sm btn-ghost text-primary-ink"
                      aria-label={`Add ${skill} to my profile`}
                    >
                      <Plus aria-hidden /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </>
  )
}
