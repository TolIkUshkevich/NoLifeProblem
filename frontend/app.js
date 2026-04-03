const STORAGE_KEY = "roommate_profile";

const BATCH_SIZE = 5;
let matchBatchStart = 0;
/** @type {Array<Record<string, unknown>>} */
let lastRankedMatches = [];

const entryPanel = document.getElementById("entry-panel");
const resultsSection = document.getElementById("results-section");
const cardsGrid = document.getElementById("cards-grid");
const continueBtn = document.getElementById("continue-btn");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modal-close");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");

function createField({ id, name, type, placeholder = "", required = true, min, max, step }) {
  const input = document.createElement("input");
  input.id = id;
  input.name = name;
  input.type = type;
  input.placeholder = placeholder;
  input.className = "ide-input";
  input.required = required;
  if (typeof min !== "undefined") {
    input.min = String(min);
  }
  if (typeof max !== "undefined") {
    input.max = String(max);
  }
  if (typeof step !== "undefined") {
    input.step = String(step);
  }
  return input;
}

function createFieldBlock({ labelText, inputEl }) {
  const block = document.createElement("label");
  block.className = "ide-field";
  block.setAttribute("for", inputEl.id);

  const label = document.createElement("span");
  label.className = "ide-label";
  label.textContent = labelText;

  const shell = document.createElement("div");
  shell.className = "ide-shell";
  shell.appendChild(inputEl);

  block.append(label, shell);
  return block;
}

function getSavedProfile() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function clearResults() {
  cardsGrid.innerHTML = "";
  lastRankedMatches = [];
  matchBatchStart = 0;
  resultsSection.classList.add("hidden");
  resultsSection.classList.remove("results-visible");
  entryPanel.classList.remove("entry-panel--faded");
}

function formatInterests(match) {
  const list = match.interests;
  if (!Array.isArray(list)) {
    return String(list ?? "");
  }
  return list.join(", ");
}

const BUDGET_MIN = 1;
const BUDGET_MAX = 9_999_999;

function formatBudgetDisplay(value) {
  const n = typeof value === "number" ? value : Number(String(value).replace(/\s/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return String(value ?? "");
  }
  return `${new Intl.NumberFormat("ru-RU").format(n)}\u00A0₽`;
}

function coerceBudgetToNumber(raw) {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= BUDGET_MIN) {
    return raw;
  }
  if (typeof raw === "string") {
    const digits = raw.replace(/\D/g, "");
    if (digits) {
      const v = parseInt(digits, 10);
      if (v >= BUDGET_MIN && v <= BUDGET_MAX) {
        return v;
      }
    }
  }
  return null;
}

async function fetchMatchesFromServer() {
  const saved = getSavedProfile();
  if (!saved) {
    throw new Error("Нет сохранённого профиля.");
  }

  const hasId = Boolean(saved.profileId);
  const url = hasId ? "/api/matches" : "/api/search";
  const body = hasId
    ? { profile_id: saved.profileId }
    : {
        name: saved.name,
        age: saved.age,
        region: saved.region,
        budget: saved.budget,
        bio: saved.bio,
        neighbor_requirements: saved.neighbor_requirements,
      };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Ошибка сервера");
  }

  if (!hasId && data.profile?.id) {
    saveProfile({
      ...saved,
      profileId: data.profile.id,
    });
  }

  const matches = data.matches;
  if (!Array.isArray(matches)) {
    throw new Error("Некорректный ответ сервера");
  }
  return matches;
}

const MODAL_TRANSITION_MS = 360;

function openModal(match) {
  const pct =
    typeof match.compatibility_percent === "number"
      ? match.compatibility_percent
      : Number(match.compatibility_percent ?? 0);
  modalTitle.textContent = `${match.name}, ${match.age}`;
  modalBody.textContent = `Совместимость: ${pct}%. Регион: ${match.region}. Бюджет: ${formatBudgetDisplay(match.budget)}. ${match.bio} Интересы: ${formatInterests(match)}.`;
  modal.classList.remove("hidden");
  modal.classList.remove("modal--open");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.classList.add("modal--open");
    });
  });
}

function closeModal() {
  modal.classList.remove("modal--open");
  window.setTimeout(() => {
    modal.classList.add("hidden");
  }, MODAL_TRANSITION_MS);
}

