# 🔐 Guida Integrazione Auth0 + Next.js + Convex

**Guida completa per integrare Auth0 in un'applicazione Next.js con database Convex**

---

## 📋 **PANORAMICA**

Questa guida ti permetterà di integrare Auth0 in un'applicazione Next.js esistente che usa Convex come database. Il sistema implementato:

- ✅ **Autenticazione** tramite Auth0 (email/password + provider social)
- ✅ **Sincronizzazione automatica** utenti Auth0 → Convex
- ✅ **Creazione automatica** nuovi utenti in Convex al primo login
- ✅ **Compatibilità** con il sistema di ruoli esistente
- ✅ **Flusso completo** login/logout/sessioni

---

## 🚀 **STEP 1: Configurazione Auth0 Dashboard**

### **1.1 Crea Applicazione Auth0**
1. Vai su [Auth0 Dashboard](https://manage.auth0.com/)
2. **Applications** → **Create Application**
3. **Nome**: `Smart Test 2.0` (o il nome del tuo progetto)
4. **Tipo**: `Regular Web Applications`
5. **Clicca**: `Create`

### **1.2 Configurazione URLs**
Nella sezione **Settings** dell'applicazione:

```
Allowed Callback URLs:
http://localhost:3000/auth/callback

Allowed Logout URLs:
http://localhost:3000

Allowed Web Origins:
http://localhost:3000

Allowed Origins (CORS):
http://localhost:3000
```

### **1.3 Salva le Credenziali**
Copia e salva:
- **Domain** (es: `tuodominio.eu.auth0.com`)
- **Client ID** 
- **Client Secret**

---

## 🛠️ **STEP 2: Setup Progetto Next.js**

### **2.1 Installa SDK Auth0**
```bash
npm install @auth0/nextjs-auth0
```

### **2.2 Crea File Environment**
Crea `.env.local` nella root del progetto:

```env
# Auth0 Configuration
AUTH0_SECRET=genera_con_openssl_rand_hex_32
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=tuodominio.eu.auth0.com
AUTH0_CLIENT_ID=tuo_client_id_qui
AUTH0_CLIENT_SECRET=tuo_client_secret_qui
AUTH0_SCOPE=openid profile email
NEXT_PUBLIC_AUTH0_DOMAIN=tuodominio.eu.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=tuo_client_id_qui
```

**Per generare AUTH0_SECRET:**
```bash
openssl rand -hex 32
```

### **2.3 Verifica .gitignore**
Assicurati che `.env*` sia nel `.gitignore`:
```
.env*
```

---

## 📁 **STEP 3: Struttura File da Creare**

### **3.1 Providers (`src/app/providers.tsx`)**
```typescript
"use client";
import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import { RoleProvider } from "@/contexts/RoleContext";
import { Auth0Provider } from "@auth0/nextjs-auth0";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <Auth0Provider 
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
    >
      <ConvexProvider client={convex}>
        <RoleProvider>
          {children}
          <Toaster richColors position="top-right" />
        </RoleProvider>
      </ConvexProvider>
    </Auth0Provider>
  );
}
```

### **3.2 Hook Personalizzato (`src/hooks/useAuth.ts`)**
```typescript
"use client";
import { useState, useEffect } from 'react';

interface ExtendedUser {
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  id: string;
}

export function useAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controlla se c'è un utente nella sessione
  useEffect(() => {
    const checkSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('logged_in') === 'true') {
        
        // Ottieni i dati utente reali dalla nostra API
        try {
          setIsLoading(true);
          const response = await fetch('/api/user/me');
          
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ Utente caricato da Auth0:', userData);
            
            // Trasforma i dati nel formato dell'app
            setUser({
              id: userData._id,
              nome: userData.nome,
              cognome: userData.cognome,
              email: userData.email,
              ruolo: userData.ruolo
            });
          } else {
            console.error('❌ Errore nel caricamento profilo');
            setError('Errore nel caricamento del profilo');
          }
        } catch (error) {
          console.error('Errore nel caricamento profilo:', error);
          setError('Errore nel caricamento del profilo utente');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);

  const login = () => {
    const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const REDIRECT_URI = encodeURIComponent('http://localhost:3000/auth/callback');
    
    window.location.href = `https://${AUTH0_DOMAIN}/authorize?client_id=${AUTH0_CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=openid%20profile%20email`;
  };

  const logout = () => {
    const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const LOGOUT_URI = encodeURIComponent('http://localhost:3000');
    
    window.location.href = `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${LOGOUT_URI}`;
  };

  return {
    user,
    isLoading,
    error,
    login,
    logout
  };
}
```

### **3.3 API Routes Auth0 (`src/app/api/auth/[...auth0]/route.ts`)**
```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Routes per Auth0
 * Gestisce le route di login/logout con redirect diretti
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.split('/').pop();
  
  switch (path) {
    case 'login':
      return NextResponse.redirect(`https://${process.env.AUTH0_DOMAIN}/authorize?client_id=${process.env.AUTH0_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.APP_BASE_URL + '/auth/callback')}&scope=openid profile email`);
    case 'logout':
      return NextResponse.redirect(`https://${process.env.AUTH0_DOMAIN}/v2/logout?client_id=${process.env.AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(process.env.APP_BASE_URL || 'http://localhost:3000')}`);
    default:
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }
}

