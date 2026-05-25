const STORAGE_KEY = "tieChooserStateV1";
const WINDOW_NAME_KEY = "tieChooserWindowStateV1";
const PAGE_COLLECTION = "collection";
const PAGE_RECOMMENDATION = "recommendation";
const PAGE_HISTORY = "history";

const state = {
  ties: [],
  remainingTieIds: [],
  history: [],
  currentRecommendationId: null,
};

function readFromWindowName() {
  try {
    const parsed = JSON.parse(window.name || "{}");
    return parsed[WINDOW_NAME_KEY] || null;
  } catch (error) {
    return null;
  }
}

function writeToWindowName(data) {
  try {
    const parsed = JSON.parse(window.name || "{}");
    parsed[WINDOW_NAME_KEY] = data;
    window.name = JSON.stringify(parsed);
  } catch (error) {
    window.name = JSON.stringify({ [WINDOW_NAME_KEY]: data });
  }
}

function loadPersistedState() {
  let localStorageState = null;
  try {
    localStorageState = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    localStorageState = null;
  }

  // When pages are opened directly via file://, browser storage can be isolated per file.
  // window.name survives same-tab navigation, so use it as a fallback bridge.
  if (window.location.protocol === "file:") {
    return localStorageState || readFromWindowName();
  }

  return localStorageState;
}

function savePersistedState(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist tie state to localStorage", error);
  }

  if (window.location.protocol === "file:") {
    writeToWindowName(payload);
  }
}

function readState() {
  try {
    const parsed = loadPersistedState();
    if (!parsed || !Array.isArray(parsed.ties)) {
      return;
    }

    state.ties = parsed.ties;
    state.history = Array.isArray(parsed.history) ? parsed.history : [];
    state.remainingTieIds = Array.isArray(parsed.remainingTieIds) ? parsed.remainingTieIds : [];
  } catch (error) {
    console.error("Failed to load saved tie state", error);
  }
}

function persistState() {
  savePersistedState({
    ties: state.ties,
    remainingTieIds: state.remainingTieIds,
    history: state.history,
  });
}

function getWornTieIdsInCurrentCycle() {
  const activeTieIds = new Set(state.ties.map((tie) => tie.id));
  const tieCount = activeTieIds.size;
  if (tieCount === 0) {
    return new Set();
  }

  const wornInCycle = new Set();

  // Walk history in chronological order and clear the cycle after every full rotation.
  state.history.forEach((entry) => {
    if (!activeTieIds.has(entry.tieId)) {
      return;
    }

    wornInCycle.add(entry.tieId);

    if (wornInCycle.size >= tieCount) {
      wornInCycle.clear();
    }
  });

  return wornInCycle;
}

function recomputeRemainingTieIds() {
  const wornInCycle = getWornTieIdsInCurrentCycle();
  state.remainingTieIds = state.ties.filter((tie) => !wornInCycle.has(tie.id)).map((tie) => tie.id);

  if (state.remainingTieIds.length === 0 && state.ties.length > 0) {
    state.remainingTieIds = state.ties.map((tie) => tie.id);
  }
}

function ensureRemainingTieIds() {
  recomputeRemainingTieIds();
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderCollectionCount(collectionCountElement) {
  if (!collectionCountElement) {
    return;
  }

  if (state.ties.length === 0) {
    collectionCountElement.textContent = "No ties yet.";
    return;
  }
  collectionCountElement.textContent = `${state.ties.length} tie${state.ties.length === 1 ? "" : "s"} in your collection`;
}

function renderCollectionList(collectionListElement) {
  if (!collectionListElement) {
    return;
  }

  collectionListElement.innerHTML = "";

  if (state.ties.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "collection-item collection-empty";
    emptyItem.textContent = "Uploaded ties will appear here.";
    collectionListElement.appendChild(emptyItem);
    return;
  }

  state.ties.forEach((tie) => {
    const item = document.createElement("li");
    item.className = "collection-item";

    const image = document.createElement("img");
    image.className = "collection-thumbnail";
    image.src = tie.imageData;
    image.alt = tie.name;

    const name = document.createElement("span");
    name.className = "collection-name";
    name.textContent = tie.name;

    item.appendChild(image);
    item.appendChild(name);
    collectionListElement.appendChild(item);
  });
}

function renderRecommendation(recommendationCardElement, wearButtonElement) {
  if (!recommendationCardElement || !wearButtonElement) {
    return;
  }

  const tie = state.ties.find((item) => item.id === state.currentRecommendationId);
  if (!tie) {
    recommendationCardElement.classList.add("empty");
    recommendationCardElement.innerHTML =
      state.ties.length === 0
        ? "<p>No ties in your collection yet. Upload photos on the Collection page.</p>"
        : "<p>Click \"Recommend a Tie\" to get today's pick.</p>";
    wearButtonElement.disabled = true;
    return;
  }

  recommendationCardElement.classList.remove("empty");
  recommendationCardElement.innerHTML = "";
  const container = document.createElement("div");
  const image = document.createElement("img");
  image.src = tie.imageData;
  image.alt = tie.name;

  const meta = document.createElement("div");
  meta.className = "recommendation-meta";
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = tie.name;
  paragraph.appendChild(strong);
  meta.appendChild(paragraph);

  container.appendChild(image);
  container.appendChild(meta);
  recommendationCardElement.appendChild(container);
  wearButtonElement.disabled = false;
}

function renderHistory(historyListElement) {
  if (!historyListElement) {
    return;
  }

  historyListElement.innerHTML = "";

  if (state.history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "history-item";
    emptyItem.textContent = "No ties worn yet.";
    historyListElement.appendChild(emptyItem);
    return;
  }

  [...state.history]
    .sort((a, b) => (a.wornAt < b.wornAt ? 1 : -1))
    .forEach((entry) => {
      const tie = state.ties.find((item) => item.id === entry.tieId);
      const tieName = tie ? tie.name : "Removed tie";

      const item = document.createElement("li");
      item.className = "history-item";

      if (tie?.imageData) {
        const thumbnail = document.createElement("img");
        thumbnail.className = "history-thumbnail";
        thumbnail.src = tie.imageData;
        thumbnail.alt = tieName;
        item.appendChild(thumbnail);
      }

      const details = document.createElement("div");
      details.className = "history-details";

      const nameElement = document.createElement("strong");
      nameElement.textContent = tieName;

      const dateElement = document.createElement("span");
      dateElement.textContent = formatDate(entry.wornAt);

      details.appendChild(nameElement);
      details.appendChild(dateElement);
      item.appendChild(details);
      historyListElement.appendChild(item);
    });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleUpload(event, collectionCountElement, collectionListElement) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) {
    return;
  }

  const newTies = await Promise.all(
    files.map(async (file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      imageData: await readFileAsDataUrl(file),
    }))
  );

  state.ties.push(...newTies);
  ensureRemainingTieIds();
  persistState();
  renderCollectionCount(collectionCountElement);
  renderCollectionList(collectionListElement);
  event.target.value = "";
}

