// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Database, Network, AlertTriangle, TrendingUp, Activity, Shield, FileDown, Search, History,Eye } from "lucide-react";
import DataUpload from "./DataUpload";
import GraphVisualization from "./GraphVisualization";
import FraudResults from "./FraudResults";
import AddressLookupPanel from "./AddressLookupPanel";
import { analyzeFraudData } from "@/lib/graphAnalysis";
import AnalysisHistory from "./AnalysisHistory";
import WatchlistPanel from "./WatchlistPanel";


interface ProcessingStatus {
  stage: string;
  progress: number;
  message: string;
  isComplete: boolean;
}

interface GraphData {
  nodes: Array<{ id: string; label: string; risk: number; pagerank: number }>;
  edges: Array<{ source: string; target: string; value: number; timestamp: string }>;
}

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

const FraudDetectionDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("upload");
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "idle",
    progress: 0,
    message: "Ready to process data",
    isComplete: false
  });
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [fraudResults, setFraudResults] = useState<FraudDetectionResults | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [detailedMetrics, setDetailedMetrics] = useState<any[]>([]);
  const [gcnGraphSuspiciousOnly, setGcnGraphSuspiciousOnly] = useState<any>(null);
  const [gcnGraphWithNeighbors, setGcnGraphWithNeighbors] = useState<any>(null);
  const [temporalAnalysis, setTemporalAnalysis] = useState<any>(null);
  const [bridgeNodes, setBridgeNodes] = useState<any>(null);
  const [communityAnalysis, setCommunityAnalysis] = useState<any>(null);
  const [lastAnalysisData, setLastAnalysisData] = useState<any>(null)

  const handleDataUpload = useCallback((data: any[]) => {
    setCsvData(data);
    setActiveTab("processing");
    processRealData(data);
  }, []);

  const processRealData = async (data: any[]) => {
    const stages = [
      { stage: "cleaning", message: "Cleaning and preprocessing data...", duration: 500 },
      { stage: "graph", message: "Constructing transaction graph...", duration: 800 },
      { stage: "analysis", message: "Running fraud detection algorithms...", duration: 1200 },
      { stage: "visualization", message: "Generating visualizations...", duration: 500 }
    ];

    // Show progress
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      setProcessingStatus({
        stage: stage.stage,
        progress: (i / stages.length) * 100,
        message: stage.message,
        isComplete: false
      });

      await new Promise(resolve => setTimeout(resolve, stage.duration));
      
      // For the analysis stage, actually run the real analysis
// Inside the "analysis" stage, AFTER setting all the states:

if (stage.stage === "analysis") {
  try {
    const { 
      fraudResults: realResults, 
      graphData: realGraphData, 
      detailedMetrics: metrics, // ✅ WE HAVE THIS
      gcnGraphSuspiciousOnly: gcnSuspicious,
      gcnGraphWithNeighbors: gcnNeighbors,
      temporalAnalysis: temporal,
      bridgeNodes: bridges,
      communityAnalysis: communities
    } = analyzeFraudData(data);
    
    setGraphData(realGraphData);
    setFraudResults(realResults);
    setDetailedMetrics(metrics);
    setGcnGraphSuspiciousOnly(gcnSuspicious);
    setGcnGraphWithNeighbors(gcnNeighbors);
    setTemporalAnalysis(temporal);
    setBridgeNodes(bridges);
    setCommunityAnalysis(communities);
    
    // ✅ FIXED: Pass metrics directly to avoid state timing issues
    await saveAnalysisToHistory(
      realResults, 
      data, 
      data.length > 0 && data[0].transaction_hash ? 'Live Etherscan' : 'CSV Upload',
      metrics // ✅ PASS METRICS HERE DIRECTLY!
    );

  } catch (error) {
    console.error("Error during fraud analysis:", error);
  }
}
      
      setProcessingStatus({
        stage: stage.stage,
        progress: ((i + 1) / stages.length) * 100,
        message: `${stage.message} Complete`,
        isComplete: i === stages.length - 1
      });
    }

    setActiveTab("visualization");
  };

  const getRiskBadgeVariant = (risk: number) => {
    if (risk >= 0.8) return "destructive";
    if (risk >= 0.6) return "warning";
    if (risk >= 0.4) return "secondary";
    return "success";
  };

  const getRiskLabel = (risk: number) => {
    if (risk >= 0.8) return "High Risk";
    if (risk >= 0.6) return "Medium Risk";
    if (risk >= 0.4) return "Low Risk";
    return "Clean";
  };

  // Add this function to save analysis after completion
// Around line 60-90, REPLACE the entire saveAnalysisToHistory function with this:

