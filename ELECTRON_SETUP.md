# MGI × AFRIKA - Electron Desktop App Setup

Diese Anleitung erklärt, wie du die Web-App als Desktop-Anwendung (EXE) bauen kannst.

## Voraussetzungen

- Node.js 18+ installiert
- Git installiert
- GitHub-Konto verbunden

## Schritt 1: Projekt von GitHub klonen

```bash
git clone https://github.com/DEIN-USERNAME/DEIN-REPO.git
cd DEIN-REPO
npm install
```

## Schritt 2: Electron Dependencies installieren

```bash
npm install --save-dev electron electron-builder electron-squirrel-startup
```

## Schritt 3: Package.json anpassen

Füge folgende Einträge zu deiner `package.json` hinzu:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "NODE_ENV=development electron .",
    "electron:build": "npm run build && electron-builder --config electron-builder.json",
    "electron:build:win": "npm run build && electron-builder --win --config electron-builder.json",
    "electron:build:mac": "npm run build && electron-builder --mac --config electron-builder.json",
    "electron:build:linux": "npm run build && electron-builder --linux --config electron-builder.json"
  }
}
```

## Schritt 4: Umgebungsvariablen

Erstelle eine `.env` Datei im Projektroot (falls nicht vorhanden):

```env
VITE_SUPABASE_URL=https://ctkozjqdvhtvabxhxlth.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=dein-anon-key
```

## Schritt 5: App bauen

### Windows EXE erstellen:
```bash
npm run electron:build:win
```

### macOS App erstellen:
```bash
npm run electron:build:mac
```

### Linux App erstellen:
```bash
npm run electron:build:linux
```

## Schritt 6: Fertige App finden

Nach dem Build findest du die installierbaren Dateien in:
- `electron-dist/` Ordner

Für Windows:
- `MGI AFRIKA-1.0.0-x64.exe` (Installer)
- `MGI AFRIKA-1.0.0-x64-portable.exe` (Portable Version)

## Entwicklungsmodus

Zum Testen während der Entwicklung:

```bash
# Terminal 1: Vite Dev Server starten
npm run dev

# Terminal 2: Electron starten
npm run electron:dev
```

## Fehlerbehebung

### "electron-squirrel-startup" Fehler
```bash
npm install electron-squirrel-startup
```

### Build schlägt fehl
Stelle sicher, dass du zuerst `npm run build` ausführst, bevor du Electron baust.

### Icons werden nicht angezeigt
Für Windows benötigst du eine `.ico` Datei. Konvertiere das SVG:
```bash
# Mit ImageMagick
convert public/mgi-favicon.svg -resize 256x256 public/icon.ico
```

## Support

Bei Fragen oder Problemen erstelle ein Issue im GitHub Repository.
