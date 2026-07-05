"""
Suite de tests KING2MO (H-5).

Exécution :
    cd backend
    pip install pytest httpx
    pytest -q

Les tests qui exigent la pile lourde (LangChain, ChromaDB, webview) sont
automatiquement ignorés si ces dépendances ne sont pas installées, afin que
la suite reste exécutable en environnement minimal.
"""
import base64
import importlib
import os
import sys

import pytest

# Le backend doit être importable comme package "à plat".
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ---------------------------------------------------------------------------
# resolve_model : le cœur du bug H-1 (le modèle des Paramètres était ignoré).
# ---------------------------------------------------------------------------
@pytest.fixture
def crag_engine():
    return pytest.importorskip("crag_engine")


def test_resolve_model_default(crag_engine, monkeypatch):
    monkeypatch.delenv("LLM_MODEL", raising=False)
    assert crag_engine.resolve_model() == crag_engine.DEFAULT_MODEL
    assert crag_engine.DEFAULT_MODEL == "gemini-2.5-flash"


def test_resolve_model_env_override(crag_engine, monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "gemini-2.5-pro")
    assert crag_engine.resolve_model() == "gemini-2.5-pro"


def test_resolve_model_explicit_wins(crag_engine, monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "gemini-2.5-pro")
    # Un argument explicite prime sur l'env.
    assert crag_engine.resolve_model("mistral-small") == "mistral-small"


def test_default_embed_model_is_multilingual():
    import vectorstore
    assert "multilingual" in vectorstore.DEFAULT_EMBED_MODEL.lower()


# ---------------------------------------------------------------------------
# main.py : validation d'image (M-6) et rate-limit (C-2).
# Importer main a des effets de bord (webview, thread de warmup, écriture .env),
# donc on skip proprement si la pile n'est pas là.
# ---------------------------------------------------------------------------
@pytest.fixture
def main():
    pytest.importorskip("fastapi")
    pytest.importorskip("webview")
    return importlib.import_module("main")

@pytest.fixture
def security():
    return importlib.import_module("security")


_PNG_1x1 = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000a49444154789c6300010000050001"
    )
).decode()


def test_validate_image_accepts_png(security):
    # Ne doit pas lever.
    security._validate_image_base64(_PNG_1x1)
    security._validate_image_base64(f"data:image/png;base64,{_PNG_1x1}")


def test_validate_image_rejects_text(security):
    from fastapi import HTTPException
    junk = base64.b64encode(b"this is definitely not an image at all").decode()
    with pytest.raises(HTTPException) as exc:
        security._validate_image_base64(junk)
    assert exc.value.status_code == 400


def test_validate_image_rejects_bad_base64(security):
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        security._validate_image_base64("!!!!not-base64!!!!")


def test_rate_limit_trips(security, monkeypatch):
    from fastapi import HTTPException
    # On force une limite basse et on vide l'historique.
    monkeypatch.setattr(security, "_MAX_CHATS_PER_MINUTE", 2)
    security._chat_timestamps.clear()
    security._check_rate_limit()
    security._check_rate_limit()
    with pytest.raises(HTTPException) as exc:
        security._check_rate_limit()
    assert exc.value.status_code == 429


def test_spend_cap_disabled_by_default(security, monkeypatch):
    monkeypatch.setattr(security, "_DAILY_SPEND_CAP_USD", 0.0)
    # Aucun plafond => ne lève jamais.
    security._check_spend_cap()


# ---------------------------------------------------------------------------
# Endpoints via TestClient : ping public + auth exigée ailleurs.
# ---------------------------------------------------------------------------
@pytest.fixture
def client(main):
    from fastapi.testclient import TestClient
    return TestClient(main.app, base_url="http://localhost")


def test_ping_is_public(client):
    r = client.get("/api/ping")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_settings_requires_token(client):
    # Sans en-tête X-API-Token -> 401.
    r = client.get("/api/settings")
    assert r.status_code == 401


def test_settings_with_token_ok(client):
    token = os.environ.get("BACKEND_API_TOKEN", "")
    if not token:
        pytest.skip("Aucun BACKEND_API_TOKEN configuré dans l'environnement de test.")
    r = client.get("/api/settings", headers={"X-API-Token": token})
    assert r.status_code == 200
    assert "llm_provider" in r.json()


def test_conversation_bad_id_rejected(client):
    token = os.environ.get("BACKEND_API_TOKEN", "")
    if not token:
        pytest.skip("Aucun BACKEND_API_TOKEN configuré.")
    r = client.get("/api/conversations/not-a-valid-id", headers={"X-API-Token": token})
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Recherche Web et Injection Token
# ---------------------------------------------------------------------------
def test_search_web_api_no_key(crag_engine):
    results = crag_engine.search_web_api("test query", "")
    assert len(results) == 1
    assert "simulée" in results[0]["title"].lower()


