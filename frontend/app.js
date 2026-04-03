const STORAGE_KEY = "roommate_profile";

const ALL_MATCHES = [
  {
    name: "Мария",
    age: 24,
    region: "Москва",
    budget: "до 35 000 ₽",
    interests: ["йога", "кино", "путешествия"],
    bio: "Люблю порядок, ранние подъемы и уютные вечера дома.",
  },
  {
    name: "Иван",
    age: 27,
    region: "Санкт-Петербург",
    budget: "до 28 000 ₽",
    interests: ["бег", "настолки", "кофе"],
    bio: "Работаю в IT, ценю тишину по ночам и дружелюбную атмосферу.",
  },
  {
    name: "Алина",
    age: 22,
    region: "Казань",
    budget: "до 22 000 ₽",
    interests: ["дизайн", "музыка", "фото"],
    bio: "Творческий человек, люблю общаться и поддерживать чистоту.",
  },
  {
    name: "Максим",
    age: 29,
    region: "Екатеринбург",
    budget: "до 30 000 ₽",
    interests: ["спортзал", "сериалы", "готовка"],
    bio: "Спокойный ритм жизни, уважаю личные границы и договоренности.",
  },
  {
    name: "Екатерина",
    age: 26,
    region: "Новосибирск",
    budget: "до 25 000 ₽",
    interests: ["книги", "пилатес", "английский"],
    bio: "Ищу ответственного соседа, с которым легко договориться по быту.",
  },
  {
    name: "Дмитрий",
    age: 28,
    region: "Москва",
    budget: "до 40 000 ₽",
    interests: ["сноуборд", "джаз", "код"],
    bio: "Ценю честность, тихие выходные и порядок на кухне.",
  },
  {
    name: "Ольга",
    age: 25,
    region: "Санкт-Петербург",
    budget: "до 26 000 ₽",
    interests: ["рисование", "кино", "пешие прогулки"],
    bio: "Ищу спокойного соседа без вечеринок по будням.",
  },
  {
    name: "Павел",
    age: 31,
    region: "Нижний Новгород",
    budget: "до 24 000 ₽",
    interests: ["рыбалка", "настолки", "чай"],
    bio: "Ранний подъем, тихие вечера, уважение к личному пространству.",
  },
  {
    name: "Светлана",
    age: 23,
    region: "Краснодар",
    budget: "до 21 000 ₽",
    interests: ["плавание", "подкасты", "йога"],
    bio: "Люблю чистоту в общих зонах и договоренности по уборке.",
  },
  {
    name: "Артём",
    age: 26,
    region: "Москва",
    budget: "до 33 000 ₽",
    interests: ["велосипед", "кино", "пицца"],
    bio: "Работаю удалённо, важна тишина днём и нормальный интернет.",
  },
  {
    name: "Наталья",
    age: 30,
    region: "Санкт-Петербург",
    budget: "до 29 000 ₽",
    interests: ["театр", "вино", "книги"],
    bio: "Ищу взрослого соседа без драм и с ясными правилами по дому.",
  },
  {
    name: "Кирилл",
    age: 24,
    region: "Казань",
    budget: "до 23 000 ₽",
    interests: ["скейт", "музыка", "готовка"],
    bio: "Открыт к общению, но ночью тишина — святое.",
  },
  {
    name: "Виктория",
    age: 27,
    region: "Ростов-на-Дону",
    budget: "до 27 000 ₽",
    interests: ["пилатес", "сериалы", "растения"],
    bio: "Много времени дома, люблю уют и аккуратность в прихожей.",
  },
  {
    name: "Сергей",
    age: 33,
    region: "Воронеж",
    budget: "до 20 000 ₽",
    interests: ["шахматы", "пивоварение", "футбол"],
    bio: "Спокойный, пунктуальный, уважаю чужой график сна.",
  },
  {
    name: "Полина",
    age: 21,
    region: "Самара",
    budget: "до 19 000 ₽",
    interests: ["учёба", "кофе", "походы"],
    bio: "Студентка, ищу тихую квартиру и адекватных соседей.",
  },
];

