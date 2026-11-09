const freestyleKey = "tasbeh";
const dailyKey = "tasbeh.daily";
const preferencesKey = "tasbeh.prefs";
const sessionWelcomeKey = "tasbeh.sessionWelcome";
const limits = [11, 33, 99, 1000];
const dailySize = 5;
const languages = ["uz", "ru", "en"];
const wishes = translations.uz.wishes;

const zikrSelect = document.getElementById("zikrSelect");
const limitSelect = document.getElementById("limitSelect");
const zikrText = document.getElementById("zikrText");
const counter = document.getElementById("counter");
const count = document.getElementById("count");
const counterLimit = document.getElementById("counterLimit");
const cycles = document.getElementById("cycles");
const reset = document.getElementById("reset");
const freestyleMode = document.getElementById("freestyleMode");
const dailyMode = document.getElementById("dailyMode");
const freestyleControls = document.getElementById("freestyleControls");
const optionsMenu = document.getElementById("optionsMenu");
const optionsToggle = document.getElementById("optionsToggle");
const resetCycles = document.getElementById("resetCycles");
const themeToggle = document.getElementById("themeToggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const languageButtons = document.querySelectorAll("[data-language]");
const languageSwitch = document.querySelector(".language-switch");
const guideDemo = document.getElementById("guideDemo");
const guideDemoCount = document.getElementById("guideDemoCount");
const guideDemoHint = guideDemo.querySelector("[data-i18n]");
const greeting = document.getElementById("greeting");
const sessionWelcome = document.getElementById("sessionWelcome");
const openDaily = document.getElementById("openDaily");
const dailyPreview = document.getElementById("dailyPreview");
const dailyMenu = document.getElementById("dailyMenu");
const dailyToday = document.getElementById("dailyToday");
const dailyTotal = document.getElementById("dailyTotal");
const dailyList = document.getElementById("dailyList");
const freestyleSound = document.getElementById("freestyleSound");
const dailySound = document.getElementById("dailySound");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

freestyleOrder.forEach(index => {
  zikrSelect.add(new Option(zikrList[index].text, index));
});

let freestyle = loadFreestyle();
let { mode, daily, draws } = loadDaily();
let preferences = loadPreferences();
let renderedDaily;
let menuRows = [];
let textAnimation;
let countAnimation;
let demoAnimation;
let demoTaps = 0;
let greetingTimer;
let visibleWish;
let sessionWelcomeHandled = false;
let themeTransitionTimer;

function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Tasbeh progress could not be saved", error);
  }
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function loadFreestyle() {
  const saved = readSaved(freestyleKey);
  return {
    count: nonnegativeInteger(saved?.count) ? saved.count : 0,
    limit: limits.includes(saved?.limit) ? saved.limit : 33,
    cycles: nonnegativeInteger(saved?.cycles) ? saved.cycles : 0,
    index: nonnegativeInteger(saved?.index) && saved.index < zikrList.length ? saved.index : 0,
  };
}

function loadDaily() {
  const saved = readSaved(dailyKey);
  const mode = saved?.mode === "daily" ? "daily" : "freestyle";
  const draws = Array.isArray(saved?.draws) ? saved.draws : [];
  const session = saved?.daily;
  const valid = typeof session?.date === "string"
    && nonnegativeInteger(session.previousTotal)
    && Array.isArray(session.items)
    && session.items.length === dailySize
    && session.items.every(item => item && nonnegativeInteger(item.index)
      && item.index < zikrList.length && Number.isSafeInteger(item.limit)
      && item.limit > 0 && nonnegativeInteger(item.count) && item.count <= item.limit);
  if (!valid) return { mode, daily: null, draws };

  // Update today's limits while preserving partial counts and completed items.
  if (session.date === localDate()) {
    let changed = false;
    for (const item of session.items) {
      const limit = dailyLimit(item.index);
      if (item.limit === limit) continue;
      item.count = item.count === item.limit ? limit : Math.min(item.count, limit);
      item.limit = limit;
      changed = true;
    }
    if (changed) save(dailyKey, { mode, daily: session, draws });
  }
  return { mode, daily: session, draws };
}

function saveDaily() {
  save(dailyKey, { mode, daily, draws });
}

function loadPreferences() {
  const saved = readSaved(preferencesKey);
  return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

function currentLanguage() {
  return languages.includes(preferences.language) ? preferences.language : "en";
}

function messages() {
  return translations[currentLanguage()];
}

function applyLanguage() {
  const language = currentLanguage();
  const text = messages();
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const value = text[element.dataset.i18n];
    if (element.hasAttribute("data-menu-example")) {
      const [before, after] = value.split("⋯");
      const icon = document.createElement("span");
      icon.className = "menu-example";
      icon.setAttribute("aria-hidden", "true");
      element.replaceChildren(before, icon, after);
    } else {
      element.textContent = value;
    }
  });
  document.querySelectorAll("[data-i18n-label]").forEach(element => {
    const label = text[element.dataset.i18nLabel];
    element.setAttribute("aria-label", label);
    if (element.hasAttribute("title")) element.title = label;
  });
  languageSwitch.style.setProperty("--language-index", languages.indexOf(language));
  languageButtons.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
  if (demoTaps === 5) guideDemoHint.textContent = text.demoComplete;
  if (!greeting.hidden) renderGreeting();
}

