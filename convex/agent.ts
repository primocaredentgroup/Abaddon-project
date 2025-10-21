import { v } from "convex/values"
import { mutation, query, action } from "./_generated/server"
import { ConvexError } from "convex/values"
import { getCurrentUser } from "./lib/utils"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { api, internal } from "./_generated/api"
import { hasFullAccess, isAdminOrAgent } from "./lib/permissions"

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

    // Verifica che sia admin (controllo basato su permessi)
    if (!hasFullAccess(userWithRole.role)) {
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

// Salva feedback negativo sull'agent (quando l'utente rifiuta un suggerimento)
export const saveAgentFeedback = mutation({
  args: {
    userId: v.id("users"),
    clinicId: v.id("clinics"),
    suggestedCategoryId: v.id("categories"),
    suggestedCategoryName: v.string(),
    ticketTitle: v.string(),
    ticketDescription: v.string(),
    feedbackType: v.union(
      v.literal("wrong_category"),
      v.literal("general_error"),
      v.literal("positive")
    ),
    confidence: v.optional(v.number()),
    correctCategoryId: v.optional(v.id("categories")),
    correctCategoryName: v.optional(v.string()),
    userComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Crea thread fittizio per il feedback (o usa threadId se disponibile)
    const threadId = await ctx.db.insert("agentThreads", {
      userId: args.userId,
      clinicId: args.clinicId,
      title: `Feedback: ${args.ticketTitle}`,
      isActive: true,
      messageCount: 0,
      lastMessageAt: Date.now(),
    });

    const feedbackId = await ctx.db.insert("agentFeedback", {
      threadId,
      userId: args.userId,
      clinicId: args.clinicId,
      suggestedCategoryId: args.suggestedCategoryId,
      suggestedCategoryName: args.suggestedCategoryName,
      correctCategoryId: args.correctCategoryId,
      correctCategoryName: args.correctCategoryName,
      ticketTitle: args.ticketTitle,
      ticketDescription: args.ticketDescription,
      feedbackType: args.feedbackType,
      userComment: args.userComment,
      confidence: args.confidence,
      wasResolved: false,
    });

    return feedbackId;
  }
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
    userId: v.id("users"), // 🆕 Aggiungi userId per filtrare per società
  },
  handler: async (ctx, { title, description, clinicId, userId }): Promise<{
    recommendedCategory: any;
    confidence: number;
    explanation: string;
    alternativeCategory: any;
    requiredAttributes?: any[]; // 🆕 Attributi obbligatori
  }> => {
    // Ottieni config agent
    const config = await ctx.runQuery(api.agent.getAgentConfig, { clinicId });
    if (!config.settings.canSuggestCategories) {
      throw new ConvexError("Suggerimenti categoria non abilitati");
    }

    // Ottieni categorie della clinica
    const allCategories = await ctx.runQuery(api.categories.getCategoriesByClinic, { clinicId });
    
    // 🆕 Ottieni società dell'utente per filtrare categorie
    const userSocieties = await ctx.runQuery(api.userSocieties.getUserSocieties, { userId });
    const userSocietyIds = userSocieties?.map((us: any) => us.societyId) || [];
    
    // 🆕 Filtra categorie per società
    const categories = allCategories.filter((cat: any) => {
      // Se categoria non ha società, è pubblica per tutti
      if (!cat.societyIds || cat.societyIds.length === 0) {
        return true;
      }
      // Se categoria ha società, verifica che l'utente ne faccia parte
      return cat.societyIds.some((societyId: any) => userSocietyIds.includes(societyId));
    });
    
    // Ottieni esempi di ticket precedenti per apprendimento (usando query interna)
    const recentTickets = await ctx.runQuery(internal.tickets.getByClinicInternal, {
      clinicId,
      limit: 20,
    });
    const ticketExamples = recentTickets.map((t: any) => ({
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
      // Rimuovi backtick markdown se presenti
      const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedResponse);
      
      // Valida che la categoria esista
      const recommendedCategory = categories.find((c: any) => c._id === parsed.recommendedCategoryId);
      
      // Ottieni attributi obbligatori per la categoria suggerita
      let requiredAttributes: any[] = [];
      if (recommendedCategory) {
        requiredAttributes = await ctx.runQuery(api.categoryAttributes.getByCategory, {
          categoryId: recommendedCategory._id,
          showInCreation: true,
        }).then((attrs: any[]) => attrs.filter(attr => attr.required));
      }
      
      return {
        recommendedCategory: recommendedCategory || null,
        confidence: parsed.confidence || 0,
        explanation: parsed.explanation || "Categoria suggerita basata sul contenuto",
        alternativeCategory: categories.find((c: any) => c._id === parsed.alternativeCategory) || null,
        requiredAttributes, // 🆕 AGGIUNGO ATTRIBUTI OBBLIGATORI
      };
    } catch (error) {
      console.error("Errore AI suggerimento categoria:", error);
      
      // Fallback: suggerisci categoria più comune
      const mostUsedCategory = categories.find((c: any) => c.name.toLowerCase().includes('generale')) || categories[0];
      
      // Ottieni attributi obbligatori anche per fallback
      let requiredAttributes: any[] = [];
      if (mostUsedCategory) {
        try {
          requiredAttributes = await ctx.runQuery(api.categoryAttributes.getByCategory, {
            categoryId: mostUsedCategory._id,
            showInCreation: true,
          }).then((attrs: any[]) => attrs.filter(attr => attr.required));
        } catch (e) {
          console.error("Errore recupero attributi fallback:", e);
        }
      }
      
      return {
        recommendedCategory: mostUsedCategory || null,
        confidence: 20,
        explanation: "Suggerimento automatico: categoria generale",
        alternativeCategory: null,
        requiredAttributes, // 🆕 AGGIUNGO ATTRIBUTI OBBLIGATORI
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
    userEmail: v.string(), // 🆕 Passo direttamente l'email invece dell'ID
    attributes: v.optional(v.any()), // 🆕 Attributi raccolti {slug: value}
  },
  handler: async (ctx, { title, description, categoryId, clinicId, userEmail, attributes }): Promise<{
    ticketId: string;
    ticketNumber: number; // 🆕 Aggiungo ticketNumber
    success: boolean;
    url: string;
  }> => {
    
    // Ottieni config agent
    const config = await ctx.runQuery(api.agent.getAgentConfig, { clinicId });
    if (!config.settings.canCreateTickets) {
      throw new ConvexError("Creazione ticket non abilitata");
    }

    // Crea il ticket usando createWithAuth (senza Auth0)
    const result = await ctx.runMutation(api.tickets.createWithAuth, {
      title,
      description,
      categoryId,
      userEmail,
      visibility: "private", // default
    });


    // 🆕 Se ci sono attributi, salvali nella tabella ticketAttributes
    if (attributes && Object.keys(attributes).length > 0) {
      
      // Ottieni gli attributi della categoria per recuperare gli ID
      const categoryAttributes = await ctx.runQuery(api.categoryAttributes.getByCategory, {
        categoryId,
      });
      
      
      // Per ogni attributo raccolto, salvalo
      for (const [slug, value] of Object.entries(attributes)) {
        const attr = categoryAttributes?.find((a: any) => a.slug === slug);
        if (attr) {
          await ctx.runMutation(api.ticketAttributes.create, {
            ticketId: result.ticketId as any,
            attributeId: attr._id,
            value,
          });
        } else {
        }
      }
      
    }

    return {
      ticketId: result.ticketId,
      ticketNumber: result.ticketNumber, // 🆕 Ritorno anche il ticketNumber
      success: true,
      url: `/tickets/${result.ticketId}`,
    };
  },
});

// Funzione principale dell'agent che gestisce le conversazioni
export const chatWithAgent = action({
  args: {
    threadId: v.id("agentThreads"),
    userMessage: v.string(),
    userId: v.id("users"),
    userEmail: v.string(), // 🆕 Aggiungo email per creazione ticket
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, { threadId, userMessage, userId, userEmail, clinicId }): Promise<{
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
    
    // 🆕 CONTROLLA SE STIAMO ASPETTANDO ATTRIBUTI
    const lastAssistantMessage = messages
      .filter(m => m.role === "assistant")
      .sort((a, b) => b._creationTime - a._creationTime)[0];
    
    
    let intent: any;
    
    // Se stiamo aspettando attributi, NON analizzare l'intento con AI
    if (lastAssistantMessage?.metadata?.awaitingAttributes === true) {
      intent = {
        type: "provide_attributes" as const,
        attributeValues: userMessage, // Il messaggio dell'utente contiene i valori
      };
    } else {
      // Analizza l'intento normalmente
      intent = await analyzeUserIntent(userMessage);
    }
    
    let responseContent = "";
    let metadata: any = {};

    try {
      switch (intent.type) {
        case "correction":
          // 🆕 L'utente dice che l'agent ha sbagliato
          
          const lastSuggestion = lastAssistantMessage?.metadata?.suggestedCategory;
          const lastTicketInfo = lastAssistantMessage?.metadata?.suggestedTicket;
          
          if (lastSuggestion && lastTicketInfo) {
            // Salva il feedback negativo (lo faremo dopo)
            responseContent = `😔 Mi dispiace per l'errore! Grazie per avermelo fatto notare.\n\n`;
            responseContent += `Qual è la categoria corretta? Puoi:\n`;
            responseContent += `• Dirmi il nome della categoria\n`;
            responseContent += `• Scrivermi "mostra categorie" per vedere la lista completa\n\n`;
            responseContent += `Voglio imparare per fare meglio la prossima volta! 📝`;
            
            metadata.awaitingCorrection = true;
            metadata.wrongSuggestion = lastSuggestion;
            metadata.ticketInfo = lastTicketInfo;
          } else {
            responseContent = `😔 Mi dispiace! Cosa non va bene?\n\nPuoi spiegarmi meglio in modo che possa aiutarti? 🙏`;
          }
          break;

        case "fallback_help":
          // 🆕 L'utente non sa cosa fare
          
          responseContent = `😅 Ops! Non ho capito bene cosa intendi.\n\n`;
          responseContent += `Posso aiutarti con:\n`;
          responseContent += `🔍 Cercare ticket esistenti\n`;
          responseContent += `➕ Aprire un nuovo ticket\n`;
          responseContent += `💡 Suggerirti la categoria giusta per un problema\n\n`;
          responseContent += `Oppure puoi:\n`;
          responseContent += `👤 Contattare un operatore umano\n`;
          responseContent += `🔄 Riformulare la tua domanda in modo più specifico\n\n`;
          responseContent += `Cosa preferisci? 😊`;
          break;

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
            userId, // 🆕 Aggiungi userId per filtro società
          });
          
          
          responseContent = formatCategorySuggestion(suggestion);
          metadata.suggestedCategory = suggestion.recommendedCategory?._id;
          metadata.suggestedTicket = { title: intent.title, description: intent.description };
          metadata.requiredAttributes = suggestion.requiredAttributes || []; // 🆕 SALVA ATTRIBUTI OBBLIGATORI
          metadata.collectedAttributes = {}; // 🆕 INIT oggetto per valori
          
          // 🆕 SE CI SONO ATTRIBUTI OBBLIGATORI, SETTA IL FLAG!
          if (suggestion.requiredAttributes && suggestion.requiredAttributes.length > 0) {
            metadata.awaitingAttributes = true;
          }
          
          break;

        case "provide_attributes":
          // 🆕 L'utente sta fornendo i valori degli attributi obbligatori
          
          const attrMetadata = lastAssistantMessage?.metadata;
          const requiredAttrs = attrMetadata?.requiredAttributes || [];
          const attrCategoryId = attrMetadata?.suggestedCategory;
          const attrTicket = attrMetadata?.suggestedTicket;
          
          
          if (!attrCategoryId || !attrTicket || requiredAttrs.length === 0) {
            responseContent = "😅 Mi dispiace, qualcosa è andato storto. Non riesco a recuperare le informazioni necessarie. Ricominciamo?";
            break;
          }
          
          // 🔧 PARSING SEMPLICE: splitta il messaggio e assegna i valori in ordine
          const userValues = intent.attributeValues.trim().split(/\s+/); // Split per spazi
          const collectedAttrs: any = {};
          
          requiredAttrs.forEach((attr: any, index: number) => {
            if (index === 0 && userValues.length >= 2) {
              // Primo attributo: prendi i primi due token se ci sono (es: "mario rossi")
              collectedAttrs[attr.slug] = `${userValues[0]} ${userValues[1]}`;
            } else if (index === 1 && userValues.length >= 3) {
              // Secondo attributo: prendi il terzo token (es: "12343532")
              collectedAttrs[attr.slug] = userValues[2];
            }
          });
          
          
          // Crea il ticket con gli attributi
          const attrTicketResult = await ctx.runAction(api.agent.createTicketWithSuggestion, {
            title: attrTicket.title,
            description: attrTicket.description,
            categoryId: attrCategoryId as any,
            clinicId,
            userEmail,
            attributes: collectedAttrs, // 🆕 Passo gli attributi raccolti!
          });
          
          responseContent = `✅ Perfetto! Ho creato il ticket per te! 🎉\n\n🎫 **Ticket #${attrTicketResult.ticketNumber}**\n📋 **Oggetto**: ${attrTicket.title}\n\n📝 **Informazioni raccolte:**\n`;
          
          requiredAttrs.forEach((attr: any) => {
            if (collectedAttrs[attr.slug]) {
              responseContent += `• **${attr.name}**: ${collectedAttrs[attr.slug]}\n`;
            }
          });
          
          responseContent += `\nPuoi seguire lo stato del ticket dalla sezione "I miei ticket". Ti terremo aggiornato! 😊`;
          metadata.createdTicketId = attrTicketResult.ticketId;
          metadata.collectedAttributes = collectedAttrs;
          break;

        case "create_ticket":
          // Recupera i metadati dal messaggio precedente (categoria suggerita)
          const lastAssistantMessageForTicket = messages
            .filter(m => m.role === "assistant")
            .sort((a, b) => b._creationTime - a._creationTime)[0];
          
          
          const categoryId = intent.categoryId || lastAssistantMessageForTicket?.metadata?.suggestedCategory;
          const title = intent.title || lastAssistantMessageForTicket?.metadata?.suggestedTicket?.title;
          const description = intent.description || lastAssistantMessageForTicket?.metadata?.suggestedTicket?.description;
          const requiredAttributes = (lastAssistantMessageForTicket?.metadata as any)?.requiredAttributes || [];
          
          // 🆕 Se ci sono attributi obbligatori, chiediamoli
          if (requiredAttributes.length > 0 && categoryId && title && description) {
            responseContent = `📝 Perfetto! Prima di creare il ticket, ho bisogno di queste informazioni:\n\n`;
            requiredAttributes.forEach((attr: any, index: number) => {
              responseContent += `${index + 1}. **${attr.name}**`;
              if (attr.config.placeholder) {
                responseContent += ` (${attr.config.placeholder})`;
              }
              if (attr.type === 'select' && attr.config.options) {
                responseContent += `\n   📌 Opzioni: ${attr.config.options.join(', ')}`;
              }
              responseContent += `\n\n`;
            });
            responseContent += `Puoi fornirmele tutte insieme o una alla volta! 😊`;
            
            // Salva lo stato nei metadati per il prossimo messaggio
            metadata.awaitingAttributes = true;
            metadata.suggestedCategory = categoryId;
            metadata.suggestedTicket = { title, description };
            metadata.requiredAttributes = requiredAttributes;
            metadata.collectedAttributes = {};
          } else if (categoryId && title && description) {
            // Nessun attributo obbligatorio, crea direttamente il ticket
            const ticketResult = await ctx.runAction(api.agent.createTicketWithSuggestion, {
              title,
              description,
              categoryId: categoryId as any,
              clinicId,
              userEmail, // 🆕 Passo l'email invece dell'userId
            });
            
            responseContent = `✅ Perfetto! Ho creato il ticket per te! 🎉\n\n🎫 **Ticket #${ticketResult.ticketNumber}**\n📋 **Oggetto**: ${title}\n\nPuoi seguire lo stato del ticket dalla sezione "I miei ticket". Ti terremo aggiornato! 😊`;
            metadata.createdTicketId = ticketResult.ticketId;
          } else {
            responseContent = "😅 Ops! Mi mancano ancora alcune informazioni per aprire il ticket.\n\nPer aiutarti al meglio, ho bisogno di:\n• Una breve descrizione del problema\n• La categoria giusta\n\nProva a spiegarmi meglio cosa non funziona! 🙏";
          }
          break;

        default:
          // 🆕 Conversazione generale con AI (con fallback migliorato)
          try {
            responseContent = await generateGeneralResponse(userMessage, messages, config.settings.systemPrompt);
          } catch (error) {
            console.error("❌ [general] Error generating AI response:", error);
            // Fallback se l'AI fallisce
            responseContent = `😅 Ops! Non ho capito bene cosa intendi.\n\n`;
            responseContent += `Posso aiutarti con:\n`;
            responseContent += `🔍 **Cercare ticket** - "cerca ticket per problema stampante"\n`;
            responseContent += `➕ **Aprire ticket** - "il riunito dello studio 3 non funziona"\n`;
            responseContent += `💡 **Informazioni** - "come funziona il sistema ticket?"\n\n`;
            responseContent += `Oppure:\n`;
            responseContent += `👤 **Contatta operatore umano** - scrivi "operatore"\n\n`;
            responseContent += `Come posso aiutarti? 😊`;
          }
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
      
      const errorResponse = "😔 Ops! Qualcosa è andato storto da parte mia.\n\nPuoi riprovare tra un attimo? Se il problema persiste, contatta il supporto tecnico. Mi dispiace per l'inconveniente! 🙏";
      
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
  type: "search_ticket" | "suggest_category" | "create_ticket" | "general" | "correction" | "fallback_help";
  query?: string;
  title?: string;
  description?: string;
  categoryId?: string;
  correctionType?: "wrong_category" | "general_error";
  userFeedback?: string;
}> {
  const messageLower = message.toLowerCase();

  // 🆕 CORREZIONE: L'utente sta dicendo che l'agent ha sbagliato
  const correctionKeywords = /\b(no|sbagliato|non è corretto|non è questa|errato|non va bene|è sbagliato)\b/i;
  if (correctionKeywords.test(messageLower) && messageLower.length < 30) {
    return {
      type: "correction",
      correctionType: "wrong_category", // assume categoria sbagliata per ora
      userFeedback: message,
    };
  }

  // 🆕 RICHIESTA DI AIUTO: L'utente non sa cosa fare
  const helpKeywords = /\b(non capisco|aiuto|non so|cosa posso fare|come funziona|help)\b/i;
  if (helpKeywords.test(messageLower)) {
    return {
      type: "fallback_help",
    };
  }

  // Keyword semplici per azioni esplicite (veloci, senza AI)
  if (messageLower.includes("cerca ticket") || messageLower.includes("trova ticket")) {

    const queryMatch = message.match(/cerca|trova\s+ticket\s+(.+)/i);
    return {
      type: "search_ticket",
      query: queryMatch?.[1] || message,
    };
  }

  // Conferma creazione ticket - cerca parole intere, non substring
  const confirmWords = /\b(sì|si|conferma|ok|vai|procedi)\b/i;
  const createTicketPhrase = /crea\s+(il\s+)?ticket/i;
  
  if (confirmWords.test(messageLower) && messageLower.length < 15) {
    // Solo se il messaggio è breve (conferma secca)
    return { type: "create_ticket" };
  }
  
  if (createTicketPhrase.test(messageLower)) {
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

    const aiResponse = await call_llm(intentPrompt);
    
    const parsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, '').trim());

    // Se l'utente sta segnalando un problema → suggerisci categoria
    if (parsed.intent === "report_problem") {
      return {
        type: "suggest_category",
        title: message.substring(0, 100), // Prime 100 caratteri come titolo
        description: parsed.extracted_info?.problem_description || message,
      };
    }

    // Se vuole cercare ticket
    if (parsed.intent === "search_ticket") {
      return {
        type: "search_ticket",
        query: message,
      };
    }
    

  } catch (error) {
    console.error("❌ [analyzeUserIntent] Errore analisi intento AI:", error);
    console.error("❌ [analyzeUserIntent] Error details:", (error as Error).message);
  }

  // Fallback: conversazione generale
  return { type: "general" };
}

function formatSearchResults(results: any): string {
  if (results.totalFound === 0) {
    return `🔍 Hmm, non ho trovato ticket per "${results.query}"...\n\n Prova con altri termini o controlla l'ID del ticket. Se hai bisogno di aiuto, chiedimi pure! 😊`;
  }

  let response = `🔍 Ecco cosa ho trovato per "${results.query}":\n\n`;
  
  results.results.forEach((ticket: any, index: number) => {
    response += `**${index + 1}. ${ticket.title}**\n`;
    response += `📌 ${ticket.status} • ID: ${ticket.id}\n`;
    response += `${ticket.description}\n`;
    response += `[👉 Apri ticket](${ticket.url})\n\n`;
  });

  response += `\nTi serve altro? Sono qui! 💪`;

  return response;
}

function formatCategorySuggestion(suggestion: any): string {
  if (!suggestion.recommendedCategory) {
    return "😅 Mi dispiace, non sono riuscito a trovare la categoria giusta per questo problema. Puoi essere più specifico o contattare direttamente il supporto?";
  }

  let response = `Ciao! 👋 Ho capito il tuo problema.\n\n`;
  response += `📋 Penso che rientri nella categoria **${suggestion.recommendedCategory.name}**`;
  
  if (suggestion.confidence >= 80) {
    response += ` (sono abbastanza sicuro! ✅)`;
  } else if (suggestion.confidence >= 60) {
    response += ` (dovrebbe essere questa 🤔)`;
  } else {
    response += ` (non sono sicurissimo, ma ci proviamo 💭)`;
  }
  
  response += `\n\n💡 ${suggestion.explanation}\n\n`;
  
  if (suggestion.alternativeCategory) {
    response += `🔄 Oppure potrebbe essere: **${suggestion.alternativeCategory.name}**\n\n`;
  }
  
  // 🆕 SE CI SONO ATTRIBUTI OBBLIGATORI, CHIEDIGLI
  if (suggestion.requiredAttributes && suggestion.requiredAttributes.length > 0) {
    response += `📝 Per completare il ticket, ho bisogno di qualche informazione in più:\n\n`;
    suggestion.requiredAttributes.forEach((attr: any, index: number) => {
      response += `${index + 1}. **${attr.name}**`;
      if (attr.config.placeholder) {
        response += ` (${attr.config.placeholder})`;
      }
      if (attr.type === 'select' && attr.config.options) {
        response += `\n   Opzioni: ${attr.config.options.join(', ')}`;
      }
      response += `\n`;
    });
    response += `\nPuoi fornirmi queste informazioni? 😊`;
  } else {
    response += `Vuoi che crei il ticket in questa categoria? Rispondi **"Sì"** per confermare. 😊`;
  }
  
  return response;
}

async function generateGeneralResponse(message: string, messages: any[], systemPrompt: string): Promise<string> {
  const conversationHistory = messages
    .slice(-6) // Prendi solo gli ultimi 6 messaggi per non sovraccaricare il prompt
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n');
  
  const prompt = `${systemPrompt}

CRONOLOGIA CONVERSAZIONE RECENTE:
${conversationHistory}

ULTIMO MESSAGGIO UTENTE: ${message}

IMPORTANTE:
- Se l'utente sembra confuso o non sa cosa fare, elenca chiaramente le funzioni disponibili con ESEMPI concreti
- Se l'utente chiede qualcosa che non puoi fare, sii onesto e suggerisci alternative
- Se non capisci la richiesta, chiedi gentilmente di riformulare o offri esempi
- Mantieni un tono amichevole ma professionale
- Usa emoji in modo moderato per rendere la conversazione più piacevole

FUNZIONI DISPONIBILI:
🔍 Cercare ticket esistenti (es: "cerca ticket problema stampante")
➕ Aprire nuovo ticket (es: "il computer non si accende")
💡 Suggerire categorie per problemi
🧭 Guidare nell'uso dell'applicazione

Rispondi ora:`;

  try {
    const response = await call_llm(prompt);
    
    // Se la risposta dell'AI è troppo generica o vuota, usa il fallback
    if (response.length < 20 || response.toLowerCase().includes("non capisco")) {
      throw new Error("Response too generic");
    }
    
    return response;
  } catch (error) {
    console.error("❌ Errore generazione risposta generale:", error);
    
    // Fallback amichevole e informativo
    return `Ciao! 👋 Sono Ermes, il tuo assistente intelligente!\n\n` +
           `Posso aiutarti con:\n\n` +
           `🔍 **Cercare ticket**\n` +
           `   Esempio: "cerca ticket stampante" o "dov'è il ticket #123?"\n\n` +
           `➕ **Aprire nuovi ticket**\n` +
           `   Esempio: "il riunito dello studio 2 non funziona"\n\n` +
           `💡 **Suggerire la categoria giusta**\n` +
           `   Esempio: "ho un problema con la radiografia"\n\n` +
           `🧭 **Guidarti nell'app**\n` +
           `   Chiedi pure! "come funziona?" o "cosa posso fare?"\n\n` +
           `Come posso aiutarti oggi? 😊`;
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
