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
// Landing mobile menu (animated + overlay)
// =========================
(function () {
  const burgerBtn = document.getElementById("burgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileOverlay = document.getElementById("mobileOverlay");

  if (!burgerBtn || !mobileMenu || !mobileOverlay) return; // not on landing

  function openMenu() {
    mobileOverlay.hidden = false;
    mobileMenu.hidden = false;

    // trigger transitions
    requestAnimationFrame(() => {
      mobileOverlay.classList.add("show");
      mobileMenu.classList.add("show");
      burgerBtn.classList.add("is-open");
      burgerBtn.setAttribute("aria-expanded", "true");
    });
  }

  function closeMenu() {
    mobileOverlay.classList.remove("show");
    mobileMenu.classList.remove("show");
    burgerBtn.classList.remove("is-open");
    burgerBtn.setAttribute("aria-expanded", "false");

    // after transition, hide elements
    setTimeout(() => {
      mobileOverlay.hidden = true;
      mobileMenu.hidden = true;
    }, 220);
  }

  function toggleMenu() {
    const isOpen = burgerBtn.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  }

  burgerBtn.addEventListener("click", toggleMenu);

  // Close when clicking overlay
  mobileOverlay.addEventListener("click", closeMenu);

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

  // Mirror lang/theme buttons (optional)
  const langBtnMobile = document.getElementById("langBtnMobile");
  const themeBtnMobile = document.getElementById("themeBtnMobile");
  const langLabelMobile = document.getElementById("langLabelMobile");

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
      if (themeBtn) themeBtn.click();
    });
  }
})();
// =========================
// NOLIMIT-NEXUS App Data + Modules
// =========================
(function () {
  const DATA_KEY = "nb_appdata";

  function loadData() {
    return CookieStore.getObject(DATA_KEY) || {
      ideas: [],
      validation: {}, // by ideaId
      branding: { name: "", promise: "", pitch: "" },
      finance: { price: 0, cost: 0, monthlyTarget: 0 },
      roadmap: { tasks: [] }
    };
  }

  function saveData(data) {
    CookieStore.setObject(DATA_KEY, data, 30);
  }

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function clamp1to10(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 5;
    return Math.min(10, Math.max(1, Math.round(x)));
  }

  function scoreIdea(idea) {
    // Score simple: moyenne pondérée
    return Math.round((idea.profit * 0.45 + idea.speed * 0.35 + idea.ease * 0.20) * 10) / 10;
  }

  // ---- IDEAS ----
  function renderIdeas() {
    const data = loadData();
    const list = el("ideasList");
    const empty = el("ideasEmpty");
    const count = el("ideasCount");
    if (!list) return;

    if (count) count.textContent = String(data.ideas.length);

    list.innerHTML = "";
    if (data.ideas.length === 0) {
      if (empty) empty.style.display = "";
      renderValidationSelect(); // keep synced
      return;
    }
    if (empty) empty.style.display = "none";

    data.ideas.forEach((idea) => {
      const sc = scoreIdea(idea);
      const card = document.createElement("div");
      card.className = "card compact stack";
      card.innerHTML = `
        <div class="row spread wrap">
          <div class="stack" style="gap:4px">
            <div class="h3">${escapeHtml(idea.title)}</div>
            <div class="small muted">${escapeHtml(idea.desc || "")}</div>
          </div>
          <span class="badge ok">Score ${sc}</span>
        </div>
        <div class="row wrap">
          <span class="badge">Rentabilité ${idea.profit}/10</span>
          <span class="badge">Vitesse ${idea.speed}/10</span>
          <span class="badge">Facilité ${idea.ease}/10</span>
        </div>
        <div class="row spread wrap">
          <button class="btn btn-sm" data-act="use" data-id="${idea.id}">Valider</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-id="${idea.id}">Supprimer</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.onclick = (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      const id = btn.dataset.id;

      const data2 = loadData();
      if (act === "del") {
        data2.ideas = data2.ideas.filter((x) => x.id !== id);
        // cleanup validation for removed idea
        delete data2.validation[id];
        saveData(data2);
        renderIdeas();
        renderValidationSelect();
        return;
      }
      if (act === "use") {
        location.hash = "#validation";
        setTimeout(() => {
          const sel = el("validationIdeaSelect");
          if (sel) sel.value = id;
          renderValidationChecklist();
        }, 50);
      }
    };

    renderValidationSelect();
  }

  function initIdeas() {
    const addBtn = el("addIdeaBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", () => {
      const title = (el("ideaTitle")?.value || "").trim();
      const desc = (el("ideaDesc")?.value || "").trim();
      const msg = el("ideaMsg");

      if (!title) {
        if (msg) msg.textContent = "Ajoute un titre.";
        return;
      }

      const idea = {
        id: uid(),
        title,
        desc,
        profit: clamp1to10(el("ideaProfit")?.value),
        speed: clamp1to10(el("ideaSpeed")?.value),
        ease: clamp1to10(el("ideaEase")?.value),
        createdAt: Date.now()
      };

      const data = loadData();
      data.ideas.unshift(idea);
      saveData(data);

      if (el("ideaTitle")) el("ideaTitle").value = "";
      if (el("ideaDesc")) el("ideaDesc").value = "";
      if (msg) msg.textContent = "Idée ajoutée ✅";

      renderIdeas();
    });

    el("sortIdeasBtn")?.addEventListener("click", () => {
      const data = loadData();
      data.ideas.sort((a, b) => scoreIdea(b) - scoreIdea(a));
      saveData(data);
      renderIdeas();
    });

    renderIdeas();
  }

  // ---- VALIDATION ----
  const VALIDATION_ITEMS = [
    "J’ai identifié une cible claire (persona).",
    "Le problème est réel et fréquent.",
    "Ma solution est simple à expliquer.",
    "Je connais au moins 3 concurrents et leurs offres.",
    "J’ai une proposition de valeur différenciante.",
    "J’ai une première offre (prix + contenu).",
    "J’ai trouvé 10 personnes à contacter.",
    "J’ai obtenu au moins 3 retours réels (DM, appel, commentaire)."
  ];

  function renderValidationSelect() {
    const sel = el("validationIdeaSelect");
    if (!sel) return;

    const data = loadData();
    sel.innerHTML = "";

    if (data.ideas.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Aucune idée — ajoute-en dans le module Idées";
      sel.appendChild(opt);
      renderValidationChecklist();
      return;
    }

    data.ideas.forEach((idea) => {
      const opt = document.createElement("option");
      opt.value = idea.id;
      opt.textContent = idea.title;
      sel.appendChild(opt);
    });

    renderValidationChecklist();
    sel.onchange = renderValidationChecklist;
  }

  function renderValidationChecklist() {
    const sel = el("validationIdeaSelect");
    const box = el("validationChecklist");
    const notes = el("validationNotes");
    const badge = el("validationBadge");
    if (!sel || !box) return;

    const ideaId = sel.value;
    const data = loadData();

    box.innerHTML = "";

    if (!ideaId) {
      if (notes) notes.value = "";
      if (badge) badge.textContent = "0%";
      return;
    }

    const state = data.validation[ideaId] || { checks: Array(VALIDATION_ITEMS.length).fill(false), notes: "" };

    VALIDATION_ITEMS.forEach((label, i) => {
      const row = document.createElement("div");
      row.className = "row spread wrap";
      row.innerHTML = `
        <label class="row" style="gap:10px; align-items:flex-start; cursor:pointer">
          <input type="checkbox" data-i="${i}" ${state.checks[i] ? "checked" : ""} />
          <span>${escapeHtml(label)}</span>
        </label>
        <span class="badge">${state.checks[i] ? "OK" : "À faire"}</span>
      `;
      box.appendChild(row);
    });

    if (notes) notes.value = state.notes || "";

    const pct = Math.round((state.checks.filter(Boolean).length / VALIDATION_ITEMS.length) * 100);
    if (badge) badge.textContent = `${pct}%`;

    box.onchange = (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-i]');
      if (!cb) return;
      const idx = Number(cb.dataset.i);
      const d2 = loadData();
      const s2 = d2.validation[ideaId] || { checks: Array(VALIDATION_ITEMS.length).fill(false), notes: "" };
      s2.checks[idx] = cb.checked;
      d2.validation[ideaId] = s2;
      saveData(d2);
      renderValidationChecklist();
    };
  }

  function initValidation() {
    const btn = el("saveValidationBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const sel = el("validationIdeaSelect");
      const msg = el("validationMsg");
      const notes = el("validationNotes");

      if (!sel || !sel.value) {
        if (msg) msg.textContent = "Choisis une idée.";
        return;
      }

      const ideaId = sel.value;
      const data = loadData();
      const state = data.validation[ideaId] || { checks: Array(VALIDATION_ITEMS.length).fill(false), notes: "" };
      state.notes = (notes?.value || "").trim();
      data.validation[ideaId] = state;
      saveData(data);

      if (msg) msg.textContent = "Sauvegardé ✅";
      renderValidationChecklist();
    });

    renderValidationSelect();
  }

  // ---- BRANDING ----
  function initBranding() {
    const btn = el("saveBrandingBtn");
    if (!btn) return;

    const data = loadData();
    if (el("brandName")) el("brandName").value = data.branding?.name || "";
    if (el("brandPromise")) el("brandPromise").value = data.branding?.promise || "";
    if (el("brandPitch")) el("brandPitch").value = data.branding?.pitch || "";
    updateBrandingBadge();

    btn.addEventListener("click", () => {
      const d = loadData();
      d.branding = {
        name: (el("brandName")?.value || "").trim(),
        promise: (el("brandPromise")?.value || "").trim(),
        pitch: (el("brandPitch")?.value || "").trim()
      };
      saveData(d);
      el("brandingMsg").textContent = "Sauvegardé ✅";
      updateBrandingBadge();
    });

    function updateBrandingBadge() {
      const d = loadData();
      const filled = [d.branding?.name, d.branding?.promise, d.branding?.pitch].filter((x) => (x || "").trim()).length;
      const b = el("brandingBadge");
      if (b) b.textContent = `${filled}/3`;
    }
  }

  // ---- FINANCE ----
  function computeFinance() {
    const price = Number(el("price")?.value || 0);
    const cost = Number(el("cost")?.value || 0);
    const target = Number(el("monthlyTarget")?.value || 0);

    const margin = price - cost;
    el("marginValue").textContent = isFinite(margin) ? `${margin.toFixed(2)} €` : "—";

    const needed = margin > 0 ? Math.ceil(target / margin) : 0;
    el("salesNeeded").textContent = margin > 0 ? `${needed}` : "—";
  }

  function initFinance() {
    if (!el("saveFinanceBtn")) return;

    const data = loadData();
    if (el("price")) el("price").value = data.finance?.price ?? 99;
    if (el("cost")) el("cost").value = data.finance?.cost ?? 20;
    if (el("monthlyTarget")) el("monthlyTarget").value = data.finance?.monthlyTarget ?? 2000;

    ["price", "cost", "monthlyTarget"].forEach((id) => el(id)?.addEventListener("input", computeFinance));
    computeFinance();
    updateFinanceBadge();

    el("saveFinanceBtn").addEventListener("click", () => {
      const d = loadData();
      d.finance = {
        price: Number(el("price")?.value || 0),
        cost: Number(el("cost")?.value || 0),
        monthlyTarget: Number(el("monthlyTarget")?.value || 0)
      };
      saveData(d);
      el("financeMsg").textContent = "Sauvegardé ✅";
      updateFinanceBadge();
    });

    function updateFinanceBadge() {
      const d = loadData();
      const ok = (d.finance?.price ?? 0) > 0 && (d.finance?.monthlyTarget ?? 0) > 0;
      const b = el("financeBadge");
      if (b) b.textContent = ok ? "OK" : "—";
    }
  }

  // ---- ROADMAP ----
  function renderTasks() {
    const data = loadData();
    const list = el("tasksList");
    const empty = el("tasksEmpty");
    const badge = el("roadmapBadge");
    if (!list) return;

    list.innerHTML = "";
    const tasks = data.roadmap?.tasks || [];

    if (tasks.length === 0) {
      if (empty) empty.style.display = "";
      if (badge) badge.textContent = "0%";
      return;
    }
    if (empty) empty.style.display = "none";

    const doneCount = tasks.filter((t) => t.done).length;
    const pct = Math.round((doneCount / tasks.length) * 100);
    if (badge) badge.textContent = `${pct}%`;

    tasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "card compact row spread wrap";
      row.innerHTML = `
        <label class="row" style="gap:10px; cursor:pointer">
          <input type="checkbox" data-act="toggle" data-id="${t.id}" ${t.done ? "checked" : ""} />
          <span style="${t.done ? "text-decoration:line-through; opacity:.7" : ""}">${escapeHtml(t.title)}</span>
        </label>
        <button class="btn btn-sm btn-danger" data-act="del" data-id="${t.id}">Supprimer</button>
      `;
      list.appendChild(row);
    });

    list.onclick = (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;

      const d = loadData();
      if (act === "del") {
        d.roadmap.tasks = d.roadmap.tasks.filter((x) => x.id !== id);
        saveData(d);
        renderTasks();
      }
    };

    list.onchange = (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-act="toggle"]');
      if (!cb) return;
      const id = cb.dataset.id;
      const d = loadData();
      const t = d.roadmap.tasks.find((x) => x.id === id);
      if (t) t.done = cb.checked;
      saveData(d);
      renderTasks();
    };
  }

  function initRoadmap() {
    const addBtn = el("addTaskBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", () => {
      const title = (el("taskTitle")?.value || "").trim();
      if (!title) return;

      const d = loadData();
      d.roadmap.tasks.unshift({ id: uid(), title, done: false, createdAt: Date.now() });
      saveData(d);

      el("taskTitle").value = "";
      renderTasks();
    });

    renderTasks();
  }

  // ---- helpers ----
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Init only on app page (if these elements exist)
  window.addEventListener("DOMContentLoaded", () => {
    initIdeas();
    initValidation();
    initBranding();
    initFinance();
    initRoadmap();
  });
})();


