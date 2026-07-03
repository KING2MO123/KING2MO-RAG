import os
import time
import html

import streamlit as st

from crag_engine import build_crag_graph, initial_state, get_retriever

from PIL import Image
icon_path = r"C:\Users\diaba\.gemini\antigravity\brain\c2241a59-6b4b-43fd-8c0d-1f07564f5cf5\media__1783103454458_icon.png"
try:
    page_icon = Image.open(icon_path)
except Exception:
    page_icon = "🌙"

st.set_page_config(
    page_title="KING2MO RAG",
    page_icon=page_icon,
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# "Aurora Glassmorphism" - Sidebar Edition
# ---------------------------------------------------------------------------
st.html("""
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Outfit:wght@300;400;500;700;800;900&family=Inter:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
/* ---- Variables ---- */
:root {
    --bg-dark: #050505;
    --akatsuki-red: #991b1b;
    --blood-red: #dc2626;
    --crimson-glow: rgba(220, 38, 38, 0.2);
    --glass-bg: rgba(15, 15, 15, 0.6);
    --glass-border: rgba(255, 255, 255, 0.05);
}

*, *::before, *::after { box-sizing: border-box; }

/* ---- Base Theme ---- */
html, body, [class*="css"] { 
    font-family: 'Inter', sans-serif !important; 
    color: #e5e5e5 !important;
}

.stApp {
    background-color: var(--bg-dark) !important;
    background-image: 
        radial-gradient(circle at 15% 0%, rgba(153, 27, 27, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 100%, rgba(153, 27, 27, 0.05) 0%, transparent 40%) !important;
    overflow-x: hidden;
}

/* Hide default Streamlit Top Header */
[data-testid="stHeader"] { background: transparent !important; }
#MainMenu, footer { display: none !important; }

/* ---- Sleek Sidebar ---- */
section[data-testid="stSidebar"] {
    background: #0a0a0a !important;
    border-right: 1px solid var(--glass-border) !important;
}
section[data-testid="stSidebar"] * { color: #d4d4d4; }

.sb-brand {
    font-family: 'Outfit', sans-serif;
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: 0.15em;
    color: #ffffff;
    padding: 1rem 0 2rem 0;
    display: flex;
    align-items: center;
    gap: 0.8rem;
}
.sb-brand::before {
    content: '🌙';
    font-size: 1.2rem;
    color: #a3a3a3;
}

.sb-section-title {
    font-family: 'Outfit', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    color: #737373;
    margin-top: 1.5rem;
    margin-bottom: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.sb-section-title::before {
    content: ''; width: 4px; height: 4px; border-radius: 0;
    background: var(--akatsuki-red);
}

/* Sidebar Inputs Override */
section[data-testid="stSidebar"] div[data-testid="stTextInput"] {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    animation: none !important;
}
section[data-testid="stSidebar"] .stTextInput>div>div>input {
    background: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 6px !important;
    font-size: 0.85rem !important;
    padding: 0.6rem 0.8rem !important;
    color: #fff !important;
}
section[data-testid="stSidebar"] .stTextInput>div>div>input:focus {
    border-color: var(--akatsuki-red) !important;
    box-shadow: inset 0 0 5px rgba(220, 38, 38, 0.1) !important;
}

/* Sidebar Buttons */
section[data-testid="stSidebar"] .stButton>button {
    background: transparent !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: #a3a3a3 !important;
    border-radius: 6px !important;
    padding: 0.5rem 1rem !important;
    font-family: 'Outfit', sans-serif !important;
    font-size: 0.85rem !important;
    font-weight: 500 !important;
    width: 100% !important;
    transition: all 0.2s ease !important;
}
section[data-testid="stSidebar"] .stButton>button:hover {
    color: #fff !important;
    border-color: var(--akatsuki-red) !important;
    background: rgba(220, 38, 38, 0.05) !important;
}
section[data-testid="stSidebar"] hr {
    border-color: rgba(255, 255, 255, 0.05) !important;
    margin: 1.5rem 0 !important;
}

/* ---- Hero Section ---- */
.hero-wrapper {
    text-align: center;
    margin-top: 6vh;
    margin-bottom: 2.5rem;
}
.hero-title {
    font-family: 'Playfair Display', 'Cormorant Garamond', serif;
    font-size: 5.5rem;
    font-weight: 700;
    line-height: 1.1;
    margin: 0;
    color: #ffffff;
    letter-spacing: -0.01em;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
.hero-title span {
    color: var(--blood-red);
}
.hero-subtitle {
    font-family: 'Inter', sans-serif;
    color: #a3a3a3;
    font-size: 1rem;
    font-weight: 500;
    margin-top: 1.5rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    text-align: center;
}

/* ---- Sharp Main Search Bar ---- */
.search-container { position: relative; max-width: 700px; margin: 0 auto; }

div[data-testid="stMainBlockContainer"] div[data-testid="stTextInput"] {
    margin: 0 auto;
    max-width: 800px;
}
div[data-testid="stMainBlockContainer"] .stTextInput>div>div>input {
    background: rgba(10, 10, 10, 0.8) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: #ffffff !important;
    border-radius: 8px !important;
    font-family: 'Outfit', sans-serif !important;
    font-size: 1.2rem !important;
    font-weight: 400 !important;
    padding: 1.2rem 1.5rem !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
    border-left: 3px solid var(--akatsuki-red) !important;
}
div[data-testid="stMainBlockContainer"] .stTextInput>div>div>input:focus {
    border-color: var(--blood-red) !important;
    background: #000000 !important;
    box-shadow: 0 10px 40px rgba(220, 38, 38, 0.15) !important;
}
div[data-testid="stMainBlockContainer"] .stTextInput>div>div>input::placeholder { 
    color: #525252 !important; 
}

/* ---- Sharp Main Button ---- */
.run-btn-container { text-align: center; margin-top: 2rem; margin-bottom: 2rem; }
div[data-testid="stMainBlockContainer"] .stButton>button {
    background: #0a0a0a !important;
    color: #ffffff !important;
    border: 1px solid var(--akatsuki-red) !important;
    border-radius: 8px !important;
    padding: 0.8rem 3rem !important;
    font-family: 'Outfit', sans-serif !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.15em !important;
    text-transform: uppercase !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4) !important;
}
div[data-testid="stMainBlockContainer"] .stButton>button:hover { 
    background: var(--akatsuki-red) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(220, 38, 38, 0.3) !important;
}

/* ---- Status Loader ---- */
.status-pill {
    display: inline-flex; align-items: center; gap: 0.6rem;
    background: rgba(220, 38, 38, 0.05);
    border: 1px solid rgba(220, 38, 38, 0.2);
    color: var(--blood-red);
    padding: 0.5rem 1.2rem;
    border-radius: 6px;
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 auto;
    letter-spacing: 0.1em;
    animation: holo-pulse 1.5s infinite alternate;
}
@keyframes holo-pulse {
    0% { box-shadow: 0 0 5px rgba(220, 38, 38, 0.1); }
    100% { box-shadow: 0 0 15px rgba(220, 38, 38, 0.2); }
}

/* ---- Results Card ---- */
.result-card {
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-top: 2px solid var(--akatsuki-red);
    border-radius: 12px;
    padding: 3rem;
    margin-top: 2rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.result-body {
    font-family: 'Inter', sans-serif;
    font-size: 1.05rem;
    line-height: 1.8;
    color: #d4d4d4;
}
.result-body strong { color: #fff; font-weight: 600; }

/* ---- Sources ---- */
.sources-container {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid rgba(255,255,255,0.05);
}
.sources-title {
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #737373;
    margin-bottom: 1.5rem;
}
.source-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;
}
.source-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1.2rem;
    transition: all 0.2s ease;
}
.source-item:hover {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
}
.source-tag {
    display: inline-block;
    color: var(--blood-red);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 0.65rem;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
}
.source-name { color: #e5e5e5; font-weight: 600; font-family: 'Outfit', sans-serif; font-size: 0.9rem; display: block; margin-bottom: 0.4rem; }
.source-snip { color: #737373; font-size: 0.8rem; line-height: 1.5; }

/* ---- Floating Metrics Widgets ---- */
.metrics-row {
    display: flex; gap: 1rem; margin-top: 2rem; flex-wrap: wrap;
}
.metric-widget {
    flex: 1; min-width: 120px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1.2rem;
    text-align: center;
}
.metric-val {
    font-family: 'Outfit', sans-serif;
    font-size: 1.8rem;
    font-weight: 800;
    color: #fff;
}
.metric-lbl {
    font-family: 'Inter', sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #737373;
    margin-top: 0.3rem;
}
</style>
""")

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
def index_uploaded_file(uploaded_file):
    from langchain_community.vectorstores import Chroma
    from langchain_community.embeddings import HuggingFaceEmbeddings
    from langchain_core.documents import Document

    filename = uploaded_file.name.lower()
    if filename.endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(uploaded_file)
        content = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                content += text + "\n"
    else:
        content = uploaded_file.read().decode("utf-8")
    
    if not content or len(content.strip()) < 50:
        raise ValueError("Document vide ou illisible.")

    documents = [
        Document(page_content=content, metadata={"source": uploaded_file.name, "chunk_index": 0})
    ]
    
    CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embeddings)
    vectorstore.add_documents(documents)
    return len(documents), content

