// src/components/AnalysisHistory.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  History, 
  Search, 
  Trash2, 
  Eye, 
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

const API_URL = 'http://localhost:5000/api';

interface AnalysisSession {
  id: number;
  session_id: string;
  created_at: string;
  total_nodes: number;
  total_edges: number;
  suspicious_nodes: number;
  avg_risk_score: number;
  risk_threshold: number;
  data_source: string;
}

const AnalysisHistory: React.FC = () => {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchAddress, setSearchAddress] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewingSession, setViewingSession] = useState<any>(null);

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/get-history?page=${page}&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      toast.error('Failed to load history');
      console.error('Fetch history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchAddress || searchAddress.length !== 42) {
      toast.error('Please enter a valid Ethereum address');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/search-address/${searchAddress}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data);
        toast.success(`Found ${data.appearances} appearances`);
      } else {
        toast.error('Address not found in history');
      }
    } catch (error) {
      toast.error('Search failed');
      console.error('Search error:', error);
    }
  };

  const handleViewSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/get-session/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setViewingSession(data);
        toast.success('Session loaded');
      } else {
        toast.error('Failed to load session details');
      }
    } catch (error) {
      toast.error('Failed to load session');
      console.error('View session error:', error);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this analysis? This cannot be undone.')) return;

    try {
      const response = await fetch(`${API_URL}/delete-session/${sessionId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Analysis deleted');
        fetchHistory();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete');
      console.error('Delete error:', error);
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString();
  };

  const getRiskBadge = (risk: number) => {
    if (risk >= 0.7) return { variant: 'destructive' as const, label: 'High Risk' };
    if (risk >= 0.4) return { variant: 'default' as const, label: 'Medium Risk' };
    return { variant: 'secondary' as const, label: 'Low Risk' };
  };

  // If viewing a session, show details modal
  if (viewingSession) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Session Details</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setViewingSession(null)}>
                ← Back to History
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(viewingSession.session.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Wallets</p>
                  <p className="font-medium">{viewingSession.session.total_nodes}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="font-medium">{viewingSession.session.total_edges}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Suspicious</p>
                  <p className="font-medium text-warning">{viewingSession.session.suspicious_nodes}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Transactions ({viewingSession.transactions.length})</h4>
                <ScrollArea className="h-96 border rounded-lg">
                  <div className="p-4 space-y-2">
                    {viewingSession.transactions.map((tx: any, idx: number) => (
                      <div key={idx} className="p-3 bg-secondary/30 rounded text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-xs">{tx.from_address.slice(0, 10)}...</code>
                          <span>→</span>
                          <code className="text-xs">{tx.to_address.slice(0, 10)}...</code>
                          <Badge variant={tx.is_suspicious ? 'destructive' : 'secondary'} className="text-xs">
                            {tx.is_suspicious ? 'Suspicious' : 'Clean'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{tx.value} ETH</span>
                          <span>Risk: {(tx.risk_score * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Address History
          </CardTitle>
          <CardDescription>
            Check if an address appeared in previous analyses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter Ethereum address (0x...)"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Search Results */}
          {searchResults && (
            <div className="mt-4 p-4 bg-secondary/30 rounded-lg animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Results for {searchResults.address.slice(0, 10)}...</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.open(`https://etherscan.io/address/${searchResults.address}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Appearances</p>
                  <p className="text-xl font-bold">{searchResults.appearances}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Times Flagged</p>
                  <p className="text-xl font-bold text-destructive">{searchResults.flaggedCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={searchResults.flaggedCount > 0 ? 'destructive' : 'secondary'}>
                    {searchResults.flaggedCount > 0 ? 'Suspicious' : 'Clean'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History List */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-accent" />
                Analysis History
              </CardTitle>
              <CardDescription>
                Past fraud detection analyses
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              <Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No analysis history yet. Run your first fraud detection to see results here.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {sessions.map((session) => {
                  const riskBadge = getRiskBadge(session.avg_risk_score);
                  
                  return (
                    <div 
                      key={session.session_id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {formatDate(session.created_at)}
                            </span>
                            <Badge variant="outline">{session.data_source}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Transactions</p>
                              <p className="font-bold">{session.total_edges.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Wallets</p>
                              <p className="font-bold">{session.total_nodes.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Suspicious</p>
                              <p className="font-bold text-warning">
                                {session.suspicious_nodes} ({((session.suspicious_nodes / session.total_nodes) * 100).toFixed(1)}%)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant={riskBadge.variant}>
                              {riskBadge.label}: {(session.avg_risk_score * 100).toFixed(1)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Threshold: {(session.risk_threshold * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSession(session.session_id)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(session.session_id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisHistory;