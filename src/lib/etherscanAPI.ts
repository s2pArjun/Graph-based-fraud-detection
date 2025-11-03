// Etherscan API V2 Integration
// Fetches latest Ethereum transactions and converts them to CSV-compatible format

// V2 API Configuration
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/v2/api';
const ETHEREUM_CHAIN_ID = '1'; // Ethereum Mainnet

interface EtherscanTransaction {
  hash: string;
  from: string;
  to: string;
  value: string; // Hex format
  gas: string;
  gasPrice: string;
  blockNumber: string;
  timeStamp?: string;
}

interface EtherscanBlockResponse {
  result: {
    transactions: EtherscanTransaction[];
    timestamp: string;
  };
}

interface FormattedTransaction {
  from_address: string;
  to_address: string;
  value: number;
  timestamp: string;
  transaction_hash: string;
  block_number: number;
  gas_price: number;
}

/**
 * Build V2 API URL with required chainid parameter
 */
function buildV2Url(params: Record<string, string>): string {
  const urlParams = new URLSearchParams({
    chainid: ETHEREUM_CHAIN_ID,
    ...params
  });
  return `${ETHERSCAN_BASE_URL}?${urlParams.toString()}`;
}

/**
 * Convert hex value to decimal ETH
 */
function hexToEth(hexValue: string): number {
  try {
    // Remove '0x' prefix if present
    const hex = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue;
    // Convert hex to decimal wei, then to ETH (divide by 10^18)
    const wei = parseInt(hex, 16);
    const eth = wei / 1e18;
    return eth;
  } catch (error) {
    console.error('Error converting hex to ETH:', error);
    return 0;
  }
}

/**
 * Convert hex timestamp to readable format
 */
function hexToTimestamp(hexTimestamp: string): string {
  try {
    const hex = hexTimestamp.startsWith('0x') ? hexTimestamp.slice(2) : hexTimestamp;
    const timestamp = parseInt(hex, 16);
    return new Date(timestamp * 1000).toISOString();
  } catch (error) {
    console.error('Error converting timestamp:', error);
    return new Date().toISOString();
  }
}

/**
 * Convert hex block number to decimal
 */
function hexToDecimal(hexValue: string): number {
  try {
    const hex = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue;
    return parseInt(hex, 16);
  } catch (error) {
    console.error('Error converting hex to decimal:', error);
    return 0;
  }
}

/**
 * Fetch latest block from Etherscan
 */
async function fetchLatestBlock(apiKey: string): Promise<EtherscanBlockResponse | null> {
  try {
    const url = buildV2Url({
      module: 'proxy',
      action: 'eth_getBlockByNumber',
      tag: 'latest',
      boolean: 'true',
      apikey: apiKey
    });
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching latest block:', error);
    return null;
  }
}

/**
 * Fetch multiple recent blocks to get more transactions
 */
async function fetchRecentBlocks(apiKey: string, blockCount: number = 3): Promise<EtherscanTransaction[]> {
  const allTransactions: EtherscanTransaction[] = [];
  
  try {
    // First, get the latest block number
    const latestBlockUrl = buildV2Url({
      module: 'proxy',
      action: 'eth_blockNumber',
      apikey: apiKey
    });
    const latestBlockResponse = await fetch(latestBlockUrl);
    const latestBlockData = await latestBlockResponse.json();
    const latestBlockNumber = hexToDecimal(latestBlockData.result);
    
    console.log(`Latest block: ${latestBlockNumber}`);
    
    // Fetch last N blocks
    const blockPromises = [];
    for (let i = 0; i < blockCount; i++) {
      const blockNumber = `0x${(latestBlockNumber - i).toString(16)}`;
      const url = buildV2Url({
        module: 'proxy',
        action: 'eth_getBlockByNumber',
        tag: blockNumber,
        boolean: 'true',
        apikey: apiKey
      });
      blockPromises.push(fetch(url));
    }
    
    const responses = await Promise.all(blockPromises);
    const blocks = await Promise.all(responses.map(r => r.json()));
    
    // Extract transactions from all blocks
    blocks.forEach(block => {
      if (block.result && block.result.transactions) {
        allTransactions.push(...block.result.transactions);
      }
    });
    
    console.log(`Fetched ${allTransactions.length} transactions from ${blockCount} blocks`);
    return allTransactions;
  } catch (error) {
    console.error('Error fetching recent blocks:', error);
    return [];
  }
}

/**
 * Format Etherscan transactions to match CSV format expected by fraud detection
 */
function formatTransactions(transactions: EtherscanTransaction[], blockTimestamp: string): FormattedTransaction[] {
  return transactions
    .filter(tx => tx.to) // Filter out contract creation transactions (no 'to' address)
    .map(tx => ({
      from_address: tx.from.toLowerCase(),
      to_address: tx.to.toLowerCase(),
      value: hexToEth(tx.value),
      timestamp: tx.timeStamp ? hexToTimestamp(tx.timeStamp) : blockTimestamp,
      transaction_hash: tx.hash,
      block_number: hexToDecimal(tx.blockNumber),
      gas_price: hexToEth(tx.gasPrice)
    }));
}

/**
 * Main function to fetch and format latest Ethereum transactions
 */
export async function fetchLatestTransactions(
  apiKey: string,
  options: {
    maxTransactions?: number;
    blockCount?: number;
  } = {}
): Promise<{ success: boolean; data: FormattedTransaction[]; error?: string }> {
  const { maxTransactions = 100, blockCount = 3 } = options;
  
  try {
    console.log('🔍 Fetching latest Ethereum transactions...');
    
    // Fetch transactions from multiple recent blocks
    const transactions = await fetchRecentBlocks(apiKey, blockCount);
    
    if (transactions.length === 0) {
      return {
        success: false,
        data: [],
        error: 'No transactions found'
      };
    }
    
    // Format transactions
    const formattedTransactions = formatTransactions(
      transactions.slice(0, maxTransactions),
      new Date().toISOString()
    );
    
    console.log(`✅ Successfully formatted ${formattedTransactions.length} transactions`);
    
    return {
      success: true,
      data: formattedTransactions
    };
  } catch (error) {
    console.error('Error in fetchLatestTransactions:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Validate Etherscan API key
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const url = buildV2Url({
      module: 'account',
      action: 'balance',
      address: '0x0000000000000000000000000000000000000000',
      apikey: apiKey
    });
    const response = await fetch(url);
    const data = await response.json();
    return data.status === '1' || data.message !== 'NOTOK';
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
}

/**
 * Get instructions for obtaining an API key
 */
export function getApiKeyInstructions(): string {
  return `How to get an Etherscan API Key:

1. Go to https://etherscan.io/
2. Click "Sign In" (top right) or create a new account
3. After logging in, go to "API-KEYs" in your account menu
4. Click "Add" to create a new API key
5. Copy your API key and paste it above

Note: Free tier allows 5 calls/second which is sufficient for this tool.`;
}