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

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
NOTEBOOK_PATH = 'gcn_training.ipynb'

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)