function getNextBatch({ advance, reset } = {}) {
  const pool = lastRankedMatches;
  const n = pool.length;
  if (n === 0) {
    return [];
  }
  if (reset) {
    matchBatchStart = 0;
  } else if (advance) {
    matchBatchStart = (matchBatchStart + BATCH_SIZE) % n;
  }
  const batch = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    batch.push(pool[(matchBatchStart + i) % n]);
  }
  return batch;
}

function renderMatches(options = {}) {
  const { advance = false, reset = false } = options;
  const batch = getNextBatch({ advance, reset });

  cardsGrid.innerHTML = "";
  entryPanel.classList.add("entry-panel--faded");

  batch.forEach((match) => {
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = `${match.name}, ${match.age}`;

    const region = document.createElement("p");
    region.innerHTML = `<strong>Регион:</strong> ${match.region}`;

    const budget = document.createElement("p");
    budget.innerHTML = `<strong>Бюджет:</strong> ${formatBudgetDisplay(match.budget)}`;

    const compat = document.createElement("p");
    const pct =
      typeof match.compatibility_percent === "number"
        ? match.compatibility_percent
        : Number(match.compatibility_percent ?? 0);
    compat.innerHTML = `<strong>Совместимость:</strong> ${pct}%`;

    const interests = document.createElement("p");
    interests.innerHTML = `<strong>Интересы:</strong> ${formatInterests(match)}`;

    const bio = document.createElement("p");
    bio.textContent = match.bio;

    card.append(title, region, budget, compat, interests, bio);

    card.addEventListener("click", () => openModal(match));
    cardsGrid.appendChild(card);
  });

  resultsSection.classList.remove("hidden");
  requestAnimationFrame(() => {
    resultsSection.classList.add("results-visible");
  });
}

