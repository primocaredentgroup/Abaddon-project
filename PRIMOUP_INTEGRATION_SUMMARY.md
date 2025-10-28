# 🎉 Integrazione PrimoUp - Riepilogo Completo

**Branch:** `staging`
**Data:** 27 Ottobre 2025
**Stato:** ✅ Implementazione completata, pronto per test

---

## 📋 Cosa È Stato Implementato

### 1. **Schema Database** (`convex/schema.ts`)

#### Modifiche:
- ✅ Aggiunta tabella `primoup_tokens` per gestione token API
- ✅ Campo `users.clinicId` reso **optional** (backward compatibility)
- ✅ Campo `users.lastClinicSyncAt` per tracking sync giornaliero  
- ✅ Campo `userClinics.externalClinicId` per matching con PrimoUp
- ✅ Campo `clinics.externalClinicId` per ID PrimoUp
- ✅ Nuovo indice `by_user_active` su `userClinics`

#### Logica:
- `users.clinicId` mantenu per backward compatibility ma deprecato
- `userClinics` è la fonte primaria per le cliniche utente
- `tickets.clinicId` **NON tocca** → storico preservato

---

### 2. **Gestione Token PrimoUp**

#### File Creati:
- ✅ `convex/primoupAuth.ts`: Store, get, invalidate token
- ✅ `convex/primoupActions.ts`: Actions per API PrimoUp

#### Funzioni Principali:
```typescript
// Setup connessione (login PrimoUp)
setupConnection() → { success, message, userInfo }

// Get dati utente con cliniche
getUserByEmail(email) → PrimoUp API response

// Sync cliniche automatico
syncUserClinicsFromPrimoUp(userEmail, userId) → {
  success,
  clinicsSynced,
  clinicsDeactivated
}

// Sync singola clinica (internal)
syncSingleClinic(userId, externalClinicId, clinicData)

// Disattiva cliniche rimosse (internal)
deactivateRemovedClinics(userId, activeExternalClinicIds)
```

---

### 3. **Logica Sync Automatico** (`src/hooks/useAuth.ts`)

#### Flusso:
1. **Utente fa login** → `useAuth` carica dati
2. **Check sync**: `lastClinicSyncAt > 24h`?
3. **Se SI**: Chiama `syncUserClinicsFromPrimoUp`
4. **API Call**: `GET /users/by-email/?email=xxx&include=clinics`
5. **Per ogni clinica**:
   - Se NON esiste in DB → `INSERT clinics`
   - Se esiste → `UPDATE` dati
   - Crea/aggiorna `userClinics` con `isActive: true`
6. **Cliniche rimosse**: `userClinics.isActive = false`
7. **Aggiorna**: `users.lastClinicSyncAt = now()`

#### Vantaggi:
- ⚡ **1 sync/giorno**: Minimizza chiamate API
- 🔄 **Automatico**: Nessun intervento utente
- 💾 **Cache locale**: Query istantanee
- 📊 **Storico preservato**: Cliniche vecchie in DB

---

### 4. **Form Creazione Ticket** (`src/app/tickets/new/page.tsx`)

#### Modifiche:
- ✅ Query `getUserActiveClinics(userId)` per dropdown
- ✅ **Dropdown cliniche** se utente ha > 1 clinica
- ✅ Selezione automatica se 1 sola clinica
- ✅ Validazione: clinica obbligatoria
- ✅ Passa `clinicId` a `createWithAuth`

#### UI:
```jsx
{userClinicsData && userClinicsData.length > 1 && (
  <Select label="Clinica *" ...>
    {userClinicsData.map(clinic => ...)}
  </Select>
)}
```

---

### 5. **Mutation Creazione Ticket** (`convex/tickets.ts`)

#### Modifiche:
```typescript
createWithAuth({
  ...
  clinicId: v.optional(v.id("clinics")), // 🆕 Nuovo parametro
  ...
})
```

