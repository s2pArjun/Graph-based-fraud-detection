import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Download, Loader2, FileDown, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface GCNTrainingProps {
  gcnGraphData?: any;
}

const GCNTrainingComponent: React.FC<GCNTrainingProps> = ({ gcnGraphData }) => {
  const [status, setStatus] = useState<'idle' | 'training' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  
  const API_URL = 'http://localhost:5000/api';

  const startTraining = async () => {
    setStatus('training');
    setProgress(10);
    
    // Simulate progress since backend takes time
    const interval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 5 : prev));
    }, 3000);

    try {
      const response = await fetch(`${API_URL}/train-gcn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // If graphData is null, backend uses the default file
        body: JSON.stringify({ graphData: gcnGraphData, epochs: 200 })
      });

      const data = await response.json();
      clearInterval(interval);

      if (data.success) {
        setProgress(100);
        setResult(data);
        setStatus('success');
        toast.success("Model trained successfully!");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      clearInterval(interval);
      setStatus('error');
      toast.error("Training failed. Is the backend running?");
    }
  };

  const downloadFile = (filename: string) => {
    window.open(`${API_URL}/download/${result.sessionId}/${filename}`, '_blank');
  };

  const downloadAll = () => {
    window.open(`${API_URL}/download/${result.sessionId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            GCN Model Training
          </CardTitle>
          <CardDescription>Train a Graph Convolutional Network on your transaction data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {status === 'idle' && (
            <div className="text-center py-6">
              <Button onClick={startTraining} size="lg" className="bg-primary hover:bg-primary/90">
                <Brain className="mr-2 h-4 w-4" /> Start Training
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Uses data from 'Fraud Results' or default test set</p>
            </div>
          )}

          {status === 'training' && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Training model...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Processing notebook...
              </div>
            </div>
          )}

          {status === 'success' && result && (
            <div className="space-y-4 animate-fade-in">
              <Alert className="border-success/50 bg-success/10 text-success">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Training Complete!</AlertDescription>
              </Alert>

              <div className="grid gap-2">
                {result.generatedFiles.map((file: any) => (
                  <div key={file.filename} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <FileDown className="h-4 w-4 text-primary" />
                      <span className="text-sm">{file.filename}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(file.filename)}>
                      Download
                    </Button>
                  </div>
                ))}
              </div>

              <Button onClick={downloadAll} className="w-full" variant="outline">
                <Download className="mr-2 h-4 w-4" /> Download All Results (ZIP)
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => setStatus('idle')} className="w-full">
                Train Again
              </Button>
            </div>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Training failed. Please check if the Python backend is running on port 5000.
                <Button variant="link" onClick={() => setStatus('idle')} className="p-0 h-auto ml-2 text-destructive-foreground">Retry</Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GCNTrainingComponent;