import { v } from "convex/values"
import { mutation, query, action } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser } from "./lib/utils"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { api } from "./_generated/api"

// Initialize Google Gemini
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

async function call_llm(prompt: string) {
  const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// =================== QUERIES ===================

// Ottieni thread attivi dell'utente
export const getUserThreads = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("agentThreads")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .order("desc")
      .take(10);
  },
});

// Ottieni messaggi di un thread
export const getThreadMessages = query({
  args: { threadId: v.id("agentThreads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
  },
});

// Ottieni configurazione agent per clinica
export const getAgentConfig = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const config = await ctx.db
      .query("agentConfig")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .unique();

    // Configurazione di default se non esiste
    if (!config) {
      return {
        clinicId,
        isEnabled: true,
        settings: {
          canSearchTickets: true,
          canSuggestCategories: true,
          canCreateTickets: true,
          canAccessUserData: false,
          canAccessClinicsData: false,
          temperature: 0.8,
          maxTokens: 2048,
          systemPrompt: `Ciao! Sono Ermes, il tuo assistente intelligente per il sistema di gestione ticket healthcare.

Puoi aiutarti con:
- 🔍 Cercare ticket per ID, titolo o descrizione
- 💡 Suggerire la categoria più appropriata per nuovi ticket
- ➕ Creare ticket automaticamente nella categoria suggerita
- 🧭 Navigare nell'applicazione e guidarti verso le funzioni giuste

Sono qui per rendere il tuo lavoro più semplice ed efficiente! Rispondi sempre in italiano, sii professionale ma amichevole, e usa emoji quando appropriato per rendere le conversazioni più piacevoli.`
        }
      };
    }

    return config;
  },
});

// =================== MUTATIONS ===================

// Crea o ottieni thread per l'utente
export const createOrGetThread = mutation({
  args: { userId: v.id("users"), clinicId: v.id("clinics") },
  handler: async (ctx, { userId, clinicId }) => {
    // Cerca thread attivo esistente
    const existingThread = await ctx.db
      .query("agentThreads")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();

    if (existingThread) {
      return existingThread._id;
    }

    // Crea nuovo thread
    const threadId = await ctx.db.insert("agentThreads", {
      userId,
      clinicId,
      isActive: true,
      lastMessageAt: Date.now(),
      messageCount: 0,
    });

    return threadId;
  },
});

// Aggiungi messaggio al thread
export const addMessage = mutation({
  args: {
    threadId: v.id("agentThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { threadId, role, content, metadata }) => {
    // Inserisci messaggio
    const messageId = await ctx.db.insert("agentMessages", {
      threadId,
      role,
      content,
      metadata,
    });

    // Aggiorna thread
    const thread = await ctx.db.get(threadId);
    if (thread) {
      await ctx.db.patch(threadId, {
        lastMessageAt: Date.now(),
        messageCount: thread.messageCount + 1,
        title: thread.title || (role === "user" ? content.substring(0, 50) + "..." : thread.title),
      });
    }

    return messageId;
  },
});

// Configura agent per clinica (solo admin)
export const updateAgentConfig = mutation({
  args: {
    clinicId: v.id("clinics"),
    settings: v.object({
      canSearchTickets: v.boolean(),
      canSuggestCategories: v.boolean(),
      canCreateTickets: v.boolean(),
      canAccessUserData: v.boolean(),
      canAccessClinicsData: v.boolean(),
      temperature: v.number(),
      maxTokens: v.number(),
      systemPrompt: v.string(),
    }),
  },
  handler: async (ctx, { clinicId, settings }) => {
    const currentUser = await getCurrentUser(ctx);

    // Popola il ruolo dell'utente
    const role = await ctx.db.get(currentUser.roleId);
    const userWithRole = { ...currentUser, role };

    // Verifica che sia admin
    if (userWithRole.role?.name !== "Amministratore") {
      throw new ConvexError("Solo gli amministratori possono configurare l'agent");
    }

    const existingConfig = await ctx.db
      .query("agentConfig")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .unique();

    if (existingConfig) {
      await ctx.db.patch(existingConfig._id, {
        settings,
        lastUpdatedBy: currentUser._id,
      });
      return existingConfig._id;
    } else {
      return await ctx.db.insert("agentConfig", {
        clinicId,
        isEnabled: true,
        settings,
        lastUpdatedBy: currentUser._id,
      });
    }
  },
});

// =================== ACTIONS (AI) ===================

// Cerca ticket
export const searchTickets = action({
  args: {
    query: v.string(),
    clinicId: v.id("clinics"),
    userId: v.id("users"),
  },
  handler: async (ctx, { query, clinicId, userId }): Promise<{
    query: string;
    results: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      category: string;
      url: string;
    }>;
    totalFound: number;
  }> => {
    // Ottieni config agent
    const config = await ctx.runQuery(api.agent.getAgentConfig, { clinicId });
    if (!config.settings.canSearchTickets) {
      throw new ConvexError("Ricerca ticket non abilitata");
    }

    // Cerca per ID se è un numero
    if (/^\d+$/.test(query.trim())) {
      // TODO: implementare ricerca per ID numerico se esiste
    }

    // Cerca nei ticket dell'utente e della clinica
    const ticketsResult = await ctx.runQuery(api.tickets.getByClinic, {});
    const tickets = ticketsResult.tickets;
    
    // Filtra i risultati in base alla query (titolo, descrizione)
    const results = tickets.filter((ticket: any) => 
      ticket.title.toLowerCase().includes(query.toLowerCase()) ||
      ticket.description.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10); // Max 10 risultati

    return {
      query,
      results: results.map((ticket: any) => ({
        id: ticket._id,
        title: ticket.title,
        description: ticket.description.substring(0, 100) + "...",
        status: ticket.status,
        category: ticket.categoryId, // TODO: popolare nome categoria
        url: `/tickets/${ticket._id}`,
      })),
      totalFound: results.length,
    };
  },
});

