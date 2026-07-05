import os
import sys
import time
import socket
import threading
import webview
import uvicorn
import traceback
import logging
from logging.handlers import RotatingFileHandler
from webview.window import Window
class WindowApi:
    def __init__(self, token: str):
        self._token = token
        
    def get_token(self):
        return self._token

    def close(self):
        webview.windows[0].destroy()
        sys.exit(0)
        
    def minimize(self):
        webview.windows[0].minimize()
        
    def maximize(self):
        webview.windows[0].toggle_fullscreen()

def launch(app):
    # Fichier de log à côté de l'exe (ou du script en mode dev)
    if getattr(sys, "frozen", False):
        _app_dir = os.path.dirname(sys.executable)
    else:
        _app_dir = os.path.dirname(os.path.abspath(__file__))
    LOG_FILE = os.path.join(_app_dir, "king2mo_error.log")

    _log_handler = RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    _log_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[_log_handler])

    def _port_in_use(port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(("127.0.0.1", port)) == 0

    def _pick_free_port() -> int:
        for candidate in (8000, 8080, 8501, 3050):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("127.0.0.1", candidate))
                return candidate
            except OSError:
                continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    PORT = _pick_free_port()
    URL = f"http://127.0.0.1:{PORT}"

    DEBUG_UI = os.environ.get("KING2MO_DEBUG", "").strip() == "1"

    def _run_server():
        uvicorn.run(app, host="127.0.0.1", port=PORT, log_config=None)

    PORT_FILE = os.path.join(_app_dir, "king2mo.port")

    loading_html = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>KING2MO</title>
        <style>
            body {{
                background-color: #050508;
                color: #10b981;
                font-family: 'JetBrains Mono', monospace, sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                user-select: none;
                -webkit-app-region: drag;
            }}
            .loader {{
                border: 3px solid rgba(16, 185, 129, 0.1);
                border-top: 3px solid #10b981;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin-bottom: 25px;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
            }}
            @keyframes spin {{ 0% {{ transform: rotate(0deg); }} 100% {{ transform: rotate(360deg); }} }}
            h2 {{ margin:0; letter-spacing: 4px; font-weight: 800; font-size: 24px; }}
            #error-msg {{
                margin-top: 25px;
                color: #ef4444;
                font-size: 14px;
                display: none;
                font-family: sans-serif;
            }}
        </style>
    </head>
    <body>
        <div class="loader"></div>
        <h2>KING2MO</h2>
        <div style="color: #8b949e; font-size: 12px; margin-top: 15px; letter-spacing: 2px;">DÉMARRAGE DU NOYAU RAG...</div>
        <div id="error-msg">Le moteur local met trop de temps à répondre.</div>
        <script>
            let attempts = 0;
            const checkServer = () => {{
                // no-cors mode prevents CORS preflight blocks from null origin
                fetch('{URL}/api/ping', {{ mode: 'no-cors' }})
                    .then(() => {{
                        // Any response (even opaque) means the server is alive!
                        window.location.replace('{URL}');
                    }})
                    .catch(err => {{
                        attempts++;
                        if(attempts > 120) {{
                            document.querySelector('.loader').style.display = 'none';
                            document.getElementById('error-msg').style.display = 'block';
                        }} else {{
                            setTimeout(checkServer, 500);
                        }}
                    }});
            }};
            setTimeout(checkServer, 500);
        </script>
    </body>
    </html>
    """

    try:
        icon_path = os.path.join(sys._MEIPASS, "app.ico") if hasattr(sys, '_MEIPASS') else os.path.join(_app_dir, "..", "app.ico")
        try:
            with open(PORT_FILE, "r", encoding="utf-8") as f:
                previous_port = int(f.read().strip())
            import urllib.request
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{previous_port}/api/ping", timeout=0.5)
                is_king2mo_server = True
            except Exception:
                is_king2mo_server = False

            if is_king2mo_server:
                URL = f"http://127.0.0.1:{previous_port}"
                loading_html_prev = loading_html.replace(f"127.0.0.1:{PORT}", f"127.0.0.1:{previous_port}")
                webview.create_window("KING2MO RAG", html=loading_html_prev, width=1280, height=800, min_size=(900, 600), js_api=WindowApi(os.environ.get("BACKEND_API_TOKEN", "")), zoomable=True)
                webview.start(icon=icon_path, debug=DEBUG_UI)
                sys.exit(0)
        except (OSError, ValueError):
            pass

        with open(PORT_FILE, "w", encoding="utf-8") as f:
            f.write(str(PORT))

        import atexit

        def _cleanup_port_file():
            try:
                if os.path.exists(PORT_FILE):
                    os.remove(PORT_FILE)
            except OSError:
                pass

        atexit.register(_cleanup_port_file)

        current_token = os.environ.get("BACKEND_API_TOKEN", "")
        print("\n" + "="*60)
        print(">> MOT DE PASSE DU SERVEUR KING2MO (Géré automatiquement, rien à faire) :")
        print(f"   {current_token}")
        print("="*60 + "\n")

        threading.Thread(target=_run_server, daemon=True).start()
        
        for _ in range(240):
            if _port_in_use(PORT):
                break
            time.sleep(0.1)

        webview.create_window("KING2MO RAG", html=loading_html, width=1280, height=800, min_size=(900, 600), background_color='#050508', js_api=WindowApi(current_token), zoomable=True)
        webview.start(icon=icon_path, debug=DEBUG_UI)
    except BaseException as e:
        if isinstance(e, SystemExit) and e.code in (0, None):
            raise
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(traceback.format_exc() + "\n")
        raise
