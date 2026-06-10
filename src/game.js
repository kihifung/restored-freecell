const SUITS = ["C", "D", "H", "S"];
const SUIT_OFFSET = { C: 0, D: 13, H: 26, S: 39 };
const RANK_NAME = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const SUIT_NAME = { C: "梅花", D: "方塊", H: "紅心", S: "黑桃" };
const CARD_GAP = 27;
const DRAG_THRESHOLD = 6;

const board = document.getElementById("board");
const tableauEl = document.getElementById("tableau");
const statusEl = document.getElementById("status");
const toastEl = document.getElementById("toast");
const stockEl = document.getElementById("stock");
const stockCountEl = document.getElementById("stockCount");
const completedCountEl = document.getElementById("completedCount");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");

let gameNo = 1;
let suitCount = 4;
let initialState = null;
let state = null;
let selected = null;
let history = [];
let moves = 0;
let undoCount = 0;
let toastTimer = 0;
let hintTimer = 0;
let pointerDrag = null;
let suppressNextClick = false;

function suitsForMode(count) {
  if (count === 1) return ["S"];
  if (count === 2) return ["S", "H"];
  return SUITS;
}

function makeSpiderDeck(count) {
  const suits = suitsForMode(count);
  const setsPerSuit = 8 / suits.length;
  const cards = [];
  let uid = 1;

  for (let set = 0; set < setsPerSuit; set += 1) {
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank += 1) {
        const id = SUIT_OFFSET[suit] + rank;
        cards.push({
          uid: `card-${uid}`,
          id,
          suit,
          rank,
          faceUp: false,
          image: `assets/cards-png/CARD${id}.png`
        });
        uid += 1;
      }
    }
  }

  return cards;
}

function seededRandom(seed) {
  let x = seed >>> 0;
  return () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

function shuffledDeck(seed, count) {
  const deck = makeSpiderDeck(count);
  const rnd = seededRandom(seed + count * 1000);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function deal(seed, count) {
  const deck = shuffledDeck(seed, count);
  const columns = Array.from({ length: 10 }, () => []);

  for (let round = 0; round < 6; round += 1) {
    for (let column = 0; column < 10; column += 1) {
      if (round === 5 && column > 3) continue;
      columns[column].push(deck.shift());
    }
  }

  columns.forEach(column => {
    column[column.length - 1].faceUp = true;
  });

  deck.forEach(card => {
    card.faceUp = false;
  });

  return {
    columns,
    stock: deck,
    completed: []
  };
}

function cloneCard(card) {
  return { ...card };
}

function cloneState(source) {
  return {
    columns: source.columns.map(column => column.map(cloneCard)),
    stock: source.stock.map(cloneCard),
    completed: source.completed.map(run => run.map(cloneCard))
  };
}

function sameCard(a, b) {
  return Boolean(a && b && a.uid === b.uid);
}

function selectedHas(card) {
  return Boolean(selected && selected.cards.some(item => item.uid === card.uid));
}

function cardLabel(card) {
  return `${SUIT_NAME[card.suit]} ${RANK_NAME[card.rank] || card.rank}`;
}

function render() {
  clearHint();
  const suitText = suitCount === 1 ? "單一花色" : `${suitCount} 種花色`;
  statusEl.textContent = `蜘蛛紙牌 - ${suitText} - 第 ${gameNo} 局`;
  stockCountEl.textContent = String(Math.ceil(state.stock.length / 10));
  stockEl.classList.toggle("empty", state.stock.length === 0);
  stockEl.disabled = state.stock.length === 0;
  completedCountEl.textContent = String(state.completed.length);
  scoreEl.textContent = String(currentScore());
  movesEl.textContent = String(moves);
  document.querySelectorAll(".mode").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.suits) === suitCount);
  });
  renderColumns();
  checkWin();
}

function clearHint() {
  clearTimeout(hintTimer);
  document.querySelectorAll(".hint-source, .hint-target").forEach(element => {
    element.classList.remove("hint-source", "hint-target");
  });
}

