import sqlite3
import requests
import time
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

DATABASE = 'fraud_history.db'
ETHERSCAN_API_KEY = 'JYX1K3WV1RIQ99RDYD6S8WDF21U7Q3UGGA'
ETHERSCAN_BASE_URL = 'https://api.etherscan.io/v2/api'
CHECK_INTERVAL = 120  # 2 minutes for testing (change to 600 for production)

# Email configuration
SMTP_ENABLED = True  # Your email is working
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_EMAIL = 's2parjun@gmail.com'  # Your email
SMTP_PASSWORD = 'tiar tkvf tncy qsdf'  # Your app password

def get_db_connection():
    """Get database connection with WAL mode and timeout"""
    conn = sqlite3.connect(DATABASE, timeout=10.0)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=10000')
    return conn

def execute_with_retry(func, max_retries=3):
    """Execute database operation with retry logic"""
    for attempt in range(max_retries):
        try:
            return func()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                print(f"  ⚠️  Database locked, retrying ({attempt + 1}/{max_retries})...")
                time.sleep(1)
            else:
                raise
    return None

def fetch_latest_tx(address, api_key):
    """Fetch the most recent transaction for an address"""
    try:
        url = f"{ETHERSCAN_BASE_URL}?chainid=1&module=account&action=txlist&address={address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey={api_key}"
        
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('status') == '1' and data.get('result'):
            tx = data['result'][0]
            return {
                'hash': tx['hash'],
                'from': tx['from'],
                'to': tx['to'],
                'value': int(tx['value']) / 1e18,
                'timestamp': datetime.fromtimestamp(int(tx['timeStamp'])).isoformat(),
                'block': int(tx['blockNumber'])
            }
        return None
    except Exception as e:
        print(f"  ❌ Error fetching tx for {address[:10]}...: {e}")
        return None

def send_email_alert(user_email, address, tx_data):
    """Send email notification"""
    if not SMTP_ENABLED:
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = user_email
        msg['Subject'] = f'🚨 New Transaction Detected: {address[:10]}...'
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #e74c3c;">🚨 Fraud Alert: New Transaction Detected</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Watched Address:</strong> <code>{address}</code></p>
                <p><strong>Transaction Hash:</strong> <code>{tx_data['hash']}</code></p>
                <p><strong>From:</strong> <code>{tx_data['from']}</code></p>
                <p><strong>To:</strong> <code>{tx_data['to']}</code></p>
                <p><strong>Value:</strong> <span style="color: #27ae60; font-weight: bold;">{tx_data['value']:.6f} ETH</span></p>
                <p><strong>Time:</strong> {tx_data['timestamp']}</p>
            </div>
            <a href="https://etherscan.io/tx/{tx_data['hash']}" 
               style="display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px;">
               View on Etherscan
            </a>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"  ✅ Email sent to {user_email}")
        return True
    except Exception as e:
        print(f"  ❌ Email send failed: {e}")
        return False

def save_alert_to_db(item_id, address, tx_data):
    """Save alert to database with retry logic"""
    def save_operation():
        conn = get_db_connection()
        c = conn.cursor()
        
        try:
            # Save alert
            c.execute('''INSERT INTO alerts 
                         (watchlist_id, address, tx_hash, from_address, to_address, 
                          value, timestamp, created_at, alert_sent)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                      (item_id, address, tx_data['hash'], 
                       tx_data['from'], tx_data['to'], tx_data['value'],
                       tx_data['timestamp'], datetime.now().isoformat(), 1))
            
            # Update last_tx_hash
            c.execute('UPDATE watchlist SET last_tx_hash = ?, last_checked = ? WHERE id = ?',
                     (tx_data['hash'], datetime.now().isoformat(), item_id))
            
            conn.commit()
            return True
        finally:
            conn.close()
    
    return execute_with_retry(save_operation)

def update_last_checked(item_id):
    """Update last_checked timestamp"""
    def update_operation():
        conn = get_db_connection()
        c = conn.cursor()
        try:
            c.execute('UPDATE watchlist SET last_checked = ? WHERE id = ?',
                     (datetime.now().isoformat(), item_id))
            conn.commit()
            return True
        finally:
            conn.close()
    
    return execute_with_retry(update_operation)

def check_watchlist():
    """Main monitoring loop"""
    print(f"🔍 Checking watchlist at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get active watchlist items
        c.execute('SELECT * FROM watchlist WHERE is_active = 1')
        watchlist = c.fetchall()
        conn.close()
        
        if len(watchlist) == 0:
            print("  📭 No addresses in watchlist")
            return
        
        for item in watchlist:
            address = item['address']
            last_tx_hash = item['last_tx_hash']
            
            print(f"  🔎 Checking {address[:10]}...")
            
            # Fetch latest transaction
            tx_data = fetch_latest_tx(address, ETHERSCAN_API_KEY)
            
            if tx_data and tx_data['hash'] != last_tx_hash:
                # New transaction detected!
                print(f"  🚨 NEW TRANSACTION: {tx_data['hash'][:10]}...")
                
                # Send email first
                email_sent = False
                if item['user_email'] and SMTP_ENABLED:
                    email_sent = send_email_alert(item['user_email'], address, tx_data)
                
                # Save to database with retry
                if save_alert_to_db(item['id'], address, tx_data):
                    print(f"  💾 Alert saved to database")
                else:
                    print(f"  ⚠️  Failed to save alert after retries")
            else:
                # No new transaction, just update timestamp
                update_last_checked(item['id'])
            
            time.sleep(0.3)  # Rate limit protection (3 requests/second)
        
        print(f"✅ Check complete\n")
        
    except Exception as e:
        print(f"❌ Error in check_watchlist: {e}\n")

def run_monitor():
    """Run monitoring service continuously"""
    print("=" * 60)
    print("🚀 Starting Fraud Alert Monitor")
    print("=" * 60)
    print(f"📊 Check interval: {CHECK_INTERVAL} seconds ({CHECK_INTERVAL/60:.1f} minutes)")
    print(f"📧 Email alerts: {'ENABLED' if SMTP_ENABLED else 'DISABLED'}")
    print(f"🔑 API Key: {ETHERSCAN_API_KEY[:10]}...")
    print(f"📧 Email: {SMTP_EMAIL}")
    print("=" * 60)
    print()
    
    while True:
        try:
            check_watchlist()
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            print("\n" + "=" * 60)
            print("🛑 Monitor stopped by user")
            print("=" * 60)
            break
        except Exception as e:
            print(f"❌ Critical error in monitor: {e}")
            print("⏸️  Waiting 60 seconds before retry...\n")
            time.sleep(60)

if __name__ == '__main__':
    # Initialize database if needed
    from database import init_db
    init_db()
    
    # Start monitoring
    run_monitor()