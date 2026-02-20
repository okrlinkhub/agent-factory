/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      claim: FunctionReference<
        "mutation",
        "internal",
        { nowMs?: number; workerId: string },
        null | {
          agentKey: string;
          conversationId: string;
          leaseExpiresAt: number;
          leaseId: string;
          messageId: string;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
        },
        Name
      >;
      complete: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      configureAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          clientMd?: string;
          enabled: boolean;
          runtimeConfig: Record<string, string | number | boolean>;
          secretsRef: Array<string>;
          skills: Array<string>;
          soulMd: string;
          version: string;
        },
        string,
        Name
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          conversationId: string;
          maxAttempts?: number;
          nowMs?: number;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority?: number;
          scheduledFor?: number;
        },
        string,
        Name
      >;
      fail: FunctionReference<
        "mutation",
        "internal",
        {
          errorMessage: string;
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        {
          deadLettered: boolean;
          nextScheduledFor: null | number;
          requeued: boolean;
        },
        Name
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      queueStats: FunctionReference<
        "query",
        "internal",
        { nowMs?: number },
        { deadLetter: number; processing: number; queuedReady: number },
        Name
      >;
      reconcileWorkers: FunctionReference<
        "action",
        "internal",
        {
          flyApiToken: string;
          nowMs?: number;
          providerConfig?: {
            appName: string;
            image: string;
            kind: "fly" | "runpod" | "ecs";
            organizationSlug: string;
            region: string;
          };
          scalingPolicy?: {
            drainStep: number;
            idleTimeoutMs: number;
            maxWorkers: number;
            minWorkers: number;
            queuePerWorkerTarget: number;
            reconcileIntervalMs: number;
            spawnStep: number;
          };
        },
        {
          activeWorkers: number;
          desiredWorkers: number;
          spawned: number;
          terminated: number;
        },
        Name
      >;
    };
    queue: {
      claimNextJob: FunctionReference<
        "mutation",
        "internal",
        { nowMs?: number; workerId: string },
        null | {
          agentKey: string;
          conversationId: string;
          leaseExpiresAt: number;
          leaseId: string;
          messageId: string;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
        },
        Name
      >;
      completeJob: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      enqueueMessage: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          conversationId: string;
          maxAttempts?: number;
          nowMs?: number;
          payload: {
            externalMessageId?: string;
            messageText: string;
            metadata?: Record<string, string>;
            provider: string;
            providerUserId: string;
            rawUpdateJson?: string;
          };
          priority?: number;
          scheduledFor?: number;
        },
        string,
        Name
      >;
      failJob: FunctionReference<
        "mutation",
        "internal",
        {
          errorMessage: string;
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        {
          deadLettered: boolean;
          nextScheduledFor: null | number;
          requeued: boolean;
        },
        Name
      >;
      getQueueStats: FunctionReference<
        "query",
        "internal",
        { nowMs?: number },
        { deadLetter: number; processing: number; queuedReady: number },
        Name
      >;
      getWorkerStats: FunctionReference<
        "query",
        "internal",
        {},
        {
          activeCount: number;
          idleCount: number;
          workers: Array<{
            appName: null | string;
            heartbeatAt: number;
            load: number;
            machineId: null | string;
            status:
              | "starting"
              | "active"
              | "idle"
              | "draining"
              | "stopped"
              | "failed";
            workerId: string;
          }>;
        },
        Name
      >;
      heartbeatJob: FunctionReference<
        "mutation",
        "internal",
        {
          leaseId: string;
          messageId: string;
          nowMs?: number;
          workerId: string;
        },
        boolean,
        Name
      >;
      listJobsByStatus: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentKey: string;
          attempts: number;
          conversationId: string;
          lastError?: string;
          maxAttempts: number;
          priority: number;
          scheduledFor: number;
          status: "queued" | "processing" | "done" | "failed" | "dead_letter";
        }>,
        Name
      >;
      upsertAgentProfile: FunctionReference<
        "mutation",
        "internal",
        {
          agentKey: string;
          clientMd?: string;
          enabled: boolean;
          runtimeConfig: Record<string, string | number | boolean>;
          secretsRef: Array<string>;
          skills: Array<string>;
          soulMd: string;
          version: string;
        },
        string,
        Name
      >;
    };
    scheduler: {
      reconcileWorkerPool: FunctionReference<
        "action",
        "internal",
        {
          flyApiToken: string;
          nowMs?: number;
          providerConfig?: {
            appName: string;
            image: string;
            kind: "fly" | "runpod" | "ecs";
            organizationSlug: string;
            region: string;
          };
          scalingPolicy?: {
            drainStep: number;
            idleTimeoutMs: number;
            maxWorkers: number;
            minWorkers: number;
            queuePerWorkerTarget: number;
            reconcileIntervalMs: number;
            spawnStep: number;
          };
        },
        {
          activeWorkers: number;
          desiredWorkers: number;
          spawned: number;
          terminated: number;
        },
        Name
      >;
    };
  };
