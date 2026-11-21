// Schema is at version 1. If a future stage needs new stores or indexes,
// DB_VERSION will be incremented together with an onupgradeneeded block
// that only ADDS what's missing — existing stores and their data are
// never dropped or recreated by a version bump.
const DB_NAME = 'project90';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('habits')) {
        const habits = db.createObjectStore('habits', { keyPath: 'id' });
        habits.createIndex('archived', 'archived');
      }
      if (!db.objectStoreNames.contains('habitSlots')) {
        const slots = db.createObjectStore('habitSlots', { keyPath: 'id' });
        slots.createIndex('habitId', 'habitId');
      }
      if (!db.objectStoreNames.contains('checkIns')) {
        const checkIns = db.createObjectStore('checkIns', { keyPath: 'id' });
        checkIns.createIndex('slotId', 'slotId');
        checkIns.createIndex('date', 'date');
        checkIns.createIndex('slotId_date', ['slotId', 'date']);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDB() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

function tx(storeName, mode) {
  return getDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}
function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addRecord(storeName, record) {
  const store = await tx(storeName, 'readwrite');
  await promisify(store.put(record));
  return record;
}

export async function getAll(storeName) {
  const store = await tx(storeName, 'readonly');
  return promisify(store.getAll());
}

export async function getByIndex(storeName, indexName, value) {
  const store = await tx(storeName, 'readonly');
  return promisify(store.index(indexName).getAll(value));
}

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
