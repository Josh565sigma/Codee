const API_BASE_URL = "https://twilight-vault--vemef91842.replit.app";
const EMULATOR_DATA_URL = "https://cdn.emulatorjs.org/stable/data/";

const state = {
  games: [],
  selectedGame: null,
  emulatorRunning: false,
  audioContext: null,
  toastTimer: null,
  filter: "all",
  refreshInProgress: false,
};

const elements = {
  clock: document.querySelector("#clock"),
  batteryLevel: document.querySelector("#battery-level"),
  batteryIcon: document.querySelector("#battery-icon"),
  coverPlaceholder: document.querySelector("#cover-placeholder"),
  gameCover: document.querySelector("#game-cover"),
  selectedTitle: document.querySelector("#selected-title"),
  selectedSubtitle: document.querySelector("#selected-subtitle"),
  selectedSystem: document.querySelector("#selected-system"),
  selectedSize: document.querySelector("#selected-size"),
  startGame: document.querySelector("#start-game"),
  favoriteGame: document.querySelector("#favorite-game"),
  searchInput: document.querySelector("#search-input"),
  gameCount: document.querySelector("#game-count"),
  libraryState: document.querySelector("#library-state"),
  carousel: document.querySelector("#game-carousel"),
  syncStatus: document.querySelector("#sync-status"),
  toast: document.querySelector("#toast"),
  filterBar: document.querySelector("#filter-bar"),
  surpriseButton: document.querySelector("#surprise-button"),
  refreshLibrary: document.querySelector("#refresh-library"),
  emulator: document.querySelector("#emulator-container"),
  emulatorTitle: document.querySelector("#emulator-title"),
  emulatorStage: document.querySelector("#game"),
  emulatorLoading: document.querySelector("#emulator-loading"),
  exitGame: document.querySelector("#exit-game"),
};

const systemLabels = {
  snes: "SUPER NES",
  gba: "GAME BOY ADVANCE",
  nds: "NINTENDO DS",
  n64: "NINTENDO 64",
};

function nativeCall(method, fallback) {
  try {
    if (window.AndroidBridge && typeof window.AndroidBridge[method] === "function") {
      return window.AndroidBridge[method]();
    }
  } catch (error) {
    console.warn(`Native bridge call failed: ${method}`, error);
  }
  return fallback;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) return "UNKNOWN SIZE";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function playClick() {
  try {
    state.audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(560, state.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(210, state.audioContext.currentTime + 0.045);
    gain.gain.setValueAtTime(0.045, state.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.06);
    oscillator.connect(gain).connect(state.audioContext.destination);
    oscillator.start();
    oscillator.stop(state.audioContext.currentTime + 0.065);
  } catch {
    // Audio is an enhancement; selection remains fully usable when unavailable.
  }
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3000);
}

function updateStatus() {
  const time = nativeCall("getSystemTime", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
  const battery = Number(nativeCall("getBatteryLevel", 100));
  elements.clock.textContent = time || "--:--";
  elements.batteryLevel.textContent = Number.isFinite(battery) ? battery : "--";
  elements.batteryIcon.style.setProperty("--battery-width", `${Math.max(4, Math.min(100, battery))}%`);
}

function selectGame(game) {
  playClick();
  state.selectedGame = game;
  elements.selectedTitle.textContent = game.title;
  elements.selectedSubtitle.textContent = systemLabels[game.system] || game.system.toUpperCase();
  elements.selectedSystem.textContent = (game.system || "ROM").toUpperCase();
  elements.selectedSize.textContent = formatBytes(game.file_size);
  elements.startGame.disabled = false;
  elements.favoriteGame.disabled = false;
  elements.favoriteGame.textContent = game.favorite ? "★" : "☆";
  elements.favoriteGame.classList.toggle("active", Boolean(game.favorite));
  elements.favoriteGame.setAttribute("aria-label", game.favorite ? "Remove selected game from favorites" : "Add selected game to favorites");
  elements.emulatorTitle.textContent = `TWiLight Vault // ${game.title}`;
  document.querySelectorAll(".game-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.gameId === String(game.id));
  });

  if (game.cover_art_url) {
    elements.gameCover.src = game.cover_art_url;
    elements.gameCover.alt = `${game.title} cover art`;
    elements.gameCover.hidden = false;
    elements.coverPlaceholder.hidden = true;
  } else {
    elements.gameCover.hidden = true;
    elements.coverPlaceholder.hidden = false;
  }
}

