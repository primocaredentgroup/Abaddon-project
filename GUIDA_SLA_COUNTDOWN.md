# 📊 Guida Integrazione SLA Countdown

## 🎯 Come Funziona

Ho implementato un sistema completo di monitoraggio SLA in tempo reale per i ticket.

### 📋 Cosa è Stato Implementato:

1. ✅ **Calcolo Automatico SLA** (`convex/tickets.ts`)
   - Quando crei un ticket, il sistema cerca automaticamente le regole SLA applicabili
   - Calcola la deadline in base a: categoria, priorità, ore target
   - Salva `slaDeadline` sul ticket (timestamp Unix)

2. ✅ **Componente Visuale** (`src/components/tickets/SLACountdown.tsx`)
   - Mostra il tempo rimanente in tempo reale
   - Colori dinamici: Verde (OK), Giallo (Attenzione), Rosso (Scaduto)
   - Si aggiorna automaticamente ogni minuto
   - Mostra "SLA assente" se non c'è regola SLA

3. ✅ **Helper Functions** (`convex/lib/slaCalculator.ts`)
   - Funzioni riutilizzabili per calcoli SLA
   - Formattazione tempo
   - Verifica breach SLA

---

## 🚀 Come Usare il Componente

### Esempio Base:

```typescript
import { SLACountdown } from '@/components/tickets/SLACountdown'

// Nel tuo componente React:
<SLACountdown 
  slaDeadline={ticket.slaDeadline} 
  size="md" 
  showIcon={true} 
/>
```

### Props:

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `slaDeadline` | `number \| undefined` | - | Timestamp Unix deadline (o undefined) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Dimensione badge |
| `showIcon` | `boolean` | `true` | Mostra icona |

---

## 🎨 Esempi Visivi:

### 1. Lista Ticket nel Dashboard:

```tsx
// src/app/dashboard/page.tsx
import { SLACountdown } from '@/components/tickets/SLACountdown'

// Nella lista ticket:
{tickets.map((ticket) => (
  <div key={ticket._id} className="flex items-center justify-between">
    <span>{ticket.title}</span>
    <SLACountdown 
      slaDeadline={ticket.slaDeadline} 
      size="sm" 
    />
  </div>
))}
```

### 2. Dettaglio Ticket:

```tsx
// src/app/tickets/[id]/page.tsx
import { SLACountdown } from '@/components/tickets/SLACountdown'

// Nel dettaglio:
<div className="flex items-center space-x-2">
  <h3 className="text-sm font-medium">SLA:</h3>
  <SLACountdown 
    slaDeadline={ticket.slaDeadline} 
    size="lg" 
    showIcon={true}
  />
</div>
```

### 3. Card Ticket:

```tsx
// src/components/tickets/TicketCard.tsx
import { SLACountdown } from '@/components/tickets/SLACountdown'

<Card>
  <CardHeader>
    <div className="flex justify-between items-center">
      <CardTitle>{ticket.title}</CardTitle>
      <SLACountdown slaDeadline={ticket.slaDeadline} />
    </div>
  </CardHeader>
</Card>
```

---

## 🎯 Come Funziona il Calcolo SLA (Spiegazione Semplice):

### Step 1: Creazione Ticket
1. Utente crea ticket con categoria "Hardware" e priorità "Alta" (4)
2. Sistema cerca regole SLA attive per quella clinica
3. Trova regola: "SLA Hardware Urgente" → 4 ore target

### Step 2: Calcolo Deadline
1. Ora creazione: `2025-10-29 12:00:00`
2. Ore target: `4 ore`
3. Deadline: `2025-10-29 16:00:00` (salvato come timestamp Unix)

### Step 3: Visualizzazione
1. Componente legge `ticket.slaDeadline`
2. Calcola tempo rimanente: `4h 0m`
3. Mostra badge verde: "Scade tra 4h 0m" ✅

### Step 4: Aggiornamento Automatico
1. Ogni minuto il componente ricalcola
2. Cambia colore quando si avvicina: Verde → Giallo → Rosso
3. Se scade: "Scaduto da 2h 30m" ❌

---

## 📊 Logica Colori:

| Tempo Rimanente | Colore | Icona | Stato |
|-----------------|--------|-------|-------|
| > 12 ore | 🟢 Verde | CheckCircle | OK |
| 2-12 ore | 🟡 Giallo | Clock | Attenzione |
| < 2 ore | 🔴 Rosso | AlertTriangle | Critico |
| Scaduto | 🔴 Rosso scuro | XCircle | Breach |
| Nessuna SLA | ⚪ Grigio | Clock | SLA assente |

---

## 🛠️ Dove Integrare (TODO):

### Alta Priorità:
- [ ] Dashboard principale (`src/app/dashboard/page.tsx`)
- [ ] Lista "I Miei Ticket" (`src/app/tickets/my/page.tsx`)
- [ ] Lista "Ticket Assegnati" (`src/app/tickets/assigned/page.tsx`)
- [ ] Dettaglio Ticket (`src/app/tickets/[id]/page.tsx`)

### Media Priorità:
- [ ] TicketCard component (`src/components/tickets/TicketCard.tsx`)
- [ ] Lista Ticket Clinica (`src/app/tickets/clinic/page.tsx`)

---

## 🧪 Come Testare:

### Test 1: Crea Regola SLA
1. Vai su `/sla`
2. Crea regola: "Test SLA" → 2 ore target
3. NON selezionare categorie (si applica a tutte)
4. Salva

### Test 2: Crea Ticket
1. Vai su `/tickets/new`
2. Crea ticket qualsiasi
3. Il sistema calcola automaticamente deadline = ora + 2 ore

### Test 3: Verifica Countdown
1. Vai alla lista ticket
2. Dovresti vedere: "Scade tra 2h 0m" 🟢
3. Aspetta 1 minuto → dovrebbe aggiornarsi automaticamente

### Test 4: SLA Assente
1. Elimina tutte le regole SLA
2. Crea nuovo ticket
3. Dovresti vedere: "SLA assente" ⚪

---

## 🐛 Debug:

### Ticket non ha slaDeadline?

**Verifica:**
1. Ci sono regole SLA attive? (`/sla`)
2. La regola si applica al ticket? (categoria/priorità)
3. La regola è approvata? (se `requiresApproval: true`)

**Console log:**
```typescript
console.log("SLA Deadline:", ticket.slaDeadline)
console.log("Date:", new Date(ticket.slaDeadline))
```

---

## 📝 Note Tecniche:

- `slaDeadline` è un **timestamp Unix in millisecondi** (es: `1730289600000`)
- Il componente si aggiorna **automaticamente ogni 60 secondi**
- Il calcolo usa la regola SLA **più stringente** (targetHours minore)
- Se ticket già creato prima dell'implementazione: `slaDeadline` sarà `undefined` → mostra "SLA assente"

---

## 🎉 Fatto!

Ora hai tutto pronto per mostrare il countdown SLA sui ticket!

**Prossimo step:** Integrare il componente nei file sopra elencati.


