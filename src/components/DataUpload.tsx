import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle, AlertCircle, Database, Info, Wifi } from "lucide-react";
import { fetchLatestTransactions, validateApiKey } from "@/lib/etherscanAPI";

interface DataUploadProps {
  onDataUpload: (data: any[]) => void;
}

const DataUpload: React.FC<DataUploadProps> = ({ onDataUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Etherscan API state
  const [apiKey] = useState<string>('JYX1K3WV1RIQ99RDYD6S8WDF21U7Q3UGGA');
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveDataPreview, setLiveDataPreview] = useState<any[] | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadStatus('error');
      return;
    }

    setUploadedFile(file);
    setUploadStatus('processing');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Parse CSV data
      const data = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setCsvPreview(data);
      setLiveDataPreview(null); // Clear live data preview when CSV is uploaded
      setUploadStatus('success');
    } catch (error) {
      setUploadStatus('error');
      console.error('Error parsing CSV:', error);
    }
  };

  // Rename to handleAnalyzeCSV
  const handleAnalyzeCSV = async () => {
    if (!uploadedFile) return;
    
    setUploadStatus('processing');
    
    try {
      // Read the ENTIRE file, not just preview
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Parse ALL rows (not just first 5)
      const allData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });
      
      console.log(`Passing ${allData.length} real transactions to analysis`);
      
      // Pass REAL data to analysis
      onDataUpload(allData);
      
    } catch (error) {
      console.error('Error reading full CSV:', error);
      setUploadStatus('error');
    }
  };

  // Fetch live transactions from Etherscan
  const handleFetchLiveTransactions = async () => {
    // API key is hardcoded, no need to check
    setIsFetchingLive(true);
    setUploadStatus('processing');
    setErrorMessage('');

    try {
      // Validate API key first
      const isValid = await validateApiKey(apiKey);
      if (!isValid) {
        setUploadStatus('error');
        setErrorMessage('Invalid API key. Please check and try again.');
        setIsFetchingLive(false);
        return;
      }

      // Fetch transactions
      const result = await fetchLatestTransactions(apiKey, {
        maxTransactions: 100,
        blockCount: 3
      });

      if (!result.success || result.data.length === 0) {
        setUploadStatus('error');
        setErrorMessage(result.error || 'No transactions found');
        setIsFetchingLive(false);
        return;
      }

      // Preview first 5 transactions
      setLiveDataPreview(result.data.slice(0, 5));
      setCsvPreview(null);
      setUploadedFile(null);
      setUploadStatus('success');
      setIsFetchingLive(false);

      console.log(`✅ Fetched ${result.data.length} live transactions`);
    } catch (error) {
      console.error('Error fetching live data:', error);
      setUploadStatus('error');
      setErrorMessage('Failed to fetch transactions. Please try again.');
      setIsFetchingLive(false);
    }
  };

  // Analyze live data
  const handleAnalyzeLiveData = async () => {
    if (!liveDataPreview) return;

    setUploadStatus('processing');

    try {
      // Fetch full dataset again
      const result = await fetchLatestTransactions(apiKey, {
        maxTransactions: 100,
        blockCount: 3
      });

      if (result.success && result.data.length > 0) {
        console.log(`Passing ${result.data.length} live transactions to analysis`);
        onDataUpload(result.data);
      }
    } catch (error) {
      console.error('Error analyzing live data:', error);
      setUploadStatus('error');
      setErrorMessage('Failed to analyze transactions');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs for CSV Upload vs Live Fetch */}
      <Tabs defaultValue="csv" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
          <TabsTrigger value="csv" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload CSV
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Fetch Live Data
          </TabsTrigger>
        </TabsList>

        {/* CSV Upload Tab */}
        <TabsContent value="csv" className="space-y-6 mt-6">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Dataset Upload
              </CardTitle>
              <CardDescription>
                Upload Ethereum transaction data in CSV format for analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload Zone */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
                  dragActive 
                    ? 'border-primary bg-primary/10 shadow-glow' 
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className="space-y-4">
                  <div className={`mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-300 ${
                    dragActive ? 'scale-110 animate-pulse-glow' : ''
                  }`}>
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Drop your CSV file here</h3>
                    <p className="text-sm text-muted-foreground">
                      or click to browse your files
                    </p>
                  </div>
                  
                  <Button variant="outline" className="mt-4">
                    <FileText className="h-4 w-4 mr-2" />
                    Select CSV File
                  </Button>
                </div>
              </div>

              {/* Upload Status */}
              {uploadStatus === 'processing' && !isFetchingLive && (
                <Alert className="border-primary/20 bg-primary/10">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">
                    Processing file... Please wait.
                  </AlertDescription>
                </Alert>
              )}

              {uploadStatus === 'error' && errorMessage && (
                <Alert className="border-destructive/20 bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              {uploadStatus === 'success' && uploadedFile && !liveDataPreview && (
                <Alert className="border-success/20 bg-success/10">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    File uploaded successfully: {uploadedFile.name}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* CSV Preview */}
          {csvPreview && (
            <Card className="bg-gradient-card border-border shadow-card animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-accent" />
                    Data Preview
                  </span>
                  <Badge variant="secondary">
                    {uploadedFile?.name}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  First 5 rows of your transaction data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(csvPreview[0] || {}).map((header) => (
                          <th key={header} className="text-left p-3 font-medium text-muted-foreground">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, index) => (
                        <tr key={index} className="border-b border-border/50 hover:bg-muted/20">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="p-3 font-mono text-xs">
                              {String(value).substring(0, 20)}
                              {String(value).length > 20 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex justify-center">
                  <Button 
                    onClick={handleAnalyzeCSV}
                    className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                    size="lg"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Start Fraud Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Live Fetch Tab */}
        <TabsContent value="live" className="space-y-6 mt-6">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-accent" />
                Fetch Live Transactions
              </CardTitle>
              <CardDescription>
                Connect to Etherscan API to analyze the latest 100 transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fetch Button */}
              <Button
                onClick={handleFetchLiveTransactions}
                disabled={isFetchingLive}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
                size="lg"
              >
                {isFetchingLive ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Fetching Transactions...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Fetch Latest 100 Transactions
                  </>
                )}
              </Button>

              {/* Status Messages */}
              {uploadStatus === 'processing' && isFetchingLive && (
                <Alert className="border-primary/20 bg-primary/10">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">
                    Connecting to Etherscan... Please wait.
                  </AlertDescription>
                </Alert>
              )}

              {uploadStatus === 'error' && errorMessage && (
                <Alert className="border-destructive/20 bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              {uploadStatus === 'success' && liveDataPreview && (
                <Alert className="border-success/20 bg-success/10">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    Successfully fetched {liveDataPreview.length}+ live transactions from Ethereum network
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Live Data Preview */}
          {liveDataPreview && (
            <Card className="bg-gradient-card border-border shadow-card animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-accent" />
                    Live Data Preview
                  </span>
                  <Badge variant="secondary" className="bg-success/20 text-success">
                    Live from Etherscan
                  </Badge>
                </CardTitle>
                <CardDescription>
                  First 5 transactions from the latest blocks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(liveDataPreview[0] || {}).map((header) => (
                          <th key={header} className="text-left p-3 font-medium text-muted-foreground">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {liveDataPreview.map((row, index) => (
                        <tr key={index} className="border-b border-border/50 hover:bg-muted/20">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="p-3 font-mono text-xs">
                              {String(value).substring(0, 20)}
                              {String(value).length > 20 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex justify-center">
                  <Button 
                    onClick={handleAnalyzeLiveData}
                    className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                    size="lg"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Start Fraud Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Data Requirements */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-accent" />
            Data Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-accent">Required Columns:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <code className="text-primary">from_address</code> - Sender wallet</li>
                <li>• <code className="text-primary">to_address</code> - Receiver wallet</li>
                <li>• <code className="text-primary">value</code> - Transaction amount</li>
                <li>• <code className="text-primary">timestamp</code> - Transaction time</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-accent">Optional Columns:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <code className="text-primary">block_number</code> - Block height</li>
                <li>• <code className="text-primary">gas_price</code> - Gas cost</li>
                <li>• <code className="text-primary">transaction_hash</code> - TX hash</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataUpload;