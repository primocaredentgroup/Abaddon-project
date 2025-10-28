"use node";

import { action, ActionCtx, mutation, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

type PrimoUpClinic = {
  id: number;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
};

type PrimoUpUserClinicsResponse = {
  data?: {
    id?: number;
    email?: string;
    clinics?: PrimoUpClinic[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
    });

    if (!email || !password || !baseUrl) {
      throw new Error(
        "Missing PrimoUp credentials or API base URL in environment variables"
      );
    }

    const cleanBaseUrl = baseUrl.replace(/\?$/, "");
    const fullUrl = `${cleanBaseUrl}/api/v2/auth/login`;

    try {
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(
          `PrimoUp login failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        meta?: { token?: string };
        data?: PrimoUpUserInfo;
      };

      const token = data.meta?.token;

      if (!token) {
        throw new Error("No token received from PrimoUp API");
      }

      // Stora il token nel database
      await ctx.runMutation(api.primoupAuth.storeToken, { token });

      return {
        success: true,
        message: "PrimoUp connection established successfully",
        userInfo: data.data,
      };
    } catch (error) {
      console.error("PrimoUp setup connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to setup PrimoUp connection: ${errorMessage}`);
    }
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
    const isTokenError =
      error instanceof Error &&
      (error.message.includes("401") || error.message.includes("404"));

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
        if (
          retryError instanceof Error &&
          retryError.message.includes("404")
        ) {
          throw new Error(`Resource not found: ${retryError.message}`);
        }
        throw retryError;
      }
    }

    // Se non è un errore di token, rilancia l'errore originale
    throw error;
  }
}

// Action per ottenere i dati utente PrimoUp tramite email (include cliniche)
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
      console.log("🔍 Fetching user clinics from PrimoUp:", { email, fullUrl });

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

// Action principale per sincronizzare cliniche utente da PrimoUp
export const syncUserClinicsFromPrimoUp = action({
  args: {
    userEmail: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    clinicsSynced: v.number(),
    clinicsDeactivated: v.number(),
  }),
  handler: async (ctx, { userEmail, userId }) => {
    console.log("🔄 Starting clinic sync for user:", userEmail);

    try {
      // 🔒 CHECK: Evita sync multipli simultanei
      const user = await ctx.runQuery(api.auth.getUserById, { userId });
      if (!user) {
        throw new Error("User not found");
      }

      if (user.isSyncing) {
        console.log("⏸️ Sync already in progress for this user, skipping");
        return { success: true, clinicsSynced: 0, clinicsDeactivated: 0 };
      }

      // 🔒 LOCK: Imposta flag sync in corso
      await ctx.runMutation(internal.primoupMutations.setSyncFlag, {
        userId,
        isSyncing: true,
      });

      // 1. Ottieni dati utente da PrimoUp (include cliniche)
      const primoUpData = (await ctx.runAction(api.primoupActions.getUserByEmail, {
        email: userEmail,
      })) as PrimoUpUserClinicsResponse;

      const primoUpClinics = primoUpData.data?.clinics || [];

      console.log(`📋 Found ${primoUpClinics.length} clinics in PrimoUp for ${userEmail}`);

      if (primoUpClinics.length === 0) {
        console.log("⚠️ No clinics found in PrimoUp");
        return { success: true, clinicsSynced: 0, clinicsDeactivated: 0 };
      }

      // 2. Sincronizza ogni clinica
      const externalClinicIds: string[] = [];
      let clinicsSynced = 0;

      for (const primoUpClinic of primoUpClinics) {
        const externalId = String(primoUpClinic.id);
        externalClinicIds.push(externalId);

        // Chiama mutation interna per sync singola clinica
        await ctx.runMutation(internal.primoupMutations.syncSingleClinic, {
          userId,
          externalClinicId: externalId,
          clinicData: {
            name: primoUpClinic.name,
            code: primoUpClinic.code || `PRIMO_${externalId}`,
            address: primoUpClinic.address || "",
            phone: primoUpClinic.phone || "",
            email: primoUpClinic.email || "",
          },
        });

        clinicsSynced++;
      }

      // 2b. 🏢 Gestione Cliniche Speciali HQ e LABORATORIO
      // Controlla le società dell'utente nel NOSTRO DB (tabella userSocieties)
      const userSocietiesLinks = await ctx.runQuery(api.userSocieties.getUserSocieties, { userId });
      
      // Ottieni i codici delle società dell'utente
      const societyCodes: string[] = [];
      for (const link of userSocietiesLinks) {
        if (link.society && link.society.code) {
          societyCodes.push(link.society.code.toUpperCase());
        }
      }

      const hasHQ = societyCodes.includes("HQ");
      const hasLaboratorio = societyCodes.includes("LABORATORIO");

      if (hasHQ || hasLaboratorio) {
        console.log(`🏢 Utente ha società speciali nel nostro DB: HQ=${hasHQ}, LAB=${hasLaboratorio}`);

        // 🔒 Cerca le cliniche esistenti (DEVONO essere create prima con createSystemClinics)
        // NON crearle qui per evitare race conditions!

        // Aggiungi HQ se necessario
        if (hasHQ) {
          const hqClinic = await ctx.runQuery(api.systemClinics.getSystemClinic, { code: "HQ" });
          if (hqClinic) {
            await ctx.runMutation(internal.primoupMutations.linkUserToClinic, {
              userId,
              clinicId: hqClinic._id,
              externalClinicId: "SYSTEM_HQ",
            });
            clinicsSynced++;
          } else {
            console.warn("⚠️ Clinica HQ non trovata! Esegui createSystemClinics() dal Dashboard.");
          }
        }

        // Aggiungi LABORATORIO se necessario
        if (hasLaboratorio) {
          const labClinic = await ctx.runQuery(api.systemClinics.getSystemClinic, { code: "LABORATORIO" });
          if (labClinic) {
            await ctx.runMutation(internal.primoupMutations.linkUserToClinic, {
              userId,
              clinicId: labClinic._id,
              externalClinicId: "SYSTEM_LABORATORIO",
            });
            clinicsSynced++;
          } else {
            console.warn("⚠️ Clinica LABORATORIO non trovata! Esegui createSystemClinics() dal Dashboard.");
          }
        }
      }

      // 3. Disattiva cliniche che non sono più in PrimoUp
      const deactivated: number = await ctx.runMutation(
        internal.primoupMutations.deactivateRemovedClinics,
        {
          userId,
          activeExternalClinicIds: externalClinicIds,
        }
      );

      // 4. Aggiorna timestamp sync utente
      await ctx.runMutation(internal.primoupMutations.updateUserSyncTimestamp, {
        userId,
      });

      console.log(`✅ Clinic sync completed: ${clinicsSynced} synced, ${deactivated} deactivated`);

      return {
        success: true,
        clinicsSynced,
        clinicsDeactivated: deactivated,
      };
    } catch (error) {
      console.error("❌ Clinic sync failed:", error);
      throw error;
    } finally {
      // 🔓 UNLOCK: Rilascia sempre il flag sync (anche in caso di errore)
      await ctx.runMutation(internal.primoupMutations.setSyncFlag, {
        userId,
        isSyncing: false,
      });
    }
  },
});

