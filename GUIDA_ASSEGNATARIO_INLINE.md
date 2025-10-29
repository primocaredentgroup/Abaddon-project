# 🎯 Guida: Assegnatario Inline con Dropdown

## 📋 Panoramica

Ho modificato la pagina di dettaglio ticket per:
1. ❌ **Rimuovere** il tab "Clinica" (non serviva)
2. ❌ **Rimuovere** il tab "Assegnazione" (sostituito con dropdown inline)
3. ✅ **Aggiungere** dropdown inline sull'assegnatario nella sidebar

---

## 🎯 Cosa è Stato Fatto

### ✅ 1. Rimossi Tab Non Necessari (`TicketActions.tsx`)

**File modificato:** `src/components/tickets/TicketActions.tsx`

**Modifiche:**
- ❌ Rimosso tab "Assegnazione" (linee 150-161)
- ❌ Rimosso tab "Clinica" (linee 174-185)
- ❌ Rimosso contenuto tab "Assegnazione" (linee 230-241)
- ❌ Rimosso contenuto tab "Clinica" (linee 251-256)

**Tab Rimanenti:**
- ✅ Azioni Rapide
- ✅ Stato
- ✅ Categoria

---

### ✅ 2. Aggiunto Dropdown Inline Assegnatario (`page.tsx`)

**File modificato:** `src/app/tickets/[id]/page.tsx`

**Modifiche Principali:**

#### 2.1 Import Necessari
```typescript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  // ... altri import
  ChevronDown,   // 🆕 Icona freccia dropdown
  UserX          // 🆕 Icona "non assegnato"
} from 'lucide-react';
```

#### 2.2 Stati e Ref
```typescript
// Stati per dropdown assegnatario
const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);
```

#### 2.3 Query Agenti Disponibili
```typescript
// Fetch agenti disponibili per l'assegnazione
const availableAgents = useQuery(
  api.users.getAvailableAgents,
  clinicId && user?.email ? {
    clinicId: clinicId,
    userEmail: user.email
  } : "skip"
);
```

#### 2.4 Mutation per Cambiare Assegnatario
```typescript
const changeAssignee = useMutation(api.tickets.changeAssignee);
```

#### 2.5 Handler per Cambio Assegnatario
```typescript
const handleAssigneeChange = async (newAssigneeId?: string) => {
  try {
    await changeAssignee({
      ticketId: ticketId as any,
      newAssigneeId: newAssigneeId as any,
      userEmail: user?.email || ""
    });
    setShowAssigneeDropdown(false);
    toast({ title: '✅ Assegnatario aggiornato!', variant: 'default' });
  } catch (error: any) {
    console.error("❌ Errore:", error.message);
    toast({ title: 'Errore', description: error.message, variant: 'destructive' });
  }
};
```

#### 2.6 useEffect per Chiudere Dropdown al Click Fuori
```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setShowAssigneeDropdown(false);
    }
  };
  
  if (showAssigneeDropdown) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showAssigneeDropdown]);
```

#### 2.7 Componente UI Dropdown nella Sidebar
```tsx
{/* Assegnatario con dropdown inline */}
<div className="flex items-center justify-between">
  <span className="text-sm text-gray-600">Assegnato a</span>
  {canManage ? (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
        className="flex items-center space-x-1 text-sm text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
      >
        <span>{ticket.assignee?.name || 'Non assegnato'}</span>
        <ChevronDown className="h-3 w-3 text-gray-500" />
      </button>
      
      {/* Dropdown Menu */}
      {showAssigneeDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {/* Opzione "Non assegnato" */}
          <button
            onClick={() => handleAssigneeChange(undefined)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
          >
            <UserX className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700">Non assegnato</span>
          </button>
          
          {/* Divider */}
          <div className="border-t border-gray-200 my-1"></div>
          
          {/* Lista agenti */}
          {availableAgents && availableAgents.length > 0 ? (
            availableAgents.map((agent: any) => (
              <button
                key={agent._id}
                onClick={() => handleAssigneeChange(agent._id)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${
                  ticket.assigneeId === agent._id ? 'bg-blue-50' : ''
                }`}
              >
                <UserCheck className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.email}</div>
                </div>
                {ticket.assigneeId === agent._id && (
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Nessun agente disponibile
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <span className="text-sm text-gray-900">
      {ticket.assignee?.name || 'Non assegnato'}
    </span>
  )}
</div>
```

---

## 🎨 Come Funziona (Spiegato Semplice)

### Prima:
- Avevi **2 tab separati** per "Assegnazione" e "Clinica"
- Per cambiare assegnatario dovevi cliccare sul tab "Assegnazione"
- Il tab Clinica era inutile

### Dopo:
- ❌ **Tab "Assegnazione" e "Clinica" rimossi**
- ✅ **Assegnatario diventa cliccabile** direttamente nella sidebar
- ✅ **Click → Si apre dropdown** con lista agenti
- ✅ **Scegli agente → Salvataggio automatico**

---

## 🔄 Flow Utente

### Step 1: Visualizza Assegnatario
```
Sidebar → "Assegnato a: Mario Rossi ▾"
         (se sei admin/agente vedi la freccia ▾)
```

### Step 2: Click per Aprire Dropdown
```
Click → Si apre menu a tendina con:
        ┌─────────────────────────────┐
        │ ❌ Non assegnato            │
        ├─────────────────────────────┤
        │ ✅ Mario Rossi              │
        │    mario@esempio.it         │
        ├─────────────────────────────┤
        │ ✅ Luca Bianchi             │
        │    luca@esempio.it          │
        └─────────────────────────────┘
```

### Step 3: Scegli Agente
```
Click su agente → ✅ Toast "Assegnatario aggiornato!"
                → Dropdown si chiude automaticamente
                → Pagina si aggiorna con nuovo assegnatario
