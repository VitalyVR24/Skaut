/* =============================================================
   СКАУТ — конфигурация
   Здесь три вещи, которые можно править под себя:
   1) FIREBASE_CONFIG — подключение общей базы (см. README)
   2) NICHE_BENCHMARKS — ориентиры по нишам (доход/рост/конкуренция)
   3) QUALIFICATIONS — статусы квалификации проекта
   ============================================================= */

/* ---------- 1. Firebase (общая база для нескольких пользователей) ----------
   Пока стоят "PASTE_...", приложение работает в ЛОКАЛЬНОМ режиме
   (данные только на этом устройстве). Как включить общую базу — в README.md. */
window.FIREBASE_CONFIG = {
  apiKey:            "PASTE_API_KEY",
  authDomain:        "PASTE_AUTH_DOMAIN",
  projectId:         "PASTE_PROJECT_ID",
  storageBucket:     "PASTE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_SENDER_ID",
  appId:             "PASTE_APP_ID"
};

/* ---------- 2. Ориентиры по нишам ----------
   Это КАЛИБРОВОЧНЫЕ значения (осень 2025 → 2026, по данным Sensor Tower /
   GameRefinery / Udonis). Правьте под свой опыт и данные — рейтинг сразу
   пересчитается.
     growth        — насколько ниша сейчас растёт (0–100)
     revenueIndex  — потенциал дохода / глубина монетизации (0–100)
     competition   — насыщенность рынка, выше = сложнее пробиться (0–100)
     benchRPD      — ориентир RPD (доход в день) для среднего масштабируемого тайтла, $
     benchRev30d   — ориентир дохода за 30 дней для среднего тайтла, $
*/
window.NICHE_BENCHMARKS = {
  "Hybrid-casual": { growth: 92, revenueIndex: 62, competition: 58, benchRPD: 800,  benchRev30d: 25000,  note: "Самый горячий рост IAP (+37% YoY). Гибридная монетизация IAA+IAP." },
  "Action":        { growth: 90, revenueIndex: 70, competition: 66, benchRPD: 1200, benchRev30d: 40000,  note: "Самый резкий рост дохода (+46%). Креатив-френдли." },
  "4X / Strategy": { growth: 85, revenueIndex: 95, competition: 88, benchRPD: 4000, benchRev30d: 180000, note: "Топ по доходу (~10% всего рынка), но дорогой UA и высокий порог." },
  "Strategy":      { growth: 78, revenueIndex: 90, competition: 85, benchRPD: 3000, benchRev30d: 130000, note: "$17.5B, +16% YoY. Максимальный доход на инсталл." },
  "Battle Royale": { growth: 70, revenueIndex: 82, competition: 80, benchRPD: 2500, benchRev30d: 90000,  note: "Лидер по времени в игре, сильный live-ops." },
  "Casino":        { growth: 64, revenueIndex: 80, competition: 70, benchRPD: 2000, benchRev30d: 85000,  note: "Высокий ARPU, стабильный спрос." },
  "Puzzle":        { growth: 66, revenueIndex: 74, competition: 80, benchRPD: 1000, benchRev30d: 45000,  note: "+14% YoY, ревайвл match-3, но рынок насыщен." },
  "Simulation":    { growth: 60, revenueIndex: 58, competition: 62, benchRPD: 700,  benchRev30d: 28000,  note: "Лидер по загрузкам, средняя монетизация." },
  "Idle":          { growth: 58, revenueIndex: 52, competition: 60, benchRPD: 500,  benchRev30d: 18000,  note: "Монетизация через rewarded video, стабильно." },
  "Card / Board":  { growth: 52, revenueIndex: 55, competition: 55, benchRPD: 700,  benchRev30d: 24000,  note: "Ниша с умеренной конкуренцией." },
  "Hyper-casual":  { growth: 50, revenueIndex: 30, competition: 72, benchRPD: 300,  benchRev30d: 9000,   note: "Двигатель загрузок, но низкий доход на пользователя." },
  "Casual":        { growth: 48, revenueIndex: 55, competition: 78, benchRPD: 600,  benchRev30d: 22000,  note: "Доход плоский, проседает retention." },
  "MOBA":          { growth: 45, revenueIndex: 85, competition: 90, benchRPD: 3000, benchRev30d: 120000, note: "Зрелый жанр, очень высокий порог входа." },
  "Sports":        { growth: 38, revenueIndex: 60, competition: 65, benchRPD: 900,  benchRev30d: 30000,  note: "Ожидается спад интереса." },
  "Arcade":        { growth: 40, revenueIndex: 45, competition: 70, benchRPD: 400,  benchRev30d: 12000,  note: "Снижающийся сегмент." },
  "RPG":           { growth: 30, revenueIndex: 88, competition: 88, benchRPD: 2500, benchRev30d: 110000, note: "Доход высокий, но −17% YoY. Рынок остывает." },
  "Другое":        { growth: 50, revenueIndex: 50, competition: 60, benchRPD: 800,  benchRev30d: 25000,  note: "Базовый ориентир, если жанр не из списка." }
};

/* ---------- 3. Статусы квалификации ---------- */
window.QUALIFICATIONS = [
  { id: "new",         label: "Новый",        color: "#4C5BD4" },
  { id: "interested",  label: "Интересно",    color: "#12876A" },
  { id: "not",         label: "Не интересно", color: "#8A909C" },
  { id: "contacted",   label: "Написали",     color: "#C98A16" },
  { id: "reply",       label: "Есть ответ",   color: "#2C7BBE" },
  { id: "negotiation", label: "Переговоры",   color: "#7A4FD0" },
  { id: "signed",      label: "Взяли",        color: "#0E7A57" },
  { id: "declined",    label: "Отказ",        color: "#C1443B" }
];

/* Метка NEW держится столько миллисекунд после добавления */
window.NEW_BADGE_MS = 3 * 60 * 60 * 1000; // 3 часа
