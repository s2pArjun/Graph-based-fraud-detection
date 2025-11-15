import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Copy, AlertTriangle, TrendingUp, Activity, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Node {
  id: string;
  label: string;
  risk: number;
  pagerank: number;
}

interface Edge {
  source: string | Node;
  target: string | Node;
  value: number;
  timestamp: string;
}

interface D3NodeDetailsPanelProps {
  node: Node | null;
  edges: Edge[];
  onClose: () => void;
}

const D3NodeDetailsPanel: React.FC<D3NodeDetailsPanelProps> = ({ node, edges, onClose }) => {
  if (!node) return null;

  // Helper: Safely get node ID from source/target
  const getNodeId = (nodeOrString: string | Node): string => {
    return typeof nodeOrString === 'string' ? nodeOrString : nodeOrString.id;
  };

  // Helper: Safely get edge value (handle undefined/null/NaN)
  const getEdgeValue = (edge: Edge): number => {
    const value = edge.value;
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return value;
    }
    return 0;
  };

  // ✅ NEW: Smart ETH formatter - shows appropriate decimals based on value
  const formatETH = (value: number): string => {
    if (value === 0) return '0 ETH';
    
    // For very small amounts (< 0.0001), use scientific notation
    if (value < 0.0001) {
      return `${value.toExponential(2)} ETH`;
    }
    
    // For small amounts (< 0.01), show 6 decimals
    if (value < 0.01) {
      return `${value.toFixed(6)} ETH`;
    }
    
    // For medium amounts (< 1), show 4 decimals
    if (value < 1) {
      return `${value.toFixed(4)} ETH`;
    }
    
    // For large amounts (>= 1), show 2 decimals
    return `${value.toFixed(2)} ETH`;
  };

  // Calculate incoming transactions
  const incomingTxs = edges.filter(e => {
    const targetId = getNodeId(e.target);
    return targetId === node.id;
  });

  // Calculate outgoing transactions
  const outgoingTxs = edges.filter(e => {
    const sourceId = getNodeId(e.source);
    return sourceId === node.id;
  });

  // Calculate totals with safe value extraction
  const totalIncoming = incomingTxs.reduce((sum, tx) => sum + getEdgeValue(tx), 0);
  const totalOutgoing = outgoingTxs.reduce((sum, tx) => sum + getEdgeValue(tx), 0);
  const balance = totalIncoming - totalOutgoing;

  // Debug logging (can be removed after confirming fix)
  console.log('Node Details Debug:', {
    nodeId: node.id,
    incomingCount: incomingTxs.length,
    outgoingCount: outgoingTxs.length,
    totalIncoming,
    totalOutgoing,
    sampleIncomingValue: incomingTxs[0] ? getEdgeValue(incomingTxs[0]) : 'N/A'
  });

  const getRiskBadgeVariant = (risk: number) => {
    if (risk >= 0.8) return "destructive";
    if (risk >= 0.7) return "default";
    if (risk >= 0.4) return "secondary";
    return "outline";
  };

  const getRiskLabel = (risk: number) => {
    if (risk >= 0.8) return "Critical Risk";
    if (risk >= 0.7) return "High Risk";
    if (risk >= 0.4) return "Medium Risk";
    return "Low Risk";
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(node.id);
    toast.success("Address copied to clipboard!");
  };

  return (
    <div className="absolute top-4 right-4 z-50 w-80 md:w-96 animate-fade-in">
      <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Wallet Details
              </CardTitle>
              <code className="text-xs font-mono text-muted-foreground mt-1 block break-all">
                {node.label}
              </code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Risk Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Assessment
              </span>
              <Badge variant={getRiskBadgeVariant(node.risk)} className="font-semibold">
                {getRiskLabel(node.risk)}
              </Badge>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  node.risk >= 0.8 ? 'bg-destructive' :
                  node.risk >= 0.7 ? 'bg-orange-500' :
                  node.risk >= 0.4 ? 'bg-yellow-500' :
                  'bg-success'
                }`}
                style={{ width: `${node.risk * 100}%` }}
              />
            </div>
            <p className="text-xs text-right text-muted-foreground">
              {(node.risk * 100).toFixed(1)}% risk score
            </p>
          </div>

          {/* PageRank */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Network Influence
              </span>
              <Badge variant="secondary">
                {(node.pagerank * 1000).toFixed(3)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              PageRank score indicates wallet's importance in the network
            </p>
          </div>

          {/* Transaction Stats - FIXED with smart formatting */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Incoming</p>
              <p className="text-lg font-bold text-success">
                {incomingTxs.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-all">
                {formatETH(totalIncoming)}
              </p>
            </div>
            <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
              <p className="text-xs text-muted-foreground mb-1">Outgoing</p>
              <p className="text-lg font-bold text-warning">
                {outgoingTxs.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-all">
                {formatETH(totalOutgoing)}
              </p>
            </div>
          </div>

          {/* Balance - FIXED with smart formatting */}
          <div className="bg-secondary/50 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Net Flow</span>
              <span className={`text-lg font-bold break-all ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {balance >= 0 ? '+' : ''}{formatETH(Math.abs(balance))}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={copyAddress}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Copy className="h-3 w-3 mr-2" />
              Copy Address
            </Button>
            <Button
              onClick={() => window.open(`https://etherscan.io/address/${node.id}`, '_blank')}
              variant="default"
              size="sm"
              className="flex-1"
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              View on Etherscan
            </Button>
          </div>

          {/* Connected Wallets */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Connected Wallets</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {incomingTxs.slice(0, 5).map((tx, idx) => {
                const sourceId = getNodeId(tx.source);
                const sourceLabel = sourceId.slice(0, 10) + '...' + sourceId.slice(-8);
                const value = getEdgeValue(tx);
                return (
                  <div key={idx} className="text-xs font-mono text-muted-foreground bg-secondary/30 px-2 py-1 rounded flex items-center justify-between gap-2">
                    <span className="truncate">← {sourceLabel}</span>
                    <span className="text-success font-semibold whitespace-nowrap">{formatETH(value)}</span>
                  </div>
                );
              })}
              {outgoingTxs.slice(0, 5).map((tx, idx) => {
                const targetId = getNodeId(tx.target);
                const targetLabel = targetId.slice(0, 10) + '...' + targetId.slice(-8);
                const value = getEdgeValue(tx);
                return (
                  <div key={idx} className="text-xs font-mono text-muted-foreground bg-secondary/30 px-2 py-1 rounded flex items-center justify-between gap-2">
                    <span className="truncate">→ {targetLabel}</span>
                    <span className="text-warning font-semibold whitespace-nowrap">{formatETH(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default D3NodeDetailsPanel;