// Suggerisci categoria per un ticket
export const suggestCategory = action({
  args: {
    title: v.string(),
    description: v.string(),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { title, description, clinicId }): Promise<{
    recommendedCategory: any;
    confidence: number;
    explanation: string;
    alternativeCategory: any;
  }> => {
    // Ottieni config agent
    const config = await ctx.runQuery(api.agent.getAgentConfig, { clinicId });
    if (!config.settings.canSuggestCategories) {
      throw new ConvexError("Suggerimenti categoria non abilitati");
    }

    // Ottieni categorie della clinica
    const categories = await ctx.runQuery(api.categories.getCategoriesByClinic, { clinicId });
    
    // Ottieni esempi di ticket precedenti per apprendimento
    const recentTicketsResult = await ctx.runQuery(api.tickets.getByClinic, {});
    const ticketExamples = recentTicketsResult.tickets.slice(0, 20).map((t: any) => ({
      title: t.title,
      description: t.description.substring(0, 200),
      categoryId: t.categoryId,
    }));

    // Crea prompt per AI
    const prompt = `
Sei un esperto nel classificare ticket healthcare. Devi suggerire la categoria più appropriata.

TICKET DA CLASSIFICARE:
Titolo: ${title}
Descrizione: ${description}

CATEGORIE DISPONIBILI:
${categories.map((cat: any) => `- ID: ${cat._id}, Nome: ${cat.name}, Descrizione: ${cat.description || 'N/A'}, Sinonimi: ${cat.synonyms.join(', ')}`).join('\n')}

ESEMPI DI CLASSIFICAZIONI PRECEDENTI:
${ticketExamples.map((ex: any) => `Titolo: "${ex.title}" → Categoria: ${ex.categoryId}`).join('\n')}

Analizza il contenuto del ticket e restituisci:
1. L'ID della categoria più appropriata
2. Il livello di confidenza (0-100)
3. Una breve spiegazione del perché hai scelto questa categoria
4. Eventualmente una categoria alternativa

Formato di risposta JSON:
{
  "recommendedCategoryId": "categoria_id",
  "confidence": 85,
  "explanation": "Spiegazione della scelta",
  "alternativeCategory": "categoria_id_alternativa_o_null"
}
`;

    try {
      const aiResponse = await call_llm(prompt);
      const parsed = JSON.parse(aiResponse);
      
      // Valida che la categoria esista
      const recommendedCategory = categories.find((c: any) => c._id === parsed.recommendedCategoryId);
      
      return {
        recommendedCategory: recommendedCategory || null,
        confidence: parsed.confidence || 0,
        explanation: parsed.explanation || "Categoria suggerita basata sul contenuto",
        alternativeCategory: categories.find((c: any) => c._id === parsed.alternativeCategory) || null,
      };
    } catch (error) {
      console.error("Errore AI suggerimento categoria:", error);
      
      // Fallback: suggerisci categoria più comune
      const mostUsedCategory = categories.find((c: any) => c.name.toLowerCase().includes('generale')) || categories[0];
      
      return {
        recommendedCategory: mostUsedCategory || null,
        confidence: 20,
        explanation: "Suggerimento automatico: categoria generale",
        alternativeCategory: null,
      };
    }
  },
});

