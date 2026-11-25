import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { AltchaError, clientAddress, getProtection } from "#lib/server/altcha.ts";

export const GET: RequestHandler = async ({ request }) => {
  try {
    return json(await getProtection().challenge(clientAddress(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof AltchaError ? error.status : 503;
    return json(
      { message: "La vérification anti-spam est temporairement indisponible." },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(status === 429 ? { "Retry-After": "600" } : {}),
        },
      },
    );
  }
};