```

---

## 🎯 Funzionalità Dropdown

### Caratteristiche:
1. ✅ **Mostra nome corrente** con freccia `▾`
2. ✅ **Click fuori chiude** il dropdown
3. ✅ **Opzione "Non assegnato"** per rimuovere assegnatario
4. ✅ **Lista agenti filtrata** per clinica
5. ✅ **Highlight agente corrente** (sfondo blu chiaro)
6. ✅ **Checkmark** sull'agente attualmente assegnato
7. ✅ **Hover effects** per migliore UX
8. ✅ **Scroll interno** se molti agenti (max-height: 16rem)
9. ✅ **Toast notification** su successo/errore
10. ✅ **Solo admin/agenti** possono vedere il dropdown

### Permessi:
- **Admin/Agenti**: Vedono dropdown cliccabile
- **Utenti Normali**: Vedono solo testo statico

---

## 📊 Riepilogo Modifiche

| File | Modifiche | Linee Modificate |
|------|-----------|------------------|
| `TicketActions.tsx` | Rimossi tab Assegnazione e Clinica | ~40 linee rimosse |
| `tickets/[id]/page.tsx` | Aggiunto dropdown inline assegnatario | ~80 linee aggiunte |

---

## 🧪 Come Testare

### Test 1: Visualizzazione Dropdown (Admin/Agente)
1. Login come **Admin** o **Agente**
2. Vai su un ticket qualsiasi
3. Guarda sidebar → "Assegnato a" dovrebbe avere freccia `▾`
4. Click → Si apre dropdown con lista agenti ✅

### Test 2: Cambio Assegnatario
1. Click su dropdown
2. Scegli un agente dalla lista
3. Verifica toast "✅ Assegnatario aggiornato!"
4. Verifica che il nome sia cambiato nella sidebar ✅

### Test 3: "Non Assegnato"
1. Click su dropdown
2. Scegli "❌ Non assegnato"
3. Verifica che mostri "Non assegnato" ✅

### Test 4: Click Fuori
1. Apri dropdown
2. Click fuori dal dropdown
3. Verifica che si chiuda automaticamente ✅

### Test 5: Permessi Utente Normale
1. Login come **Utente**
2. Vai su un ticket
3. Verifica che "Assegnato a" sia solo testo statico (senza freccia) ✅

### Test 6: Tab Rimossi
1. Vai su un ticket
2. Apri card "Azioni ticket" (se sei admin/agente)
3. Verifica che NON ci siano più i tab "Assegnazione" e "Clinica" ✅

---

## 🎨 Design UI

### Dropdown Aperto:
```
┌────────────────────────────────────┐
│ Assegnato a: Mario Rossi ▾         │ ← Click qui
│                                    │
│  ┌─────────────────────────────┐  │
│  │ ❌ Non assegnato            │  │
│  ├─────────────────────────────┤  │
│  │ ✅ Mario Rossi   (attuale) ●│  │ ← Highlight blu
│  │    mario@esempio.it         │  │
│  ├─────────────────────────────┤  │
│  │ ✅ Luca Bianchi             │  │
│  │    luca@esempio.it          │  │
│  └─────────────────────────────┘  │
└────────────────────────────────────┘
```

### Colori:
- **Blu chiaro** (`bg-blue-50`): Agente attualmente assegnato
- **Grigio hover** (`hover:bg-gray-100`): Effetto hover sugli agenti
- **Blu scuro** (`text-blue-600`): Icone e checkmark
- **Bianco** (`bg-white`): Sfondo dropdown
- **Ombra** (`shadow-lg`): Ombra dropdown

---

## 🔮 Possibili Miglioramenti Futuri

- [ ] Aggiungere search bar nel dropdown per filtrare agenti
- [ ] Mostrare avatar agenti invece di icone generiche
- [ ] Aggiungere tooltip con info agente (es: competenze, carico lavoro)
- [ ] Animazione apertura/chiusura dropdown
- [ ] Shortcut tastiera (es: ESC per chiudere)
- [ ] Mostrare numero ticket assegnati per ogni agente
- [ ] Filtro agenti per reparto/competenza

---

## 📝 Note Tecniche

### Convex Mutation Usata:
```typescript
api.tickets.changeAssignee
```

**Parametri:**
- `ticketId`: ID del ticket
- `newAssigneeId`: ID del nuovo assegnatario (o `undefined` per non assegnato)
- `userEmail`: Email utente che fa la modifica

### Query Usata:
```typescript
api.users.getAvailableAgents
```

**Parametri:**
- `clinicId`: ID della clinica
- `userEmail`: Email utente corrente

**Ritorna:** Array di agenti disponibili con `_id`, `name`, `email`

---

## ✅ Vantaggi Nuova Implementazione

| Vantaggio | Descrizione |
|-----------|-------------|
| 🚀 **Più Veloce** | Cambio assegnatario in 2 click invece che 3+ |
| 🎯 **Più Intuitivo** | Dropdown direttamente dove serve |
| 🧹 **UI Più Pulita** | Rimossi 2 tab inutili |
| 📱 **Migliore UX** | Dropdown compatto e contestuale |
| ✅ **Feedback Immediato** | Toast notification su cambio |
| 🔒 **Sicuro** | Controllo permessi integrato |

---

## 🎉 Conclusione

La nuova implementazione:
- ✅ **Rimuove tab inutili** (Clinica, Assegnazione)
- ✅ **Aggiunge dropdown inline** per assegnatario
- ✅ **Migliora UX** con cambio assegnatario più veloce
- ✅ **Mantiene sicurezza** con controllo permessi

**Ora gli agenti possono cambiare assegnatario con 2 soli click direttamente dalla sidebar! 🎯**


