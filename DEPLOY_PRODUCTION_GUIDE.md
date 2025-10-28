# 🚀 Guida Deploy Produzione - Abaddon Project

## ⚠️ IMPORTANTE
Questo deploy introduce cambiamenti significativi:
- Sistema priorità ticket (1-5 con fiamme)
- Stati ticket dinamici (tabella ticketStatuses)
- Cliniche multi-utente (userClinics)
- Rimozione clinicId da categorie (ora usano societyIds)
- Trigger con supporto priorità

---

## 📋 FASE 1: Deploy Convex in Produzione ✅ COMPLETATA

### 1.1 Deploy delle funzioni (con schema temporaneo)
```bash
cd /Users/admin/Abaddon-project
npx convex deploy --yes
```

### 1.2 Deploy finale (dopo migration)
```bash
npx convex deploy --yes
```

**Status**: ✅ Entrambi i deploy completati con successo!

---

## 📋 FASE 2: Esecuzione Migration (DA CONVEX DASHBOARD)

Vai su: https://dashboard.convex.dev/d/tidy-jaguar-205

### ✅ OBBLIGATORIE (da eseguire in QUESTO ORDINE):

#### 2.1 Stati Ticket
**Funzione**: `migrations:initializeTicketStatuses`  
**Args**: `{}`  
**Cosa fa**: Crea i 3 stati di default (Aperto, In Corso, Chiuso)

#### 2.2 Priorità Ticket
**Funzione**: `migrations:migratePriorityToNumber`  
**Args**: `{}`  
**Cosa fa**: Converte priority da stringhe a numeri (1-5), default a 1

#### 2.3 Cliniche Multi-Utente
**Funzione**: `migrations:populateUserClinics`  
**Args**: `{}`  
**Cosa fa**: Popola userClinics per utenti esistenti con DEMO001

#### 2.4 Cliniche di Sistema (HQ/LABORATORIO)
**Funzione**: `migrations:updateSystemClinics`  
**Args**: `{}`  
**Cosa fa**: Imposta isSystem: true per HQ e LABORATORIO

#### 2.5 Rimozione clinicId da Categorie
**Funzione**: `migrations:removeCategoryClinicId`  
**Args**: `{}`  
**Cosa fa**: Rimuove campo clinicId da tutte le categorie

#### 2.6 Rimozione clinicId da Attributi Categoria
**Funzione**: `migrations:removeCategoryAttributeClinicId`  
**Args**: `{}`  
**Cosa fa**: Rimuove campo clinicId da tutti gli attributi categoria

---

### 🔧 OPZIONALI (esegui solo se necessario):

#### 2.7 Pulizia Duplicati Cliniche
**Funzione**: `migrations:cleanDuplicateClinics`  
**Args**: `{}`  
**Quando**: Solo se hai duplicati HQ/LABORATORIO

#### 2.8 Riattiva Cliniche Sistema
**Funzione**: `migrations:reactivateSystemClinics`  
**Args**: `{}`  
**Quando**: Solo se HQ/LABORATORIO sono disattivate

#### 2.9 Reset Sync Timestamp
**Funzione**: `migrations:resetUserSyncTimestamps`  
**Args**: `{}`  
**Quando**: Solo per forzare re-sync da PrimoUp

---

## 📋 FASE 3: Verifica Post-Migration

### 3.1 Verifica nel Convex Dashboard (tab Data):

✅ **ticketStatuses** → Deve avere 3 record (open, in_progress, closed)  
✅ **tickets** → Tutti i ticket devono avere `priority` come numero (non stringa)  
✅ **userClinics** → Ogni utente deve avere almeno 1 clinica  
✅ **clinics** → HQ e LABORATORIO devono avere `isSystem: true`  
✅ **categories** → NON devono avere il campo `clinicId`  
✅ **categoryAttributes** → NON devono avere il campo `clinicId`

### 3.2 Test rapido sul sito:

1. **Login** → Deve funzionare senza errori
2. **Crea ticket** → Deve mostrare dropdown cliniche
3. **Apri ticket** → Deve mostrare fiamme priorità
4. **Trigger** → Deve mostrare opzioni priorità

---

## 📋 FASE 4: Push su Git e Deploy Vercel

### 4.1 Comandi Git (da staging a main)

```bash
# 1. Assicurati di essere su staging
git branch

# 2. Controlla lo stato
git status

# 3. Se ci sono modifiche non committate, falle
git add .
git commit -m "feat: sistema priorità, stati ticket dinamici, cliniche multi-utente"

# 4. Push staging
git push origin staging

# 5. Switch su main
git checkout main

# 6. Pull ultimo main
git pull origin main

# 7. Merge staging in main (SQUASH per storia pulita)
git merge --squash staging

# 8. Commit del merge
git commit -m "feat: priorità ticket, stati dinamici, cliniche multi-utente e trigger avanzati

- Sistema priorità 1-5 con fiamme nei ticket
- Stati ticket dinamici da tabella ticketStatuses
- Cliniche multi-utente con userClinics
- Rimozione clinicId da categorie (ora usano societyIds)
- Trigger con supporto priorità (eq, gte, lte)
- Ordinamento automatico per priorità in tutte le liste
- Migration per conversione dati esistenti"

# 9. Push su main
git push origin main
```

### 4.2 Vercel Deploy

Vercel si aggiorna **automaticamente** dopo il push su `main`.

Monitora su: https://vercel.com/primocaredent/abaddon-project

---

## ⚠️ ROLLBACK (in caso di problemi)

### Se qualcosa va storto:

1. **Convex**: Non c'è rollback, ma le migration sono idempotenti (puoi rieseguirle)
2. **Git**: Fai revert del commit su main
   ```bash
   git revert HEAD
   git push origin main
   ```
3. **Vercel**: Deploy automatico della versione reversa

---

## 📞 Checklist Finale

Prima di dichiarare il deploy completato:

- [ ] Tutte le 6 migration obbligatorie eseguite con successo
- [ ] Nessun errore nella console Convex Dashboard
- [ ] Login funzionante su produzione
- [ ] Creazione ticket funzionante con dropdown cliniche
- [ ] Priorità visibile con fiamme
- [ ] Stati ticket visibili correttamente
- [ ] Trigger configurabili con priorità
- [ ] Nessun errore nella console browser (tranne quelli delle estensioni)

---

## 🎉 Deploy Completato!

Se tutti i check sono OK, il deploy è completato con successo! 🚀

