/* =========================
   /js/app.js
   App logic:
   - protect app.html via paid cookie
   - theme persistence (cookie)
   - SPA hash routing
   - onboarding save/load via cookies
   - simple progress calc
   - reset cookies
   ========================= */

(function () {
  "use strict";

  const COOKIE_THEME = "nb_theme";
  const COOKIE_PAID = "nb_paid";
  const COOKIE_ONBOARDING = "nb_onboarding";

  function $(id) {
    return document.getElementById(id);
  }

  function isAppPage() {
    return location.pathname.endsWith("app.html") || document.body.dataset.page === "app";
  }

  function showToast(msg) {
    const toast = $("toast");
    if (!toast) return;
    const card = toast.querySelector(".card");
    if (card) card.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  // ---- Paid gate (client-side) ----
  function enforcePaidGate() {
    if (!isAppPage()) return;

    const paid = CookieStore.getCookie(COOKIE_PAID);
    if (paid !== "true") {
      // redirect to landing pricing section
      location.href = "./index.html#pricing";
    }
  }

  // ---- Theme ----
  function applyTheme(theme) {
    const t = theme === "light" || theme === "dark" ? theme : "";
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");

    if (t) CookieStore.setCookie(COOKIE_THEME, t, 365);
  }

  function initTheme() {
    const saved = CookieStore.getCookie(COOKIE_THEME);
    if (saved) applyTheme(saved);

    const btn = $("themeBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "light" ? "dark" : "light";
        applyTheme(next);
        showToast("Thème changé");
      });
    }
  }

  // ---- Routing (simple SPA) ----
  function initRouting() {
    const pages = [...document.querySelectorAll("[data-page]")];
    const sideItems = [...document.querySelectorAll(".side-item")];
    if (pages.length === 0) return;

    function showPage(route) {
      pages.forEach((p) => p.classList.toggle("hidden", p.getAttribute("data-page") !== route));
      sideItems.forEach((a) => a.classList.toggle("active", a.dataset.route === route));
    }

    function getRouteFromHash() {
      const hash = (location.hash || "#dashboard").replace("#", "");
      return hash || "dashboard";
    }

    window.addEventListener("hashchange", () => showPage(getRouteFromHash()));
    showPage(getRouteFromHash());
  }

  // ---- Onboarding save/load ----
  function computeOnboardingProgress() {
    const goal = $("goal");
    const time = $("time");
    const skills = $("skills");
    const status = $("onboardingStatus");
    const progressText = $("progressText");
    const progressBar = $("progressBar");

    if (!goal || !time || !skills) return { done: 0, pct: 0 };

    let done = 0;
    if (goal.value) done++;
    if (time.value) done++;
    if (skills.value.trim().length >= 2) done++;

    if (status) status.textContent = `${done}/3`;

    const pct = Math.round((done / 3) * 100);
    if (progressText) progressText.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;

    return { done, pct };
  }

  function loadOnboarding() {
    const data = CookieStore.getObject(COOKIE_ONBOARDING);
    if (!data) return;

    const goal = $("goal");
    const time = $("time");
    const skills = $("skills");

    if (goal && typeof data.goal === "string") goal.value = data.goal;
    if (time && typeof data.time === "string") time.value = data.time;
    if (skills && typeof data.skills === "string") skills.value = data.skills;

    computeOnboardingProgress();
  }

  function saveOnboarding() {
    const goal = $("goal");
    const time = $("time");
    const skills = $("skills");
    const msg = $("onboardingSavedMsg");

    if (!goal || !time || !skills) return;

    const payload = {
      goal: goal.value || "",
      time: time.value || "",
      skills: (skills.value || "").trim(),
      updatedAt: Date.now(),
    };

    const ok = CookieStore.setObject(COOKIE_ONBOARDING, payload, 30);
    const done = computeOnboardingProgress().done;

    if (msg) msg.textContent = ok ? (done === 3 ? "Sauvegardé ✅" : "Sauvegardé (incomplet) ✅") : "Erreur sauvegarde ❌";
    showToast(ok ? "Sauvegardé" : "Erreur");
  }

  function initOnboarding() {
    if (!isAppPage()) return;

    const goal = $("goal");
    const time = $("time");
    const skills = $("skills");

    [goal, time, skills].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", computeOnboardingProgress);
    });

    loadOnboarding();
    computeOnboardingProgress();

    const saveBtn = $("saveOnboarding");
    if (saveBtn) saveBtn.addEventListener("click", saveOnboarding);
  }

  // ---- Reset ----
  function initReset() {
    const resetBtn = $("resetBtn");
    if (!resetBtn) return;

    resetBtn.addEventListener("click", () => {
      if (!confirm("Supprimer les cookies NOLIMIT-NEXUS ?")) return;

      // Keep nothing: reset all known keys
      CookieStore.deleteCookie(COOKIE_THEME);
      CookieStore.deleteCookie("nb_lang");
      CookieStore.deleteCookie("nb_paid");
      CookieStore.deleteObject(COOKIE_ONBOARDING);

      showToast("Cookies supprimés");
      // optional redirect
      if (isAppPage()) location.href = "./index.html#pricing";
    });
  }

  // ---- Date badge on app ----
  function initDateBadge() {
    const el = $("today");
    if (!el) return;
    const today = new Date();
    el.textContent = today.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // ---- Language button ----
  function initLangButton() {
    const btn = $("langBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await I18N.toggleLang();
        showToast("Langue changée");
      } catch {
        showToast("Erreur langue");
      }
    });
  }

  async function init() {
    // paid gate first on app
    enforcePaidGate();

    // theme, i18n
    initTheme();
    await I18N.init();
    initLangButton();

    // app-only
    initRouting();
    initDateBadge();
    initOnboarding();
    initReset();
  }

  window.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => console.error(e));
  });
})();

// =========================
// Landing mobile menu
// =========================
(function () {
  const burgerBtn = document.getElementById("burgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (!burgerBtn || !mobileMenu) return; // not on landing

  function openMenu() {
    mobileMenu.hidden = false;
    burgerBtn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    mobileMenu.hidden = true;
    burgerBtn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const isOpen = burgerBtn.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  }

  burgerBtn.addEventListener("click", toggleMenu);

  // Close when clicking a link
  mobileMenu.addEventListener("click", (e) => {
    const link = e.target.closest("[data-mobile-link]");
    if (link) closeMenu();
  });

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Close if resizing to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 640) closeMenu();
  });

  // Mirror lang/theme buttons
  const langBtnMobile = document.getElementById("langBtnMobile");
  const themeBtnMobile = document.getElementById("themeBtnMobile");
  const langLabelMobile = document.getElementById("langLabelMobile");

  // keep labels in sync
  function syncLangLabel() {
    const main = document.getElementById("langLabel");
    if (main && langLabelMobile) langLabelMobile.textContent = main.textContent;
  }
  syncLangLabel();

  if (langBtnMobile) {
    langBtnMobile.addEventListener("click", async () => {
      if (window.I18N?.toggleLang) await window.I18N.toggleLang();
      syncLangLabel();
    });
  }

  if (themeBtnMobile) {
    themeBtnMobile.addEventListener("click", () => {
      const themeBtn = document.getElementById("themeBtn");
      if (themeBtn) themeBtn.click(); // reuse existing logic
    });
  }
})();