const BATCH_SIZE = 5;
let matchBatchStart = 0;

const entryPanel = document.getElementById("entry-panel");
const resultsSection = document.getElementById("results-section");
const cardsGrid = document.getElementById("cards-grid");
const continueBtn = document.getElementById("continue-btn");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modal-close");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");

function createField({ id, name, type, placeholder, required = true, min, max }) {
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
  resultsSection.classList.add("hidden");
  resultsSection.classList.remove("results-visible");
  entryPanel.classList.remove("entry-panel--faded");
}

const MODAL_TRANSITION_MS = 360;

function openModal(match) {
  modalTitle.textContent = `${match.name}, ${match.age}`;
  modalBody.textContent = `Регион: ${match.region}. Бюджет: ${match.budget}. ${match.bio} Интересы: ${match.interests.join(", ")}.`;
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
  const pool = ALL_MATCHES;
  const n = pool.length;
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
    budget.innerHTML = `<strong>Бюджет:</strong> ${match.budget}`;

    const interests = document.createElement("p");
    interests.innerHTML = `<strong>Интересы:</strong> ${match.interests.join(", ")}`;

    const bio = document.createElement("p");
    bio.textContent = match.bio;

    card.append(title, region, budget, interests, bio);

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

  searchBtn.addEventListener("click", () => renderMatches({ reset: true }));
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
    placeholder: "Имя",
  });
  const ageInput = createField({
    id: "age",
    name: "age",
    type: "text",
    placeholder: "Возраст",
  });
  ageInput.inputMode = "numeric";
  ageInput.pattern = "\\d{2}";
  const regionInput = createField({
    id: "region",
    name: "region",
    type: "text",
    placeholder: "Регион",
  });
  const budgetInput = createField({
    id: "budget",
    name: "budget",
    type: "text",
    placeholder: "Напр. до 30 000 ₽",
  });
  const bioInput = document.createElement("textarea");
  bioInput.id = "bio";
  bioInput.name = "bio";
  bioInput.className = "ide-input ide-textarea";
  bioInput.placeholder = "Расскажи о себе";
  bioInput.required = true;

  const saved = getSavedProfile();
  if (saved) {
    nameInput.value = String(saved.name ?? "");
    ageInput.value = saved.age != null ? String(saved.age) : "";
    regionInput.value = String(saved.region ?? "");
    budgetInput.value = String(saved.budget ?? "");
    bioInput.value = String(saved.bio ?? "");
  }

  setupAutoGrowTextarea(bioInput);

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

  const submitBtn = document.createElement("button");
  submitBtn.className = "submit-btn submit-btn--full";
  submitBtn.type = "submit";
  submitBtn.textContent = "Отправить";

  form.append(stack, bioBlock, submitBtn);
  entryPanel.appendChild(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const rawName = String(data.get("name") || "").trim();
    const ageRawValue = String(data.get("age") || "").trim();
    const rawAge = Number(ageRawValue);
    const rawRegion = String(data.get("region") || "").trim();
    const rawBudget = String(data.get("budget") || "").trim();
    const rawBio = String(data.get("bio") || "").trim();

    if (!rawName || !rawRegion || !rawBudget || !rawBio || !/^\d{2}$/.test(ageRawValue) || Number.isNaN(rawAge)) {
      alert("Заполни все поля корректно.");
      return;
    }

    if (rawAge < 18 || rawAge > 99) {
      alert("Возраст должен быть от 18 до 99.");
      return;
    }

    const { extractedName, extractedAge } = extractProfileFromBio(rawBio, rawName, rawAge);

    const profile = {
      name: extractedName || rawName,
      age: extractedAge || rawAge,
      region: rawRegion,
      budget: rawBudget,
      bio: rawBio,
    };

    saveProfile(profile);
    renderQuickActions();
    renderMatches({ reset: true });
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
