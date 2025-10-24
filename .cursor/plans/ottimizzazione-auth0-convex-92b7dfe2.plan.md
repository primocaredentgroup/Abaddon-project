<!-- 92b7dfe2-e6dd-488b-807a-5fa31b67bf00 42dc1354-8ac0-48ad-a5ec-a09a8487f8dd -->
# Piano Ottimizzazione Autenticazione Auth0 + Convex

## Problemi Attuali Identificati

1. **Hook useAuth complesso e inefficiente**: Esegue 3 chiamate Convex separate (syncUserFromAuth0, getUserByEmail, getUserById) creando cascate di query che rallentano il caricamento
2. **Funzione syncUserFromAuth0 sbagliata**: Non crea utenti nuovi, causando blocchi al primo login
3. **Non sfrutta ConvexProviderWithAuth0**: La documentazione ufficiale raccomanda l'uso di `useConvexAuth()` invece di `useAuth0()` direttamente
4. **Cache non ottimizzata**: Query multiple impediscono a Convex di sfruttare la sua cache reattiva automatica
5. **Configurazione auth.config.ts non conforme**: Manca il type `AuthConfig` come da documentazione

## Modifiche da Implementare

### 1. Aggiornare convex/auth.config.ts

Aggiungere il type `AuthConfig` come da documentazione ufficiale:

```typescript
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN!,
      applicationID: process.env.AUTH0_CLIENT_ID!,
    },
  ],
} satisfies AuthConfig;
```

### 2. Creare nuova query unificata in convex/auth.ts

Sostituire le 3 query separate con una singola query ottimizzata che gestisce tutto:

```typescript
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.string(),
      auth0Id: v.string(),
      clinicId: v.id("clinics"),
      roleId: v.id("roles"),
      isActive: v.boolean(),
      lastLoginAt: v.optional(v.number()),
      categoryCompetencies: v.optional(v.array(v.id("categories"))),
      preferences: v.object({
        notifications: v.object({
          email: v.boolean(),
          push: v.boolean(),
        }),
        dashboard: v.object({
          defaultView: v.string(),
          itemsPerPage: v.number(),
        }),
      }),
      clinic: v.optional(v.object({
        _id: v.id("clinics"),
        name: v.string(),
        code: v.string(),
      })),
      role: v.optional(v.object({
        _id: v.id("roles"),
        name: v.string(),
        permissions: v.array(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Ottiene o crea l'utente in un'unica transazione
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth0", (q) => q.eq("auth0Id", identity.subject))
      .unique();

    if (!user) {
      // Crea automaticamente l'utente se non esiste
      const userId = await ctx.runMutation(internal.auth.createUserFromIdentity, {
        auth0Id: identity.subject,
        email: identity.email!,
        name: identity.name || identity.email!.split("@")[0],
      });
      
      const newUser = await ctx.db.get(userId);
      if (!newUser) return null;
      
      // Popola dati
      const [clinic, role] = await Promise.all([
        ctx.db.get(newUser.clinicId),
        ctx.db.get(newUser.roleId)
      ]);
      
      return { ...newUser, clinic, role };
    }

    // Aggiorna ultimo accesso
    await ctx.db.patch(user._id, { lastLoginAt: Date.now() });

    // Popola i dati in parallelo
    const [clinic, role] = await Promise.all([
      ctx.db.get(user.clinicId),
      ctx.db.get(user.roleId)
    ]);

    return {
      ...user,
      clinic,
      role,
    };
  },
});
```

### 3. Creare mutation interna per creazione utente

Aggiungere in `convex/auth.ts`:

```typescript
export const createUserFromIdentity = internalMutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    name: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, { auth0Id, email, name }) => {
    // Verifica clinica di default
    const defaultClinic = await ctx.db
      .query("clinics")
      .withIndex("by_code", (q) => q.eq("code", "DEMO001"))
      .unique();
    
    if (!defaultClinic) {
      throw new ConvexError("No default clinic found");
    }
    
    // Ottieni ruolo utente di default
    const userRole = await ctx.db
      .query("roles")
      .withIndex("by_system", (q) => q.eq("isSystem", true))
      .filter((q) => q.eq(q.field("name"), "Utente"))
      .unique();
    
    if (!userRole) {
      throw new ConvexError("Default user role not found");
    }
    
    // Crea utente
    const userId = await ctx.db.insert("users", {
      email,
      name,
      auth0Id,
      clinicId: defaultClinic._id,
      roleId: userRole._id,
      isActive: true,
      lastLoginAt: Date.now(),
      preferences: {
        notifications: {
          email: true,
          push: true,
        },
        dashboard: {
          defaultView: "my-tickets",
          itemsPerPage: 25,
        },
      },
    });
    
    // Assegnazione automatica società
    await autoAssignSocietyByEmail(ctx, userId, email);
    
    return userId;
  },
});
```

