import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  TrendingUp, 
  Network, 
  RefreshCw, 
  Download, 
  Copy,
  Eye,
  Shield,
  Users,
  Activity,
  FileJson
} from "lucide-react";

interface FraudDetectionResults {
  stronglyConnectedComponents: Array<Array<string>>;
  cycles: Array<Array<string>>;
  highRiskNodes: Array<{ address: string; risk: number; reason: string }>;
  pageRankScores: Record<string, number>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    suspiciousNodes: number;
    riskScore: number;
    riskThreshold: number;
  };
}

interface FraudResultsProps {
  results: FraudDetectionResults;
  detailedMetrics: any[];
  gcnGraphSuspiciousOnly?: any;
  gcnGraphWithNeighbors?: any;
  temporalAnalysis?: any;
  bridgeNodes?: any;
  communityAnalysis?: any;
}

const FraudResults: React.FC<FraudResultsProps> = ({ 
  results, 
  detailedMetrics,
  gcnGraphSuspiciousOnly,
  gcnGraphWithNeighbors,
  temporalAnalysis,
  bridgeNodes,
  communityAnalysis
}) => {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  const getRiskBadgeVariant = (risk: number) => {
    if (risk >= 0.8) return "destructive";
    if (risk >= 0.6) return "warning";
    if (risk >= 0.4) return "secondary";
    return "default";
  };

  const getRiskLabel = (risk: number) => {
    if (risk >= 0.8) return "Critical";
    if (risk >= 0.6) return "High";
    if (risk >= 0.4) return "Medium";
    return "Low";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      analysis: results,
      summary: {
        totalNodes: results.stats.totalNodes,
        totalEdges: results.stats.totalEdges,
        suspiciousNodes: results.stats.suspiciousNodes,
        overallRiskScore: results.stats.riskScore
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fraud-analysis-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSuspiciousNodesCSV = () => {
    // Filter nodes above dynamic threshold
    const suspiciousMetrics = detailedMetrics.filter(
      m => m.micro_score >= results.stats.riskThreshold
    );
    
    // Create CSV header - FIXED to match all 10 columns
    const headers = [
      'wallet_address', 
      'degree', 
      'in_degree',
      'out_degree',
      'pagerank', 
      'tx_entropy', 
      'micro_score', 
      'tx_freq',
      'in_neighbors',
      'out_neighbors'
    ];
    
    const csvContent = [
      headers.join(','),
      ...suspiciousMetrics.map(metric => 
        [
          metric.wallet_address,
          metric.degree,
          metric.in_degree,
          metric.out_degree,
          metric.pagerank.toFixed(6),
          metric.tx_entropy.toFixed(6),
          metric.micro_score.toFixed(6),
          metric.tx_freq,
          `"${metric.in_neighbors.join(';')}"`,
          `"${metric.out_neighbors.join(';')}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suspicious-nodes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // NEW: Export GCN-ready JSON (Suspicious nodes only)
  const exportGCNGraphSuspiciousOnly = () => {
    if (!gcnGraphSuspiciousOnly) {
      alert('GCN graph data not available');
      return;
    }

    const blob = new Blob([JSON.stringify(gcnGraphSuspiciousOnly, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gcn-graph-suspicious-only-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // NEW: Export GCN-ready JSON (With 1-hop neighbors)
  const exportGCNGraphWithNeighbors = () => {
    if (!gcnGraphWithNeighbors) {
      alert('GCN graph data not available');
      return;
    }

    const blob = new Blob([JSON.stringify(gcnGraphWithNeighbors, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gcn-graph-with-neighbors-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Summary Alert with Dynamic Threshold */}
      <Alert className={`border-${results.stats.riskScore >= 0.7 ? 'destructive' : results.stats.riskScore >= 0.4 ? 'warning' : 'success'}/20 bg-${results.stats.riskScore >= 0.7 ? 'destructive' : results.stats.riskScore >= 0.4 ? 'warning' : 'success'}/10`}>
        <Shield className={`h-4 w-4 text-${results.stats.riskScore >= 0.7 ? 'destructive' : results.stats.riskScore >= 0.4 ? 'warning' : 'success'}`} />
        <AlertDescription className={`text-${results.stats.riskScore >= 0.7 ? 'destructive' : results.stats.riskScore >= 0.4 ? 'warning' : 'success'}`}>
          <strong>Analysis Complete:</strong> Found {results.stats.suspiciousNodes} suspicious wallets 
          with an overall network risk score of {(results.stats.riskScore * 100).toFixed(1)}%.
          <br />
          <strong>Dynamic Threshold:</strong> {(results.stats.riskThreshold * 100).toFixed(2)}% 
          (based on average risk across all nodes)
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <Button onClick={exportResults} variant="outline" className="flex items-center gap-2 text-xs md:text-sm h-8 md:h-10 px-2 md:px-4">
          <Download className="h-3 w-3 md:h-4 md:w-4" />
          <span className="hidden sm:inline">Export Full Results (JSON)</span>
          <span className="sm:hidden">Results</span>
        </Button>
        
        <Button onClick={exportSuspiciousNodesCSV} variant="outline" className="flex items-center gap-2 text-xs md:text-sm h-8 md:h-10 px-2 md:px-4">
          <Download className="h-3 w-3 md:h-4 md:w-4" />
          <span className="hidden sm:inline">Download Suspicious Nodes (CSV)</span>
          <span className="sm:hidden">CSV</span>
        </Button>

        <div className="hidden md:block h-6 w-px bg-border" />

        <Button 
          onClick={exportGCNGraphSuspiciousOnly} 
          variant="default" 
          className="flex items-center gap-2 bg-primary text-xs md:text-sm h-8 md:h-10 px-2 md:px-4"
        >
          <FileJson className="h-3 w-3 md:h-4 md:w-4" />
          <span className="hidden lg:inline">GCN Graph (Suspicious Only)</span>
          <span className="lg:hidden">GCN Suspicious</span>
        </Button>
        
        <Button 
          onClick={exportGCNGraphWithNeighbors} 
          variant="default" 
          className="flex items-center gap-2 bg-accent text-xs md:text-sm h-8 md:h-10 px-2 md:px-4"
        >
          <FileJson className="h-3 w-3 md:h-4 md:w-4" />
          <span className="hidden lg:inline">GCN Graph (With Neighbors)</span>
          <span className="lg:hidden">GCN + Neighbors</span>
        </Button>
      </div>

      {/* GCN Export Info */}
      {gcnGraphSuspiciousOnly && gcnGraphWithNeighbors && (
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              GCN Graph Export Options
            </CardTitle>
            <CardDescription>
              Two graph structures available for Graph Convolutional Network training
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">Option 1</Badge>
                  <h4 className="font-medium">Suspicious Only</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Contains only nodes above risk threshold and edges between them
                </p>
                <div className="space-y-1 text-xs">
                  <p>• Nodes: <strong>{gcnGraphSuspiciousOnly.nodes.length}</strong></p>
                  <p>• Edges: <strong>{gcnGraphSuspiciousOnly.edges.length}</strong></p>
                  <p>• Best for: Focused fraud pattern detection</p>
                </div>
              </div>

              <div className="p-4 border border-accent/20 rounded-lg bg-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Option 2</Badge>
                  <h4 className="font-medium">With 1-Hop Neighbors</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Includes suspicious nodes + their immediate neighbors (more context)
                </p>
                <div className="space-y-1 text-xs">
                  <p>• Nodes: <strong>{gcnGraphWithNeighbors.nodes.length}</strong></p>
                  <p>• Edges: <strong>{gcnGraphWithNeighbors.edges.length}</strong></p>
                  <p>• Best for: Capturing neighborhood patterns</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="high-risk" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-secondary/50 h-auto">
          <TabsTrigger value="high-risk" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">High Risk Wallets</span>
            <span className="sm:hidden">High Risk</span>
          </TabsTrigger>
          <TabsTrigger value="scc" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
            <Users className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Connected Components</span>
            <span className="sm:hidden">Groups</span>
          </TabsTrigger>
          <TabsTrigger value="cycles" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
            <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Detected Cycles</span>
            <span className="sm:hidden">Cycles</span>
          </TabsTrigger>
          <TabsTrigger value="pagerank" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Influence Ranking</span>
            <span className="sm:hidden">Ranking</span>
          </TabsTrigger>
          <TabsTrigger value="communities" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
            <Users className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Communities</span>
            <span className="sm:hidden">Groups</span>
          </TabsTrigger>
          <TabsTrigger value="temporal" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
            <Activity className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Temporal</span>
            <span className="sm:hidden">Time</span>
          </TabsTrigger>
        </TabsList>

        {/* High Risk Wallets */}
        <TabsContent value="high-risk" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  High Risk Wallets
                </span>
                <Badge variant="destructive">
                  {results.highRiskNodes.length} found
                </Badge>
              </CardTitle>
              <CardDescription>
                Wallets flagged above dynamic threshold ({(results.stats.riskThreshold * 100).toFixed(2)}%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {results.highRiskNodes.map((node, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {formatAddress(node.address)}
                          </code>
                          <Badge variant={getRiskBadgeVariant(node.risk)}>
                            {getRiskLabel(node.risk)} ({(node.risk * 100).toFixed(1)}%)
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{node.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(node.address)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAddress(node.address)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strongly Connected Components */}
        <TabsContent value="scc" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-warning" />
                  Strongly Connected Components
                </span>
                <Badge variant="warning">
                  {results.stronglyConnectedComponents.length} groups
                </Badge>
              </CardTitle>
              <CardDescription>
                Groups of wallets with circular transaction patterns (potential scam rings)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {results.stronglyConnectedComponents.map((component, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Component {index + 1}</h4>
                        <Badge variant="secondary">{component.length} wallets</Badge>
                      </div>
                      <div className="space-y-2">
                        {component.map((address, addrIndex) => (
                          <div key={addrIndex} className="flex items-center justify-between">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {formatAddress(address)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(address)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cycles */}
        <TabsContent value="cycles" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-accent" />
                  Transaction Cycles
                </span>
                <Badge variant="secondary">
                  {results.cycles.length} cycles
                </Badge>
              </CardTitle>
              <CardDescription>
                Circular transaction patterns indicating potential wash trading
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {results.cycles.map((cycle, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Cycle {index + 1}</h4>
                        <Badge variant="secondary">{cycle.length} hops</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {cycle.map((address, addrIndex) => (
                          <React.Fragment key={addrIndex}>
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                              {formatAddress(address)}
                            </code>
                            {addrIndex < cycle.length - 1 && (
                              <span className="text-muted-foreground">→</span>
                            )}
                          </React.Fragment>
                        ))}
                        <span className="text-muted-foreground">↻</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PageRank */}
        <TabsContent value="pagerank" className="space-y-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Influence Ranking (PageRank)
                </span>
                <Badge variant="secondary">
                  Top 20 influential wallets
                </Badge>
              </CardTitle>
              <CardDescription>
                Most influential wallets based on transaction volume and network centrality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {Object.entries(results.pageRankScores)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 20)
                    .map(([address, score], index) => (
                      <div 
                        key={address}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
                            {index + 1}
                          </div>
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {formatAddress(address)}
                          </code>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{(score * 1000).toFixed(3)}</p>
                            <p className="text-xs text-muted-foreground">PageRank Score</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(address)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communities Tab */}
        <TabsContent value="communities" className="space-y-4">
          {communityAnalysis && (
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-warning" />
                    Fraud Ring Detection
                  </span>
                  <Badge variant="warning">
                    {communityAnalysis.suspiciousCommunities?.length || 0} suspicious groups
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Isolated communities with high internal transaction ratios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {communityAnalysis.suspiciousCommunities?.map((community: any, idx: number) => (
                      <div key={idx} className="border border-destructive/30 rounded-lg p-4 bg-destructive/5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Community {community.communityId}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">{community.size} wallets</Badge>
                            <Badge variant="outline">
                              {(community.internalTxRatio * 100).toFixed(1)}% internal
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-muted-foreground">Avg Risk:</span>
                            <span className="ml-2 font-semibold">{(community.avgRisk * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Volume:</span>
                            <span className="ml-2 font-semibold">{community.totalVolume.toFixed(4)} ETH</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {community.members.slice(0, 5).map((addr: string) => (
                            <code key={addr} className="block bg-muted px-2 py-1 rounded my-1">
                              {formatAddress(addr)}
                            </code>
                          ))}
                          {community.members.length > 5 && (
                            <p className="mt-2">+ {community.members.length - 5} more wallets</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Temporal Tab */}
        <TabsContent value="temporal" className="space-y-4">
          {temporalAnalysis && (
            <>
              {/* Burst Activity */}
              {temporalAnalysis.burstActivity?.length > 0 && (
                <Card className="bg-gradient-card border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-destructive" />
                      Burst Activity Detected
                    </CardTitle>
                    <CardDescription>Sudden spikes in transaction volume (Pump & Dump indicator)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {temporalAnalysis.burstActivity.map((burst: any, idx: number) => (
                        <div key={idx} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {new Date(burst.timestamp * 1000).toLocaleString()}
                            </span>
                            <Badge variant={burst.suspicionLevel === 'critical' ? 'destructive' : 'warning'}>
                              {burst.multiplier.toFixed(1)}x spike
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {burst.transactionCount} transactions ({burst.addresses.length} unique addresses)
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dormant Wakeups */}
              {temporalAnalysis.dormantWakeups?.length > 0 && (
                <Card className="bg-gradient-card border-border shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Dormant Wallet Activation
                    </CardTitle>
                    <CardDescription>Wallets inactive for 30+ days suddenly active (hacked account indicator)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {temporalAnalysis.dormantWakeups.map((wakeup: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 border border-border rounded">
                            <code className="text-xs font-mono">{formatAddress(wakeup.address)}</code>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{wakeup.dormantDays} days</Badge>
                              <Badge variant={wakeup.suspicionLevel === 'high' ? 'destructive' : 'warning'}>
                                {wakeup.suspicionLevel}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FraudResults;