def test_window_api_token(main):
    api = main.WindowApi("secret_test_token")
    assert api.get_token() == "secret_test_token"


# ---------------------------------------------------------------------------
# Tarifs configurables, champ scope (R-13) et flux chat SSE (moqué).
# ---------------------------------------------------------------------------
def test_pricing_endpoint(client):
    token = os.environ.get("BACKEND_API_TOKEN", "")
    if not token:
        pytest.skip("Aucun BACKEND_API_TOKEN configuré.")
    r = client.get("/api/pricing", headers={"X-API-Token": token})
    assert r.status_code == 200
    data = r.json()
    assert "pricing" in data
    assert "gemini" in data["pricing"]
    assert "in" in data["pricing"]["gemini"] and "out" in data["pricing"]["gemini"]


def test_chat_request_accepts_scope(main):
    # (R-13) Le modèle Pydantic accepte un scope de 32 hex.
    req = main.ChatRequest(query="bonjour", scope="a" * 32)
    assert req.scope == "a" * 32
    # Sans scope, le champ est None (comportement historique).
    assert main.ChatRequest(query="bonjour").scope is None


def test_chat_sse_mocked(client, main, monkeypatch):
    """Vérifie le flux SSE de /api/chat sans appeler de vrai LLM : on remplace
    le graphe CRAG par un faux qui émet une génération simulée."""
    pytest.importorskip("langchain_core")
    import crag_engine

    class _FakeGraph:
        def stream(self, state):
            yield {"generate": {"generation": "Réponse simulée", "documents": []}}

    monkeypatch.setattr(crag_engine, "build_crag_graph", lambda *a, **k: _FakeGraph())

    token = os.environ.get("BACKEND_API_TOKEN", "")
    if not token:
        pytest.skip("Aucun BACKEND_API_TOKEN configuré.")

    r = client.post(
        "/api/chat",
        headers={"X-API-Token": token, "Content-Type": "application/json"},
        json={"query": "bonjour", "mode": "local"},
    )
    assert r.status_code == 200
    assert r"R\u00e9ponse simul\u00e9e" in r.text
    assert "result" in r.text

def test_settings_clear_llm_model(client, monkeypatch, tmp_path):
    import routers.settings
    fake_env = tmp_path / ".env"
    fake_env.write_text('LLM_MODEL="ornith"\nGEMINI_API_KEY="123"\n', encoding="utf-8")
    monkeypatch.setattr(routers.settings, "_env_file_path", lambda: str(fake_env))
    monkeypatch.setenv("LLM_MODEL", "ornith")
    monkeypatch.setenv("GEMINI_API_KEY", "123")
    
    token = os.environ.get("BACKEND_API_TOKEN", "")
    r = client.post("/api/settings", headers={"X-API-Token": token}, json={"llm_model": ""})
    assert r.status_code == 200
    assert "LLM_MODEL" not in os.environ
    content = fake_env.read_text(encoding="utf-8")
    assert "LLM_MODEL" not in content
    assert "GEMINI_API_KEY" in content

def test_settings_clear_llm_key(client, monkeypatch, tmp_path):
    import routers.settings
    fake_env = tmp_path / ".env"
    fake_env.write_text('GEMINI_API_KEY="123"\n', encoding="utf-8")
    monkeypatch.setattr(routers.settings, "_env_file_path", lambda: str(fake_env))
    monkeypatch.setenv("GEMINI_API_KEY", "123")
    
    token = os.environ.get("BACKEND_API_TOKEN", "")
    r = client.post("/api/settings", headers={"X-API-Token": token}, json={"clear_llm_key": True})
    assert r.status_code == 200
    assert "GEMINI_API_KEY" not in os.environ
    content = fake_env.read_text(encoding="utf-8")
    assert "GEMINI_API_KEY" not in content

def test_settings_clear_llm_key_priority(client, monkeypatch, tmp_path):
    import routers.settings
    fake_env = tmp_path / ".env"
    fake_env.write_text('GEMINI_API_KEY="123"\n', encoding="utf-8")
    monkeypatch.setattr(routers.settings, "_env_file_path", lambda: str(fake_env))
    monkeypatch.setenv("GEMINI_API_KEY", "123")
    
    token = os.environ.get("BACKEND_API_TOKEN", "")
    r = client.post("/api/settings", headers={"X-API-Token": token}, json={"clear_llm_key": True, "gemini_api_key": "nouvelle"})
    assert r.status_code == 200
    assert os.environ.get("GEMINI_API_KEY") == "nouvelle"
    content = fake_env.read_text(encoding="utf-8")
    assert 'GEMINI_API_KEY="nouvelle"' in content