### 4. Refactoring completo di src/hooks/useAuth.ts

Semplificare drasticamente usando solo `useConvexAuth()` e una singola query:

```typescript
"use client";
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface ExtendedUser {
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  roleName?: string;
  id: string;
  clinicId?: string;
  clinic?: {
    name: string;
  };
  role?: {
    name: string;
    permissions?: string[];
  };
}

export function useAuth() {
  const { loginWithRedirect, logout: auth0Logout } = useAuth0();
  const { isLoading, isAuthenticated } = useConvexAuth();
  
  // Una singola query che gestisce tutto
  const convexUser = useQuery(
    api.auth.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const user: ExtendedUser | null = convexUser ? {
    id: convexUser._id,
    nome: convexUser.name.split(' ')[0] || 'Utente',
    cognome: convexUser.name.split(' ').slice(1).join(' ') || '',
    email: convexUser.email,
    ruolo: convexUser.role?.name || 'user',
    roleName: convexUser.role?.name,
    clinicId: convexUser.clinicId,
    clinic: convexUser.clinic,
    role: convexUser.role,
  } : null;

  const login = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname }
    });
  };

  const logout = () => {
    auth0Logout({ 
      logoutParams: { 
        returnTo: window.location.origin 
      }
    });
  };

  return {
    user,
    isLoading: isLoading || (isAuthenticated && !convexUser),
    error: null,
    login,
    logout,
    refreshUser: () => {}, // Non necessario con cache reattiva Convex
  };
}
```

### 5. Aggiornare src/app/page.tsx

Usare correttamente `useConvexAuth()` come da documentazione:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useConvexAuth } from 'convex/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LogIn } from 'lucide-react'
import { useEffect } from 'react'

export default function Home() {
  const { user, isLoading: userLoading, login } = useAuth()
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth()
  const router = useRouter()

  // Redirect quando autenticato e dati caricati
  useEffect(() => {
    if (isAuthenticated && user && !convexAuthLoading && !userLoading) {
      if (user.roleName === 'Agente') {
        router.replace('/tickets/assigned')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [isAuthenticated, user, convexAuthLoading, userLoading, router])

  // Loading durante autenticazione
  if (convexAuthLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">
            {convexAuthLoading ? 'Autenticazione in corso...' : 'Caricamento profilo...'}
          </p>
        </div>
      </div>
    )
  }

  // Login page
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">HealthDesk</CardTitle>
          <CardDescription className="text-lg text-gray-600">
            Sistema di gestione ticket per cliniche sanitarie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Button 
              onClick={login}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
            >
              <LogIn className="w-5 h-5 mr-3" />
              Accedi con Auth0
            </Button>
          </div>
          
          <div className="text-center text-sm text-gray-500">
            <p>Accedi con il tuo account Auth0 per iniziare</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 6. Aggiornare imports in convex/auth.ts

Aggiungere gli import necessari all'inizio del file:

```typescript
import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import { ConvexError } from "convex/values"
import { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
```

### 7. Rimuovere funzioni obsolete (opzionale)

Dopo aver testato, considerare la rimozione di:

- `syncUserFromAuth0` da `convex/users.ts` (non più usata)
- `getUserByEmail` query se usata solo per auth (mantenerla se usata altrove)

## Vantaggi della Soluzione

1. **Performance drammaticamente migliorate**: Da 3 query a 1 sola query ottimizzata
2. **Cache reattiva Convex**: Query unificata permette a Convex di cachare automaticamente i risultati
3. **Creazione automatica utenti**: Primo login funziona subito senza intervento admin
4. **Codice più semplice**: Hook `useAuth` ridotto da 116 a ~60 righe
5. **Conforme alla documentazione ufficiale**: Usa `useConvexAuth()` come raccomandato
6. **Atomicità migliorata**: Operazioni di lettura/scrittura in singola transazione
7. **Meno race conditions**: Eliminata la cascata di query dipendenti

## Note Importanti

- La funzione `getCurrentUser` usa `ctx.runMutation` per creare utenti, quindi è ancora una query reattiva ma può triggerare mutations interne
- La cache di Convex invalida automaticamente quando i dati cambiano (push-based, non polling)
- Il sistema mantiene la compatibilità con l'assegnazione automatica delle società via email domain

### To-dos

- [ ] Aggiornare convex/auth.config.ts con type AuthConfig
- [ ] Creare getCurrentUser query unificata in convex/auth.ts
- [ ] Creare createUserFromIdentity internal mutation in convex/auth.ts
- [ ] Semplificare src/hooks/useAuth.ts usando singola query
- [ ] Aggiornare src/app/page.tsx per usare correttamente useConvexAuth
- [ ] Testare flusso completo di login/logout e creazione automatica utenti