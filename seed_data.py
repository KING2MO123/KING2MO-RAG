import os
import shutil
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

# Clear existing vector database if it exists
if os.path.exists(CHROMA_DB_DIR):
    shutil.rmtree(CHROMA_DB_DIR)

# Sample high-quality domain documents about a fictional product "Hermes AI" or "Acme Corp"
sample_docs = [
    Document(
        page_content="La politique de retour de AcmeCorp permet aux clients de retourner tout produit acheté dans un délai de 30 jours pour un remboursement complet. Les frais de retour sont entièrement pris en charge par AcmeCorp si le retour est effectué via notre transporteur partenaire.",
        metadata={"source": "politique_retour.txt", "category": "sales"}
    ),
    Document(
        page_content="L'assistant IA 'Hermes' développé par AcmeCorp utilise un système de Mixture of Agents (MoA) pour distribuer les requêtes des utilisateurs à différents sous-agents spécialisés (ex: code, écriture, calcul). Cette architecture permet d'optimiser le coût de calcul et de maximiser la qualité des réponses.",
        metadata={"source": "hermes_moa.txt", "category": "engineering"}
    ),
    Document(
        page_content="Les abonnements AcmeCorp Cloud se déclinent en trois forfaits : Basic (Free, limité à 100 requêtes/jour), Pro (20$ / mois, avec accès aux modèles Gemini 3.5 Flash et Pro), et Enterprise (Tarification personnalisée pour un usage intensif avec SLA garanti).",
        metadata={"source": "tarifs_cloud.txt", "category": "pricing"}
    ),
    Document(
        page_content="Pour configurer la facturation sur la plateforme AcmeCorp, l'utilisateur doit ajouter une carte de crédit valide dans son tableau de bord de facturation. Les comptes passent automatiquement du niveau d'évaluation gratuite ('Free Tier') au niveau de paiement à l'usage dans un délai de 10 à 15 minutes après le premier dépôt de fonds (par exemple 20$).",
        metadata={"source": "facturation_aide.txt", "category": "billing"}
    )
]

def seed_database():
    print("Initialisation des embeddings HuggingFace...")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    print(f"Création de la base vectorielle locale Chroma dans {CHROMA_DB_DIR}...")
    vectorstore = Chroma.from_documents(
        documents=sample_docs,
        embedding=embeddings,
        persist_directory=CHROMA_DB_DIR
    )
    print("Base vectorielle locale initialisée avec succès avec les documents AcmeCorp !")

if __name__ == "__main__":
    seed_database()
