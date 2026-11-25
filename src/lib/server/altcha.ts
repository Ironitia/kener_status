import { createChallenge, randomInt, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { deriveHmacKeySecret } from "altcha-lib/frameworks/shared";
import type { Challenge } from "altcha-lib/types";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 10_000;

export class AltchaError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface ProtectionOptions {
  cost: number;
  counterMin: number;
  counterMax: number;
  lifetimeMs: number;
}

const DEFAULT_OPTIONS: ProtectionOptions = {
  cost: 5000,
  counterMin: 5000,
  counterMax: 10_000,
  lifetimeMs: WINDOW_MS,
};

export function createProtection(secret: string, options: ProtectionOptions = DEFAULT_OPTIONS) {
  if (secret.length < 32) {
    throw new Error("ALTCHA_HMAC_SECRET must contain at least 32 characters");
  }

  const keySecret = deriveHmacKeySecret(secret);
  const issued = new Map<string, { challenge: Challenge; expires: number }>();
  const attempts = new Map<string, { count: number; expires: number }>();

  function limit(ip: string, action: "challenge" | "submit") {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (entry.expires <= now) attempts.delete(key);
    }

    const key = `${action}:${ip}`;
    const entry = attempts.get(key) ?? { count: 0, expires: now + WINDOW_MS };
    const limitForAction = action === "challenge" ? 80 : 12;
    if (entry.count >= limitForAction || (!attempts.has(key) && attempts.size >= MAX_ENTRIES)) {
      throw new AltchaError("Too many verification attempts. Please try again later.", 429);
    }
    entry.count += 1;
    attempts.set(key, entry);
  }

  async function challenge(ip: string) {
    limit(ip, "challenge");
    const now = Date.now();
    for (const [key, entry] of issued) {
      if (entry.expires <= now) issued.delete(key);
    }
    if (issued.size >= MAX_ENTRIES) {
      throw new AltchaError("Anti-spam verification is temporarily unavailable.", 503);
    }

    const expires = now + options.lifetimeMs;
    const value = await createChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: options.cost,
      counter: randomInt(options.counterMax, options.counterMin),
      expiresAt: new Date(expires),
      deriveKey,
      hmacSignatureSecret: secret,
      hmacKeySignatureSecret: await keySecret,
    });
    if (!value.signature) {
      throw new AltchaError("Anti-spam verification is temporarily unavailable.", 503);
    }
    issued.set(value.signature, { challenge: value, expires });
    return value;
  }

  async function verify(payload: unknown, ip: string) {
    limit(ip, "submit");
    let valid = false;

    try {
      if (typeof payload !== "string" || !payload || payload.length > 8192) {
        throw new Error("Invalid payload");
      }
      const parsed = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
      const signature = parsed?.challenge?.signature;
      const entry = issued.get(signature);
      if (!entry || entry.expires <= Date.now()) {
        throw new Error("Unknown or expired challenge");
      }

      // Consume before the first await so concurrent requests cannot replay a proof.
      issued.delete(signature);
      if (
        !Number.isSafeInteger(parsed.solution?.counter) ||
        parsed.solution.counter < 0 ||
        !/^[a-f0-9]{64}$/i.test(parsed.solution?.derivedKey ?? "")
      ) {
        throw new Error("Invalid solution");
      }

      valid = (
        await verifySolution({
          challenge: parsed.challenge,
          solution: parsed.solution,
          deriveKey,
          hmacSignatureSecret: secret,
          hmacKeySignatureSecret: await keySecret,
        })
      ).verified;
    } catch {
      // Keep one uniform response and never expose proof details.
    }

    if (!valid) {
      throw new AltchaError("Anti-spam verification is required. Please try again.", 403);
    }
  }

  return { challenge, verify };
}

let protection: ReturnType<typeof createProtection> | undefined;

export function getProtection() {
  return (protection ??= createProtection(process.env.ALTCHA_HMAC_SECRET ?? ""));
}

export function clientAddress(request: Request) {
  return request.headers.get("x-real-ip")?.slice(0, 64) || "local";
}

export async function verifyAltchaForm(formData: FormData, request: Request) {
  await getProtection().verify(formData.get("altcha"), clientAddress(request));
}
