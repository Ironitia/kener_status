import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import emailTemplate from "#lib/server/templates/email_alert_template.ts";
import webhookTemplate from "#lib/server/templates/webhook_alert_template.ts";
import slackTemplate from "#lib/server/templates/slack_alert_template.ts";
import discordTemplate from "#lib/server/templates/discord_alert_template.ts";

export const load: PageServerLoad = async ({ params }) => {
  return {
    ...{
      trigger_id: params.trigger_id,
      email_template: emailTemplate,
      webhook_template: webhookTemplate,
      slack_template: slackTemplate,
      discord_template: discordTemplate,
    },
  };
};
