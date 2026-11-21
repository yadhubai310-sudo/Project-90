import { getAll, getByIndex, addRecord, newId } from './db.js';
import { seedIfEmpty } from './seed.js';
import {
  todayIST, istWeekday, toISTDateString, formatISTDisplay,
  addDaysToDateString, getWeekStartIST,
} from './date-utils.js';

const checklistEl = document.getElementById('checklist');
const dateEl = document.getElementById('today-date');
const progressPctEl = document.getElementById('progress-pct');
const slotsDoneCountEl = document.getElementById('slots-done-count');

const SLOT_LABELS = { MORNING: 'AM', NIGHT: 'PM', ANYTIME: 'Any' };

function isScheduledOn(slot, dateStr) {
  if (slot.activeFrom) {
    const fromDate = toISTDateString(new Date(slot.activeFrom));
    if (dateStr < fromDate) return false;
  }
  if (slot.activeTo) {
    const toDate = toISTDateString(new Date(slot.activeTo));
    if (dateStr > toDate) return false;
  }
  if (slot.frequencyType === 'WEEKDAYS') {
    return (slot.frequencyDays || []).includes(istWeekday(dateStr));
  }
  // DAILY and X_PER_WEEK slots are shown every day they're active.
  // X_PER_WEEK's weekly quota is evaluated separately, below.
  return true;
}

// Counts DISTINCT IST calendar days in the current week where this slot's
// per-day target was met — not raw check-in rows. Tapping water 8 times in
// one day for an X_PER_WEEK habit would otherwise wrongly count as several
// "done days" instead of one.
function getWeeklyDoneDayCount(slot, allCheckIns, today) {
  const weekStart = getWeekStartIST(today);
  const weekEnd = addDaysToDateString(weekStart, 6);

  const countsByDate = new Map();
  for (const c of allCheckIns) {
    if (c.slotId !== slot.id || c.deleted) continue;
    if (c.date < weekStart || c.date > weekEnd) continue;
    countsByDate.set(c.date, (countsByDate.get(c.date) || 0) + 1);
  }

  let doneDays = 0;
  for (const count of countsByDate.values()) {
    if (count >= slot.target) doneDays += 1;
  }
  return doneDays;
}

async function loadData() {
  const [habits, slots, checkIns] = await Promise.all([
    getAll('habits'), getAll('habitSlots'), getAll('checkIns'),
  ]);
  return { habits, slots, checkIns };
}

function groupByCategory(habits) {
  const map = new Map();
  for (const h of habits) {
    if (h.archived) continue;
    if (!map.has(h.category)) map.set(h.category, []);
    map.get(h.category).push(h);
  }
  for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return map;
}

async function render() {
  const today = todayIST();
  dateEl.textContent = formatISTDisplay(new Date());

  const { habits, slots, checkIns } = await loadData();

  const slotsByHabit = new Map();
  for (const s of slots) {
    if (!slotsByHabit.has(s.habitId)) slotsByHabit.set(s.habitId, []);
    slotsByHabit.get(s.habitId).push(s);
  }

  const checkInsBySlotToday = new Map();
  for (const c of checkIns) {
    if (c.date !== today || c.deleted) continue;
    if (!checkInsBySlotToday.has(c.slotId)) checkInsBySlotToday.set(c.slotId, []);
    checkInsBySlotToday.get(c.slotId).push(c);
  }

  const grouped = groupByCategory(habits);
  checklistEl.innerHTML = '';

  let scheduledSlotCount = 0;
  let doneSlotCount = 0;

  for (const [category, habitList] of grouped) {
    const block = document.createElement('div');
    block.className = 'category-block';
    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = category;
    block.appendChild(title);

    for (const habit of habitList) {
      const habitSlots = (slotsByHabit.get(habit.id) || []).filter((s) => isScheduledOn(s, today));
      if (habitSlots.length === 0) continue;

      const card = document.createElement('div');
      card.className = 'habit-card';

      const nameEl = document.createElement('div');
      nameEl.className = 'habit-name';
      nameEl.textContent = habit.name;
      card.appendChild(nameEl);

      const slotRow = document.createElement('div');
      slotRow.className = 'slot-row';

      for (const slot of habitSlots) {
        scheduledSlotCount += 1;
        const todayCount = (checkInsBySlotToday.get(slot.id) || []).length;

        const btn = document.createElement('button');
        btn.className = 'slot-btn';

        if (slot.frequencyType === 'X_PER_WEEK') {
          const weeklyTarget = slot.frequencyCount || 1;
          const doneDays = getWeeklyDoneDayCount(slot, checkIns, today);
          const quotaMet = doneDays >= weeklyTarget;
          if (quotaMet) { btn.classList.add('done'); doneSlotCount += 1; }
          else if (todayCount > 0) btn.classList.add('partial');
          btn.textContent = `${SLOT_LABELS[slot.slotType]} ${doneDays}/${weeklyTarget} wk`;
        } else {
          const met = todayCount >= slot.target;
          if (met) { btn.classList.add('done'); doneSlotCount += 1; }
          else if (todayCount > 0) btn.classList.add('partial');
          btn.textContent = slot.target > 1
            ? `${SLOT_LABELS[slot.slotType]} ${todayCount}/${slot.target}`
            : SLOT_LABELS[slot.slotType];
        }

        btn.addEventListener('click', () => onSlotTap(slot, today));
        slotRow.appendChild(btn);
      }

      card.appendChild(slotRow);
      block.appendChild(card);
    }
    checklistEl.appendChild(block);
  }

  const pct = scheduledSlotCount === 0 ? 0 : Math.round((doneSlotCount / scheduledSlotCount) * 100);
  progressPctEl.textContent = `${pct}%`;
  slotsDoneCountEl.textContent = `${doneSlotCount} / ${scheduledSlotCount} slots done`;
}