def save_keys_to_secrets(gemini_key, tavily_key):
    secrets_dir = os.path.join(os.path.dirname(__file__), ".streamlit")
    os.makedirs(secrets_dir, exist_ok=True)
    with open(os.path.join(secrets_dir, "secrets.toml"), "w", encoding="utf-8") as f:
        f.write(f'GEMINI_API_KEY = "{gemini_key}"\n')
        f.write(f'TAVILY_API_KEY = "{tavily_key}"\n')

# ---------------------------------------------------------------------------
# Sidebar (Preferences & Connaissances)
# ---------------------------------------------------------------------------
default_gemini, default_tavily = "", ""
try:
    default_gemini = st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
    default_tavily = st.secrets.get("TAVILY_API_KEY", os.environ.get("TAVILY_API_KEY", ""))
except Exception:
    default_gemini = os.environ.get("GEMINI_API_KEY", "")
    default_tavily = os.environ.get("TAVILY_API_KEY", "")

with st.sidebar:
    st.markdown('<div class="sb-brand">KING2MO</div>', unsafe_allow_html=True)
    
    st.markdown('<div class="sb-section-title">Authentification API</div>', unsafe_allow_html=True)
    gem_input = st.text_input("Gemini API Key", type="password", value=default_gemini, placeholder="Clé Gemini...")
    tav_input = st.text_input("Tavily API Key", type="password", value=default_tavily, placeholder="Clé Tavily...")
    
    if st.button("Sauvegarder les clés", key="btn_save"):
        save_keys_to_secrets(gem_input, tav_input)
        st.toast("Accès sécurisés enregistrés.", icon="🔐")
        time.sleep(0.5)
        st.rerun()

    st.markdown('<hr>', unsafe_allow_html=True)

    st.markdown('<div class="sb-section-title">Base de connaissances</div>', unsafe_allow_html=True)
    uploaded_file = st.file_uploader("Fichier (.pdf, .txt, .md)", type=["txt", "md", "pdf"], label_visibility="collapsed")
    
    if st.button("Indexer le fichier", key="btn_index"):
        if uploaded_file:
            with st.spinner("Indexation neuronale en cours..."):
                try:
                    n, content = index_uploaded_file(uploaded_file)
                    get_retriever.cache_clear()
                    st.success("Document intégré.")
                except Exception as e:
                    st.error(str(e))
        else:
            st.warning("Veuillez sélectionner un fichier.")
            
    if st.button("Vider la mémoire vectorielle", key="btn_clear"):
        try:
            from langchain_community.vectorstores import Chroma
            from crag_engine import _get_embeddings
            get_retriever.cache_clear()
            CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
            vs = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=_get_embeddings())
            data = vs.get()
            ids = data.get("ids", [])
            if ids:
                vs.delete(ids=ids)
            st.success("Base nettoyée.")
        except Exception as e:
            st.error(str(e))

