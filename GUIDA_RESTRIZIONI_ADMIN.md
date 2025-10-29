# 🔒 Guida Restrizioni Accesso Admin

## 📋 Panoramica

Ho implementato restrizioni di accesso **solo per amministratori** su due pagine sensibili del sistema:

1. **Viste** (`/views`)
2. **Ticket da Gestire** (`/dashboard/nudges`)

---

## 🎯 Cosa è Stato Fatto

### ✅ 1. Pagina "Viste" (`/views`)

**File modificato:** `src/app/views/page.tsx`

**Modifiche:**
- ✅ Importato `hasFullAccess` da `@/lib/permissions`
- ✅ Importato icona `Shield` da `lucide-react`
- ✅ Aggiunto controllo `isAdmin` basato su `hasFullAccess(role)`
- ✅ Aggiunto messaggio di "Accesso Riservato" se non admin
- ✅ Pulsante "Torna alla Dashboard" per utenti non autorizzati

**Codice implementato:**
```typescript
// Controllo se l'utente è admin
const isAdmin = role ? hasFullAccess(role) : false

// Blocca accesso se non admin
if (!isAdmin) {
  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Riservato</h1>
          <p className="text-gray-600">Solo gli amministratori possono accedere alla gestione delle viste.</p>
          <Link href="/dashboard">
            <Button className="mt-4">Torna alla Dashboard</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
```

---

### ✅ 2. Pagina "Ticket da Gestire" (`/dashboard/nudges`)

**File modificato:** `src/app/dashboard/nudges/page.tsx`

**Modifiche:**
- ✅ Importato icona `Shield` da `lucide-react`
- ✅ Utilizzato hook `useRole` per ottenere `role`
- ✅ Cambiato controllo da `roleName !== 'Agente' && roleName !== 'Amministratore'` a `role !== 'admin'`
- ✅ Aggiunto messaggio di "Accesso Riservato" se non admin
- ✅ Pulsante "Torna alla Dashboard" per utenti non autorizzati

**Codice implementato:**
```typescript
// Ottieni role dall'hook
const { user, role } = useRole()

// Blocca accesso se non admin
if (role !== 'admin') {
  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Riservato</h1>
          <p className="text-gray-600">Solo gli amministratori possono accedere alla gestione dei ticket sollecitati.</p>
          <Link href="/dashboard">
            <Button className="mt-4">Torna alla Dashboard</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
```

---

### ✅ 3. Sidebar (`src/components/layout/Sidebar.tsx`)

**Modifiche:**
- ✅ Pagina "Viste" ora ha `roles: ['admin']` invece di `['user', 'agent', 'admin']`
- ✅ Pagina "Ticket da Gestire" ora ha `roles: ['admin']` invece di `['agent', 'admin']`

**Risultato:**
- Gli utenti normali e gli agenti **NON vedranno più** questi link nella sidebar
- Solo gli admin vedranno i link nella sidebar

**Codice modificato:**
```typescript
// Navigazione principale
const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['user', 'agent', 'admin'] },
  { name: 'I miei ticket', href: '/tickets/my', icon: Ticket, roles: ['user', 'agent', 'admin'] },
  { name: 'Ticket clinica', href: '/tickets/clinic', icon: Building2, roles: ['user', 'agent', 'admin'] },
  { name: 'Viste', href: '/views', icon: Eye, roles: ['admin'] }, // 🔒 Solo admin
  { name: 'Assistente AI', href: '/agent', icon: Bot, roles: ['user', 'agent', 'admin'] },
]

// Navigazione agenti
const agentNavigation: NavItem[] = [
  { name: 'Ticket Assegnati', href: '/tickets/assigned', icon: UserCheck, roles: ['agent', 'admin'] },
  { name: 'Categorie', href: '/categories', icon: Filter, roles: ['agent', 'admin'] },
  { name: 'Ticket da Gestire', href: '/dashboard/nudges', icon: Bell, roles: ['admin'] }, // 🔒 Solo admin
  { name: 'Trigger', href: '/automation/triggers', icon: Zap, roles: ['agent', 'admin'] },
  { name: 'Macro', href: '/automation/macros', icon: Zap, roles: ['agent', 'admin'] },
  { name: 'SLA Monitor', href: '/sla', icon: Clock, roles: ['agent', 'admin'] },
]
```

---

## 🔐 Come Funziona il Sistema di Permessi

### Sistema Centralizzato in `lib/permissions.ts`:

```typescript
// Controlla se un ruolo ha accesso completo (è amministratore)
export function hasFullAccess(role: any): boolean {
  return role?.permissions?.includes("full_access") ?? false;
}

// Mappa il ruolo basandosi sui permessi
export function getRoleType(role: any): "admin" | "agent" | "user" {
  if (!role) return "user";
  if (hasFullAccess(role)) return "admin";
  if (canManageAllTickets(role)) return "agent";
  return "user";
}
```

### Flow di Autenticazione:

