// @ts-nocheck

/**
 * Self-hosted Matomo analytics capture snippet.
 * The administration UI can be restricted independently; browsers only need
 * public access to matomo.js and matomo.php.
 */
(function () {
  const configuredUrl = "{{matomo_url}}";
  const matomoBaseUrl = configuredUrl.endsWith("/") ? configuredUrl : configuredUrl + "/";

  window._paq = window._paq || [];
  window._paq.push(["trackPageView"]);
  window._paq.push(["enableLinkTracking"]);
  window._paq.push(["setTrackerUrl", matomoBaseUrl + "matomo.php"]);
  window._paq.push(["setSiteId", "{{site_id}}"]);

  window.addEventListener("analyticsEvent", function (event) {
    const eventName = event.detail && event.detail.event;
    const eventData = (event.detail && event.detail.data) || {};
    if (!eventName) return;

    window._paq.push(["trackEvent", "Kener", eventName, JSON.stringify(eventData)]);
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = matomoBaseUrl + "matomo.js";
  document.head.appendChild(script);
})();
