// Address Lookup - Fetch detailed info about any Ethereum address
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/v2/api';
const ETHEREUM_CHAIN_ID = '1';

function buildV2Url(params: Record<string, string>): string {
  const urlParams = new URLSearchParams({
    chainid: ETHEREUM_CHAIN_ID,
    ...params
  });
  return `${ETHERSCAN_BASE_URL}?${urlParams.toString()}`;
}

export interface AddressDetails {
  address: string;
  balance: string; // in ETH
  transactionCount: number;
  firstTxTimestamp: string;
  lastTxTimestamp: string;
  isContract: boolean;
  contractName?: string;
}

export interface TransactionRecord {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  blockNumber: number;
  gasUsed: string;
}

/**
 * Fetch address balance
 */
export async function fetchAddressBalance(address: string, apiKey: string): Promise<string> {
  try {
    const url = buildV2Url({
      module: 'account',
      action: 'balance',
      address: address,
      apikey: apiKey
    });
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1') {
      // Convert Wei to ETH
      const weiBalance = BigInt(data.result);
      const ethBalance = Number(weiBalance) / 1e18;
      return ethBalance.toFixed(4);
    }
    
    return '0';
  } catch (error) {
    console.error('Error fetching balance:', error);
    return '0';
  }
}

/**
 * Fetch transaction count for address
 */
export async function fetchTransactionCount(address: string, apiKey: string): Promise<number> {
  try {
    const url = buildV2Url({
      module: 'proxy',
      action: 'eth_getTransactionCount',
      address: address,
      tag: 'latest',
      apikey: apiKey
    });
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.result) {
      return parseInt(data.result, 16); // Convert hex to decimal
    }
    
    return 0;
  } catch (error) {
    console.error('Error fetching transaction count:', error);
    return 0;
  }
}

/**
 * Fetch recent transactions for address
 */
export async function fetchAddressTransactions(
  address: string, 
  apiKey: string,
  page: number = 1,
  limit: number = 10
): Promise<TransactionRecord[]> {
  try {
    const url = buildV2Url({
      module: 'account',
      action: 'txlist',
      address: address,
      startblock: '0',
      endblock: '99999999',
      page: page.toString(),
      offset: limit.toString(),
      sort: 'desc',
      apikey: apiKey
    });
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      return data.result.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: (parseInt(tx.value) / 1e18).toFixed(4), // Convert to ETH
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        blockNumber: parseInt(tx.blockNumber),
        gasUsed: tx.gasUsed
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

/**
 * Check if address is a contract
 */
export async function checkIfContract(address: string, apiKey: string): Promise<boolean> {
  try {
    const url = buildV2Url({
      module: 'proxy',
      action: 'eth_getCode',
      address: address,
      tag: 'latest',
      apikey: apiKey
    });
    
    const response = await fetch(url);
    const data = await response.json();
    
    // If code is not '0x', it's a contract
    return data.result && data.result !== '0x';
  } catch (error) {
    console.error('Error checking contract:', error);
    return false;
  }
}

/**
 * Fetch complete address details
 */
export async function fetchCompleteAddressDetails(
  address: string,
  apiKey: string
): Promise<{
  success: boolean;
  data?: AddressDetails & { recentTransactions: TransactionRecord[] };
  error?: string;
}> {
  try {
    // Fetch all data in parallel
    const [balance, txCount, isContract, transactions] = await Promise.all([
      fetchAddressBalance(address, apiKey),
      fetchTransactionCount(address, apiKey),
      checkIfContract(address, apiKey),
      fetchAddressTransactions(address, apiKey, 1, 10)
    ]);
    
    const firstTx = transactions[transactions.length - 1];
    const lastTx = transactions[0];
    
    return {
      success: true,
      data: {
        address: address,
        balance: balance,
        transactionCount: txCount,
        firstTxTimestamp: firstTx?.timestamp || 'N/A',
        lastTxTimestamp: lastTx?.timestamp || 'N/A',
        isContract: isContract,
        recentTransactions: transactions
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch address details'
    };
  }
}
