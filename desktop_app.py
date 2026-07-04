import webview
import threading
import time
import sys
import os

# Modification du sys.path pour pouvoir importer le backend
base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
if hasattr(sys, '_MEIPASS'):
    base_dir = sys._MEIPASS
sys.path.insert(0, os.path.join(base_dir, 'backend'))

from backend.main import app
import uvicorn

def start_server():
    # Démarre FastAPI en local (qui sert aussi les fichiers statiques de Next.js)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")

def wait_and_load(window):
    # Laisser le temps à FastAPI de démarrer
    time.sleep(3) 
    window.load_url('http://127.0.0.1:8000')

if __name__ == '__main__':
    # Démarrer le serveur IA monolithique dans un thread
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    
    html_loading = """
    <html>
    <body style="background-color: #0d1117; color: #8b949e; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0;">
        <div style="text-align: center;">
            <h1 style="color: #10b981; font-weight: 400; letter-spacing: 4px; font-size: 2rem;">KING2MO</h1>
            <p style="opacity: 0.7; font-size: 0.9rem;">Initialisation du Monolithe IA en cours...</p>
        </div>
    </body>
    </html>
    """
    
    window = webview.create_window(
        title='KING2MO - Standalone RAG',
        html=html_loading,
        width=1280,
        height=850,
        min_size=(900, 600)
    )
    
    threading.Thread(target=wait_and_load, args=(window,), daemon=True).start()
    webview.start()
