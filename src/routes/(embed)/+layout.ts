import type { LayoutLoad } from "./$types";
import { GetLayoutClientData } from "#lib/client/layoutClientData.ts";

export const load: LayoutLoad = async ({ data, fetch }) => {
  const clientData = await GetLayoutClientData(data.languageSetting, fetch);

  return {
    ...data,
    ...clientData,
  };
};