// Crea ticket con categoria suggerita
export const createTicketWithSuggestion = action({
  args: {
    title: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    clinicId: v.id("clinics"),
    userId: v.id("users"),
  },
  handler: async (ctx, { title, description, categoryId, clinicId, userId }): Promise<{
    ticketId: string;
    success: boolean;
    url: string;
  }> => {
    // Ottieni config agent
    const config = await ctx.runQuery(api.agent.getAgentConfig, { clinicId });
    if (!config.settings.canCreateTickets) {
      throw new ConvexError("Creazione ticket non abilitata");
    }

    // Crea il ticket usando la mutation esistente
    const ticketId = await ctx.runMutation(api.tickets.create, {
      title,
      description,
      categoryId,
      visibility: "public", // default
    });

    return {
      ticketId,
      success: true,
      url: `/tickets/${ticketId}`,
    };
  },
});

// Funzione principale dell'agent che gestisce le conversazioni
export const chatWithAgent = action({
  args: {
    threadId: v.id("agentThreads"),
    userMessage: v.string(),
    userId: v.id("users"),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { threadId, userMessage, userId, clinicId }): Promise<{
    response: string;
    metadata: any;
    success: boolean;
    error?: string;
  }> => {
    // Ottieni configurazione
    const config = await ctx.runQuery(api.agent.getAgentConfig, { clinicId });
    
    if (!config.isEnabled) {
      throw new ConvexError("Agent non abilitato per questa clinica");
    }

    // Aggiungi messaggio utente
    await ctx.runMutation(api.agent.addMessage, {
      threadId,
      role: "user",
      content: userMessage,
    });

    // Ottieni cronologia conversazione
    const messages = await ctx.runQuery(api.agent.getThreadMessages, { threadId });
    
    // Analizza l'intento dell'utente
    const intent = await analyzeUserIntent(userMessage);
    
    let responseContent = "";
    let metadata: any = {};

    try {
      switch (intent.type) {
        case "search_ticket":
          const searchResults = await ctx.runAction(api.agent.searchTickets, {
            query: intent.query!,
            clinicId,
            userId,
          });
          
          responseContent = formatSearchResults(searchResults);
          metadata.searchResults = searchResults;
          break;

        case "suggest_category":
          const suggestion = await ctx.runAction(api.agent.suggestCategory, {
            title: intent.title!,
            description: intent.description!,
            clinicId,
          });
          
          responseContent = formatCategorySuggestion(suggestion);
          metadata.suggestedCategory = suggestion.recommendedCategory?._id;
          metadata.suggestedTicket = { title: intent.title, description: intent.description };
          break;

        case "create_ticket":
          if (intent.categoryId && intent.title && intent.description) {
            const ticketResult = await ctx.runAction(api.agent.createTicketWithSuggestion, {
              title: intent.title,
              description: intent.description,
              categoryId: intent.categoryId as any,
              clinicId,
              userId,
            });
            
            responseContent = `✅ **Ticket creato con successo!**\n\nID: ${ticketResult.ticketId}\n\n[Visualizza ticket](${ticketResult.url})`;
          } else {
            responseContent = "❌ Informazioni mancanti per creare il ticket. Fornisci titolo, descrizione e categoria.";
          }
          break;

        default:
          // Conversazione generale con AI
          responseContent = await generateGeneralResponse(userMessage, messages, config.settings.systemPrompt);
          break;
      }

      // Aggiungi risposta assistant
      await ctx.runMutation(api.agent.addMessage, {
        threadId,
        role: "assistant",
        content: responseContent,
        metadata,
      });

      return {
        response: responseContent,
        metadata,
        success: true,
      };

    } catch (error) {
      console.error("Errore chat agent:", error);
      
      const errorResponse = "❌ Mi dispiace, ho riscontrato un errore. Riprova o contatta il supporto.";
      
      await ctx.runMutation(api.agent.addMessage, {
        threadId,
        role: "assistant",
        content: errorResponse,
      });

      return {
        response: errorResponse,
        metadata: {},
        success: false,
        error: (error as Error).message,
      };
    }
  },
});

// =================== HELPER FUNCTIONS ===================

