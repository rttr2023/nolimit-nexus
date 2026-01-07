/* =========================
   /js/app.js (REMPLACE TON app.js PAR CELUI-CI)
   ========================= */
(function () {
  "use strict";

  const COOKIE_THEME = "nb_theme";
  const COOKIE_PAID = "nb_paid";
  const COOKIE_ONBOARDING = "nb_onboarding";
  const DATA_KEY = "nb_appdata";

  function $(id) {
    return document.getElementById(id);
  }

  function isAppPage() {
    return location.pathname.endsWith("app.html");
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
    if (paid !== "true") location.href = "./index.html#pricing";
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
        applyTheme(current === "light" ? "dark" : "light");
      });
    }
  }

  // ---- Routing ----
  function initRouting() {
    const pages = [...document.querySelectorAll("[data-page]")];
    const sideItems = [...document.querySelectorAll(".side-item")];
    if (!pages.length) return;

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

  // ---- Date badge ----
  function initDateBadge() {
    const el = $("today");
    if (!el) return;
    el.textContent = new Date().toLocaleDateString(undefined, {
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

  // =========================
  // Data (single object)
  // =========================
  function defaultData() {
    return {
      project: null,
      projectResults: null,
      validation: { checks: [], notes: "" },
      branding: { name: "", promise: "", pitch: "" },
      finance: { price: 0, cost: 0, monthlyTarget: 0 },
      roadmap: { tasks: [] },
    };
  }

  function loadData() {
    return CookieStore.getObject(DATA_KEY) || defaultData();
  }

  function saveData(data) {
    CookieStore.setObject(DATA_KEY, data, 30);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // Onboarding (minimal)
  // =========================
  function computeOnboardingStatus() {
    const goal = $("goal");
    const time = $("time");
    const skills = $("skills");
    const status = $("onboardingStatus");
    if (!goal || !time || !skills) return 0;

    let done = 0;
    if (goal.value) done++;
    if (time.value) done++;
    if (skills.value.trim().length >= 2) done++;

    if (status) status.textContent = `${done}/3`;
    return done;
  }

  function loadOnboarding() {
    const data = CookieStore.getObject(COOKIE_ONBOARDING);
    if (!data) return;
    if ($("goal")) $("goal").value = data.goal || "";
    if ($("time")) $("time").value = data.time || "";
    if ($("skills")) $("skills").value = data.skills || "";
    computeOnboardingStatus();
  }

  function saveOnboarding() {
    const goal = $("goal")?.value || "";
    const time = $("time")?.value || "";
    const skills = ($("skills")?.value || "").trim();

    CookieStore.setObject(COOKIE_ONBOARDING, { goal, time, skills, updatedAt: Date.now() }, 30);
    $("onboardingSavedMsg").textContent = "Sauvegardé ✅";
    computeOnboardingStatus();
    showToast("Sauvegardé");
    updateDashboard();
  }

  function initOnboarding() {
    if (!isAppPage()) return;
    loadOnboarding();
    ["goal", "time", "skills"].forEach((id) => $(id)?.addEventListener("input", computeOnboardingStatus));
    $("saveOnboarding")?.addEventListener("click", saveOnboarding);
  }

  // =========================
  // Project → deterministic scoring & plan generation
  // =========================
  const VALIDATION_ITEMS = [
    "Définir une cible claire (persona) avec un besoin urgent.",
    "Lister 3 concurrents et analyser leurs offres/prix.",
    "Créer une offre simple (résultat + livrable + garantie).",
    "Fixer un prix cohérent + une marge minimale.",
    "Trouver 20 prospects (liste réelle).",
    "Envoyer 20 messages (ou appels) et obtenir 5 réponses.",
    "Faire 3 entretiens (ou retours) et noter les objections.",
    "Vendre 1 première version (même manuelle) et livrer.",
  ];

  function getOnboarding() {
    return CookieStore.getObject(COOKIE_ONBOARDING) || { goal: "", time: "", skills: "" };
  }

  function mapBudgetScore(b) {
    if (b === "0-50") return 1;
    if (b === "50-200") return 2;
    if (b === "200-1000") return 3;
    return 4; // 1000+
  }

  function mapTimeScore(t) {
    if (t === "2-5") return 1;
    if (t === "5-10") return 2;
    if (t === "10-20") return 3;
    if (t === "20+") return 4;
    return 2;
  }

  function mapExpScore(e) {
    if (e === "beginner") return 1;
    if (e === "intermediate") return 2;
    return 3;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // Scores 1..10 (déterministes)
  function computeScores(p, ob) {
    const budget = mapBudgetScore(p.budget);
    const time = mapTimeScore(ob.time);
    const exp = mapExpScore(p.exp);

    // Base by type
    const typeBase = {
      service: { profit: 6, speed: 8, ease: 7 },
      digital: { profit: 7, speed: 6, ease: 6 },
      subscription: { profit: 8, speed: 5, ease: 5 },
      physical: { profit: 6, speed: 4, ease: 4 },
      audience: { profit: 7, speed: 3, ease: 5 },
    }[p.type];

    // Audience modifiers
    const aud = p.audience;
    const audProfit = aud === "b2b" ? 2 : aud === "both" ? 1 : 0;
    const audSpeed = aud === "b2b" ? -1 : aud === "both" ? -0.5 : 0;
    const audEase = aud === "b2b" ? -0.5 : 0;

    // Budget helps speed/ease (outils, ads, matériel)
    const budgetSpeed = (budget - 2) * 0.7; // -0.7..+1.4
    const budgetEase = (budget - 2) * 0.7;

    // Time helps speed/ease
    const timeSpeed = (time - 2) * 0.8; // -0.8..+1.6
    const timeEase = (time - 2) * 0.8;

    // Experience helps ease (and a bit speed)
    const expEase = (exp - 1) * 0.9; // 0..1.8
    const expSpeed = (exp - 1) * 0.3; // 0..0.6

    // Skills mention gives a slight ease bump (deterministic)
    const skillsBonus = ob.skills && ob.skills.trim().length >= 3 ? 0.6 : 0;

    const profit = clamp(typeBase.profit + audProfit + (budget - 2) * 0.3, 1, 10);
    const speed = clamp(typeBase.speed + audSpeed + budgetSpeed + timeSpeed + expSpeed, 1, 10);
    const ease = clamp(typeBase.ease + audEase + budgetEase + timeEase + expEase + skillsBonus, 1, 10);

    return {
      profit: Math.round(profit),
      speed: Math.round(speed),
      ease: Math.round(ease),
    };
  }

  function suggestOffer(p, scores) {
    // Deterministic offer suggestions
    const isB2B = p.audience === "b2b";
    const type = p.type;

    // Price anchor
    let price;
    if (type === "service") price = isB2B ? 800 : 149;
    else if (type === "digital") price = isB2B ? 499 : 79;
    else if (type === "subscription") price = isB2B ? 99 : 19;
    else if (type === "physical") price = isB2B ? 299 : 49;
    else price = isB2B ? 0 : 0;

    // Adjust by profitability score
    const mult = 0.85 + (scores.profit - 5) * 0.04; // ~0.65..1.05
    price = Math.round(Math.max(9, price * mult));

    // Cost estimate (simple by type)
    let cost;
    if (type === "service") cost = Math.round(price * 0.15);
    else if (type === "digital") cost = Math.round(price * 0.10);
    else if (type === "subscription") cost = Math.round(price * 0.20);
    else if (type === "physical") cost = Math.round(price * 0.45);
    else cost = 0;

    return { price, cost };
  }

  function buildPlan(p, ob, scores, offer) {
    // Plan = 4 phases, each with tasks adapted by type/audience/time
    const timeScore = mapTimeScore(ob.time);
    const fastMode = timeScore >= 3; // 10h+ = plus d’actions

    const channel =
      p.audience === "b2b"
        ? "Prospection directe (LinkedIn, email, appels)"
        : p.audience === "b2c"
        ? "Contenu + DM + offre simple"
        : "Mix : contenu + prospection";

    const typeAngle =
      p.type === "service"
        ? "Vends une prestation simple, livrable clair, résultat mesurable."
        : p.type === "digital"
        ? "Vends un produit digital court (MVP), améliore avec retours."
        : p.type === "subscription"
        ? "Commence par une offre manuelle + abonnement ensuite."
        : p.type === "physical"
        ? "Commence avec précommande / petite série / validation avant stock."
        : "Construis une audience sur un sujet unique + offre payante ensuite.";

    const tasks = [];

    // Phase 1: Fondation (Semaine 1)
    tasks.push(
      task("S1", "Clarifier la cible", "Décris 1 persona + son problème urgent + résultat attendu."),
      task("S1", "Positionnement", "Écris : 'J'aide X à obtenir Y sans Z' + 3 preuves/avantages."),
      task("S1", "Offre MVP", `Crée une offre simple : prix ${offer.price}€ + livrable + délai + garantie.`)
    );

    // Phase 2: Validation (Semaine 2)
    tasks.push(
      task("S2", "Liste prospects", "Trouve 20 personnes/entreprises ciblées (liste réelle)."),
      task("S2", "Message", "Rédige 1 message court : problème → promesse → question."),
      task("S2", "Outreach", fastMode ? "Contacte 30 prospects (DM/email/appels)." : "Contacte 20 prospects (DM/email)."),
      task("S2", "Entretiens", fastMode ? "Fais 5 échanges (DM/appels) et note objections." : "Fais 3 échanges et note objections.")
    );

    // Phase 3: Vente (Semaine 3)
    tasks.push(
      task("S3", "Page offre", "Écris une page simple : promesse, pour qui, résultat, prix, FAQ, CTA."),
      task("S3", "Preuve", "Ajoute 1 preuve : démo, avant/après, mini étude, avis (même pilote)."),
      task("S3", "1ère vente", "Obtiens 1 client (même à prix pilote) et livre rapidement.")
    );

    // Phase 4: Système (Semaine 4)
    tasks.push(
      task("S4", "Process livraison", "Écris tes étapes de livraison (checklist) pour répéter."),
      task("S4", "Canal acquisition", `Choisis 1 canal principal : ${channel}.`),
      task("S4", "Routine", "Plan hebdo : 3 actions acquisition + 2 actions livraison + 1 action amélioration."),
      task("S4", "Optimisation", "Analyse : conversion, objections, prix, temps. Ajuste 1 variable.")
    );

    // Custom additions by type
    if (p.type === "physical") {
      tasks.push(
        task("S2", "Validation stock", "Fais une précommande ou une liste d’attente avant d’acheter du stock."),
        task("S3", "Fournisseur", "Identifie 2 fournisseurs + délais + coûts + MOQ.")
      );
    }

    if (p.type === "audience") {
      tasks.push(
        task("S1", "Sujet unique", "Choisis 1 niche + 1 promesse + 1 format (shorts)."),
        task("S2", "Calendrier contenu", fastMode ? "Publie 7 contenus/sem + CTA." : "Publie 4 contenus/sem + CTA."),
        task("S3", "Offre", `Crée une offre d’entrée : ${offer.price}€ (coaching, template, mini-formation).`)
      );
    }

    // Deterministic ordering: S1..S4
    tasks.sort((a, b) => (a.phase + a.title).localeCompare(b.phase + b.title));

    return { angle: typeAngle, channel, tasks };
  }

  function task(phase, title, detail) {
    return {
      id: phase + "_" + title.replace(/\s+/g, "_").toLowerCase() + "_" + Date.now().toString(16) + Math.random().toString(16).slice(2),
      phase,
      title,
      detail,
      done: false,
      createdAt: Date.now(),
    };
  }

  // =========================
  // Project UI
  // =========================
  function setProjectFormFromData() {
    const data = loadData();
    if (!data.project) return;
    $("pName").value = data.project.name || "";
    $("pDesc").value = data.project.desc || "";
    $("pType").value = data.project.type || "service";
    $("pAudience").value = data.project.audience || "b2c";
    $("pBudget").value = data.project.budget || "0-50";
    $("pExp").value = data.project.exp || "beginner";
    $("pGoalMonthly").value = data.project.goalMonthly ?? 2000;
  }

  function renderProjectResults() {
    const data = loadData();
    const r = data.projectResults;

    const badge = $("projectBadge");
    const scoreSummary = $("scoreSummary");
    const scoreBadges = $("scoreBadges");
    const scoreWhy = $("scoreWhy");
    const offerType = $("offerType");
    const offerPrice = $("offerPrice");
    const offerSales = $("offerSales");
    const planPreview = $("planPreview");

    if (!r) {
      if (badge) badge.textContent = "—";
      if (scoreSummary) scoreSummary.textContent = "—";
      if (scoreBadges) scoreBadges.innerHTML = `<span class="badge">Rentabilité —</span><span class="badge">Vitesse —</span><span class="badge">Facilité —</span>`;
      if (scoreWhy) scoreWhy.textContent = "Génère ton plan pour obtenir l’analyse.";
      if (offerType) offerType.textContent = "—";
      if (offerPrice) offerPrice.textContent = "—";
      if (offerSales) offerSales.textContent = "—";
      if (planPreview) planPreview.innerHTML = "";
      updateDashboard();
      return;
    }

    const { scores, offer, plan, monthlyTarget } = r;

    if (badge) badge.textContent = `OK`;
    if (scoreSummary) scoreSummary.textContent = `${scores.profit}/${scores.speed}/${scores.ease}`;
    if (scoreBadges) {
      scoreBadges.innerHTML = `
        <span class="badge">Rentabilité ${scores.profit}/10</span>
        <span class="badge">Vitesse ${scores.speed}/10</span>
        <span class="badge">Facilité ${scores.ease}/10</span>
      `;
    }

    if (scoreWhy) {
      scoreWhy.textContent =
        `Type: ${r.project.type} · Audience: ${r.project.audience} · Budget: ${r.project.budget} · Temps: ${r.onboarding.time || "—"} · Niveau: ${r.project.exp}.`;
    }

    const margin = Math.max(0, offer.price - offer.cost);
    const needed = margin > 0 ? Math.ceil(monthlyTarget / margin) : 0;

    if (offerType) offerType.textContent = plan.angle;
    if (offerPrice) offerPrice.textContent = `Prix conseillé : ${offer.price}€ (coût estimé ${offer.cost}€)`;
    if (offerSales) offerSales.textContent = margin > 0 ? `Pour ${monthlyTarget}€/mois : ~${needed} ventes/mois (marge ${margin}€).` : "—";

    if (planPreview) {
      const preview = plan.tasks.slice(0, 6);
      planPreview.innerHTML = preview
        .map(
          (t) => `
          <div class="card compact stack">
            <div class="row spread wrap">
              <strong>${escapeHtml(t.phase)} · ${escapeHtml(t.title)}</strong>
              <span class="badge">${t.done ? "Fait" : "À faire"}</span>
            </div>
            <div class="small muted">${escapeHtml(t.detail)}</div>
          </div>
        `
        )
        .join("");
    }

    // Sync other modules
    renderValidationFromPlan();
    renderFinanceFromOffer();
    renderRoadmapFromPlan();

    updateDashboard();
  }

  function generateProject() {
    const name = ($("pName").value || "").trim();
    const desc = ($("pDesc").value || "").trim();
    const msg = $("projectMsg");

    if (!name || !desc) {
      if (msg) msg.textContent = "Renseigne le nom ET la description.";
      return;
    }

    const ob = getOnboarding();
    const project = {
      name,
      desc,
      type: $("pType").value,
      audience: $("pAudience").value,
      budget: $("pBudget").value,
      exp: $("pExp").value,
      goalMonthly: Number($("pGoalMonthly").value || 0),
      updatedAt: Date.now(),
    };

    const scores = computeScores(project, ob);
    const offer = suggestOffer(project, scores);

    const monthlyTarget = project.goalMonthly && project.goalMonthly > 0 ? project.goalMonthly : 2000;
    const plan = buildPlan(project, ob, scores, offer);

    const data = loadData();
    data.project = project;
    data.projectResults = {
      project,
      onboarding: ob,
      scores,
      offer,
      monthlyTarget,
      plan,
      createdAt: Date.now(),
    };

    // Initialize validation checklist (deterministic)
    data.validation.checks = VALIDATION_ITEMS.map(() => false);
    data.validation.notes = "";

    // Branding defaults from project
    if (!data.branding.name) data.branding.name = project.name;
    if (!data.branding.promise) data.branding.promise = "J'aide X à obtenir Y sans Z.";
    if (!data.branding.pitch) data.branding.pitch = `Pour ${project.audience.toUpperCase()} · Offre: ${offer.price}€ · Résultat: ${project.desc}`;

    // Finance defaults from offer
    data.finance.price = offer.price;
    data.finance.cost = offer.cost;
    data.finance.monthlyTarget = monthlyTarget;

    // Roadmap tasks (replace)
    data.roadmap.tasks = plan.tasks.map((t) => ({ ...t }));

    saveData(data);

    if (msg) msg.textContent = "Plan généré ✅";
    showToast("Plan généré");

    renderProjectResults();
  }

  function initProject() {
    if (!$("generateBtn")) return;

    // Load existing data
    setProjectFormFromData();
    renderProjectResults();

    $("generateBtn").addEventListener("click", generateProject);
  }

  // =========================
  // Validation module (from fixed list)
  // =========================
  function renderValidationFromPlan() {
    const data = loadData();
    const box = $("validationChecklist");
    const notes = $("validationNotes");
    const badge = $("validationBadge");
    if (!box) return;

    const checks = Array.isArray(data.validation.checks) && data.validation.checks.length === VALIDATION_ITEMS.length
      ? data.validation.checks
      : VALIDATION_ITEMS.map(() => false);

    box.innerHTML = VALIDATION_ITEMS.map((label, i) => {
      const ok = !!checks[i];
      return `
        <div class="row spread wrap">
          <label class="row" style="gap:10px; align-items:flex-start; cursor:pointer">
            <input type="checkbox" data-i="${i}" ${ok ? "checked" : ""} />
            <span>${escapeHtml(label)}</span>
          </label>
          <span class="badge">${ok ? "OK" : "À faire"}</span>
        </div>
      `;
    }).join("");

    if (notes) notes.value = data.validation.notes || "";

    const pct = Math.round((checks.filter(Boolean).length / VALIDATION_ITEMS.length) * 100);
    if (badge) badge.textContent = `${pct}%`;

    box.onchange = (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-i]');
      if (!cb) return;
      const idx = Number(cb.dataset.i);
      const d = loadData();
      if (!Array.isArray(d.validation.checks) || d.validation.checks.length !== VALIDATION_ITEMS.length) {
        d.validation.checks = VALIDATION_ITEMS.map(() => false);
      }
      d.validation.checks[idx] = cb.checked;
      saveData(d);
      renderValidationFromPlan();
      updateDashboard();
    };
  }

  function initValidation() {
    if (!$("saveValidationBtn")) return;
    renderValidationFromPlan();

    $("saveValidationBtn").addEventListener("click", () => {
      const d = loadData();
      d.validation.notes = ($("validationNotes")?.value || "").trim();
      saveData(d);
      $("validationMsg").textContent = "Sauvegardé ✅";
      showToast("Sauvegardé");
      renderValidationFromPlan();
      updateDashboard();
    });
  }

  // =========================
  // Branding
  // =========================
  function initBranding() {
    const btn = $("saveBrandingBtn");
    if (!btn) return;

    const data = loadData();
    $("brandName").value = data.branding?.name || "";
    $("brandPromise").value = data.branding?.promise || "";
    $("brandPitch").value = data.branding?.pitch || "";
    updateBrandingBadge();

    btn.addEventListener("click", () => {
      const d = loadData();
      d.branding = {
        name: ($("brandName")?.value || "").trim(),
        promise: ($("brandPromise")?.value || "").trim(),
        pitch: ($("brandPitch")?.value || "").trim(),
      };
      saveData(d);
      $("brandingMsg").textContent = "Sauvegardé ✅";
      showToast("Sauvegardé");
      updateBrandingBadge();
      updateDashboard();
    });

    function updateBrandingBadge() {
      const d = loadData();
      const filled = [d.branding?.name, d.branding?.promise, d.branding?.pitch].filter((x) => (x || "").trim()).length;
      const b = $("brandingBadge");
      if (b) b.textContent = `${filled}/3`;
    }
  }

  // =========================
  // Finance
  // =========================
  function computeFinanceUI() {
    const price = Number($("price")?.value || 0);
    const cost = Number($("cost")?.value || 0);
    const target = Number($("monthlyTarget")?.value || 0);

    const margin = price - cost;
    $("marginValue").textContent = Number.isFinite(margin) ? `${margin.toFixed(2)} €` : "—";
    $("salesNeeded").textContent = margin > 0 ? `${Math.ceil(target / margin)}` : "—";
  }

  function renderFinanceFromOffer() {
    const d = loadData();
    if (!$("price")) return;

    $("price").value = d.finance?.price ?? 99;
    $("cost").value = d.finance?.cost ?? 20;
    $("monthlyTarget").value = d.finance?.monthlyTarget ?? 2000;

    computeFinanceUI();
    updateFinanceBadge();
  }

  function initFinance() {
    if (!$("saveFinanceBtn")) return;

    renderFinanceFromOffer();
    ["price", "cost", "monthlyTarget"].forEach((id) => $(id)?.addEventListener("input", computeFinanceUI));

    $("saveFinanceBtn").addEventListener("click", () => {
      const d = loadData();
      d.finance = {
        price: Number($("price")?.value || 0),
        cost: Number($("cost")?.value || 0),
        monthlyTarget: Number($("monthlyTarget")?.value || 0),
      };
      saveData(d);
      $("financeMsg").textContent = "Sauvegardé ✅";
      showToast("Sauvegardé");
      updateFinanceBadge();
      updateDashboard();
    });

    function updateFinanceBadge() {
      const d = loadData();
      const ok = (d.finance?.price ?? 0) > 0 && (d.finance?.monthlyTarget ?? 0) > 0;
      const b = $("financeBadge");
      if (b) b.textContent = ok ? "OK" : "—";
    }
  }

  function updateFinanceBadge() {
    const d = loadData();
    const ok = (d.finance?.price ?? 0) > 0 && (d.finance?.monthlyTarget ?? 0) > 0;
    const b = $("financeBadge");
    if (b) b.textContent = ok ? "OK" : "—";
  }

  // =========================
  // Roadmap (auto from plan + optional custom tasks)
  // =========================
  function renderRoadmapFromPlan() {
    const data = loadData();
    const list = $("tasksList");
    const empty = $("tasksEmpty");
    const badge = $("roadmapBadge");
    if (!list) return;

    const tasks = Array.isArray(data.roadmap.tasks) ? data.roadmap.tasks : [];

    list.innerHTML = "";
    if (!tasks.length) {
      if (empty) empty.style.display = "";
      if (badge) badge.textContent = "0%";
      return;
    }
    if (empty) empty.style.display = "none";

    const doneCount = tasks.filter((t) => t.done).length;
    const pct = Math.round((doneCount / tasks.length) * 100);
    if (badge) badge.textContent = `${pct}%`;

    // Group by phase
    const phases = ["S1", "S2", "S3", "S4"];
    phases.forEach((ph) => {
      const group = tasks.filter((t) => t.phase === ph);
      if (!group.length) return;

      const header = document.createElement("div");
      header.className = "row spread wrap";
      header.innerHTML = `<strong>${ph} · Semaine ${ph.slice(1)}</strong><span class="badge">${group.filter((t) => t.done).length}/${group.length}</span>`;
      list.appendChild(header);

      group.forEach((t) => {
        const row = document.createElement("div");
        row.className = "card compact stack";
        row.innerHTML = `
          <div class="row spread wrap">
            <label class="row" style="gap:10px; cursor:pointer">
              <input type="checkbox" data-act="toggle" data-id="${t.id}" ${t.done ? "checked" : ""} />
              <span style="${t.done ? "text-decoration:line-through; opacity:.75" : ""}">${escapeHtml(t.title)}</span>
            </label>
            <button class="btn btn-sm btn-danger" data-act="del" data-id="${t.id}">Supprimer</button>
          </div>
          <div class="small muted">${escapeHtml(t.detail || "")}</div>
        `;
        list.appendChild(row);
      });
    });

    list.onchange = (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-act="toggle"]');
      if (!cb) return;
      const id = cb.dataset.id;

      const d = loadData();
      const t = d.roadmap.tasks.find((x) => x.id === id);
      if (t) t.done = cb.checked;
      saveData(d);
      renderRoadmapFromPlan();
      updateDashboard();
    };

    list.onclick = (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act !== "del") return;

      const id = btn.dataset.id;
      const d = loadData();
      d.roadmap.tasks = d.roadmap.tasks.filter((x) => x.id !== id);
      saveData(d);
      renderRoadmapFromPlan();
      updateDashboard();
    };
  }

  function initRoadmap() {
    const addBtn = $("addTaskBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", () => {
      const title = ($("taskTitle")?.value || "").trim();
      if (!title) return;

      const d = loadData();
      d.roadmap.tasks.unshift({
        id: "custom_" + Date.now().toString(16) + Math.random().toString(16).slice(2),
        phase: "S4",
        title,
        detail: "Tâche personnalisée.",
        done: false,
        createdAt: Date.now(),
      });
      saveData(d);
      $("taskTitle").value = "";
      renderRoadmapFromPlan();
      updateDashboard();
    });

    renderRoadmapFromPlan();
  }

  // =========================
  // Dashboard (global progress)
  // =========================
  function updateDashboard() {
    if (!$("globalProgressText")) return;

    const ob = getOnboarding();
    const obDone = (() => {
      let d = 0;
      if (ob.goal) d++;
      if (ob.time) d++;
      if (ob.skills && ob.skills.trim().length >= 2) d++;
      return d;
    })();

    const data = loadData();
    const hasProject = !!data.projectResults;

    const validationChecks = Array.isArray(data.validation.checks) ? data.validation.checks : [];
    const validationPct = validationChecks.length ? validationChecks.filter(Boolean).length / validationChecks.length : 0;

    const tasks = Array.isArray(data.roadmap.tasks) ? data.roadmap.tasks : [];
    const roadmapPct = tasks.length ? tasks.filter((t) => t.done).length / tasks.length : 0;

    // Weighted: onboarding 20%, project 25%, validation 25%, roadmap 30%
    const pct =
      0.2 * (obDone / 3) +
      0.25 * (hasProject ? 1 : 0) +
      0.25 * validationPct +
      0.3 * roadmapPct;

    const pct100 = Math.round(pct * 100);
    $("globalProgressText").textContent = `${pct100}%`;
    $("globalProgressBar").style.width = `${pct100}%`;
    $("globalProgressBadge").textContent = hasProject ? "En cours" : "À démarrer";

    // next action
    const next = $("globalNextAction");
    if (next) {
      if (!ob.time || !ob.goal) next.textContent = "Complète l’onboarding (objectif + temps) pour calibrer ton plan.";
      else if (!hasProject) next.textContent = "Crée ton projet : nom + description, puis génère ton plan.";
      else if (validationPct < 0.4) next.textContent = "Fais les étapes de validation (prospects + retours).";
      else if (roadmapPct < 0.2) next.textContent = "Exécute la roadmap (S1 puis S2) et coche tes actions.";
      else next.textContent = "Continue : exécution + amélioration (optimisation hebdo).";
    }

    // project title & scores
    $("dashProjectTitle").textContent = data.project?.name ? data.project.name : "—";
    const dashScores = $("dashScores");
    if (dashScores) {
      const s = data.projectResults?.scores;
      dashScores.innerHTML = s
        ? `<span class="badge">Rentabilité ${s.profit}/10</span><span class="badge">Vitesse ${s.speed}/10</span><span class="badge">Facilité ${s.ease}/10</span>`
        : `<span class="badge">Rentabilité —</span><span class="badge">Vitesse —</span><span class="badge">Facilité —</span>`;
    }

    // goal
    const target = data.projectResults?.monthlyTarget ?? 0;
    $("dashGoal").textContent = target > 0 ? `${target}€ / mois` : "—";

    // sales needed
    const fin = data.finance || {};
    const margin = (fin.price || 0) - (fin.cost || 0);
    const needed = margin > 0 && target > 0 ? Math.ceil(target / margin) : null;
    $("dashSalesNeeded").textContent = needed ? `≈ ${needed} ventes/mois (marge ${margin}€)` : "—";
  }

  // =========================
  // Reset
  // =========================
  function initReset() {
    const resetBtn = $("resetBtn");
    if (!resetBtn) return;

    resetBtn.addEventListener("click", () => {
      if (!confirm("Réinitialiser toutes les données ?")) return;

      CookieStore.deleteCookie(COOKIE_THEME);
      CookieStore.deleteCookie("nb_lang");
      CookieStore.deleteObject(COOKIE_ONBOARDING);
      CookieStore.deleteObject(DATA_KEY);

      showToast("Données réinitialisées");
      location.href = "./app.html#dashboard";
      location.reload();
    });
  }

  // =========================
  // Init
  // =========================
  async function init() {
    enforcePaidGate();
    initTheme();
    await I18N.init();
    initLangButton();

    initRouting();
    initDateBadge();

    initOnboarding();
    initProject();
    initValidation();
    initBranding();
    initFinance();
    initRoadmap();
    initReset();

    // initial render
    computeOnboardingStatus();
    renderProjectResults();
    renderValidationFromPlan();
    renderFinanceFromOffer();
    renderRoadmapFromPlan();
    updateDashboard();
  }

  window.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => console.error(e));
  });
})();