function currentScore() {
  return 500 - moves - undoCount + state.completed.length * 100;
}

function renderColumns() {
  tableauEl.innerHTML = "";
  state.columns.forEach((column, columnIndex) => {
    const col = document.createElement("div");
    col.className = "column";
    col.dataset.column = columnIndex;
    col.style.height = `calc(var(--slot-h) + ${Math.max(0, column.length - 1) * CARD_GAP}px)`;

    column.forEach((card, cardIndex) => {
      col.appendChild(createCard(card, { type: "column", column: columnIndex, index: cardIndex }, cardIndex * CARD_GAP));
    });

    tableauEl.appendChild(col);
  });
}

function createCard(card, location, top) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `card${card.faceUp ? "" : " face-down"}`;
  el.draggable = false;
  el.style.backgroundImage = `url("${card.image}")`;
  el.style.top = `${top}px`;
  el.title = card.faceUp ? cardLabel(card) : "蓋牌";
  el.ariaLabel = el.title;
  el.dataset.card = card.uid;
  el.dataset.location = JSON.stringify(location);

  if (selectedHas(card)) el.classList.add("selected");

  el.addEventListener("pointerdown", event => onPointerDown(event, card, location));
  el.addEventListener("click", event => {
    event.stopPropagation();
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    onCardClick(card, location);
  });

  return el;
}

function onCardClick(card, location) {
  const movingCards = getMovableCards(location);
  if (!movingCards.length) {
    selected = null;
    show("只能移動已翻開且同花連續遞減的牌列。");
    render();
    return;
  }

  if (selected && sameCard(selected.card, card)) {
    selected = null;
    render();
    return;
  }

  if (selected) {
    const moved = tryMove(selected.cards, selected.location, normalizeTarget(location));
    selected = moved ? null : { card, cards: movingCards, location };
    render();
    return;
  }

  selected = { card, cards: movingCards, location };
  render();
}

function getMovableCards(location) {
  if (location.type !== "column") return [];
  const stack = state.columns[location.column].slice(location.index);
  if (!stack.length || stack.some(card => !card.faceUp)) return [];
  return isSameSuitSequence(stack) ? stack : [];
}

function isSameSuitSequence(cards) {
  for (let i = 1; i < cards.length; i += 1) {
    const previous = cards[i - 1];
    const current = cards[i];
    if (current.suit !== previous.suit || current.rank + 1 !== previous.rank) return false;
  }
  return true;
}

function canStackOn(card, target) {
  return target.faceUp && card.rank + 1 === target.rank;
}

function normalizeTarget(location) {
  if (location.type === "column") return { type: "column", column: location.column };
  return location;
}

function tryMove(cards, from, targetLocation) {
  if (!cards.length || !targetLocation || targetLocation.type !== "column") return false;
  return moveToColumn(cards, from, targetLocation.column);
}

function pushHistory() {
  history.push(cloneState(state));
  if (history.length > 200) history.shift();
}

function countMove() {
  moves += 1;
}

function removeCards(from, count) {
  const source = state.columns[from.column];
  const removed = source.splice(source.length - count, count);
  revealTopCard(from.column);
  return removed;
}

function revealTopCard(columnIndex) {
  const column = state.columns[columnIndex];
  const top = column[column.length - 1];
  if (top && !top.faceUp) top.faceUp = true;
}

function moveToColumn(cards, from, columnIndex) {
  if (from.type === "column" && from.column === columnIndex) return false;
  if (!isSameSuitSequence(cards)) return false;

  const targetColumn = state.columns[columnIndex];
  const target = targetColumn[targetColumn.length - 1];
  if (target && !canStackOn(cards[0], target)) return false;

  pushHistory();
  countMove();
  targetColumn.push(...removeCards(from, cards.length));
  collectCompletedRuns();
  play("124");
  return true;
}

function dealFromStock() {
  if (!state.stock.length) return;
  if (state.columns.some(column => column.length === 0)) {
    show("發牌前每一欄都必須有牌。");
    return;
  }

  pushHistory();
  countMove();
  for (let i = 0; i < 10; i += 1) {
    const card = state.stock.shift();
    card.faceUp = true;
    state.columns[i].push(card);
  }
  collectCompletedRuns();
  play("125");
  selected = null;
  render();
}