# ---------------------------------------------------------------------------
# Main UI Layout
# ---------------------------------------------------------------------------
st.markdown("""
<div class="hero-wrapper">
    <h1 class="hero-title">KING2MO <span>RAG</span></h1>
    <p class="hero-subtitle">Par KING2MO. Pour KING2MO.</p>
</div>
""", unsafe_allow_html=True)

# The new beautiful search bar (gradient wrapper is handled via CSS)
query = st.text_input("q", value="", placeholder="Recherche...", label_visibility="collapsed")

st.markdown('<div class="run-btn-container">', unsafe_allow_html=True)
col_btn1, col_btn2, col_btn3 = st.columns([1, 2, 1])
with col_btn2:
    run = st.button("LANCER L'ANALYSE", use_container_width=True)
st.markdown('</div>', unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------
if run:
    if not default_gemini:
        st.error("⚠️ Veuillez configurer votre clé API Gemini dans la barre latérale.")
    elif not query:
        pass # Empty query
    else:
        graph = build_crag_graph(default_gemini, default_tavily)
        state = initial_state(query)

        status_ph = st.empty()
        result_ph = st.empty()
        
        start = time.time()
        result = dict(state)

        # SVG Spinner for the status pill
        spinner_svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>'

        try:
            for update in graph.stream(state):
                for node, out in update.items():
                    result.update(out)
                    status_ph.markdown(f'<div style="text-align:center; margin-top:2rem;"><div class="status-pill">{spinner_svg} TRAITEMENT : {node.upper()}</div></div>', unsafe_allow_html=True)
            
            elapsed = time.time() - start
            status_ph.empty() # Clear status
            
            docs = result.get("documents", [])
            has_web = any(d.metadata.get("source") == "tavily_search" for d in docs)
            corrections = result.get("corrections", 0)
            
            # Format sources as a beautiful grid
            sources_html = ""
            if docs:
                sources_html += '<div class="sources-container"><div class="sources-title">Sources Explorées</div><div class="source-grid">'
                for d in docs:
                    src = d.metadata.get("source", "inconnue")
                    tag = "WEB" if src == "tavily_search" else "DOCUMENT"
                    snippet = html.escape(d.page_content[:100].replace("\n", " ")) + "..."
                    sources_html += f'<div class="source-item"><span class="source-tag">{tag}</span><span class="source-name">{src}</span><span class="source-snip">{snippet}</span></div>'
                sources_html += '</div></div>'
            
            meta_html = (
                f'<div class="metrics-row">'
                f'<div class="metric-widget"><div class="metric-val">{elapsed:.1f}s</div><div class="metric-lbl">Vitesse d\'analyse</div></div>'
                f'<div class="metric-widget"><div class="metric-val">{corrections}</div><div class="metric-lbl">Auto-Corrections</div></div>'
                f'<div class="metric-widget"><div class="metric-val">{"OUI" if has_web else "NON"}</div><div class="metric-lbl">Appui Web</div></div>'
                f'</div>'
            )

            result_ph.markdown(f"""
            <div class="result-card">
                <div class="result-body">{result.get("generation", "")}</div>
                {meta_html}
                {sources_html}
            </div>
            """, unsafe_allow_html=True)

        except Exception as e:
            status_ph.empty()
            st.error(f"Une erreur est survenue : {e}")
