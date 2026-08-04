import { createGameStorage } from './lib/clawspace-game-storage.js';

const scoreNode = document.getElementById('score');
const bestScoreNode = document.getElementById('best-score');
const globalBestScoreNode = document.getElementById('global-best-score');
const timeNode = document.getElementById('time');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const resetButton = document.getElementById('reset-button');
const statusLine = document.getElementById('status-line');
const planet = document.getElementById('planet');
const board = document.querySelector('.game-board');
const gameStorage = createGameStorage('__APP_SLUG__');

let score = 0;
let bestScore = gameStorage.getNumber('best-score', 0);
let globalBestScore = 0;
let timeLeft = 45;
let timerId = null;
let running = false;
let paused = false;

function randomPosition() {
  const boardRect = board.getBoundingClientRect();
  const size = planet.offsetWidth || 76;
  const padding = 24;
  const maxX = Math.max(padding, boardRect.width - size - padding);
  const maxY = Math.max(padding, boardRect.height - size - padding);

  return {
    x: Math.floor(Math.random() * maxX),
    y: Math.floor(Math.random() * maxY),
  };
}

function movePlanet() {
  const { x, y } = randomPosition();
  planet.style.left = `${x}px`;
  planet.style.top = `${y}px`;
}

function updateHud() {
  scoreNode.textContent = String(score);
  bestScoreNode.textContent = String(bestScore);
  globalBestScoreNode.textContent = String(globalBestScore);
  timeNode.textContent = String(timeLeft);
  pauseButton.textContent = paused ? '继续' : '暂停';
}

async function refreshRemoteScoreSummary() {
  const summary = await gameStorage.fetchRemoteSummary('best-score', 0);
  if (summary.userBest && Number.isFinite(summary.userBest.score)) {
    bestScore = Math.max(bestScore, summary.userBest.score);
  }
  if (summary.globalBest && Number.isFinite(summary.globalBest.score)) {
    globalBestScore = summary.globalBest.score;
  }
  if (summary.authenticated) {
    statusLine.textContent = '已连接平台分数，账号最高分会同步更新。';
  }
  updateHud();
}

async function finishGame() {
  running = false;
  paused = false;
  clearInterval(timerId);
  timerId = null;
  const summary = await gameStorage.syncBestScore('best-score', score, { fallback: 0 });
  bestScore = Math.max(bestScore, summary.localBest || 0, summary.userBest?.score || 0);
  globalBestScore = Math.max(globalBestScore, summary.globalBest?.score || 0);
  statusLine.textContent = `本局结束，得分 ${score}。${summary.authenticated ? '账号最高分和全站最高分已同步。' : '未登录时仍会保留本地最高分。'}`;
  updateHud();
  startButton.textContent = '再玩一次';
}

function startGame() {
  score = 0;
  timeLeft = 45;
  running = true;
  paused = false;
  statusLine.textContent = '点击星球得分，45 秒后自动结算。';
  updateHud();
  movePlanet();
  startButton.textContent = '游戏进行中';

  clearInterval(timerId);
  timerId = window.setInterval(() => {
    if (paused) return;
    timeLeft -= 1;
    updateHud();

    if (timeLeft <= 0) {
      finishGame();
    }
  }, 1000);
}

planet.addEventListener('click', () => {
  if (!running || paused) return;
  score += 1;
  statusLine.textContent = `命中一次，当前得分 ${score}。`;
  updateHud();
  movePlanet();
});

startButton.addEventListener('click', () => {
  startGame();
});

pauseButton.addEventListener('click', () => {
  if (!running) return;
  paused = !paused;
  statusLine.textContent = paused ? '游戏已暂停。' : '继续游戏，冲刺更高分。';
  updateHud();
});

resetButton.addEventListener('click', () => {
  if (running || score > 0) {
    finishGame();
  }
  score = 0;
  timeLeft = 45;
  paused = false;
  updateHud();
  movePlanet();
  startButton.textContent = '开始游戏';
  statusLine.textContent = '已重置。准备好后重新开始。';
});

window.addEventListener('resize', movePlanet);

window.render_game_to_text = function renderGameToText() {
  return [
    `score=${score}`,
    `best=${bestScore}`,
    `global=${globalBestScore}`,
    `timeLeft=${timeLeft}`,
    `running=${running}`,
    `paused=${paused}`,
  ].join(' | ');
};

window.advanceTime = function advanceTime(ms = 1000) {
  const stepCount = Math.max(1, Math.floor(ms / 1000));
  for (let index = 0; index < stepCount; index += 1) {
    if (!running || paused || timeLeft <= 0) break;
    timeLeft -= 1;
  }
  if (running && timeLeft <= 0) {
    finishGame();
  }
  updateHud();
  return window.render_game_to_text();
};

updateHud();
movePlanet();
refreshRemoteScoreSummary();
