# ✅ Refactor SLA Rules Completato

## 📊 **Riepilogo Modifiche**

### **Problema Risolto:**
Il campo `clinicId` sulla tabella `slaRules` era **logicamente sbagliato**:
- ❌ Le regole SLA erano legate alla **clinica** invece che alla **categoria**
- ❌ Ogni clinica doveva ricreare le stesse regole per le stesse categorie
- ❌ Non aveva senso: la SLA dipende dalla categoria, non dalla clinica!

### **Soluzione Implementata:**
Rimosso `clinicId`, aggiunto `societyIds` opzionale:
- ✅ Regole SLA **globali** per categoria
- ✅ Opzione di limitare a **società specifiche** (come per categorie/trigger)
- ✅ Se `societyIds` è vuoto/undefined → regola si applica a **tutte** le società
- ✅ Logica corretta: SLA segue la categoria, non la clinica

---

## 🔧 **File Modificati**

### **1. Schema** (`convex/schema.ts`)
```typescript
slaRules: defineTable({
  name: v.string(),
  // ❌ RIMOSSO: clinicId: v.id("clinics"),
  conditions: v.any(),
  targetHours: v.number(),
  isActive: v.boolean(),
  // ... altri campi ...
  
  // ✅ AGGIUNTO:
  societyIds: v.optional(v.array(v.id("societies"))),
})
  // ❌ RIMOSSO: .index("by_clinic", ["clinicId"])
  .index("by_active", ["isActive"]),
```

### **2. Migrazione** (`convex/migrations/migrateSLARules.ts`)
Script che:
- Rimuove `clinicId` da regole esistenti
- Calcola `societyIds` basandosi sulle categorie in `conditions`
- Log dettagliati per debug

### **3. Backend Queries** (`convex/slaRules.ts`)
- ❌ Rimossa `getSLARulesByClinic`
- ✅ Creata `getAllSLARules(userId?)` → query globale con filtro società opzionale
- ✅ Aggiornata `getActiveSLARules(userId?)` → query globale
- ✅ Aggiornata `createSLARule` → richiede `societyIds` invece di `clinicId`

### **4. Backend Tickets** (`convex/tickets.ts`)
Logica calcolo SLA aggiornata:
```typescript
// Query globale (tutte le regole attive)
const allActiveSlaRules = await ctx.db
  .query("slaRules")
  .withIndex("by_active", (q) => q.eq("isActive", true))
  .collect();

// Filtra per società del ticket
const ticketCategory = await ctx.db.get(args.categoryId);
const ticketSocietyIds = ticketCategory?.societyIds || [];

const slaRules = allActiveSlaRules.filter(rule => {
  // Regola globale → si applica sempre
  if (!rule.societyIds || rule.societyIds.length === 0) return true;
  
  // Regola con società → match se c'è overlap
  return rule.societyIds.some(sid => ticketSocietyIds.includes(sid));
});
```

### **5. Frontend** (`src/app/sla/page.tsx`)
- ❌ Rimosso `clinicId` da query e mutation
- ✅ Uso `getAllSLARules(userId)` invece di `getSLARulesByClinic(clinicId)`
- ✅ Calcolo automatico `societyIds` dalle categorie selezionate
- ✅ Se nessuna categoria → regola globale

---

## 🚀 **Come Eseguire la Migrazione**

### **Step 1: Deploy delle Modifiche**
Le modifiche al codice sono già pronte. Convex le deploierà automaticamente.

### **Step 2: Esegui la Migrazione dei Dati**
**IMPORTANTE:** Devi eseguire lo script di migrazione **una sola volta** per aggiornare i dati esistenti.

#### **Comando:**
```bash
npx convex run runSLAMigration:executeMigration
```

#### **Cosa fa:**
1. Carica tutte le regole SLA esistenti
2. Per ogni regola:
   - Legge le categorie in `conditions.categories`
   - Trova le società associate a quelle categorie
   - Salva `societyIds` sulla regola
   - Rimuove il vecchio campo `clinicId`
3. Log dettagliati su Convex Dashboard

