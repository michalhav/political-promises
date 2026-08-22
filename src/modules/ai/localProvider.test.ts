import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LocalProvider } from "@/modules/ai/localProvider";
import { AIProviderError } from "@/modules/ai/provider";

/**
 * Hranice mezi aplikací a Ollamou.
 *
 * Testuje se to, co vlastníme: tvar požadavku (schéma se posílá jako `format`,
 * ne jako prosba v promptu), ověření odpovědi a chování při chybách. Kvalitu
 * modelu tím neměříme — na to je evaluace nad zlatým datasetem.
 */
const schema = z.object({ names: z.array(z.string()) });

const provider = new LocalProvider({ baseUrl: "http://localhost:11434/", model: "qwen3:8b" });

const request = {
  promptVersion: "test-1.0.0",
  system: "Systémový prompt.",
  documentText: "Postavíme nové mosty přes Vltavu.",
  instruction: "Vytáhni jména.",
  schema,
  maxTokens: 500,
};

function respondWith(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalProvider", () => {
  it("pošle schéma jako format a vypne streamování", async () => {
    respondWith({
      message: { content: JSON.stringify({ names: ["Vltava"] }) },
      prompt_eval_count: 120,
      eval_count: 30,
    });

    const result = await provider.generate(request);

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe("http://localhost:11434/api/chat");

    const body = JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
    // Odpověď se vynucuje schématem; prosba v promptu by u malého modelu nestačila.
    expect(body.format).toMatchObject({ type: "object" });
    expect(body.stream).toBe(false);
    expect(body.model).toBe("qwen3:8b");

    expect(result.data).toEqual({ names: ["Vltava"] });
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(30);
    // Vlastní hardware: běh nesmí vypadat jako útrata.
    expect(Number(result.costUsd)).toBe(0);
  });

  it("nedůvěřuje výstupu a ověří ho schématem úlohy", async () => {
    respondWith({ message: { content: JSON.stringify({ names: "Vltava" }) } });

    await expect(provider.generate(request)).rejects.toBeInstanceOf(AIProviderError);
  });

  it("nesmyslný JSON pojmenuje, místo aby spadl na parsování", async () => {
    respondWith({ message: { content: "Tady je odpověď: {names: ...}" } });

    await expect(provider.generate(request)).rejects.toThrow(/platný JSON/);
  });

  it("nestažený model pozná podle 404 a poradí, co s tím", async () => {
    respondWith({ error: "model not found" }, 404);

    await expect(provider.generate(request)).rejects.toThrow(/ollama pull qwen3:8b/);
  });

  it("nespuštěnou Ollamu nehlásí jako záhadnou chybu sítě", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch failed"))),
    );

    await expect(provider.generate(request)).rejects.toThrow(/Běží Ollama/);
  });
});
