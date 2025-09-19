# Requirements Document

## Introduction

Sistema di gestione ticket core altamente scalabile e personalizzabile per cliniche sanitarie. Il focus è su semplicità d'uso, reattività dell'interfaccia e massima configurabilità attraverso attributi polimorfi. Il sistema deve essere security-first, velocity-first e completamente basato su Convex senza esposizioni API dirette.

## Requirements

### Requirement 1

**User Story:** Come utente, voglio creare ticket con informazioni essenziali in modo semplice e intuitivo, così da poter segnalare rapidamente le mie richieste.

#### Acceptance Criteria

1. WHEN un utente crea un ticket THEN il sistema SHALL richiedere sempre titolo, descrizione e categoria come campi base
2. WHEN un utente seleziona una categoria THEN il sistema SHALL mostrare dinamicamente gli attributi aggiuntivi configurati per quella categoria
3. WHEN un admin configura attributi per categoria THEN il sistema SHALL permettere di renderli obbligatori o opzionali in fase di creazione
4. WHEN un utente crea un ticket THEN il sistema SHALL assegnare automaticamente il richiedente come utente loggato
5. WHEN un utente crea un ticket THEN il sistema SHALL impostare automaticamente lo stato su "Aperto"
6. WHEN un utente crea un ticket THEN il sistema SHALL associare automaticamente la clinica dell'utente

### Requirement 2

**User Story:** Come amministratore, voglio configurare la visibilità dei ticket (pubblici/privati) come impostazione globale o basata su trigger, così da controllare la privacy secondo le esigenze della clinica.

#### Acceptance Criteria

1. WHEN un admin configura le impostazioni THEN il sistema SHALL permettere di abilitare/disabilitare la funzionalità ticket pubblici/privati
2. IF la funzionalità è disabilitata THEN il sistema SHALL rendere tutti i ticket privati per default
3. IF la funzionalità è abilitata THEN il sistema SHALL permettere agli utenti di scegliere visibilità pubblica o privata
4. WHEN si configurano trigger THEN il sistema SHALL permettere di impostare automaticamente la visibilità basata su condizioni
5. WHEN un utente visualizza ticket THEN il sistema SHALL mostrare solo ticket pubblici della clinica e i propri ticket privati

### Requirement 3

**User Story:** Come agente o amministratore, voglio gestire l'assegnazione dei ticket in modo controllato, così da mantenere un workflow organizzato e sicuro.

#### Acceptance Criteria

1. WHEN un utente normale crea un ticket THEN il sistema SHALL impedire la selezione dell'assegnatario
2. WHEN un agente gestisce un ticket THEN il sistema SHALL permettere l'assegnazione a se stesso o ad altri agenti
3. WHEN un admin gestisce un ticket THEN il sistema SHALL permettere l'assegnazione a qualsiasi agente della clinica
4. WHEN si configurano trigger THEN il sistema SHALL permettere l'assegnazione automatica basata su condizioni
5. WHEN un ticket non ha assegnatario THEN il sistema SHALL mostrarlo come "Non assegnato"

### Requirement 4

**User Story:** Come utente del sistema, voglio che i ticket abbiano stati semplici e chiari, così da comprendere facilmente lo stato di avanzamento.

#### Acceptance Criteria

1. WHEN si gestisce un ticket THEN il sistema SHALL supportare solo tre stati: "Aperto", "In lavorazione", "Chiuso"
2. WHEN un ticket viene creato THEN il sistema SHALL impostare automaticamente lo stato su "Aperto"
3. WHEN un agente prende in carico un ticket THEN il sistema SHALL permettere il cambio stato a "In lavorazione"
4. WHEN un ticket viene risolto THEN il sistema SHALL permettere il cambio stato a "Chiuso"
5. WHEN un ticket è "Chiuso" THEN il sistema SHALL impedire ulteriori modifiche eccetto per admin

### Requirement 5

**User Story:** Come amministratore, voglio configurare attributi personalizzabili per categorie in modo semplice e intuitivo, così da adattare il sistema senza competenze tecniche.

#### Acceptance Criteria

1. WHEN un admin configura una categoria THEN il sistema SHALL fornire un'interfaccia drag-and-drop per aggiungere attributi
2. WHEN un admin crea un attributo THEN il sistema SHALL permettere di scegliere tipo (testo, numero, data, selezione, checkbox) con preview immediato
3. WHEN un admin configura un attributo THEN il sistema SHALL permettere di impostarlo come obbligatorio/opzionale e visibile/nascosto in creazione
4. WHEN si seleziona una categoria in creazione ticket THEN il sistema SHALL mostrare dinamicamente solo gli attributi configurati come visibili
5. WHEN si configurano attributi THEN il sistema SHALL supportare condizioni semplici (es: "mostra solo se priorità = alta")
6. WHEN un admin salva configurazioni THEN il sistema SHALL fornire anteprima del form di creazione ticket risultante