#### **Dove Vedere i Log:**
1. Vai su **Convex Dashboard** (https://dashboard.convex.dev)
2. Seleziona il tuo progetto
3. Tab **"Logs"**
4. Cerca log con emoji: 🔄 📊 📋 ✅ ❌

### **Step 3: Verifica Risultato**
1. Vai su Convex Dashboard → `slaRules` table
2. Espandi una regola qualsiasi
3. Verifica:
   - ❌ `clinicId` NON c'è più (o è `undefined`)
   - ✅ `societyIds` è presente (array di IDs o `undefined` per regole globali)

### **Step 4: Pulizia (Opzionale)**
Dopo aver verificato che tutto funziona, puoi eliminare:
- `convex/runSLAMigration.ts` (file temporaneo)
- `convex/migrations/migrateSLARules.ts` (se non serve più)

---

## 🧪 **Come Testare**

### **Test 1: Crea Nuova Regola SLA**
1. Vai su `/sla`
2. Click "Crea Regola SLA"
3. Compila:
   - Nome: "Test SLA Banane"
   - Seleziona categoria "Banane"
   - Target: 72 ore
4. Salva
5. **Verifica su Convex Dashboard:**
   - `slaRules` table → trova la regola appena creata
   - Espandi `societyIds` → dovrebbe contenere IDs delle società della categoria "Banane"

### **Test 2: Crea Regola Globale**
1. Vai su `/sla`
2. Click "Crea Regola SLA"
3. Compila:
   - Nome: "SLA Globale"
   - **NON selezionare nessuna categoria**
   - Target: 24 ore
4. Salva
5. **Verifica su Convex Dashboard:**
   - `slaRules` table → trova la regola
   - `societyIds` → dovrebbe essere `undefined` (regola globale)

### **Test 3: Crea Ticket e Verifica SLA**
1. Vai su `/tickets/new`
2. Crea ticket con categoria "Banane"
3. Salva
4. **Verifica su Convex Dashboard → Logs:**
   ```
   🔍 SLA DEBUG: Trovate X regole SLA attive globali
   📂 SLA DEBUG: Categoria ticket: "Banane", società: [...]
   🔍 SLA DEBUG: Regole SLA applicabili dopo filtro società: Y
   📋 SLA DEBUG: Valuto regola "Test SLA Banane"
   ✅ REGOLA SI APPLICA! Deadline: ...
   ```
5. **Verifica sul ticket:**
   - Convex Dashboard → `tickets` table → trova il ticket
   - Campo `slaDeadline` → dovrebbe avere un timestamp (non undefined)
6. **Verifica su Frontend:**
   - Vai su `/tickets/my`
   - Trova il ticket nella lista
   - Colonna "SLA" → dovrebbe mostrare countdown (es. "Scade tra 71h 59m")

---

## 📊 **Vantaggi del Nuovo Design**

### **Prima (con `clinicId`):**
```
Clinica A crea regola: "SLA Fatturazione 48h" → clinicId: "A"
Clinica B crea regola: "SLA Fatturazione 48h" → clinicId: "B"
Clinica C crea regola: "SLA Fatturazione 48h" → clinicId: "C"
...
→ Duplicazione inutile! ❌
```

### **Dopo (con `societyIds`):**
```
Admin crea regola: "SLA Fatturazione 48h"
  → societyIds: [] (globale)
  → Si applica a TUTTE le cliniche/società ✅

Oppure:

Admin crea regola: "SLA Fatturazione VIP 24h"
  → societyIds: ["societyVIP1", "societyVIP2"]
  → Si applica solo a società VIP ✅
```

---

## 🔍 **Debug: Se SLA Non Funziona**

### **Problema: "SLA assente" su ticket**

#### **Verifica 1: Regola SLA esiste?**
- Convex Dashboard → `slaRules` table
- Cerca regola per la categoria del ticket
- `isActive` = `true`?

#### **Verifica 2: Regola è globale o ha società corrette?**
- Espandi campo `societyIds`
- Se `undefined` → regola globale (OK)
- Se array → verifica che contenga società della categoria del ticket

#### **Verifica 3: Categoria ha società?**
- Convex Dashboard → `categories` table
- Trova la categoria del ticket
- Espandi `societyIds`
- Se vuoto → OK (categoria globale)
- Se ha società → devono matchare con `societyIds` della regola SLA

#### **Verifica 4: Guarda i log Convex**
Durante creazione ticket, cerca:
```
🔍 SLA DEBUG: Trovate X regole SLA attive globali
📂 SLA DEBUG: Categoria ticket: "...", società: [...]
🔍 SLA DEBUG: Regole SLA applicabili dopo filtro società: Y
📋 SLA DEBUG: Valuto regola "..."
🎯 Match categoria? true/false
```

Se vedi `Match categoria? false` → problema matching ID categoria

---

## 📝 **Checklist Post-Refactor**

- [ ] Deploy codice su Convex (automatico)
- [ ] Esegui migrazione: `npx convex run runSLAMigration:executeMigration`
- [ ] Verifica log migrazione su Convex Dashboard
- [ ] Verifica `slaRules` table: `clinicId` rimosso, `societyIds` presente
- [ ] Test: Crea nuova regola SLA
- [ ] Test: Crea ticket e verifica `slaDeadline`
- [ ] Test: Verifica countdown su `/tickets/my`
- [ ] Elimina file temporanei (`runSLAMigration.ts`)

---

## 🎯 **Risultato Finale**

✅ **Regole SLA logicamente corrette:**
- Seguono la **categoria**, non la clinica
- Supporto per società specifiche
- Nessuna duplicazione
- Facilmente estendibili

✅ **Codice più pulito:**
- Query globali invece di query per clinica
- Filtro in-memory per società
- Log debug dettagliati

✅ **Flessibilità:**
- Regole globali (per tutte le società)
- Regole specifiche (solo per alcune società)
- Facile aggiungere nuove condizioni in futuro

---

## 🆘 **Hai Problemi?**

Se qualcosa non funziona:
1. Controlla i log Convex Dashboard
2. Verifica che la migrazione sia stata eseguita
3. Controlla che `societyIds` sia corretto su `slaRules` table
4. Leggi la sezione "Debug" sopra

**Buon lavoro!** 🚀