// Tapping always acts on TODAY's check-ins for this slot, using the slot's
// own per-day target (slot.target) — never a weekly number. This is what
// keeps a weekly habit's tap behaviour identical to a daily one: each tap
// adds or removes one check-in for today. The weekly quota in render() is
// just a read of how many days already met that per-day target.
async function onSlotTap(slot, today) {
  const existing = await getByIndex('checkIns', 'slotId_date', [slot.id, today]);
  const active = existing.filter((c) => !c.deleted).sort((a, b) => a.timestamp - b.timestamp);

  if (active.length >= slot.target) {
    // Already at or past today's target: undo only the single most recent
    // check-in, so Water 8/8 -> tap -> 7/8, not a reset to 0/8.
    const last = active[active.length - 1];
    last.deleted = true;
    last.updatedAt = Date.now();
    await addRecord('checkIns', last);
  } else {
    await addRecord('checkIns', {
      id: newId(), habitId: slot.habitId, slotId: slot.id, date: today,
      timestamp: Date.now(), createdAt: Date.now(),
      addedLater: false, deleted: false, updatedAt: Date.now(),
    });
  }
  render();
}

function setupNav() {
  const buttons = document.querySelectorAll('.nav-btn');
  const todayView = document.getElementById('view-today');
  const placeholderView = document.getElementById('view-placeholder');
  const placeholderText = placeholderView.querySelector('.placeholder-text');
  const STAGE_MESSAGES = {
    calendar: 'Calendar view is not implemented yet — planned for Stage 3.',
    stats: 'Statistics are not implemented yet — planned for Stage 3.',
    goals: 'Goals are not implemented yet — planned for Stage 3.',
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      if (view === 'today') {
        todayView.hidden = false;
        placeholderView.hidden = true;
      } else {
        todayView.hidden = true;
        placeholderView.hidden = false;
        placeholderText.textContent = STAGE_MESSAGES[view] || 'Coming soon.';
      }
    });
  });
}

function showUpdateBanner(waitingWorker) {
  const banner = document.getElementById('update-banner');
  const btn = document.getElementById('update-reload-btn');
  banner.hidden = false;
  btn.onclick = () => waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');

    // Case 1: an update was already downloaded and is waiting from a
    // previous visit (e.g. the tab was closed before you tapped Refresh).
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(reg.waiting);
    }

    // Case 2: a new update is found and finishes installing during this
    // session. The banner only appears when there's already an active
    // controller — i.e. this is a genuine update, not the very first install.
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newWorker);
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (err) {
    console.error('Service worker registration failed:', err);
  }
}

async function init() {
  setupNav();
  await seedIfEmpty();
  await render();
  await registerServiceWorker();
}

init();
