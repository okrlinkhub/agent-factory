import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

const crons = cronJobs();

crons.cron(
  "agent-factory push dispatch hourly",
  "0 * * * *",
  api.example.dispatchDuePushJobs,
  {},
);

crons.interval(
  "agent-factory reconcile workers fallback",
  { minutes: 5 },
  api.example.startWorkers,
  {},
);

crons.cron(
  "agent-factory nightly fly cleanup",
  "0 3 * * *",
  api.example.runFlyCleanup,
  {},
);

export default crons;
