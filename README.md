# 🛡️ Ethereum Fraud Detection System

An advanced fraud detection platform that combines traditional graph analysis with Graph Convolutional Networks (GCN) to identify suspicious patterns in Ethereum blockchain transactions.
![Project Banner](https://img.shields.io/badge/Ethereum-Fraud%20Detection-blue)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 **Overview**

This project provides a comprehensive fraud detection system for Ethereum transactions using:

- **Graph Theory Analysis**: PageRank, cycle detection, strongly connected components
- **Machine Learning**: Graph Convolutional Networks (GCN) for pattern recognition
- **Real-Time Data**: Direct integration with Etherscan API
- **Interactive Visualization**: Network graphs and fraud cluster analysis

---

## ✨ **Key Features**

### 🔍 **Multi-Layer Fraud Detection**
- **Graph-based metrics**: Degree centrality, PageRank, transaction entropy
- **Pattern detection**: Circular transactions, wash trading, fraud rings
- **GCN analysis**: Deep learning on transaction networks
- **Dynamic thresholds**: Adaptive risk scoring based on network statistics

### 📊 **Data Input Methods**
- ✅ CSV file upload (historical transaction data)
- ✅ Live Etherscan API integration (latest 100 transactions)
- ✅ Batch wallet address analysis

### 🎨 **Rich Visualizations**
- Interactive network graphs
- Fraud cluster highlighting
- Risk distribution charts
- Transaction flow diagrams

### 📥 **Export Capabilities**
- Suspicious nodes (CSV)
- Full analysis results (JSON)
- GCN-ready graph structures
- Network visualizations (PNG)

---

## 🏗️ **Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - Data Upload / Etherscan Integration                   │
│  - Interactive Visualizations                            │
│  - Results Dashboard                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│            Graph Analysis Engine (TypeScript)            │
│  - Build transaction graph                               │
│  - Calculate PageRank, entropy, centrality               │
│  - Detect cycles and connected components                │
│  - Compute micro-risk scores                             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│           GCN Processing (Python/Colab)                  │
│  - Hybrid labeling (manual + threshold)                  │
│  - 3-layer GCN architecture                              │
│  - Semi-supervised learning                              │
│  - Fraud probability prediction                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 **Getting Started**

### **Prerequisites**

- Node.js 18+ and npm
- Python 3.8+ (for GCN processing)
- Etherscan API key (free at https://etherscan.io/myapikey)

### **Installation**

1. **Clone the repository**
```bash
   git clone https://github.com/yourusername/ethereum-fraud-detection.git
   cd ethereum-fraud-detection
```

2. **Install frontend dependencies**
```bash
   npm install
```

3. **Configure Etherscan API**
   
   Create `lib/etherscanApi.ts` and add your API key:
```typescript
   const ETHERSCAN_API_KEY = 'YOUR_API_KEY_HERE';
```

4. **Run the development server**
```bash
   npm run dev
```

5. **Open your browser**
   
   Navigate to `http://localhost:5173`

---

## 📖 **Usage Guide**

### **Option 1: Upload CSV File**

1. **Prepare your CSV** with required columns:
```csv
   from_address,to_address,value,timestamp,block_number
   0xABC123...,0xDEF456...,1.5,2024-01-15T10:30:00Z,19000000
```

2. **Upload** via drag-and-drop or file picker

3. **Click** "Start Fraud Analysis"

4. **View results** in the dashboard

### **Option 2: Fetch Live Data**

1. **Click** "Fetch Latest 100 Transactions"

2. **Wait** ~10 seconds while system fetches from Etherscan

3. **Automatic analysis** runs on live data

4. **Explore results** in interactive visualizations

### **Option 3: Run GCN Analysis** (Optional)

1. **Export GCN-ready JSON** from results page

2. **Upload to Google Colab** notebook

3. **Run GCN training** (100-200 epochs)

4. **Download predictions** and import back to dashboard

---

## 🧠 **How It Works**

### **Phase 1: Graph Construction**

// Build directed graph from transactions
Nodes = Unique wallet addresses
Edges = Transactions between addresses
Attributes = value, timestamp, gas_price


### **Phase 2: Feature Engineering**

For each node (wallet):
  - Degree centrality (connections)
  - In-degree / Out-degree (directionality)
  - PageRank (network influence)
  - Transaction entropy (behavioral randomness)
  - Transaction frequency


### **Phase 3: Micro-Score Calculation**

Micro-Score = weighted_sum(
  normalized_degree * 0.3,
  normalized_pagerank * 0.3,
  degree_imbalance * 0.2,
  is_in_cycle * 0.2
)


### **Phase 4: Pattern Detection**
- **Cycles**: Circular transaction flows (A→B→C→A)
- **SCCs**: Strongly connected wallet clusters
- **Anomalies**: Unusual transaction patterns

