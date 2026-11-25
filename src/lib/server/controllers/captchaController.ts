import { GetAllCaptchaData } from "./siteDataController.js";
import { AltchaError, createProtection } from "../altcha.js";

export type CaptchaProviderName = "altcha" | "hcaptcha" | "recaptcha" | "turnstile";

export interface ActiveCaptchaProvider {
  provider: CaptchaProviderName;
  siteKey: string | null;
  secretKey: string;
}

type ExternalCaptchaProviderName = Exclude<CaptchaProviderName, "altcha">;

const SITEVERIFY_URL: Record<ExternalCaptchaProviderName, string> = {
  hcaptcha: "https://hcaptcha.com/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
};

const KEY_TO_PROVIDER: Record<string, CaptchaProviderName> = {
  "captcha.altcha": "altcha",
  "captcha.hcaptcha": "hcaptcha",
  "captcha.recaptcha": "recaptcha",
  "captcha.turnstile": "turnstile",
};

const VERIFY_TIMEOUT_MS = 5000;

type CaptchaResolution =
  | { status: "disabled" }
  | { status: "misconfigured"; key: string }
  | { status: "active"; provider: ActiveCaptchaProvider };

async function resolveCaptchaConfig(): Promise<CaptchaResolution> {
  const entries = await GetAllCaptchaData();
  const enabledEntry = entries.find((e) => e.value?.isEnabled === true && KEY_TO_PROVIDER[e.key]);
  if (!enabledEntry) {
    return { status: "disabled" };
  }

  const requirements = enabledEntry.value.requirements || {};
  const provider = KEY_TO_PROVIDER[enabledEntry.key];
  const siteKey = requirements["Site Key"] || null;
  const secretKey = requirements["Secret Key"];
  if (
    typeof secretKey !== "string" ||
    !secretKey ||
    (provider === "altcha" && secretKey.length < 32) ||
    (provider !== "altcha" && !siteKey)
  ) {
    return { status: "misconfigured", key: enabledEntry.key };
  }

  return { status: "active", provider: { provider, siteKey, secretKey } };
}

export async function GetActiveCaptchaProvider(): Promise<ActiveCaptchaProvider | null> {
  const resolution = await resolveCaptchaConfig();
  return resolution.status === "active" ? resolution.provider : null;
}

/**
 * The public (site-key only) view of the captcha config.
 *
 * "Enabled" means "required" everywhere: the credentials only decide
 * whether a challenge can be *drawn*, never whether protection applies.
 * A provider enabled without its keys is therefore reported as required
 * but unrenderable, so the client can say so and keep the form blocked —
 * rather than being flattened into `null`, which the client would read as
 * "captcha is off" while VerifyCaptchaToken went on rejecting every
 * request, dead-ending the form with no challenge to solve.
 */
export async function GetPublicCaptchaConfig(): Promise<{
  provider: CaptchaProviderName | null;
  siteKey: string | null;
  misconfigured: boolean;
}> {
  const resolution = await resolveCaptchaConfig();
  if (resolution.status === "active") {
    return {
      provider: resolution.provider.provider,
      siteKey: resolution.provider.siteKey,
      misconfigured: false,
    };
  }
  return { provider: null, siteKey: null, misconfigured: resolution.status === "misconfigured" };
}

export async function VerifyCaptchaToken(
  token: string | undefined | null,
  clientIp = "local",
): Promise<{ success: boolean }> {
  const resolution = await resolveCaptchaConfig();

  if (resolution.status === "disabled") {
    // No provider configured: captcha is off, nothing to verify.
    return { success: true };
  }
  if (resolution.status === "misconfigured") {
    // A provider is enabled but missing its Site Key/Secret Key — fail
    // closed instead of silently letting captcha protection lapse.
    console.error(`Captcha provider "${resolution.key}" is enabled but missing required credentials`);
    return { success: false };
  }
  if (!token) {
    return { success: false };
  }

  const active = resolution.provider;
  if (active.provider === "altcha") {
    try {
      await getAltchaProtection(active.secretKey).verify(token, clientIp);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(SITEVERIFY_URL[active.provider], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: active.secretKey, response: token }).toString(),
      signal: controller.signal,
    });
    const body = (await response.json()) as { success?: boolean };
    return { success: body.success === true };
  } catch (err) {
    console.error("Captcha verification request failed", err);
    return { success: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

let altchaSecret: string | undefined;
let altchaProtection: ReturnType<typeof createProtection> | undefined;

function getAltchaProtection(secret: string) {
  if (secret !== altchaSecret || !altchaProtection) {
    altchaSecret = secret;
    altchaProtection = createProtection(secret);
  }
  return altchaProtection;
}

export async function CreateAltchaChallenge(clientIp: string) {
  const resolution = await resolveCaptchaConfig();
  if (resolution.status !== "active" || resolution.provider.provider !== "altcha") {
    throw new AltchaError("ALTCHA is not the active CAPTCHA provider.", 404);
  }
  return getAltchaProtection(resolution.provider.secretKey).challenge(clientIp);
}
