import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  label: string;
  risk: number;
  pagerank: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Edge {
  source: string | Node;
  target: string | Node;
  value: number;
  timestamp: string;
}

interface UseD3ForceGraphProps {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
  selectedLayout: string;
  cycles: Array<Array<string>>;
}

export const useD3ForceGraph = ({
  nodes,
  edges,
  width,
  height,
  onNodeClick,
  onNodeHover,
  selectedLayout,
  cycles
}: UseD3ForceGraphProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, Edge> | null>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    
    // Create container group for zoom/pan
    const container = svg.append('g').attr('class', 'container');

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Clone nodes and edges to avoid mutation
    const graphNodes = nodes.map(d => ({ ...d }));
    const graphEdges = edges.map(d => ({ ...d }));

    // Create force simulation based on layout
    let simulation: d3.Simulation<Node, Edge>;

    if (selectedLayout === 'circular') {
      // Circular layout
      const radius = Math.min(width, height) * 0.35;
      graphNodes.forEach((node, i) => {
        const angle = (i / graphNodes.length) * 2 * Math.PI;
        node.x = width / 2 + Math.cos(angle) * radius;
        node.y = height / 2 + Math.sin(angle) * radius;
        node.fx = node.x;
        node.fy = node.y;
      });

      simulation = d3.forceSimulation(graphNodes)
        .force('charge', d3.forceManyBody().strength(-30))
        .force('link', d3.forceLink<Node, Edge>(graphEdges).id(d => d.id).distance(50))
        .alphaDecay(0.1);

    } else if (selectedLayout === 'hierarchical') {
      // Hierarchical layout by risk
      const layers: { [key: number]: Node[] } = {};
      graphNodes.forEach(node => {
        const layer = Math.floor(node.risk * 4);
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(node);
      });

      const layerHeight = height / 5;
      Object.keys(layers).forEach((layerKey, layerIndex) => {
        const layer = layers[parseInt(layerKey)];
        const spacing = width / (layer.length + 1);
        layer.forEach((node, i) => {
          node.x = spacing * (i + 1);
          node.y = layerHeight * layerIndex + 50;
          node.fx = node.x;
          node.fy = node.y;
        });
      });

      simulation = d3.forceSimulation(graphNodes)
        .force('charge', d3.forceManyBody().strength(-50))
        .force('link', d3.forceLink<Node, Edge>(graphEdges).id(d => d.id).distance(100))
        .alphaDecay(0.1);

    } else {
      // Force-directed layout (default)
      simulation = d3.forceSimulation(graphNodes)
        .force('charge', d3.forceManyBody().strength(-300))
        .force('link', d3.forceLink<Node, Edge>(graphEdges).id(d => d.id).distance(100))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    }

    simulationRef.current = simulation;

    // Helper: Check if node is in any cycle
    const isInCycle = (nodeId: string) => {
      return cycles.some(cycle => cycle.includes(nodeId));
    };

    // Helper: Get node color based on risk
    const getNodeColor = (risk: number) => {
      if (risk >= 0.8) return '#ef4444'; // Red
      if (risk >= 0.7) return '#f97316'; // Orange
      if (risk >= 0.4) return '#eab308'; // Yellow
      return '#10b981'; // Green
    };

    // Helper: Get node radius based on PageRank
    const getNodeRadius = (pagerank: number) => {
      return 5 + pagerank * 500; // Scale PageRank to visible size
    };

    // Helper: Get edge color based on timestamp
    const getEdgeColor = (timestamp: string) => {
      if (!timestamp) return 'rgba(100, 116, 139, 0.3)';
      
      const txDate = new Date(timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) return 'rgba(59, 130, 246, 0.6)'; // Bright blue (recent)
      if (hoursDiff < 168) return 'rgba(59, 130, 246, 0.4)'; // Medium blue
      return 'rgba(100, 116, 139, 0.2)'; // Faded gray (old)
    };

    // Draw edges
    const link = container.append('g')
      .selectAll('line')
      .data(graphEdges)
      .join('line')
      .attr('stroke', d => getEdgeColor(d.timestamp))
      .attr('stroke-width', d => Math.sqrt(d.value) * 0.5 + 1)
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const node = container.append('g')
      .selectAll('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', d => getNodeRadius(d.pagerank))
      .attr('fill', d => getNodeColor(d.risk))
      .attr('stroke', d => isInCycle(d.id) ? '#ffffff' : 'rgba(255, 255, 255, 0.3)')
      .attr('stroke-width', d => isInCycle(d.id) ? 3 : 1)
      .style('cursor', 'pointer');

    // Add labels for high-risk nodes
    const label = container.append('g')
      .selectAll('text')
      .data(graphNodes.filter(d => d.risk >= 0.7))
      .join('text')
      .text(d => d.label)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', '#e5e7eb')
      .style('pointer-events', 'none');

    // Drag behavior
    const drag = d3.drag<SVGCircleElement, Node>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (selectedLayout === 'force') {
          d.fx = null;
          d.fy = null;
        }
      });

    node.call(drag);

    // Click behavior
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (onNodeClick) onNodeClick(d);
    });

    // Hover behavior
    node.on('mouseenter', (event, d) => {
      if (onNodeHover) onNodeHover(d);
      d3.select(event.currentTarget)
        .transition()
        .duration(200)
        .attr('r', getNodeRadius(d.pagerank) * 1.5)
        .attr('stroke-width', 3);
    });

    node.on('mouseleave', (event, d) => {
      if (onNodeHover) onNodeHover(null);
      d3.select(event.currentTarget)
        .transition()
        .duration(200)
        .attr('r', getNodeRadius(d.pagerank))
        .attr('stroke-width', isInCycle(d.id) ? 3 : 1);
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      label
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };

  }, [nodes, edges, width, height, selectedLayout, cycles]);

  return svgRef;
};
