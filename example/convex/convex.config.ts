import { defineApp } from "convex/server";
import agentFactory from "@okrlinkhub/agent-factory/convex.config.js";

const app = defineApp();
app.use(agentFactory);

export default app;
