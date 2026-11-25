<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import clientResolver from "#lib/client/resolver.js";
  import type {} from "altcha/types/svelte";

  interface Props {
    onVerified: (verified: boolean, payload?: string) => void;
  }

  let { onVerified }: Props = $props();
  let widget: HTMLElement & { reset?: () => void };
  let loaded = $state(false);
  let failed = $state(false);

  onMount(() => {
    let active = true;
    const stateChange = (event: Event) => {
      if (event instanceof CustomEvent) {
        onVerified(event.detail.state === "verified", event.detail.payload);
      }
    };
    widget?.addEventListener("statechange", stateChange);

    void import("altcha")
      .then(() => import("altcha/i18n/fr-fr"))
      .then(() => {
        if (active) loaded = true;
      })
      .catch(() => {
        if (active) failed = true;
      });

    return () => {
      active = false;
      widget?.removeEventListener("statechange", stateChange);
    };
  });

  export function reset() {
    widget?.reset?.();
    onVerified(false);
  }
</script>

<div class="mt-5" aria-label="Vérification anti-spam">
  <altcha-widget
    bind:this={widget}
    challenge={clientResolver(resolve, "/account/altcha/challenge")}
    name="altcha"
    language="fr-fr"
    auto="onload"
    type="checkbox"
    style="--altcha-color-base: var(--card); --altcha-color-base-content: var(--card-foreground); --altcha-border-color: var(--border);"
  ></altcha-widget>
  {#if !loaded}
    <p role="status" class="text-muted-foreground mt-2 text-sm">
      {failed
        ? "La vérification n’a pas pu charger. Rechargez la page pour réessayer."
        : "Chargement de la vérification anti-spam…"}
    </p>
  {/if}
  <noscript>JavaScript est nécessaire pour vérifier ce formulaire.</noscript>
</div>
