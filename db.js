/* =============================================================
   Слой данных.
   • Если Firebase настроен — общая база в реальном времени (все
     пользователи по одной ссылке видят изменения сразу; requirement
     «актуализировать каждые ~10 минут» покрывается онлайн-синхроном).
   • Если нет — локальный режим (localStorage), синхронизация между
     вкладками одного браузера + метка режима в интерфейсе.
   Единый API: DB.init(), DB.subscribe(cb), DB.onTick(cb),
                DB.add(p), DB.update(id,patch), DB.remove(id), DB.mode
   ============================================================= */
(function () {
  const LS_KEY = "scout_projects_v1";
  const COLLECTION = "projects";

  let mode = "local";            // 'cloud' | 'local'
  let fs = null;                 // firestore instance
  let items = [];                // текущий список
  const subs = [];               // подписчики на данные
  const ticks = [];              // подписчики на «тик» (обновление меток NEW/времени)

  function configured() {
    const c = window.FIREBASE_CONFIG || {};
    return c.apiKey && !String(c.apiKey).startsWith("PASTE_") &&
           c.projectId && !String(c.projectId).startsWith("PASTE_");
  }

  function init() {
    if (configured() && window.firebase) {
      try {
        firebase.initializeApp(window.FIREBASE_CONFIG);
        fs = firebase.firestore();
        mode = "cloud";
        fs.collection(COLLECTION).onSnapshot((snap) => {
          items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          notify();
        }, (err) => {
          console.error("Firestore error, откат в локальный режим:", err);
          fallbackLocal();
        });
      } catch (e) {
        console.error("Firebase init failed:", e);
        fallbackLocal();
      }
    } else {
      fallbackLocal();
    }

    // общий тикер: обновляет метки NEW и относительное время каждые 60 c
    setInterval(() => ticks.forEach(fn => fn()), 60 * 1000);
    // мягкая переотрисовка списка каждые 60 c (на случай local-режима)
    setInterval(() => notify(), 60 * 1000);
    DB.mode = mode;
    return mode;
  }

  function fallbackLocal() {
    mode = "local";
    DB.mode = "local";
    loadLocal();
    window.addEventListener("storage", (e) => {
      if (e.key === LS_KEY) { loadLocal(); notify(); }
    });
  }

  function loadLocal() {
    try { items = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { items = []; }
  }
  function persistLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }

  function notify() { subs.forEach(fn => fn(items.slice())); }

  function subscribe(cb) { subs.push(cb); cb(items.slice()); }
  function onTick(cb)   { ticks.push(cb); }

  async function add(p) {
    const now = Date.now();
    const rec = { ...p, createdAt: now, updatedAt: now };
    if (mode === "cloud") {
      const ref = fs.collection(COLLECTION).doc();
      await ref.set(rec);
      return ref.id;
    } else {
      rec.id = uid();
      items.push(rec); persistLocal(); notify();
      return rec.id;
    }
  }

  async function update(id, patch) {
    const data = { ...patch, updatedAt: Date.now() };
    if (mode === "cloud") {
      await fs.collection(COLLECTION).doc(id).update(data);
    } else {
      const i = items.findIndex(x => x.id === id);
      if (i >= 0) { items[i] = { ...items[i], ...data }; persistLocal(); notify(); }
    }
  }

  async function remove(id) {
    if (mode === "cloud") {
      await fs.collection(COLLECTION).doc(id).delete();
    } else {
      items = items.filter(x => x.id !== id); persistLocal(); notify();
    }
  }

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
           (Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  const DB = { init, subscribe, onTick, add, update, remove, mode };
  window.DB = DB;
})();
