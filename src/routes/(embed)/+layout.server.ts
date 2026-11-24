import type { LayoutServerLoad } from "./$types";
import { GetLayoutServerData } from "#lib/server/controllers/layoutController.ts";

export const load: LayoutServerLoad = async ({ cookies, request }) => {
  return await GetLayoutServerData(cookies, request);
};