function applyTheme() {
  const dark = preferences.theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeColor.content = dark ? "#15231a" : "#4CAF50";
  const text = messages();
  const action = dark ? text.switchLight : text.switchDark;
  themeToggle.setAttribute("aria-label", action);
  themeToggle.title = action;
}

function localDate() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
}

function completedItems(session) {
  return session.items.filter(item => item.count === item.limit).length;
}

function dailyLimit(index) {
  const zikr = zikrList[index];
  return Array.from(zikr.full || zikr.text).length <= 50 ? 100 : 33;
}

function maskFor(pool, values) {
  let used = 0n;
  pool.forEach((value, index) => {
    if (values.includes(value)) used |= 1n << BigInt(index);
  });
  return used.toString(16);
}

// One bit per pool entry is enough to remember the current cycle.
function drawFromCycle(pool, mask, excluded = []) {
  const full = (1n << BigInt(pool.length)) - 1n;
  let used = typeof mask === "string" && mask.length <= Math.ceil(pool.length / 4) && /^[0-9a-f]+$/i.test(mask)
    ? BigInt(`0x${mask}`) & full : 0n;
  if (used === full) used = 0n;

  const available = [];
  const preferred = [];
  pool.forEach((value, index) => {
    if (used & (1n << BigInt(index))) return;
    available.push(index);
    if (!excluded.includes(value)) preferred.push(index);
  });
  const candidates = preferred.length ? preferred : available;
  const index = candidates[Math.floor(Math.random() * candidates.length)];
  return { value: pool[index], mask: (used | (1n << BigInt(index))).toString(16) };
}

function ensureDaily() {
  const date = localDate();
  if (daily?.date === date) return false;

  const previousTotal = daily ? daily.previousTotal + completedItems(daily) : 0;
  const previous = daily?.items.map(item => item.index) ?? [];
  const name = drawFromCycle(nameIndices, draws[0] ?? maskFor(nameIndices, previous), previous.slice(0, 1));
  const indices = [name.value];
  let phraseMask = draws[1] ?? maskFor(phraseIndices, previous);
  while (indices.length < dailySize) {
    const phrase = drawFromCycle(phraseIndices, phraseMask, indices);
    indices.push(phrase.value);
    phraseMask = phrase.mask;
  }
  draws = [name.mask, phraseMask];

  daily = {
    date,
    previousTotal,
    active: 0,
    items: indices.map(index => ({ index, limit: dailyLimit(index), count: 0 })),
  };
  return true;
}

function showGreeting() {
  if (document.hidden) return;
  const date = localDate();
  preferences = { ...preferences, ...loadPreferences() };
  if (preferences.welcomeDate === date) return;

  const wish = drawFromCycle(wishes, preferences.welcomeMask, [wishes[preferences.welcomeLast]]);
  preferences.welcomeDate = date;
  preferences.welcomeMask = wish.mask;
  preferences.welcomeLast = wishes.indexOf(wish.value);
  visibleWish = preferences.welcomeLast;
  save(preferencesKey, preferences);

  renderGreeting();
  greeting.hidden = false;
  window.clearTimeout(greetingTimer);
  greetingTimer = window.setTimeout(() => { greeting.hidden = true; }, 4200);
}

function showWelcome() {
  if (document.hidden || !sessionWelcome.hidden || document.documentElement.classList.contains("app-loading")) return;
  if (!sessionWelcomeHandled) {
    sessionWelcomeHandled = true;
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(sessionWelcomeKey) === "1";
      if (!alreadyShown) sessionStorage.setItem(sessionWelcomeKey, "1");
    } catch {
      // In this tab, the in-memory flag still covers background and foreground changes.
    }
    if (!alreadyShown) {
      sessionWelcome.hidden = false;
      window.setTimeout(() => {
        sessionWelcome.hidden = true;
        showGreeting();
      }, 2600);
      return;
    }
  }
  showGreeting();
}

function renderGreeting() {
  const text = messages();
  greeting.replaceChildren(text.hello, document.createElement("br"), text.wishes[visibleWish]);
}

function activeDailyIndex() {
  const active = daily.items[daily.active];
  if (active && active.count < active.limit) return daily.active;
  return daily.items.findIndex(item => item.count < item.limit);
}

