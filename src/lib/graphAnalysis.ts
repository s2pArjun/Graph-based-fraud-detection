// @ts-nocheck
import Graph from 'graphology';
import pagerank from 'graphology-metrics/centrality/pagerank';
// import { connectedComponents } from 'graphology-components';

interface Transaction {
    from_address: string;
    to_address: string;
    value: string | number;
    timestamp?: string;
    transaction_hash?: string;
    block_number?: string | number;
}

interface FraudAnalysisResults {
    stronglyConnectedComponents: Array<Array<string>>;
    cycles: Array<Array<string>>;
    highRiskNodes: Array<{ address: string; risk: number; reason: string }>;
    pageRankScores: Record<string, number>;
    stats: {
        totalNodes: number;
        totalEdges: number;
        suspiciousNodes: number;
        riskScore: number;
        riskThreshold: number; // NEW: Dynamic threshold
    };
}

interface GraphData {
    nodes: Array<{ id: string; label: string; risk: number; pagerank: number }>;
    edges: Array<{ source: string; target: string; value: number; timestamp: string }>;
}

interface GCNGraphData {
    nodes: Array<{
        id: string;
        features: {
            degree: number;
            in_degree: number;
            out_degree: number;
            pagerank: number;
            tx_entropy: number;
            micro_score: number;
            tx_freq: number;
        };
    }>;
    edges: Array<{
        source: string;
        target: string;
        weight: number;
        timestamp?: string;
    }>;
    metadata: {
        total_suspicious_nodes: number;
        risk_threshold: number;
        include_neighbors: boolean;
    };
}

export class FraudDetectionAnalyzer {
    private graph: Graph;
    private transactions: Transaction[];

    constructor(transactions: Transaction[]) {
        this.transactions = transactions;
        this.graph = new Graph({ type: 'directed', multi: true });
        this.buildGraph();
    }

    private buildGraph() {
        // Add all transactions as edges
        this.transactions.forEach((tx) => {
            const from = tx.from_address;
            const to = tx.to_address;
            const value = typeof tx.value === 'string' ? parseFloat(tx.value) : tx.value;

            // Add nodes if they don't exist
            if (!this.graph.hasNode(from)) {
                this.graph.addNode(from);
            }
            if (!this.graph.hasNode(to)) {
                this.graph.addNode(to);
            }

            // Add edge with transaction data
            this.graph.addEdge(from, to, {
                value: value,
                timestamp: tx.timestamp || '',
                txHash: tx.transaction_hash || '',
                block: tx.block_number || 0
            });
        });
    }

    calculatePageRank(): Record<string, number> {
        try {
            return pagerank(this.graph, {
                alpha: 0.85,
                maxIterations: 100,
                tolerance: 1e-6,
                getEdgeWeight: (edge: string) => {
                    const weight = this.graph.getEdgeAttribute(edge, 'weight');
                    return typeof weight === 'number' ? weight : 1; // fallback to 1 if missing
                }
            });
        } catch (error) {
            console.error('PageRank calculation failed:', error);
            // Return uniform distribution
            const nodes = this.graph.nodes();
            const uniform = 1 / nodes.length;
            return Object.fromEntries(nodes.map(n => [n, uniform]));
        }
    }

    detectCycles(): Array<Array<string>> {
        const cycles: Array<Array<string>> = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (node: string, path: string[]): void => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            try {
                this.graph.forEachOutNeighbor(node, (neighbor) => {
                    if (!visited.has(neighbor)) {
                        dfs(neighbor, [...path]);
                    } else if (recursionStack.has(neighbor)) {
                        // Found a cycle
                        const cycleStart = path.indexOf(neighbor);
                        if (cycleStart !== -1) {
                            const cycle = path.slice(cycleStart);
                            if (cycle.length > 1) {
                                cycles.push(cycle);
                            }
                        }
                    }
                });
            } catch (error) {
                // Node might not have outgoing edges
            }

            recursionStack.delete(node);
        };

        this.graph.forEachNode((node) => {
            if (!visited.has(node)) {
                dfs(node, []);
            }
        });

