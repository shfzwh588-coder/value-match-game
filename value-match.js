const BADGES = [
  {
    id: "customer",
    name: "客户第一",
    english: "Customer First",
    image: "match-badges/customer-first.png",
    multiplier: 1.5,
  },
  {
    id: "teamwork",
    name: "团队协作",
    english: "Teamwork",
    image: "match-badges/teamwork.png",
    multiplier: 1,
  },
  {
    id: "strive",
    name: "拼搏进取",
    english: "Strive Forward",
    image: "match-badges/strive-forward.png",
    multiplier: 1,
  },
  {
    id: "learning",
    name: "持续学习",
    english: "Keep Learning",
    image: "match-badges/keep-learning.png",
    multiplier: 1,
  },
  {
    id: "innovation",
    name: "创新创业",
    english: "Innovate & Build",
    image: "match-badges/innovate-build.png",
    multiplier: 1,
  },
];

const SIZE = 8;
const START_SECONDS = 90;
const SHUFFLE_PENALTY = 8;
const LEADERBOARD_KEY = "value-match-leaderboard-v1";
const PLAYER_NAME_KEY = "value-match-player-name";

const startScreen = document.querySelector("#startScreen");
const gameShell = document.querySelector("#gameShell");
const startPlayerNameInput = document.querySelector("#startPlayerName");
const startNameField = startPlayerNameInput.closest(".start-name-field");
const nameError = document.querySelector("#nameError");
const startButton = document.querySelector("#startButton");
const boardEl = document.querySelector("#board");
const scoreText = document.querySelector("#scoreText");
const timeText = document.querySelector("#timeText");
const bestText = document.querySelector("#bestText");
const collectionList = document.querySelector("#collectionList");
const floatingScore = document.querySelector("#floatingScore");
const newGameButton = document.querySelector("#newGameButton");
const hintButton = document.querySelector("#hintButton");
const shuffleButton = document.querySelector("#shuffleButton");
const resultModal = document.querySelector("#resultModal");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const resultScore = document.querySelector("#resultScore");
const resultRank = document.querySelector("#resultRank");
const resultCustomer = document.querySelector("#resultCustomer");
const resultValueText = document.querySelector("#resultValueText");
const resultSummaryView = document.querySelector("#resultSummaryView");
const resultLeaderboardView = document.querySelector("#resultLeaderboardView");
const resultLeaderboardButton = document.querySelector("#resultLeaderboardButton");
const backToResultButton = document.querySelector("#backToResultButton");
const resultRestartFromRankButton = document.querySelector("#resultRestartFromRankButton");
const myRankCard = document.querySelector("#myRankCard");
const resultLeaderboardList = document.querySelector("#resultLeaderboardList");
const resultButton = document.querySelector("#resultButton");
const playerNameInput = document.querySelector("#playerName");

let board = [];
let selected = null;
let score = 0;
let timeLeft = START_SECONDS;
let combo = 1;
let locked = false;
let gameOver = false;
let gameStarted = false;
let timerId = null;
let collected = Object.fromEntries(BADGES.map((badge) => [badge.id, 0]));
let dragStart = null;
let leaderboard = loadLeaderboard();
let lastResult = null;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function randomType() {
  return Math.floor(Math.random() * BADGES.length);
}

function badgeFor(type) {
  return BADGES[type];
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function wouldCreateInitialMatch(row, col, type, grid) {
  const leftA = col >= 1 ? grid[row][col - 1] : null;
  const leftB = col >= 2 ? grid[row][col - 2] : null;
  const upA = row >= 1 ? grid[row - 1][col] : null;
  const upB = row >= 2 ? grid[row - 2][col] : null;
  return (leftA === type && leftB === type) || (upA === type && upB === type);
}

function buildBoard() {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      let type = randomType();
      let guard = 0;
      while (wouldCreateInitialMatch(row, col, type, grid) && guard < 30) {
        type = randomType();
        guard += 1;
      }
      grid[row][col] = type;
    }
  }
  return grid;
}