function chooseRecommendation(recommendationCardElement, wearButtonElement) {
  if (state.ties.length === 0) {
    state.currentRecommendationId = null;
    renderRecommendation(recommendationCardElement, wearButtonElement);
    return;
  }

  recomputeRemainingTieIds();
  const randomIndex = Math.floor(Math.random() * state.remainingTieIds.length);
  state.currentRecommendationId = state.remainingTieIds[randomIndex];
  renderRecommendation(recommendationCardElement, wearButtonElement);
}

function markRecommendedTieAsWorn(recommendationCardElement, wearButtonElement) {
  const tieId = state.currentRecommendationId;
  if (!tieId) {
    return;
  }

  state.history.push({
    tieId,
    wornAt: new Date().toISOString(),
  });

  recomputeRemainingTieIds();

  state.currentRecommendationId = null;
  persistState();
  renderRecommendation(recommendationCardElement, wearButtonElement);
}

function initCollectionPage() {
  const tieUploadInput = document.getElementById("tie-upload");
  const collectionCountElement = document.getElementById("collection-count");
  const collectionListElement = document.getElementById("collection-list");

  if (!tieUploadInput || !collectionCountElement || !collectionListElement) {
    return;
  }

  tieUploadInput.addEventListener("change", (event) => handleUpload(event, collectionCountElement, collectionListElement));
  renderCollectionCount(collectionCountElement);
  renderCollectionList(collectionListElement);
}

function initRecommendationPage() {
  const recommendationCardElement = document.getElementById("recommendation-card");
  const recommendButton = document.getElementById("recommend-button");
  const wearButtonElement = document.getElementById("wear-button");

  if (!recommendationCardElement || !recommendButton || !wearButtonElement) {
    return;
  }

  recommendButton.addEventListener("click", () => chooseRecommendation(recommendationCardElement, wearButtonElement));
  wearButtonElement.addEventListener("click", () => markRecommendedTieAsWorn(recommendationCardElement, wearButtonElement));

  renderRecommendation(recommendationCardElement, wearButtonElement);
}

function initHistoryPage() {
  const historyListElement = document.getElementById("history-list");
  if (!historyListElement) {
    return;
  }

  renderHistory(historyListElement);
}

function showScreen(activePage) {
  const collectionScreen = document.getElementById("collection-screen");
  const recommendationScreen = document.getElementById("recommendation-screen");
  const historyScreen = document.getElementById("history-screen");

  const screens = [
    { page: PAGE_COLLECTION, element: collectionScreen },
    { page: PAGE_RECOMMENDATION, element: recommendationScreen },
    { page: PAGE_HISTORY, element: historyScreen },
  ];

  screens.forEach(({ page, element }) => {
    if (!element) {
      return;
    }

    element.classList.toggle("hidden", page !== activePage);
  });
}

function updateActiveNav(activePage) {
  const navCollection = document.getElementById("nav-collection");
  const navRecommendation = document.getElementById("nav-recommendation");
  const navHistory = document.getElementById("nav-history");

  const navItems = [
    { page: PAGE_COLLECTION, element: navCollection },
    { page: PAGE_RECOMMENDATION, element: navRecommendation },
    { page: PAGE_HISTORY, element: navHistory },
  ];

  navItems.forEach(({ page, element }) => {
    if (!element) {
      return;
    }

    const isActive = page === activePage;
    element.classList.toggle("active", isActive);
    if (isActive) {
      element.setAttribute("aria-current", "page");
    } else {
      element.removeAttribute("aria-current");
    }
  });
}

function getRequestedPage() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");

  if ([PAGE_COLLECTION, PAGE_RECOMMENDATION, PAGE_HISTORY].includes(page)) {
    return page;
  }

  return PAGE_COLLECTION;
}

readState();
ensureRemainingTieIds();
initCollectionPage();
initRecommendationPage();
initHistoryPage();
const activePage = getRequestedPage();
showScreen(activePage);
updateActiveNav(activePage);
