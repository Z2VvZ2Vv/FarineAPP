const apiBase = "";
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const appState = {
  recipes: [],
  selectedRecipe: null,
  selectedWeight: null,
  mixTimer: null,
  manualTimer: null,
  currentStepIndex: 0,
  editingRecipeName: null,
  motors: { corn: false, alfalfa: false },
  tared: false,
};

const weightOptions = [200, 400, 600, 800];
const ingredientNames = ["Mais/Ble", "Luzerne", "Lin"];
const motorLabels = { corn: "Maïs / Blé", alfalfa: "Luzerne" };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stopTimers() {
  window.clearInterval(appState.mixTimer);
  window.clearInterval(appState.manualTimer);
  appState.mixTimer = null;
  appState.manualTimer = null;
}

function showToast(message, tone = "info") {
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(toUserError(payload.error || `Erreur serveur ${response.status}`));
  }
  return payload;
}

function toUserError(message) {
  const text = String(message || "");
  const replacements = [
    ["Recipe already exists", "Cette ration existe déjà."],
    ["Recipe not found", "Cette ration n'existe plus."],
    ["Recipe name is required", "Ajoutez un nom de ration."],
    ["At least one ingredient is required", "Ajoutez au moins un ingrédient."],
    ["Ingredient percentages must total 100", "Le total des ingrédients doit faire 100%."],
    ["A mix is already in progress", "Une ration est déjà en cours."],
    ["Recipe is required", "Choisissez d'abord une ration."],
    ["totalWeight must be greater than 0", "Choisissez un poids supérieur à 0 kg."],
  ];
  const found = replacements.find(([needle]) => text.includes(needle));
  return found ? found[1] : text;
}

function bindActions() {
  app.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    if (action === "home") button.addEventListener("click", renderHome);
    if (action === "refresh") button.addEventListener("click", refreshHome);
    if (action === "manual") button.addEventListener("click", renderManual);
    if (action === "admin-rations") button.addEventListener("click", () => renderAdmin("rations"));
    if (action === "admin-status") button.addEventListener("click", () => renderAdmin("status"));
    if (action === "admin-stats") button.addEventListener("click", () => renderAdmin("stats"));
  });
}

function iconButton(label, icon, action, extraClass = "") {
  return `
    <button class="icon-button ${extraClass}" type="button" data-action="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span aria-hidden="true">${icon}</span>
      <span class="button-label">${escapeHtml(label)}</span>
    </button>
  `;
}

function pageTop(title, subtitle, options = {}) {
  const { backAction = "home", actions = "" } = options;
  return `
    <header class="topbar">
      <div class="topbar-left">
        ${backAction ? iconButton("Accueil", "←", backAction, "quiet compact") : ""}
        <div>
          <div class="app-name">🌾 FarineAPP</div>
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        </div>
      </div>
      <div class="topbar-actions">${actions}</div>
    </header>
  `;
}

function loadRecipes() {
  return request("/api/recipes").then((recipes) => {
    appState.recipes = recipes;
  });
}

