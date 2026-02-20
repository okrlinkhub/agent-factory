import { httpRouter } from "convex/server";
import { registerRoutes } from "@okrlinkhub/agent-factory";
import { components } from "./_generated/api";

const http = httpRouter();

registerRoutes(http, components.agentFactory, {
  pathPrefix: "/agent-factory",
});

export default http;
