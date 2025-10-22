# Guida Assegnazione Automatica Società

## 📋 Panoramica

Questo sistema permette di assegnare automaticamente una società agli utenti al primo login in base al dominio della loro email.

## 🎯 Casi d'uso

- **Mappatura di default:**
  - `@primogroup.it` → Società **HQ**
  - `@centriprimo.it` → Società **Cliniche**
  - `@care-dent.it` → Società **Cliniche**
  - `@primolab.eu` → Società **Laboratorio**

- Gli amministratori possono aggiungere/modificare/rimuovere questi mapping tramite l'interfaccia admin

## 🏗️ Architettura

### 1. Database Schema (`convex/schema.ts`)

Nuova tabella: **`domainSocieties`**

```typescript
{
  domain: string,              // es. "primogroup.it"
  societyId: Id<"societies">,  // Riferimento alla società
  isActive: boolean,           // Per abilitare/disabilitare
  createdAt: number,
  updatedAt: number,
  createdBy: Id<"users">
}
```

**Indici:**
- `by_domain`: ricerca veloce per dominio
- `by_society`: trovare tutti i domini associati a una società
- `by_active`: filtrare solo mapping attivi
- `by_domain_active`: ricerca combinata (usata al login)

### 2. Backend (`convex/domainSocieties.ts`)

**Query:**
- `list()`: Ottiene tutti i mapping (con opzione activeOnly)
- `getByDomain(domain)`: Trova il mapping per un dominio specifico

**Mutations:**
- `create(domain, societyId)`: Crea un nuovo mapping
- `update(mappingId, ...)`: Aggiorna un mapping esistente
- `remove(mappingId)`: Elimina un mapping
- `initDefaultMappings()`: Inizializza i 4 mapping di default

Tutte le operazioni includono:
- ✅ Normalizzazione del dominio (lowercase, trim)
- ✅ Validazione esistenza società
- ✅ Controllo duplicati
- ✅ Audit logging

### 3. Logica di Login (`convex/auth.ts`)

Modificata la funzione `getOrCreateUser`:

```typescript
// 1. Crea l'utente
const userId = await ctx.db.insert("users", {...})

// 2. Estrae il dominio dalla email
const domain = email.split("@")[1].toLowerCase()

// 3. Cerca un mapping attivo per quel dominio
const domainMapping = await ctx.db
  .query("domainSocieties")
  .withIndex("by_domain_active", (q) =>
    q.eq("domain", domain).eq("isActive", true)
  )
  .first()

// 4. Se trovato, assegna la società automaticamente
if (domainMapping && società attiva) {
  await ctx.db.insert("userSocieties", {
    userId,
    societyId: domainMapping.societyId,
    assignedBy: userId, // Auto-assegnato
    assignedAt: Date.now(),
    isActive: true,
  })
}
```

**Importante:**
- L'assegnazione avviene solo al **primo login** (creazione utente)
- Se il mapping non esiste, l'utente viene creato senza società (può essere assegnata manualmente dopo)
- Errori nell'assegnazione società NON bloccano la creazione dell'utente (wrapped in try/catch)

### 4. Interfaccia Admin

**Pagina:** `/admin/domain-societies`

**Componente:** `DomainSocietyManager`

**Funzionalità:**
- 📋 Visualizza tutti i mapping esistenti in una tabella
- ➕ Aggiungi nuovo mapping (dominio + società)
- ✏️ Modifica mapping esistente (inline editing)
- 🗑️ Elimina mapping
- 🔄 Attiva/Disattiva mapping (senza eliminarli)
- 🚀 Inizializza mapping di default (pulsante rapido)

**UI Features:**
- Form validato (dominio obbligatorio, società obbligatoria)
- Normalizzazione automatica del dominio (lowercase)
- Badge colorati per stato (attivo/disattivo)
- Info box con spiegazione del funzionamento
- Messaggi di successo/errore

## 📖 Come Usare

### Per Amministratori

#### Setup Iniziale

1. Vai su `/admin/domain-societies`
2. Clicca "Inizializza Default" per creare i 4 mapping standard
3. Verifica che le società HQ, Cliniche e Laboratorio esistano nel sistema