function setZikrText(text) {
  if (zikrText.textContent === text) return;

  const previousText = zikrText.textContent;
  zikrText.textContent = text;
  zikrText.scrollTop = 0;
  textAnimation?.cancel();
  if (previousText && !reduceMotion.matches) {
    textAnimation = zikrText.animate([
      { opacity: 0, transform: "translateY(18px)" },
      { opacity: 1, transform: "translateY(0)" },
    ], { duration: 400, easing: "ease-out" });
  }
}

function animateNumber(element, animation) {
  animation?.cancel();
  if (reduceMotion.matches) return;
  return element.animate([
    { transform: "translateY(6px) scale(.92)", opacity: .75 },
    { transform: "translateY(-4px) scale(1.07)", opacity: 1, offset: .48 },
    { transform: "translateY(0) scale(1)", opacity: 1 },
  ], { duration: 230, easing: "ease-out" });
}

function renderDailyMenu(active, completed) {
  if (renderedDaily !== daily) {
    renderedDaily = daily;
    menuRows = daily.items.map((item, position) => {
      const text = zikrList[item.index].text;
      const row = document.createElement("li");
      row.className = "daily-item";

      const select = document.createElement("button");
      select.type = "button";
      select.append(text);
      const progress = document.createElement("span");
      select.append(progress);
      select.addEventListener("click", () => {
        if (refreshDaily()) return;
        daily.active = position;
        saveDaily();
        render();
        dailyMenu.close();
        counter.focus();
      });

      const label = document.createElement("label");
      label.className = "daily-check";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.addEventListener("change", () => {
        if (refreshDaily()) return;
        item.count = check.checked ? item.limit : 0;
        daily.active = check.checked ? activeDailyIndex() : position;
        saveDaily();
        render();
      });
      label.append(check);
      row.append(select, label);
      return { row, select, progress, check };
    });
    dailyList.replaceChildren(...menuRows.map(entry => entry.row));
  }

  dailyToday.textContent = `${completed} / ${dailySize}`;
  dailyTotal.textContent = daily.previousTotal + completed;
  const text = messages();
  daily.items.forEach((item, position) => {
    const { row, select, progress, check } = menuRows[position];
    const done = item.count === item.limit;
    const isActive = active === position;
    row.classList.toggle("active", isActive);
    if (isActive) {
      select.setAttribute("aria-current", "step");
    } else {
      select.removeAttribute("aria-current");
    }
    select.disabled = done;
    progress.textContent = `${item.count} / ${item.limit}`;
    check.checked = done;
    check.setAttribute("aria-label", text.markComplete(zikrList[item.index].text));
  });
}

function render() {
  const isDaily = mode === "daily";
  freestyleMode.setAttribute("aria-pressed", String(!isDaily));
  dailyMode.setAttribute("aria-pressed", String(isDaily));
  freestyleControls.hidden = isDaily;
  resetCycles.hidden = isDaily;
  openDaily.hidden = !isDaily;

  let current = freestyle;
  let completed = freestyle.cycles;
  if (isDaily) {
    const active = activeDailyIndex();
    current = daily.items[active];
    completed = completedItems(daily);
    dailyPreview.textContent = `${completed} / ${dailySize}`;
    if (dailyMenu.open) renderDailyMenu(active, completed);
  } else {
    zikrSelect.value = freestyle.index;
    limitSelect.value = freestyle.limit;
  }

  const zikr = current && zikrList[current.index];
  const text = messages();
  zikrText.classList.toggle("long-zikr", Boolean(zikr?.full));
  setZikrText(zikr ? (zikr.full || zikr.text) : text.complete);
  count.textContent = current ? current.count : "✓";
  counterLimit.textContent = current ? `/ ${current.limit}` : "/ —";
  cycles.textContent = `× ${completed}`;
  counter.classList.toggle("pulse", current?.count === 0);
  counter.disabled = !current;
  reset.disabled = !current;
  counter.setAttribute("aria-label", current ? text.countLabel(current.count, current.limit) : text.complete);
}

function refreshDaily() {
  if (mode !== "daily" || !ensureDaily()) return false;
  saveDaily();
  render();
  return true;
}

function playSound(audio) {
  // Called directly from the counter click so the browser can authorize playback.
  audio.currentTime = 0;
  audio.play().catch(error => console.warn("Tasbeh sound could not play", error));
}

counter.addEventListener("click", () => {
  if (refreshDaily()) return;
  let sound;
  if (mode === "daily") {
    const item = daily.items[activeDailyIndex()];
    if (!item) return;
    item.count++;
    if (item.count === item.limit) {
      daily.active = activeDailyIndex();
      sound = dailySound;
    }
    saveDaily();
  } else {
    freestyle.count++;
    if (freestyle.count >= freestyle.limit) {
      freestyle.count = 0;
      freestyle.cycles++;
      const position = freestyleOrder.indexOf(freestyle.index);
      freestyle.index = freestyleOrder[(position + 1) % freestyleOrder.length];
      sound = freestyleSound;
    }
    save(freestyleKey, freestyle);
  }
  render();
  countAnimation = animateNumber(count, countAnimation);
  if (sound) playSound(sound);
});

