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
4. **Bind User to Agent** (manuale admin/debug) oppure **Pairing Wizard (/start)** per utente finale
5. **Start/Reconcile workers**
6. **Queue ingress demo** per enqueue test

Note runtime:
- il consumer example fa ingress + enqueue + pairing;
- il processing loop dei job è lato worker Fly;
- i token Telegram devono stare nel secret store del componente (scoped per agente), non nelle env globali Fly.
- il consumer non deve implementare wrapper custom claim/complete/fail: usa il contratto worker esposto dal componente.

## Pairing guidato via /start

Nel wizard UI:

1. seleziona utente e `agentKey`;
2. genera pairing code;
3. invia all'utente deep-link `https://t.me/<botUsername>?start=<code>`;
4. quando l'utente invia `/start <code>`, il webhook del componente completa automaticamente il bind Telegram.

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