async function analyzeUserIntent(message: string): Promise<{
  type: "search_ticket" | "suggest_category" | "create_ticket" | "general";
  query?: string;
  title?: string;
  description?: string;
  categoryId?: string;
}> {
  const messageLower = message.toLowerCase();

  // Keyword semplici per azioni esplicite (veloci, senza AI)
  if (messageLower.includes("cerca ticket") || messageLower.includes("trova ticket")) {
    const queryMatch = message.match(/cerca|trova\s+ticket\s+(.+)/i);
    return {
      type: "search_ticket",
      query: queryMatch?.[1] || message,
    };
  }

  // Conferma creazione ticket
  if (messageLower.includes("sì") || messageLower.includes("si") || messageLower.includes("conferma") || messageLower.includes("crea il ticket")) {
    return { type: "create_ticket" };
  }

  // Per tutto il resto, usa l'AI per capire l'intento
  try {
    const intentPrompt = `Analizza questo messaggio di un utente di una clinica dentistica e determina l'intento.

MESSAGGIO UTENTE: "${message}"

CONTESTO: L'utente sta interagendo con un assistente per un sistema di ticketing healthcare.

POSSIBILI INTENTI:
1. "search_ticket" - Vuole cercare un ticket esistente (es: "dov'è il mio ticket?", "stato del ticket 123")
2. "report_problem" - Sta segnalando un problema/richiesta e vuole aprire un ticket (es: "il riunito non funziona", "ho bisogno di aiuto con...")
3. "general" - Saluto, domanda generica, conversazione normale

RISPONDI SOLO con un JSON in questo formato:
{
  "intent": "search_ticket" | "report_problem" | "general",
  "confidence": 0-100,
  "extracted_info": {
    "problem_description": "breve descrizione del problema se presente",
    "urgency": "low" | "medium" | "high" | "unknown"
  }
}`;

    console.log("🤖 Analyzing intent for message:", message);
    const aiResponse = await call_llm(intentPrompt);
    console.log("🤖 AI Response:", aiResponse);
    
    const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());
    console.log("🤖 Parsed intent:", parsed);

    // Se l'utente sta segnalando un problema → suggerisci categoria
    if (parsed.intent === "report_problem") {
      console.log("✅ Detected report_problem, suggesting category");
      return {
        type: "suggest_category",
        title: message.substring(0, 100), // Prime 100 caratteri come titolo
        description: parsed.extracted_info?.problem_description || message,
      };
    }

    // Se vuole cercare ticket
    if (parsed.intent === "search_ticket") {
      console.log("✅ Detected search_ticket");
      return {
        type: "search_ticket",
        query: message,
      };
    }
    
    console.log("ℹ️ Intent is general, using general conversation");

  } catch (error) {
    console.error("❌ Errore analisi intento AI:", error);
    console.error("❌ Error details:", (error as Error).message);
  }

  // Fallback: conversazione generale
  return { type: "general" };
}

function formatSearchResults(results: any): string {
  if (results.totalFound === 0) {
    return `🔍 **Nessun ticket trovato** per "${results.query}"\n\nProva con termini diversi o controlla l'ID del ticket.`;
  }

  let response = `🔍 **Trovati ${results.totalFound} ticket** per "${results.query}":\n\n`;
  
  results.results.forEach((ticket: any, index: number) => {
    response += `**${index + 1}. ${ticket.title}**\n`;
    response += `Status: ${ticket.status} • ID: ${ticket.id}\n`;
    response += `${ticket.description}\n`;
    response += `[Apri ticket](${ticket.url})\n\n`;
  });

  return response;
}

function formatCategorySuggestion(suggestion: any): string {
  if (!suggestion.recommendedCategory) {
    return "❌ Non sono riuscito a suggerire una categoria appropriata. Contatta un amministratore.";
  }

  let response = `🎯 **Categoria suggerita**: ${suggestion.recommendedCategory.name}\n\n`;
  response += `📊 **Confidenza**: ${suggestion.confidence}%\n`;
  response += `💡 **Motivazione**: ${suggestion.explanation}\n\n`;
  
  if (suggestion.alternativeCategory) {
    response += `🔄 **Alternativa**: ${suggestion.alternativeCategory.name}\n\n`;
  }
  
  response += `Vuoi che crei il ticket in questa categoria? Rispondi "Sì" per confermare.`;
  
  return response;
}

async function generateGeneralResponse(message: string, messages: any[], systemPrompt: string): Promise<string> {
  const conversationHistory = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
  
  const prompt = `${systemPrompt}

CRONOLOGIA CONVERSAZIONE:
${conversationHistory}

ULTIMO MESSAGGIO UTENTE: ${message}

Rispondi in modo utile e professionale. Se l'utente ha bisogno di aiuto con ticket, guidalo verso le funzioni appropriate.`;

  try {
    return await call_llm(prompt);
  } catch (error) {
    console.error("Errore generazione risposta generale:", error);
    return "Ciao! Sono Ermes 🤖, il tuo assistente intelligente! Posso aiutarti a cercare ticket, suggerire categorie per nuovi ticket, e navigare nell'applicazione. Come posso aiutarti oggi? ✨";
  }
}

