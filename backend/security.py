import os
import secrets
import threading
import time
from typing import List, Optional
from fastapi import Header, HTTPException

from config import _PLACEHOLDER_TOKENS

# Auth obligatoire : exige le BACKEND_API_TOKEN défini dans le .env
def require_token(x_api_token: Optional[str] = Header(default=None)):
    # Pas de mot de passe par défaut codé en dur : le .env doit le définir.
    expected = os.environ.get("BACKEND_API_TOKEN", "")
    if not expected or expected in _PLACEHOLDER_TOKENS:
        raise HTTPException(status_code=500, detail="BACKEND_API_TOKEN non configuré sur le serveur.")
    # (N4) Comparaison en temps constant pour éviter les attaques par timing.
    if not x_api_token or not secrets.compare_digest(str(x_api_token), expected):
        raise HTTPException(status_code=401, detail="Mot de passe d'accès invalide ou manquant.")
    return True

# ---------------------------------------------------------------------
# (C-2) Garde-fous anti-abus sur /api/chat :
#   - concurrence bornée (évite l'explosion mémoire/CPU si un script ouvre
#     des dizaines de flux SSE en parallèle) ;
#   - débit borné par minute (évite les rafales) ;
#   - plafond de dépense quotidien optionnel (protège la facture API).
# Tout est local et en mémoire : suffisant pour une app mono-utilisateur.
# ---------------------------------------------------------------------
_MAX_CONCURRENT_CHATS = int(os.environ.get("MAX_CONCURRENT_CHATS", "3"))
_MAX_CHATS_PER_MINUTE = int(os.environ.get("MAX_CHATS_PER_MINUTE", "30"))
# 0 = pas de plafond. Sinon, dépense estimée max par jour en USD.
_DAILY_SPEND_CAP_USD = float(os.environ.get("DAILY_SPEND_CAP_USD", "0") or "0")

_chat_semaphore = threading.Semaphore(_MAX_CONCURRENT_CHATS)
_rate_lock = threading.Lock()
_chat_timestamps: List[float] = []          # horodatages des requêtes récentes
_spend_day: str = ""                        # jour courant (YYYY-MM-DD)
_spend_today: float = 0.0                   # dépense estimée cumulée du jour

def _check_rate_limit() -> None:
    """Lève une HTTPException 429 si le débit/minute est dépassé."""
    now = time.time()
    with _rate_lock:
        # On ne garde que les 60 dernières secondes.
        cutoff = now - 60
        _chat_timestamps[:] = [t for t in _chat_timestamps if t > cutoff]
        if len(_chat_timestamps) >= _MAX_CHATS_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="Trop de requêtes en peu de temps. Patientez quelques instants.",
            )
        _chat_timestamps.append(now)

def _check_spend_cap() -> None:
    """Lève une HTTPException 429 si le plafond de dépense quotidien est atteint."""
    if _DAILY_SPEND_CAP_USD <= 0:
        return
    global _spend_day, _spend_today
    today = time.strftime("%Y-%m-%d")
    with _rate_lock:
        if today != _spend_day:
            _spend_day, _spend_today = today, 0.0
        if _spend_today >= _DAILY_SPEND_CAP_USD:
            raise HTTPException(
                status_code=429,
                detail=f"Plafond de dépense quotidien atteint ({_DAILY_SPEND_CAP_USD:.2f} $). "
                       "Modifiable via DAILY_SPEND_CAP_USD.",
            )

def _record_spend(input_tokens: int, output_tokens: int, search_count: int) -> None:
    """Estimation grossière de la dépense pour alimenter le plafond quotidien.
    Utilise des tarifs plancher volontairement prudents (surestime un peu)."""
    if _DAILY_SPEND_CAP_USD <= 0:
        return
    global _spend_today
    est = (input_tokens / 1_000_000) * 0.30 + (output_tokens / 1_000_000) * 2.50 + search_count * 0.005
    with _rate_lock:
        _spend_today += est

# (M-6) Signatures binaires des formats d'image réellement supportés.
_IMAGE_MAGIC = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpeg",
    b"GIF87a": "gif",
    b"GIF89a": "gif",
    b"RIFF": "webp",  # complété par la vérification 'WEBP' plus bas
}

def _validate_image_base64(b64: str) -> None:
    """Rejette (400) tout contenu qui n'est pas une vraie image d'un format
    supporté. Auparavant, un base64 arbitraire était transmis tel quel au LLM."""
    import base64 as _b64, binascii
    raw = b64.strip()
    if raw.startswith("data:"):
        header, _, raw = raw.partition(",")
        if "image/" not in header:
            raise HTTPException(status_code=400, detail="En-tête d'image invalide.")
    try:
        head = _b64.b64decode(raw[:64] + "===", validate=False)[:16]
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Image encodée en base64 invalide.")
    ok = any(head.startswith(sig) for sig in _IMAGE_MAGIC)
    if head[:4] == b"RIFF" and head[8:12] != b"WEBP":
        ok = False
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Le fichier fourni n'est pas une image valide (PNG, JPEG, GIF ou WebP).",
        )