function renderGames(games) {
  state.games = games;
  elements.gameCount.textContent = `${games.length} TITLE${games.length === 1 ? "" : "S"}`;
  elements.carousel.innerHTML = "";

  if (state.selectedGame && !games.some((game) => game.id === state.selectedGame.id)) {
    state.selectedGame = null;
    elements.startGame.disabled = true;
    elements.favoriteGame.disabled = true;
    elements.favoriteGame.textContent = "☆";
    elements.favoriteGame.classList.remove("active");
    elements.selectedTitle.textContent = "Choose a cartridge";
    elements.selectedSubtitle.textContent = "Search your vault below to begin.";
    elements.selectedSystem.textContent = "READY";
    elements.selectedSize.textContent = "No game selected";
  }

  if (!games.length) {
    elements.libraryState.innerHTML = "<span>No cartridges found. Add ROMs to the server vault.</span>";
    elements.libraryState.hidden = false;
    return;
  }

  elements.libraryState.hidden = true;
  const fragment = document.createDocumentFragment();
  for (const game of games) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "game-card";
    card.dataset.gameId = game.id;
    card.setAttribute("aria-label", `Select ${game.title}`);
    const favoriteMark = game.favorite ? "★" : "";
    card.innerHTML = game.cover_art_url
      ? `<img class="card-art" src="${escapeHtml(game.cover_art_url)}" alt="" /><div class="card-info"><div class="card-title">${escapeHtml(game.title)}</div><div class="card-meta"><span class="card-system">${escapeHtml(game.system)}</span><span>${favoriteMark} ${formatBytes(game.file_size)}</span></div></div>`
      : `<div class="card-placeholder">${escapeHtml((game.system || "ROM").toUpperCase())}</div><div class="card-info"><div class="card-title">${escapeHtml(game.title)}</div><div class="card-meta"><span class="card-system">${escapeHtml(game.system)}</span><span>${favoriteMark} ${formatBytes(game.file_size)}</span></div></div>`;
    card.addEventListener("click", () => selectGame(game));
    fragment.append(card);
  }
  elements.carousel.append(fragment);
  if (!state.selectedGame && games.length) {
    selectGame(games[0]);
  } else if (state.selectedGame) {
    const stillExists = games.find((game) => game.id === state.selectedGame.id);
    if (stillExists) selectGame(stillExists);
  }
}

async function loadGames(query = "") {
  elements.syncStatus.textContent = "SYNCING...";
  if (!state.games.length) {
    elements.libraryState.hidden = false;
    elements.libraryState.innerHTML = '<span class="loader"></span><span>Scanning the vault...</span>';
  }

  try {
    const params = new URLSearchParams({ q: query });
    if (state.filter === "favorites") params.set("favorites", "1");
    else if (state.filter === "recent") params.set("sort", "recent");
    else if (state.filter !== "all") params.set("system", state.filter);
    const response = await fetch(`${API_BASE_URL}/api/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Search failed with ${response.status}`);
    renderGames(await response.json());
    elements.syncStatus.textContent = "VAULT ONLINE";
  } catch (error) {
    console.error(error);
    elements.syncStatus.textContent = "OFFLINE";
    if (!state.games.length) {
      elements.libraryState.hidden = false;
      elements.libraryState.innerHTML = "<span>Vault unavailable. Check the server URL.</span>";
    }
    showToast("Could not reach the vault server.");
  }
}

async function toggleFavorite() {
  if (!state.selectedGame) return;
  const nextFavorite = !state.selectedGame.favorite;
  elements.favoriteGame.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/api/games/${state.selectedGame.id}/favorite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ favorite: nextFavorite }),
    });
    if (!response.ok) throw new Error(`Favorite update failed with ${response.status}`);
    state.selectedGame.favorite = nextFavorite ? 1 : 0;
    showToast(nextFavorite ? "Added to favorites." : "Removed from favorites.");
    await loadGames(elements.searchInput.value);
  } catch (error) {
    console.error(error);
    showToast("Could not update favorites.");
    elements.favoriteGame.disabled = false;
  }
}

