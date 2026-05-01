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
let startPresses = Number(localStorage.getItem('pomo.startPresses') || '0');
let trackingLabel = 'this browser';
let theme = localStorage.getItem('pomo.theme') || 'light';
let sessionSeed = localStorage.getItem('pomo.seed') || String(Math.floor(Math.random() * 9000000000) + 1000000000);
localStorage.setItem('pomo.seed', sessionSeed);

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
  $('pressCount').textContent = startPresses.toLocaleString();
  $('completedCount').textContent = completedPomodoros.toLocaleString();
  $('ipLabel').textContent = trackingLabel;
  $('seedText').textContent = `SEED: ${sessionSeed}`;
  $('themeBtn').textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
  renderTasks();
}

function startTimer() {
  if (timerId) {
    stopTimer();
    render();
    return;
  }

  startPresses += 1;
  localStorage.setItem('pomo.startPresses', String(startPresses));
  playStartChime();

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
  playAnimeInspiredJingle();
}

function playStartChime() {
  playToneSequence([
    [659.25, 0.045, 0.045],
    [987.77, 0.06, 0.055]
  ], 0.055, 'triangle');
}

function playAnimeInspiredJingle() {
  // Original short "power-up" jingle. It is anime-inspired, not copied from Dragon Ball or any copyrighted theme.
  playToneSequence([
    [392.00, 0.10, 0.08],
    [493.88, 0.10, 0.08],
    [587.33, 0.12, 0.08],
    [783.99, 0.18, 0.10],
    [987.77, 0.24, 0.12],
    [1174.66, 0.32, 0.14]
  ], 0.16, 'sawtooth');
}

function playToneSequence(notes, volume = 0.12, wave = 'sine') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    let when = ctx.currentTime + 0.02;
    notes.forEach(([frequency, duration, gap]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(frequency, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + duration + 0.04);
      when += duration + gap;
    });
    setTimeout(() => ctx.close().catch(() => {}), Math.ceil((when - ctx.currentTime + 0.5) * 1000));
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

function applyTheme(nextTheme = theme) {
  theme = nextTheme === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('pomo.theme', theme);
  if ($('themeBtn')) $('themeBtn').textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
}

function toggleTheme() {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
  showToast(`${theme.toUpperCase()} MODE ENABLED`);
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

startBtn.addEventListener('click', startTimer);
resetBtn.addEventListener('click', resetTimer);
$('themeBtn').addEventListener('click', toggleTheme);
$('settingsBtn').addEventListener('click', openSettings);
$('saveSettings').addEventListener('click', saveSettings);
$('reportBtn').addEventListener('click', () => {
  showToast(`${startPresses} starts, ${completedPomodoros} completed on ${trackingLabel}.`);
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

async function detectTrackingScope() {
  // GitHub Pages is static: it cannot count by IP globally without a backend/database.
  // This labels the current public IP when available, but stores counts locally in this browser.
  try {
    const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!response.ok) throw new Error('IP lookup failed');
    const data = await response.json();
    if (data.ip) trackingLabel = `browser @ ${data.ip}`;
  } catch (_) {
    trackingLabel = 'this browser';
  }
  render();
}

applyTheme(theme);
setMode('pomodoro');
detectTrackingScope();
render();
