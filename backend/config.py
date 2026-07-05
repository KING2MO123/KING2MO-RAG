import sys
import os
import secrets
from dotenv import load_dotenv

load_dotenv()

def _env_file_path() -> str:
    if getattr(sys, "frozen", False):
        return os.path.join(os.path.dirname(sys.executable), ".env")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

_PLACEHOLDER_TOKENS = {"", "changez_moi_svp", "changeme", "admin", "password"}

def _ensure_backend_token() -> str:
    """Au premier lancement (token absent ou placeholder), génère un token
    aléatoire fort et le persiste dans le .env. L'utilisateur le lit dans le
    .env pour se connecter depuis l'interface."""
    token = os.environ.get("BACKEND_API_TOKEN", "").strip().strip('"')
    if token not in _PLACEHOLDER_TOKENS:
        return token
    token = secrets.token_urlsafe(24)
    env_path = _env_file_path()
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("BACKEND_API_TOKEN="):
            lines[i] = f'BACKEND_API_TOKEN="{token}"'
            break
    else:
        lines.insert(0, f'BACKEND_API_TOKEN="{token}"')
    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.environ["BACKEND_API_TOKEN"] = token
    return token

_VALID_PROVIDERS = {"", "gemini", "deepseek", "gemini-openai", "custom", "ollama"}

def _mask_key(value: str) -> str:
    if not value:
        return ""
    return value[:4] + "…" + value[-4:] if len(value) > 8 else "•" * len(value)
