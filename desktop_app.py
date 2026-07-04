import webview
import subprocess
import os
import time
import sys
import threading
import atexit

def start_servers():
    # Détecte le dossier racine (même compilé en .exe)
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")
    
    # Démarrer le Backend (FastAPI) en arrière-plan
    backend_process = subprocess.Popen(
        ["uvicorn", "main:app", "--port", "8000"],
        cwd=backend_dir,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )
    
    # Démarrer le Frontend (Next.js) en arrière-plan sur le port 3050
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev", "--", "-p", "3050"],
        cwd=frontend_dir,
        shell=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )
    
    # S'assurer de nettoyer et tuer les serveurs à la fermeture de l'app
    def cleanup():
        try: backend_process.kill() 
        except: pass
        try: frontend_process.kill() 
        except: pass
        
        # Sur Windows, npm run dev lance des processus fils (node) qu'il faut parfois nettoyer rudement
        if os.name == 'nt':
            os.system("taskkill /f /im node.exe >nul 2>&1")
        
    atexit.register(cleanup)
    return backend_process, frontend_process

def wait_and_load(window):
    # Laisser le temps à Next.js de compiler et démarrer (env. 6 secondes)
    time.sleep(6) 
    window.load_url('http://localhost:3050')

if __name__ == '__main__':
    backend_proc, frontend_proc = start_servers()
    
    # Affichage d'un écran de chargement natif pendant que les serveurs démarrent
    html_loading = """
    <html>
    <body style="background-color: #0d1117; color: #8b949e; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0;">
        <div style="text-align: center;">
            <h1 style="color: #10b981; font-weight: 400; letter-spacing: 4px; font-size: 2rem;">KING2MO</h1>
            <p style="opacity: 0.7; font-size: 0.9rem;">Initialisation du moteur IA et de l'interface en cours...</p>
        </div>
    </body>
    </html>
    """
    
    window = webview.create_window(
        title='KING2MO - Agentic RAG v3.0',
        html=html_loading,
        width=1280,
        height=850,
        min_size=(900, 600)
    )
    
    # Démarrer la boucle d'interface native
    threading.Thread(target=wait_and_load, args=(window,), daemon=True).start()
    webview.start()