function renderQuickActions() {
  entryPanel.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "quick-actions";

  const searchBtn = document.createElement("button");
  searchBtn.id = "search-btn";
  searchBtn.type = "button";
  searchBtn.className = "primary-btn";
  searchBtn.textContent = "Поиск";

  const refreshBtn = document.createElement("button");
  refreshBtn.id = "refresh-btn";
  refreshBtn.type = "button";
  refreshBtn.className = "secondary-btn";
  refreshBtn.textContent = "Обновить информацию о себе";

  wrapper.append(searchBtn, refreshBtn);
  entryPanel.appendChild(wrapper);

  searchBtn.addEventListener("click", async () => {
    searchBtn.disabled = true;
    try {
      lastRankedMatches = await fetchMatchesFromServer();
      matchBatchStart = 0;
      renderMatches({ reset: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      searchBtn.disabled = false;
    }
  });
  refreshBtn.addEventListener("click", () => {
    clearResults();
    renderForm();
  });
}

function extractProfileFromBio(rawBio, fallbackName, fallbackAge) {
  const bio = String(rawBio || "").trim();

  const extractedNameMatch = bio.match(/(?:меня зовут|я)\s+([А-ЯЁA-Z][а-яёa-zA-Z-]{1,20})/i);
  const extractedAgeMatch = bio.match(/(\d{2})\s*(?:лет|года|год)?/i);

  return {
    extractedName: extractedNameMatch ? extractedNameMatch[1] : String(fallbackName || "").trim(),
    extractedAge: extractedAgeMatch ? Number(extractedAgeMatch[1]) : Number(fallbackAge),
  };
}

function setupAutoGrowTextarea(textarea) {
  const resize = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener("input", resize);
  resize();
}

function renderForm() {
  entryPanel.innerHTML = "";

  const form = document.createElement("form");
  form.id = "profile-form";
  form.className = "profile-form";

  const nameInput = createField({
    id: "name",
    name: "name",
    type: "text",
  });
  const ageInput = createField({
    id: "age",
    name: "age",
    type: "text",
  });
  ageInput.inputMode = "numeric";
  const regionInput = createField({
    id: "region",
    name: "region",
    type: "text",
  });
  const budgetInput = createField({
    id: "budget",
    name: "budget",
    type: "number",
    min: BUDGET_MIN,
    max: BUDGET_MAX,
    step: 1,
  });
  budgetInput.inputMode = "numeric";
  budgetInput.autocomplete = "off";
  budgetInput.addEventListener("keydown", (e) => {
    if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
      e.preventDefault();
    }
  });
  const bioInput = document.createElement("textarea");
  bioInput.id = "bio";
  bioInput.name = "bio";
  bioInput.className = "ide-input ide-textarea";
  bioInput.required = true;

  const neighborRequirementsInput = document.createElement("textarea");
  neighborRequirementsInput.id = "neighbor_requirements";
  neighborRequirementsInput.name = "neighbor_requirements";
  neighborRequirementsInput.className = "ide-input ide-textarea";
  neighborRequirementsInput.required = true;

  const saved = getSavedProfile();
  if (saved) {
    nameInput.value = String(saved.name ?? "");
    ageInput.value = saved.age != null ? String(saved.age) : "";
    regionInput.value = String(saved.region ?? "");
    const savedBudget = coerceBudgetToNumber(saved.budget);
    budgetInput.value = savedBudget != null ? String(savedBudget) : "";
    bioInput.value = String(saved.bio ?? "");
    neighborRequirementsInput.value = String(saved.neighbor_requirements ?? "");
  }

  setupAutoGrowTextarea(bioInput);
  setupAutoGrowTextarea(neighborRequirementsInput);

  const stack = document.createElement("div");
  stack.className = "form-stack";
  stack.append(
    createFieldBlock({ labelText: "Имя", inputEl: nameInput }),
    createFieldBlock({ labelText: "Возраст", inputEl: ageInput }),
    createFieldBlock({ labelText: "Регион", inputEl: regionInput }),
    createFieldBlock({ labelText: "Бюджет на квартиру", inputEl: budgetInput }),
  );

  const bioBlock = createFieldBlock({ labelText: "Общая информация о себе", inputEl: bioInput });
  bioBlock.classList.add("bio-block");

  const requirementsBlock = createFieldBlock({
    labelText: "Требования к соседу",
    inputEl: neighborRequirementsInput,
  });
  requirementsBlock.classList.add("bio-block");

  const submitBtn = document.createElement("button");
  submitBtn.className = "submit-btn submit-btn--full";
  submitBtn.type = "submit";
  submitBtn.textContent = "Отправить";

  form.append(stack, bioBlock, requirementsBlock, submitBtn);
  entryPanel.appendChild(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const rawName = String(data.get("name") || "").trim();
    const ageRawValue = String(data.get("age") || "").trim();
    const rawAge = Number(ageRawValue);
    const rawRegion = String(data.get("region") || "").trim();
    const budgetField = data.get("budget");
    const budgetStr = String(budgetField ?? "")
      .trim()
      .replace(/\s/g, "");
    const rawBio = String(data.get("bio") || "").trim();
    const rawNeighborRequirements = String(data.get("neighbor_requirements") || "").trim();

    if (
      !rawName ||
      !rawRegion ||
      !budgetStr ||
      !rawBio ||
      !rawNeighborRequirements ||
      !/^\d+$/.test(ageRawValue) ||
      Number.isNaN(rawAge) ||
      !Number.isInteger(rawAge)
    ) {
      alert("Заполни все поля корректно.");
      return;
    }

    if (!/^\d+$/.test(budgetStr)) {
      alert("Бюджет введи только цифрами — сумма в рублях без текста.");
      return;
    }
    const budgetNum = parseInt(budgetStr, 10);
    if (budgetNum < BUDGET_MIN || budgetNum > BUDGET_MAX) {
      alert(`Бюджет: целое число от ${BUDGET_MIN.toLocaleString("ru-RU")} до ${BUDGET_MAX.toLocaleString("ru-RU")} ₽.`);
      return;
    }

    const { extractedName, extractedAge } = extractProfileFromBio(rawBio, rawName, rawAge);

    const profile = {
      name: extractedName || rawName,
      age: extractedAge || rawAge,
      region: rawRegion,
      budget: budgetNum,
      bio: rawBio,
      neighbor_requirements: rawNeighborRequirements,
    };

    submitBtn.disabled = true;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          age: profile.age,
          region: profile.region,
          budget: profile.budget,
          bio: profile.bio,
          neighbor_requirements: profile.neighbor_requirements,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || res.statusText || "Ошибка сервера");
      }
      saveProfile({
        ...profile,
        profileId: payload.profile.id,
      });
      lastRankedMatches = payload.matches || [];
      matchBatchStart = 0;
      renderQuickActions();
      renderMatches({ reset: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function renderEntryPanel() {
  const hasProfile = Boolean(getSavedProfile());
  if (hasProfile) {
    renderQuickActions();
    return;
  }
  renderForm();
}

continueBtn.addEventListener("click", (event) => {
  event.preventDefault();
  renderMatches({ advance: true });
});
modalClose.addEventListener("click", (event) => {
  event.preventDefault();
  closeModal();
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("modal--open")) {
    closeModal();
  }
});

renderEntryPanel();
