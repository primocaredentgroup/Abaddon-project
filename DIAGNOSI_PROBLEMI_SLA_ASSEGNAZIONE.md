# 🔍 Diagnosi Problemi SLA e Assegnazione

## 📋 RIEPILOGO PROBLEMI

### ❌ **Problema 1**: SLA Countdown non visibile nel dettaglio ticket
### ❌ **Problema 2**: SLA Countdown non visibile nella card ticket
### ❌ **Problema 3**: Ticket assegnato non appare in "Ticket Assegnati"

---

## 🔬 ANALISI DETTAGLIATA

### **Problema 1 & 2: SLA Countdown non visibile**

#### ✅ **Cosa FUNZIONA:**
1. **Convex Backend** (`convex/tickets.ts` linee 679-722):
   - ✅ Il calcolo SLA è **correttamente implementato**
   - ✅ Quando crei un ticket, il sistema:
     1. Cerca regole SLA attive per la clinica
     2. Filtra per categoria e priorità
     3. Calcola `slaDeadline` (timestamp Unix in ms)
     4. Salva `slaDeadline` sul ticket con `ctx.db.patch(ticketId, { slaDeadline })`

2. **Componente SLACountdown** (`src/components/tickets/SLACountdown.tsx`):
   - ✅ Componente **completo e funzionante**
   - ✅ Accetta prop `slaDeadline` (timestamp)
   - ✅ Mostra countdown in tempo reale
   - ✅ Colori dinamici (verde/giallo/rosso)
   - ✅ Mostra "SLA assente" se `slaDeadline` è undefined

#### ❌ **Cosa NON FUNZIONA:**
Il componente `SLACountdown` **NON è stato integrato** nella UI!

**File che dovrebbero usarlo ma NON lo fanno:**
- ❌ `/src/app/tickets/[id]/page.tsx` (dettaglio ticket)
- ❌ `/src/app/tickets/my/page.tsx` (lista "I miei ticket")
- ❌ `/src/app/tickets/assigned/page.tsx` (lista "Ticket assegnati")
- ❌ `/src/app/tickets/clinic/page.tsx` (lista "Ticket clinica")
- ❌ Qualsiasi componente card ticket

#### 🔧 **SOLUZIONE:**
Importare e usare `<SLACountdown slaDeadline={ticket.slaDeadline} />` in:
1. Sidebar del dettaglio ticket (info SLA)
2. Card ticket nelle liste

---

### **Problema 3: Ticket assegnato non appare in "Ticket Assegnati"**

#### 📊 **Come Funziona la Query "Ticket Assegnati":**

**Query**: `convex/ticketsToManage.ts` → `getTicketsToManage`

**Logica (linee 51-78):**
Un agente vede un ticket SE:

1. **Ticket assegnati direttamente** (linea 52-55):
   ```typescript
   if (ticket.assigneeId === user._id) return true
   ```

2. **Ticket NON assegnati nelle sue competenze** (linea 58-65):
   ```typescript
   if (!ticket.assigneeId) {
     // Se NO competenze → vede TUTTI i ticket non assegnati
     if (userCompetencies.length === 0) return true
     // Se HA competenze → solo quelli delle sue categorie
     return userCompetencies.includes(ticket.categoryId)
   }
   ```

3. **Ticket assegnati ad altri MA nelle sue competenze** (linea 68-75):
   ```typescript
   if (ticket.assigneeId && ticket.assigneeId !== user._id) {
     if (userCompetencies.length === 0) return false
     return userCompetencies.includes(ticket.categoryId)
   }
   ```

#### ❌ **Possibili Cause del Problema:**

##### **Causa 1**: L'agente non ha il ruolo corretto
**Verifica (linea 32-35):**
```typescript
const role = await ctx.db.get(user.roleId)
if (!role || !canManageAllTickets(role)) {
  return [] // ← Ritorna array vuoto!
}
```

**Come Verificare:**
1. Vai su Convex Dashboard → `users` table
2. Trova l'utente agente
3. Verifica `roleId`
4. Vai su `roles` table
5. Verifica che il ruolo abbia permessi: `["view_all_tickets"]` o `["full_access"]`

