# 📝 Guida: Usare Mutation "WithAuth" correttamente

## ⚠️ Problema Comune

Le mutation Convex che terminano con `WithAuth` (es. `createWithAuth`, `updateWithAuth`) richiedono **SEMPRE** il campo `userEmail`.

### Errore Tipico
```
ArgumentValidationError: Object is missing the required field `userEmail`
```

## ✅ Soluzione Standard

### 1. Ottenere l'Email dell'Utente

All'inizio del componente:

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/providers/RoleProvider';

export default function MyComponent() {
  const { user } = useRole();
  const { user: authUser } = useAuth();
  
  // Ottieni email con fallback
  const currentUserEmail = authUser?.email || user?.email;
  
  // ... resto del codice
}
```

### 2. Validare Prima dell'Invio

Nelle funzioni di submit:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // ⭐ VALIDAZIONE OBBLIGATORIA
  if (!currentUserEmail) {
    alert('Errore: Utente non autenticato. Ricarica la pagina e riprova.');
    return;
  }
  
  // ... resto validazioni
}
```

### 3. Passare userEmail alla Mutation

```typescript
// ❌ SBAGLIATO - Manca userEmail
await createTicket({
  title: formData.title,
  description: formData.description,
  categoryId: formData.category,
});

// ✅ CORRETTO - Include userEmail
await createTicket({
  title: formData.title,
  description: formData.description,
  categoryId: formData.category,
  userEmail: currentUserEmail,  // ⭐ CAMPO OBBLIGATORIO
});
```

## 📋 Checklist Pre-Invio

Quando usi una mutation `*WithAuth`:

- [ ] Ho ottenuto `currentUserEmail` da useAuth/useRole?
- [ ] Ho validato che `currentUserEmail` non sia `null`/`undefined`?
- [ ] Ho passato `userEmail` alla mutation?
- [ ] Ho gestito gli errori in caso di autenticazione fallita?

## 🔍 Mutation che Richiedono userEmail

### Tickets
- `api.tickets.createWithAuth`
- `api.tickets.updateWithAuth`
- `api.tickets.getMyCreatedWithAuth`
- `api.tickets.getMyAssignedTicketsWithAuth`
- `api.tickets.getMyClinicTicketsWithAuth`

### Triggers
- `api.triggers.createTriggerSimple`
- `api.triggers.updateTriggerSimple`

### Users
- `api.users.getAvailableAgents`

## 💡 Esempio Completo

```typescript
'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/providers/RoleProvider';

export default function CreateTicketForm() {
  const { user } = useRole();
  const { user: authUser } = useAuth();
  const createTicket = useMutation(api.tickets.createWithAuth);
  
  // 1️⃣ Ottieni email utente
  const currentUserEmail = authUser?.email || user?.email;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 2️⃣ Valida autenticazione
    if (!currentUserEmail) {
      alert('Errore: Utente non autenticato.');
      return;
    }
    
    try {
      // 3️⃣ Chiama mutation con userEmail
      const result = await createTicket({
        title: formData.title,
        description: formData.description,
        categoryId: formData.categoryId,
        userEmail: currentUserEmail, // ⭐ Campo obbligatorio
      });
      
      console.log('✅ Ticket creato:', result);
    } catch (error) {
      console.error('❌ Errore:', error);
      alert('Errore durante la creazione: ' + error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields ... */}
    </form>
  );
}
```

## 🚨 Cosa NON Fare

```typescript
// ❌ SBAGLIATO 1: Non validare l'autenticazione
await createTicket({
  title: formData.title,
  userEmail: authUser?.email, // Potrebbe essere undefined!
});

// ❌ SBAGLIATO 2: Hardcodare l'email
await createTicket({
  title: formData.title,
  userEmail: 'utente@esempio.it', // MAI hardcodare!
});

// ❌ SBAGLIATO 3: Dimenticare userEmail
await createTicket({
  title: formData.title,
  // userEmail mancante!
});
```

## 🔄 Refactoring Futuro (Opzionale)

Per evitare di passare `userEmail` manualmente ogni volta, si potrebbe:

1. **Modificare le mutation** per usare `ctx.auth.getUserIdentity()` invece di `userEmail`
2. **Creare wrapper hooks** che aggiungono automaticamente `userEmail`
3. **Usare middleware Convex** per iniettare l'utente corrente

### Esempio Wrapper Hook

```typescript
// hooks/useMutationWithAuth.ts
export function useMutationWithAuth<T>(mutation: any) {
  const { user } = useAuth();
  const baseMutation = useMutation(mutation);
  
  return async (args: T) => {
    if (!user?.email) {
      throw new Error('Utente non autenticato');
    }
    return baseMutation({ ...args, userEmail: user.email });
  };
}

// Uso
const createTicket = useMutationWithAuth(api.tickets.createWithAuth);
await createTicket({ title, description }); // userEmail aggiunto automaticamente
```

## 📚 Risorse

- [Documentazione Convex Auth](https://docs.convex.dev/auth)
- [File: /convex/tickets.ts](./convex/tickets.ts)
- [Hook useAuth: /src/hooks/useAuth.ts](./src/hooks/useAuth.ts)