async function refreshHome() {
  try {
    await loadRecipes();
    renderHome();
    showToast("Liste mise à jour.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function ingredientsText(recipe) {
  return (recipe.ingredients || [])
    .filter((ingredient) => Number(ingredient.percentage) > 0)
    .map((ingredient) => `${displayIngredientName(ingredient.name)} ${ingredient.percentage}%`)
    .join(" · ");
}

function displayIngredientName(name) {
  if (name === "Mais/Ble" || name === "Mais/Blé") return "Maïs / Blé";
  return name;
}

function recipeIcon(recipe, index = 0) {
  const name = String(recipe?.name || "").toLowerCase();
  if (name.includes("brout")) return "🥣";
  if (name.includes("gén") || name.includes("gen")) return "🌱";
  if (name.includes("vache")) return "🌾";
  return ["🌾", "🥣", "📦", "🌱"][index % 4];
}

function recipeTotalIngredients(recipe) {
  return (recipe.ingredients || []).length;
}

function renderHome() {
  stopTimers();
  appState.selectedRecipe = null;
  appState.selectedWeight = null;
  appState.currentStepIndex = 0;

  app.innerHTML = `
    <main class="screen home-screen" aria-label="Choix de la ration">
      <div class="home-actions left">
        ${iconButton("Mode manuel", "⚙️", "manual", "quiet")}
      </div>
      <div class="home-actions right">
        ${iconButton("Actualiser", "🔄", "refresh", "quiet compact")}
      </div>
      <section class="home-content">
        <div class="home-inner">
          <header class="home-header">
            <h1>FarineAPP</h1>
            <p>Choisissez la ration</p>
          </header>
          <div class="ration-grid" aria-label="Rations disponibles">
            ${appState.recipes.length ? appState.recipes.map((recipe, index) => `
              <button class="ration-card" type="button" data-recipe-index="${index}">
                <span class="ration-icon" aria-hidden="true">${recipeIcon(recipe, index)}</span>
                <span class="ration-name">${escapeHtml(recipe.name)}</span>
                <span class="ration-meta">${recipeTotalIngredients(recipe)} ingrédients</span>
                <span class="ration-ingredients">${escapeHtml(ingredientsText(recipe))}</span>
              </button>
            `).join("") : `
              <div class="empty-state">
                <strong>Aucune ration pour le moment.</strong>
                <span>Ajoutez votre première ration depuis le bouton Gérer.</span>
              </div>
            `}
          </div>
          <button class="home-admin-link" type="button" data-action="admin-rations">Gérer les rations</button>
        </div>
      </section>
    </main>
  `;

  app.querySelectorAll("[data-recipe-index]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedRecipe = appState.recipes[Number(button.dataset.recipeIndex)];
      renderWeightSelection();
    });
  });
  bindActions();
}

function renderRecipeSummary(recipe) {
  return `
    <section class="recipe-summary">
      <span class="ration-icon large" aria-hidden="true">${recipeIcon(recipe)}</span>
      <div>
        <h2>${escapeHtml(recipe.name)}</h2>
        <p>${escapeHtml(ingredientsText(recipe))}</p>
      </div>
    </section>
  `;
}

function renderWeightSelection() {
  stopTimers();
  const recipe = appState.selectedRecipe;
  app.innerHTML = `
    <main class="screen page-screen">
      ${pageTop("Choisir le poids", "Sélectionnez la quantité à préparer.", {
        actions: iconButton("Mode manuel", "⚙️", "manual", "quiet"),
      })}
      <section class="flow-layout">
        ${renderRecipeSummary(recipe)}
        <section class="choice-panel" aria-label="Poids de la ration">
          <div class="weight-grid">
            ${weightOptions.map((weight) => `
              <button class="weight-option" type="button" data-weight="${weight}">
                <strong>${weight}</strong>
                <span>kg</span>
              </button>
            `).join("")}
          </div>
          <label class="custom-weight">
            <span>Autre poids</span>
            <input id="custom-weight" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex. 500">
          </label>
          <div class="button-row">
            <button class="button secondary" type="button" data-action="home">Retour</button>
            <button class="button primary" type="button" id="continue-weight" disabled>Continuer</button>
          </div>
        </section>
      </section>
    </main>
  `;

  function selectWeight(value, selectedButton = null) {
    appState.selectedWeight = Number(value);
    app.querySelectorAll(".weight-option").forEach((item) => item.classList.remove("selected"));
    if (selectedButton) selectedButton.classList.add("selected");
    app.querySelector("#continue-weight").disabled = !(appState.selectedWeight > 0);
  }

  app.querySelectorAll("[data-weight]").forEach((button) => {
    button.addEventListener("click", () => selectWeight(button.dataset.weight, button));
  });
  app.querySelector("#custom-weight").addEventListener("input", (event) => {
    selectWeight(event.target.value);
  });
  app.querySelector("#continue-weight").addEventListener("click", renderConfirmation);
  bindActions();
}

