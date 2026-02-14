
# Login-IP-Adressen-Liste auf der Sicherheitsseite

## Zusammenfassung
Unterhalb der IP-Whitelist wird eine neue Karte angezeigt, die alle IP-Adressen auflistet, von denen Login-Versuche stattgefunden haben. Zusaetzlich wird die IP-Erfassung beim Login aktiviert, da diese aktuell nicht gespeichert wird (alle Werte sind `NULL`).

## Aenderungen

### 1. IP-Adresse beim Login erfassen
Aktuell ruft `useLoginProtection.ts` die Funktion `log_login_attempt` ohne IP-Adresse auf. Da die Client-IP nur serverseitig zuverlaessig ermittelt werden kann, wird eine kleine Edge Function erstellt, die die IP des Aufrufers erkennt und in `login_attempts` speichert.

Alternativ (einfacher): Einen externen Dienst wie `https://api.ipify.org?format=json` vom Client aufrufen und die IP an `log_login_attempt` uebergeben.

### 2. Neue Komponente: `LoginIPList`
Eine neue Komponente `src/components/security/LoginIPList.tsx` wird erstellt:
- Liest aus der `login_attempts`-Tabelle alle eindeutigen IP-Adressen mit zugehoerigen E-Mails und Zeitstempeln
- Zeigt eine Tabelle mit: IP-Adresse, E-Mail, Letzter Zugriff, Erfolg/Fehlgeschlagen
- Nur fuer Admins sichtbar (da `login_attempts` nur via Service-Role zugaenglich ist)

**Problem**: Die `login_attempts`-Tabelle hat eine RLS-Policy `USING (false)` -- kein Benutzer kann sie direkt lesen. Daher wird eine `SECURITY DEFINER`-Funktion benoetigt, die Admins den Lesezugriff erlaubt.

### 3. Datenbank-Aenderungen
- Neue RPC-Funktion `get_login_attempts_for_admin` (SECURITY DEFINER), die nur fuer Admins die Login-Versuche zurueckgibt

### 4. Security-Seite aktualisieren
- `LoginIPList`-Komponente unterhalb der IP-Whitelist-Karte einbinden

## Technische Details

**Neue Dateien:**
- `src/components/security/LoginIPList.tsx` -- Tabelle mit allen Login-IP-Adressen

**Geaenderte Dateien:**
- `src/hooks/useLoginProtection.ts` -- IP-Adresse via ipify.org ermitteln und an `log_login_attempt` uebergeben
- `src/pages/Security.tsx` -- `LoginIPList`-Komponente einbinden

**Datenbank-Migration:**
- Neue `get_login_attempts_for_admin`-Funktion mit Admin-Rollencheck

**Ablauf:**

```text
Login-Versuch
    |
    v
Client ruft ipify.org auf -> bekommt IP
    |
    v
log_login_attempt(_email, _ip_address, _user_agent, _success)
    |
    v
login_attempts Tabelle (mit IP gespeichert)

Security-Seite (Admin):
    |
    v
get_login_attempts_for_admin() [SECURITY DEFINER]
    |
    v
LoginIPList-Komponente zeigt Tabelle an
```
