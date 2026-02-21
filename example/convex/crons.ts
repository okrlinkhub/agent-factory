import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

const crons = cronJobs();

crons.interval(
  "agent-factory reconcile workers fallback",
  { minutes: 5 },
  api.example.startWorkers,
  {},
);

export default crons;