        return cycles;
    }

    findStronglyConnectedComponents(): Array<Array<string>> {
        // Simple SCC detection using Tarjan's algorithm
        const sccs: Array<Array<string>> = [];
        const index = new Map<string, number>();
        const lowLink = new Map<string, number>();
        const onStack = new Set<string>();
        const stack: string[] = [];
        let indexCounter = 0;

        const strongConnect = (node: string): void => {
            index.set(node, indexCounter);
            lowLink.set(node, indexCounter);
            indexCounter++;
            stack.push(node);
            onStack.add(node);

            try {
                this.graph.forEachOutNeighbor(node, (neighbor) => {
                    if (!index.has(neighbor)) {
                        strongConnect(neighbor);
                        lowLink.set(node, Math.min(lowLink.get(node)!, lowLink.get(neighbor)!));
                    } else if (onStack.has(neighbor)) {
                        lowLink.set(node, Math.min(lowLink.get(node)!, index.get(neighbor)!));
                    }
                });
            } catch (error) {
                // Node might not have neighbors
            }

            // If node is a root node, pop the stack and print an SCC
            if (lowLink.get(node) === index.get(node)) {
                const scc: string[] = [];
                let w: string;
                do {
                    w = stack.pop()!;
                    onStack.delete(w);
                    scc.push(w);
                } while (w !== node);

                if (scc.length > 1) {
                    sccs.push(scc);
                }
            }
        };

        this.graph.forEachNode((node) => {
            if (!index.has(node)) {
                strongConnect(node);
            }
        });

        return sccs;
    }

    calculateTransactionEntropy(address: string): number {
        const values: number[] = [];

        // Get outgoing transaction values
        try {
            this.graph.forEachOutEdge(address, (edge, attrs) => {
                values.push(attrs.value);
            });
        } catch (e) { }

        // Get incoming transaction values
        try {
            this.graph.forEachInEdge(address, (edge, attrs) => {
                values.push(attrs.value);
            });
        } catch (e) { }

        if (values.length === 0) return 0;

        const total = values.reduce((sum, v) => sum + v, 0);
        if (total === 0) return 0;

        // Calculate Shannon entropy
        const probabilities = values.map(v => v / total);
        const entropy = -probabilities.reduce((sum, p) => {
            return sum + (p > 0 ? p * Math.log2(p) : 0);
        }, 0);

        return entropy;
    }

    calculateMicroScore(
        address: string,
        pagerankScores: Record<string, number>,
        cycles: Array<Array<string>>
    ): number {
        let score = 0;

        const inDegree = this.graph.inDegree(address);
        const outDegree = this.graph.outDegree(address);
        const totalDegree = inDegree + outDegree;

        const maxDegree = Math.max(...this.graph.nodes().map(n =>
            this.graph.inDegree(n) + this.graph.outDegree(n)
        ));

        if (maxDegree > 0) {
            score += (totalDegree / maxDegree) * 0.3;
        }

        const maxPageRank = Math.max(...Object.values(pagerankScores));
        if (maxPageRank > 0) {
            score += ((pagerankScores[address] || 0) / maxPageRank) * 0.3;
        }

        if (totalDegree > 0) {
            const imbalance = Math.abs(inDegree - outDegree) / totalDegree;
            score += imbalance * 0.2;
        }

        const isInCycle = cycles.some(cycle => cycle.includes(address));
        if (isInCycle) {
            score += 0.2;
        }

        return Math.min(score, 1.0);
    }

    // NEW: Extract neighbors for a given node
    getNeighbors(address: string): { in_neighbors: string[], out_neighbors: string[] } {
        const in_neighbors: string[] = [];
        const out_neighbors: string[] = [];

        try {
            this.graph.forEachInNeighbor(address, (neighbor) => {
                in_neighbors.push(neighbor);
            });
        } catch (e) { }

        try {
            this.graph.forEachOutNeighbor(address, (neighbor) => {
                out_neighbors.push(neighbor);
            });
        } catch (e) { }

        return { in_neighbors, out_neighbors };
    }

    // NEW: Build GCN-ready graph structure
    buildGCNGraph(suspiciousNodes: Set<string>, includeNeighbors: boolean = false): GCNGraphData {
        const nodesToInclude = new Set<string>(suspiciousNodes);

        // Option to include 1-hop neighbors
        if (includeNeighbors) {
            suspiciousNodes.forEach(node => {
                const { in_neighbors, out_neighbors } = this.getNeighbors(node);
                in_neighbors.forEach(n => nodesToInclude.add(n));
                out_neighbors.forEach(n => nodesToInclude.add(n));
            });
        }

        const nodes: GCNGraphData['nodes'] = [];
        const edges: GCNGraphData['edges'] = [];
        const pagerankScores = this.calculatePageRank();
        const cycles = this.detectCycles();

        // Extract node features
        nodesToInclude.forEach(address => {
            const inDegree = this.graph.inDegree(address);
            const outDegree = this.graph.outDegree(address);
            const degree = inDegree + outDegree;
            const pagerank = pagerankScores[address] || 0;
            const entropy = this.calculateTransactionEntropy(address);
            const microScore = this.calculateMicroScore(address, pagerankScores, cycles);
            const txFreq = this.graph.degree(address);

            nodes.push({
                id: address,
                features: {
                    degree,
                    in_degree: inDegree,
                    out_degree: outDegree,
                    pagerank,
                    tx_entropy: entropy,
                    micro_score: microScore,
                    tx_freq: txFreq
                }
            });
        });

        // Extract edges between included nodes
        this.graph.forEachEdge((edge, attrs, source, target) => {
            if (nodesToInclude.has(source) && nodesToInclude.has(target)) {
                edges.push({
                    source,
                    target,
                    weight: attrs.value,
                    timestamp: attrs.timestamp
                });
            }
        });

        return {
            nodes,
            edges,
            metadata: {
                total_suspicious_nodes: suspiciousNodes.size,
                risk_threshold: 0, // Will be set by caller
                include_neighbors: includeNeighbors
            }
        };
    }

    analyze(): { 
        fraudResults: FraudAnalysisResults; 
        graphData: GraphData; 
        detailedMetrics: any[];
        gcnGraphWithNeighbors: GCNGraphData;
        gcnGraphSuspiciousOnly: GCNGraphData;
    } {
        console.log('Starting real fraud analysis...');

        const pagerankScores = this.calculatePageRank();
        const cycles = this.detectCycles();
        const sccs = this.findStronglyConnectedComponents();

        const highRiskNodes: Array<{ address: string; risk: number; reason: string }> = [];
        const nodes: Array<{ id: string; label: string; risk: number; pagerank: number }> = [];
        const detailedMetrics: any[] = [];

        // Calculate risk scores for ALL nodes
        this.graph.forEachNode((address) => {
            const risk = this.calculateMicroScore(address, pagerankScores, cycles);
            const pagerank = pagerankScores[address] || 0;
            const inDegree = this.graph.inDegree(address);
            const outDegree = this.graph.outDegree(address);
            const degree = inDegree + outDegree;
            const entropy = this.calculateTransactionEntropy(address);
            const txFreq = this.graph.degree(address);
            const { in_neighbors, out_neighbors } = this.getNeighbors(address);

            nodes.push({
                id: address,
                label: `${address.slice(0, 6)}...${address.slice(-4)}`,
                risk,
                pagerank
            });

            detailedMetrics.push({
                wallet_address: address,
                degree: degree,
                in_degree: inDegree,
                out_degree: outDegree,
                pagerank: pagerank,
                tx_entropy: entropy,
                micro_score: risk,
                tx_freq: txFreq,
                in_neighbors: in_neighbors,
                out_neighbors: out_neighbors
            });
        });

        // NEW: Calculate DYNAMIC threshold based on average risk
        const avgRisk = nodes.reduce((sum, n) => sum + n.risk, 0) / nodes.length;
        const riskThreshold = avgRisk; // Use average as threshold

        console.log(`📊 Dynamic Risk Threshold: ${(riskThreshold * 100).toFixed(2)}%`);

        // Filter high-risk nodes using dynamic threshold
        const suspiciousNodeSet = new Set<string>();
        
        this.graph.forEachNode((address) => {
            const risk = this.calculateMicroScore(address, pagerankScores, cycles);
            
            if (risk >= riskThreshold) {
                suspiciousNodeSet.add(address);
                
                const reasons: string[] = [];
                const inDegree = this.graph.inDegree(address);
                const outDegree = this.graph.outDegree(address);
                const totalDegree = inDegree + outDegree;

                if (totalDegree > 5) reasons.push('High transaction degree');
                if (pagerankScores[address] > 0.02) reasons.push('High PageRank (influential)');
                if (cycles.some(c => c.includes(address))) reasons.push('Part of cycle');
                if (Math.abs(inDegree - outDegree) > 3) reasons.push('Unusual in/out ratio');
                if (risk >= riskThreshold * 1.5) reasons.push('Significantly above average risk');

                highRiskNodes.push({
                    address,
                    risk,
                    reason: reasons.join(', ') || 'Above average risk threshold'
                });
            }
        });

        // Build GCN graphs - Two versions
        const gcnGraphSuspiciousOnly = this.buildGCNGraph(suspiciousNodeSet, false);
        const gcnGraphWithNeighbors = this.buildGCNGraph(suspiciousNodeSet, true);
        
        gcnGraphSuspiciousOnly.metadata.risk_threshold = riskThreshold;
        gcnGraphWithNeighbors.metadata.risk_threshold = riskThreshold;

        // Prepare edges for visualization
        const edges: Array<{ source: string; target: string; value: number; timestamp: string }> = [];
        this.graph.forEachEdge((edge, attrs, source, target) => {
            edges.push({
                source,
                target,
                value: attrs.value,
                timestamp: attrs.timestamp || ''
            });
        });

        const fraudResults: FraudAnalysisResults = {
            stronglyConnectedComponents: sccs,
            cycles,
            highRiskNodes: highRiskNodes.sort((a, b) => b.risk - a.risk),
            pageRankScores: pagerankScores,
            stats: {
                totalNodes: this.graph.order,
                totalEdges: this.graph.size,
                suspiciousNodes: highRiskNodes.length,
                riskScore: avgRisk,
                riskThreshold: riskThreshold
            }
        };

        const graphData: GraphData = { nodes, edges };

        console.log('✅ Analysis complete:', {
            nodes: fraudResults.stats.totalNodes,
            edges: fraudResults.stats.totalEdges,
            suspicious: fraudResults.stats.suspiciousNodes,
            threshold: `${(riskThreshold * 100).toFixed(2)}%`,
            cycles: cycles.length,
            sccs: sccs.length,
            gcnNodesOnly: gcnGraphSuspiciousOnly.nodes.length,
            gcnNodesWithNeighbors: gcnGraphWithNeighbors.nodes.length
        });

        return { 
            fraudResults, 
            graphData, 
            detailedMetrics,
            gcnGraphSuspiciousOnly,
            gcnGraphWithNeighbors
        };
    }
}

export function analyzeFraudData(transactions: Transaction[]) {
    const analyzer = new FraudDetectionAnalyzer(transactions);
    return analyzer.analyze();
}
