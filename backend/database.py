# backend/database.py
import sqlite3
from datetime import datetime

DATABASE = 'fraud_history.db'

def init_db():
    """Initialize database tables"""
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Analysis sessions table
    c.execute('''CREATE TABLE IF NOT EXISTS analysis_sessions
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  session_id TEXT UNIQUE,
                  created_at TEXT,
                  total_nodes INTEGER,
                  total_edges INTEGER,
                  suspicious_nodes INTEGER,
                  avg_risk_score REAL,
                  risk_threshold REAL,
                  data_source TEXT)''')
    
    # Transactions table
    c.execute('''CREATE TABLE IF NOT EXISTS transactions
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  session_id TEXT,
                  from_address TEXT,
                  to_address TEXT,
                  value REAL,
                  timestamp TEXT,
                  tx_hash TEXT,
                  block_number INTEGER,
                  risk_score REAL,
                  is_suspicious BOOLEAN,
                  FOREIGN KEY(session_id) REFERENCES analysis_sessions(session_id))''')# Add to init_db() function

# Watchlist table
    c.execute('''CREATE TABLE IF NOT EXISTS watchlist
             (id INTEGER PRIMARY KEY AUTOINCREMENT,
              address TEXT NOT NULL,
              user_email TEXT,
              user_id TEXT,
              alert_type TEXT DEFAULT 'all',
              created_at TEXT,
              last_checked TEXT,
              last_tx_hash TEXT,
              is_active BOOLEAN DEFAULT 1,
              UNIQUE(address, user_email))''')

# Alerts table
    c.execute('''CREATE TABLE IF NOT EXISTS alerts
             (id INTEGER PRIMARY KEY AUTOINCREMENT,
              watchlist_id INTEGER,
              address TEXT,
              tx_hash TEXT,
              from_address TEXT,
              to_address TEXT,
              value REAL,
              timestamp TEXT,
              alert_sent BOOLEAN DEFAULT 0,
              created_at TEXT,
              FOREIGN KEY(watchlist_id) REFERENCES watchlist(id))''')

# Create indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_watchlist_address ON watchlist(address)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist(is_active)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts(alert_sent)')
    
    # Create indexes for fast search
    c.execute('CREATE INDEX IF NOT EXISTS idx_from_addr ON transactions(from_address)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_to_addr ON transactions(to_address)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_session ON transactions(session_id)')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized")

if __name__ == '__main__':
    init_db()