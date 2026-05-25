const STORAGE_KEY = "tieChooserStateV1";

const state = {
  ties: [],
  remainingTieIds: [],
  history: [],
  currentRecommendationId: null,
};

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.ties) || !Array.isArray(parsed.history)) {
      return;
    }

    state.ties = parsed.ties;
    state.history = parsed.history;
    state.remainingTieIds = Array.isArray(parsed.remainingTieIds) ? parsed.remainingTieIds : [];
  } catch (error) {
    console.error("Failed to load saved tie state", error);
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ties: state.ties,
      remainingTieIds: state.remainingTieIds,
      history: state.history,
    })
  );
}

function ensureRemainingTieIds() {
  const tieIds = state.ties.map((tie) => tie.id);
  state.remainingTieIds = state.remainingTieIds.filter((id) => tieIds.includes(id));
  if (state.remainingTieIds.length === 0 && tieIds.length > 0) {
    state.remainingTieIds = [...tieIds];
  }
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

      const nameElement = document.createElement("strong");
      nameElement.textContent = tieName;

      const dateElement = document.createElement("span");
      dateElement.textContent = formatDate(entry.wornAt);

      item.appendChild(nameElement);
      item.appendChild(dateElement);
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

async function handleUpload(event, collectionCountElement) {
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
  event.target.value = "";
}

function chooseRecommendation(recommendationCardElement, wearButtonElement) {
  if (state.ties.length === 0) {
    state.currentRecommendationId = null;
    renderRecommendation(recommendationCardElement, wearButtonElement);
    return;
  }

  ensureRemainingTieIds();
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

  state.remainingTieIds = state.remainingTieIds.filter((id) => id !== tieId);
  if (state.remainingTieIds.length === 0 && state.ties.length > 0) {
    state.remainingTieIds = state.ties.map((tie) => tie.id);
  }

  state.currentRecommendationId = null;
  persistState();
  renderRecommendation(recommendationCardElement, wearButtonElement);
}

function initCollectionPage() {
  const tieUploadInput = document.getElementById("tie-upload");
  const collectionCountElement = document.getElementById("collection-count");

  if (!tieUploadInput || !collectionCountElement) {
    return;
  }

  tieUploadInput.addEventListener("change", (event) => handleUpload(event, collectionCountElement));
  renderCollectionCount(collectionCountElement);
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

readState();
ensureRemainingTieIds();
initCollectionPage();
initRecommendationPage();
initHistoryPage();