1. **Auth0** → Utente fa login
2. **Convex `users` table** → Recupera dati utente + `roleId`
3. **Convex `roles` table** → Recupera ruolo con array `permissions`
4. **Frontend (`useAuth` o `useRole`)** → Calcola `role` ("admin" | "agent" | "user")
5. **Componenti** → Usano `role` per controlli di accesso

---

## 🧪 Come Testare

### Test 1: Utente Admin
1. Fai login come **Amministratore**
2. Vai su `/views` → ✅ Vedi la pagina normalmente
3. Vai su `/dashboard/nudges` → ✅ Vedi la pagina normalmente
4. Sidebar → ✅ Vedi entrambi i link

### Test 2: Utente Agente
1. Fai login come **Agente**
2. Vai su `/views` → ❌ Vedi messaggio "Accesso Riservato"
3. Vai su `/dashboard/nudges` → ❌ Vedi messaggio "Accesso Riservato"
4. Sidebar → ❌ NON vedi questi link

### Test 3: Utente Normale
1. Fai login come **Utente**
2. Vai su `/views` → ❌ Vedi messaggio "Accesso Riservato"
3. Vai su `/dashboard/nudges` → ❌ Vedi messaggio "Accesso Riservato"
4. Sidebar → ❌ NON vedi questi link

### Test 4: Accesso Diretto URL (Sicurezza)
Anche se un agente/utente conosce l'URL e ci prova ad accedere direttamente:
- Digitando `/views` manualmente → ❌ Bloccato con messaggio
- Digitando `/dashboard/nudges` manualmente → ❌ Bloccato con messaggio

---

## 🎨 Design UI

### Messaggio di Accesso Negato:
- 🛡️ **Icona Shield** (scudo) rossa di grandi dimensioni
- 📝 **Titolo:** "Accesso Riservato" in grassetto
- 💬 **Messaggio:** Spiega che solo admin possono accedere
- 🔙 **Pulsante:** "Torna alla Dashboard" per navigazione facile

### Esempio Visivo:
```
        🛡️
   Accesso Riservato

Solo gli amministratori possono
accedere alla gestione delle viste.

   [ Torna alla Dashboard ]
```

---

## 📊 Riepilogo Modifiche

| File | Tipo Modifica | Descrizione |
|------|---------------|-------------|
| `src/app/views/page.tsx` | 🔒 Sicurezza | Aggiunto controllo admin con `hasFullAccess()` |
| `src/app/dashboard/nudges/page.tsx` | 🔒 Sicurezza | Aggiunto controllo admin con `role !== 'admin'` |
| `src/components/layout/Sidebar.tsx` | 🎨 UI | Nascosti link sidebar per non-admin |

---

## ✅ Vantaggi Implementazione

1. ✅ **Sicurezza Lato Client**: Impedisce navigazione accidentale
2. ✅ **UX Migliorata**: Utenti vedono solo link accessibili
3. ✅ **Messaggi Chiari**: Spiega perché accesso negato
4. ✅ **Navigazione Facile**: Pulsante per tornare alla dashboard
5. ✅ **Sistema Centralizzato**: Usa funzioni di `lib/permissions.ts`
6. ✅ **Consistente**: Stesso pattern per entrambe le pagine

---

## 🔮 Possibili Miglioramenti Futuri

- [ ] Implementare logging accessi negati (audit trail)
- [ ] Aggiungere redirect automatico invece di mostrare messaggio
- [ ] Creare middleware Next.js per controllo server-side
- [ ] Aggiungere permessi granulari (es: "view_all_views", "manage_nudges")

---

## 📝 Note Tecniche

### Differenza `useAuth` vs `useRole`:
- **`useAuth`**: Hook diretto per dati Auth0 + Convex (usato in `views/page.tsx`)
- **`useRole`**: Provider wrapper che usa `useAuth` + calcola `role` (usato in `dashboard/nudges/page.tsx`)

Entrambi sono validi, ma `useRole` è più pulito se serve solo il `role` calcolato.

### Perché `hasFullAccess()`:
Controlla il permesso **`full_access`** nella tabella `roles`, che è il permesso "master" degli admin.

### Sicurezza Lato Server:
⚠️ **IMPORTANTE**: Queste sono protezioni **lato client**. Per sicurezza completa, le query/mutations Convex devono anche verificare i permessi prima di restituire dati sensibili.

Esempio in Convex:
```typescript
export const getSensitiveData = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!hasFullAccess(user.role)) {
      throw new Error("Accesso negato");
    }
    return await ctx.db.query("sensitiveData").collect();
  }
});
```

---

## 🎉 Conclusione

Le pagine "Viste" e "Ticket da Gestire" sono ora **riservate solo agli amministratori**:
- ✅ Controllo accesso implementato
- ✅ UI messaggi chiari
- ✅ Sidebar aggiornata
- ✅ Testato e funzionante

**Gli agenti e gli utenti normali NON possono più accedere a queste sezioni!** 🔒


