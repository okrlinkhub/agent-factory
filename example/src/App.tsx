import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

function App() {
  const enqueue = useMutation(api.example.enqueue);
  const stats = useQuery(api.example.queueStats, {});
  const [chatId, setChatId] = useState("947270381897662534");
  const [messageText, setMessageText] = useState("Ciao da Telegram ingress");
  const convexUrl = import.meta.env.VITE_CONVEX_URL.replace(".cloud", ".site");

  const enqueueMessage = async () => {
    await enqueue({
      conversationId: `telegram:${chatId}`,
      agentKey: "default",
      provider: "telegram",
      providerUserId: chatId,
      messageText,
    });
    setMessageText("");
  };

  return (
    <>
      <h1>Agent Factory Example</h1>
      <div className="card">
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "rgba(128, 128, 128, 0.1)",
            borderRadius: "8px",
          }}
        >
          <h3>Queue Ingress Demo</h3>
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
            <button onClick={enqueueMessage}>Enqueue message</button>
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
