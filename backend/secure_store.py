"""
Chiffrement optionnel de secrets au repos via l'API DPAPI de Windows
(CryptProtectData / CryptUnprotectData) — sans dépendance externe (ctypes).

But : réduire l'exposition résiduelle du token / des clés API stockés en clair
dans le .env, contre un autre processus tournant sous le même utilisateur.
DPAPI lie le chiffrement au compte utilisateur Windows courant : seul ce compte
peut déchiffrer, et sur la même machine.

⚠ UTILITAIRE OPT-IN, VOLONTAIREMENT NON CÂBLÉ dans le chemin critique.
Le flux normal (.env en clair) reste inchangé et fonctionnel. Ce module fournit
les briques ; leur intégration doit être faite puis TESTÉE explicitement, car
un chiffrement mal géré rendrait la configuration illisible.

Exemple d'usage :
    from secure_store import protect, unprotect, is_available
    if is_available():
        blob = protect("ma_cle_secrete")      # bytes chiffrés (à stocker)
        clair = unprotect(blob)               # "ma_cle_secrete"

Repli hors Windows : is_available() renvoie False et protect/unprotect lèvent
NotImplementedError — l'appelant doit alors conserver le stockage en clair.
"""
from __future__ import annotations

import sys
import ctypes
from ctypes import wintypes


def is_available() -> bool:
    """DPAPI n'existe que sous Windows."""
    return sys.platform == "win32"


if is_available():
    class _DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    _crypt32 = ctypes.windll.crypt32
    _kernel32 = ctypes.windll.kernel32

    def _to_blob(data: bytes) -> _DATA_BLOB:
        buf = ctypes.create_string_buffer(data, len(data))
        return _DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

    def _from_blob(blob: _DATA_BLOB) -> bytes:
        size = int(blob.cbData)
        out = ctypes.string_at(blob.pbData, size)
        _kernel32.LocalFree(blob.pbData)
        return out

    def protect(secret: str) -> bytes:
        """Chiffre une chaîne pour l'utilisateur Windows courant."""
        blob_in = _to_blob(secret.encode("utf-8"))
        blob_out = _DATA_BLOB()
        # CRYPTPROTECT_UI_FORBIDDEN = 0x1 (jamais d'invite interactive)
        if not _crypt32.CryptProtectData(ctypes.byref(blob_in), None, None, None, None, 0x1, ctypes.byref(blob_out)):
            raise OSError("CryptProtectData a échoué.")
        return _from_blob(blob_out)

    def unprotect(blob: bytes) -> str:
        """Déchiffre des données produites par protect() sur cette machine/ce compte."""
        blob_in = _to_blob(blob)
        blob_out = _DATA_BLOB()
        if not _crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None, 0x1, ctypes.byref(blob_out)):
            raise OSError("CryptUnprotectData a échoué (mauvais utilisateur/machine ?).")
        return _from_blob(blob_out).decode("utf-8")

else:
    def protect(secret: str) -> bytes:  # pragma: no cover - non-Windows
        raise NotImplementedError("DPAPI indisponible hors Windows.")

    def unprotect(blob: bytes) -> str:  # pragma: no cover - non-Windows
        raise NotImplementedError("DPAPI indisponible hors Windows.")


if __name__ == "__main__":
    # Petit test manuel : python secure_store.py "mon secret"
    import sys as _sys
    if not is_available():
        print("DPAPI indisponible (hors Windows).")
        _sys.exit(0)
    sample = _sys.argv[1] if len(_sys.argv) > 1 else "test-secret-123"
    enc = protect(sample)
    dec = unprotect(enc)
    print(f"clair='{sample}'  ->  chiffré={len(enc)} octets  ->  déchiffré='{dec}'  OK={sample == dec}")