// =================== MUTATIONS SEMPLICI (per sviluppo) ===================

export const initializeAgentConfig = mutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const existing = await ctx.db
      .query("agentConfig")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .unique();

    if (!existing) {
      // Trova primo admin per questa clinica
      const admin = await ctx.db
        .query("users")
        .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
        .first(); // TODO: filtrare per ruolo admin

      if (!admin) {
        throw new ConvexError("Nessun utente trovato per questa clinica")
      }

      return await ctx.db.insert("agentConfig", {
        clinicId,
        isEnabled: true,
        settings: {
          canSearchTickets: true,
          canSuggestCategories: true,
          canCreateTickets: true,
          canAccessUserData: false,
          canAccessClinicsData: false,
          temperature: 0.8,
          maxTokens: 2048,
          systemPrompt: `Ciao! Sono Ermes, il tuo assistente intelligente per il sistema di gestione ticket healthcare.

Puoi aiutarti con:
- 🔍 Cercare ticket per ID, titolo o descrizione  
- 💡 Suggerire la categoria più appropriata per nuovi ticket
- ➕ Creare ticket automaticamente nella categoria suggerita
- 🧭 Navigare nell'applicazione e guidarti verso le funzioni giuste

Sono qui per rendere il tuo lavoro più semplice ed efficiente! Rispondi sempre in italiano, sii professionale ma amichevole, e usa emoji quando appropriato per rendere le conversazioni più piacevoli.`
        },
        lastUpdatedBy: admin._id,
      });
    }

    return existing._id;
  },
});

// Mutation semplificata per inizializzazione senza autenticazione (per sviluppo)
export const initializeAgentConfigSimple = mutation({
  args: { 
    clinicId: v.id("clinics"),
    userId: v.id("users")
  },
  handler: async (ctx, { clinicId, userId }) => {
    const existing = await ctx.db
      .query("agentConfig")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .unique();

    if (!existing) {
      return await ctx.db.insert("agentConfig", {
        clinicId,
        isEnabled: true,
        settings: {
          canSearchTickets: true,
          canSuggestCategories: true,
          canCreateTickets: true,
          canAccessUserData: false,
          canAccessClinicsData: false,
          temperature: 0.8,
          maxTokens: 2048,
          systemPrompt: `Ciao! Sono Ermes, il tuo assistente intelligente per il sistema di gestione ticket healthcare.

Puoi aiutarti con:
- 🔍 Cercare ticket per ID, titolo o descrizione  
- 💡 Suggerire la categoria più appropriata per nuovi ticket
- ➕ Creare ticket automaticamente nella categoria suggerita
- 🧭 Navigare nell'applicazione e guidarti verso le funzioni giuste

Sono qui per rendere il tuo lavoro più semplice ed efficiente! Rispondi sempre in italiano, sii professionale ma amichevole, e usa emoji quando appropriato per rendere le conversazioni più piacevoli.`
        },
        lastUpdatedBy: userId,
      });
    }

    return existing._id;
  },
});

// Mutation semplificata per aggiornamento senza autenticazione (per sviluppo)
// NOTA: Questa è una versione temporanea per lo sviluppo
// In produzione, usare updateAgentConfig che richiede autenticazione admin
export const updateAgentConfigSimple = mutation({
  args: {
    clinicId: v.id("clinics"),
    userId: v.id("users"),
    settings: v.object({
      canSearchTickets: v.boolean(),
      canSuggestCategories: v.boolean(),
      canCreateTickets: v.boolean(),
      canAccessUserData: v.boolean(),
      canAccessClinicsData: v.boolean(),
      temperature: v.number(),
      maxTokens: v.number(),
      systemPrompt: v.string(),
    }),
  },
  handler: async (ctx, { clinicId, userId, settings }) => {
    const existingConfig = await ctx.db
      .query("agentConfig")
      .withIndex("by_clinic", (q) => q.eq("clinicId", clinicId))
      .unique();

    if (existingConfig) {
      await ctx.db.patch(existingConfig._id, {
        settings,
        lastUpdatedBy: userId,
      });
      return existingConfig._id;
    } else {
      return await ctx.db.insert("agentConfig", {
        clinicId,
        isEnabled: true,
        settings,
        lastUpdatedBy: userId,
      });
    }
  },
});
