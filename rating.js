/* =============================================================
   Движок рейтинга.
   На вход — данные проекта, на выход — оценка 0–100, буква,
   вердикт и разбивка по компонентам (показывается в карточке проекта).
   ============================================================= */
(function () {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const log2  = (x) => Math.log(x) / Math.log(2);

  function benchFor(genre) {
    return window.NICHE_BENCHMARKS[genre] || window.NICHE_BENCHMARKS["Другое"];
  }

  // Насколько ниша сама по себе перспективна (0–100)
  function nicheScore(genre) {
    const b = benchFor(genre);
    return clamp(0.6 * b.growth + 0.4 * b.revenueIndex, 0, 100);
  }

  function nicheLabel(score) {
    if (score >= 80) return { text: "Горячая ниша",   tone: "go"    };
    if (score >= 65) return { text: "Сильная ниша",   tone: "go"    };
    if (score >= 50) return { text: "Средняя ниша",   tone: "watch" };
    return               { text: "Слабая ниша",    tone: "pass"  };
  }

  /* Главная функция. p — объект проекта с числовыми полями:
     genre, revenue30d, rpd, installs, organic (в %) */
  function compute(p) {
    const b = benchFor(p.genre);
    const parts = [];
    const add = (key, label, weight, value, hint) => {
      if (value === null || value === undefined || Number.isNaN(value)) return;
      parts.push({ key, label, weight, value: clamp(value, 0, 100), hint });
    };

    // 1. Ниша (есть всегда, если выбран жанр)
    const nScore = nicheScore(p.genre);
    add("niche", "Ниша", 0.35, nScore,
        `${b.note}`);

    // 2. Доход за 30 дней относительно ориентира ниши
    if (num(p.revenue30d) > 0) {
      const ratio = num(p.revenue30d) / b.benchRev30d;
      add("revenue", "Доход vs ниша", 0.30, clamp(50 + 22 * log2(ratio), 0, 100),
          `$${fmt(p.revenue30d)} при ориентире ниши ~$${fmt(b.benchRev30d)}/мес`);
    }

    // 3. RPD относительно ориентира ниши
    if (num(p.rpd) > 0) {
      const ratio = num(p.rpd) / b.benchRPD;
      add("rpd", "RPD vs ниша", 0.15, clamp(50 + 22 * log2(ratio), 0, 100),
          `$${fmt(p.rpd)}/день при ориентире ~$${fmt(b.benchRPD)}/день`);
    }

    // 4. Здоровье органики (выше органика = дешевле масштабировать)
    if (p.organic !== null && p.organic !== undefined && p.organic !== "") {
      const org = num(p.organic);
      add("organic", "Органика", 0.12, clamp(org * 2, 0, 100),
          `${org}% органических установок`);
    }

    // 5. Ценность инсталла (доход / инсталлы за 30 дней)
    if (num(p.revenue30d) > 0 && num(p.installs) > 0) {
      const vpi = num(p.revenue30d) / num(p.installs);
      add("vpi", "Доход на инсталл", 0.08, clamp(50 + 30 * log2(vpi / 0.5), 0, 100),
          `$${vpi.toFixed(2)} с инсталла`);
    }

    // Взвешенная сумма с ренормализацией весов по имеющимся данным
    const wsum = parts.reduce((s, x) => s + x.weight, 0) || 1;
    const score = Math.round(parts.reduce((s, x) => s + x.value * x.weight, 0) / wsum);

    return {
      score,
      grade: grade(score),
      niche: { score: Math.round(nScore), ...nicheLabel(nScore) },
      parts,
      dataCompleteness: Math.round((parts.length / 5) * 100)
    };
  }

  function grade(score) {
    if (score >= 80) return { letter: "A", verdict: "Брать",       tone: "go"    };
    if (score >= 65) return { letter: "B", verdict: "Рассмотреть", tone: "go"    };
    if (score >= 50) return { letter: "C", verdict: "На грани",    tone: "watch" };
    if (score >= 35) return { letter: "D", verdict: "Слабо",       tone: "pass"  };
    return               { letter: "E", verdict: "Пропустить",  tone: "pass"  };
  }

  // helpers
  function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
  function fmt(v) {
    const n = num(v);
    if (n >= 1000) return Math.round(n).toLocaleString("ru-RU");
    return String(n);
  }

  window.Rating = { compute, nicheScore, nicheLabel, grade };
})();
