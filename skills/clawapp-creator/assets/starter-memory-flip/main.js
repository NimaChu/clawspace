import { createGameStorage } from './lib/clawspace-game-storage.js';

const board = document.getElementById('board');
const pairsNode = document.getElementById('pairs');
const movesNode = document.getElementById('moves');
const bestMovesNode = document.getElementById('best-moves');
const startButton = document.getElementById('start-button');
const resetButton = document.getElementById('reset-button');
const gameStorage = createGameStorage('__APP_SLUG__');

const symbols = ['A', 'B', 'C', 'D', 'E', 'F'];
let cards = [];
let flipped = [];
let matchedPairs = 0;
let moves = 0;
let locked = false;
let bestMoves = gameStorage.getNumber('best-moves', 0);

function shuffle(list) {
  return [...list]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function updateHud() {
  pairsNode.textContent = String(matchedPairs);
  movesNode.textContent = String(moves);
  bestMovesNode.textContent = bestMoves > 0 ? String(bestMoves) : '--';
}

function createDeck() {
  const deck = shuffle([...symbols, ...symbols]).map((symbol, index) => ({
    id: `${symbol}-${index}`,
    symbol,
    matched: false,
  }));
  return deck;
}

function renderBoard() {
  board.innerHTML = '';
  cards.forEach((card) => {
    const button = document.createElement('button');
    button.className = 'card';
    button.dataset.cardId = card.id;
    button.dataset.symbol = card.symbol;
    button.innerHTML = `
      <span class="card-face card-front">?</span>
      <span class="card-face card-back">${card.symbol}</span>
    `;
    button.addEventListener('click', () => revealCard(card.id, button));
    board.appendChild(button);
  });
}

function resetGame() {
  cards = createDeck();
  flipped = [];
  matchedPairs = 0;
  moves = 0;
  locked = false;
  updateHud();
  renderBoard();
}

function revealCard(cardId, button) {
  if (locked || flipped.includes(cardId) || button.classList.contains('matched')) return;
  button.classList.add('revealed');
  flipped.push(cardId);

  if (flipped.length < 2) return;

  moves += 1;
  updateHud();
  locked = true;

  const [firstId, secondId] = flipped;
  const firstCard = cards.find((card) => card.id === firstId);
  const secondCard = cards.find((card) => card.id === secondId);
  const buttons = Array.from(board.querySelectorAll('.card'));
  const firstButton = buttons.find((item) => item.dataset.cardId === firstId);
  const secondButton = buttons.find((item) => item.dataset.cardId === secondId);

  if (firstCard && secondCard && firstCard.symbol === secondCard.symbol) {
    matchedPairs += 1;
    firstButton?.classList.add('matched');
    secondButton?.classList.add('matched');
    flipped = [];
    locked = false;
    if (matchedPairs === symbols.length) {
      bestMoves = gameStorage.updateBest('best-moves', moves, { mode: 'min', fallback: 0 });
    }
    updateHud();
    return;
  }

  window.setTimeout(() => {
    firstButton?.classList.remove('revealed');
    secondButton?.classList.remove('revealed');
    flipped = [];
    locked = false;
  }, 700);
}

startButton.addEventListener('click', resetGame);
resetButton.addEventListener('click', resetGame);

resetGame();