async function markGamePlayed(gameId) {
  try {
    await fetch(`${API_BASE_URL}/api/games/${gameId}/played`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    console.warn("Could not save play history", error);
  }
}

async function refreshLibrary() {
  if (state.refreshInProgress) return;
  state.refreshInProgress = true;
  elements.refreshLibrary.disabled = true;
  elements.syncStatus.textContent = "SCANNING...";
  try {
    const response = await fetch(`${API_BASE_URL}/api/sync`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Sync failed with ${response.status}`);
    await loadGames(elements.searchInput.value);
    showToast("Vault refreshed.");
  } catch (error) {
    console.error(error);
    showToast("Could not refresh the vault.");
    elements.syncStatus.textContent = "OFFLINE";
  } finally {
    state.refreshInProgress = false;
    elements.refreshLibrary.disabled = false;
  }
}

function chooseRandomGame() {
  if (!state.games.length) {
    showToast("No games available for a random pick.");
    return;
  }
  const game = state.games[Math.floor(Math.random() * state.games.length)];
  selectGame(game);
  document.querySelector(`[data-game-id="${game.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  showToast(`Random pick: ${game.title}`);
}

function changeFilter(filter) {
  if (state.filter === filter) return;
  playClick();
  state.filter = filter;
  elements.filterBar.querySelectorAll(".filter-button").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  loadGames(elements.searchInput.value);
}

async function startGame() {
  if (!state.selectedGame || state.emulatorRunning) return;
  playClick();
  elements.startGame.disabled = true;
  elements.emulator.classList.add("visible");
  elements.emulator.setAttribute("aria-hidden", "false");
  elements.emulatorLoading.classList.remove("hidden");
  state.emulatorRunning = true;
  nativeCall("setEmulatorRunning", true);
  window.isEmulatorRunning = () => state.emulatorRunning;

  try {
    const tokenResponse = await fetch(`${API_BASE_URL}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ game_id: state.selectedGame.id }),
    });
    if (!tokenResponse.ok) throw new Error(`Token request failed with ${tokenResponse.status}`);
    const { download_url: downloadUrl } = await tokenResponse.json();
    void markGamePlayed(state.selectedGame.id);
    const systemCore = state.selectedGame.system;

    window.EJS_player = "#game";
    window.EJS_core = systemCore;
    window.EJS_gameUrl = API_BASE_URL + downloadUrl;
    window.EJS_pathtodata = EMULATOR_DATA_URL;
    window.EJS_startOnLoaded = true;
    window.EJS_VirtualGamepad = true;
    window.EJS_backgroundColor = "#000000";

    const loader = document.createElement("script");
    loader.id = "emulatorjs-loader";
    loader.src = `${EMULATOR_DATA_URL}loader.js`;
    loader.async = true;
    loader.onload = () => elements.emulatorLoading.classList.add("hidden");
    loader.onerror = () => {
      elements.emulatorLoading.classList.add("hidden");
      showToast("EmulatorJS could not be loaded.");
    };
    document.body.append(loader);
  } catch (error) {
    console.error(error);
    showToast("Could not prepare this cartridge.");
    exitEmulator();
  }
}

function exitEmulator() {
  playClick();
  try {
    if (window.EJS_emulator && typeof window.EJS_emulator.destroy === "function") {
      window.EJS_emulator.destroy();
    }
  } catch (error) {
    console.warn("Emulator cleanup failed", error);
  }
  document.querySelector("#emulatorjs-loader")?.remove();
  elements.emulatorStage.replaceChildren();
  const gameNode = document.createElement("div");
  gameNode.id = "game";
  gameNode.className = "emulator-stage";
  elements.emulatorStage.replaceWith(gameNode);
  elements.emulatorStage = gameNode;
  elements.emulator.classList.remove("visible");
  elements.emulator.setAttribute("aria-hidden", "true");
  elements.emulatorLoading.classList.remove("hidden");
  state.emulatorRunning = false;
  nativeCall("setEmulatorRunning", false);
  elements.startGame.disabled = !state.selectedGame;
}

elements.searchInput.addEventListener("input", (event) => {
  clearTimeout(elements.searchInput.searchTimer);
  elements.searchInput.searchTimer = setTimeout(() => loadGames(event.target.value), 180);
});
elements.startGame.addEventListener("click", startGame);
elements.favoriteGame.addEventListener("click", toggleFavorite);
elements.exitGame.addEventListener("click", exitEmulator);
elements.filterBar.querySelectorAll(".filter-button").forEach((button) => {
  button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
  button.addEventListener("click", () => changeFilter(button.dataset.filter));
});
elements.surpriseButton.addEventListener("click", chooseRandomGame);
elements.refreshLibrary.addEventListener("click", refreshLibrary);
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button:not(.game-card)")) playClick();
}, { passive: true });

window.exitEmulator = exitEmulator;
window.isEmulatorRunning = () => state.emulatorRunning;
updateStatus();
setInterval(updateStatus, 30_000);
loadGames();
setInterval(() => loadGames(elements.searchInput.value), 60_000);