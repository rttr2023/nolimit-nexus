/* =========================
   /js/i18n.js
   FR/EN via JSON files
   Uses data-i18n="key.path"
   Stores language in cookie only
   ========================= */

(function () {
  "use strict";

  const COOKIE_LANG = "nb_lang";
  const DEFAULT_LANG = "fr";
  const SUPPORTED = ["fr", "en"];

  let dict = {};
  let currentLang = DEFAULT_LANG;

  function safeGet(obj, path) {
    return path.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), obj);
  }

  async function loadLang(lang) {
    const l = (lang || "").toLowerCase();
    const finalLang = SUPPORTED.includes(l) ? l : DEFAULT_LANG;

    const res = await fetch(`./data/${finalLang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("i18n file not found: " + finalLang);
    dict = await res.json();

    currentLang = finalLang;
    document.documentElement.lang = finalLang;
    CookieStore.setCookie(COOKIE_LANG, finalLang, 365);

    // update label button if exists
    const label = document.getElementById("langLabel");
    if (label) label.textContent = finalLang.toUpperCase();

    apply();
    return finalLang;
  }

  function apply(root = document) {
    const nodes = root.querySelectorAll("[data-i18n]");
    nodes.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = safeGet(dict, key);
      if (value == null) return;

      // If element is input/select/textarea with placeholder key
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        // If data-i18n-placeholder is provided, use it
        if (el.hasAttribute("data-i18n-placeholder")) {
          const phKey = el.getAttribute("data-i18n-placeholder");
          const phVal = safeGet(dict, phKey);
          if (phVal != null) el.placeholder = phVal;
        } else {
          // fallback: set value only if empty
          if (!el.value) el.value = value;
        }
      } else {
        el.textContent = value;
      }
    });
  }

  function getLang() {
    const c = CookieStore.getCookie(COOKIE_LANG);
    if (c && SUPPORTED.includes(c)) return c;
    // fallback to browser language
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : DEFAULT_LANG;
  }

  async function toggleLang() {
    const next = currentLang === "fr" ? "en" : "fr";
    await loadLang(next);
    return next;
  }

  // init
  async function init() {
    const lang = getLang();
    try {
      await loadLang(lang);
    } catch (e) {
      console.warn("i18n init failed, using fallback:", e);
      currentLang = DEFAULT_LANG;
    }
  }

  window.I18N = {
    init,
    apply,
    loadLang,
    toggleLang,
    get current() {
      return currentLang;
    },
  };
})();
