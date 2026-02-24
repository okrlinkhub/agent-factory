import "./App.css";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";

function App() {
  const seedDefaultAgent = useMutation(api.example.seedDefaultAgent);
  const seedExampleUsers = useMutation(api.example.seedExampleUsers);
  const importSecret = useMutation(api.example.importSecret);
  const bindUserAgent = useMutation(api.example.bindUserAgent);
  const createPairingCode = useMutation(api.example.createPairingCode);
  const createPushTemplate = useMutation(api.example.createPushTemplate);
  const listPushTemplates = useQuery(api.example.listPushTemplatesByCompany, {
    companyId: "example-company",
  });
  const createPushJobFromTemplate = useMutation(api.example.createPushJobFromTemplate);
  const triggerPushJobNow = useMutation(api.example.triggerPushJobNow);
  const dispatchDuePushJobs = useMutation(api.example.dispatchDuePushJobs);
  const sendBroadcastToAllActiveAgents = useMutation(api.example.sendBroadcastToAllActiveAgents);
  const startWorkers = useAction(api.example.startWorkers);
  const checkIdleShutdowns = useAction(api.example.checkIdleShutdowns);
  const deleteFlyVolume = useAction(api.example.deleteFlyVolume);
  const getProviderRuntimeConfig = useQuery(api.example.getProviderRuntimeConfig, {});
  const setProviderRuntimeConfig = useMutation(api.example.setProviderRuntimeConfig);
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
  const [convexSecretUrl, setConvexSecretUrl] = useState(import.meta.env.VITE_CONVEX_URL ?? "");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [flyApiToken, setFlyApiToken] = useState("");
  const [providerKind, setProviderKind] = useState<"fly" | "runpod" | "ecs">("fly");
  const [providerAppName, setProviderAppName] = useState("agent-factory-workers-example");
  const [providerOrgSlug, setProviderOrgSlug] = useState("personal");
  const [providerImage, setProviderImage] = useState(
    "registry.fly.io/agent-factory-workers-example:test-image",
  );
  const [providerRegion, setProviderRegion] = useState("iad");
  const [providerVolumeName, setProviderVolumeName] = useState("openclaw_data_example");
  const [providerVolumePath, setProviderVolumePath] = useState("/data");
  const [providerVolumeSizeGb, setProviderVolumeSizeGb] = useState("10");
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [usersResult, setUsersResult] = useState<string | null>(null);
  const [secretResult, setSecretResult] = useState<string | null>(null);
  const [bindingResult, setBindingResult] = useState<string | null>(null);
  const [workersResult, setWorkersResult] = useState<string | null>(null);
  const [idleShutdownResult, setIdleShutdownResult] = useState<string | null>(null);
  const [deleteVolumeResult, setDeleteVolumeResult] = useState<string | null>(null);
  const [pairingResult, setPairingResult] = useState<string | null>(null);
  const [pushingResult, setPushingResult] = useState<string | null>(null);
  const [providerConfigResult, setProviderConfigResult] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [bindingAgentKey, setBindingAgentKey] = useState("default");
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [telegramUserIdForBinding, setTelegramUserIdForBinding] = useState("");
  const [telegramChatIdForBinding, setTelegramChatIdForBinding] = useState("");
  const [flyAppNameForDelete, setFlyAppNameForDelete] = useState("openclaw-okr-image");
  const [flyVolumeIdForDelete, setFlyVolumeIdForDelete] = useState("");
  const [pushCompanyId, setPushCompanyId] = useState("example-company");
  const [pushTemplateKey, setPushTemplateKey] = useState("daily-check-template");
  const [pushTemplateTitle, setPushTemplateTitle] = useState("Daily Check-in");
  const [pushTemplateText, setPushTemplateText] = useState("Condividi il tuo aggiornamento della giornata.");
  const [pushTemplateTime, setPushTemplateTime] = useState("09:00");
  const [pushTimezone, setPushTimezone] = useState("Europe/Rome");
  const [pushSelectedTemplateId, setPushSelectedTemplateId] = useState("");
  const [pushJobTime, setPushJobTime] = useState("09:00");
  const [broadcastTitle, setBroadcastTitle] = useState("Aggiornamento admin");
  const [broadcastText, setBroadcastText] = useState("Nuove linee guida operative per tutti.");
  const [selectedPushJobId, setSelectedPushJobId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const listPushJobsForUser = useQuery(
    api.example.listPushJobsForUser,
    selectedUserId ? { consumerUserId: selectedUserId, includeDisabled: true } : "skip",
  );
  const convexUrl = import.meta.env.VITE_CONVEX_URL.replace(".cloud", ".site");
  const convexSecretStatus = (secretsStatus ?? []).find((item) => item.secretRef === "convex.url");

  useEffect(() => {
    if (!getProviderRuntimeConfig) return;
    setProviderKind(getProviderRuntimeConfig.kind);
    setProviderAppName(getProviderRuntimeConfig.appName);
    setProviderOrgSlug(getProviderRuntimeConfig.organizationSlug);
    setProviderImage(getProviderRuntimeConfig.image);
    setProviderRegion(getProviderRuntimeConfig.region);
    setProviderVolumeName(getProviderRuntimeConfig.volumeName);
    setProviderVolumePath(getProviderRuntimeConfig.volumePath);
    setProviderVolumeSizeGb(String(getProviderRuntimeConfig.volumeSizeGb));
  }, [getProviderRuntimeConfig]);

  const saveProviderRuntimeConfig = async () => {
    setBusy("provider-config");
    setProviderConfigResult(null);
    try {
      await setProviderRuntimeConfig({
        providerConfig: {
          kind: providerKind,
          appName: providerAppName.trim(),
          organizationSlug: providerOrgSlug.trim(),
          image: providerImage.trim(),
          region: providerRegion.trim(),
          volumeName: providerVolumeName.trim(),
          volumePath: providerVolumePath.trim(),
          volumeSizeGb: Number(providerVolumeSizeGb),
        },
      });
      setProviderConfigResult("Provider runtime config salvata.");
    } catch (error) {
      setProviderConfigResult((error as Error).message);
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
        `Workers attivi: ${result.activeWorkers}, spawned: ${result.spawned}, terminated: ${result.terminated}.`,
      );
    } catch (error) {
      setWorkersResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const deleteOldFlyVolume = async () => {
    setBusy("delete-volume");
    setDeleteVolumeResult(null);
    try {
      const result = await deleteFlyVolume({
        appName: flyAppNameForDelete,
        volumeId: flyVolumeIdForDelete,
        flyApiToken: flyApiToken.trim() || undefined,
      });
      setDeleteVolumeResult(
        `Volume eliminato con successo. HTTP ${result.status}. ${result.message}`,
      );
      setFlyVolumeIdForDelete("");
    } catch (error) {
      setDeleteVolumeResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runIdleShutdownCheck = async () => {
    setBusy("idle-shutdown-check");
    setIdleShutdownResult(null);
    try {
      const result = await checkIdleShutdowns({
        flyApiToken: flyApiToken.trim() || undefined,
      });
      setIdleShutdownResult(
        `Check completato: checked=${result.checked}, stopped=${result.stopped}, pending=${result.pending}, nextCheckScheduled=${result.nextCheckScheduled}.`,
      );
    } catch (error) {
      setIdleShutdownResult((error as Error).message);
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

  const createTemplate = async () => {
    setBusy("create-template");
    setPushingResult(null);
    try {
      await createPushTemplate({
        companyId: pushCompanyId,
        templateKey: pushTemplateKey,
        title: pushTemplateTitle,
        text: pushTemplateText,
        periodicity: "daily",
        suggestedTimes: [{ kind: "daily", time: pushTemplateTime }],
        actorUserId: "example-admin",
      });
      setPushingResult("Template creato/aggiornato correttamente.");
    } catch (error) {
      setPushingResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const createUserPushJob = async () => {
    if (!selectedUserId || !pushSelectedTemplateId) return;
    setBusy("create-job");
    setPushingResult(null);
    try {
      const jobId = await createPushJobFromTemplate({
        companyId: pushCompanyId,
        consumerUserId: selectedUserId,
        templateId: pushSelectedTemplateId as any,
        timezone: pushTimezone,
        schedule: { kind: "daily", time: pushJobTime },
        enabled: true,
      });
      setSelectedPushJobId(jobId);
      setPushingResult(`Job creato con timezone ${pushTimezone}.`);
    } catch (error) {
      setPushingResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runManualPush = async () => {
    if (!selectedPushJobId) return;
    setBusy("manual-push");
    setPushingResult(null);
    try {
      const result = await triggerPushJobNow({
        jobId: selectedPushJobId as any,
      });
      setPushingResult(`Push manuale enqueue: ${result.enqueuedMessageId}.`);
    } catch (error) {
      setPushingResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runDispatchNow = async () => {
    setBusy("dispatch-now");
    setPushingResult(null);
    try {
      const result = await dispatchDuePushJobs({
        limit: 200,
      });
      setPushingResult(
        `Dispatch completato: scanned=${result.scanned}, enqueued=${result.enqueued}, skipped=${result.skipped}, failed=${result.failed}.`,
      );
    } catch (error) {
      setPushingResult((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runBroadcast = async () => {
    setBusy("broadcast");
    setPushingResult(null);
    try {
      const result = await sendBroadcastToAllActiveAgents({
        companyId: pushCompanyId,
        title: broadcastTitle,
        text: broadcastText,
        requestedBy: "example-admin",
      });
      setPushingResult(
        `Broadcast completato: targets=${result.totalTargets}, enqueued=${result.enqueued}, failed=${result.failed}.`,
      );
    } catch (error) {
      setPushingResult((error as Error).message);
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
          <h3>0b) Provider Runtime Config (runtimeConfig)</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Configura il provider usato dal reconcile enqueue-triggered quando il consumer non passa
            esplicitamente providerConfig.
          </p>
          <div style={{ marginBottom: "0.5rem" }}>
            <select
              value={providerKind}
              onChange={(event) =>
                setProviderKind(event.target.value as "fly" | "runpod" | "ecs")
              }
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "16%" }}
            >
              <option value="fly">fly</option>
              <option value="runpod">runpod</option>
              <option value="ecs">ecs</option>
            </select>
            <input
              value={providerAppName}
              onChange={(event) => setProviderAppName(event.target.value)}
              placeholder="appName"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "30%" }}
            />
            <input
              value={providerOrgSlug}
              onChange={(event) => setProviderOrgSlug(event.target.value)}
              placeholder="organizationSlug"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "20%" }}
            />
          </div>
          <div style={{ marginBottom: "0.5rem" }}>
            <input
              value={providerImage}
              onChange={(event) => setProviderImage(event.target.value)}
              placeholder="image"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "48%" }}
            />
            <input
              value={providerRegion}
              onChange={(event) => setProviderRegion(event.target.value)}
              placeholder="region"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "14%" }}
            />
            <input
              value={providerVolumeSizeGb}
              onChange={(event) => setProviderVolumeSizeGb(event.target.value)}
              placeholder="volumeSizeGb"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "14%" }}
            />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={providerVolumeName}
              onChange={(event) => setProviderVolumeName(event.target.value)}
              placeholder="volumeName"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "30%" }}
            />
            <input
              value={providerVolumePath}
              onChange={(event) => setProviderVolumePath(event.target.value)}
              placeholder="volumePath"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "20%" }}
            />
            <button onClick={saveProviderRuntimeConfig} disabled={busy !== null}>
              {busy === "provider-config" ? "Saving..." : "Save provider config"}
            </button>
          </div>
          <p style={{ fontSize: "0.85rem", marginTop: 0, marginBottom: 0 }}>
            Runtime attuale:{" "}
            {getProviderRuntimeConfig
              ? `${getProviderRuntimeConfig.kind} | ${getProviderRuntimeConfig.appName} | ${getProviderRuntimeConfig.region}`
              : "non impostato"}
          </p>
          {providerConfigResult ? <p style={{ marginTop: "0.5rem" }}>{providerConfigResult}</p> : null}
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
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>4a) Check idle shutdowns (no spawn)</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Esegue un check manuale dei worker <code>active</code> con{" "}
            <code>scheduledShutdownAt</code> scaduto. Non crea nuove macchine.
          </p>
          <button onClick={runIdleShutdownCheck} disabled={busy !== null}>
            {busy === "idle-shutdown-check" ? "Checking..." : "Check idle shutdowns now"}
          </button>
          <p style={{ fontSize: "0.85rem", marginTop: "0.75rem", marginBottom: 0 }}>
            Usa <code>fly.apiToken</code> dal secret store, oppure il token inserito sopra.
          </p>
          {idleShutdownResult ? (
            <p style={{ marginTop: "0.5rem" }}>{idleShutdownResult}</p>
          ) : null}
        </div>
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>4b) Delete old Fly volume</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Inserisci <code>appName</code> e <code>volumeId</code> per eliminare manualmente un
            volume vecchio da Fly Machines API.
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={flyAppNameForDelete}
              onChange={(event) => setFlyAppNameForDelete(event.target.value)}
              placeholder="fly app name"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            />
            <input
              value={flyVolumeIdForDelete}
              onChange={(event) => setFlyVolumeIdForDelete(event.target.value)}
              placeholder="fly volume id"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            />
            <button
              onClick={deleteOldFlyVolume}
              disabled={
                busy !== null ||
                flyAppNameForDelete.trim().length === 0 ||
                flyVolumeIdForDelete.trim().length === 0 ||
                flyApiToken.trim().length === 0
              }
            >
              {busy === "delete-volume" ? "Deleting..." : "Delete volume"}
            </button>
          </div>
          <p style={{ fontSize: "0.85rem", marginTop: 0, marginBottom: 0 }}>
            Richiede <code>fly.apiToken</code> (usa il campo "Pairing Secrets" sopra).
          </p>
          {deleteVolumeResult ? <p style={{ marginTop: "0.5rem" }}>{deleteVolumeResult}</p> : null}
        </div>
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>5) Agent Pushing Demo (Template + Timezone + Manual + Broadcast)</h3>
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Test completo della nuova implementazione: template, push orario con timezone, invio
            manuale e broadcast admin.
          </p>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={pushCompanyId}
              onChange={(event) => setPushCompanyId(event.target.value)}
              placeholder="companyId"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "28%" }}
            />
            <input
              value={pushTemplateKey}
              onChange={(event) => setPushTemplateKey(event.target.value)}
              placeholder="templateKey"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "28%" }}
            />
            <input
              value={pushTemplateTime}
              onChange={(event) => setPushTemplateTime(event.target.value)}
              placeholder="HH:mm"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "18%" }}
            />
            <button
              onClick={createTemplate}
              disabled={busy !== null || pushTemplateKey.trim().length === 0}
            >
              {busy === "create-template" ? "Saving..." : "Create template"}
            </button>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={pushTemplateTitle}
              onChange={(event) => setPushTemplateTitle(event.target.value)}
              placeholder="template title"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "30%" }}
            />
            <input
              value={pushTemplateText}
              onChange={(event) => setPushTemplateText(event.target.value)}
              placeholder="template text"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "62%" }}
            />
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <select
              value={pushSelectedTemplateId}
              onChange={(event) => setPushSelectedTemplateId(event.target.value)}
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "35%" }}
            >
              <option value="">Seleziona template</option>
              {(listPushTemplates ?? []).map((template: any) => (
                <option key={template._id} value={template._id}>
                  {template.templateKey} ({template.title})
                </option>
              ))}
            </select>
            <select
              value={pushTimezone}
              onChange={(event) => setPushTimezone(event.target.value)}
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "22%" }}
            >
              <option value="Europe/Rome">Europe/Rome</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
            <input
              value={pushJobTime}
              onChange={(event) => setPushJobTime(event.target.value)}
              placeholder="job HH:mm"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "15%" }}
            />
            <button
              onClick={createUserPushJob}
              disabled={
                busy !== null || selectedUserId.length === 0 || pushSelectedTemplateId.length === 0
              }
            >
              {busy === "create-job" ? "Creating..." : "Create user push job"}
            </button>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <select
              value={selectedPushJobId}
              onChange={(event) => setSelectedPushJobId(event.target.value)}
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "45%" }}
            >
              <option value="">Seleziona job per trigger manuale</option>
              {(listPushJobsForUser ?? []).map((job: any) => (
                <option key={job._id} value={job._id}>
                  {job.title} ({job.timezone}) - {job.periodicity}
                </option>
              ))}
            </select>
            <button
              onClick={runManualPush}
              disabled={busy !== null || selectedPushJobId.length === 0}
              style={{ marginRight: "0.5rem" }}
            >
              {busy === "manual-push" ? "Sending..." : "Trigger manual push"}
            </button>
            <button
              onClick={runDispatchNow}
              disabled={busy !== null}
              style={{ marginRight: "0.5rem" }}
            >
              {busy === "dispatch-now" ? "Dispatching..." : "Dispatch due jobs now"}
            </button>
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              value={broadcastTitle}
              onChange={(event) => setBroadcastTitle(event.target.value)}
              placeholder="broadcast title"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "30%" }}
            />
            <input
              value={broadcastText}
              onChange={(event) => setBroadcastText(event.target.value)}
              placeholder="broadcast text"
              style={{ marginRight: "0.5rem", padding: "0.5rem", width: "45%" }}
            />
            <button onClick={runBroadcast} disabled={busy !== null}>
              {busy === "broadcast" ? "Broadcasting..." : "Admin broadcast to all active agents"}
            </button>
          </div>
          <p style={{ fontSize: "0.9rem", marginTop: "0.5rem", marginBottom: "0.5rem" }}>
            Queue ready: <strong>{stats?.queuedReady ?? 0}</strong> | Processing:{" "}
            <strong>{stats?.processing ?? 0}</strong> | Dead letter:{" "}
            <strong>{stats?.deadLetter ?? 0}</strong>
          </p>
          {pushingResult ? <p style={{ marginTop: "0.5rem" }}>{pushingResult}</p> : null}
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
