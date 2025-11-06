import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Download, Filter, Info } from "lucide-react";
import { useD3ForceGraph } from "@/hooks/useD3ForceGraph";
import D3NodeDetailsPanel from "./D3NodeDetailsPanel";

interface GraphData {
  nodes: Array<{ id: string; label: string; risk: number; pagerank: number }>;
  edges: Array<{ source: string; target: string; value: number; timestamp: string }>;
}

interface GraphVisualizationProps {
  data: GraphData;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data }) => {
  const [selectedLayout, setSelectedLayout] = useState("force");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [cycles, setCycles] = useState<Array<Array<string>>>([]);

  // Detect cycles in the graph (simple cycle detection)
  useEffect(() => {
    const detectCycles = () => {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      const detectedCycles: Array<Array<string>> = [];
      
      const adjacencyList = new Map<string, string[]>();
      data.edges.forEach(edge => {
        if (!adjacencyList.has(edge.source)) {
          adjacencyList.set(edge.source, []);
        }
        adjacencyList.get(edge.source)!.push(edge.target);
      });

      const dfs = (node: string, path: string[]): void => {
        visited.add(node);
        recursionStack.add(node);
        path.push(node);

        const neighbors = adjacencyList.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor, [...path]);
          } else if (recursionStack.has(neighbor)) {
            const cycleStart = path.indexOf(neighbor);
            if (cycleStart !== -1) {
              const cycle = path.slice(cycleStart);
              if (cycle.length > 1 && cycle.length <= 10) {
                detectedCycles.push(cycle);
              }
            }
          }
        }

        recursionStack.delete(node);
      };

      data.nodes.forEach(node => {
        if (!visited.has(node.id)) {
          dfs(node.id, []);
        }
      });

      setCycles(detectedCycles);
    };

    detectCycles();
  }, [data]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(600, window.innerHeight - 400)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const svgRef = useD3ForceGraph({
    nodes: data.nodes,
    edges: data.edges,
    width: dimensions.width,
    height: dimensions.height,
    onNodeClick: setSelectedNode,
    onNodeHover: setHoveredNode,
    selectedLayout,
    cycles
  });

  const exportGraph = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = 'ethereum-fraud-graph.png';
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            D3.js Interactive Graph Visualization
          </CardTitle>
          <CardDescription>
            Drag nodes • Zoom/Pan • Click for details • Hover for quick info
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Layout Selection */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-medium">Layout Algorithm</label>
              <Select value={selectedLayout} onValueChange={setSelectedLayout}>
                <SelectTrigger className="h-9 md:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="force">Force-Directed</SelectItem>
                  <SelectItem value="circular">Circular</SelectItem>
                  <SelectItem value="hierarchical">Hierarchical (by Risk)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-medium">Export</label>
              <Button onClick={exportGraph} variant="outline" className="w-full h-9 md:h-10 text-xs md:text-sm">
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                Export PNG
              </Button>
            </div>

            {/* Info */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-medium">Cycles Detected</label>
              <Badge variant="secondary" className="w-full justify-center h-9 md:h-10 text-sm">
                <Info className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                {cycles.length} cycles found
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graph Canvas */}
      <Card className="bg-gradient-card border-border shadow-card relative">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction Network Graph</CardTitle>
              <CardDescription>
                {data.nodes.length} nodes, {data.edges.length} edges
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Filter className="h-3 w-3 mr-1" />
                Interactive D3.js
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative" id="graph-container">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="border border-border rounded-lg bg-gradient-to-br from-background to-secondary/20"
              style={{ cursor: 'grab' }}
            />

            {/* Hover Tooltip */}
            {hoveredNode && !selectedNode && (
              <div className="absolute top-4 left-4 z-40 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg max-w-xs animate-fade-in">
                <div className="space-y-1">
                  <code className="text-xs font-mono text-primary">{hoveredNode.label}</code>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Risk: {(hoveredNode.risk * 100).toFixed(1)}%
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      PR: {(hoveredNode.pagerank * 1000).toFixed(2)}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Node Details Panel */}
            <D3NodeDetailsPanel
              node={selectedNode}
              edges={data.edges}
              onClose={() => setSelectedNode(null)}
            />

            {/* Legend */}
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-card/90 backdrop-blur rounded-lg p-2 md:p-3 border border-border max-w-[140px] md:max-w-none">
              <h4 className="text-xs md:text-sm font-medium mb-1 md:mb-2">Risk Levels</h4>
              <div className="space-y-0.5 md:space-y-1 text-[10px] md:text-xs">
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-success flex-shrink-0"></div>
                  <span className="truncate">Low (&lt;40%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500 flex-shrink-0"></div>
                  <span className="truncate">Medium (40-70%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-orange-500 flex-shrink-0"></div>
                  <span className="truncate">High (70-80%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-destructive flex-shrink-0"></div>
                  <span className="truncate">Critical (&gt;80%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2 pt-1 border-t border-border">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full border-2 border-white flex-shrink-0"></div>
                  <span className="truncate">In Cycle</span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-card/90 backdrop-blur rounded-lg p-2 md:p-3 border border-border max-w-[160px] md:max-w-xs">
              <h4 className="text-xs md:text-sm font-medium mb-1">Controls</h4>
              <ul className="space-y-0.5 text-[10px] md:text-xs text-muted-foreground">
                <li>🖱️ Drag nodes to move</li>
                <li>🔍 Scroll to zoom</li>
                <li>✋ Drag background to pan</li>
                <li>👆 Click node for details</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graph Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-primary">{data.nodes.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Wallets</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-accent">{data.edges.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Transactions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-warning">
                {data.nodes.filter(n => n.risk >= 0.7).length}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">High Risk</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-destructive">{cycles.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Cycles</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GraphVisualization;