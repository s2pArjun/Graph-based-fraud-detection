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
CHECK_INTERVAL = 120  # 2 minutes

# Email configuration (optional - can be disabled)
SMTP_ENABLED = True  # Set to True when configured
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_EMAIL = 's2parjun@gmail.com'
SMTP_PASSWORD = 'tiar tkvf tncy qsdf'

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
        print(f"Error fetching tx for {address}: {e}")
        return None


def send_email_alert(user_email, address, tx_data):
    """Send email notification (optional)"""
    if not SMTP_ENABLED:
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = user_email
        msg['Subject'] = f'🚨 New Transaction Detected: {address[:10]}...'
        
        body = f"""
        <h2>Fraud Alert: New Transaction Detected</h2>
        <p><strong>Watched Address:</strong> {address}</p>
        <p><strong>Transaction Hash:</strong> {tx_data['hash']}</p>
        <p><strong>From:</strong> {tx_data['from']}</p>
        <p><strong>To:</strong> {tx_data['to']}</p>
        <p><strong>Value:</strong> {tx_data['value']:.4f} ETH</p>
        <p><strong>Time:</strong> {tx_data['timestamp']}</p>
        <p><a href="https://etherscan.io/tx/{tx_data['hash']}">View on Etherscan</a></p>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Email sent to {user_email}")
    except Exception as e:
        print(f"❌ Email send failed: {e}")


def check_watchlist():
    """Main monitoring loop"""
    print(f"🔍 Checking watchlist at {datetime.now().isoformat()}")
    
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Get active watchlist items
    c.execute('SELECT * FROM watchlist WHERE is_active = 1')
    watchlist = c.fetchall()
    
    for item in watchlist:
        address = item['address']
        last_tx_hash = item['last_tx_hash']
        
        print(f"  Checking {address[:10]}...")
        
        # Fetch latest transaction
        tx_data = fetch_latest_tx(address, ETHERSCAN_API_KEY)
        
        if tx_data and tx_data['hash'] != last_tx_hash:
            # New transaction detected!
            print(f"  🚨 NEW TRANSACTION: {tx_data['hash'][:10]}...")
            
            # Save alert
            c.execute('''INSERT INTO alerts 
                         (watchlist_id, address, tx_hash, from_address, to_address, 
                          value, timestamp, created_at, alert_sent)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                      (item['id'], address, tx_data['hash'], 
                       tx_data['from'], tx_data['to'], tx_data['value'],
                       tx_data['timestamp'], datetime.now().isoformat(), 0))
            
            # Update last_tx_hash
            c.execute('UPDATE watchlist SET last_tx_hash = ?, last_checked = ? WHERE id = ?',
                     (tx_data['hash'], datetime.now().isoformat(), item['id']))
            
            conn.commit()
            
            # Send email if enabled
            if item['user_email'] and SMTP_ENABLED:
                send_email_alert(item['user_email'], address, tx_data)
        else:
            # Update last_checked
            c.execute('UPDATE watchlist SET last_checked = ? WHERE id = ?',
                     (datetime.now().isoformat(), item['id']))
            conn.commit()
        
        time.sleep(0.2)  # Rate limit protection
    
    conn.close()
    print(f"✅ Check complete\n")


def run_monitor():
    """Run monitoring service continuously"""
    print("🚀 Starting Fraud Alert Monitor")
    print(f"📊 Check interval: {CHECK_INTERVAL} seconds ({CHECK_INTERVAL/60} minutes)")
    print(f"📧 Email alerts: {'ENABLED' if SMTP_ENABLED else 'DISABLED'}\n")
    
    while True:
        try:
            check_watchlist()
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            print("\n🛑 Monitor stopped")
            break
        except Exception as e:
            print(f"❌ Error in monitor: {e}")
            time.sleep(60)  # Wait 1 minute on error


if __name__ == '__main__':
    # Initialize database if needed
    from database import init_db
    init_db()
    
    # Start monitoring
    run_monitor()