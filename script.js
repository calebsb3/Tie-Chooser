const STORAGE_KEY = "tieChooserStateV1";

const tieUploadInput = document.getElementById("tie-upload");
const collectionCount = document.getElementById("collection-count");
const recommendationCard = document.getElementById("recommendation-card");
const recommendButton = document.getElementById("recommend-button");
const wearButton = document.getElementById("wear-button");
const historyList = document.getElementById("history-list");
const recommendationScreen = document.getElementById("recommendation-screen");
const historyScreen = document.getElementById("history-screen");
const showRecommendationButton = document.getElementById("show-recommendation");
const showHistoryButton = document.getElementById("show-history");

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

function renderCollectionCount() {
  if (state.ties.length === 0) {
    collectionCount.textContent = "No ties yet.";
    return;
  }
  collectionCount.textContent = `${state.ties.length} tie${state.ties.length === 1 ? "" : "s"} in your collection`;
}

function renderRecommendation() {
  const tie = state.ties.find((item) => item.id === state.currentRecommendationId);
  if (!tie) {
    recommendationCard.classList.add("empty");
    recommendationCard.innerHTML = "<p>Click “Recommend a Tie” to get today’s pick.</p>";
    wearButton.disabled = true;
    return;
  }

  recommendationCard.classList.remove("empty");
  recommendationCard.innerHTML = "";
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
  recommendationCard.appendChild(container);
  wearButton.disabled = false;
}

function renderHistory() {
  historyList.innerHTML = "";

  if (state.history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "history-item";
    emptyItem.textContent = "No ties worn yet.";
    historyList.appendChild(emptyItem);
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
      historyList.appendChild(item);
    });
}

function render() {
  renderCollectionCount();
  renderRecommendation();
  renderHistory();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleUpload(event) {
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
  render();
  tieUploadInput.value = "";
}

function chooseRecommendation() {
  if (state.ties.length === 0) {
    state.currentRecommendationId = null;
    renderRecommendation();
    return;
  }

  ensureRemainingTieIds();
  const randomIndex = Math.floor(Math.random() * state.remainingTieIds.length);
  state.currentRecommendationId = state.remainingTieIds[randomIndex];
  renderRecommendation();
}

function markRecommendedTieAsWorn() {
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
  render();
}

function showRecommendationScreen() {
  recommendationScreen.classList.remove("hidden");
  historyScreen.classList.add("hidden");
  showRecommendationButton.classList.add("active");
  showHistoryButton.classList.remove("active");
}

function showHistoryScreen() {
  recommendationScreen.classList.add("hidden");
  historyScreen.classList.remove("hidden");
  showRecommendationButton.classList.remove("active");
  showHistoryButton.classList.add("active");
}

tieUploadInput.addEventListener("change", handleUpload);
recommendButton.addEventListener("click", chooseRecommendation);
wearButton.addEventListener("click", markRecommendedTieAsWorn);
showRecommendationButton.addEventListener("click", showRecommendationScreen);
showHistoryButton.addEventListener("click", showHistoryScreen);

readState();
ensureRemainingTieIds();
render();
