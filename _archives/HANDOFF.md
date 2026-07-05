# Handoff Document - KING2MO (Agentic CRAG App)

Ce document résume tout le contexte, l'architecture, les règles et les travaux réalisés jusqu'à présent. Il est destiné à la prochaine IA qui reprendra le développement pour qu'elle dispose de l'intégralité du contexte.

## 1. Contexte du Projet
**KING2MO** est une application RAG (Retrieval-Augmented Generation) agentique.
- **Frontend** : Next.js (React), encapsulé pour ressembler à une application bureau (sans bordure native de navigateur, mais la bordure native de l'OS est maintenue pour le redimensionnement `frameless=False`).
- **Backend** : FastAPI (Python), gérant l'API LLM, l'upload de documents, l'historique et la base vectorielle.
- **Base Vectorielle** : ChromaDB.
- **Fenêtrage** : `webview` Python pour lancer l'interface Next.js dans une fenêtre desktop.

## 2. Travaux accomplis (Réglage de la dette technique)
Nous venons de finaliser une grande opération de refactoring frontend divisée en 4 "Vagues" pour nettoyer le fichier `page.tsx` qui était devenu un monolithe de plus de 1000 lignes.

### Vagues 1 à 3 : 
- Création de `lib/i18n.ts` pour la gestion des langues.
- Création du hook `hooks/useChat.ts` pour extraire la logique d'envoi et de réception SSE (Server-Sent Events) des messages.
- Extraction des composants modulaires : `Dashboard.tsx`, `ChatMessage.tsx`, `SourceModal.tsx`, `NeuralNetwork.tsx`, `SettingsModal.tsx`.
- Côté Backend : Isolement de la logique ChromaDB dans `backend/vectorstore.py` (Singleton) pour corriger des bugs d'initialisation multiple.

### Vague 4 :
- Extraction complète du layout principal : `Sidebar.tsx`, `SearchBar.tsx`, `TopBar.tsx`.
- `page.tsx` agit désormais uniquement comme un orchestrateur propre.
- Création de `lib/api.ts` pour centraliser les requêtes `fetch` (cependant, ce fichier **n'est pas encore câblé** dans l'application pour garantir une stabilité à 100% de la Vague 4).

## 3. Protocole de Validation (Crucial)
L'utilisateur est extrêmement rigoureux sur la stabilité. **Toute modification doit être testée.**
- Un script `validate.bat` est présent à la racine du projet (`C:\Users\diaba\.gemini\antigravity\scratch\agentic_crag_app`).
- Ce script lance :
  1. `npm run build` dans le répertoire `frontend` (vérification stricte de TypeScript et Next.js).
  2. `pytest` dans le répertoire `backend` (18 tests pour valider les endpoints et ChromaDB).
- Si `validate.bat` échoue, la tâche est considérée comme ratée. Il faut le lancer après chaque vague.
- Le test manuel de l'UI se fait en lançant : `cd backend && python main.py`. Ne jamais modifier `frameless=False` lors du test fenêtré.

## 4. Protocole d'Inspection et Rapports
Après chaque "Vague" de travail, l'agent doit :
1. Générer un rapport markdown détaillant exactement ce qui a été modifié.
2. Sauvegarder ce rapport impérativement dans le dossier `C:\Users\diaba\Downloads\reglage dette technique`.
3. Attendre. Une IA inspectrice indépendante (Claude) lira ce rapport et fera une revue statique du code. L'utilisateur fournira le rapport de Claude en retour, qui dictera si on peut passer à la vague suivante.

## 5. Prochaines Étapes (À faire par la prochaine IA)
Les recommandations du dernier rapport de Claude (et de l'utilisateur) pointent vers le backend :
- **Vague 5 (Refonte Backend)** : Le fichier `backend/main.py` fait plus de 1150 lignes. Il mélange l'initialisation de FastAPI, les routes de l'API, les websockets, le fenêtrage `webview` et la logique métier. L'objectif sera de le moduler de la même manière que le frontend (routes séparées, config isolée, etc.).
- **Câblage de `api.ts`** : Brancher prudemment les requêtes réseau du frontend sur `frontend/lib/api.ts` (sans casser les Uploads FormData ni le flux SSE de `useChat`).

## 6. Règles de l'Utilisateur
- Ne JAMAIS utiliser Tailwind CSS. Le frontend utilise du Vanilla CSS et des variables CSS globales injectées.
- Être direct, ne pas écrire de code non demandé, ne jamais casser le fonctionnement existant.
- Travailler de manière atomique (une "vague" bien définie, puis validation, puis rapport).

## Chemins Importants
- **Racine du projet** : `C:\Users\diaba\.gemini\antigravity\scratch\agentic_crag_app`
- **Dossier des rapports d'inspection** : `C:\Users\diaba\Downloads\reglage dette technique`

---
*Ce document sert de point de restauration. Lisez-le attentivement avant de commencer toute nouvelle modification sur le projet.*
