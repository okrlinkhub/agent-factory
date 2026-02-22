import { describe, expect, test, vi } from "vitest";
import {
  bridgeFunctionKeyFromToolName,
  isBridgeToolName,
  maybeExecuteBridgeToolCall,
  resolveBridgeRuntimeConfig,
} from "./bridge.js";

describe("bridge helpers", () => {
  test("resolveBridgeRuntimeConfig should prefer hydration values", () => {
    const resolved = resolveBridgeRuntimeConfig(
      {
        baseUrl: "https://consumer.example.com",
        serviceId: "openclaw-prod",
        appKey: "crm",
        serviceKey: "abs_live_key",
        serviceKeySecretRef: "agent-bridge.serviceKey.default",
      },
      {
        OPENCLAW_AGENT_BRIDGE_BASE_URL: "https://ignored.example.com",
        OPENCLAW_SERVICE_ID: "ignored-service",
        OPENCLAW_SERVICE_KEY: "ignored-key",
        OPENCLAW_AGENT_APP: "ignored-app",
      },
    );

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.config).toEqual({
        baseUrl: "https://consumer.example.com",
        serviceId: "openclaw-prod",
        serviceKey: "abs_live_key",
        appKey: "crm",
      });
    }
  });

  test("resolveBridgeRuntimeConfig should fallback to env values", () => {
    const resolved = resolveBridgeRuntimeConfig(null, {
      AGENT_BRIDGE_BASE_URL: "https://consumer.example.com/",
      OPENCLAW_SERVICE_ID: "openclaw-prod",
      OPENCLAW_SERVICE_KEY: "abs_live_key",
      OPENCLAW_APP_KEY: "crm",
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.config.baseUrl).toBe("https://consumer.example.com");
    }
  });

  test("tool name parser should only accept bridge namespace", () => {
    expect(isBridgeToolName("bridge.cart.calculatePrice")).toBe(true);
    expect(bridgeFunctionKeyFromToolName("bridge.cart.calculatePrice")).toBe(
      "cart.calculatePrice",
    );
    expect(isBridgeToolName("cart.calculatePrice")).toBe(false);
    expect(bridgeFunctionKeyFromToolName("cart.calculatePrice")).toBeNull();
  });

  test("maybeExecuteBridgeToolCall should execute bridge tool with strict headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        success: true,
        result: { ok: true },
      }),
    });

    const result = await maybeExecuteBridgeToolCall({
      toolName: "bridge.cart.calculatePrice",
      toolArgs: { cartId: "c1" },
      hydratedConfig: {
        baseUrl: "https://consumer.example.com",
        serviceId: "openclaw-prod",
        appKey: "crm",
        serviceKey: "abs_live_key",
        serviceKeySecretRef: "agent-bridge.serviceKey.default",
      },
      fetchImpl: fetchMock,
    });

    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.functionKey).toBe("cart.calculatePrice");
      expect(result.response.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });
});
