import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Eye, 
  EyeOff, 
  Bell, 
  Trash2, 
  ExternalLink, 
  Clock,
  Activity,
  Mail,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const API_URL = 'http://localhost:5000/api';

interface WatchlistItem {
  id: number;
  address: string;
  user_email: string | null;
  alert_type: string;
  created_at: string;
  last_checked: string;
  last_tx_hash: string | null;
  alert_count: number;
}

interface Alert {
  id: number;
  tx_hash: string;
  from_address: string;
  to_address: string;
  value: number;
  timestamp: string;
  created_at: string;
}

const WatchlistPanel: React.FC = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>(''); // ✅ NEW: Store selected address
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false); // ✅ NEW: Loading state

  useEffect(() => {
    fetchWatchlist();
    // ✅ NEW: Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchWatchlist();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await fetch(`${API_URL}/watchlist${userEmail ? `?email=${userEmail}` : ''}`);
      const data = await response.json();
      if (data.success) {
        setWatchlist(data.watchlist);
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    }
  };

  const addToWatchlist = async () => {
    if (!newAddress || newAddress.length !== 42) {
      toast.error('Please enter a valid Ethereum address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: newAddress,
          email: userEmail || null,
          alertType: 'all'
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Address added to watchlist!');
        setNewAddress('');
        fetchWatchlist();
      } else {
        toast.error(data.error || 'Failed to add address');
      }
    } catch (error) {
      toast.error('Failed to add to watchlist');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/watchlist/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Removed from watchlist');
        // ✅ Close modal if this was the selected item
        if (selectedItem === id) {
          setSelectedItem(null);
        }
        fetchWatchlist();
      }
    } catch (error) {
      toast.error('Failed to remove from watchlist');
    }
  };

  // ✅ FIXED: Better error handling and empty state support
  const viewAlerts = async (watchlistId: number, address: string) => {
    setLoadingAlerts(true);
    setSelectedItem(watchlistId);
    setSelectedAddress(address);
    setAlerts([]); // Clear previous alerts
    
    try {
      const response = await fetch(`${API_URL}/watchlist/${watchlistId}/alerts`);
      const data = await response.json();

      if (data.success) {
        setAlerts(data.alerts);
        if (data.alerts.length === 0) {
          toast.info('No alerts yet for this address');
        }
      } else {
        toast.error('Failed to fetch alerts');
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast.error('Failed to fetch alerts');
      setSelectedItem(null);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Add to Watchlist */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Address Watchlist
          </CardTitle>
          <CardDescription>
            Monitor addresses for new transactions (checks every 2 minutes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Ethereum address (0x...)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="md:col-span-1 font-mono text-sm"
            />
            <Input
              placeholder="Email (optional)"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="md:col-span-1"
            />
            <Button 
              onClick={addToWatchlist} 
              disabled={loading}
              className="md:col-span-1"
            >
              {loading ? 'Adding...' : 'Add to Watchlist'}
            </Button>
          </div>

          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              Addresses are checked every 2 minutes. Email alerts are enabled.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Watchlist Items */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Watchlist ({watchlist.length})</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchWatchlist}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {watchlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No addresses in watchlist yet</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {watchlist.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <code className="text-sm font-mono">{formatAddress(item.address)}</code>
                        {item.user_email && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {item.user_email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.alert_count > 0 ? "destructive" : "secondary"}>
                          <Bell className="h-3 w-3 mr-1" />
                          {item.alert_count} alerts
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last checked: {formatTime(item.last_checked)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewAlerts(item.id, item.address)} // ✅ FIXED: Pass address too
                        >
                          <Activity className="h-4 w-4 mr-1" />
                          View Alerts
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://etherscan.io/address/${item.address}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromWatchlist(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ✅ FIXED: Alert Details Modal - Shows even when empty */}
      {selectedItem && (
        <Card className="bg-gradient-card border-border shadow-card animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction Alerts</CardTitle>
                <CardDescription className="font-mono text-xs mt-1">
                  {formatAddress(selectedAddress)}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading alerts...</p>
                </div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No alerts yet for this address</p>
                <p className="text-xs text-muted-foreground">
                  New transactions will appear here when detected
                </p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-3 bg-secondary/30 rounded border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="destructive">New Transaction</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(alert.created_at)}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">From:</span>
                          <code className="text-xs">{formatAddress(alert.from_address)}</code>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">To:</span>
                          <code className="text-xs">{formatAddress(alert.to_address)}</code>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Value:</span>
                          <span className="font-bold">{alert.value.toFixed(6)} ETH</span>
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={() => window.open(`https://etherscan.io/tx/${alert.tx_hash}`, '_blank')}
                        >
                          View on Etherscan →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WatchlistPanel;