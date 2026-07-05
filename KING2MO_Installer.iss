; ============================================================
;  Installeur KING2MO — script Inno Setup
;  Prérequis : 1) avoir compilé l'appli (rebuild_standalone.bat)
;              2) Inno Setup 6 installé (https://jrsoftware.org/isinfo.php)
;  Compilation : clic droit sur ce fichier > Compile, ou ouvrir
;  dans Inno Setup et F9. Résultat : installer\KING2MO_Setup.exe
;
;  Choix important : installation PAR UTILISATEUR dans {localappdata}
;  car l'application écrit à côté de son exe (.env, chroma_db,
;  conversations, logs). Pas de droits administrateur requis.
; ============================================================

[Setup]
AppName=KING2MO
AppVersion=1.0
AppPublisher=KING2MO
DefaultDirName={localappdata}\KING2MO
DefaultGroupName=KING2MO
PrivilegesRequired=lowest
OutputDir=installer
OutputBaseFilename=KING2MO_Setup
SetupIconFile=app.ico
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\KING2MO_Standalone.exe

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Files]
Source: "dist\KING2MO_Standalone\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\_internal"; Attribs: hidden
Name: "{app}\frontend_out"; Attribs: hidden
Name: "{app}\chroma_db"; Attribs: hidden

[Icons]
Name: "{group}\KING2MO"; Filename: "{app}\KING2MO_Standalone.exe"
Name: "{autodesktop}\KING2MO"; Filename: "{app}\KING2MO_Standalone.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Créer une icône sur le Bureau"; GroupDescription: "Icônes supplémentaires :"

[Run]
Filename: "{app}\KING2MO_Standalone.exe"; Description: "Lancer KING2MO"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
; Fichiers générés à l'exécution (token, base, conversations, logs)
Type: files; Name: "{app}\.env"
Type: files; Name: "{app}\king2mo.port"
Type: files; Name: "{app}\king2mo_error.log"
Type: filesandordirs; Name: "{app}\chroma_db"
Type: filesandordirs; Name: "{app}\conversations"
