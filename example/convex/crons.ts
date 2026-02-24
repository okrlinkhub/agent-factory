import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

const crons = cronJobs();

crons.cron(
  "agent-factory push dispatch hourly",
  "0 * * * *",
  api.example.dispatchDuePushJobs,
  {},
);

export default crons;
