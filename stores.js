/* =============================================================
   Вытягивание данных по ссылке из стора.
   • App Store — официальный iTunes Lookup API (надёжно, кроме email:
     Apple его не отдаёт вовсе).
   • Google Play — офиц. API нет, тянем страницу через публичный
     CORS-прокси и парсим мета-теги (название/иконка надёжно, дата и
     email — как повезёт; при сбое поля просто останутся пустыми).
   ============================================================= */
(function () {

  function detect(url) {
    if (/apps\.apple\.com|itunes\.apple\.com/i.test(url)) return "ios";
    if (/play\.google\.com/i.test(url)) return "android";
    return null;
  }

  async function fromUrl(url) {
    url = (url || "").trim();
    const platform = detect(url);
    if (!platform) throw new Error("Не похоже на ссылку App Store или Google Play.");
    return platform === "ios" ? fromAppStore(url) : fromGooglePlay(url);
  }

  /* ---------------- App Store ---------------- */
  async function fromAppStore(url) {
    const m = url.match(/id(\d+)/);
    if (!m) throw new Error("В ссылке App Store не найден id приложения.");
    const id = m[1];
    const cc = (url.match(/apple\.com\/([a-z]{2})\//i) || [])[1] || "us";

    const endpoint = `https://itunes.apple.com/lookup?id=${id}&country=${cc}`;
    let data;
    try {
      const r = await fetch(endpoint);
      data = await r.json();
    } catch (e) {
      data = await jsonp(endpoint); // запасной путь, если CORS капризничает
    }
    if (!data || !data.results || !data.results.length)
      throw new Error("App Store не вернул данные по этому id.");

    const a = data.results[0];
    return {
      platform: "ios",
      storeUrl: url,
      name: a.trackName || "",
      developer: a.artistName || a.sellerName || "",
      developerEmail: "",            // Apple не отдаёт email — вручную
      icon: a.artworkUrl512 || a.artworkUrl100 || a.artworkUrl60 || "",
      releaseDate: shortDate(a.releaseDate),
      lastUpdate: shortDate(a.currentVersionReleaseDate),
      genreAuto: a.primaryGenreName || "",
      _emailNote: true
    };
  }

  /* ---------------- Google Play ---------------- */
  async function fromGooglePlay(url) {
    const m = url.match(/[?&]id=([a-zA-Z0-9._]+)/);
    if (!m) throw new Error("В ссылке Google Play не найден package id.");
    const pkg = m[1];

    const html = await fetchViaProxy(url);
    const pick = (re) => { const x = html.match(re); return x ? decode(x[1]).trim() : ""; };

    const rawTitle = pick(/<meta property="og:title" content="([^"]+)"/i)
                  || pick(/<title>([^<]+)<\/title>/i);
    const name = rawTitle.replace(/\s*[-–—]\s*(Apps on Google Play|Google Play|Приложения в Google Play).*$/i, "").trim();
    const icon = pick(/<meta property="og:image" content="([^"]+)"/i);

    // Разработчик и e-mail — по возможности (структура страницы меняется).
    let developer = "";
    const devMatch = html.match(/"author":\s*{[^}]*"name":\s*"([^"]+)"/i)
                  || html.match(/<meta name="appstore:developer_url"[^>]*>/i);
    if (devMatch && devMatch[1]) developer = decode(devMatch[1]).trim();

    let developerEmail = "";
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) developerEmail = emailMatch[0];

    if (!name && !icon) {
      throw new Error("Не удалось прочитать страницу Google Play (прокси/лимит). Заполните поля вручную.");
    }

    return {
      platform: "android",
      storeUrl: url,
      name: name || pkg,
      developer,
      developerEmail,
      icon,
      releaseDate: "",   // на странице стабильно не отдаётся
      lastUpdate: "",
      genreAuto: pick(/<meta name="appstore:bundle_id"[^>]*>/i) ? "" : "",
      _partial: true
    };
  }

  /* ---------------- утилиты ---------------- */

  // Публичные CORS-прокси. Пробуем по очереди.
  async function fetchViaProxy(target) {
    const proxies = [
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
    ];
    let lastErr;
    for (const build of proxies) {
      try {
        const r = await fetch(build(target), { headers: { "Accept": "text/html" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const t = await r.text();
        if (t && t.length > 500) return t;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("Прокси недоступны.");
  }

  // JSONP-фолбэк для iTunes
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "__scout_cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 8000);
      function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
      window[cb] = (data) => { cleanup(); resolve(data); };
      s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      s.onerror = () => { cleanup(); reject(new Error("jsonp error")); };
      document.head.appendChild(s);
    });
  }

  function shortDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toISOString().slice(0, 10);
  }
  function decode(s) {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  }

  window.Stores = { fromUrl, detect };
})();
