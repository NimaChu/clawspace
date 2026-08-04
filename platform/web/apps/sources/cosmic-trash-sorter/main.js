// 游戏变量
let score = 0;
let timeLeft = 60;
let lives = 3;
let timerId = null;
let running = false;
let currentCategory = 'plastic';
let trashItems = [];

// DOM元素
const scoreNode = document.getElementById('score');
const timeNode = document.getElementById('time');
const livesNode = document.getElementById('lives');
const startButton = document.getElementById('start-button');
const resetButton = document.getElementById('reset-button');
const spaceship = document.getElementById('spaceship');
const trashContainer = document.getElementById('trash-container');
const currentCategoryNode = document.getElementById('current-category');
const collectEffect = document.getElementById('collect-effect');
const categoryElements = document.querySelectorAll('.category');

// 初始化飞船位置
spaceship.style.left = '50%';
spaceship.style.top = '50%';

// 随机生成垃圾
function createTrash() {
  if (!running) return;

  const types = ['plastic', 'metal', 'organic', 'toxic'];
  const emojis = {
    'plastic': '🥤',
    'metal': '🔧',
    'organic': '🍎',
    'toxic': '☢️'
  };

  const type = types[Math.floor(Math.random() * types.length)];
  const trashItem = document.createElement('div');
  trashItem.className = `trash-item ${type}-trash`;
  trashItem.innerHTML = emojis[type];

  const boardRect = trashContainer.parentElement.getBoundingClientRect();
  const x = Math.random() * (boardRect.width - 50);
  const y = Math.random() * (boardRect.height - 50);

  trashItem.style.left = `${x}px`;
  trashItem.style.top = `${y}px`;
  trashItem.dataset.type = type;

  trashItem.addEventListener('click', () => handleTrashClick(trashItem, type));

  trashContainer.appendChild(trashItem);
  trashItems.push(trashItem);

  // 随机时间后生成下一个垃圾
  setTimeout(createTrash, 1000 + Math.random() * 2000);
}

// 处理垃圾点击
function handleTrashClick(trashElement, type) {
  if (!running) return;

  const isCorrect = type === currentCategory;

  if (isCorrect) {
    // 正确分类
    score += 10;
    showCollectEffect('+10', trashElement);
  } else {
    // 错误分类
    lives--;
    showCollectEffect('-1 LIFE', trashElement, '#ef4444');
  }

  // 更新UI
  updateHud();

  // 移除垃圾
  trashElement.remove();
  trashItems = trashItems.filter(item => item !== trashElement);

  // 检查游戏结束
  if (lives <= 0) {
    endGame();
  } else if (isCorrect) {
    // 更改分类目标
    changeCategoryRandomly();
  }
}

// 显示收集效果
function showCollectEffect(text, element, color = '#4ade80') {
  const rect = element.getBoundingClientRect();
  const boardRect = trashContainer.parentElement.getBoundingClientRect();

  collectEffect.textContent = text;
  collectEffect.style.color = color;
  collectEffect.style.left = `${rect.left - boardRect.left + 20}px`;
  collectEffect.style.top = `${rect.top - boardRect.top}px`;
  collectEffect.style.opacity = '1';

  // 重置动画
  collectEffect.style.animation = 'none';
  setTimeout(() => {
    collectEffect.style.animation = 'floatUp 1s forwards';
  }, 10);
}

// 随机更改分类目标
function changeCategoryRandomly() {
  const types = ['plastic', 'metal', 'organic', 'toxic'];
  let newCategory;
  do {
    newCategory = types[Math.floor(Math.random() * types.length)];
  } while (newCategory === currentCategory);

  setCurrentCategory(newCategory);
}

// 设置当前分类
function setCurrentCategory(category) {
  currentCategory = category;
  currentCategoryNode.textContent = getCategoryName(category);

  // 更新UI
  categoryElements.forEach(el => {
    if (el.dataset.type === category) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// 获取分类名称
function getCategoryName(type) {
  const names = {
    'plastic': '塑料',
    'metal': '金属',
    'organic': '有机物',
    'toxic': '有害物质'
  };
  return names[type] || type;
}

// 更新HUD显示
function updateHud() {
  scoreNode.textContent = String(score);
  timeNode.textContent = String(timeLeft);
  livesNode.textContent = String(lives);
}

// 开始游戏
function startGame() {
  if (running) return;

  // 重置游戏状态
  score = 0;
  timeLeft = 60;
  lives = 3;
  running = true;
  trashItems = [];

  // 清空现有垃圾
  trashContainer.innerHTML = '';

  // 更新UI
  updateHud();
  setCurrentCategory('plastic');
  startButton.textContent = '游戏进行中';

  // 开始倒计时
  clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft--;
    updateHud();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  // 开始生成垃圾
  createTrash();
}

// 结束游戏
function endGame() {
  running = false;
  clearInterval(timerId);
  startButton.textContent = lives > 0 ? '时间到!' : '游戏结束!';
  setTimeout(() => {
    startButton.textContent = '再玩一次';
  }, 2000);
}

// 重置游戏
function resetGame() {
  clearInterval(timerId);
  running = false;

  score = 0;
  timeLeft = 60;
  lives = 3;
  currentCategory = 'plastic';

  updateHud();
  setCurrentCategory('plastic');
  trashContainer.innerHTML = '';
  trashItems = [];

  startButton.textContent = '开始游戏';
}

// 跟随鼠标移动飞船
document.addEventListener('mousemove', (e) => {
  if (!running) return;

  const boardRect = trashContainer.parentElement.getBoundingClientRect();
  const x = e.clientX - boardRect.left - 30; // 减去飞船一半的宽度
  const y = e.clientY - boardRect.top - 30;  // 减去飞船一半的高度

  // 限制飞船在游戏区域内
  const clampedX = Math.max(0, Math.min(boardRect.width - 60, x));
  const clampedY = Math.max(0, Math.min(boardRect.height - 60, y));

  spaceship.style.left = `${clampedX}px`;
  spaceship.style.top = `${clampedY}px`;
});

// 点击分类按钮
categoryElements.forEach(element => {
  element.addEventListener('click', () => {
    if (!running) return;
    const type = element.dataset.type;
    setCurrentCategory(type);
  });
});

// 按钮事件监听
startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', resetGame);

// 初始化HUD
updateHud();