import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Copy, AlertTriangle, TrendingUp, Activity } from "lucide-react";
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

  // Calculate incoming and outgoing transactions
  const incomingTxs = edges.filter(e => {
    const target = typeof e.target === 'string' ? e.target : e.target.id;
    return target === node.id;
  });

  const outgoingTxs = edges.filter(e => {
    const source = typeof e.source === 'string' ? e.source : e.source.id;
    return source === node.id;
  });

  const totalIncoming = incomingTxs.reduce((sum, tx) => sum + tx.value, 0);
  const totalOutgoing = outgoingTxs.reduce((sum, tx) => sum + tx.value, 0);
  const balance = totalIncoming - totalOutgoing;

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

          {/* Transaction Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Incoming</p>
              <p className="text-lg font-bold text-success">
                {incomingTxs.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalIncoming.toFixed(4)} ETH
              </p>
            </div>
            <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
              <p className="text-xs text-muted-foreground mb-1">Outgoing</p>
              <p className="text-lg font-bold text-warning">
                {outgoingTxs.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalOutgoing.toFixed(4)} ETH
              </p>
            </div>
          </div>

          {/* Balance */}
          <div className="bg-secondary/50 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Net Flow</span>
              <span className={`text-lg font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {balance >= 0 ? '+' : ''}{balance.toFixed(4)} ETH
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
          </div>

          {/* Connected Wallets */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Connected Wallets</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {incomingTxs.slice(0, 5).map((tx, idx) => {
                const source = typeof tx.source === 'string' ? tx.source : tx.source.id;
                return (
                  <div key={idx} className="text-xs font-mono text-muted-foreground bg-secondary/30 px-2 py-1 rounded">
                    ← {source.slice(0, 10)}...{source.slice(-8)}
                  </div>
                );
              })}
              {outgoingTxs.slice(0, 5).map((tx, idx) => {
                const target = typeof tx.target === 'string' ? tx.target : tx.target.id;
                return (
                  <div key={idx} className="text-xs font-mono text-muted-foreground bg-secondary/30 px-2 py-1 rounded">
                    → {target.slice(0, 10)}...{target.slice(-8)}
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