##### **Causa 2**: L'agente non ha `clinicId`
**Verifica (linea 40-42):**
```typescript
if (!user.clinicId) {
  throw new ConvexError("User has no clinic assigned")
}
```

**Come Verificare:**
1. Convex Dashboard → `users` table
2. Verifica che l'agente abbia `clinicId` popolato

##### **Causa 3**: Il ticket è di una clinica diversa
**Verifica (linea 45-48):**
```typescript
const allTickets = await ctx.db
  .query("tickets")
  .withIndex("by_clinic", (q) => q.eq("clinicId", user.clinicId!))
  .collect()
```

**Se il ticket ha `clinicId` diverso da quello dell'agente → NON appare!**

##### **Causa 4**: Ticket non assegnato + Agente ha competenze specifiche
**Se:**
- Ticket NON è assegnato (`assigneeId` è `null`)
- Agente HA competenze (`categoryCompetencies` non vuoto)
- Categoria ticket NON è nelle competenze → **NON appare**

**Esempio:**
```
Agente: categoryCompetencies = ["cat_id_1", "cat_id_2"]
Ticket: categoryId = "cat_id_3"
Ticket: assigneeId = null
→ Ticket NON appare perché categoria non è nelle competenze!
```

##### **Causa 5**: Assegnazione non salvata correttamente
**Verifica:**
1. Convex Dashboard → `tickets` table
2. Cerca il ticket per numero
3. Verifica campo `assigneeId`:
   - ✅ Se è l'ID dell'agente → dovrebbe apparire
   - ❌ Se è `null` o diverso → problema nell'assegnazione

---

## 💾 COME VENGONO SALVATI I DATI SU CONVEX

### **1. Creazione Ticket con SLA**

**File**: `convex/tickets.ts` → mutation `createWithAuth`

**Step by Step:**

#### Step 1: Crea il ticket (linea 665-677)
```typescript
const ticketId = await ctx.db.insert("tickets", {
  title: args.title.trim(),
  description: args.description.trim(),
  status: "open",
  ticketNumber: ticketNumber,
  categoryId: args.categoryId,
  clinicId: targetClinicId,
  creatorId: user._id,
  visibility: visibility,
  lastActivityAt: Date.now(),
  attributeCount: 0,
  priority: priority,
  // ⚠️ NOTA: slaDeadline NON è qui! Viene aggiunto dopo
})
```

#### Step 2: Calcola SLA (linea 679-717)
```typescript
// Trova regole SLA attive
const slaRules = await ctx.db
  .query("slaRules")
  .withIndex("by_clinic", (q) => q.eq("clinicId", targetClinicId))
  .filter((q) => q.eq(q.field("isActive"), true))
  .collect()

let slaDeadline: number | undefined = undefined

for (const rule of slaRules) {
  // Skip se richiede approvazione e non è approvata
  if (rule.requiresApproval && !rule.isApproved) continue
  
  const conditions = rule.conditions as any
  let ruleApplies = true
  
  // Verifica categoria (se specificata nella regola)
  if (conditions?.categories && conditions.categories.length > 0) {
    if (!conditions.categories.includes(args.categoryId)) {
      ruleApplies = false
    }
  }
  
  // Verifica priorità (se specificata nella regola)
  if (conditions?.priority !== undefined) {
    if (priority !== conditions.priority) {
      ruleApplies = false
    }
  }
  
  // Se la regola si applica, calcola deadline
  if (ruleApplies) {
    const deadlineMs = now + (rule.targetHours * 60 * 60 * 1000)
    // Usa la deadline più stringente (più vicina)
    if (!slaDeadline || deadlineMs < slaDeadline) {
      slaDeadline = deadlineMs
    }
  }
}
```

#### Step 3: Salva SLA sul ticket (linea 720-722)
```typescript
// Aggiorna il ticket con la deadline SLA (se trovata)
if (slaDeadline) {
  await ctx.db.patch(ticketId, { slaDeadline })
}
```

