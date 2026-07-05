# Spécifications — Vague 4 (finalisation du découpage frontend)

**Contexte :** après les vagues 1-3, `page.tsx` détient encore trois gros blocs d'UI inline (barre latérale, barre de recherche, contrôles haut-droite) et tous les appels réseau. Cette vague les extrait pour ne laisser qu'un orchestrateur.

**Contrat commun à TOUTES les tâches :**
- **ZÉRO changement de comportement.** On déplace du code, on ne le réécrit pas.
- Conserver les styles inline **tels quels** (le nettoyage CSS sera une autre étape).
- Réutiliser `@/lib/i18n` (`t`) déjà existant ; ne rien redupliquer.
- **Critère d'acceptation : `validate.bat` reste vert** (build Next.js sans erreur TypeScript **+** 18 tests pytest). Aucune modification hors des fichiers ciblés + le câblage dans `page.tsx`.
- Chaque tâche = une extraction = à vérifier avant de passer à la suivante.

**Ordre conseillé :** 4.1 → 4.2 → 4.3, puis 4.4 (optionnel). Faire une tâche à la fois (elles modifient toutes `page.tsx`).

---

## Tâche 4.1 — `components/Sidebar.tsx`

**But :** extraire tout le bloc `<div className="sidebar">…</div>` de `page.tsx`.

**Props (interface exacte) :**
```ts
interface SidebarProps {
  lang: string;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  // Conversations
  conversations: any[];
  currentConvId: string | null;
  editingConvId: string | null;
  editingTitle: string;
  setEditingTitle: (v: string) => void;
  setEditingConvId: (v: string | null) => void;
  onNewConversation: () => void;       // newConversation
  onLoadConversation: (id: string) => void;   // loadConversation
  onStartRenaming: (id: string, title: string) => void;  // startRenaming
  onCommitRename: () => void;          // commitRename
  onDeleteConversation: (id: string) => void; // deleteConversation
  onReset: () => void;                 // handleReset (clic sur le logo)
  onOpenSettings: () => void;          // openSettings
  // Historique récent
  history: string[];
  isEditingHistory: boolean;
  setIsEditingHistory: (v: boolean) => void;
  selectedHistory: string[];
  onToggleHistorySelection: (h: string) => void;  // toggleHistorySelection
  onSearch: (q: string) => void;       // handleSearch
  onDeleteSelectedHistory: () => void; // deleteSelectedHistory
  onClearAllHistory: () => void;       // clearAllHistory
  // Base de connaissances
  documents: string[];
  isEditingDocs: boolean;
  setIsEditingDocs: (v: boolean) => void;
  selectedDocs: string[];
  isClearing: boolean;
  onToggleDocSelection: (d: string) => void;  // toggleDocSelection
  onDeleteDocument: (name: string) => void;   // deleteDocument
  onDeleteSelectedDocs: () => void;    // deleteSelectedDocs
  onClearDocuments: () => void;        // clearDocuments
}
```

**Notes :** les textes déjà en `t(lang, …)` restent tels quels ; les deux libellés encore en dur (« HISTORIQUE RÉCENT », « GÉRER/TERMINER », « Supprimer », « Tout vider ») restent en dur pour ne rien changer. La logique de renommage inline (input `editingConvId`) doit être déplacée à l'identique.

---

## Tâche 4.2 — `components/SearchBar.tsx`

**But :** extraire le bloc `<div className="search-header-row">…</div>` (la rangée de saisie du bas / du centre).

**Props :**
```ts
interface SearchBarProps {
  lang: string;
  messagesLength: number;      // pilote position fixed/centrée + placeholder
  sidebarOpen: boolean;
  bgRGB: string;               // déjà calculé dans page.tsx
  query: string;
  setQuery: (v: string) => void;
  onSearch: (q: string) => void;   // handleSearch
  loading: boolean;
  onStop: () => void;          // handleStop
  uploading: boolean;
  uploadMessage: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;  // handleFileUpload
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; // handleImageUpload
  fileInputRef: React.RefObject<HTMLInputElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (v: boolean) => void;
}
```

**Notes :** conserver la logique d'auto-grandissement du textarea et le raccourci Entrée/Maj+Entrée à l'identique. Ne PAS déplacer la zone des modes (hybride/web/local) ni les cartes d'accueil — elles restent dans `page.tsx` (ou feront une tâche à part).

---

## Tâche 4.3 — `components/TopBar.tsx`

**But :** extraire le bloc `<div className="top-right-controls">…</div>` (export, pastille coût, langue, thème).

**Props :**
```ts
interface TopBarProps {
  lang: string;
  setLang: (v: string) => void;
  theme: string;
  toggleTheme: () => void;
  messagesLength: number;      // affiche le bouton Export si > 0
  onExport: () => void;        // exportChatToMarkdown
  onOpenDashboard: () => void; // setShowDashboard(true)
  totalCost: number;
  systemPassword: string;      // "Verrouillé" vs "Serveur IA"
}
```

---

## Tâche 4.4 — `lib/api.ts` (optionnel, à faire en dernier, avec soin)

**But :** centraliser les appels `fetch` dupliqués (chacun réinjecte l'en-tête `X-API-Token`). Créer des fonctions typées :

```ts
// Toutes prennent le token en 1er argument, renvoient la réponse JSON parsée.
export async function apiGet(path: string, token: string): Promise<any>
export async function apiSend(path: string, token: string, method: string, body?: any): Promise<Response>
// Puis des helpers : getDocuments, getConversations, saveConversation, renameConversation,
// deleteConversation, getSettings, saveSettings, getPricing, deleteDocument, clearDocuments…
```

**Contrainte forte :** remplacer les `fetch(...)` dans `page.tsx` (et le hook `useChat` si pertinent) **un par un**, en vérifiant `validate.bat` vert après chaque remplacement. Ne PAS toucher au flux SSE de `useChat` (il lit un stream, pas du JSON) — le laisser tel quel. Cette tâche est du confort : si le moindre doute, la sauter.

---

## Après la Vague 4

`page.tsx` ne devrait plus contenir que : les `useState` d'orchestration, les `useEffect` (montage, thème, auto-save conversation), les handlers qui ne sont pas déjà dans le hook, et la composition `<Sidebar/> <TopBar/> <SearchBar/> <ChatMessage/> …`. Objectif : **sous ~350 lignes**. Le découpage sera alors terminé.
