# 🚀 MIGRATION: Popolare Stati Ticket

## Come eseguire la migration

### Opzione 1: Via Dashboard Convex (CONSIGLIATO)

1. Apri la dashboard Convex: https://dashboard.convex.dev/d/aware-impala-662
2. Vai su **Functions** → **ticketStatuses**
3. Trova la funzione `initializeDefaultStatuses`
4. Clicca su **Run** senza parametri
5. Verifica che restituisca: `{ message: "3 stati inizializzati", count: 3 }`

### Opzione 2: Via Console Browser

Apri la console del browser nella tua app e esegui:

```javascript
// Importa la mutation
const { useMutation } = require('convex/react');
const { api } = require('./convex/_generated/api');

// Esegui la migration
const initStatuses = useMutation(api.ticketStatuses.initializeDefaultStatuses);
initStatuses({}).then(result => console.log(result));
```

### Opzione 3: Creando una API Route temporanea

Crea il file `/src/app/api/migrate-statuses/route.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  const result = await client.mutation(api.ticketStatuses.initializeDefaultStatuses, {});
  return Response.json(result);
}
```

Poi visita: http://localhost:3000/api/migrate-statuses (metodo POST)

## Stati che verranno creati

1. **Aperto** (`open`) - Rosso #ef4444
   - Ticket appena creato, in attesa di lavorazione
   
2. **In Corso** (`in_progress`) - Arancione #f59e0b
   - Ticket in lavorazione da un agente
   
3. **Chiuso** (`closed`) - Verde #22c55e
   - Ticket completato e chiuso

## Verifica

Dopo la migration, verifica che gli stati siano stati creati:

1. Dashboard Convex → Data → ticketStatuses
2. Dovresti vedere 3 record con isSystem=true

## Note

- Gli stati di sistema (`isSystem: true`) non possono essere eliminati
- Puoi aggiungere nuovi stati personalizzati successivamente
- Il frontend si aggiornerà automaticamente quando aggiungi nuovi stati
