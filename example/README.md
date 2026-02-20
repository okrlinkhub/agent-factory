# Example app

Questa app dimostra il flusso completo del componente `agent-factory` senza logica
di dominio nel frontend:

1. seed del profilo agente `default`
2. import dei secrets di pairing (`telegram.botToken`, `fly.apiToken`)
3. avvio/reconcile workers Fly
4. enqueue dei messaggi e monitoraggio queue stats

## Avvio

Esegui tutto dalla root del repository:

```sh
npm i
npm run dev
```

## Flusso UI consigliato

Apri l'example e usa i blocchi nell'ordine:

1. **Seed default agent**
2. **Import telegram.botToken**
3. **Import fly.apiToken** (oppure passalo al volo al bottone start workers)
4. **Start/Reconcile workers**
5. **Queue ingress demo** per enqueue test

## Pairing one-time Telegram -> user -> agent

Nel modello finale il mapping vive nel componente (`identityBindings`):

1. utente autenticato nel consumer
2. pairing one-time (es. deep-link Telegram + token)
3. chiamata API `bindUserAgent` con:
   - `consumerUserId`
   - `agentKey`
   - opzionale `telegramUserId` / `telegramChatId`
4. il webhook usa il mapping interno per risolvere `agentKey` in ingresso

## Vincolo env vars

Il componente non legge env vars del consumer Convex. Se serve un valore runtime:

- o lo passi esplicitamente come argomento API dal consumer
- o lo importi nel secret store del componente (scelta consigliata per token persistenti)