function findMatches(grid = board) {
  const matched = new Set();

  for (let row = 0; row < SIZE; row += 1) {
    let runType = grid[row][0];
    let runStart = 0;
    for (let col = 1; col <= SIZE; col += 1) {
      const current = col < SIZE ? grid[row][col] : null;
      if (current === runType && current !== null) continue;

      const length = col - runStart;
      if (runType !== null && length >= 3) {
        for (let c = runStart; c < col; c += 1) {
          matched.add(`${row},${c}`);
        }
      }
      runType = current;
      runStart = col;
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let runType = grid[0][col];
    let runStart = 0;
    for (let row = 1; row <= SIZE; row += 1) {
      const current = row < SIZE ? grid[row][col] : null;
      if (current === runType && current !== null) continue;

      const length = row - runStart;
      if (runType !== null && length >= 3) {
        for (let r = runStart; r < row; r += 1) {
          matched.add(`${r},${col}`);
        }
      }
      runType = current;
      runStart = row;
    }
  }

  return [...matched].map((key) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  });
}

function hasPossibleMove() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const current = { row, col };
      const candidates = [
        { row: row + 1, col },
        { row, col: col + 1 },
      ];
      for (const next of candidates) {
        if (!inBounds(next.row, next.col)) continue;
        swapInBoard(current, next);
        const possible = findMatches().length > 0;
        swapInBoard(current, next);
        if (possible) return [current, next];
      }
    }
  }
  return null;
}

function ensurePlayableBoard() {
  let guard = 0;
  while (!hasPossibleMove() && guard < 50) {
    board = buildBoard();
    guard += 1;
  }
}

function safeParseJson(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function bestEntriesByName(entries) {
  const bestByName = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    const name = normalizePlayerName(entry.name);
    if (!name) continue;
    const scoreValue = Number(entry.score);
    if (!Number.isFinite(scoreValue) || scoreValue <= 0) continue;

    const normalizedEntry = {
      id: entry.id || `${name}-${scoreValue}-${entry.date || 0}`,
      name,
      score: Math.round(scoreValue),
      date: Number(entry.date) || 0,
    };
    const currentBest = bestByName.get(name);
    if (
      !currentBest ||
      normalizedEntry.score > currentBest.score ||
      (normalizedEntry.score === currentBest.score && normalizedEntry.date < currentBest.date)
    ) {
      bestByName.set(name, normalizedEntry);
    }
  }

  return [...bestByName.values()]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, 10);
}

function loadLeaderboard() {
  const raw = window.localStorage.getItem(LEADERBOARD_KEY);
  const entries = safeParseJson(raw, []);
  return Array.isArray(entries) ? bestEntriesByName(entries) : [];
}

function saveLeaderboard() {
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard.slice(0, 10)));
}

function normalizePlayerName(value) {
  return (value || "").trim();
}

function updateStartNameState(showError = false) {
  const hasName = Boolean(normalizePlayerName(startPlayerNameInput.value));
  startButton.classList.toggle("is-waiting-name", !hasName);
  startNameField.classList.toggle("is-invalid", showError && !hasName);
  startPlayerNameInput.setAttribute("aria-invalid", String(showError && !hasName));
  nameError.textContent = showError && !hasName ? "请输入昵称后开始挑战" : "";
  return hasName;
}

function setPlayerName(name) {
  const normalized = normalizePlayerName(name);
  playerNameInput.value = normalized;
  startPlayerNameInput.value = normalized;
  if (normalized) {
    window.localStorage.setItem(PLAYER_NAME_KEY, normalized);
  } else {
    window.localStorage.removeItem(PLAYER_NAME_KEY);
  }
  updateStartNameState(false);
}

function playerName() {
  return normalizePlayerName(playerNameInput.value);
}

function savePlayerName() {
  setPlayerName(playerNameInput.value);
}

function bestScore() {
  return leaderboard[0]?.score ?? 0;
}

function recordScore() {
  if (score <= 0) return { entry: null, rank: null, isPersonalBest: false };
  const name = playerName();
  const existingEntry = leaderboard.find((item) => item.name === name);
  const isPersonalBest = !existingEntry || score > existingEntry.score;
  const entry = {
    id: existingEntry?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    score,
    date: Date.now(),
  };
  const retainedEntry = isPersonalBest ? entry : existingEntry;
  const rankedEntries = [
    ...leaderboard.filter((item) => item.name !== name),
    retainedEntry,
  ].sort((a, b) => b.score - a.score || a.date - b.date);
  const rank = rankedEntries.findIndex((item) => item.id === retainedEntry.id) + 1;
  leaderboard = rankedEntries.slice(0, 10);
  saveLeaderboard();
  renderLeaderboard();
  return { entry: retainedEntry, rank, isPersonalBest };
}

