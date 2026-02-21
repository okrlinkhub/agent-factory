import "./App.css";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

function App() {
  const enqueue = useMutation(api.example.enqueue);
  const seedDefaultAgent = useMutation(api.example.seedDefaultAgent);
  const seedExampleUsers = useMutation(api.example.seedExampleUsers);
  const importSecret = useMutation(api.example.importSecret);
  const bindUserAgent = useMutation(api.example.bindUserAgent);
  const createPairingCode = useMutation(api.example.createPairingCode);
  const startWorkers = useAction(api.example.startWorkers);
  const stats = useQuery(api.example.queueStats, {});
  const workerStats = useQuery(api.example.workerStats, {});
  const users = useQuery(api.example.listExampleUsers, {});
  const usersWithBindings = useQuery(api.example.listUsersWithBindings, {});
  const secretsStatus = useQuery(api.example.secretStatus, {
    secretRefs: ["convex.url", "telegram.botToken", "fly.apiToken"],
  });
  const [latestPairingCode, setLatestPairingCode] = useState("");
  const pairingStatus = useQuery(
    api.example.getPairingCodeStatus,
    latestPairingCode ? { code: latestPairingCode } : "skip",
  );
  const [chatId, setChatId] = useState("947270381897662534");
  const [messageText, setMessageText] = useState("Ciao da Telegram ingress");
  const [convexSecretUrl, setConvexSecretUrl] = useState(import.meta.env.VITE_CONVEX_URL ?? "");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [flyApiToken, setFlyApiToken] = useState("");
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [usersResult, setUsersResult] = useState<string | null>(null);
  const [secretResult, setSecretResult] = useState<string | null>(null);
  const [bindingResult, setBindingResult] = useState<string | null>(null);
  const [workersResult, setWorkersResult] = useState<string | null>(null);
  const [pairingResult, setPairingResult] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [bindingAgentKey, setBindingAgentKey] = useState("default");
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [telegramUserIdForBinding, setTelegramUserIdForBinding] = useState("");
  const [telegramChatIdForBinding, setTelegramChatIdForBinding] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const convexUrl = import.meta.env.VITE_CONVEX_URL.replace(".cloud", ".site");
  const convexSecretStatus = (secretsStatus ?? []).find((item) => item.secretRef === "convex.url");

  const enqueueMessage = async () => {
    setBusy("enqueue");
    try {
      await enqueue({
        conversationId: `telegram:${chatId}`,
        agentKey: "default",
        provider: "telegram",
        providerUserId: chatId,
        messageText,
      });
      setMessageText("");
    } finally {
      setBusy(null);
    }
  };

  const seedAgent = async () => {
    setBusy("seed");
    setSeedResult(null);
    try {
      await seedDefaultAgent({});
      setSeedResult("Profilo agente default configurato.");
    } catch (error) {
      setSeedResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const seedUsers = async () => {
    setBusy("seed-users");
    setUsersResult(null);
    try {
      const result = await seedExampleUsers({});
      setUsersResult(`Utenti example seedati. Nuovi inseriti: ${result.inserted}.`);
    } catch (error) {
      setUsersResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveSecret = async (secretRef: string, plaintextValue: string) => {
    setBusy(secretRef);
    setSecretResult(null);
    try {
      const result = await importSecret({ secretRef, plaintextValue });
      setSecretResult(`Secret ${result.secretRef} aggiornato (v${result.version}).`);
    } catch (error) {
      setSecretResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startWorkerPool = async () => {
    setBusy("workers");
    setWorkersResult(null);
    try {
      const result = await startWorkers({
        flyApiToken: flyApiToken.trim() || undefined,
        convexUrl: import.meta.env.VITE_CONVEX_URL,
        workspaceId: "default",
      });
      setWorkersResult(
        `Workers desiderati: ${result.desiredWorkers}, attivi: ${result.activeWorkers}, spawned: ${result.spawned}, terminated: ${result.terminated}.`,
      );
    } catch (error) {
      setWorkersResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const bindSelectedUser = async () => {
    if (!selectedUserId) return;
    setBusy("bind-user");
    setBindingResult(null);
    try {
      const result = await bindUserAgent({
        consumerUserId: selectedUserId,
        agentKey: bindingAgentKey.trim() || "default",
        source: "manual",
        telegramUserId: telegramUserIdForBinding.trim() || undefined,
        telegramChatId: telegramChatIdForBinding.trim() || undefined,
      });
      setBindingResult(
        `Binding attivo: user=${result.consumerUserId} -> agent=${result.agentKey}.`,
      );
    } catch (error) {
      setBindingResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const generatePairingCode = async () => {
    if (!selectedUserId) return;
    setBusy("pairing-code");
    setPairingResult(null);
    try {
      const result = await createPairingCode({
        consumerUserId: selectedUserId,
        agentKey: bindingAgentKey.trim() || "default",
      });
      setLatestPairingCode(result.code);
      setPairingResult(
        `Pairing code creato per user=${result.consumerUserId}, agent=${result.agentKey}. Scade alle ${new Date(
          result.expiresAt,
        ).toLocaleTimeString()}.`,
      );
    } catch (error) {
      setPairingResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h1>Agent Factory Example</h1>
      <div className="card">
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>0) Mandatory: configure convex.url secret</h3>
          <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            Prima di avviare autoscaling/cron, salva <code>convex.url</code> nel secret store del
            componente.
          </p>
          <p style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "0.9rem" }}>
            Stato attuale:{" "}
            <strong>
              {convexSecretStatus?.hasActive
                ? `already set (v${convexSecretStatus.version ?? "?"})`
                : "missing"}
            </strong>
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={convexSecretUrl}
              onChange={(event) => setConvexSecretUrl(event.target.value)}
              placeholder="https://<deployment>.convex.cloud"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "55%" }}
            />
            <button
              onClick={() => saveSecret("convex.url", convexSecretUrl)}
              disabled={busy !== null || convexSecretUrl.trim().length === 0}
            >
              Import convex.url
            </button>
          </div>
          <p style={{ marginTop: 0, marginBottom: 0, fontSize: "0.85rem" }}>
            Se il secret non e` impostato, il cron reconcile fallisce con errore
            <code> Missing Convex URL</code>.
          </p>
          {secretResult ? <p style={{ marginTop: "0.5rem" }}>{secretResult}</p> : null}
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>1) Seed Agent</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Crea/aggiorna il profilo `default` usando la logica del componente.
          </p>
          <button onClick={seedAgent} disabled={busy !== null}>
            {busy === "seed" ? "Seeding..." : "Seed default agent"}
          </button>
          {seedResult ? <p style={{ marginTop: "0.5rem" }}>{seedResult}</p> : null}
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>1b) Seed Users (consumer mock)</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Crea utenti fake nel solo example per simulare `users._id` del consumer.
          </p>
          <button onClick={seedUsers} disabled={busy !== null}>
            {busy === "seed-users" ? "Seeding..." : "Seed example users"}
          </button>
          {usersResult ? <p style={{ marginTop: "0.5rem" }}>{usersResult}</p> : null}
          <p style={{ fontSize: "0.9rem", marginTop: "0.5rem", marginBottom: 0 }}>
            Utenti disponibili: <strong>{users?.length ?? 0}</strong>
          </p>
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>2) Pairing Secrets</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Importa i secrets necessari (plaintext in input, cifratura lato componente).
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              type="password"
              value={telegramBotToken}
              onChange={(event) => setTelegramBotToken(event.target.value)}
              placeholder="telegram bot token"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "55%" }}
            />
            <button
              onClick={() => saveSecret("telegram.botToken", telegramBotToken)}
              disabled={busy !== null || telegramBotToken.trim().length === 0}
            >
              Import telegram.botToken
            </button>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              type="password"
              value={flyApiToken}
              onChange={(event) => setFlyApiToken(event.target.value)}
              placeholder="fly api token (opzionale: salva nel componente)"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "55%" }}
            />
            <button
              onClick={() => saveSecret("fly.apiToken", flyApiToken)}
              disabled={busy !== null || flyApiToken.trim().length === 0}
            >
              Import fly.apiToken
            </button>
          </div>
          <p style={{ fontSize: "0.9rem", margin: 0 }}>
            Stato secrets:{" "}
            {(secretsStatus ?? []).map((item) => (
              <span key={item.secretRef} style={{ marginRight: "0.75rem" }}>
                <strong>{item.secretRef}</strong>:{" "}
                {item.hasActive ? `ok (v${item.version ?? "?"})` : "missing"}
              </span>
            ))}
          </p>
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>3) Bind User to Agent</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Associa un utente fake (`users._id`) a un `agentKey` direttamente nel componente.
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            >
              <option value="">Seleziona utente</option>
              {(users ?? []).map((user) => (
                <option key={user._id} value={user._id}>
                  {user.displayName} ({user.handle})
                </option>
              ))}
            </select>
            <input
              value={bindingAgentKey}
              onChange={(event) => setBindingAgentKey(event.target.value)}
              placeholder="agent key"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "20%" }}
            />
            <button
              onClick={bindSelectedUser}
              disabled={busy !== null || selectedUserId.length === 0}
            >
              {busy === "bind-user" ? "Binding..." : "Bind user"}
            </button>
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <input
              value={telegramUserIdForBinding}
              onChange={(event) => setTelegramUserIdForBinding(event.target.value)}
              placeholder="telegramUserId (opzionale)"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            />
            <input
              value={telegramChatIdForBinding}
              onChange={(event) => setTelegramChatIdForBinding(event.target.value)}
              placeholder="telegramChatId (opzionale)"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            />
          </div>
          {bindingResult ? <p style={{ marginTop: "0.5rem" }}>{bindingResult}</p> : null}
          <div style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
            <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              Binding correnti (user -&gt; agent):
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>User</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>user._id</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                    agentKey
                  </th>
                </tr>
              </thead>
              <tbody>
                {(usersWithBindings ?? []).map((user) => (
                  <tr key={user._id}>
                    <td style={{ paddingTop: "0.25rem" }}>
                      {user.displayName} ({user.handle})
                    </td>
                    <td style={{ paddingTop: "0.25rem" }}>
                      <code>{user._id}</code>
                    </td>
                    <td style={{ paddingTop: "0.25rem" }}>
                      {user.agentKey ? <strong>{user.agentKey}</strong> : "unbound"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>3b) Pairing Wizard (/start)</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Genera un pairing code one-time e condividi il deep-link Telegram. Quando
            l&apos;utente invia <code>/start &lt;code&gt;</code>, il webhook del componente
            completa automaticamente il bind Telegram.
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={telegramBotUsername}
              onChange={(event) => setTelegramBotUsername(event.target.value)}
              placeholder="telegram bot username (senza @)"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            />
            <button
              onClick={generatePairingCode}
              disabled={busy !== null || selectedUserId.length === 0}
            >
              {busy === "pairing-code" ? "Generating..." : "Generate pairing code"}
            </button>
          </div>
          {latestPairingCode ? (
            <div style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
              <div>
                Pairing code: <code>{latestPairingCode}</code>
              </div>
              {telegramBotUsername.trim() ? (
                <div style={{ marginTop: "0.35rem" }}>
                  Deep-link:{" "}
                  <code>
                    {`https://t.me/${telegramBotUsername.trim()}?start=${latestPairingCode}`}
                  </code>
                </div>
              ) : null}
            </div>
          ) : null}
          {pairingStatus ? (
            <p style={{ fontSize: "0.9rem", marginTop: "0.5rem", marginBottom: 0 }}>
              Stato pairing: <strong>{pairingStatus.status}</strong>
              {pairingStatus.telegramUserId
                ? ` | telegramUserId=${pairingStatus.telegramUserId}`
                : ""}
              {pairingStatus.telegramChatId
                ? ` | telegramChatId=${pairingStatus.telegramChatId}`
                : ""}
            </p>
          ) : null}
          {pairingResult ? <p style={{ marginTop: "0.5rem" }}>{pairingResult}</p> : null}
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: 0 }}>
            Secret richiesto per questo agente:{" "}
            <code>{`telegram.botToken.${(bindingAgentKey.trim() || "default").toLowerCase()}`}</code>
          </p>
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>4) Start Workers (Fly)</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Esegue il reconcile pool worker. Se non passi token, usa `fly.apiToken` dal
            secret store interno del componente.
          </p>
          <button onClick={startWorkerPool} disabled={busy !== null}>
            {busy === "workers" ? "Reconciling..." : "Start/Reconcile workers"}
          </button>
          <p style={{ fontSize: "0.9rem", marginTop: "0.75rem", marginBottom: 0 }}>
            Worker attivi: <strong>{workerStats?.activeCount ?? 0}</strong> | Idle:{" "}
            <strong>{workerStats?.idleCount ?? 0}</strong>
          </p>
          {workersResult ? <p style={{ marginTop: "0.5rem" }}>{workersResult}</p> : null}
        </div>
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>5) Queue Ingress Demo</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Configure at least one agent profile before enqueueing messages.
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <input
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
              placeholder="chat/user id"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            />
            <input
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="message text"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "45%" }}
            />
            <button
              onClick={enqueueMessage}
              disabled={busy !== null || messageText.trim().length === 0}
            >
              {busy === "enqueue" ? "Enqueue..." : "Enqueue message"}
            </button>
          </div>
          <p style={{ fontSize: "0.9rem", marginTop: "0.75rem" }}>
            Queue ready: <strong>{stats?.queuedReady ?? 0}</strong> | Processing:{" "}
            <strong>{stats?.processing ?? 0}</strong> | Dead letter:{" "}
            <strong>{stats?.deadLetter ?? 0}</strong>
          </p>
        </div>
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.08)",
            borderRadius: "8px",
          }}
        >
          <h3>Webhook Endpoint</h3>
          <p style={{ marginBottom: "0.5rem" }}>
            Telegram ingress route is mounted at:
          </p>
          <code>{convexUrl}/agent-factory/telegram/webhook</code>
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.75rem" }}>
            See <code>example/convex/http.ts</code> and <code>example/convex/example.ts</code>.
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