#### Logica:
1. Se `clinicId` passato → Verifica accesso utente via `userClinics`
2. Se NON passato → Fallback a `user.clinicId` (backward compatibility)
3. Crea ticket con `clinicId` corretto
4. Trigger su clinica corretta

---

### 6. **Helper Function** (`convex/tickets.ts`)

```typescript
async function getUserClinicIds(ctx, userId): Promise<Id<"clinics">[]> {
  // 1. Cerca in userClinics (attive)
  // 2. Se NON trovato → Fallback user.clinicId
  // 3. Return array clinic IDs
}
```

#### Aggiornate Query:
- ✅ `getByClinic`: Cerca in TUTTE le cliniche utente
- ✅ `getById`: Verifica accesso via `getUserClinicIds`
- ✅ `update`: Verifica accesso clinica
- ⚠️ **Altre query**: Usano ancora `user.clinicId` (OK per backward compatibility)

---

### 7. **Migration Script** (`convex/migrations/populateUserClinics.ts`)

#### Funzione:
```typescript
populateUserClinicsFromExisting() → {
  usersProcessed,
  relationshipsCreated,
  errors[]
}
```

#### Cosa Fa:
1. Legge tutti gli utenti
2. Per ogni `user.clinicId` esistente
3. Crea relazione `userClinics` se non esiste
4. Setta `joinedAt = user._creationTime`
5. Ruolo default: `"user"`

---

### 8. **Auth Integration** (`convex/auth.ts`)

#### Nuove Query:
```typescript
// Get cliniche attive utente
getUserActiveClinics(userId) → Array<{
  _id, name, code, address, phone, email,
  externalClinicId, isActive, userRole
}>
```

#### Modifiche `createUserFromIdentity`:
- Crea utente con `clinicId` default (DEMO001)
- Crea subito relazione `userClinics`
- Setta `lastClinicSyncAt: undefined` → sync al primo login

---

## 🔧 Configurazione Richiesta

### 1. **Variabili Ambiente Convex**

Dashboard Convex → Settings → Environment Variables:

```bash
PRIMOUP_API_BASE_URL=https://staging.primoup.it
PRIMOUP_EMAIL=tua-email@dominio.it
PRIMOUP_PASSWORD=tua-password
```

### 2. **Eseguire Migration**

Dashboard Convex → Functions → Run:
```typescript
populateUserClinicsFromExisting()
```

Questo popola `userClinics` con dati esistenti da `users.clinicId`.

---

## 🧪 Test Plan

### Test 1: Configurazione Token
1. Aprire dashboard Convex
2. Functions → `primoupActions.setupConnection()`
3. Verificare: `{ success: true, message: "..." }`
4. Tables → `primoup_tokens` → Deve esserci 1 token attivo

### Test 2: Sync Manuale Cliniche
1. Functions → `syncUserClinicsFromPrimoUp`
2. Args: `{ userEmail: "test@test.it", userId: "..." }`
3. Verificare: `clinicsSynced > 0`
4. Tables → `userClinics` → Deve avere cliniche con `isActive: true`

### Test 3: Login + Sync Automatico
1. Logout completo
2. Login con account
3. Console browser → Cercare: `🔄 Syncing user clinics from PrimoUp...`
4. Dopo 5-10s → `✅ User clinics synced successfully`
5. Verificare `users.lastClinicSyncAt` aggiornato

### Test 4: Creazione Ticket con Clinica
1. Vai a `/tickets/new`
2. Se utente ha > 1 clinica → Vedi dropdown "Clinica *"
3. Seleziona clinica
4. Compila form
5. Crea ticket
6. Verificare: `tickets.clinicId` = clinica selezionata

### Test 5: Storico Preservato
1. Trova vecchio ticket con clinica X
2. Rimuovi clinica X da PrimoUp per utente
3. Login → Sync
4. Verifica: `userClinics` per clinica X → `isActive: false`
5. Vecchio ticket ancora visibile (lettura OK, edit potrebbe essere bloccato)

