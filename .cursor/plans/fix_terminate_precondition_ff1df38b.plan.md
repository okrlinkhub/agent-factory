---
name: Fix terminate precondition
overview: Rendere robusta la terminazione worker Fly evitando errori `failed_precondition` quando una macchina è ancora avviata durante il reconcile.
todos:
  - id: provider-stop-method
    content: Aggiungere e implementare `stopWorker` nel provider Fly
    status: pending
  - id: scheduler-drain-flow
    content: Aggiornare il flusso di scale-down a `cordon -> stop -> terminate`
    status: pending
  - id: state-consistency
    content: Evitare aggiornamento a `stopped` quando la delete non è completata
    status: pending
  - id: error-handling
    content: Separare errori safe-idempotenti da errori retryabili (`failed_precondition`)
    status: pending
  - id: validate
    content: Controllare lints/typecheck e comportamento runtime via log
    status: pending
isProject: false
---

# Piano: terminazione worker Fly robusta

## Obiettivo

Eliminare i fallimenti del reconcile quando Fly rifiuta `DELETE` su macchine non ancora stoppate, mantenendo coerente lo stato locale dei worker.

## Modifiche previste

- Estendere il contratto provider in `[/Users/williamzisa/Coding/agent-factory/src/component/providers/fly.ts](/Users/williamzisa/Coding/agent-factory/src/component/providers/fly.ts)`:
  - aggiungere `stopWorker(appName, machineId)` a `WorkerProvider`.
  - implementare `stopWorker` in `FlyMachinesProvider` usando endpoint Fly di stop/suspend.
- Rifinire il flusso di scale-down in `[/Users/williamzisa/Coding/agent-factory/src/component/scheduler.ts](/Users/williamzisa/Coding/agent-factory/src/component/scheduler.ts)`:
  - sostituire `cordon -> terminate` con `cordon -> stop -> terminate`.
  - gestire in modo non-fatal il `failed_precondition` come condizione transitoria (retry al prossimo reconcile), senza interrompere tutta l’action.
- Correggere la coerenza dello stato DB in `[/Users/williamzisa/Coding/agent-factory/src/component/scheduler.ts](/Users/williamzisa/Coding/agent-factory/src/component/scheduler.ts)`:
  - aggiornare `upsertWorkerState` a `stopped` solo quando la terminazione è effettivamente avvenuta (o macchina già assente).
  - se la terminazione è rinviata (precondition), lasciare il worker `active`/in transizione così il prossimo ciclo riprova.
- Consolidare la classificazione errori in `[/Users/williamzisa/Coding/agent-factory/src/component/scheduler.ts](/Users/williamzisa/Coding/agent-factory/src/component/scheduler.ts)`:
  - mantenere `not found` come safe/idempotente.
  - distinguere `failed_precondition` come retryabile ma non “missing machine”.

## Verifica

- Eseguire typecheck/lint sui file toccati.
- Verificare via log che `reconcileWorkers` non fallisca più con `failed_precondition` e che i worker vengano terminati entro 1-2 cicli di reconcile.
- Verificare che i contatori `terminated` e `activeWorkers` riflettano lo stato reale dopo scale-down.