// Internal mutation per sincronizzare una singola clinica (spostato in primoupAuth.ts per evitare conflitti con "use node")
/*
export const syncSingleClinic = internalMutation({
  args: {
    userId: v.id("users"),
    externalClinicId: v.string(),
    clinicData: v.object({
      name: v.string(),
      code: v.string(),
      address: v.string(),
      phone: v.string(),
      email: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { userId, externalClinicId, clinicData }) => {
    // Cerca clinica esistente per externalClinicId
    let clinic = await ctx.db
      .query("clinics")
      .withIndex("by_external_id", (q) => q.eq("externalClinicId", externalClinicId))
      .unique();

    let clinicId: Id<"clinics">;

    if (clinic) {
      // Clinica esiste: aggiorna dati se diversi
      await ctx.db.patch(clinic._id, {
        name: clinicData.name,
        address: clinicData.address,
        phone: clinicData.phone,
        email: clinicData.email,
        lastSyncAt: Date.now(),
      });
      clinicId = clinic._id;
    } else {
      // Clinica NON esiste: creala
      clinicId = await ctx.db.insert("clinics", {
        name: clinicData.name,
        code: clinicData.code,
        address: clinicData.address,
        phone: clinicData.phone,
        email: clinicData.email,
        externalClinicId,
        lastSyncAt: Date.now(),
        settings: {
          allowPublicTickets: true,
          requireApprovalForCategories: false,
          defaultSlaHours: 24,
        },
        isActive: true,
      });
    }

    // Cerca relazione userClinics esistente
    const existingUserClinic = await ctx.db
      .query("userClinics")
      .withIndex("by_user_clinic", (q) =>
        q.eq("userId", userId).eq("clinicId", clinicId)
      )
      .unique();

    if (existingUserClinic) {
      // Relazione esiste: assicurati che sia attiva
      await ctx.db.patch(existingUserClinic._id, {
        isActive: true,
        externalClinicId,
      });
    } else {
      // Relazione NON esiste: creala
      await ctx.db.insert("userClinics", {
        userId,
        clinicId,
        externalClinicId,
        role: "user", // Default role, può essere aggiornato successivamente
        isActive: true,
        joinedAt: Date.now(),
      });
    }

    return null;
  },
});
*/

// Internal mutation per disattivare cliniche rimosse da PrimoUp (spostato in primoupAuth.ts per evitare conflitti con "use node")
/*
export const deactivateRemovedClinics = internalMutation({
  args: {
    userId: v.id("users"),
    activeExternalClinicIds: v.array(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, { userId, activeExternalClinicIds }) => {
    // Ottieni tutte le userClinics attive dell'utente
    const userClinics = await ctx.db
      .query("userClinics")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();

    let deactivated = 0;

    for (const userClinic of userClinics) {
      // Se la clinica ha un externalClinicId e NON è nella lista attiva → disattiva
      if (
        userClinic.externalClinicId &&
        !activeExternalClinicIds.includes(userClinic.externalClinicId)
      ) {
        await ctx.db.patch(userClinic._id, { isActive: false });
        deactivated++;
      }
    }

    return deactivated;
  },
});
*/

// Internal mutation per aggiornare timestamp sync utente (spostato in primoupAuth.ts per evitare conflitti con "use node")
/*
export const updateUserSyncTimestamp = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, {
      lastClinicSyncAt: Date.now(),
    });
    return null;
  },
});
*/

// Action per ottenere lo status della connessione PrimoUp
export const getConnectionStatus = action({
  args: {},
  returns: v.object({
    isConnected: v.boolean(),
    hasActiveToken: v.boolean(),
  }),
  handler: async (ctx): Promise<ConnectionStatus> => {
    const token: string | null = (await ctx.runQuery(
      api.primoupAuth.getActiveToken
    )) as string | null;
    return {
      isConnected: !!token,
      hasActiveToken: !!token,
    };
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

