/* =========================
   /js/stripe.js
   Static GitHub Pages approach (no backend):
   - Use Stripe Payment Link (recommended for static)
   - After payment, redirect to app.html?paid=1
   - Then we set cookie nb_paid=true
   =========================
   IMPORTANT:
   This is NOT secure like a backend+webhook.
   It's OK for V1 but users can fake the cookie.
   ========================= */

(function () {
  "use strict";

  const COOKIE_PAID = "nb_paid";

  // ✅ Put your Stripe Payment Link here (Dashboard -> Payment Links)
  // It should be configured to redirect to:
  // https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO/app.html?paid=1
  const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/14AaEY4Nm9JBc1T9RybZe03";

  function setPaidCookie() {
    CookieStore.setCookie(COOKIE_PAID, "true", 30);
  }

  function handleReturnFromStripe() {
    const url = new URL(location.href);
    const paid = url.searchParams.get("paid");

    // If Stripe redirect includes ?paid=1 we consider it "paid" (V1 only)
    if (paid === "1") {
      setPaidCookie();

      // Clean URL (remove query)
      url.searchParams.delete("paid");
      history.replaceState({}, "", url.pathname + url.hash);

      // Ensure we're on app
      if (!location.pathname.endsWith("app.html")) location.href = "./app.html";
    }
  }

  function initSubscribeButton() {
    const btn = document.getElementById("subscribeBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (!STRIPE_PAYMENT_LINK || STRIPE_PAYMENT_LINK.includes("PASTE_")) {
        alert("Ajoute ton lien Stripe Payment Link dans /js/stripe.js (STRIPE_PAYMENT_LINK).");
        return;
      }
      // Redirect to Stripe hosted payment link
      location.href = STRIPE_PAYMENT_LINK;
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    // On both pages
    handleReturnFromStripe();
    initSubscribeButton();
  });
})();
