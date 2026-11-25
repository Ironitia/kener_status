import { describe, expect, it } from "vitest";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { AltchaError, createProtection } from "./altcha";

const TEST_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";

function encodePayload(challenge: Awaited<ReturnType<ReturnType<typeof createProtection>["challenge"]>>, solution: unknown) {
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

describe("ALTCHA protection", () => {
  it("accepts a valid proof once and rejects its replay", async () => {
    const protection = createProtection(TEST_SECRET, {
      cost: 1,
      counterMin: 1,
      counterMax: 10,
      lifetimeMs: 60_000,
    });
    const challenge = await protection.challenge("192.0.2.10");
    const solution = await solveChallenge({ challenge, deriveKey, timeout: 5000 });
    expect(solution).not.toBeNull();

    const payload = encodePayload(challenge, solution);
    await expect(protection.verify(payload, "192.0.2.10")).resolves.toBeUndefined();
    await expect(protection.verify(payload, "192.0.2.10")).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<AltchaError>);
  });

  it("rejects a missing proof", async () => {
    const protection = createProtection(TEST_SECRET, {
      cost: 1,
      counterMin: 1,
      counterMax: 10,
      lifetimeMs: 60_000,
    });
    await expect(protection.verify(undefined, "192.0.2.11")).rejects.toMatchObject({ status: 403 });
  });
});
