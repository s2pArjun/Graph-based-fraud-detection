from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
import os
import json
import shutil
from datetime import datetime
import io
import zipfile
import sqlite3
import uuid
from datetime import datetime, timedelta
import threading
import time

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
NOTEBOOK_PATH = 'gcn_training.ipynb'
DATABASE = 'fraud_history.db'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "GCN Training API is running"})

@app.route('/api/train-gcn', methods=['POST'])
def train_gcn():
    try:
        data = request.get_json()
        session_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        session_folder = os.path.join(OUTPUT_FOLDER, session_id)
        os.makedirs(session_folder, exist_ok=True)
        
        # Handle Data File
        if 'graphData' in data and data['graphData']:
            # If frontend sends data, save it
            with open(os.path.join(session_folder, 'gcn-graph-with-neighbors.json'), 'w') as f:
                json.dump(data['graphData'], f)
        else:
            # Use default file from backend folder if no data sent
            default_file = 'gcn-graph-with-neighbors-2025-11-03.json'
            if os.path.exists(default_file):
                shutil.copy(default_file, os.path.join(session_folder, 'gcn-graph-with-neighbors.json'))
            else:
                return jsonify({"error": "No graph data found"}), 400

        # Load and Execute Notebook
        with open(NOTEBOOK_PATH, 'r', encoding='utf-8') as f:
            notebook = nbformat.read(f, as_version=4)
            
        # Inject parameters
        params_cell = nbformat.v4.new_code_cell(source=f"""
EPOCHS = {data.get('epochs', 200)}
LEARNING_RATE = {data.get('learningRate', 0.01)}
""")
        notebook.cells.insert(0, params_cell)
        
        ep = ExecutePreprocessor(timeout=600, kernel_name='python3')
        
        # Run inside the session folder so outputs are saved there
        cwd = os.getcwd()
        os.chdir(session_folder)
        try:
            ep.preprocess(notebook, {'metadata': {'path': './'}})
        finally:
            os.chdir(cwd)
            
        # Collect Output Files
        generated_files = []
        for f in os.listdir(session_folder):
            if f.endswith(('.png', '.csv', '.json')):
                generated_files.append({
                    "filename": f,
                    "size": os.path.getsize(os.path.join(session_folder, f))
                })
                
        return jsonify({
            "success": True,
            "sessionId": session_id,
            "message": "Training complete",
            "generatedFiles": generated_files
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download/<session_id>/<filename>', methods=['GET'])
def download_file(session_id, filename):
    return send_file(os.path.join(OUTPUT_FOLDER, session_id, filename), as_attachment=True)

@app.route('/api/download/<session_id>', methods=['GET'])
def download_zip(session_id):
    session_folder = os.path.join(OUTPUT_FOLDER, session_id)
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(session_folder):
            for file in files:
                zf.write(os.path.join(root, file), file)
    memory_file.seek(0)
    return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name='results.zip')

@app.route('/api/save-analysis', methods=['POST'])
def save_analysis():
    """Save analysis results to database"""
    try:
        data = request.get_json()
        
        session_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        
        # Save session summary
        c.execute('''INSERT INTO analysis_sessions 
                     (session_id, created_at, total_nodes, total_edges, 
                      suspicious_nodes, avg_risk_score, risk_threshold, data_source)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                  (session_id, created_at, 
                   data['stats']['totalNodes'],
                   data['stats']['totalEdges'],
                   data['stats']['suspiciousNodes'],
                   data['stats']['riskScore'],
                   data['stats']['riskThreshold'],
                   data.get('dataSource', 'CSV Upload')))
        
        # Save transactions
        for tx in data['transactions']:
            c.execute('''INSERT OR IGNORE INTO transactions 
                         (session_id, from_address, to_address, value, timestamp, 
                          tx_hash, block_number, risk_score, is_suspicious)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                      (session_id,
                       tx['from_address'],
                       tx['to_address'],
                       tx.get('value', 0),
                       tx.get('timestamp', ''),
                       tx.get('transaction_hash', ''),
                       tx.get('block_number', 0),
                       tx.get('risk_score', 0),
                       tx.get('is_suspicious', False)))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "sessionId": session_id,
            "message": "Analysis saved successfully"
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/get-history', methods=['GET'])
def get_history():
    """Get all analysis sessions"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        offset = (page - 1) * limit
        
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get total count
        c.execute('SELECT COUNT(*) as count FROM analysis_sessions')
        total = c.fetchone()['count']
        
        # Get paginated results
        c.execute('''SELECT * FROM analysis_sessions 
                     ORDER BY created_at DESC 
                     LIMIT ? OFFSET ?''', (limit, offset))
        
        sessions = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return jsonify({
            "success": True,
            "data": sessions,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "totalPages": (total + limit - 1) // limit
            }
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/get-session/<session_id>', methods=['GET'])
def get_session_details(session_id):
    """Get detailed data for a specific session"""
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get session info
        c.execute('SELECT * FROM analysis_sessions WHERE session_id = ?', (session_id,))
        session = dict(c.fetchone())
        
        # Get transactions for this session
        c.execute('SELECT * FROM transactions WHERE session_id = ?', (session_id,))
        transactions = [dict(row) for row in c.fetchall()]
        
        conn.close()
        
        return jsonify({
            "success": True,
            "session": session,
            "transactions": transactions
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/search-address/<address>', methods=['GET'])
def search_address(address):
    """Search for an address across all analyses"""
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Find all sessions where this address appears
        c.execute('''SELECT DISTINCT t.session_id, a.*, t.risk_score, t.is_suspicious
                     FROM transactions t
                     JOIN analysis_sessions a ON t.session_id = a.session_id
                     WHERE t.from_address = ? OR t.to_address = ?
                     ORDER BY a.created_at DESC''', (address.lower(), address.lower()))
        
        results = [dict(row) for row in c.fetchall()]
        
        # Get total times flagged
        c.execute('''SELECT COUNT(*) as count FROM transactions 
                     WHERE (from_address = ? OR to_address = ?) 
                     AND is_suspicious = 1''', (address.lower(), address.lower()))
        
        flagged_count = c.fetchone()['count']
        
        conn.close()
        
        return jsonify({
            "success": True,
            "address": address,
            "appearances": len(results),
            "flaggedCount": flagged_count,
            "sessions": results
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/delete-session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session and its transactions"""
    try:
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        
        c.execute('DELETE FROM transactions WHERE session_id = ?', (session_id,))
        c.execute('DELETE FROM analysis_sessions WHERE session_id = ?', (session_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "message": "Session deleted"})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/watchlist/add', methods=['POST'])
def add_to_watchlist():
    """Add an address to watchlist"""
    try:
        data = request.get_json()
        address = data.get('address', '').lower()
        user_email = data.get('email')
        alert_type = data.get('alertType', 'all')  # 'all', 'incoming', 'outgoing'
        
        if not address or len(address) != 42:
            return jsonify({"success": False, "error": "Invalid address"}), 400
        
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        
        try:
            c.execute('''INSERT INTO watchlist 
                         (address, user_email, alert_type, created_at, last_checked)
                         VALUES (?, ?, ?, ?, ?)''',
                      (address, user_email, alert_type, 
                       datetime.now().isoformat(), 
                       datetime.now().isoformat()))
            conn.commit()
            
            watchlist_id = c.lastrowid
            
            return jsonify({
                "success": True,
                "message": "Address added to watchlist",
                "watchlistId": watchlist_id
            })
        except sqlite3.IntegrityError:
            return jsonify({
                "success": False, 
                "error": "Address already in your watchlist"
            }), 409
        finally:
            conn.close()
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    """Get user's watchlist"""
    try:
        user_email = request.args.get('email')
        
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        query = 'SELECT * FROM watchlist WHERE is_active = 1'
        params = []
        
        if user_email:
            query += ' AND user_email = ?'
            params.append(user_email)
        
        query += ' ORDER BY created_at DESC'
        
        c.execute(query, params)
        watchlist = [dict(row) for row in c.fetchall()]
        
        # Get alert count for each address
        for item in watchlist:
            c.execute('SELECT COUNT(*) as count FROM alerts WHERE watchlist_id = ?', 
                     (item['id'],))
            item['alert_count'] = c.fetchone()['count']
        
        conn.close()
        
        return jsonify({
            "success": True,
            "watchlist": watchlist
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/watchlist/<int:watchlist_id>', methods=['DELETE'])
def remove_from_watchlist(watchlist_id):
    """Remove address from watchlist"""
    try:
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        
        c.execute('UPDATE watchlist SET is_active = 0 WHERE id = ?', (watchlist_id,))
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "message": "Removed from watchlist"})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/watchlist/<int:watchlist_id>/alerts', methods=['GET'])
def get_address_alerts(watchlist_id):
    """Get alerts for a specific watchlist address"""
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('''SELECT * FROM alerts 
                     WHERE watchlist_id = ? 
                     ORDER BY created_at DESC 
                     LIMIT 50''', (watchlist_id,))
        
        alerts = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return jsonify({
            "success": True,
            "alerts": alerts
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    from database import init_db
    init_db()
    app.run(debug=True, port=5000)