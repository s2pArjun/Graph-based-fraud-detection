// Temporal Analysis - Detect fraud patterns over time

interface Transaction {
  from_address: string;
  to_address: string;
  value: number;
  timestamp: string;
  transaction_hash: string;
  block_number: number;
}

interface BurstPattern {
  timestamp: number;
  multiplier: number;
  transactionCount: number;
  suspicionLevel: 'low' | 'medium' | 'high' | 'critical';
  addresses: string[];
}

interface DormantActivation {
  address: string;
  dormantDays: number;
  reactivationTimestamp: string;
  suspicionLevel: 'low' | 'medium' | 'high';
}

interface TimeOfDayPattern {
  hour: number;
  transactionCount: number;
  suspiciousIndicator: boolean; // true if activity is bot-like
}

export interface TemporalAnalysisResults {
  burstActivity: BurstPattern[];
  dormantWakeups: DormantActivation[];
  timeOfDayPatterns: TimeOfDayPattern[];
  velocityAnomalies: {
    address: string;
    normalRate: number;
    currentRate: number;
    anomalyScore: number;
  }[];
}

/**
 * Group transactions by time windows (e.g., hourly)
 */
function groupByTimeWindow(
  transactions: Transaction[],
  windowSeconds: number
): Map<number, Transaction[]> {
  const windows = new Map<number, Transaction[]>();

  transactions.forEach(tx => {
    const timestamp = new Date(tx.timestamp).getTime() / 1000;
    const windowKey = Math.floor(timestamp / windowSeconds) * windowSeconds;

    if (!windows.has(windowKey)) {
      windows.set(windowKey, []);
    }
    windows.get(windowKey)!.push(tx);
  });

  return windows;
}

/**
 * Detect sudden bursts in activity (pump & dump indicator)
 */
function detectBurstPatterns(
  timeWindows: Map<number, Transaction[]>
): BurstPattern[] {
  const bursts: BurstPattern[] = [];
  const windows = Array.from(timeWindows.entries()).sort((a, b) => a[0] - b[0]);

  for (let i = 1; i < windows.length; i++) {
    const [prevTime, prevTxs] = windows[i - 1];
    const [currTime, currTxs] = windows[i];

    const prevCount = prevTxs.length;
    const currCount = currTxs.length;

    if (prevCount === 0) continue;

    const multiplier = currCount / prevCount;

    // Sudden spike detection
    if (multiplier >= 5) {
      const addresses = new Set<string>();
      currTxs.forEach(tx => {
        addresses.add(tx.from_address);
        addresses.add(tx.to_address);
      });

      let suspicionLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (multiplier >= 20) suspicionLevel = 'critical';
      else if (multiplier >= 10) suspicionLevel = 'high';
      else if (multiplier >= 7) suspicionLevel = 'medium';

      bursts.push({
        timestamp: currTime,
        multiplier,
        transactionCount: currCount,
        suspicionLevel,
        addresses: Array.from(addresses).slice(0, 10) // Top 10
      });
    }
  }

  return bursts;
}

/**
 * Detect dormant wallets suddenly becoming active (hacked accounts)
 */
function detectDormantActivation(transactions: Transaction[]): DormantActivation[] {
  const walletActivity = new Map<string, number[]>();

  // Group timestamps by wallet
  transactions.forEach(tx => {
    const timestamp = new Date(tx.timestamp).getTime();
    
    if (!walletActivity.has(tx.from_address)) {
      walletActivity.set(tx.from_address, []);
    }
    walletActivity.get(tx.from_address)!.push(timestamp);
  });

  const dormantWakeups: DormantActivation[] = [];

  // Check for long gaps followed by sudden activity
  walletActivity.forEach((timestamps, address) => {
    if (timestamps.length < 2) return;

    timestamps.sort((a, b) => a - b);

    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      const gapDays = gap / (1000 * 60 * 60 * 24);

      // If dormant for 30+ days then suddenly active
      if (gapDays >= 30) {
        let suspicionLevel: 'low' | 'medium' | 'high' = 'low';
        if (gapDays >= 180) suspicionLevel = 'high';
        else if (gapDays >= 90) suspicionLevel = 'medium';

        dormantWakeups.push({
          address,
          dormantDays: Math.floor(gapDays),
          reactivationTimestamp: new Date(timestamps[i]).toISOString(),
          suspicionLevel
        });
      }
    }
  });

  return dormantWakeups;
}

/**
 * Analyze time-of-day patterns (bot detection)
 */
function analyzeTimeOfDay(transactions: Transaction[]): TimeOfDayPattern[] {
  const hourlyActivity = new Array(24).fill(0);

  transactions.forEach(tx => {
    const hour = new Date(tx.timestamp).getHours();
    hourlyActivity[hour]++;
  });

  const avgActivity = hourlyActivity.reduce((a, b) => a + b, 0) / 24;
  const stdDev = Math.sqrt(
    hourlyActivity.reduce((sum, count) => sum + Math.pow(count - avgActivity, 2), 0) / 24
  );

  return hourlyActivity.map((count, hour) => ({
    hour,
    transactionCount: count,
    // Bot-like if activity is very uniform (low variance) or peaks at odd hours
    suspiciousIndicator: stdDev < avgActivity * 0.3 || (hour >= 2 && hour <= 5 && count > avgActivity * 1.5)
  }));
}

/**
 * Detect velocity anomalies (sudden changes in transaction rate)
 */
function detectVelocityChanges(transactions: Transaction[]): {
  address: string;
  normalRate: number;
  currentRate: number;
  anomalyScore: number;
}[] {
  const walletTimestamps = new Map<string, number[]>();

  transactions.forEach(tx => {
    const timestamp = new Date(tx.timestamp).getTime();
    if (!walletTimestamps.has(tx.from_address)) {
      walletTimestamps.set(tx.from_address, []);
    }
    walletTimestamps.get(tx.from_address)!.push(timestamp);
  });

  const anomalies: any[] = [];

  walletTimestamps.forEach((timestamps, address) => {
    if (timestamps.length < 5) return;

    timestamps.sort((a, b) => a - b);

    // Calculate average rate (transactions per day)
    const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
    const avgRate = (timestamps.length / totalTime) * (1000 * 60 * 60 * 24);

    // Check recent rate (last 25%)
    const recentStart = Math.floor(timestamps.length * 0.75);
    const recentTime = timestamps[timestamps.length - 1] - timestamps[recentStart];
    const recentRate = ((timestamps.length - recentStart) / recentTime) * (1000 * 60 * 60 * 24);

    if (avgRate > 0 && recentRate / avgRate > 3) {
      anomalies.push({
        address,
        normalRate: avgRate,
        currentRate: recentRate,
        anomalyScore: recentRate / avgRate
      });
    }
  });

  return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, 20);
}

/**
 * Main temporal analysis function
 */
export function analyzeTemporalPatterns(transactions: Transaction[]): TemporalAnalysisResults {
  console.log('🕐 Running temporal analysis...');

  // Group by 1-hour windows
  const timeWindows = groupByTimeWindow(transactions, 3600);

  const results = {
    burstActivity: detectBurstPatterns(timeWindows),
    dormantWakeups: detectDormantActivation(transactions),
    timeOfDayPatterns: analyzeTimeOfDay(transactions),
    velocityAnomalies: detectVelocityChanges(transactions)
  };

  console.log('✅ Temporal analysis complete:', {
    bursts: results.burstActivity.length,
    dormantWakeups: results.dormantWakeups.length,
    velocityAnomalies: results.velocityAnomalies.length
  });

  return results;
}