---

## 📊 File Modificati

### Convex (Backend):
- ✅ `convex/schema.ts`
- ✅ `convex/primoupAuth.ts` (nuovo)
- ✅ `convex/primoupActions.ts` (nuovo)
- ✅ `convex/auth.ts`
- ✅ `convex/tickets.ts`
- ✅ `convex/migrations/populateUserClinics.ts` (nuovo)

### Frontend:
- ✅ `src/hooks/useAuth.ts`
- ✅ `src/app/tickets/new/page.tsx`

### Totale: **8 file** (3 nuovi, 5 modificati)

---

## ⚠️ Note Importanti

### Backward Compatibility
- ✅ `users.clinicId` mantenu per backward compatibility
- ✅ Tutte le query fallback a `user.clinicId` se `userClinics` vuoto
- ✅ Vecchi ticket funzionano senza modifiche

### Performance
- ✅ Sync 1x/giorno → Minimizza API calls
- ✅ Query usano indici ottimizzati
- ✅ `getUserClinicIds` cacheable

### Sicurezza
- ✅ Token PrimoUp stored server-side (Convex DB)
- ✅ Credenziali in env variables (MAI in frontend)
- ✅ Verifica accesso clinica per ogni operazione

### Limitazioni Attuali
- ⚠️ Alcune query legacy usano ancora `user.clinicId` (OK)
- ⚠️ Agent/Admin potrebbero vedere solo loro cliniche (design)
- ⚠️ Ruoli per clinica non ancora implementati (future)

---

## 🚀 Prossimi Step

### Obbligatori (Prima di produzione):
1. ✅ Configurare variabili ambiente
2. ✅ Eseguire migration `populateUserClinics`
3. ✅ Test completo (vedi Test Plan sopra)
4. ✅ Deploy schema su produzione
5. ✅ Deploy functions su produzione

### Opzionali (Future improvements):
- 🔮 Ruoli specifici per clinica (da PrimoUp API)
- 🔮 Sync in background con Convex cron jobs
- 🔮 Dashboard admin per vedere sync status
- 🔮 Notifiche quando cliniche cambiano
- 🔮 Gestione errori sync più robusta
- 🔮 Analytics su utilizzo cliniche

---

## 🐛 Troubleshooting

### Problema: Sync fallisce con 401
**Causa**: Token PrimoUp scaduto o credenziali errate
**Fix**: Verifica env vars, esegui `setupConnection()` manuale

### Problema: Cliniche non appaiono in dropdown
**Causa**: Sync non eseguito o `userClinics` vuoto
**Fix**: Verifica `lastClinicSyncAt`, forza sync manuale

### Problema: "Non hai accesso a questa clinica"
**Causa**: `userClinics.isActive = false` per quella clinica
**Fix**: Verifica su PrimoUp se utente ha ancora accesso

### Problema: Vecchi ticket non visibili
**Causa**: Clinica disattivata e logica troppo restrittiva
**Fix**: Query dovrebbero mostrare ticket storici anche se clinica disattivata

---

## 📚 Riferimenti

- **API PrimoUp**: `/api/v2/users/by-email/?email=XXX&include=clinics`
- **Schema Convex**: `convex/schema.ts`
- **Documentazione**: `primoup-integration-guide (1) (1).md`

---

## ✅ Checklist Deploy

- [ ] Variabili ambiente configurate (Convex Dashboard)
- [ ] Migration `populateUserClinics` eseguita
- [ ] Test login + sync eseguito
- [ ] Test creazione ticket con clinica eseguito
- [ ] Test storico ticket verificato
- [ ] Schema deployato su produzione
- [ ] Functions deployate su produzione
- [ ] Monitoring attivato (Convex logs)
- [ ] Rollback plan pronto (branch main)

---

**Fine Documentazione** 🎉