function renderLeaderboard() {
  bestText.textContent = String(bestScore());
}

function showResultSummary() {
  resultSummaryView.classList.remove("is-hidden");
  resultLeaderboardView.classList.add("is-hidden");
}

function showResultLeaderboard() {
  renderResultLeaderboard();
  resultSummaryView.classList.add("is-hidden");
  resultLeaderboardView.classList.remove("is-hidden");
}

function renderResultLeaderboard() {
  const rank = lastResult?.rank ?? null;
  const entry = lastResult?.entry ?? null;
  myRankCard.innerHTML = entry
    ? `
      <span>我的最好成绩</span>
      <strong>${rank <= 10 ? `第 ${rank} 名` : "未进前 10"}</strong>
      <em>${entry.name} · ${entry.score} 分</em>
    `
    : `
      <span>我的最好成绩</span>
      <strong>继续冲榜</strong>
      <em>本局暂无有效得分</em>
    `;

  resultLeaderboardList.innerHTML = "";
  if (!leaderboard.length) {
    const empty = document.createElement("li");
    empty.className = "result-leaderboard-empty";
    empty.textContent = "还没有成绩，打完一局后会自动上榜。";
    resultLeaderboardList.append(empty);
    return;
  }

  leaderboard.slice(0, 10).forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "result-leaderboard-item";
    if (entry?.id === item.id) li.classList.add("is-current-player");
    li.innerHTML = `
      <span class="leaderboard-rank">${index + 1}</span>
      <span class="leaderboard-name">${item.name}</span>
      <span class="leaderboard-score">${item.score}</span>
    `;
    resultLeaderboardList.append(li);
  });
}

function renderCollections() {
  collectionList.innerHTML = "";
  for (const badge of BADGES) {
    const item = document.createElement("div");
    item.className = "collection-item";
    item.innerHTML = `
      <img src="${badge.image}" alt="${badge.name}" />
      <div class="collection-name">
        <strong>${badge.name}</strong>
        <span>${badge.english}${badge.multiplier > 1 ? " · 高分徽章" : ""}</span>
      </div>
      <span class="collection-count" id="count-${badge.id}">${collected[badge.id]}</span>
    `;
    collectionList.append(item);
  }
}

function updateHud() {
  scoreText.textContent = String(score);
  timeText.textContent = formatTime(timeLeft);
  bestText.textContent = String(Math.max(bestScore(), score));
  for (const badge of BADGES) {
    const countEl = document.querySelector(`#count-${badge.id}`);
    if (countEl) countEl.textContent = String(collected[badge.id]);
  }
}

