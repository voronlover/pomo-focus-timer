const MODES = {
  pomodoro: { label: 'Pomodoro', message: 'Time to focus!' },
  short: { label: 'Short Break', message: 'Take a short break.' },
  long: { label: 'Long Break', message: 'Take a long break.' }
};

const DEFAULTS = {
  pomodoro: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoBreaks: false,
  notifications: false,
  tasks: []
};

let settings = loadSettings();
let mode = 'pomodoro';
let secondsLeft = settings.pomodoro * 60;
let timerId = null;
let round = Number(localStorage.getItem('pomo.round') || '1');
let completedPomodoros = Number(localStorage.getItem('pomo.completed') || '0');

const $ = (id) => document.getElementById(id);
const timeDisplay = $('timeDisplay');
const startBtn = $('startBtn');
const resetBtn = $('resetBtn');
const roundText = $('roundText');
const settingsDialog = $('settingsDialog');
const taskList = $('taskList');
const taskForm = $('taskForm');
const taskInput = $('taskInput');
const toast = $('toast');

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('pomo.settings') || '{}') };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

function saveSettingsToStorage() {
  localStorage.setItem('pomo.settings', JSON.stringify(settings));
}

function modeMinutes(currentMode = mode) {
  return Number(settings[currentMode]) || DEFAULTS[currentMode];
}

function setMode(nextMode, reset = true) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  document.title = `${format(secondsLeft)} - ${MODES[mode].label}`;

  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  if (reset) {
    stopTimer();
    secondsLeft = modeMinutes(mode) * 60;
  }
  render();
}

function format(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function render() {
  timeDisplay.textContent = format(secondsLeft);
  document.title = `${format(secondsLeft)} - ${MODES[mode].label}`;
  startBtn.textContent = timerId ? 'PAUSE' : 'START';
  roundText.textContent = `#${round} ${MODES[mode].message}`;
  renderTasks();
}

function startTimer() {
  if (timerId) {
    stopTimer();
    render();
    return;
  }

  timerId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      finishSession();
      return;
    }
    render();
  }, 1000);
  render();
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function resetTimer() {
  stopTimer();
  secondsLeft = modeMinutes(mode) * 60;
  render();
}

async function finishSession() {
  stopTimer();
  secondsLeft = 0;
  render();
  playDing();

  if (mode === 'pomodoro') {
    completedPomodoros += 1;
    localStorage.setItem('pomo.completed', String(completedPomodoros));
    const nextMode = completedPomodoros % settings.longEvery === 0 ? 'long' : 'short';
    showToast(nextMode === 'long' ? 'Pomodoro complete. Long break!' : 'Pomodoro complete. Short break!');
    round += 1;
    localStorage.setItem('pomo.round', String(round));
    setMode(nextMode);
    if (settings.autoBreaks) startTimer();
  } else {
    showToast('Break complete. Back to focus.');
    setMode('pomodoro');
  }

  notify(`${MODES[mode].label} ready`, MODES[mode].message);
}

function playDing() {
  try {
    const audio = $('ding');
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (_) {}
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

async function maybeRequestNotifications() {
  if (!('Notification' in window)) {
    settings.notifications = false;
    showToast('Notifications are not supported here.');
    return;
  }
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    settings.notifications = result === 'granted';
  } else {
    settings.notifications = Notification.permission === 'granted';
  }
}

function notify(title, body) {
  if (settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function renderTasks() {
  taskList.innerHTML = '';
  if (!settings.tasks.length) {
    const empty = document.createElement('li');
    empty.className = 'task';
    empty.innerHTML = '<span></span><span class="task-title">No tasks yet. Add one above.</span><span></span>';
    taskList.appendChild(empty);
    return;
  }

  settings.tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task${task.done ? ' done' : ''}`;
    li.dataset.id = task.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `Mark ${task.title} done`);
    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      saveSettingsToStorage();
      renderTasks();
    });

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const del = document.createElement('button');
    del.className = 'delete-task';
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('aria-label', `Delete ${task.title}`);
    del.addEventListener('click', () => {
      settings.tasks = settings.tasks.filter((item) => item.id !== task.id);
      saveSettingsToStorage();
      renderTasks();
    });

    li.append(checkbox, title, del);
    taskList.appendChild(li);
  });
}

function openSettings() {
  $('pomodoroMinutes').value = settings.pomodoro;
  $('shortMinutes').value = settings.short;
  $('longMinutes').value = settings.long;
  $('longEvery').value = settings.longEvery;
  $('autoBreaks').checked = settings.autoBreaks;
  $('notifications').checked = settings.notifications;
  settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();
  settings.pomodoro = clamp($('pomodoroMinutes').value, 1, 180);
  settings.short = clamp($('shortMinutes').value, 1, 60);
  settings.long = clamp($('longMinutes').value, 1, 90);
  settings.longEvery = clamp($('longEvery').value, 2, 12);
  settings.autoBreaks = $('autoBreaks').checked;
  settings.notifications = $('notifications').checked;
  if (settings.notifications) await maybeRequestNotifications();
  saveSettingsToStorage();
  settingsDialog.close();
  resetTimer();
  showToast('Settings saved.');
}

function clamp(value, min, max) {
  const number = Math.round(Number(value));
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

startBtn.addEventListener('click', startTimer);
resetBtn.addEventListener('click', resetTimer);
$('settingsBtn').addEventListener('click', openSettings);
$('saveSettings').addEventListener('click', saveSettings);
$('reportBtn').addEventListener('click', () => {
  showToast(`${completedPomodoros} pomodoros completed.`);
});
$('clearDoneBtn').addEventListener('click', () => {
  settings.tasks = settings.tasks.filter((task) => !task.done);
  saveSettingsToStorage();
  renderTasks();
});

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;
  settings.tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, done: false });
  taskInput.value = '';
  saveSettingsToStorage();
  renderTasks();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    startTimer();
  }
});

setMode('pomodoro');
render();