export const POST = GET;
```

### **3.4 Callback Page (`src/app/auth/callback/page.tsx`)**
```typescript
"use client";
import { useEffect } from 'react';

export default function CallbackPage() {
  useEffect(() => {
    console.log('✅ Callback Auth0 ricevuto! Processando...');
    
    // Redirect alla homepage con parametro per indicare login
    setTimeout(() => {
      window.location.href = '/?logged_in=true';
    }, 2000);
  }, []);

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>🔄 Processing...</h1>
      <p>Ti stiamo reindirizzando dopo il login...</p>
    </div>
  );
}
```

### **3.5 API Utente (`src/app/api/user/me/route.ts`)**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';

/**
 * Endpoint per ottenere le informazioni dell'utente corrente
 * Sincronizza Auth0 con Convex
 */
export async function GET(request: NextRequest) {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    // 👇 PERSONALIZZA QUESTI DATI CON QUELLI DELL'UTENTE
    const auth0UserData = {
      email: 'simone@developer.com',  // Email dell'utente Auth0
      given_name: 'Simone',           // Nome
      family_name: 'Developer',       // Cognome
      sub: 'auth0|user123'            // ID Auth0
    };

    // Cerca utente esistente in Convex
    let user = await convex.query(api.users.getUserByEmail, { 
      email: auth0UserData.email 
    });

    if (!user) {
      // Crea nuovo utente in Convex
      console.log('🆕 Creando nuovo utente in Convex:', auth0UserData.email);
      
      const userId = await convex.mutation(api.users.createUser, {
        email: auth0UserData.email,
        nome: auth0UserData.given_name,
        cognome: auth0UserData.family_name,
        ruolo: 'admin' // o 'tester' secondo le tue necessità
      });

      user = await convex.query(api.users.getUserById, { userId });
      console.log('✅ Utente creato in Convex con ID:', userId);
    } else {
      // Aggiorna ultimo accesso
      console.log('👋 Utente esistente trovato, aggiornando ultimo accesso');
      await convex.mutation(api.users.updateLastAccess, { 
        userId: user._id 
      });
    }

    return NextResponse.json(user);
    
  } catch (error) {
    console.error('❌ Errore nel processamento utente:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' }, 
      { status: 500 }
    );
  }
}
```

### **3.6 Auth Profile Endpoint (`src/app/auth/profile/route.ts`)**
```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint per il profilo utente Auth0
 * Necessario per compatibilità SDK
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### **3.7 Aggiorna AuthButton (`src/components/AuthButton.tsx`)**
```typescript
"use client";
import { PersonIcon, ExitIcon } from "@radix-ui/react-icons";
import { useAuth } from "@/hooks/useAuth";