function renderConfirmation() {
  const recipe = appState.selectedRecipe;
  app.innerHTML = `
    <main class="screen page-screen">
      ${pageTop("Tout est prêt ?", "Vérifiez une dernière fois avant de lancer.", {
        backAction: "home",
      })}
      <section class="flow-layout compact-flow">
        ${renderRecipeSummary(recipe)}
        <section class="confirm-panel">
          <div class="confirm-icon" aria-hidden="true">✅</div>
          <p class="eyebrow">Quantité choisie</p>
          <strong class="big-number">${escapeHtml(appState.selectedWeight)} kg</strong>
          <p class="friendly-copy">La préparation démarre avec cette ration.</p>
          <div class="button-row">
            <button class="button secondary" type="button" id="back-weight">Modifier</button>
            <button class="button primary" type="button" id="start-mix">Lancer</button>
          </div>
        </section>
      </section>
    </main>
  `;
  app.querySelector("#back-weight").addEventListener("click", renderWeightSelection);
  app.querySelector("#start-mix").addEventListener("click", startMix);
  bindActions();
}

async function startMix() {
  try {
    await request("/api/mix/start", {
      method: "POST",
      body: JSON.stringify({
        recipe: appState.selectedRecipe,
        totalWeight: appState.selectedWeight,
      }),
    });
    renderMix();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function buildStepFromIndex(recipe, totalWeight, currentWeight, index) {
  const ingredients = recipe.ingredients || [];
  const ingredient = ingredients[index];
  if (!ingredient) return null;
  const previous = ingredients
    .slice(0, index)
    .reduce((sum, item) => sum + (Number(item.percentage) / 100) * totalWeight, 0);
  const target = (Number(ingredient.percentage) / 100) * totalWeight;
  const progress = target > 0 ? ((currentWeight - previous) / target) * 100 : 0;
  return {
    index,
    ingredient,
    previous,
    target,
    currentProgress: Math.max(0, Math.min(100, progress)),
  };
}

function getStep(recipe, totalWeight, currentWeight) {
  const ingredients = recipe.ingredients || [];
  let cumulative = 0;
  for (let index = 0; index < ingredients.length; index += 1) {
    const ingredient = ingredients[index];
    const target = (Number(ingredient.percentage) / 100) * totalWeight;
    cumulative += target;
    if (currentWeight <= cumulative || index === ingredients.length - 1) {
      return buildStepFromIndex(recipe, totalWeight, currentWeight, index);
    }
  }
  return null;
}

function renderMix() {
  stopTimers();
  app.innerHTML = `
    <main class="screen mix-screen" aria-label="Ration en cours">
      <header class="mix-top">
        <div>
          <div class="app-name">🌾 FarineAPP</div>
          <h1>Ration en cours</h1>
          <p id="connection-warning" hidden>La balance ne répond plus. Le dernier poids reste affiché.</p>
        </div>
      </header>
      <section class="mix-grid">
        <article class="focus-card">
          <div class="step-navigation">
            <button class="round-icon" type="button" id="prev-step" aria-label="Ingrédient précédent">←</button>
            <div>
              <p class="eyebrow" id="step-number">Étape</p>
              <h2 id="step-name">...</h2>
              <p id="step-target">...</p>
            </div>
            <button class="round-icon" type="button" id="next-step" aria-label="Ingrédient suivant">→</button>
          </div>
          <div class="progress-label">
            <span id="step-progress-label">0% de cet ingrédient</span>
          </div>
          <div class="progress-bar"><div class="progress-fill warm" id="step-progress"></div></div>
        </article>
        <article class="mix-progress-card">
          <div class="progress-ring" id="overall-ring" style="--progress:0%;">
            <div class="progress-ring-inner">
              <p>Poids</p>
              <strong id="mix-weight">0.0</strong>
              <span>kg</span>
            </div>
          </div>
          <strong class="ring-percent" id="overall-percent">0%</strong>
          <span class="ring-detail" id="overall-detail">0.0 / 0 kg</span>
          <p class="ring-remaining" id="remaining-weight">Encore 0.0 kg à ajouter</p>
        </article>
      </section>
      <footer class="mix-footer">
        <button class="button danger mix-stop" type="button" id="stop-button">⛔ Arrêter</button>
      </footer>
    </main>
  `;

  app.querySelector("#stop-button").addEventListener("click", stopMix);
  app.querySelector("#prev-step").addEventListener("click", () => {
    appState.currentStepIndex = Math.max(0, appState.currentStepIndex - 1);
    refreshMix(false);
  });
  app.querySelector("#next-step").addEventListener("click", () => {
    const count = appState.selectedRecipe?.ingredients?.length || 1;
    appState.currentStepIndex = Math.min(count - 1, appState.currentStepIndex + 1);
    refreshMix(false);
  });

  refreshMix();
  appState.mixTimer = window.setInterval(refreshMix, 1000);
}

async function refreshMix(allowAutoStep = true) {
  try {
    const mix = await request("/api/mix/status");
    if (!mix.inProgress || !mix.recipe) {
      renderHome();
      return;
    }

    appState.selectedRecipe = mix.recipe;
    appState.selectedWeight = Number(mix.totalWeight || 0);
    const weight = await request("/api/weight");
    const currentWeight = Number(weight.value || 0);
    const totalWeight = Number(mix.totalWeight || 0);
    const overall = totalWeight > 0 ? Math.min(100, (currentWeight / totalWeight) * 100) : 0;
    const autoStep = getStep(mix.recipe, totalWeight, currentWeight);
    if (allowAutoStep && autoStep) appState.currentStepIndex = autoStep.index;
    const step = buildStepFromIndex(mix.recipe, totalWeight, currentWeight, appState.currentStepIndex) || autoStep;

    app.querySelector("#connection-warning").hidden = Boolean(mix.hardware?.rpiConnected);
    app.querySelector("#mix-weight").textContent = currentWeight.toFixed(1);
    app.querySelector("#overall-percent").textContent = `${Math.round(overall)}%`;
    app.querySelector("#overall-detail").textContent = `${currentWeight.toFixed(1)} / ${totalWeight} kg`;
    app.querySelector("#overall-ring").style.setProperty("--progress", `${overall}%`);
    app.querySelector("#remaining-weight").textContent = `Encore ${Math.max(totalWeight - currentWeight, 0).toFixed(1)} kg à ajouter`;

    if (step) {
      app.querySelector("#step-number").textContent = `Ingrédient ${step.index + 1} sur ${mix.recipe.ingredients.length}`;
      app.querySelector("#step-name").textContent = displayIngredientName(step.ingredient.name);
      app.querySelector("#step-target").textContent = `Objectif: ${step.target.toFixed(1)} kg`;
      app.querySelector("#step-progress-label").textContent = `${Math.round(step.currentProgress)}% de cet ingrédient`;
      app.querySelector("#step-progress").style.width = `${step.currentProgress}%`;
    }

    if (overall >= 100) {
      await completeMix();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function tareScale() {
  try {
    await request("/api/tare", { method: "POST", body: "{}" });
    showToast("Balance remise à zéro.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function untareScale() {
  try {
    await request("/api/tare/reset", { method: "POST", body: "{}" });
    showToast("Tare retirée.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function toggleTare() {
  const tared = appState.tared;
  try {
    await request(tared ? "/api/tare/reset" : "/api/tare", { method: "POST", body: "{}" });
    showToast(tared ? "Tare retirée." : "Balance remise à zéro.", "success");
    await refreshManual();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function stopMix() {
  try {
    await request("/api/mix/stop", { method: "POST", body: "{}" });
    showToast("Ration arrêtée.", "info");
    renderHome();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function completeMix() {
  try {
    await request("/api/mix/complete", { method: "POST", body: "{}" });
    showToast("Ration terminée.", "success");
    renderCompletion();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderCompletion() {
  stopTimers();
  app.innerHTML = `
    <main class="screen page-screen">
      ${pageTop("Ration terminée", "La préparation est enregistrée.", { backAction: "home" })}
      <section class="finish-panel">
        <div class="confirm-icon success" aria-hidden="true">✅</div>
        <h2>${escapeHtml(appState.selectedRecipe?.name || "Ration")}</h2>
        <strong class="big-number">${escapeHtml(appState.selectedWeight || 0)} kg</strong>
        <div class="tare-actions">
          <button class="button warn" type="button" id="finish-tare">⚖️ Faire la tare</button>
          <button class="button secondary" type="button" id="finish-untare">↩️ Retirer la tare</button>
        </div>
        <button class="button primary" type="button" data-action="home">Nouvelle ration</button>
      </section>
    </main>
  `;
  app.querySelector("#finish-tare").addEventListener("click", tareScale);
  app.querySelector("#finish-untare").addEventListener("click", untareScale);
  bindActions();
}

async function renderManual() {
  stopTimers();
  app.innerHTML = `
    <main class="screen page-screen manual-screen" aria-label="Mode manuel">
      ${pageTop("Mode manuel", "Vérifiez le poids, faites la tare ou pilotez les moteurs.", {
        actions: iconButton("Actualiser", "🔄", "manual", "quiet"),
      })}
      <section class="manual-card">
        <div class="scale-display" id="manual-scale-ring">
          <span aria-hidden="true">⚖️</span>
          <strong id="manual-weight">--</strong>
          <small id="manual-weight-label">Poids actuel</small>
        </div>
        <div class="manual-side">
          <div class="manual-motors" aria-label="Commande des moteurs">
            <p class="manual-motors-title">Moteurs</p>
            <div class="motor-grid">
              ${Object.entries(motorLabels).map(([motor, label]) => `
                <button class="motor-toggle" type="button" data-motor="${motor}" aria-pressed="false">
                  <span class="motor-name">${escapeHtml(label)}</span>
                  <span class="motor-state">…</span>
                </button>
              `).join("")}
            </div>
          </div>
          <button class="button warn full" type="button" id="manual-tare-toggle">⚖️ Faire la tare</button>
        </div>
      </section>
    </main>
  `;
  bindActions();
  app.querySelector("#manual-tare-toggle").addEventListener("click", toggleTare);
  app.querySelectorAll("[data-motor]").forEach((button) => {
    button.addEventListener("click", () => toggleMotor(button.dataset.motor));
  });
  updateMotorButtons();
  await refreshMotors();
  await refreshManual();
  appState.manualTimer = window.setInterval(refreshManual, 1000);
}

function updateMotorButtons() {
  app.querySelectorAll("[data-motor]").forEach((button) => {
    const on = Boolean(appState.motors[button.dataset.motor]);
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    const stateLabel = button.querySelector(".motor-state");
    if (stateLabel) stateLabel.textContent = on ? "● En marche" : "○ Arrêté";
  });
}

async function refreshMotors() {
  try {
    const payload = await request("/api/motors/status");
    appState.motors = payload.motors || appState.motors;
    updateMotorButtons();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function toggleMotor(motor) {
  const turnOn = !appState.motors[motor];
  try {
    const result = await request(`/api/motors/${motor}/${turnOn ? "on" : "off"}`, {
      method: "POST",
      body: "{}",
    });
    appState.motors = result.motors || appState.motors;
    updateMotorButtons();
    showToast(`${motorLabels[motor]} ${appState.motors[motor] ? "en marche." : "arrêté."}`, "success");
  } catch (error) {
    if (error?.motors) appState.motors = error.motors;
    updateMotorButtons();
    showToast(error.message, "error");
  }
}

async function refreshManual() {
  try {
    const weight = await request("/api/weight");
    app.querySelector("#manual-weight").textContent = `${Number(weight.value || 0).toFixed(1)} kg`;
    app.querySelector("#manual-weight-label").textContent = weight.error ? "Dernier poids connu" : "Poids actuel";
    app.querySelector("#manual-scale-ring").classList.toggle("error", Boolean(weight.error));

    appState.tared = Boolean(weight.tared);
    const tareToggle = app.querySelector("#manual-tare-toggle");
    if (tareToggle) {
      tareToggle.textContent = appState.tared ? "↩️ Retirer la tare" : "⚖️ Faire la tare";
      tareToggle.className = `button full ${appState.tared ? "secondary" : "warn"}`;
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAdmin(tab = "rations") {
  stopTimers();
  const titles = {
    rations: ["Mes rations", "Ajoutez ou corrigez les recettes utilisées au quotidien."],
    status: ["État du système", "Un aperçu simple des éléments importants."],
    stats: ["Stats globales", "Suivi des quantités préparées."],
  };
  const [title, subtitle] = titles[tab] || titles.rations;

  app.innerHTML = `
    <main class="admin-shell">
      ${pageTop(title, subtitle)}
      <nav class="admin-tabs" aria-label="Sections d'administration">
        ${adminTab("Rations", "admin-rations", tab === "rations", "🥣")}
        ${adminTab("Système", "admin-status", tab === "status", "🩺")}
        ${adminTab("Stats", "admin-stats", tab === "stats", "📊")}
      </nav>
      <section id="admin-content" class="admin-content"></section>
    </main>
  `;
  bindActions();
  if (tab === "rations") renderAdminRations();
  if (tab === "status") renderAdminStatus();
  if (tab === "stats") renderAdminStats();
}

function adminTab(label, action, active, icon) {
  return `
    <button class="tab-button ${active ? "active" : ""}" type="button" data-action="${action}">
      <span aria-hidden="true">${icon}</span>${escapeHtml(label)}
    </button>
  `;
}

function ingredientInputs(recipe = null) {
  const values = ingredientNames.map((name) => {
    const found = recipe?.ingredients?.find((ingredient) => ingredient.name === name);
    return { name, percentage: Number(found?.percentage || 0) };
  });
  return values.map((ingredient) => `
    <label class="ingredient-input">
      <span>${escapeHtml(displayIngredientName(ingredient.name))}</span>
      <input data-ingredient="${escapeHtml(ingredient.name)}" type="number" min="0" max="100" step="1" value="${ingredient.percentage}" inputmode="numeric">
      <small>%</small>
    </label>
  `).join("");
}

async function renderAdminRations() {
  await loadRecipes();
  const editing = appState.editingRecipeName
    ? appState.recipes.find((recipe) => recipe.name === appState.editingRecipeName)
    : null;
  const content = app.querySelector("#admin-content");
  content.innerHTML = `
    <section class="admin-grid">
      <form class="admin-card ration-form" id="recipe-form">
        <div class="card-heading">
          <span aria-hidden="true">${editing ? "✏️" : "➕"}</span>
          <div>
            <h2>${editing ? "Modifier une ration" : "Nouvelle ration"}</h2>
            <p>Le total des ingrédients doit faire 100%.</p>
          </div>
        </div>
        <label class="field">
          <span>Nom de la ration</span>
          <input id="recipe-name" autocomplete="off" required value="${escapeHtml(editing?.name || "")}" placeholder="Ex. Ration matin">
        </label>
        <div class="ingredient-list">${ingredientInputs(editing)}</div>
        <div class="form-total" id="recipe-total">Total: 0%</div>
        <div class="button-row">
          <button class="button primary" type="submit">${editing ? "Enregistrer" : "Ajouter"}</button>
          ${editing ? `<button class="button secondary" type="button" id="cancel-edit">Annuler</button>` : ""}
        </div>
      </form>
      <section class="admin-card ration-list">
        <div class="card-heading">
          <span aria-hidden="true">🥣</span>
          <div>
            <h2>Rations disponibles</h2>
            <p>${appState.recipes.length} ration${appState.recipes.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        ${appState.recipes.length ? appState.recipes.map((recipe, index) => `
          <article class="ration-row">
            <div class="row-icon">${recipeIcon(recipe, index)}</div>
            <div>
              <strong>${escapeHtml(recipe.name)}</strong>
              <span>${escapeHtml(ingredientsText(recipe))}</span>
            </div>
            <div class="row-actions">
              <button class="small-button" type="button" data-edit-recipe="${escapeHtml(recipe.name)}">✏️ Modifier</button>
              <button class="small-button danger" type="button" data-delete-recipe="${encodeURIComponent(recipe.name)}">🗑️ Supprimer</button>
            </div>
          </article>
        `).join("") : `<div class="empty-state"><strong>Aucune ration.</strong><span>Créez-en une avec le formulaire.</span></div>`}
      </section>
    </section>
  `;

  function updateTotal() {
    const total = [...content.querySelectorAll("[data-ingredient]")]
      .reduce((sum, input) => sum + Number(input.value || 0), 0);
    const totalEl = content.querySelector("#recipe-total");
    totalEl.textContent = `Total: ${total}%`;
    totalEl.className = `form-total ${total === 100 ? "ok" : "bad"}`;
  }

  content.querySelectorAll("[data-ingredient]").forEach((input) => input.addEventListener("input", updateTotal));
  updateTotal();

  content.querySelector("#recipe-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const recipe = {
      name: content.querySelector("#recipe-name").value.trim(),
      ingredients: [...content.querySelectorAll("[data-ingredient]")]
        .map((input) => ({ name: input.dataset.ingredient, percentage: Number(input.value || 0) }))
        .filter((ingredient) => ingredient.percentage > 0),
    };
    const method = editing ? "PUT" : "POST";
    const path = editing ? `/api/recipes/${encodeURIComponent(appState.editingRecipeName)}` : "/api/recipes";
    try {
      await request(path, { method, body: JSON.stringify(recipe) });
      appState.editingRecipeName = null;
      showToast(editing ? "Ration modifiée." : "Ration ajoutée.", "success");
      renderAdmin("rations");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  content.querySelector("#cancel-edit")?.addEventListener("click", () => {
    appState.editingRecipeName = null;
    renderAdmin("rations");
  });
  content.querySelectorAll("[data-edit-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.editingRecipeName = button.dataset.editRecipe;
      renderAdmin("rations");
    });
  });
  content.querySelectorAll("[data-delete-recipe]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Supprimer cette ration ?")) return;
      try {
        await request(`/api/recipes/${button.dataset.deleteRecipe}`, { method: "DELETE" });
        showToast("Ration supprimée.", "success");
        renderAdmin("rations");
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });
}

async function renderAdminStatus() {
  const payload = await request("/api/status");
  const status = payload.state;
  app.querySelector("#admin-content").innerHTML = `
    <section class="status-grid">
      ${statusCard("Balance", status.hardware.rpiConnected ? "Connectée" : "À vérifier", status.hardware.rpiConnected ? "ok" : "bad", "⚖️", status.hardware.rpiConnected ? "Le poids peut être lu." : "Le poids affiché peut dater.")}
      ${statusCard("Boîtier moteurs", payload.config.shellySimulation ? "Simulation" : status.hardware.shellyConnected ? "Connecté" : "À vérifier", payload.config.shellySimulation ? "warn" : status.hardware.shellyConnected ? "ok" : "bad", "⚡", payload.config.shellySimulation ? "Mode test actif." : "Commande Shelly.")}
      ${statusCard("Préparation", status.mix.inProgress ? "En cours" : "Prêt", status.mix.inProgress ? "ok" : "warn", "🥣", status.mix.inProgress ? status.mix.recipeID : "Aucune ration lancée.")}
      ${statusCard("Poids affiché", `${Number(status.lastWeight.value || 0).toFixed(1)} kg`, "neutral", "📟", "Dernière valeur reçue.")}
    </section>
  `;
}

function statusCard(title, value, tone, icon, note) {
  return `
    <article class="status-card ${tone}">
      <span class="status-icon" aria-hidden="true">${icon}</span>
      <div>
        <h2>${escapeHtml(title)}</h2>
        <strong>${escapeHtml(value)}</strong>
        <p>${escapeHtml(note)}</p>
      </div>
    </article>
  `;
}

async function renderAdminStats() {
  const payload = await request("/api/logs");
  const logs = payload.resource_usage || {};
  const totals = Object.entries(logs.total_usage || {});
  const sessions = logs.sessions || [];
  const totalKg = totals.reduce((sum, [, data]) => sum + Number(data.total_kg || 0), 0);
  const activeMonths = Object.keys(logs.monthly_usage || {}).length;
  const completedSessions = sessions.filter((session) => session.completed).length;

  app.querySelector("#admin-content").innerHTML = `
    <section class="stats-grid">
      ${statCard("Total préparé", `${totalKg.toFixed(1)} kg`, "📦")}
      ${statCard("Rations lancées", `${sessions.length}`, "🥣")}
      ${statCard("Rations terminées", `${completedSessions}`, "✅")}
      ${statCard("Mois suivis", `${activeMonths}`, "📅")}
    </section>
    <section class="admin-card chart-card">
      <div class="card-heading">
        <span aria-hidden="true">📊</span>
        <div>
          <h2>Consommation par ingrédient</h2>
          <p>Vue globale des quantités utilisées.</p>
        </div>
      </div>
      ${totals.length ? totals.map(([name, data]) => {
        const kg = Number(data.total_kg || 0);
        const width = totalKg > 0 ? Math.max(6, (kg / totalKg) * 100) : 0;
        return `
          <div class="usage-row">
            <div>
              <strong>${escapeHtml(displayIngredientName(name))}</strong>
              <span>${kg.toFixed(1)} kg · ${Number(data.total_sessions || 0)} utilisation${Number(data.total_sessions || 0) > 1 ? "s" : ""}</span>
            </div>
            <div class="usage-bar"><div style="width:${width}%"></div></div>
          </div>
        `;
      }).join("") : `<div class="empty-state"><strong>Pas encore de stats.</strong><span>Les données apparaîtront après les premières rations.</span></div>`}
    </section>
    ${renderRecentSessions(sessions)}
  `;
}

function statCard(label, value, icon) {
  return `
    <article class="stat-card">
      <span aria-hidden="true">${icon}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(label)}</p>
    </article>
  `;
}

function renderRecentSessions(sessions) {
  const recent = sessions.slice(-6).reverse();
  return `
    <section class="admin-card">
      <div class="card-heading">
        <span aria-hidden="true">🕓</span>
        <div>
          <h2>Dernières préparations</h2>
          <p>Les rations les plus récentes.</p>
        </div>
      </div>
      ${recent.length ? recent.map((session) => `
        <article class="session-row">
          <div>
            <strong>${escapeHtml(session.recipeName || "Ration")}</strong>
            <span>${formatDate(session.endedAt)} · ${session.completed ? "Terminée" : "Arrêtée"}</span>
          </div>
          <strong>${Number(session.finalWeight || 0).toFixed(1)} kg</strong>
        </article>
      `).join("") : `<div class="empty-state"><strong>Aucune préparation enregistrée.</strong><span>L'historique se remplira automatiquement.</span></div>`}
    </section>
  `;
}

function formatDate(value) {
  if (!value) return "Date inconnue";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function checkRunningMix() {
  const mix = await request("/api/mix/status");
  if (mix.inProgress && mix.recipe) {
    appState.selectedRecipe = mix.recipe;
    appState.selectedWeight = Number(mix.totalWeight || 0);
    renderMix();
  }
}

window.addEventListener("beforeunload", stopTimers);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

(async function init() {
  try {
    await loadRecipes();
    renderHome();
    await checkRunningMix();
  } catch (error) {
    app.innerHTML = `
      <main class="screen home-screen">
        <section class="offline-card">
          <div class="confirm-icon" aria-hidden="true">⚠️</div>
          <h1>Serveur indisponible</h1>
          <p>Impossible d'afficher FarineAPP pour le moment.</p>
          <button class="button primary" type="button" onclick="location.reload()">🔄 Réessayer</button>
        </section>
      </main>
    `;
    showToast(error.message, "error");
  }
})();
