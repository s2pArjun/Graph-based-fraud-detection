// @ts-nocheck
// Community Detection - Find fraud rings using Louvain algorithm
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

export interface CommunityStats {
  communityId: number;
  size: number;
  members: string[];
  avgRisk: number;
  internalTxRatio: number; // Higher = more isolated = suspicious
  totalVolume: number;
  suspicionLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CommunityDetectionResults {
  communities: CommunityStats[];
  suspiciousCommunities: CommunityStats[];
  totalCommunities: number;
}

/**
 * Detect communities using Louvain algorithm
 */
export function detectCommunities(graph: Graph): Map<string, number> {
  try {
    console.log('🔍 Running Louvain community detection...');
    
    const communities = louvain(graph, {
      resolution: 1.0,
      randomWalk: false
    });
    
    const uniqueCommunities = new Set(Object.values(communities)).size;
    console.log(`✅ Found ${uniqueCommunities} communities`);
    
    return new Map(Object.entries(communities).map(([node, comm]) => [node, comm as number]));
  } catch (error) {
    console.error('Community detection failed:', error);
    return new Map();
  }
}

/**
 * Analyze community characteristics
 */
export function analyzeCommunityStats(
  graph: Graph,
  communities: Map<string, number>,
  riskScores: Map<string, number>
): CommunityStats[] {
  const communityGroups = new Map<number, string[]>();
  
  // Group nodes by community
  communities.forEach((communityId, nodeId) => {
    if (!communityGroups.has(communityId)) {
      communityGroups.set(communityId, []);
    }
    communityGroups.get(communityId)!.push(nodeId);
  });

  const stats: CommunityStats[] = [];

  communityGroups.forEach((members, communityId) => {
    if (members.length < 2) return; // Skip single-node communities

    // Calculate average risk
    const risks = members.map(m => riskScores.get(m) || 0);
    const avgRisk = risks.reduce((a, b) => a + b, 0) / risks.length;

    // Calculate internal transaction ratio
    let internalEdges = 0;
    let totalEdges = 0;
    let totalVolume = 0;

    members.forEach(member => {
      try {
        // Count outgoing edges
        graph.forEachOutEdge(member, (edge, attrs, source, target) => {
          totalEdges++;
          totalVolume += attrs.value || 0;
          
          if (members.includes(target)) {
            internalEdges++;
          }
        });
      } catch (e) {}
    });

    const internalTxRatio = totalEdges > 0 ? internalEdges / totalEdges : 0;

    // Determine suspicion level
    let suspicionLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (internalTxRatio > 0.8 && avgRisk > 0.6) suspicionLevel = 'critical';
    else if (internalTxRatio > 0.7 && avgRisk > 0.5) suspicionLevel = 'high';
    else if (internalTxRatio > 0.6 || avgRisk > 0.4) suspicionLevel = 'medium';

    stats.push({
      communityId,
      size: members.length,
      members: members.slice(0, 20), // Limit to 20 for display
      avgRisk,
      internalTxRatio,
      totalVolume,
      suspicionLevel
    });
  });

  return stats.sort((a, b) => {
    // Sort by suspicion level and size
    const suspicionOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return suspicionOrder[b.suspicionLevel] - suspicionOrder[a.suspicionLevel] || b.size - a.size;
  });
}

/**
 * Main community detection function
 */
export function runCommunityDetection(
  graph: Graph,
  riskScores: Map<string, number>
): CommunityDetectionResults {
  const communities = detectCommunities(graph);
  const communityStats = analyzeCommunityStats(graph, communities, riskScores);
  
  const suspiciousCommunities = communityStats.filter(
    c => c.suspicionLevel === 'high' || c.suspicionLevel === 'critical'
  );

  return {
    communities: communityStats,
    suspiciousCommunities,
    totalCommunities: new Set(communities.values()).size
  };
}