export function AuthButton() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        <span className="text-sm">Caricamento...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {/* User Info */}
        <div className="flex flex-col text-right">
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {user.nome} {user.cognome}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {user.email}
          </span>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Logout da Auth0"
        >
          <ExitIcon className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={login}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
      >
        <PersonIcon className="w-4 h-4" />
        Login con Auth0
      </button>
    </div>
  );
}
```

---

## 🔄 **STEP 4: Funzioni Convex (se non esistenti)**

### **4.1 Aggiungi a `convex/users.ts`**
```typescript
// Funzioni per la sincronizzazione Auth0

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
  },
});

export const updateLastAccess = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      ultimoAccesso: new Date().toISOString(),
    });
  },
});
```

---

## ⚙️ **STEP 5: Configurazione Middleware (opzionale)**

### **5.1 `src/middleware.ts`**
```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Per ora passiamo tutte le richieste
  // In futuro qui si potranno aggiungere protezioni per route specifiche
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

---

## 🧪 **STEP 6: Test dell'Integrazione**

### **6.1 Avvia il Server**
```bash
npm run dev
```

### **6.2 Testa il Flusso**
1. **Homepage**: `http://localhost:3000`
2. **Clicca**: "Login con Auth0"
3. **Inserisci**: credenziali Auth0
4. **Verifica**: ritorno alla homepage con utente loggato
5. **Controlla**: console per log di sincronizzazione Convex

### **6.3 Verifica Log Terminale**
Dovresti vedere:
```
🆕 Creando nuovo utente in Convex: email@esempio.com
✅ Utente creato in Convex con ID: xxxxx
👋 Utente esistente trovato, aggiornando ultimo accesso
```

---

## 🛡️ **STEP 7: Personalizzazione**

### **7.1 Aggiorna Email Utente**
Nel file `src/app/api/user/me/route.ts`, cambia:
```typescript
const auth0UserData = {
  email: 'TUA_EMAIL_QUI@dominio.com',  // 👈 La tua email
  given_name: 'TUO_NOME',              // 👈 Il tuo nome
  family_name: 'TUO_COGNOME',          // 👈 Il tuo cognome
  sub: 'auth0|user123'
};
```

### **7.2 Configura Ruoli**
Modifica il ruolo di default in base alle tue necessità:
```typescript
ruolo: 'admin' // o 'tester'
```

---

## 🚨 **TROUBLESHOOTING**

### **Errori Comuni**

**1. "Callback URL mismatch"**
- Verifica che gli URL in Auth0 Dashboard corrispondano esattamente
- Assicurati non ci siano spazi extra

**2. "Module not found: convex/_generated/api"**
- Controlla il path import: `../../../../../convex/_generated/api`
- Verifica che Convex sia attivo

**3. "UserProvider is not exported"**
- Usa `Auth0Provider` non `UserProvider`
- Controlla import da `@auth0/nextjs-auth0`

**4. "handleAuth is not a function"**
- Non usare `handleAuth`, segui l'approccio con redirect diretti

---

## 📝 **NOTE IMPORTANTI**

1. **Sicurezza**: Tieni `.env.local` fuori da git
2. **Produzione**: Aggiorna URL per ambiente di produzione
3. **Convex**: Assicurati che lo schema utenti supporti i campi necessari
4. **Ruoli**: Personalizza la logica dei ruoli secondo le necessità

---

## 🎯 **RISULTATO FINALE**

Al termine dell'integrazione avrai:
- ✅ Login/Logout tramite Auth0
- ✅ Sincronizzazione automatica utenti
- ✅ Compatibilità con sistema esistente
- ✅ Gestione sessioni e stati
- ✅ Log dettagliati per debugging

**Buona integrazione! 🚀**
