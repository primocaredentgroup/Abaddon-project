# 🎯 Guida ai Trigger Automatici

## 📋 Cosa Sono i Trigger?

I **trigger** sono **regole automatiche** che vengono eseguite quando succede qualcosa con i ticket. 

Pensa a un trigger come a una **ricetta**: 
- **"SE accade X"** (condizione) 
- **"ALLORA fai Y"** (azione)

---

## 🔧 Come Funzionano

### 1. **Quando Si Attivano?**
I trigger si attivano **AUTOMATICAMENTE** quando:
- ✅ Crei un nuovo ticket
- ✅ Il trigger è **attivo** (non disabilitato)
- ✅ La **condizione** è soddisfatta

### 2. **Tipi di Condizioni**

| Tipo | Descrizione | Esempio |
|------|-------------|---------|
| `category_match` | Controlla la categoria del ticket | "Se categoria = Prescrizioni" |
| `status_change` | Controlla lo stato del ticket | "Se stato = Aperto" |

### 3. **Tipi di Azioni**

| Tipo | Descrizione | Esempio |
|------|-------------|---------|
| `assign_user` | Assegna automaticamente il ticket a un utente | "Assegna a f.grinfone@primogroup.it" |
| `change_status` | Cambia lo stato del ticket | "Cambia stato in 'In Lavorazione'" |

---

## 🎬 Esempio Pratico

### Trigger: "Prescrizioni su Fede"

**Condizione:**
```json
{
  "type": "category_match",
  "value": "prescrizioni"
}
```
Significa: "Quando il ticket è della categoria Prescrizioni..."

**Azione:**
```json
{
  "type": "assign_user",
  "value": "f.grinfone@primogroup.it"
}
```
Significa: "...assegnalo automaticamente a Fede"

### Risultato:
Ogni volta che crei un ticket nella categoria "Prescrizioni", viene **automaticamente assegnato a Fede**! 🎉

---

## 🔍 Come Verificare Se Funziona

### 1. **Nei Log del Server**
Quando crei un ticket, vedrai nei log:
```
🔍 Trovati 1 trigger attivi per la clinica xxx
🎯 Valutazione trigger: Prescrizioni su Fede
  ↳ Categoria match? prescrizioni === prescrizioni = true
✅ Condizione soddisfatta! Eseguo azione: assign_user
  ↳ Ticket assegnato a f.grinfone@primogroup.it
```

### 2. **Nella Tabella Ticket**
Il ticket apparirà **già assegnato** all'utente specificato, senza che tu faccia nulla manualmente!

---

## 🐛 Problemi Comuni

### ❌ Il trigger non si attiva

**Possibili cause:**
1. **Trigger disattivato**: Verifica che sia attivo nella pagina trigger
2. **Condizione sbagliata**: Controlla che il valore corrisponda esattamente (es. "prescrizioni" non "Prescrizioni")
3. **Utente non esiste**: Se assegni a un utente, l'email deve esistere nel sistema

### ❌ Categoria mostra N/A

**Risolto!** Abbiamo sistemato il problema popolando le relazioni in `getMyCreatedWithAuth`.

---

## 📝 Note Tecniche

### Dove Vengono Eseguiti i Trigger?
Nel file `convex/tickets.ts`, funzione `createWithAuth`, righe 579-637.

### Ordine di Esecuzione:
1. Crea il ticket
2. Recupera tutti i trigger attivi della clinica
3. Per ogni trigger:
   - Valuta la condizione
   - Se soddisfatta, esegue l'azione
4. Restituisce il ticket creato

### Logica di Matching:
- **category_match**: Confronta `category.slug` con `trigger.conditions.value`
- **status_change**: Confronta lo stato del ticket (sempre "open" alla creazione)

---

## 🚀 Prossimi Sviluppi

Potresti aggiungere:
- ✨ Trigger per cambio di stato (non solo creazione)
- ✨ Condizioni multiple (AND/OR)
- ✨ Azioni multiple per trigger
- ✨ Trigger basati su priorità
- ✨ Notifiche automatiche

---

**Creato il:** 1 Ottobre 2025  
**Autore:** AI Assistant  
**Versione:** 1.0


