import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ExternalLink, Copy, AlertCircle, TrendingUp, Shield } from "lucide-react";
import { fetchCompleteAddressDetails } from "@/lib/addressLookup";
import { toast } from "sonner";

const AddressLookupPanel: React.FC = () => {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [addressData, setAddressData] = useState<any>(null);
  const [error, setError] = useState('');

  const API_KEY = 'JYX1K3WV1RIQ99RDYD6S8WDF21U7Q3UGGA';

  const handleLookup = async () => {
    if (!address || address.length !== 42) {
      setError('Please enter a valid Ethereum address (42 characters starting with 0x)');
      return;
    }

    setLoading(true);
    setError('');
    setAddressData(null);

    const result = await fetchCompleteAddressDetails(address, API_KEY);

    if (result.success && result.data) {
      setAddressData(result.data);
    } else {
      setError(result.error || 'Failed to fetch address details');
    }

    setLoading(false);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied!');
  };

  const openInEtherscan = () => {
    window.open(`https://etherscan.io/address/${address}`, '_blank');
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Address Lookup
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter Ethereum address (0x...)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="font-mono text-sm"
          />
          <Button onClick={handleLookup} disabled={loading}>
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert className="border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {addressData && (
          <div className="space-y-4 animate-fade-in">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={addressData.isContract ? 'secondary' : 'outline'}>
                  {addressData.isContract ? 'Smart Contract' : 'EOA Wallet'}
                </Badge>

                {addressData.isContract && (
                  <Badge variant="default" className="bg-accent">
                    🤖 Automated Contract
                  </Badge>
                )}

                <Button variant="ghost" size="sm" onClick={copyAddress}>
                  <Copy className="h-3 w-3" />
                </Button>

                <Button variant="ghost" size="sm" onClick={openInEtherscan}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Balance</p>
                <p className="text-lg font-bold text-primary">{addressData.balance} ETH</p>
              </div>

              <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                <p className="text-lg font-bold text-accent">{addressData.transactionCount}</p>
              </div>
            </div>

            {/* Smart Contract Notice */}
            {addressData.isContract && (
              <Alert className="border-accent/20 bg-accent/10">
                <Shield className="h-4 w-4 text-accent" />
                <AlertDescription className="text-accent">
                  <strong>Smart Contract Detected</strong>
                  <p className="text-xs mt-1">
                    This address is an automated smart contract, not a regular wallet.
                    Smart contracts can execute programmed transactions automatically.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Recent Transactions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recent Transactions
              </h4>

              <ScrollArea className="h-64 border border-border rounded-lg">
                <div className="p-2 space-y-2">
                  {addressData.recentTransactions.map((tx: any, idx: number) => (
                    <div key={idx} className="bg-secondary/30 rounded p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <code className="text-primary">{tx.hash.slice(0, 10)}...</code>
                        <Badge variant="outline">{tx.value} ETH</Badge>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Block: {tx.blockNumber}</span>
                        <span>{new Date(tx.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Account Age */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                First TX:{' '}
                {addressData.firstTxTimestamp !== 'N/A'
                  ? new Date(addressData.firstTxTimestamp).toLocaleDateString()
                  : 'N/A'}
              </p>

              <p>
                Last TX:{' '}
                {addressData.lastTxTimestamp !== 'N/A'
                  ? new Date(addressData.lastTxTimestamp).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AddressLookupPanel;