function findHintMoves() {
  const moves = [];

  state.columns.forEach((column, sourceColumn) => {
    column.forEach((card, cardIndex) => {
      const cards = getMovableCards({ type: "column", column: sourceColumn, index: cardIndex });
      if (!cards.length) return;

      state.columns.forEach((targetColumn, targetIndex) => {
        if (targetIndex === sourceColumn) return;
        const target = targetColumn[targetColumn.length - 1];
        if (!target || canStackOn(cards[0], target)) {
          moves.push({
            cards,
            from: { type: "column", column: sourceColumn, index: cardIndex },
            to: { type: "column", column: targetIndex }
          });
        }
      });
    });
  });

  return moves;
}

function showHint() {
  clearHint();

  const moves = findHintMoves();
  if (!moves.length) {
    show(state.stock.length ? "目前沒有可移動的牌，可以考慮發牌。" : "目前沒有可提示的移動。");
    return;
  }

  const hint = moves[Math.floor(Math.random() * moves.length)];
  const sourceCard = hint.cards[0];
  const targetColumn = state.columns[hint.to.column];
  const targetCard = targetColumn[targetColumn.length - 1];

  document.querySelector(`.card[data-card="${sourceCard.uid}"]`)?.classList.add("hint-source");
  const targetColumnEl = document.querySelector(`.column[data-column="${hint.to.column}"]`);
  targetColumnEl?.classList.add("hint-target");

  if (targetCard) {
    document.querySelector(`.card[data-card="${targetCard.uid}"]`)?.classList.add("hint-target");
    show(`${cardLabel(sourceCard)} 可以移到 ${cardLabel(targetCard)} 上。`);
  } else {
    show(`${cardLabel(sourceCard)} 可以移到空欄。`);
  }

  hintTimer = setTimeout(clearHint, 3400);
}

function collectCompletedRuns() {
  let changed = true;
  while (changed) {
    changed = false;
    for (let columnIndex = 0; columnIndex < state.columns.length; columnIndex += 1) {
      const column = state.columns[columnIndex];
      if (column.length < 13) continue;

      const run = column.slice(-13);
      if (isCompleteRun(run)) {
        state.completed.push(column.splice(column.length - 13, 13));
        revealTopCard(columnIndex);
        changed = true;
      }
    }
  }
}

function isCompleteRun(cards) {
  if (cards.length !== 13 || cards.some(card => !card.faceUp)) return false;
  const suit = cards[0].suit;
  for (let i = 0; i < 13; i += 1) {
    if (cards[i].suit !== suit || cards[i].rank !== 13 - i) return false;
  }
  return true;
}

function onBoardClick(event) {
  if (!selected) return;

  const target = targetFromElement(event.target);
  const moved = tryMove(selected.cards, selected.location, target);
  selected = null;
  if (!moved) show("這一步不能這樣移動。");
  render();
}

function targetFromElement(element) {
  const cardEl = element.closest(".card");
  if (cardEl) return normalizeTarget(JSON.parse(cardEl.dataset.location));

  const column = element.closest(".column");
  if (column) return { type: "column", column: Number(column.dataset.column) };

  return null;
}

function onPointerDown(event, card, location) {
  if (event.button !== 0) return;

  const cards = getMovableCards(location);
  if (!cards.length) return;

  const rect = event.currentTarget.getBoundingClientRect();
  pointerDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    card,
    cards,
    location,
    active: false,
    ghost: null
  };

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp, { once: true });
  document.addEventListener("pointercancel", cancelPointerDrag, { once: true });
}

function onPointerMove(event) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;

  const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
  if (!pointerDrag.active && distance >= DRAG_THRESHOLD) startPointerDrag(event);

  if (pointerDrag.active) {
    event.preventDefault();
    updateDragGhost(event.clientX, event.clientY);
  }
}

