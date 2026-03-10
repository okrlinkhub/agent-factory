import { v } from "convex/values";

export const workerStatusValidator = v.union(
  v.literal("active"),
  v.literal("draining"),
  v.literal("stopping"),
  v.literal("stopped"),
);

export type WorkerStatus = "active" | "draining" | "stopping" | "stopped";

export function isWorkerClaimable(status: WorkerStatus): boolean {
  return status === "active";
}

export function isWorkerRunning(status: WorkerStatus): boolean {
  return status === "active" || status === "draining" || status === "stopping";
}

export function isWorkerDrainPending(status: WorkerStatus): boolean {
  return status === "draining";
}

export function isWorkerTeardownPending(status: WorkerStatus): boolean {
  return status === "stopping";
}

export function isWorkerTerminal(status: WorkerStatus): boolean {
  return status === "stopped";
}

export function canTransitionWorkerStatus(
  current: WorkerStatus,
  next: WorkerStatus,
): boolean {
  switch (current) {
    case "active":
      return next === "active" || next === "draining";
    case "draining":
      return next === "draining" || next === "stopping";
    case "stopping":
      return next === "stopping" || next === "stopped";
    case "stopped":
      return next === "stopped";
  }
}