**Struttura Dati Salvata:**
```javascript
{
  _id: "ticket_id_123",
  title: "Problema stampante",
  categoryId: "cat_hardware_456",
  clinicId: "clinic_789",
  priority: 4, // Alta
  slaDeadline: 1730289600000, // Timestamp Unix (ms)
  // ... altri campi
}
```

### **2. Assegnazione Ticket**

**File**: `convex/tickets.ts` → mutation `assign` o `changeAssignee`

**Dati Salvati:**
```javascript
await ctx.db.patch(ticketId, {
  assigneeId: newAssigneeId, // ID dell'agente (o undefined per non assegnato)
  lastActivityAt: Date.now()
})
```

**Esempio:**
```javascript
// Prima dell'assegnazione
{
  _id: "ticket_123",
  assigneeId: undefined, // ← Non assegnato
  // ...
}

// Dopo l'assegnazione
{
  _id: "ticket_123",
  assigneeId: "user_agent_456", // ← Assegnato!
  lastActivityAt: 1730289700000
}
```

---

## 🔧 CHECKLIST DEBUG

### **Per SLA Countdown:**
- [ ] Ticket ha `slaDeadline` popolato? (Convex Dashboard → `tickets` table)
- [ ] Esiste almeno 1 regola SLA attiva? (Convex Dashboard → `slaRules` table)
- [ ] La regola SLA si applica alla categoria del ticket?
- [ ] La regola SLA è approvata (se `requiresApproval: true`)?
- [ ] Componente `<SLACountdown>` è importato e usato nella UI?

### **Per Ticket Assegnati:**
- [ ] Agente ha ruolo con permesso `view_all_tickets` o `full_access`?
- [ ] Agente ha `clinicId` popolato?
- [ ] Ticket ha stesso `clinicId` dell'agente?
- [ ] Ticket ha `assigneeId` = ID dell'agente?
- [ ] Se ticket NON assegnato: categoria è nelle competenze dell'agente?
- [ ] Agente ha `categoryCompetencies` configurato correttamente?

---

## 🎯 PROSSIMI PASSI

### **Fix SLA Countdown:**
1. ✅ Importare `SLACountdown` in `/src/app/tickets/[id]/page.tsx`
2. ✅ Aggiungerlo nella sidebar info ticket
3. ✅ Aggiungerlo nelle card ticket delle liste
4. ✅ Testare con ticket che ha regola SLA applicabile

### **Fix Ticket Assegnati:**
1. ✅ Verificare ruolo agente in Convex Dashboard
2. ✅ Verificare `clinicId` agente
3. ✅ Verificare `assigneeId` del ticket
4. ✅ Verificare `categoryCompetencies` se ticket non assegnato
5. ✅ Testare riassegnando il ticket

---

## 📝 ESEMPIO PRATICO

### **Scenario: Creo ticket con SLA**

1. **Creazione Regola SLA:**
   ```
   Nome: SLA Hardware Urgente
   Categoria: Hardware
   Priorità: Alta (4)
   Ore Target: 4 ore
   ```

2. **Creazione Ticket:**
   ```
   Titolo: "Stampante rotta"
   Categoria: Hardware
   Priorità: Alta (4)
   Ora creazione: 29/10/2025 12:00:00
   ```

3. **Calcolo SLA (backend):**
   ```
   slaDeadline = 12:00:00 + 4 ore = 16:00:00
   slaDeadline (timestamp) = 1730210400000
   ```

4. **Salvataggio Convex:**
   ```javascript
   tickets: {
     _id: "ticket_abc",
     title: "Stampante rotta",
     slaDeadline: 1730210400000, // ✅ SALVATO
     // ...
   }
   ```

5. **Visualizzazione UI** (SE integrato):
   ```
   📊 SLA: 🟢 Scade tra 3h 45m
   ```

---

## 🚨 NOTA IMPORTANTE

Il **backend SLA funziona perfettamente**! Il problema è solo che:
- ❌ Il componente `SLACountdown` NON è usato nella UI
- ❌ Quindi `slaDeadline` viene salvato ma non visualizzato

**Soluzione**: Integrare `<SLACountdown slaDeadline={ticket.slaDeadline} />` dove serve!