function startPointerDrag(event) {
  pointerDrag.active = true;
  suppressNextClick = true;
  selected = null;
  setDraggingSource(pointerDrag.cards, true);
  pointerDrag.ghost = createDragGhost(pointerDrag.cards);
  document.body.appendChild(pointerDrag.ghost);
  updateDragGhost(event.clientX, event.clientY);
}

function createDragGhost(cards) {
  const ghost = document.createElement("div");
  ghost.className = "drag-stack";
  ghost.style.height = `calc(var(--slot-h) + ${Math.max(0, cards.length - 1) * CARD_GAP}px)`;

  cards.forEach((card, index) => {
    const item = document.createElement("div");
    item.className = "card drag-card";
    item.style.backgroundImage = `url("${card.image}")`;
    item.style.top = `${index * CARD_GAP}px`;
    ghost.appendChild(item);
  });

  return ghost;
}

function updateDragGhost(x, y) {
  if (!pointerDrag?.ghost) return;
  pointerDrag.ghost.style.left = `${x - pointerDrag.offsetX}px`;
  pointerDrag.ghost.style.top = `${y - pointerDrag.offsetY}px`;
}

function onPointerUp(event) {
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointercancel", cancelPointerDrag);

  if (!pointerDrag) return;
  if (!pointerDrag.active) {
    pointerDrag = null;
    return;
  }

  const dragData = pointerDrag;
  finishDragVisuals();

  const target = dropTargetAt(event.clientX, event.clientY);
  const moved = tryMove(dragData.cards, dragData.location, target);
  if (!moved) show("這一步不能這樣移動。");
  render();
}

function cancelPointerDrag() {
  document.removeEventListener("pointermove", onPointerMove);
  finishDragVisuals();
  render();
}

function finishDragVisuals() {
  if (!pointerDrag) return;
  pointerDrag.ghost?.remove();
  setDraggingSource(pointerDrag.cards, false);
  pointerDrag = null;
}

function setDraggingSource(cards, dragging) {
  cards.forEach(card => {
    document.querySelectorAll(`.card[data-card="${card.uid}"]`).forEach(el => {
      el.classList.toggle("dragging-source", dragging);
    });
  });
}

function dropTargetAt(x, y) {
  const element = document.elementFromPoint(x, y);
  return element ? targetFromElement(element) : null;
}

function checkWin() {
  if (state.completed.length === 8) show("恭喜過關！");
}

function show(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1400);
}

function play(id) {
  const audio = new Audio(`assets/sounds/${id}.wav`);
  audio.volume = 0.22;
  audio.play().catch(() => {});
}

function randomSeed() {
  return Math.floor(Math.random() * 1000000) + 1;
}

function start(seed = gameNo, count = suitCount) {
  gameNo = seed;
  suitCount = count;
  state = deal(seed, count);
  initialState = cloneState(state);
  history = [];
  moves = 0;
  undoCount = 0;
  selected = null;
  render();
}

stockEl.addEventListener("click", dealFromStock);
board.addEventListener("click", onBoardClick);

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => start(randomSeed(), Number(button.dataset.suits)));
});

document.getElementById("deal").addEventListener("click", dealFromStock);
document.getElementById("hint").addEventListener("click", showHint);
document.getElementById("newGame").addEventListener("click", () => start(randomSeed(), suitCount));
document.getElementById("restart").addEventListener("click", () => {
  state = cloneState(initialState);
  history = [];
  selected = null;
  render();
});
document.getElementById("undo").addEventListener("click", () => {
  const previous = history.pop();
  if (!previous) return;
  state = previous;
  undoCount += 1;
  selected = null;
  render();
});

window.spiderDebug = {
  get state() {
    return cloneState(state);
  },
  get selected() {
    return selected ? { card: selected.card, cards: selected.cards, location: selected.location } : null;
  },
  get score() {
    return currentScore();
  },
  get moves() {
    return moves;
  },
  get undoCount() {
    return undoCount;
  },
  findHintMoves,
  isSameSuitSequence,
  canStackOn
};

start(randomSeed(), 4);
