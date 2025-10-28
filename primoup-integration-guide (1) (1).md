# Guida Completa all'Integrazione PrimoUp per Applicativi Convex

Questa guida fornisce tutti i file e le modifiche necessarie per implementare l'integrazione PrimoUp in qualsiasi applicativo Convex con autenticazione Auth0.

## 🎯 Panoramica

L'integrazione PrimoUp implementa un'architettura BFE (Backend-for-Frontend) che:

- Gestisce automaticamente i token di autenticazione PrimoUp
- Fornisce refresh automatico dei token scaduti
- Mantiene le credenziali sicure lato server
- Offre un'interfaccia React semplice per le chiamate API

## 📋 Prerequisiti

- Applicativo Convex funzionante con Auth0
- Credenziali PrimoUp (email, password, URL API)
- Accesso alla dashboard Convex per configurare le variabili d'ambiente

## 🔧 Configurazione Variabili d'Ambiente

Nella dashboard Convex, configura queste variabili d'ambiente:

```
PRIMOUP_API_BASE_URL=https://staging.primoup.it
PRIMOUP_EMAIL=tua-email@dominio.it
PRIMOUP_PASSWORD=tua-password
```

## 📁 File da Creare/Modificare

### 1. Schema Database - `convex/schema.ts`

Aggiungi questa tabella al tuo schema esistente:

```typescript
// Aggiungi questa tabella al tuo schema esistente
primoup_tokens: defineTable({
  token: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  isActive: v.boolean(),
}).index("by_active", ["isActive"]),
```

### 2. Gestione Token - `convex/primoupAuth.ts`

Crea questo file completo:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mutation per storare/aggiornare il token PrimoUp
export const storeToken = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    // Disattiva tutti i token esistenti
    const existingTokens = await ctx.db
      .query("primoup_tokens")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    for (const existingToken of existingTokens) {
      await ctx.db.patch(existingToken._id, { isActive: false });
    }

    // Crea il nuovo token attivo
    await ctx.db.insert("primoup_tokens", {
      token,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });

    return null;
  },
});

// Query per recuperare il token attivo
export const getActiveToken = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const tokenDoc = await ctx.db
      .query("primoup_tokens")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();

    return tokenDoc?.token || null;
  },
});

// Mutation per invalidare il token corrente
export const invalidateToken = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const activeToken = await ctx.db
      .query("primoup_tokens")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();

    if (activeToken) {
      await ctx.db.patch(activeToken._id, { isActive: false });
    }

    return null;
  },
});
```

### 3. Actions PrimoUp - `convex/primoupActions.ts`

Crea questo file completo:

```typescript
"use node";

