# Guida Git: Merge vs Rebase - Processi Sicuri

## 🔄 Differenze tra Merge e Rebase

### Merge
- **Cosa fa**: Unisce due branch creando un commit di merge
- **Pro**: Sicuro, mantiene la storia completa, semplice da capire
- **Contro**: Cronologia può diventare complessa con molti merge commit
- **Quando usarlo**: Quando vuoi mantenere il contesto storico completo

### Rebase  
- **Cosa fa**: Riscrive la storia spostando i commit del tuo branch sopra il target
- **Pro**: Cronologia lineare e pulita, facile da leggere
- **Contro**: Riscrive la storia (può essere pericoloso), più complesso
- **Quando usarlo**: Per mantenere una cronologia pulita, su branch privati

---

## 🛡️ Processo Sicuro: Incorporare Modifiche da Main

### Scenario Base
Tu lavori su branch `feature/ticket`, un collega ha pushato su `main`, vuoi incorporare le sue modifiche.

### 📋 Checklist Preliminare
- [ ] Verifica di essere sul branch corretto
- [ ] Salva/committa le tue modifiche correnti
- [ ] Fai un backup del tuo branch (opzionale ma consigliato)

---

## 🔀 Metodo 1: MERGE (Consigliato per principianti)

### Step 1: Preparazione
```bash
# Verifica branch corrente
git branch

# Salva modifiche non committate
git status
git add .
git commit -m "WIP: salvo modifiche prima del merge"

# (Opzionale) Crea backup del branch
git checkout -b feature/ticket-backup
git checkout feature/ticket
```

### Step 2: Aggiorna Main
```bash
# Passa a main e aggiorna
git checkout main
git pull origin main
```

### Step 3: Merge
```bash
# Torna al tuo branch
git checkout feature/ticket

# Fai il merge
git merge main
```

### Step 4: Gestione Conflitti (se necessario)
```bash
# Se ci sono conflitti, Git ti mostrerà i file
git status

# Risolvi manualmente i conflitti nei file indicati
# Cerca le sezioni con <<<<<<< ======= >>>>>>>

# Dopo aver risolto tutti i conflitti
git add .
git commit -m "Risolvo conflitti merge con main"
```

### Step 5: Test e Push
```bash
# Testa il codice
# ... esegui i tuoi test ...

# Se tutto ok, pusha
git push origin feature/ticket
```

---

## 🎯 Metodo 2: REBASE (Per utenti esperti)

### Step 1: Preparazione (uguale al merge)
```bash
# Salva tutto
git add .
git commit -m "WIP: salvo modifiche prima del rebase"

# Backup (IMPORTANTE per rebase!)
git checkout -b feature/ticket-backup
git checkout feature/ticket
```

### Step 2: Aggiorna Main
```bash
git checkout main
git pull origin main
```

### Step 3: Rebase
```bash
# Torna al tuo branch
git checkout feature/ticket

# Fai il rebase
git rebase main
```

### Step 4: Gestione Conflitti nel Rebase
```bash
# Se ci sono conflitti durante il rebase
# Risolvi i conflitti file per file

# Dopo aver risolto i conflitti di un commit
git add .
git rebase --continue

# Se vuoi annullare tutto il rebase
git rebase --abort

# Se vuoi saltare un commit problematico (ATTENZIONE!)
git rebase --skip
```

### Step 5: Force Push (ATTENZIONE!)
```bash
# ⚠️ Il rebase riscrive la storia, serve force push
git push --force-with-lease origin feature/ticket

# ALTERNATIVA più sicura (se il push normale fallisce)
git push origin feature/ticket
# Se fallisce, allora:
git push --force-with-lease origin feature/ticket
```

---

## 🛟 Metodo 3: SICUREZZA MASSIMA (Branch Temporaneo)

### Quando Usarlo
- Quando non sei sicuro del risultato
- Per testare prima di modificare il branch principale
- Su progetti critici

### Processo
```bash
# 1. Crea branch temporaneo dal tuo branch corrente
git checkout feature/ticket
git checkout -b test-integration

# 2. Aggiorna main
git checkout main
git pull origin main

# 3. Torna al branch test e fai merge/rebase
git checkout test-integration
git merge main  # oppure: git rebase main

# 4. Risolvi conflitti e testa

# 5. Se tutto ok, applica al branch originale
git checkout feature/ticket
git merge main  # ripeti lo stesso processo

# 6. Elimina il branch temporaneo
git branch -d test-integration
```

---

## 🚨 Comandi di Emergenza

### Annullare un Merge
```bash
# Se il merge non è ancora stato pushato
git reset --hard HEAD~1

# Se hai già pushato (ATTENZIONE!)
git revert -m 1 HEAD
```

### Annullare un Rebase
```bash
# Durante il rebase
git rebase --abort

# Dopo il rebase (usando reflog)
git reflog
git reset --hard HEAD@{n}  # dove n è il numero dal reflog
```

### Recuperare Branch Cancellato
```bash
# Trova l'ultimo commit del branch
git reflog
git checkout -b branch-recuperato <commit-hash>
```

---

## 📊 Tabella Riepilogativa

| Aspetto | Merge | Rebase |
|---------|-------|--------|
| Sicurezza | ✅ Alta | ⚠️ Media |
| Cronologia | 📚 Completa ma complessa | 📖 Pulita e lineare |
| Collaborazione | ✅ Ottima | ⚠️ Attenzione ai push |
| Reversibilità | ✅ Facile | ❌ Difficile |
| Conflitti | 🔧 Una volta sola | 🔧 Possibili per ogni commit |

---

## 💡 Best Practices

### Sempre
- ✅ Committa o stash le modifiche prima di iniziare
- ✅ Fai backup dei branch importanti
- ✅ Testa dopo ogni integrazione
- ✅ Usa `git status` spesso per capire dove sei

### Per Merge
- ✅ Usa commit messages descrittivi per i merge
- ✅ Considera `--no-ff` per mantenere la struttura dei branch

### Per Rebase
- ✅ USA SOLO su branch privati (non condivisi)
- ✅ Usa `--force-with-lease` invece di `--force`
- ✅ Fai rebase interattivo per pulire i commit: `git rebase -i`

### Mai
- ❌ Non fare rebase su branch pubblici/condivisi
- ❌ Non fare force push senza `--force-with-lease`
- ❌ Non ignorare i conflitti senza capirli

---

## 🎯 Esempio Pratico Completo

```bash
# Situazione: sei su feature/login, collega ha pushato su main
# Vuoi integrare le sue modifiche

# 1. Stato attuale
git status
git branch -v

# 2. Salva tutto
git add .
git commit -m "Salvo progresso feature login prima integrazione"

# 3. Aggiorna main
git checkout main
git pull origin main

# 4. Torna al tuo branch e integra (scegli uno)
git checkout feature/login

# Opzione A: Merge
git merge main

# Opzione B: Rebase  
git rebase main

# 5. Gestisci eventuali conflitti

# 6. Testa tutto

# 7. Push finale
git push origin feature/login
# Se hai fatto rebase e serve force push:
git push --force-with-lease origin feature/login
```

---

*Ultima modifica: $(date)*

**Ricorda**: Quando hai dubbi, usa sempre il merge. È più sicuro e reversibile!