### Requirement 6

**User Story:** Come utente, voglio visualizzare e interagire con i ticket attraverso un'interfaccia chat-like minimale, così da avere un'esperienza familiare e efficace.

#### Acceptance Criteria

1. WHEN un utente apre un ticket THEN il sistema SHALL mostrare una vista chat con titolo, descrizione iniziale e commenti
2. WHEN un utente è il creatore del ticket THEN il sistema SHALL permettere la modifica di titolo e descrizione
3. WHEN un utente non è il creatore THEN il sistema SHALL impedire la modifica di titolo e descrizione
4. WHEN un utente aggiunge un commento THEN il sistema SHALL mostrarlo immediatamente nella chat
5. WHEN si visualizza la chat THEN il sistema SHALL mostrare timestamp, autore e contenuto per ogni messaggio
6. WHEN un agente/admin gestisce il ticket THEN il sistema SHALL mostrare controlli per cambio stato e assegnazione in modo discreto

### Requirement 7

**User Story:** Come utente del sistema, voglio che l'interfaccia sia reattiva e performante, così da poter lavorare efficacemente anche con molti ticket.

#### Acceptance Criteria

1. WHEN si caricano liste di ticket THEN il sistema SHALL utilizzare paginazione o virtual scrolling per performance
2. WHEN si aggiorna un ticket THEN il sistema SHALL aggiornare l'interfaccia in tempo reale tramite Convex subscriptions
3. WHEN si cerca tra i ticket THEN il sistema SHALL fornire risultati istantanei con debouncing
4. WHEN si naviga tra ticket THEN il sistema SHALL mantenere lo stato della lista per ritorno rapido
5. WHEN si utilizzano filtri THEN il sistema SHALL applicarli immediatamente senza reload della pagina

### Requirement 8

**User Story:** Come sviluppatore del sistema, voglio un'architettura sicura e scalabile che rispetti i principi security-first e velocity-first, così da garantire robustezza e manutenibilità.

#### Acceptance Criteria

1. WHEN si accede ai dati THEN il sistema SHALL utilizzare solo Convex functions senza esposizione API diretta
2. WHEN si validano input THEN il sistema SHALL utilizzare validatori Convex per sicurezza lato server
3. WHEN si gestiscono permessi THEN il sistema SHALL controllare autorizzazioni a livello di Convex function
4. WHEN si strutturano dati THEN il sistema SHALL utilizzare schema polimorfi per flessibilità futura
5. WHEN si sviluppano feature THEN il sistema SHALL mantenere separazione netta tra logica business e presentazione

### Requirement 9

**User Story:** Come amministratore non tecnico, voglio configurare il sistema attraverso interfacce intuitive e guidate, così da personalizzare il workflow senza competenze di programmazione.

#### Acceptance Criteria

1. WHEN un admin accede alle configurazioni THEN il sistema SHALL fornire wizard guidati con spiegazioni chiare per ogni opzione
2. WHEN un admin configura attributi THEN il sistema SHALL mostrare esempi pratici e preview in tempo reale
3. WHEN un admin imposta condizioni THEN il sistema SHALL utilizzare linguaggio naturale (es: "Se categoria è X allora mostra campo Y")
4. WHEN un admin salva configurazioni THEN il sistema SHALL validare e mostrare warning per configurazioni potenzialmente problematiche
5. WHEN un admin gestisce il sistema THEN il sistema SHALL fornire help contestuale e suggerimenti per best practices

### Requirement 10

**User Story:** Come amministratore, voglio monitorare e auditare tutte le azioni sui ticket, così da mantenere tracciabilità e conformità.

#### Acceptance Criteria

1. WHEN si modifica un ticket THEN il sistema SHALL registrare automaticamente l'azione nell'audit log
2. WHEN si visualizza lo storico THEN il sistema SHALL mostrare cronologia completa con dettagli delle modifiche
3. WHEN si cambiano stati o assegnazioni THEN il sistema SHALL notificare gli utenti interessati
4. WHEN si configurano notifiche THEN il sistema SHALL permettere personalizzazione per tipo di evento
5. WHEN si accede all'audit log THEN il sistema SHALL permettere filtri per utente, data e tipo di azione