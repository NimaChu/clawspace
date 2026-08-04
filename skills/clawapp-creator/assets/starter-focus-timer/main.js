const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const resetButton = document.getElementById('reset-button');
const taskInput = document.getElementById('task-input');
const minutesNode = document.getElementById('minutes');
const statusNode = document.getElementById('status');
const completedNode = document.getElementById('completed');
const currentTaskNode = document.getElementById('current-task');

let remaining = 25 * 60;
let timerId = null;
let completed = 0;

function render() {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  minutesNode.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  currentTaskNode.textContent = taskInput.value.trim() || '未填写';
  completedNode.textContent = String(completed);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function finishSession() {
  stopTimer();
  completed += 1;
  statusNode.textContent = '本轮完成';
  remaining = 25 * 60;
  render();
}

function startTimer() {
  stopTimer();
  statusNode.textContent = '专注中';
  timerId = window.setInterval(() => {
    remaining -= 1;
    render();
    if (remaining <= 0) {
      finishSession();
    }
  }, 1000);
}

startButton.addEventListener('click', startTimer);
pauseButton.addEventListener('click', () => {
  stopTimer();
  statusNode.textContent = '已暂停';
});
resetButton.addEventListener('click', () => {
  stopTimer();
  remaining = 25 * 60;
  statusNode.textContent = '准备开始';
  render();
});
taskInput.addEventListener('input', render);

render();
