/* =============================================================
   СКАУТ — интерфейс и логика
   ============================================================= */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const GENRES = Object.keys(window.NICHE_BENCHMARKS);
  const QUALS  = window.QUALIFICATIONS;
  const qualById = (id) => QUALS.find(q => q.id === id) || QUALS[0];

  let PROJECTS = [];          // текущий срез базы
  let currentStoreMeta = {};  // авто-данные из стора для формы
  let charts = {};            // инстансы Chart.js

  /* ---------------- запуск ---------------- */
  function boot() {
    fillGenreSelects();
    bindNav();
    bindEvaluate();
    bindDatabase();
    bindModal();

    const mode = DB.init();
    setConn(mode);
    DB.subscribe(onData);
    DB.onTick(() => { renderDatabase(); });   // обновляет метки NEW/время
    renderScore(null);
    addCreativeRow(); // одна пустая строка креатива по умолчанию
  }

  function setConn(mode) {
    const el = $("#connStatus"), lbl = $("#connLabel");
    if (mode === "cloud") { el.classList.add("cloud"); lbl.textContent = "Общая база онлайн"; }
    else { el.classList.remove("cloud"); lbl.textContent = "Локальный режим"; }
  }

  function onData(items) {
    PROJECTS = items;
    $("#navCount").textContent = items.length || "";
    renderDatabase();
    renderAnalytics();
  }

  /* ---------------- навигация ---------------- */
  function bindNav() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => {
      $$(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const v = btn.dataset.view;
      $$(".view").forEach(s => s.classList.remove("active"));
      $("#view-" + v).classList.add("active");
      if (v === "analytics") renderAnalytics();
    }));
  }

  function fillGenreSelects() {
    const opts = GENRES.map(g => `<option value="${g}">${g}</option>`).join("");
    $("#mGenre").innerHTML = opts;
    $("#fGenre").insertAdjacentHTML("beforeend", opts);
    $("#fQual").insertAdjacentHTML("beforeend",
      QUALS.map(q => `<option value="${q.id}">${q.label}</option>`).join(""));
  }

  /* ============================================================
     ВКЛАДКА 1 — ОЦЕНКА
     ============================================================ */
  function bindEvaluate() {
    $("#fetchBtn").addEventListener("click", fetchStore);
    $("#storeUrl").addEventListener("keydown", e => { if (e.key === "Enter") fetchStore(); });
    $("#addCreative").addEventListener("click", () => addCreativeRow());
    $("#saveBtn").addEventListener("click", saveProject);
    $("#resetBtn").addEventListener("click", resetForm);
    ["#mGenre", "#mRpd", "#mRev", "#mInstalls", "#mOrganic"].forEach(sel =>
      $(sel).addEventListener("input", liveScore));
    ["#scDev", "#scEmail", "#scRelease", "#scUpdate"].forEach(sel =>
      $(sel).addEventListener("input", syncStoreMeta));
  }

  async function fetchStore() {
    const url = $("#storeUrl").value.trim();
    const msg = $("#fetchMsg");
    if (!url) { msg.className = "fetch-msg err"; msg.textContent = "Вставьте ссылку из App Store или Google Play."; return; }
    msg.className = "fetch-msg load"; msg.textContent = "Читаю стор…";
    try {
      const data = await Stores.fromUrl(url);
      currentStoreMeta = data;
      showStoreCard(data);
      // угадываем жанр из авто-данных
      const guess = matchGenre(data.genreAuto);
      if (guess) { $("#mGenre").value = guess; }
      liveScore();
      if (data._partial) { msg.className = "fetch-msg ok"; msg.textContent = "Google Play отдаёт частично — проверьте поля, дату/жанр впишите вручную."; }
      else if (data._emailNote) { msg.className = "fetch-msg ok"; msg.textContent = "Готово. E-mail разработчика Apple не отдаёт — впишите вручную."; }
      else { msg.className = "fetch-msg ok"; msg.textContent = "Готово."; }
    } catch (e) {
      msg.className = "fetch-msg err"; msg.textContent = e.message || "Не удалось прочитать стор.";
    }
  }

  function showStoreCard(d) {
    $("#storeCard").hidden = false;
    $("#scIcon").src = d.icon || "";
    $("#scIcon").style.visibility = d.icon ? "visible" : "hidden";
    $("#scName").textContent = d.name || "—";
    $("#scDev").value = d.developer || "";
    $("#scEmail").value = d.developerEmail || "";
    $("#scRelease").value = d.releaseDate || "";
    $("#scUpdate").value = d.lastUpdate || "";
    $("#scPlatform").textContent = d.platform === "ios" ? "App Store" : "Google Play";
    $("#scGenreAuto").textContent = d.genreAuto || "";
    $("#scGenreAuto").hidden = !d.genreAuto;
  }

  function syncStoreMeta() {
    currentStoreMeta.developer      = $("#scDev").value.trim();
    currentStoreMeta.developerEmail = $("#scEmail").value.trim();
    currentStoreMeta.releaseDate    = $("#scRelease").value.trim();
    currentStoreMeta.lastUpdate     = $("#scUpdate").value.trim();
    currentStoreMeta.name           = $("#scName").textContent.trim();
  }

  function matchGenre(auto) {
    if (!auto) return "";
    const a = auto.toLowerCase();
    for (const g of GENRES) if (g.toLowerCase().includes(a) || a.includes(g.toLowerCase())) return g;
    if (/role|rpg/.test(a)) return "RPG";
    if (/puzzle/.test(a)) return "Puzzle";
    if (/strateg/.test(a)) return "Strategy";
    if (/action/.test(a)) return "Action";
    if (/simulat/.test(a)) return "Simulation";
    if (/casino/.test(a)) return "Casino";
    if (/arcade/.test(a)) return "Arcade";
    if (/board|card/.test(a)) return "Card / Board";
    if (/sport/.test(a)) return "Sports";
    return "";
  }

  /* креативы */
  function addCreativeRow(url = "", audience = "") {
    const list = $("#creativeList");
    const row = document.createElement("div");
    row.className = "creative-row";
    row.innerHTML = `
      <label>Ссылка на креатив<input class="cr-url" value="${escAttr(url)}" placeholder="https://…" /></label>
      <label>Аудитория<input class="cr-aud" value="${escAttr(audience)}" placeholder="напр. 2.4M" /></label>
      <button class="rm" title="Удалить" type="button">×</button>`;
    row.querySelector(".rm").addEventListener("click", () => { row.remove(); ensureCreativeHint(); });
    list.appendChild(row);
    ensureCreativeHint();
  }
  function ensureCreativeHint() {
    const list = $("#creativeList");
    if (!list.querySelector(".creative-row")) list.innerHTML = `<div class="creative-empty">Креативов пока нет.</div>`;
    else { const e = list.querySelector(".creative-empty"); if (e) e.remove(); }
  }
  function collectCreatives() {
    return $$(".creative-row").map(r => ({
      url: r.querySelector(".cr-url").value.trim(),
      audience: r.querySelector(".cr-aud").value.trim()
    })).filter(c => c.url || c.audience);
  }

  /* живой рейтинг в правой колонке */
  function formToProject() {
    return {
      ...currentStoreMeta,
      genre:      $("#mGenre").value,
      rpd:        $("#mRpd").value,
      revenue30d: $("#mRev").value,
      installs:   $("#mInstalls").value,
      organic:    $("#mOrganic").value,
      creatives:  collectCreatives()
    };
  }
  function liveScore() { renderScore(formToProject()); }

  function renderScore(p) {
    const box = $("#scorePreview");
    if (!p || !p.genre) {
      box.innerHTML = `<div class="score-empty">Выберите жанр и введите показатели — рейтинг посчитается здесь.</div>`;
      return;
    }
    const r = Rating.compute(p);
    box.innerHTML = scoreHTML(r);
  }

  function scoreHTML(r) {
    const tone = r.grade.tone;
    const C = 2 * Math.PI * 52;
    const dash = (r.score / 100) * C;
    const parts = r.parts.map(pt => `
      <div class="part">
        <div class="part-top"><span>${pt.label}</span><b>${Math.round(pt.value)}</b></div>
        <div class="bar"><span class="tone-${toneOf(pt.value)}-bg" style="width:${pt.value}%"></span></div>
      </div>`).join("");
    return `
      <div class="score-ring-wrap">
        <div class="ring">
          <svg width="118" height="118" viewBox="0 0 118 118">
            <circle cx="59" cy="59" r="52" fill="none" stroke="#313747" stroke-width="10"/>
            <circle cx="59" cy="59" r="52" fill="none" stroke="${toneColor(tone)}" stroke-width="10"
                    stroke-linecap="round" stroke-dasharray="${dash} ${C}"/>
          </svg>
          <div class="val"><div class="num">${r.score}</div><div class="den">из 100</div></div>
        </div>
        <div class="grade-block">
          <div class="letter tone-${tone}">${r.grade.letter}</div>
          <div class="verdict tone-${tone}">${r.grade.verdict}</div>
        </div>
      </div>
      <div class="niche-tag">
        <span class="nt-label">Ниша</span>
        <span class="nt-val tone-${r.niche.tone}">${r.niche.text} · ${r.niche.score}</span>
      </div>
      <div class="parts">${parts}</div>
      <div class="completeness">Заполнено данных: ${r.dataCompleteness}% — чем больше, тем точнее рейтинг.</div>`;
  }
  const toneOf = (v) => v >= 65 ? "go" : v >= 45 ? "watch" : "pass";
  const toneColor = (t) => t === "go" ? "#34C08A" : t === "watch" ? "#E7A93B" : "#F0796F";

  async function saveProject() {
    syncStoreMeta();
    const p = formToProject();
    if (!p.name) { flashSave("Сначала заполните карточку из стора или введите название.", true); return; }
    if (!p.genre) { flashSave("Выберите жанр.", true); return; }
    const r = Rating.compute(p);
    const rec = {
      storeUrl: p.storeUrl || $("#storeUrl").value.trim() || "",
      platform: p.platform || "",
      name: p.name,
      developer: p.developer || "",
      developerEmail: p.developerEmail || "",
      icon: p.icon || "",
      releaseDate: p.releaseDate || "",
      lastUpdate: p.lastUpdate || "",
      genre: p.genre,
      rpd: numOrNull(p.rpd),
      revenue30d: numOrNull(p.revenue30d),
      installs: numOrNull(p.installs),
      organic: numOrNull(p.organic),
      creatives: p.creatives || [],
      score: r.score,
      grade: r.grade.letter,
      qualification: "new",
      note: ""
    };
    try {
      await DB.add(rec);
      flashSave("Добавлено в базу ✓", false);
      setTimeout(resetForm, 500);
    } catch (e) {
      flashSave("Не удалось сохранить: " + (e.message || e), true);
    }
  }
  function flashSave(text, err) {
    const el = $("#saveMsg");
    el.textContent = text;
    el.style.color = err ? "var(--pass)" : "var(--go)";
  }
  function resetForm() {
    ["#storeUrl", "#mRpd", "#mRev", "#mInstalls", "#mOrganic"].forEach(s => $(s).value = "");
    $("#storeCard").hidden = true;
    $("#fetchMsg").textContent = "";
    $("#saveMsg").textContent = "";
    $("#creativeList").innerHTML = "";
    currentStoreMeta = {};
    addCreativeRow();
    renderScore(null);
  }

  /* ============================================================
     ВКЛАДКА 2 — БАЗА
     ============================================================ */
  function bindDatabase() {
    ["#fSearch", "#fGenre", "#fQual", "#fSort"].forEach(s =>
      $(s).addEventListener("input", renderDatabase));
  }

  function filteredProjects() {
    const q  = $("#fSearch").value.trim().toLowerCase();
    const g  = $("#fGenre").value;
    const ql = $("#fQual").value;
    const sort = $("#fSort").value;
    let list = PROJECTS.filter(p => {
      if (g && p.genre !== g) return false;
      if (ql && (p.qualification || "new") !== ql) return false;
      if (q && !(`${p.name} ${p.developer}`.toLowerCase().includes(q))) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "new") return (b.createdAt || 0) - (a.createdAt || 0);
      if (sort === "rev") return (b.revenue30d || 0) - (a.revenue30d || 0);
      return (b.score || 0) - (a.score || 0);
    });
    return list;
  }

  function renderDatabase() {
    const grid = $("#dbGrid"), empty = $("#dbEmpty");
    const list = filteredProjects();
    empty.hidden = PROJECTS.length !== 0;
    if (!list.length && PROJECTS.length) { grid.innerHTML = `<div class="empty-sub" style="padding:20px">Ничего не найдено под фильтры.</div>`; return; }
    grid.innerHTML = list.map(cardHTML).join("");
    // события
    $$(".pcard").forEach(card => {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".qual-select")) return;
        openModal(id);
      });
      const sel = card.querySelector(".qual-select");
      if (sel) sel.addEventListener("change", (e) => DB.update(id, { qualification: e.target.value }));
    });
  }

  function cardHTML(p) {
    const tone = gradeTone(p.score);
    const isNew = (Date.now() - (p.createdAt || 0)) < window.NEW_BADGE_MS;
    const q = qualById(p.qualification || "new");
    return `
      <div class="pcard" data-id="${p.id}">
        ${isNew ? `<span class="new-badge">NEW</span>` : ""}
        <div class="pcard-top">
          <img class="pcard-icon" src="${escAttr(p.icon)}" alt="" onerror="this.style.visibility='hidden'"/>
          <div class="pcard-id">
            <div class="pcard-name">${escHtml(p.name)}</div>
            <div class="pcard-dev">${escHtml(p.developer || "—")}</div>
          </div>
          <div class="pcard-badge tone-${tone}-bg">
            <span class="sc">${p.score ?? "—"}</span>
            <span class="gr">${p.grade || ""}</span>
          </div>
        </div>
        <div class="pcard-mid">
          <span class="tagchip genre">${escHtml(p.genre)}</span>
          ${p.platform ? `<span class="tagchip">${p.platform === "ios" ? "iOS" : "Android"}</span>` : ""}
          <span class="tagchip" style="background:${hexA(q.color,.12)};color:${q.color}">${q.label}</span>
        </div>
        <div class="pcard-metrics">
          <div>Доход 30д<b>${money(p.revenue30d)}</b></div>
          <div>RPD<b>${money(p.rpd)}</b></div>
          <div>Органика<b>${p.organic != null ? p.organic + "%" : "—"}</b></div>
        </div>
        <div class="pcard-foot">
          <select class="qual-select">
            ${QUALS.map(qq => `<option value="${qq.id}" ${((p.qualification||"new")===qq.id)?"selected":""}>${qq.label}</option>`).join("")}
          </select>
          <span class="pcard-dev">${relTime(p.createdAt)}</span>
        </div>
      </div>`;
  }

  /* ============================================================
     МОДАЛКА ПРОЕКТА — просмотр / правка / удаление
     ============================================================ */
  function bindModal() {
    $("#modalClose").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }
  function closeModal() { $("#modal").hidden = true; }

  function openModal(id) {
    const p = PROJECTS.find(x => x.id === id);
    if (!p) return;
    $("#modalBody").innerHTML = modalViewHTML(p);
    $("#modal").hidden = false;
    wireModal(p);
  }

  function modalViewHTML(p) {
    const r = Rating.compute(p);
    const tone = r.grade.tone;
    const q = qualById(p.qualification || "new");
    const parts = r.parts.map(pt => `
      <div class="part">
        <div class="part-top"><span>${pt.label} <span style="color:var(--muted-2)">${pt.hint ? "· " + escHtml(pt.hint) : ""}</span></span><b>${Math.round(pt.value)}</b></div>
        <div class="bar"><span class="tone-${toneOf(pt.value)}-bg" style="width:${pt.value}%"></span></div>
      </div>`).join("");
    const creatives = (p.creatives && p.creatives.length)
      ? p.creatives.map(c => `<div class="m-creative"><a href="${escAttr(c.url)}" target="_blank" rel="noopener">${escHtml(c.url || "креатив")}</a><span class="aud">${escHtml(c.audience || "—")}</span></div>`).join("")
      : `<div class="creative-empty">Креативы не добавлены.</div>`;
    return `
      <div class="m-head">
        <img class="m-icon" src="${escAttr(p.icon)}" alt="" onerror="this.style.visibility='hidden'"/>
        <div>
          <div class="m-title">${escHtml(p.name)}</div>
          <div class="m-sub">${escHtml(p.developer || "—")}${p.developerEmail ? " · " + escHtml(p.developerEmail) : ""}</div>
          <div class="m-sub">${p.storeUrl ? `<a href="${escAttr(p.storeUrl)}" target="_blank" rel="noopener" style="color:var(--brand-ink)">открыть в сторе</a>` : ""}</div>
        </div>
        <div class="m-badge tone-${tone}-bg">
          <div class="s">${r.score}</div><div class="v">${r.grade.verdict}</div>
        </div>
      </div>
      <div class="m-body">
        <div class="m-section">
          <h3>Из стора</h3>
          <div class="m-fields three">
            ${kv("Платформа", p.platform === "ios" ? "App Store" : p.platform === "android" ? "Google Play" : "—")}
            ${kv("Релиз", p.releaseDate || "—")}
            ${kv("Последний апдейт", p.lastUpdate || "—")}
          </div>
        </div>

        <div class="m-section">
          <h3>Показатели</h3>
          <div class="m-fields three">
            ${kv("Жанр / ниша", p.genre)}
            ${kv("RPD", money(p.rpd))}
            ${kv("Доход 30д", money(p.revenue30d))}
            ${kv("Инсталлы 30д", p.installs != null ? Number(p.installs).toLocaleString("ru-RU") : "—")}
            ${kv("Органика", p.organic != null ? p.organic + "%" : "—")}
            ${kv("Ниша", `${r.niche.text} · ${r.niche.score}`)}
          </div>
        </div>

        <div class="m-section m-parts">
          <h3>Как посчитан рейтинг</h3>
          ${parts}
        </div>

        <div class="m-section">
          <h3>Креативы и собранная аудитория</h3>
          <div class="m-creatives">${creatives}</div>
        </div>

        <div class="m-section">
          <h3>Квалификация и заметки</h3>
          <div class="m-fields">
            <label>Статус
              <select id="mQual">${QUALS.map(qq => `<option value="${qq.id}" ${((p.qualification||"new")===qq.id)?"selected":""}>${qq.label}</option>`).join("")}</select>
            </label>
            <div class="kv"><div class="k">Добавлен</div><div class="v">${fullTime(p.createdAt)}</div></div>
          </div>
          <textarea class="m-note" id="mNote" placeholder="Заметки: договорённости, контакты, условия…">${escHtml(p.note || "")}</textarea>
        </div>

        <div class="m-actions">
          <button class="btn btn-primary" id="mSave">Сохранить изменения</button>
          <button class="btn btn-ghost" id="mEdit">Редактировать показатели</button>
          <button class="btn btn-danger" id="mDelete" style="margin-left:auto">Удалить из базы</button>
        </div>
      </div>`;
  }

  function wireModal(p) {
    $("#mSave").addEventListener("click", async () => {
      await DB.update(p.id, {
        qualification: $("#mQual").value,
        note: $("#mNote").value
      });
      closeModal();
    });
    $("#mDelete").addEventListener("click", async () => {
      if (confirm(`Удалить «${p.name}» из базы?`)) { await DB.remove(p.id); closeModal(); }
    });
    $("#mEdit").addEventListener("click", () => openEdit(p));
  }

  function openEdit(p) {
    $("#modalBody").innerHTML = `
      <div class="m-head"><div><div class="m-title">Редактирование</div><div class="m-sub">${escHtml(p.name)}</div></div></div>
      <div class="m-body">
        <div class="m-section">
          <div class="edit-grid">
            <label>Название<input id="eName" value="${escAttr(p.name)}"/></label>
            <label>Разработчик<input id="eDev" value="${escAttr(p.developer||"")}"/></label>
            <label>E-mail<input id="eEmail" value="${escAttr(p.developerEmail||"")}"/></label>
            <label>Жанр / ниша<select id="eGenre">${GENRES.map(g=>`<option ${g===p.genre?"selected":""}>${g}</option>`).join("")}</select></label>
            <label>RPD, $<input id="eRpd" type="number" value="${p.rpd??""}"/></label>
            <label>Доход 30д, $<input id="eRev" type="number" value="${p.revenue30d??""}"/></label>
            <label>Инсталлы 30д<input id="eInst" type="number" value="${p.installs??""}"/></label>
            <label>Органика, %<input id="eOrg" type="number" value="${p.organic??""}"/></label>
            <label>Дата релиза<input id="eRel" value="${escAttr(p.releaseDate||"")}"/></label>
            <label>Последний апдейт<input id="eUpd" value="${escAttr(p.lastUpdate||"")}"/></label>
          </div>
        </div>
        <div class="m-actions">
          <button class="btn btn-primary" id="eSave">Сохранить и пересчитать</button>
          <button class="btn btn-ghost" id="eBack">Назад</button>
        </div>
      </div>`;
    $("#eBack").addEventListener("click", () => openModal(p.id));
    $("#eSave").addEventListener("click", async () => {
      const patch = {
        name: $("#eName").value.trim(),
        developer: $("#eDev").value.trim(),
        developerEmail: $("#eEmail").value.trim(),
        genre: $("#eGenre").value,
        rpd: numOrNull($("#eRpd").value),
        revenue30d: numOrNull($("#eRev").value),
        installs: numOrNull($("#eInst").value),
        organic: numOrNull($("#eOrg").value),
        releaseDate: $("#eRel").value.trim(),
        lastUpdate: $("#eUpd").value.trim()
      };
      const r = Rating.compute({ ...p, ...patch });
      patch.score = r.score; patch.grade = r.grade.letter;
      await DB.update(p.id, patch);
      const updated = { ...p, ...patch };
      $("#modalBody").innerHTML = modalViewHTML(updated);
      wireModal(updated);
    });
  }

  /* ============================================================
     ВКЛАДКА 3 — АНАЛИТИКА
     ============================================================ */
  function renderAnalytics() {
    if (!$("#view-analytics").classList.contains("active") && PROJECTS.length === 0 && !charts.niche) {
      // всё равно нарисуем рынок при первом заходе
    }
    renderKPIs();
    drawNicheChart();
    drawGenreChart();
    drawGradeChart();
    drawQualChart();
    drawTopList();
  }

  function renderKPIs() {
    const n = PROJECTS.length;
    const avg = n ? Math.round(PROJECTS.reduce((s,p)=>s+(p.score||0),0)/n) : 0;
    const pipe = PROJECTS.reduce((s,p)=>s+(p.revenue30d||0),0);
    const interested = PROJECTS.filter(p => ["interested","negotiation","reply","contacted"].includes(p.qualification)).length;
    $("#kpiRow").innerHTML = [
      ["Проектов в базе", n],
      ["Средний рейтинг", avg || "—"],
      ["Доход пайплайна / мес", "$" + money(pipe).replace("$","")],
      ["В работе", interested]
    ].map(([l,v]) => `<div class="kpi"><div class="k-val">${v}</div><div class="k-label">${l}</div></div>`).join("");
  }

  function baseChartOpts(extra={}) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: "#EEF1F5" }, beginAtZero: true } }
    }, extra);
  }
  function fresh(id) { if (charts[id]) charts[id].destroy(); return $("#"+id).getContext("2d"); }

  function drawNicheChart() {
    const rows = GENRES.map(g => ({ g, ...window.NICHE_BENCHMARKS[g] }))
                       .sort((a,b) => b.growth - a.growth);
    charts.niche = new Chart(fresh("chartNiche"), {
      type: "bar",
      data: {
        labels: rows.map(r => r.g),
        datasets: [
          { label: "Рост", data: rows.map(r => r.growth), backgroundColor: "#4C5BD4", borderRadius: 4, barPercentage: .9 },
          { label: "Доход (индекс)", data: rows.map(r => r.revenueIndex), backgroundColor: "#34C08A", borderRadius: 4, barPercentage: .9 }
        ]
      },
      options: baseChartOpts({
        plugins: { legend: { display: true, position: "top", labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: { x: { grid: { display:false }, ticks: { font:{ size:10 }, maxRotation: 60, minRotation: 40 } }, y: { grid:{ color:"#EEF1F5" }, max:100 } }
      })
    });
  }

  function drawGenreChart() {
    const counts = {};
    PROJECTS.forEach(p => counts[p.genre] = (counts[p.genre]||0)+1);
    const labels = Object.keys(counts);
    charts.genre = new Chart(fresh("chartByGenre"), {
      type: "bar",
      data: { labels, datasets: [{ data: labels.map(l=>counts[l]), backgroundColor: "#4C5BD4", borderRadius: 4 }] },
      options: baseChartOpts({ scales: { x:{ grid:{display:false}, ticks:{ font:{size:10}, maxRotation:60, minRotation:40 } }, y:{ grid:{color:"#EEF1F5"}, ticks:{ precision:0 } } } })
    });
  }

  function drawGradeChart() {
    const order = ["A","B","C","D","E"];
    const col = { A:"#0E7A57", B:"#34C08A", C:"#B47908", D:"#E08A3B", E:"#C1443B" };
    const counts = Object.fromEntries(order.map(g=>[g,0]));
    PROJECTS.forEach(p => { if (counts[p.grade]!=null) counts[p.grade]++; });
    charts.grade = new Chart(fresh("chartByGrade"), {
      type: "doughnut",
      data: { labels: order, datasets: [{ data: order.map(g=>counts[g]), backgroundColor: order.map(g=>col[g]), borderWidth: 2, borderColor: "#fff" }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  }

  function drawQualChart() {
    const counts = Object.fromEntries(QUALS.map(q=>[q.id,0]));
    PROJECTS.forEach(p => { const k=p.qualification||"new"; counts[k]=(counts[k]||0)+1; });
    charts.qual = new Chart(fresh("chartByQual"), {
      type: "bar",
      data: { labels: QUALS.map(q=>q.label), datasets: [{ data: QUALS.map(q=>counts[q.id]), backgroundColor: QUALS.map(q=>q.color), borderRadius: 4 }] },
      options: baseChartOpts({ indexAxis: "y", scales: { x:{ grid:{color:"#EEF1F5"}, ticks:{precision:0} }, y:{ grid:{display:false}, ticks:{ font:{size:11} } } } })
    });
  }

  function drawTopList() {
    const list = [...PROJECTS].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,6);
    const el = $("#topList");
    if (!list.length) { el.innerHTML = `<div class="creative-empty" style="padding:14px">Добавьте проекты — топ появится здесь.</div>`; return; }
    el.innerHTML = list.map((p,i) => {
      const tone = gradeTone(p.score);
      const b = window.NICHE_BENCHMARKS[p.genre] || {};
      return `<div class="top-row" data-id="${p.id}">
        <span class="top-rank">${i+1}</span>
        <img class="top-icon" src="${escAttr(p.icon)}" onerror="this.style.visibility='hidden'"/>
        <div class="top-name">${escHtml(p.name)}<div class="top-sub">${escHtml(p.genre)} · рост ниши ${b.growth ?? "—"}</div></div>
        <span class="top-score tone-${tone}">${p.score ?? "—"}</span>
      </div>`;
    }).join("");
    $$("#topList .top-row").forEach(r => r.addEventListener("click", () => openModal(r.dataset.id)));
  }

  /* ---------------- утилиты ---------------- */
  function gradeTone(score) {
    if (score == null) return "watch";
    if (score >= 65) return "go";
    if (score >= 50) return "watch";
    return "pass";
  }
  function money(v) {
    if (v == null || v === "" || isNaN(v)) return "—";
    const n = Number(v);
    if (n >= 1000000) return "$" + (n/1000000).toFixed(1) + "M";
    if (n >= 1000) return "$" + (n/1000).toFixed(1) + "K";
    return "$" + n.toLocaleString("ru-RU");
  }
  function numOrNull(v) { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function kv(k, v) { return `<div class="kv"><div class="k">${k}</div><div class="v">${escHtml(String(v))}</div></div>`; }
  function relTime(ts) {
    if (!ts) return "";
    const d = Date.now() - ts, m = Math.floor(d/60000);
    if (m < 1) return "только что";
    if (m < 60) return m + " мин назад";
    const h = Math.floor(m/60); if (h < 24) return h + " ч назад";
    return Math.floor(h/24) + " дн назад";
  }
  function fullTime(ts) { return ts ? new Date(ts).toLocaleString("ru-RU") : "—"; }
  function escHtml(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
  function escAttr(s) { return escHtml(s).replace(/'/g, "&#39;"); }
  function hexA(hex, a) {
    const m = hex.replace("#","").match(/.{2}/g); if (!m) return hex;
    const [r,g,b] = m.map(x=>parseInt(x,16));
    return `rgba(${r},${g},${b},${a})`;
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
