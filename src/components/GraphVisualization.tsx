import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Network, ZoomIn, ZoomOut, RotateCw, Download, Filter } from "lucide-react";

interface GraphData {
  nodes: Array<{ id: string; label: string; risk: number; pagerank: number }>;
  edges: Array<{ source: string; target: string; value: number; timestamp: string }>;
}

interface GraphVisualizationProps {
  data: GraphData;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filterRisk, setFilterRisk] = useState([0]);
  const [selectedLayout, setSelectedLayout] = useState("force");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const filteredNodes = data.nodes.filter(node => node.risk >= filterRisk[0]);
  const filteredEdges = data.edges.filter(edge => 
    filteredNodes.some(n => n.id === edge.source) && 
    filteredNodes.some(n => n.id === edge.target)
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check if there are nodes to display
    if (filteredNodes.length === 0) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No nodes to display', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Set canvas size - work in logical pixels
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Calculate positions based on selected layout
    const positions = calculateLayout(canvas.width, canvas.height);
    drawGraph(ctx, canvas.width, canvas.height, positions);
  }, [filteredNodes, filteredEdges, zoomLevel, selectedLayout]);

  // Calculate node positions based on selected layout algorithm
  const calculateLayout = (width: number, height: number): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>();
    
    if (selectedLayout === "circular") {
      // Circular layout - arrange nodes in a circle
      filteredNodes.forEach((node, i) => {
        const angle = (i / filteredNodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.35 * zoomLevel;
        positions.set(node.id, {
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius
        });
      });
    } else if (selectedLayout === "hierarchical") {
      // Hierarchical layout - arrange by risk level in layers
      const layers: { [key: number]: typeof filteredNodes } = {};
      filteredNodes.forEach(node => {
        const layer = Math.floor(node.risk * 4); // 5 layers (0-4)
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(node);
      });

      let currentY = 50;
      const layerHeight = (height - 100) / 5;
      
      Object.keys(layers).sort().forEach(layerKey => {
        const layer = layers[parseInt(layerKey)];
        const spacing = (width - 100) / (layer.length + 1);
        
        layer.forEach((node, i) => {
          positions.set(node.id, {
            x: 50 + spacing * (i + 1),
            y: currentY * zoomLevel
          });
        });
        currentY += layerHeight;
      });
    } else {
      // Force-directed layout (simplified)
      // Start with random positions
      filteredNodes.forEach((node, i) => {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * Math.min(width, height) * 0.3;
        positions.set(node.id, {
          x: width / 2 + Math.cos(angle) * radius * zoomLevel,
          y: height / 2 + Math.sin(angle) * radius * zoomLevel
        });
      });

      // Simple force simulation (few iterations for performance)
      for (let iter = 0; iter < 50; iter++) {
        const forces = new Map<string, { x: number; y: number }>();
        
        // Initialize forces
        filteredNodes.forEach(node => {
          forces.set(node.id, { x: 0, y: 0 });
        });

        // Repulsion between all nodes
        filteredNodes.forEach((node1, i) => {
          filteredNodes.forEach((node2, j) => {
            if (i >= j) return;
            
            const pos1 = positions.get(node1.id)!;
            const pos2 = positions.get(node2.id)!;
            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
            const force = 100 / (dist * dist);
            
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const f1 = forces.get(node1.id)!;
            const f2 = forces.get(node2.id)!;
            f1.x += fx;
            f1.y += fy;
            f2.x -= fx;
            f2.y -= fy;
          });
        });

        // Attraction along edges
        filteredEdges.forEach(edge => {
          const pos1 = positions.get(edge.source);
          const pos2 = positions.get(edge.target);
          if (!pos1 || !pos2) return;
          
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const force = dist * 0.01;
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          const f1 = forces.get(edge.source);
          const f2 = forces.get(edge.target);
          if (f1) {
            f1.x += fx;
            f1.y += fy;
          }
          if (f2) {
            f2.x -= fx;
            f2.y -= fy;
          }
        });

        // Apply forces
        filteredNodes.forEach(node => {
          const pos = positions.get(node.id)!;
          const force = forces.get(node.id)!;
          pos.x += force.x * 0.1;
          pos.y += force.y * 0.1;
          
          // Keep within bounds with proper margin
          const margin = 50;
          pos.x = Math.max(margin, Math.min(width - margin, pos.x));
          pos.y = Math.max(margin, Math.min(height - margin, pos.y));
        });
      }
    }
    
    return positions;
  };

  const drawGraph = (ctx: CanvasRenderingContext2D, width: number, height: number, positions: Map<string, { x: number; y: number }>) => {
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1;
    filteredEdges.forEach(edge => {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      
      if (sourcePos && targetPos) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    filteredNodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;

      // Node size based on PageRank
      const radius = 3 + (node.pagerank * 1000);
      
      // Node color based on risk
      let color = '#10b981'; // Low risk (green)
      if (node.risk >= 0.8) color = '#ef4444'; // High risk (red)
      else if (node.risk >= 0.6) color = '#f59e0b'; // Medium risk (orange)
      else if (node.risk >= 0.4) color = '#8b5cf6'; // Low-medium risk (purple)

      // Draw node
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Highlight hovered node
      if (hoveredNode === node.id) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple click detection (would need proper implementation)
    console.log('Clicked at:', x, y);
  };

  const exportGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'ethereum-fraud-graph.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Graph Visualization Controls
          </CardTitle>
          <CardDescription>
            Interactive network analysis of Ethereum transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                  <SelectItem value="hierarchical">Hierarchical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Risk Filter */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-medium">
                Risk Threshold: {(filterRisk[0] * 100).toFixed(0)}%
              </label>
              <Slider
                value={filterRisk}
                onValueChange={setFilterRisk}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Zoom Control */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-medium">Zoom Level</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                  className="h-9"
                >
                  <ZoomOut className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <span className="text-xs md:text-sm font-mono min-w-[3rem] text-center">{(zoomLevel * 100).toFixed(0)}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}
                  className="h-9"
                >
                  <ZoomIn className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>

            {/* Export */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-medium">Export</label>
              <Button onClick={exportGraph} variant="outline" className="w-full h-9 md:h-10 text-xs md:text-sm">
                <Download className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                <span className="hidden sm:inline">Export PNG</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graph Canvas */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction Network Graph</CardTitle>
              <CardDescription>
                {filteredNodes.length} nodes, {filteredEdges.length} edges displayed
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <Filter className="h-3 w-3 mr-1" />
                Risk ≥ {(filterRisk[0] * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-64 md:h-96 border border-border rounded-lg cursor-pointer"
              style={{ 
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
                width: '100%',
                height: '16rem'
              }}
            />
            
            {/* Legend */}
            <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-card/90 backdrop-blur rounded-lg p-2 md:p-3 border border-border max-w-[140px] md:max-w-none">
              <h4 className="text-xs md:text-sm font-medium mb-1 md:mb-2">Risk Levels</h4>
              <div className="space-y-0.5 md:space-y-1 text-[10px] md:text-xs">
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-success flex-shrink-0"></div>
                  <span className="truncate">Low (&lt;40%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-purple-500 flex-shrink-0"></div>
                  <span className="truncate">Med-Low (40-60%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-warning flex-shrink-0"></div>
                  <span className="truncate">Medium (60-80%)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-destructive flex-shrink-0"></div>
                  <span className="truncate">High (&gt;80%)</span>
                </div>
              </div>
            </div>

            {/* Loading overlay for complex layouts */}
            <div className="absolute inset-0 bg-background/50 backdrop-blur rounded-lg hidden">
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RotateCw className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Calculating layout...</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graph Statistics */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-primary">{filteredNodes.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Nodes</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-accent">{filteredEdges.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Edges</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card border-border shadow-card">
          <CardContent className="p-3 md:p-4">
            <div className="text-center">
              <p className="text-lg md:text-2xl font-bold text-warning">
                {filteredNodes.filter(n => n.risk >= 0.6).length}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">High Risk</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GraphVisualization;