import { action, ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Tipi per evitare riferimenti circolari
type ConnectionStatus = {
  isConnected: boolean;
  hasActiveToken: boolean;
};

type PrimoUpUserInfo = {
  id?: number;
  username?: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  [key: string]: unknown;
};

type SetupResult = {
  success: boolean;
  message: string;
  userInfo?: PrimoUpUserInfo;
};

// Action per inizializzare/refreshare il token di PrimoUp
export const setupConnection = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    userInfo: v.optional(
      v.object({
        id: v.optional(v.number()),
        username: v.optional(v.string()),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        first_name: v.optional(v.string()),
        last_name: v.optional(v.string()),
        role: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx) => {
    const email = process.env.PRIMOUP_EMAIL;
    const password = process.env.PRIMOUP_PASSWORD;
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;

    console.log("🔄 PrimoUp Setup - Environment check:", {
      hasEmail: !!email,
      hasPassword: !!password,
      hasBaseUrl: !!baseUrl,
      baseUrl: baseUrl,
      email: email,
    });

    if (!email || !password || !baseUrl) {
      throw new Error(
        "Missing PrimoUp credentials or API base URL in environment variables"
      );
    }

    // Assicurati che l'URL abbia il formato corretto (con ? finale se necessario)
    const cleanBaseUrl = baseUrl.replace(/\?$/, "");
    const fullUrl = `${cleanBaseUrl}/api/v2/auth/login`;

    console.log("🌐 PrimoUp Login Request Details:");
    console.log("   - Base URL:", baseUrl);
    console.log("   - Clean Base URL:", cleanBaseUrl);
    console.log("   - Full URL:", fullUrl);
    console.log("   - Email:", email);
    console.log("   - Password length:", password?.length || 0);
    console.log("   - Request method: POST");
    console.log("   - Content-Type: application/json");

    try {
      const requestBody = JSON.stringify({ email, password });
      console.log(
        "📦 Request body (sanitized):",
        JSON.stringify({ email, password: "***" })
      );

      console.log("🚀 Initiating HTTP request...");
      const startTime = Date.now();

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      const endTime = Date.now();
      console.log(`⏱️ Request completed in ${endTime - startTime}ms`);
      console.log("📡 Response status:", response.status, response.statusText);
      console.log("📡 Response ok:", response.ok);

      // Log response headers in a more compatible way
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log("📋 Response headers:", responseHeaders);

      if (!response.ok) {
        // Prova a leggere il body della response per più dettagli
        let errorBody = "";
        try {
          errorBody = await response.text();
          console.log("❌ Error response body:", errorBody);
        } catch (e) {
          console.log("❌ Could not read error response body");
        }

        throw new Error(
          `PrimoUp login failed: ${response.status} ${response.statusText}. Response: ${errorBody}`
        );
      }

      const data = (await response.json()) as {
        meta?: { token?: string };
        data?: PrimoUpUserInfo;
      };

      console.log("✅ Response data structure:", {
        hasMeta: !!data.meta,
        hasToken: !!data.meta?.token,
        hasData: !!data.data,
        tokenLength: data.meta?.token?.length || 0,
      });

      const token = data.meta?.token;

      if (!token) {
        throw new Error("No token received from PrimoUp API");
      }

      // Stora il token nel database
      await ctx.runMutation(api.primoupAuth.storeToken, { token });

      return {
        success: true,
        message: "PrimoUp connection established successfully",
        userInfo: data.data, // Restituisce le info utente se servono
      };
    } catch (error) {
      console.error("PrimoUp setup connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to setup PrimoUp connection: ${errorMessage}`);
    }
  },
});

// Action generica per chiamate a PrimoUp con gestione reattiva dei token scaduti
export const callPrimoUpAPI = action({
  args: {
    endpoint: v.string(),
    method: v.optional(v.string()),
    body: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, { endpoint, method = "GET", body }): Promise<unknown> => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;

    if (!baseUrl) {
      throw new Error("PRIMOUP_API_BASE_URL not configured");
    }

    // Utilizza l'helper riutilizzabile per gestire token e retry automaticamente
    return await withPrimoUpTokenRetry(ctx, async () => {
      // Ottieni il token attivo (l'helper ha già gestito il refresh se necessario)
      const token: string | null = (await ctx.runQuery(
        api.primoupAuth.getActiveToken
      )) as string | null;

      if (!token) {
        throw new Error("No active token available");
      }

      const fullUrl = `${baseUrl}${endpoint}`;
      const response = await fetch(fullUrl, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body && method !== "GET" && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return (await response.json()) as unknown;
    });
  },
});

// Helper per gestire automaticamente token e retry in caso di errori 401/404
async function withPrimoUpTokenRetry<T>(
  ctx: ActionCtx,
  apiCall: () => Promise<T>
): Promise<T> {
  // Prima tentativo con token esistente
  let token: string | null = (await ctx.runQuery(
    api.primoupAuth.getActiveToken
  )) as string | null;

  if (!token) {
    // Nessun token disponibile, ottienine uno nuovo
    await ctx.runAction(api.primoupActions.setupConnection);
    token = (await ctx.runQuery(api.primoupAuth.getActiveToken)) as
      | string
      | null;

    if (!token) {
      throw new Error("Failed to obtain PrimoUp token");
    }
  }

  try {
    // Esegui la chiamata API originale
    return await apiCall();
  } catch (error) {
    // Se riceviamo 401 o 404, potrebbe essere un problema di token
    const isTokenError = error instanceof Error &&
      (error.message.includes('401') || error.message.includes('404'));

    if (isTokenError) {
      // Invalida il token corrente e ottienine uno nuovo
      await ctx.runMutation(api.primoupAuth.invalidateToken);
      await ctx.runAction(api.primoupActions.setupConnection);

      const newToken: string | null = (await ctx.runQuery(
        api.primoupAuth.getActiveToken
      )) as string | null;
      if (!newToken) {
        throw new Error("Failed to refresh expired token");
      }

      try {
        // Riprova con il nuovo token
        return await apiCall();
      } catch (retryError) {
        // Se anche il secondo tentativo fallisce con 404, la risorsa non esiste
        if (retryError instanceof Error && retryError.message.includes('404')) {
          throw new Error(
            `Resource not found: ${retryError.message}`
          );
        }
        throw retryError;
      }
    }

    // Se non è un errore di token, rilancia l'errore originale
    throw error;
  }
}

// Helper function per evitare riferimenti circolari
async function getConnectionStatusHelper(ctx: ActionCtx): Promise<ConnectionStatus> {
  const token: string | null = (await ctx.runQuery(
    api.primoupAuth.getActiveToken
  )) as string | null;
  return {
    isConnected: !!token,
    hasActiveToken: !!token,
  };
}

// Esempi di actions specifiche per PrimoUp
export const getProducts = action({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<unknown> => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;
    if (!baseUrl) {
      throw new Error("PRIMOUP_API_BASE_URL not configured");
    }

    return await withPrimoUpTokenRetry(ctx, async () => {
      const token: string | null = (await ctx.runQuery(
        api.primoupAuth.getActiveToken
      )) as string | null;

      if (!token) {
        throw new Error("No active token available");
      }

      const response = await fetch(`${baseUrl}/api/v2/products`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return (await response.json()) as unknown;
    });
  },
});

export const createOrder = action({
  args: {
    orderData: v.object({
      productId: v.number(),
      quantity: v.number(),
      // Aggiungi altri campi necessari secondo l'API PrimoUp
    }),
  },
  returns: v.any(),
  handler: async (ctx, { orderData }): Promise<unknown> => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;
    if (!baseUrl) {
      throw new Error("PRIMOUP_API_BASE_URL not configured");
    }

    return await withPrimoUpTokenRetry(ctx, async () => {
      const token: string | null = (await ctx.runQuery(
        api.primoupAuth.getActiveToken
      )) as string | null;

      if (!token) {
        throw new Error("No active token available");
      }

      const response = await fetch(`${baseUrl}/api/v2/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return (await response.json()) as unknown;
    });
  },
});

// Action per ottenere lo status della connessione PrimoUp
export const getConnectionStatus = action({
  args: {},
  returns: v.object({
    isConnected: v.boolean(),
    hasActiveToken: v.boolean(),
  }),
  handler: async (ctx): Promise<ConnectionStatus> => {
    return await getConnectionStatusHelper(ctx);
  },
});

// Action per forzare la riconnessione (utile per testing/debugging)
export const forceReconnection = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    userInfo: v.optional(
      v.object({
        id: v.optional(v.number()),
        username: v.optional(v.string()),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        first_name: v.optional(v.string()),
        last_name: v.optional(v.string()),
        role: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx): Promise<SetupResult> => {
    await ctx.runMutation(api.primoupAuth.invalidateToken);
    const result: SetupResult = await ctx.runAction(
      api.primoupActions.setupConnection
    );
    return result;
  },
});

// Action per debug della connessione
export const debugConnection = action({
  args: {},
  returns: v.object({
    hasToken: v.boolean(),
    tokenLength: v.number(),
    status: v.object({
      isConnected: v.boolean(),
      hasActiveToken: v.boolean(),
    }),
  }),
  handler: async (
    ctx
  ): Promise<{
    hasToken: boolean;
    tokenLength: number;
    status: ConnectionStatus;
  }> => {
    const token: string | null = (await ctx.runQuery(
      api.primoupAuth.getActiveToken
    )) as string | null;
    const status: ConnectionStatus = await getConnectionStatusHelper(ctx);

    return {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      status,
    };
  },
});

// Action per testare l'endpoint PrimoUp senza autenticazione
export const testPrimoUpEndpoint = action({
  args: {},
  returns: v.object({
    endpointReachable: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
    responseHeaders: v.optional(v.record(v.string(), v.string())),
  }),
  handler: async (ctx) => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;

    if (!baseUrl) {
      return {
        endpointReachable: false,
        error: "PRIMOUP_API_BASE_URL not configured",
      };
    }

    try {
      const cleanBaseUrl = baseUrl.replace(/\?$/, "");
      const testUrl = `${cleanBaseUrl}/api/v2/auth/login`;

      console.log(`🧪 Testing endpoint: ${testUrl}`);
      console.log(`🧪 Original base URL: ${baseUrl}`);

      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@test.com",
          password: "test",
        }),
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      console.log(
        `🧪 Test response: ${response.status} ${response.statusText}`
      );

      return {
        endpointReachable: true,
        statusCode: response.status,
        responseHeaders,
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      console.error("🧪 Endpoint test error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        endpointReachable: false,
        error: `Network error: ${errorMessage}`,
      };
    }
  },
});

// Action per testare con URL che include il punto di domanda
export const testPrimoUpEndpointWithQuery = action({
  args: {},
  returns: v.object({
    endpointReachable: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
    responseHeaders: v.optional(v.record(v.string(), v.string())),
  }),
  handler: async (ctx) => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;

    if (!baseUrl) {
      return {
        endpointReachable: false,
        error: "PRIMOUP_API_BASE_URL not configured",
      };
    }

    try {
      // Mantieni il punto di domanda se presente, altrimenti aggiungilo
      const urlWithQuery = baseUrl.endsWith("?") ? baseUrl : `${baseUrl}?`;
      const testUrl = `${urlWithQuery}api/v2/auth/login`;

      console.log(`🧪 Testing endpoint WITH query: ${testUrl}`);
      console.log(`🧪 Original base URL: ${baseUrl}`);

      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@test.com",
          password: "test",
        }),
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      console.log(
        `🧪 Test response WITH query: ${response.status} ${response.statusText}`
      );

      return {
        endpointReachable: true,
        statusCode: response.status,
        responseHeaders,
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      console.error("🧪 Endpoint test WITH query error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        endpointReachable: false,
        error: `Network error: ${errorMessage}`,
      };
    }
  },
});

// Action per verificare le variabili d'ambiente
export const checkEnvironmentVariables = action({
  args: {},
  returns: v.object({
    hasBaseUrl: v.boolean(),
    hasEmail: v.boolean(),
    hasPassword: v.boolean(),
    baseUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;
    const email = process.env.PRIMOUP_EMAIL;
    const password = process.env.PRIMOUP_PASSWORD;

    return {
      hasBaseUrl: !!baseUrl,
      hasEmail: !!email,
      hasPassword: !!password,
      baseUrl: baseUrl || undefined,
      email: email || undefined,
    };
  },
});

// Action per ottenere i dati utente PrimoUp tramite email
export const getUserByEmail = action({
  args: {
    email: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, { email }): Promise<unknown> => {
    const baseUrl = process.env.PRIMOUP_API_BASE_URL;
    if (!baseUrl) {
      throw new Error("PRIMOUP_API_BASE_URL not configured");
    }

    const endpoint = `/api/v2/users/by-email/?email=${encodeURIComponent(email)}&include=clinics,clinics.roles,clinics.area_managers`;

    return await withPrimoUpTokenRetry(ctx, async () => {
      const token: string | null = (await ctx.runQuery(
        api.primoupAuth.getActiveToken
      )) as string | null;

      if (!token) {
        throw new Error("No active token available");
      }

      const fullUrl = `${baseUrl}${endpoint}`;
      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return (await response.json()) as unknown;
    });
  },
});
```

### 4. Hook Setup - `src/hooks/usePrimoUpSetup.ts`

Crea questo file:

```typescript
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export const usePrimoUpSetup = () => {
  const { isAuthenticated } = useAuth0();
  const setupPrimoUp = useAction(api.primoupActions.setupConnection);
  const getConnectionStatus = useAction(api.primoupActions.getConnectionStatus);

  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializePrimoUp = async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Controlla se esiste già una connessione
      const status = await getConnectionStatus();

      if (!status.isConnected) {
        // Setup della connessione se non esiste
        console.log("🔄 Attempting PrimoUp setup...");
        await setupPrimoUp();
        console.log("✅ PrimoUp setup completed");
      }

      setIsSetupComplete(true);
    } catch (error: any) {
      console.error("Failed to setup PrimoUp:", error);
      setError(error.message);
      // Non bloccare l'app, continua comunque
      setIsSetupComplete(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isSetupComplete) {
      initializePrimoUp();
    }
  }, [isAuthenticated]);

  return {
    isSetupComplete,
    isLoading,
    error,
    retry: initializePrimoUp,
  };
};
```

### 5. Provider Component - `src/components/PrimoUpProvider.tsx`

Crea questo file:

```typescript
import React from 'react';
import { usePrimoUpSetup } from '../hooks/usePrimoUpSetup';

interface PrimoUpProviderProps {
  children: React.ReactNode;
}

export const PrimoUpProvider: React.FC<PrimoUpProviderProps> = ({ children }) => {
  const { isSetupComplete, isLoading, error, retry } = usePrimoUpSetup();

  // Mostra loading durante il setup iniziale
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Configurazione PrimoUp...</p>
        </div>
      </div>
    );
  }

  // Non bloccare l'app in caso di errore, mostra solo un banner
  const showErrorBanner = error || !isSetupComplete;

  // Mostra sempre l'app, con un banner di errore se necessario
  return (
    <>
      {showErrorBanner && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {error ? 'Errore configurazione PrimoUp' : 'PrimoUp non configurato'}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'La connessione a PrimoUp non è stata stabilita.'}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    onClick={retry}
                    className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                  >
                    Riprova configurazione
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};
```

### 6. Modifica App.tsx

Nel tuo file `src/App.tsx`, aggiungi il PrimoUpProvider intorno al contenuto autenticato:

```typescript
// Importa il provider
import { PrimoUpProvider } from "./components/PrimoUpProvider";

// Nel tuo componente App, wrappa il contenuto autenticato:
<Authenticated>
  <PrimoUpProvider>
    {/* Il tuo contenuto esistente */}
    <BrowserRouter>
      <Routes>
        {/* Le tue routes esistenti */}
      </Routes>
    </BrowserRouter>
  </PrimoUpProvider>
</Authenticated>
```

## 🚀 Come Utilizzare l'Integrazione

### 1. Chiamate API Semplici

```typescript
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

function MyComponent() {
  const callPrimoUpAPI = useAction(api.primoupActions.callPrimoUpAPI);

  const handleApiCall = async () => {
    try {
      const result = await callPrimoUpAPI({
        endpoint: "/api/v2/your-endpoint",
        method: "GET"
      });
      console.log(result);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return <button onClick={handleApiCall}>Chiama API</button>;
}
```

### 2. Aggiungere Nuove Actions

Per aggiungere nuove chiamate specifiche, modifica `convex/primoupActions.ts`:

```typescript
export const myCustomAction = action({
  args: {
    customParam: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, { customParam }) => {
    return await ctx.runAction(api.primoupActions.callPrimoUpAPI, {
      endpoint: `/api/v2/my-endpoint/${customParam}`,
      method: "GET",
    });
  },
});
```

## 🔍 Testing e Debug

### Actions di Debug Disponibili

- `debugConnection()` - Informazioni sullo stato della connessione
- `checkEnvironmentVariables()` - Verifica configurazione variabili d'ambiente
- `forceReconnection()` - Forza una nuova connessione
- `testPrimoUpEndpoint()` - Testa la raggiungibilità dell'endpoint PrimoUp
- `testPrimoUpEndpointWithQuery()` - Testa l'endpoint con formato URL alternativo
- `getUserByEmail(email)` - Recupera dati utente PrimoUp tramite email

### Componente di Test (Opzionale)

Puoi creare un componente di test per verificare l'integrazione:

```typescript
import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

export const PrimoUpTest: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const debugConnection = useAction(api.primoupActions.debugConnection);
  const checkEnvVars = useAction(api.primoupActions.checkEnvironmentVariables);
  const testEndpoint = useAction(api.primoupActions.testPrimoUpEndpoint);
  const forceReconnection = useAction(api.primoupActions.forceReconnection);
  const getUserByEmail = useAction(api.primoupActions.getUserByEmail);

  const runTests = async () => {
    setLoading(true);
    try {
      const debug = await debugConnection();
      const env = await checkEnvVars();
      const endpoint = await testEndpoint();

      setResults({
        debug,
        environment: env,
        endpoint,
        timestamp: new Date().toISOString()
      });

      console.log('🧪 Test Results:', { debug, env, endpoint });
    } catch (error) {
      console.error('❌ Test failed:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testUserFetch = async () => {
    const email = prompt('Inserisci email utente PrimoUp da testare:');
    if (!email) return;

    setLoading(true);
    try {
      const userData = await getUserByEmail({ email });
      console.log('👤 User data:', userData);
      setResults({ ...results, userData });
    } catch (error) {
      console.error('❌ User fetch failed:', error);
      setResults({ ...results, userError: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleForceReconnection = async () => {
    setLoading(true);
    try {
      const result = await forceReconnection();
      console.log('🔄 Reconnection result:', result);
      setResults({ ...results, reconnection: result });
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      setResults({ ...results, reconnectionError: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">PrimoUp Integration Test</h3>

      <div className="space-x-2 mb-4">
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run Connection Tests'}
        </button>

        <button
          onClick={testUserFetch}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test User Fetch
        </button>

        <button
          onClick={handleForceReconnection}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          Force Reconnection
        </button>
      </div>

      {results && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Test Results:</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
```

## 🔒 Sicurezza e Best Practices

1. **Credenziali**: Mai esporre credenziali nel frontend
2. **Token**: I token sono gestiti automaticamente lato server
3. **Errori**: Gestire sempre gli errori nelle chiamate API
4. **Logging**: I log dettagliati sono disponibili nella dashboard Convex

## 🛠️ Troubleshooting

### Errori Comuni

1. **"Missing PrimoUp credentials"**
   - Verifica le variabili d'ambiente nella dashboard Convex
   - Assicurati che `PRIMOUP_EMAIL`, `PRIMOUP_PASSWORD` e `PRIMOUP_API_BASE_URL` siano configurate

2. **"Il campo email è richiesto"**
   - Assicurati che `PRIMOUP_EMAIL` sia configurato correttamente
   - Verifica che l'email sia valida e corrisponda a un account PrimoUp attivo

3. **403 Forbidden**
   - Verifica che le credenziali siano corrette
   - Controlla che l'account non sia bloccato
   - Assicurati che l'email abbia i permessi necessari per accedere all'API

4. **Token scaduti**
   - Il sistema gestisce automaticamente il refresh

### Log di Debug

Tutti i log sono visibili nella dashboard Convex nella sezione "Logs". Cerca i log con prefissi:

- 🔄 Setup
- 🌐 Request Details
- 📡 Response
- ❌ Errors

## ✅ Checklist di Implementazione

- [ ] Configurate variabili d'ambiente in Convex (`PRIMOUP_EMAIL`, `PRIMOUP_PASSWORD`, `PRIMOUP_API_BASE_URL`)
- [ ] Aggiunta tabella `primoup_tokens` allo schema
- [ ] Creato file `convex/primoupAuth.ts`
- [ ] Creato file `convex/primoupActions.ts`
- [ ] Creato hook `src/hooks/usePrimoUpSetup.ts`
- [ ] Creato componente `src/components/PrimoUpProvider.tsx`
- [ ] Modificato `src/App.tsx` per includere il provider
- [ ] Testata la connessione con le actions di debug

Seguendo questa guida, avrai un'integrazione PrimoUp completa e funzionante in qualsiasi applicativo Convex! 🎉