function renderBoard(options = {}) {
  const { newCells = new Set(), clearing = new Set(), hint = [] } = options;
  const hintKeys = new Set(hint.map((cell) => `${cell.row},${cell.col}`));

  boardEl.innerHTML = "";
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const type = board[row][col];
      const badge = badgeFor(type);
      const button = document.createElement("button");
      button.className = "tile";
      button.type = "button";
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${badge.name}，第 ${row + 1} 行第 ${col + 1} 列`);

      const key = `${row},${col}`;
      if (selected?.row === row && selected?.col === col) button.classList.add("is-selected");
      if (newCells.has(key)) button.classList.add("is-new");
      if (clearing.has(key)) button.classList.add("is-clearing");
      if (hintKeys.has(key)) button.classList.add("is-hint");

      const img = document.createElement("img");
      img.src = badge.image;
      img.alt = badge.name;
      button.append(img);

      button.addEventListener("click", () => handleTileClick(row, col));
      button.addEventListener("pointerdown", (event) => {
        dragStart = { row, col, x: event.clientX, y: event.clientY };
      });
      button.addEventListener("pointerup", (event) => handlePointerUp(event, row, col));

      boardEl.append(button);
    }
  }
}

function setMessage(text) {
  boardEl.setAttribute("aria-label", text);
}

function showFloatingScore(points) {
  floatingScore.textContent = `+${points}`;
  floatingScore.classList.remove("is-visible");
  void floatingScore.offsetWidth;
  floatingScore.classList.add("is-visible");
}

function swapInBoard(a, b) {
  const tmp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = tmp;
}

async function handleTileClick(row, col) {
  if (locked || gameOver || timeLeft <= 0) return;
  const current = { row, col };

  if (!selected) {
    selected = current;
    renderBoard();
    return;
  }

  if (selected.row === row && selected.col === col) {
    selected = null;
    renderBoard();
    return;
  }

  if (!areAdjacent(selected, current)) {
    selected = current;
    renderBoard();
    setMessage("请选择相邻的徽章进行交换。");
    return;
  }

  await attemptSwap(selected, current);
}

async function handlePointerUp(event, row, col) {
  if (!dragStart || locked || gameOver || timeLeft <= 0) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance < 24) {
    dragStart = null;
    return;
  }

  let target = { row, col };
  if (Math.abs(dx) > Math.abs(dy)) {
    target.col += dx > 0 ? 1 : -1;
  } else {
    target.row += dy > 0 ? 1 : -1;
  }
  const start = { row: dragStart.row, col: dragStart.col };
  dragStart = null;

  if (!inBounds(target.row, target.col)) return;
  await attemptSwap(start, target);
}

async function attemptSwap(a, b) {
  if (locked || gameOver || timeLeft <= 0) return;
  locked = true;
  selected = null;
  swapInBoard(a, b);
  renderBoard();
  await wait(120);

  const matches = findMatches();
  if (!matches.length) {
    swapInBoard(a, b);
    renderBoard();
    setMessage("这一步没有形成三连，换回来了。");
    locked = false;
    return;
  }

  combo = 1;
  updateHud();
  await resolveBoard(matches);
  await finishTurn();
}

async function resolveBoard(initialMatches) {
  let matches = initialMatches;
  let chain = 0;

  while (matches.length && !gameOver) {
    chain += 1;
    combo = chain;
    const matchedKeys = new Set(matches.map((cell) => `${cell.row},${cell.col}`));
    renderBoard({ clearing: matchedKeys });
    await wait(160);

    let points = 0;
    for (const { row, col } of matches) {
      const type = board[row][col];
      if (type !== null) {
        const badge = badgeFor(type);
        collected[badge.id] += 1;
        points += Math.round(40 * chain * badge.multiplier);
      }
      board[row][col] = null;
    }
    score += points;
    showFloatingScore(points);
    updateHud();
    dropTiles();
    const newCells = refillTiles();
    renderBoard({ newCells });
    await wait(160);
    matches = findMatches();
  }
}

function dropTiles() {
  for (let col = 0; col < SIZE; col += 1) {
    const stack = [];
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      if (board[row][col] !== null) stack.push(board[row][col]);
    }
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      board[row][col] = stack.shift() ?? null;
    }
  }
}

function refillTiles() {
  const newCells = new Set();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === null) {
        board[row][col] = randomType();
        newCells.add(`${row},${col}`);
      }
    }
  }
  return newCells;
}

async function finishTurn() {
  if (gameOver) return;

  if (!hasPossibleMove()) {
    setMessage("棋盘没有可消除的走法，已自动重排。");
    shuffleBoard();
    renderBoard();
    await wait(100);
  }

  combo = 1;
  updateHud();
  locked = false;
  setMessage("继续冲分，时间越少越刺激。");
}

function shuffleBoard() {
  const values = board.flat();
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  board = Array.from({ length: SIZE }, (_, row) =>
    values.slice(row * SIZE, row * SIZE + SIZE)
  );
  let guard = 0;
  while ((findMatches().length || !hasPossibleMove()) && guard < 80) {
    board = buildBoard();
    guard += 1;
  }
}

function showHint() {
  if (locked || gameOver) return;
  const move = hasPossibleMove();
  if (!move) {
    setMessage("暂时没有可用提示，试试重排。");
    return;
  }
  renderBoard({ hint: move });
  setMessage("闪烁的两枚徽章可以交换。");
}

async function manualShuffle() {
  if (locked || gameOver) return;
  if (timeLeft <= SHUFFLE_PENALTY) {
    setMessage("剩余时间不够重排了。");
    return;
  }
  locked = true;
  timeLeft -= SHUFFLE_PENALTY;
  selected = null;
  shuffleBoard();
  renderBoard();
  updateHud();
  setMessage(`已扣 ${SHUFFLE_PENALTY} 秒重排棋盘。`);
  await wait(140);
  locked = false;
}

function startTimer() {
  window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    if (gameOver) return;
    timeLeft = Math.max(0, timeLeft - 1);
    updateHud();
    if (timeLeft === 0) {
      endGame();
    }
  }, 1000);
}

function resultCopy(result, isNewBest) {
  const rank = result?.rank ?? null;
  if (isNewBest && score > 0) {
    return {
      title: "太棒了，刷新最高分！",
      text: "这一局打出了更快的判断、更稳的协作节奏，也把五项价值观又复习了一遍。",
    };
  }

  if (result?.isPersonalBest && rank && rank <= 10) {
    return {
      title: "很棒，刷新个人最好成绩！",
      text: `你的最好成绩排在第 ${rank} 名。继续把价值观打亮，把好状态带回工作现场。`,
    };
  }

  if (rank && rank <= 10) {
    return {
      title: "挑战完成，最好成绩已保留！",
      text: `本局得分 ${score}，排行榜保留你的个人最好成绩：第 ${rank} 名。`,
    };
  }

  if (score >= 12000) {
    return {
      title: "表现很稳，价值观已点亮！",
      text: "你已经完成了一次高质量挑战。分数会刷新，价值观也会在一次次选择里更清晰。",
    };
  }

  return {
    title: "挑战完成，继续向上！",
    text: "每一次消除都是一次提醒：真正的价值观，要在面对客户、伙伴和难题时用出来。",
  };
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  locked = true;
  selected = null;
  window.clearInterval(timerId);
  const previousBest = bestScore();
  lastResult = recordScore();
  const rank = lastResult.rank;
  const isNewBest = lastResult.isPersonalBest && score > previousBest;
  const copy = resultCopy(lastResult, isNewBest);
  const totalCollected = Object.values(collected).reduce((sum, count) => sum + count, 0);
  const customerCount = collected.customer ?? 0;
  updateHud();
  renderBoard();

  resultModal.classList.add("is-open");
  resultModal.setAttribute("aria-hidden", "false");
  showResultSummary();
  resultTitle.textContent = copy.title;
  resultText.textContent = copy.text;
  resultScore.textContent = String(score);
  resultRank.textContent = rank && rank <= 10 ? `第 ${rank} 名` : "未进前 10";
  resultCustomer.textContent = `${customerCount} 枚`;
  resultValueText.textContent =
    `本局共点亮 ${totalCollected} 枚价值观徽章。价值观不是挂在墙上的口号，而是每一次面对客户、协同伙伴、解决难题时的选择标准。`;
}

function newGame() {
  window.clearInterval(timerId);
  gameStarted = true;
  startScreen.classList.add("is-hidden");
  gameShell.classList.remove("is-hidden");
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
  savePlayerName();
  board = buildBoard();
  ensurePlayableBoard();
  selected = null;
  score = 0;
  timeLeft = START_SECONDS;
  combo = 1;
  locked = false;
  gameOver = false;
  collected = Object.fromEntries(BADGES.map((badge) => [badge.id, 0]));
  resultModal.classList.remove("is-open");
  resultModal.setAttribute("aria-hidden", "true");
  renderCollections();
  renderLeaderboard();
  updateHud();
  renderBoard();
  setMessage("90 秒限时开始，尽可能消除更多徽章。");
  startTimer();
}

function startChallenge() {
  if (!updateStartNameState(true)) {
    startPlayerNameInput.focus();
    return;
  }
  setPlayerName(startPlayerNameInput.value);
  newGame();
}

setPlayerName("");
renderCollections();
renderLeaderboard();
updateHud();

startButton.addEventListener("click", startChallenge);
startPlayerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startChallenge();
});
startPlayerNameInput.addEventListener("input", () => updateStartNameState(false));
startPlayerNameInput.addEventListener("blur", () => updateStartNameState(Boolean(nameError.textContent)));
playerNameInput.addEventListener("change", savePlayerName);
playerNameInput.addEventListener("blur", savePlayerName);
newGameButton.addEventListener("click", newGame);
resultButton.addEventListener("click", newGame);
resultLeaderboardButton.addEventListener("click", showResultLeaderboard);
backToResultButton.addEventListener("click", showResultSummary);
resultRestartFromRankButton.addEventListener("click", newGame);
hintButton.addEventListener("click", showHint);
shuffleButton.addEventListener("click", manualShuffle);

document.addEventListener("keydown", (event) => {
  if (!gameStarted) return;
  if (event.key.toLowerCase() === "h") showHint();
  if (event.key.toLowerCase() === "r") newGame();
});