#### Aggiungere un Nuovo Dominio

1. Clicca "Aggiungi Mapping"
2. Inserisci il dominio (es. `nuovodominio.it`)
3. Seleziona la società dal dropdown
4. Clicca "Salva"

#### Modificare un Mapping

1. Clicca l'icona ✏️ sulla riga del mapping
2. Modifica il dominio o la società
3. Clicca ✓ per salvare o ✗ per annullare

#### Disattivare Temporaneamente

1. Clicca sul badge "Attivo" sulla riga del mapping
2. Il mapping diventa "Disattivo" ma non viene eliminato
3. Cliccando di nuovo si riattiva

#### Eliminare un Mapping

1. Clicca l'icona 🗑️ sulla riga del mapping
2. Conferma l'eliminazione
3. Il mapping viene rimosso dal database

### Per Sviluppatori

#### Test in Locale

```javascript
// Test creazione mapping
await ctx.runMutation(api.domainSocieties.create, {
  domain: "test.it",
  societyId: "j574abc123..." // ID società esistente
})

// Test assegnazione al login
// Crea un nuovo utente con email @test.it
// Il sistema dovrebbe assegnare automaticamente la società configurata
```

#### Controllo Audit Logs

```javascript
// Controlla gli audit logs per vedere le assegnazioni automatiche
const logs = await ctx.runQuery(api.auditLogs.getByEntity, {
  entityType: "userSociety"
})
```

## 🔍 Debugging

### L'utente non riceve la società al login

**Possibili cause:**

1. **Mapping non esiste**: Controlla che esista un mapping per quel dominio
2. **Mapping disattivato**: Verifica che `isActive = true`
3. **Società disattivata**: Verifica che la società sia attiva
4. **Dominio errato**: Il dominio è case-sensitive? Dovrebbe essere normalizzato
5. **Utente già esistente**: L'assegnazione avviene solo al **primo login**

**Debug console logs:**

Guarda i logs di Convex durante il login. Dovrebbe apparire:
```
Società [NOME] assegnata automaticamente a [EMAIL] basandosi sul dominio [DOMINIO]
```

### Come ri-testare l'assegnazione automatica

Per testare su un utente esistente:

1. **Opzione 1**: Elimina l'utente dal database e rifai login
2. **Opzione 2**: Assegna manualmente la società via interfaccia admin
3. **Opzione 3**: Crea un nuovo utente test con email diversa

## 🛡️ Sicurezza

- ✅ Solo **amministratori** possono gestire i mapping (via `requireUser`)
- ✅ Tutte le operazioni sono **audit logged**
- ✅ Validazione input (no duplicati, società esistenti)
- ✅ Errori nell'assegnazione **non bloccano** la creazione utente

## 🚀 Estensioni Future

Possibili miglioramenti:

1. **Assegnazione multipla**: Un dominio → più società
2. **Pattern matching**: `*.primo.it` → match tutti i sottodomini
3. **Priorità**: Se più match, quale società ha precedenza
4. **Riesegui assegnazione**: Pulsante per riprocessare utenti esistenti
5. **Dashboard analytics**: Quanti utenti per dominio, statistiche

## 📝 Esempio Completo

```typescript
// 1. Admin crea il mapping
await ctx.runMutation(api.domainSocieties.create, {
  domain: "primogroup.it",
  societyId: hqSocietyId
})

// 2. Nuovo utente fa login con email mario@primogroup.it
// 3. Sistema crea l'utente
const userId = await ctx.db.insert("users", {
  email: "mario@primogroup.it",
  name: "Mario Rossi",
  // ... altri campi
})

// 4. Sistema estrae dominio "primogroup.it"
// 5. Sistema trova il mapping HQ
// 6. Sistema assegna automaticamente HQ a Mario
await ctx.db.insert("userSocieties", {
  userId,
  societyId: hqSocietyId,
  assignedBy: userId,
  assignedAt: Date.now(),
  isActive: true
})

// ✅ Mario ora appartiene a HQ
```

## 📞 Supporto

Per problemi o domande:
- Controlla i logs di Convex
- Verifica gli audit logs
- Controlla che società e mapping siano attivi
- Testa con un nuovo utente non esistente