const saveAnalysisToHistory = async (
  fraudResults: any, 
  csvData: any[], 
  dataSource: string,
  metrics: any[] // ✅ ADD THIS PARAMETER - pass metrics directly!
) => {
  try {
    // ✅ Create a map for faster lookups
    const riskScoreMap = new Map(
      metrics.map(metric => [metric.wallet_address.toLowerCase(), metric])
    );

    // ✅ Enrich transactions with ACTUAL risk scores from metrics
    const enrichedTransactions = csvData.map((tx, idx) => {
      const fromMetric = riskScoreMap.get(tx.from_address.toLowerCase());
      const toMetric = riskScoreMap.get(tx.to_address.toLowerCase());
      
      // Use the higher risk score between sender and receiver
      const maxRiskScore = Math.max(
        fromMetric?.micro_score || 0,
        toMetric?.micro_score || 0
      );
      
      const isSuspicious = maxRiskScore >= fraudResults.stats.riskThreshold;

      return {
        from_address: tx.from_address.toLowerCase(),
        to_address: tx.to_address.toLowerCase(),
        value: tx.value || 0,
        timestamp: tx.timestamp || new Date().toISOString(),
        transaction_hash: tx.transaction_hash || `tx_${idx}`,
        block_number: tx.block_number || 0,
        risk_score: maxRiskScore, // ✅ NOW HAS ACTUAL RISK SCORE
        is_suspicious: isSuspicious // ✅ NOW CORRECTLY FLAGGED
      };
    });

    console.log(`💾 Saving ${enrichedTransactions.length} transactions, ${enrichedTransactions.filter(t => t.is_suspicious).length} suspicious`);

    const response = await fetch('http://localhost:5000/api/save-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stats: fraudResults.stats,
        transactions: enrichedTransactions, // ✅ USE ENRICHED DATA
        dataSource: dataSource
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ Analysis saved to history:', result.sessionId);
    }
  } catch (error) {
    console.error('Failed to save analysis:', error);
  }
};

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Ethereum Fraud Detection
            </h1>
            <p className="text-muted-foreground text-sm md:text-lg">
              Advanced graph analysis for blockchain transaction monitoring
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
            <Badge variant="secondary" className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm">
              <Shield className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Network Analysis Engine</span>
              <span className="sm:hidden">Analysis</span>
            </Badge>
          </div>
        </div>

        {/* Status Overview */}
        {fraudResults && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Total Wallets</p>
                    <p className="text-lg md:text-2xl font-bold">{fraudResults.stats.totalNodes.toLocaleString()}</p>
                  </div>
                  <Database className="h-5 w-5 md:h-8 md:w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-card border-border shadow-card">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Transactions</p>
                    <p className="text-lg md:text-2xl font-bold">{fraudResults.stats.totalEdges.toLocaleString()}</p>
                  </div>
                  <Network className="h-5 w-5 md:h-8 md:w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-card">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Suspicious</p>
                    <p className="text-lg md:text-2xl font-bold text-warning">{fraudResults.stats.suspiciousNodes}</p>
                  </div>
                  <AlertTriangle className="h-5 w-5 md:h-8 md:w-8 text-warning" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-card">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Threshold</p>
                    <p className="text-base md:text-2xl font-bold">
                      <Badge variant="secondary" className="text-xs md:text-sm">
                        {(fraudResults.stats.riskThreshold * 100).toFixed(1)}%
                      </Badge>
                    </p>
                  </div>
                  <Activity className="h-5 w-5 md:h-8 md:w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-card">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Avg Risk</p>
                    <p className="text-base md:text-2xl font-bold">
                      <Badge variant={getRiskBadgeVariant(fraudResults.stats.riskScore)} className="text-xs md:text-sm">
                        {(fraudResults.stats.riskScore * 100).toFixed(1)}%
                      </Badge>
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 md:h-8 md:w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-secondary/50 h-auto">
            <TabsTrigger value="upload" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <Upload className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Data Upload</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <Activity className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Processing</span>
              <span className="sm:hidden">Process</span>
            </TabsTrigger>
            <TabsTrigger value="visualization" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <Network className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Visualization</span>
              <span className="sm:hidden">Graph</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Fraud Results</span>
              <span className="sm:hidden">Results</span>
            </TabsTrigger>
            <TabsTrigger value="lookup" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <Search className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Address Lookup</span>
              <span className="sm:hidden">Lookup</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <History className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">Past</span>
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
              <Eye className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Watchlist</span>
              <span className="sm:hidden">Watch</span>
            </TabsTrigger>
          </TabsList>

            <TabsContent value="watchlist" className="space-y-6">
            <WatchlistPanel />
            </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <DataUpload onDataUpload={handleDataUpload} />
          </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <AnalysisHistory />
            </TabsContent>
          <TabsContent value="processing" className="space-y-6">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary animate-pulse-glow" />
                  Processing Pipeline
                </CardTitle>
                <CardDescription>
                  Analyzing transaction data and detecting fraud patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{processingStatus.message}</span>
                    <span>{Math.round(processingStatus.progress)}%</span>
                  </div>
                  <Progress value={processingStatus.progress} className="h-2" />
                </div>
                
                {processingStatus.isComplete && (
                  <Alert className="border-success/20 bg-success/10">
                    <Shield className="h-4 w-4 text-success" />
                    <AlertDescription className="text-success">
                      Analysis complete! Navigate to the Visualization tab to explore results.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visualization" className="space-y-6">
            {graphData && <GraphVisualization data={graphData} />}
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {fraudResults && (
              <FraudResults 
                results={fraudResults} 
                detailedMetrics={detailedMetrics}
                gcnGraphSuspiciousOnly={gcnGraphSuspiciousOnly}
                gcnGraphWithNeighbors={gcnGraphWithNeighbors}
                temporalAnalysis={temporalAnalysis}
                bridgeNodes={bridgeNodes}
                communityAnalysis={communityAnalysis}
              />
            )}
          </TabsContent>

          <TabsContent value="lookup" className="space-y-6">
            <AddressLookupPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FraudDetectionDashboard;