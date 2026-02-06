

## Native Mobile App mit Capacitor einrichten

Deine App wird fuer Apple App Store und Google Play Store vorbereitet. Capacitor wird neben deinem bestehenden Electron-Desktop-Setup eingerichtet.

### Was wird gemacht

1. **Capacitor installieren** - Die notwendigen Pakete werden dem Projekt hinzugefuegt:
   - `@capacitor/core`
   - `@capacitor/cli` (Dev-Dependency)
   - `@capacitor/ios`
   - `@capacitor/android`

2. **Capacitor konfigurieren** - Eine `capacitor.config.ts` Datei wird erstellt mit:
   - App-ID: `app.lovable.728f860911914046bb71e4a8f2b2313c`
   - App-Name: `secure-accord-hub`
   - Hot-Reload Server fuer die Entwicklung

3. **Viewport und Mobile-Meta-Tags** optimieren in `index.html` fuer bessere mobile Darstellung (z.B. `viewport-fit=cover` fuer iPhone-Notch-Support)

### Was du danach selbst machen musst

Da Capacitor native Toolchains benoetigt, muessen folgende Schritte lokal auf deinem Computer ausgefuehrt werden:

1. **Projekt exportieren**: Ueber "Export to GitHub" das Projekt auf dein GitHub-Konto uebertragen und lokal klonen
2. **Dependencies installieren**: `npm install`
3. **Plattformen hinzufuegen**:
   - iOS: `npx cap add ios` (benoetigt einen Mac mit Xcode)
   - Android: `npx cap add android` (benoetigt Android Studio)
4. **Projekt bauen**: `npm run build`
5. **Sync ausfuehren**: `npx cap sync`
6. **App starten**:
   - iOS: `npx cap run ios`
   - Android: `npx cap run android`

### App Store Veroeffentlichung

- **Apple App Store**: Du benoetigst ein Apple Developer Konto (99 USD/Jahr). In Xcode kannst du die App signieren und ueber "Archive" an App Store Connect senden.
- **Google Play Store**: Du benoetigst ein Google Play Developer Konto (einmalig 25 USD). In Android Studio kannst du ein signiertes APK/AAB erstellen und im Play Console hochladen.

Weitere Details findest du in diesem Guide:

https://docs.lovable.dev/tips-tricks/native-mobile-apps

### Technische Details

- Capacitor laeuft parallel zu Electron - beide koennen gleichzeitig existieren
- Die `capacitor.config.ts` wird im Projekt-Root erstellt
- Der Hot-Reload-Server zeigt auf deine Lovable-Preview-URL fuer die Entwicklung
- Fuer den Store-Build wird stattdessen der lokale Build (`dist/`) verwendet