zikrSelect.addEventListener("change", () => {
  freestyle.index = Number(zikrSelect.value);
  save(freestyleKey, freestyle);
  render();
});

limitSelect.addEventListener("change", () => {
  freestyle.limit = Number(limitSelect.value);
  save(freestyleKey, freestyle);
  render();
});

reset.addEventListener("click", () => {
  if (refreshDaily()) return;
  if (mode === "daily") {
    daily.items[activeDailyIndex()].count = 0;
    saveDaily();
  } else {
    freestyle.count = 0;
    save(freestyleKey, freestyle);
  }
  render();
});

resetCycles.addEventListener("click", () => {
  freestyle.cycles = 0;
  save(freestyleKey, freestyle);
  render();
  optionsMenu.open = false;
  optionsToggle.focus();
});

themeToggle.addEventListener("click", () => {
  if (!reduceMotion.matches) {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    window.clearTimeout(themeTransitionTimer);
    themeTransitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 380);
  }
  preferences.theme = preferences.theme === "dark" ? "light" : "dark";
  save(preferencesKey, preferences);
  applyTheme();
});

languageButtons.forEach(button => {
  button.addEventListener("click", () => {
    preferences.language = button.dataset.language;
    save(preferencesKey, preferences);
    applyLanguage();
    applyTheme();
    render();
  });
});

document.querySelectorAll("[data-open-page]").forEach(button => {
  button.addEventListener("click", () => {
    optionsMenu.open = false;
    optionsToggle.focus();
    document.getElementById(button.dataset.openPage).showModal();
  });
});

guideDemo.addEventListener("click", () => {
  demoTaps = (demoTaps + 1) % 6;
  guideDemoCount.textContent = demoTaps;
  guideDemoHint.textContent = demoTaps === 5 ? messages().demoComplete : messages().tryDemo;
  demoAnimation = animateNumber(guideDemoCount, demoAnimation);
});

document.getElementById("guidePage").addEventListener("close", event => {
  const guide = event.currentTarget;
  guide.querySelectorAll(".guide-topic[open]").forEach(topic => { topic.open = false; });
  guide.scrollTop = 0;
});

optionsMenu.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !optionsMenu.open) return;
  optionsMenu.open = false;
  optionsToggle.focus();
});

document.addEventListener("click", event => {
  if (optionsMenu.open && !optionsMenu.contains(event.target)) optionsMenu.open = false;
});

function showDailyMenu() {
  if (dailyMenu.open) return;
  renderDailyMenu(activeDailyIndex(), completedItems(daily));
  dailyMenu.showModal();
}

dailyMode.addEventListener("click", () => {
  mode = "daily";
  ensureDaily();
  saveDaily();
  render();
});

freestyleMode.addEventListener("click", () => {
  mode = "freestyle";
  saveDaily();
  render();
});

openDaily.addEventListener("click", () => {
  refreshDaily();
  showDailyMenu();
});

function scheduleDailyRefresh() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  window.setTimeout(() => {
    refreshDaily();
    scheduleDailyRefresh();
  }, midnight - now);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  refreshDaily();
  showWelcome();
});

window.addEventListener("storage", event => {
  if (event.key === preferencesKey || event.key === null) {
    preferences = loadPreferences();
    applyLanguage();
    applyTheme();
  }
  if (event.key === freestyleKey || event.key === null) freestyle = loadFreestyle();
  if (event.key === dailyKey || event.key === null) {
    ({ mode, daily, draws } = loadDaily());
    if (mode === "freestyle" && dailyMenu.open) dailyMenu.close();
    if (mode === "daily" && ensureDaily()) saveDaily();
  }
  render();
});

applyLanguage();
applyTheme();
if (!refreshDaily()) render();
document.addEventListener("tasbeh:ready", showWelcome, { once: true });
scheduleDailyRefresh();

async function setupAppUpdates() {
  const registration = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
  let lastCheck = -Infinity;
  function checkForUpdate() {
    if (document.hidden || !navigator.onLine || !registration.active) return;
    const now = Date.now();
    if (now - lastCheck < 30_000) return;
    lastCheck = now;
    // The browser keeps the open pages on their current shell until they close.
    registration.update().catch(() => {});
  }

  document.addEventListener("visibilitychange", checkForUpdate);
  window.addEventListener("online", () => {
    lastCheck = -Infinity;
    checkForUpdate();
  });
  checkForUpdate();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  setupAppUpdates().catch(error => {
    console.warn("Tasbeh service worker could not register", error);
  });
}
