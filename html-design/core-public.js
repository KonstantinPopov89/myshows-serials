/* Shared filtering and ranking, static web edition. */
(function (global) {
  'use strict';

  const VISIT_LS_KEY = 'serials_public_visit_v1';
  const BASELINE_DATE = '2026-11-15-baseline';
  const BASELINE_GEN = '2026-11-15T18:54:00';
  const TASTE_HI = 0.55;
  const TASTE_LO = 0.45;

  const STARTER_2026 = [97519, 91872, 89037, 89952, 97176, 83246, 81574, 94312];
  const STARTER_TITLES_FALLBACK = {
    97519: 'Бухта вдов',
    91872: 'Кэрри',
    89037: 'Паук-Нуар',
    89952: 'Молодой Шерлок',
    97176: 'Яростная',
    83246: 'Хрустальное озеро',
    81574: 'Квест Вижна',
    94312: 'Мол — Владыка Теней'
  };
  const CURATED_WHY_2026 = {
    97519: 'Комедийный хоррор: мэр проклятого острова у Новой Англии пытается привлечь туристов. Сериал продлён.',
    91872: 'Новая экранизация романа Кинга о девушке с телекинезом. По жанрам самое близкое к вам в списке.',
    89037: 'Игровой нуар: стареющий частный детектив в Нью-Йорке 1930-х, бывший супергерой. Один сезон, сериал закончен.',
    89952: 'Первое дело 19-летнего Холмса в Оксфорде. Производство Великобритании.',
    97176: 'Агент ФБР выслеживает женщину-убийцу.',
    83246: 'Предыстория «Пятницы, 13-е» глазами Памелы Вурхиз.',
    81574: 'Продолжение «Ванда/Вижн»: тот сериал вы досмотрели целиком, 9 серий из 9.',
    94312: 'Анимационный сериал по «Звёздным войнам». Оговорка: «Войны клонов» вы бросили на 22-й серии и поставили им 3.'
  };
  const CURATED_RISKS_2026 = [
    { id: 80639, title: 'Заветы', kind: 'Продолжение брошенного', text: p => `${p.rankYear === 1 ? 'Самая высокая оценка в срезе. ' : 'Одна из самых высоких оценок в срезе. '}Продолжение «Рассказа служанки»: его вы отметили брошенным, не посмотрев ни одной серии. Если причина была в теме, она относится и сюда.` },
    { id: 96309, title: 'Ранчо Даттонов', kind: 'Продолжение брошенного', text: () => 'Спин-офф «Йеллоустоуна», который вы бросили на 40-й серии из 53: высокая оценка зрителей не отменяет того, что из этой вселенной вы уже ушли.' },
    { id: 95946, title: 'Вне кампуса', kind: 'Романтика, которую вы редко досматриваете', text: (p, rom) => rom ? `Место ${p.rankYear} в году по общей формуле, но это студенческий роман. Романтику вы досматриваете редко: ${rom.kept} ${pl(rom.kept, 'сериал', 'сериала', 'сериалов')} из ${rom.kept + rom.dropped} начатых.` : 'Студенческий роман — жанр, который вы чаще бросаете.' },
    { id: 97238, title: 'Клиника', kind: 'Комедия, которую вы чаще бросаете', text: (_p, _rom, com) => com ? `Перезапуск Scrubs. Комедии вы бросаете чаще, чем досматриваете: из начатых досмотрели или смотрите ${com.kept}, бросили ${com.dropped}.` : 'Перезапуск Scrubs. Комедии вы чаще бросаете.' }
  ];
  const CURATED_RISK_IDS = new Set([80639, 96309, 95946, 97238]);

  const STATUS_RU = {
    watching: 'смотрю',
    finished: 'досмотрел',
    cancelled: 'брошено',
    later: 'в планах'
  };

  const YEAR_PRESETS = [
    { key: '2026', label: '2026', years: [2026] },
    { key: '2024-2026', label: '2024–2026', years: [2024, 2025, 2026] },
    { key: '2020-2023', label: '2020–2023', years: [2020, 2021, 2022, 2023] },
    { key: '2015-2019', label: '2015–2019', years: [2015, 2016, 2017, 2018, 2019] },
    { key: 'all', label: 'Все 2015–2026', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] }
  ];

  const COUNTRY_GROUPS = ['США', 'Великобритания', 'Россия', 'Европа', 'Другие'];
  const NETWORK_GROUPS = ['HBO / Max', 'Apple TV+', 'Netflix', 'Prime Video', 'FX / Hulu', 'Disney+', 'BBC / ITV', 'Российские', 'Другие'];

  const SORT_MODES = [
    { key: 'scoreNorm', label: 'По баллу (с нормировкой года)' },
    { key: 'score', label: 'По сырому баллу (без нормировки года)' },
    { key: 'fit', label: 'По вашему вкусу' },
    { key: 'imdb', label: 'По IMDb' },
    { key: 'kp', label: 'По Кинопоиску' },
    { key: 'rating', label: 'По оценке MyShows' },
    { key: 'watching', label: 'По числу смотрящих' },
    { key: 'newest', label: 'Сначала новые' }
  ];

  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function fmt(n) {
    return Number(n || 0).toLocaleString('ru-RU');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pl(n, a, b, c) {
    const m = Math.abs(Number(n) || 0) % 100;
    const k = m % 10;
    return (m > 10 && m < 20) ? c : k === 1 ? a : (k >= 2 && k <= 4) ? b : c;
  }

  function normSearch(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').trim();
  }

  function formatRuDateTime(iso) {
    if (!iso) return '';
    if (iso === BASELINE_DATE) return '15 ноября 2026 (до вечерних отметок)';
    const d = new Date(iso);
    if (!isNaN(d)) {
      return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? `${+m[3]} ${MONTHS_GEN[+m[2] - 1]} ${m[1]}` : String(iso);
  }

  function formatRuDateShort(iso) {
    if (!iso) return '';
    if (iso === BASELINE_DATE) return '15 нояб. (база)';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (m) return `${+m[3]} ${MONTHS_GEN[+m[2] - 1].slice(0, 3)}.`;
    return String(iso);
  }

  /* ---------- Офлайн-стойкие обложки ---------- */
  function makePlaceholderDataUri(title, year, theme) {
    const isHerb = theme === 'herbarium';
    const bg = isHerb ? '#e6dcc6' : '#dfe0e4';
    const fg = isHerb ? '#2a2118' : '#17171a';
    const mut = isHerb ? '#6b5b47' : '#55555c';
    const acc = isHerb ? '#a63a1f' : '#c8260f';
    const clean = String(title || 'Сериал').slice(0, 34);
    const yStr = year ? String(year) : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">` +
      `<rect width="640" height="360" fill="${bg}"/>` +
      `<rect x="18" y="18" width="604" height="324" fill="none" stroke="${fg}" stroke-opacity="0.22" stroke-width="2"/>` +
      `<circle cx="48" cy="48" r="7" fill="${acc}"/>` +
      (yStr ? `<text x="68" y="54" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="${mut}">${esc(yStr)}</text>` : '') +
      `<text x="40" y="205" font-family="Georgia,system-ui,sans-serif" font-size="28" font-weight="700" fill="${fg}">${esc(clean)}</text>` +
      `<text x="40" y="242" font-family="system-ui,sans-serif" font-size="16" fill="${mut}">myshows · локальная карточка</text>` +
      `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function imgSrc(item, theme) {
    if (!item) return makePlaceholderDataUri('', '', theme);
    if (item.img) return item.img;
    if (item.imgRemote) return item.imgRemote;
    return makePlaceholderDataUri(item.title, item.year, theme);
  }

  function imgFallback(imgEl, title, year, theme) {
    if (!imgEl || imgEl.dataset.fallbackApplied === '1') return;
    imgEl.dataset.fallbackApplied = '1';
    imgEl.src = makePlaceholderDataUri(title || imgEl.dataset.title || '', year || imgEl.dataset.year || '', theme || imgEl.dataset.theme || 'sieve');
  }

  /* ---------- Состояние 5 групп фильтров ---------- */
  function createFilterState(defaultYear) {
    const y0 = Number(defaultYear) || 2026;
    return {
      years: new Set([y0]),
      completion: 'all',        // 'all' | 'ended' | 'ongoing'
      seasons: 'all',           // 'all' | '1' | '2-3' | '4+'
      runtime: 'all',           // 'all' | 'short' | 'long'
      listMode: 'all',          // 'all' | 'new_only' | 'planned'
      includeNicheWishlist: false,
      tasteOnly: false,
      hideDroppedRel: false,
      riskOnly: false,
      genresInclude: new Set(),
      genresExclude: new Set(),
      genreMatch: 'any',        // 'any' | 'all'
      countries: new Set(),
      networks: new Set(),
      minMyShows: 0,
      minImdb: 0,
      minKp: 0,
      query: '',
      sort: 'scoreNorm'
    };
  }

  function resetFilterState(F, defaultYear) {
    const fresh = createFilterState(defaultYear);
    F.years = fresh.years;
    F.completion = fresh.completion;
    F.seasons = fresh.seasons;
    F.runtime = fresh.runtime;
    F.listMode = fresh.listMode;
    F.includeNicheWishlist = fresh.includeNicheWishlist;
    F.tasteOnly = fresh.tasteOnly;
    F.hideDroppedRel = fresh.hideDroppedRel;
    F.riskOnly = fresh.riskOnly;
    F.genresInclude.clear();
    F.genresExclude.clear();
    F.genreMatch = 'any';
    F.countries.clear();
    F.networks.clear();
    F.minMyShows = 0;
    F.minImdb = 0;
    F.minKp = 0;
    F.query = '';
    F.sort = 'scoreNorm';
    return F;
  }

  function isDefaultYears(F, defaultYear) {
    const y0 = Number(defaultYear) || 2026;
    return F.years.size === 1 && F.years.has(y0);
  }

  function hasNonYearFilters(F) {
    return (
      F.completion !== 'all' ||
      F.seasons !== 'all' ||
      F.runtime !== 'all' ||
      F.listMode !== 'all' ||
      F.includeNicheWishlist ||
      F.tasteOnly ||
      F.hideDroppedRel ||
      F.riskOnly ||
      F.genresInclude.size > 0 ||
      F.genresExclude.size > 0 ||
      F.countries.size > 0 ||
      F.networks.size > 0 ||
      F.minMyShows > 0 ||
      F.minImdb > 0 ||
      F.minKp > 0 ||
      normSearch(F.query).length > 0
    );
  }

  function hasAnyActiveChange(F, defaultYear) {
    return !isDefaultYears(F, defaultYear) || hasNonYearFilters(F) || F.sort !== 'scoreNorm';
  }

  function activePresetKey(yearsSet) {
    const arr = Array.from(yearsSet).sort((a, b) => a - b);
    for (const pr of YEAR_PRESETS) {
      if (pr.years.length === arr.length && pr.years.every((y, i) => y === arr[i])) {
        return pr.key;
      }
    }
    return '';
  }

  function describeYears(yearsSet, mode) {
    const arr = Array.from(yearsSet).sort((a, b) => a - b);
    if (!arr.length) return mode === 'gen' ? '2026 года' : '2026';
    if (arr.length === 1) return mode === 'gen' ? `${arr[0]} года` : `${arr[0]}`;
    if (arr.length === 12 && arr[0] === 2015 && arr[11] === 2026) {
      return mode === 'gen' ? '2015–2026 годов (все 12 лет)' : '2015–2026';
    }
    let contig = true;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1] + 1) { contig = false; break; }
    }
    if (contig) {
      return mode === 'gen' ? `${arr[0]}–${arr[arr.length - 1]} годов` : `${arr[0]}–${arr[arr.length - 1]}`;
    }
    if (arr.length <= 4) {
      return mode === 'gen' ? `${arr.join(', ')} годов` : arr.join(', ');
    }
    return mode === 'gen' ? `${arr.length} выбранных лет (${arr[0]}…${arr[arr.length - 1]})` : `${arr.length} лет (${arr[0]}…${arr[arr.length - 1]})`;
  }

  /* ---------- Фильтрация и сортировка ---------- */
  function getSliceCandidates(D, F) {
    const base = (D.pool || []).filter(p => F.years.has(p.year));
    if (F.includeNicheWishlist && F.listMode !== 'new_only' && Array.isArray(D.wishlist_extra)) {
      const extra = D.wishlist_extra.filter(p => F.years.has(p.year));
      return base.concat(extra);
    }
    return base;
  }

  function isRiskItem(p) {
    return !!(p.isDroppedRel || (p.fit != null && p.fit < TASTE_LO) || CURATED_RISK_IDS.has(p.id));
  }

  function matchesFilters(p, F) {
    if (!F.years.has(p.year)) return false;

    // Group 2: завершённость, сезоны, длина серии
    if (F.completion === 'ended' && p.status !== 'Canceled/Ended') return false;
    if (F.completion === 'ongoing' && p.status === 'Canceled/Ended') return false;

    const sc = Number(p.seasons) || 0;
    if (F.seasons === '1' && sc !== 1) return false;
    if (F.seasons === '2-3' && (sc < 2 || sc > 3)) return false;
    if (F.seasons === '4+' && sc < 4) return false;

    const rt = Number(p.runtime) || 0;
    if (F.runtime === 'short' && !(rt > 0 && rt <= 35)) return false;
    if (F.runtime === 'long' && !(rt >= 40)) return false;

    // Group 3: списки и вкус
    if (F.listMode === 'new_only' && p.isPlanned) return false;
    if (F.listMode === 'planned' && !p.isPlanned) return false;
    if (!F.includeNicheWishlist && p.nicheWishlist) return false;
    if (F.tasteOnly && !(p.fit != null && p.fit > TASTE_HI)) return false;
    if (F.hideDroppedRel && p.isDroppedRel) return false;
    if (F.riskOnly && !isRiskItem(p)) return false;

    // Group 4: все жанры (плюс и минус), страны, стриминги
    const gs = Array.isArray(p.genres) ? p.genres : [];
    if (F.genresExclude.has('—') && gs.length === 0) return false;
    if (F.genresExclude.size > 0) {
      for (let i = 0; i < gs.length; i++) {
        if (F.genresExclude.has(gs[i])) return false;
      }
    }
    if (F.genresInclude.size > 0) {
      if (F.genreMatch === 'all') {
        for (const g of F.genresInclude) {
          if (g === '—') {
            if (gs.length > 0) return false;
          } else if (!gs.includes(g)) {
            return false;
          }
        }
      } else {
        let hit = false;
        for (const g of F.genresInclude) {
          if ((g === '—' && gs.length === 0) || gs.includes(g)) { hit = true; break; }
        }
        if (!hit) return false;
      }
    }

    if (F.countries.size > 0 && !F.countries.has(p.countryGroup || 'Другие')) return false;
    if (F.networks.size > 0 && !F.networks.has(p.networkGroup || 'Другие')) return false;

    // Group 5: пороги оценок и поиск RU/EN
    if (F.minMyShows > 0 && (Number(p.rating) || 0) < F.minMyShows) return false;
    if (F.minImdb > 0 && (Number(p.imdb) || 0) < F.minImdb) return false;
    if (F.minKp > 0 && (Number(p.kp) || 0) < F.minKp) return false;

    const q = normSearch(F.query);
    if (q) {
      const tRu = normSearch(p.title);
      const tEn = normSearch(p.orig);
      if (!tRu.includes(q) && !tEn.includes(q)) return false;
    }

    return true;
  }

  function premiereTime(value) {
    const raw = String(value || '');
    const m = /^([A-Za-z]{3})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    if (m) {
      const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase());
      return month >= 0 ? Date.UTC(+m[3], month, +m[2]) : 0;
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    return iso ? Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) : 0;
  }

  function sortItems(items, sortKey) {
    const arr = items.slice();
    const tie = (a, b) => (b.scoreNorm - a.scoreNorm) || (a.rankYear - b.rankYear) || (a.id - b.id);
    switch (sortKey) {
      case 'score':
        arr.sort((a, b) => (b.score - a.score) || (a.rankYear - b.rankYear) || (a.id - b.id));
        break;
      case 'fit':
        arr.sort((a, b) => ((b.fit == null ? -1 : b.fit) - (a.fit == null ? -1 : a.fit)) || tie(a, b));
        break;
      case 'imdb':
        arr.sort((a, b) => ((b.imdb || -1) - (a.imdb || -1)) || tie(a, b));
        break;
      case 'kp':
        arr.sort((a, b) => ((b.kp || -1) - (a.kp || -1)) || tie(a, b));
        break;
      case 'rating':
        arr.sort((a, b) => (b.rating - a.rating) || (b.voted - a.voted) || tie(a, b));
        break;
      case 'watching':
        arr.sort((a, b) => (b.watching - a.watching) || tie(a, b));
        break;
      case 'newest':
        arr.sort((a, b) => (b.year - a.year) || (premiereTime(b.started) - premiereTime(a.started)) || tie(a, b));
        break;
      case 'scoreNorm':
      default:
        arr.sort(tie);
        break;
    }
    return arr;
  }

  /* ---------- Воронка по активному срезу лет ---------- */
  function computeFunnelForYears(D, yearsSet) {
    const byYear = D.by_year || {};
    let catalogTotal = 0;
    let poolTotal = 0;
    const filters = {};
    let countYears = 0;
    for (const y of yearsSet) {
      const info = byYear[String(y)];
      if (!info) continue;
      countYears++;
      catalogTotal += Number(info.catalog_total) || 0;
      poolTotal += Number(info.pool_total) || 0;
      const fl = info.filters || {};
      for (const k of Object.keys(fl)) {
        filters[k] = (filters[k] || 0) + (Number(fl[k]) || 0);
      }
    }
    if (!countYears) {
      return {
        catalog_total: D.catalog_total || 0,
        pool_total: D.pool_total || 0,
        filters: Object.assign({}, D.filters || {}),
        C: D.C || 3.9
      };
    }
    const singleY = yearsSet.size === 1 ? byYear[String(Array.from(yearsSet)[0])] : null;
    return {
      catalog_total: catalogTotal,
      pool_total: poolTotal,
      filters,
      C: singleY ? singleY.C : D.C
    };
  }

  /* ---------- Живая витрина «Под ваш вкус» (8 карточек) ---------- */
  function statusLabelRu(statusCode) {
    return STATUS_RU[statusCode] || statusCode || 'в профиле';
  }

  function statusFormatRu(showStatus) {
    if (showStatus === 'Canceled/Ended') return 'сериал завершён';
    if (showStatus === 'Returning Series') return 'сериал продлён';
    if (showStatus === 'New Series') return 'новый сезон в эфире';
    return '';
  }

  function buildShowcaseNote(p) {
    if (CURATED_WHY_2026[p.id]) return CURATED_WHY_2026[p.id];
    const meta = [];
    if (p.year && p.year !== 2026) meta.push(`Премьера ${p.year} года`);
    if (p.countryTitle && p.countryTitle !== 'Не указана') meta.push(p.countryTitle);
    if (p.network) meta.push(p.network);
    const sf = statusFormatRu(p.status);
    if (p.seasons) {
      meta.push(`${p.seasons} ${pl(p.seasons, 'сезон', 'сезона', 'сезонов')}${sf ? ', ' + sf : ''}`);
    } else if (sf) {
      meta.push(sf);
    }
    if (p.runtime) meta.push(`серия ~${p.runtime} мин`);
    const head = meta.length ? meta.join(' · ') + '. ' : '';
    if (p.desc) {
      const shortDesc = p.desc.length > 185 ? p.desc.slice(0, 185).replace(/\s+\S*$/, '') + '…' : p.desc;
      return head + shortDesc;
    }
    return head + (p.genres && p.genres.length ? `Жанры: ${p.genres.join(', ')}.` : 'Высокий балл в выбранном срезе под ваш профиль.');
  }

  function computeShowcase(D, F, filteredItems) {
    const profMap = new Map((D.profile_items || []).map(x => [x.id, x]));
    const isDef2026 = isDefaultYears(F, D.default_year || 2026) && !hasNonYearFilters(F);
    const pool2026 = (D.pool || []).filter(p => p.year === 2026);
    const pool2026ById = new Map(pool2026.map(p => [p.id, p]));

    let active = [];
    let exitedStarter = [];
    let allMatchingTaste = [];

    if (isDef2026) {
      const chosenIds = new Set();
      for (const sid of STARTER_2026) {
        const inPool = pool2026ById.get(sid);
        if (inPool) {
          active.push(inPool);
          chosenIds.add(sid);
        } else {
          const pr = profMap.get(sid);
          const byProf = !!(pr && ((pr.watchStatus === 'watching' && (pr.watchedEpisodes || 0) > 0) || pr.watchStatus === 'finished' || pr.watchStatus === 'cancelled'));
          exitedStarter.push({
            id: sid,
            title: (pr && pr.title) || STARTER_TITLES_FALLBACK[sid] || 'Сериал',
            byProfile: byProf,
            statusRu: byProf ? pr.statusRu : 'выбыл из пула',
            watchedEpisodes: byProf ? pr.watchedEpisodes : 0,
            rating: byProf ? pr.rating : null
          });
        }
      }
      const restTaste = sortItems(
        pool2026.filter(p => !chosenIds.has(p.id) && p.fit != null && p.fit > TASTE_HI && !p.isDroppedRel),
        'scoreNorm'
      );
      while (active.length < 8 && restTaste.length > 0) {
        const next = restTaste.shift();
        active.push(next);
        chosenIds.add(next.id);
      }
      allMatchingTaste = active.concat(restTaste);
    } else {
      const source = F.riskOnly
        ? filteredItems
        : filteredItems.filter(p => p.fit != null && p.fit > TASTE_HI && !p.isDroppedRel);
      const sorted = sortItems(source, F.sort || 'scoreNorm');
      active = sorted.slice(0, 8);
      allMatchingTaste = sorted;
    }

    const activeIds = new Set(active.map(p => p.id));
    const profActiveExcluded = new Set(
      (D.profile_items || [])
        .filter(x => (x.watchStatus === 'watching' && (x.watchedEpisodes || 0) > 0) || x.watchStatus === 'finished' || x.watchStatus === 'cancelled')
        .map(x => x.id)
    );
    const moreCandidates = allMatchingTaste
      .filter(p => !activeIds.has(p.id) && !profActiveExcluded.has(p.id))
      .slice(0, 3);

    return {
      isDefault2026: isDef2026,
      cards: active,
      cardIds: activeIds,
      totalMatchingTaste: allMatchingTaste.length,
      exitedStarter,
      moreCandidates
    };
  }

  function formatExitedStarterHtml(exitedStarter, linkFn, wordEight) {
    if (!Array.isArray(exitedStarter) || !exitedStarter.length) return '';
    const allByProfile = exitedStarter.every(x => x.byProfile);
    const suffix = wordEight ? ' в восьмёрке' : '';
    const lead = allByProfile
      ? `<b>Уже отмечено вами и заменено следующим кандидатом${suffix}:</b> `
      : `<b>Выбыло из стартовой восьмёрки и заменено следующим кандидатом:</b> `;
    const items = exitedStarter.map(x => {
      const parts = [x.byProfile && !allByProfile ? `отмечено вами: ${x.statusRu}` : x.statusRu];
      if (x.watchedEpisodes > 0) parts.push(`${fmt(x.watchedEpisodes)} ${pl(x.watchedEpisodes, 'серия', 'серии', 'серий')}`);
      if (x.rating) parts.push(`оценка ${x.rating}`);
      return `${linkFn(x)} (${esc(parts.join(', '))})`;
    });
    return lead + items.join('; ') + '.';
  }

  /* ---------- Риски по активному срезу лет ---------- */
  function computeRisks(D, F, sliceItems) {
    const gMap = new Map((D.genres || []).map(g => [g.genre, g]));
    const rom = gMap.get('Романтика');
    const com = gMap.get('Комедия');
    const sliceById = new Map(sliceItems.map(p => [p.id, p]));

    if (F.years.has(2026) && F.years.size === 1) {
      const cards = CURATED_RISKS_2026
        .map(def => {
          const p = sliceById.get(def.id);
          if (!p) return null;
          return { item: p, kind: def.kind, reason: def.text(p, rom, com) };
        })
        .filter(Boolean);
      const used = new Set(cards.map(c => c.item.id));
      const more = sliceItems
        .filter(p => !used.has(p.id) && p.fit != null && p.fit < TASTE_LO && p.rating >= 4.0)
        .sort((a, b) => b.scoreNorm - a.scoreNorm)
        .slice(0, 3);
      return { cards, more };
    }

    // Для любого прошлого года или мультигодового среза строим честные карточки риска из реальных данных
    const cands = sortItems(
      sliceItems.filter(p => (p.isDroppedRel || (p.fit != null && p.fit < TASTE_LO)) && p.rating >= 3.9),
      'scoreNorm'
    );
    const cards = cands.slice(0, 4).map(p => {
      if (p.isDroppedRel) {
        return {
          item: p,
          kind: 'Связано с брошенным сериалом',
          reason: `Высокий зрительский балл (${p.rating.toFixed(2)}), но ${p.mark || 'предыдущий проект франшизы отмечен у вас брошенным'}.`
        };
      }
      const weakGenres = (p.genres || [])
        .map(gn => gMap.get(gn))
        .filter(g => g && (g.kept / (g.kept + g.dropped)) < TASTE_LO);
      if (weakGenres.length) {
        const wg = weakGenres[0];
        return {
          item: p,
          kind: `${wg.genre}: жанр риска по вашей истории`,
          reason: `Премьера ${p.year} года с высокой оценкой ${p.rating.toFixed(2)}, но в жанре «${wg.genre}» вы досмотрели или смотрите ${wg.kept} из ${wg.kept + wg.dropped} начатых.`
        };
      }
      return {
        item: p,
        kind: 'Низкое совпадение по жанрам',
        reason: `Зрительская оценка ${p.rating.toFixed(2)}, однако средний индекс досмотра этих жанров у вас ${p.fit != null ? p.fit.toFixed(2) : 'ниже порога'} (ниже ${TASTE_LO}).`
      };
    });
    const used = new Set(cards.map(c => c.item.id));
    const more = cands.filter(p => !used.has(p.id)).slice(0, 3);
    return { cards, more };
  }

  /* ---------- Двухслотовый визит и 4 окна динамики ---------- */
  function initVisitState(D, onServerSync) {
    const curUpd = String(D.updated || '');
    let st = null;
    try {
      const raw = global.localStorage && global.localStorage.getItem(VISIT_LS_KEY);
      if (raw) st = JSON.parse(raw);
    } catch (_e) {
      st = null;
    }
    const hadLocal = !!(st && typeof st === 'object' && st.currentSeen);
    if (!hadLocal) {
      st = {
        currentSeen: curUpd || BASELINE_GEN,
        previousSeen: BASELINE_GEN,
        lastWindow: 'visit'
      };
    } else {
      if (!st.previousSeen) st.previousSeen = BASELINE_GEN;
      if (curUpd && curUpd > st.currentSeen) {
        st.previousSeen = st.currentSeen;
        st.currentSeen = curUpd;
      }
      if (!['visit', '7d', '1d', 'baseline'].includes(st.lastWindow)) {
        st.lastWindow = 'visit';
      }
    }
    saveVisitStateLocal(st);
    return st;
  }

  function saveVisitStateLocal(st) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(VISIT_LS_KEY, JSON.stringify(st));
      }
    } catch (_e) { /* ignore quota/private errors */ }
  }

  function parseIsoMs(s) {
    if (!s) return NaN;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : NaN;
  }

  function selectSnapshotForWindow(D, windowKey, visitState) {
    const snaps = (D.history_snaps || []).slice().sort((a, b) => parseIsoMs(a.generated) - parseIsoMs(b.generated));
    if (!snaps.length) return { snap: null, incomplete: true, windowNote: 'Нет сохранённых снимков для сравнения.' };
    if (windowKey === 'baseline') {
      const base = snaps.find(s => s.date === BASELINE_DATE);
      return { snap: base || snaps[0], incomplete: !base,
        windowNote: base ? '' : 'Базовый снимок 15 ноября недоступен. Показан доступный период.' };
    }
    if (snaps.length === 1) return { snap: snaps[0], incomplete: true,
      windowNote: 'Есть только один снимок. Истории пока недостаточно для выбранного периода.' };
    const latestMs = parseIsoMs(D.updated) || parseIsoMs(snaps[snaps.length - 1].generated);
    const target = windowKey === 'visit'
      ? parseIsoMs((visitState && visitState.previousSeen) || BASELINE_GEN)
      : latestMs - (windowKey === '7d' ? 7 : 1) * 24 * 3600 * 1000;
    const before = snaps.filter(s => parseIsoMs(s.generated) <= target + 1000);
    const chosen = before.length ? before[before.length - 1] : snaps[0];
    const distance = Math.abs(parseIsoMs(chosen.generated) - target);
    const incomplete = windowKey === 'visit' ? distance > 1000 : (!before.length || distance > 3 * 3600 * 1000);
    let windowNote = '';
    if (incomplete) windowNote = windowKey === 'visit'
      ? 'Точный снимок прошлого открытия не сохранился. Сравниваем с ближайшим доступным снимком; начало периода указано выше.'
      : 'Для полного выбранного периода не хватает снимков. Показаны изменения за фактически доступный период, указанный выше.';
    return { snap: chosen, incomplete, windowNote };
  }

  function computeWindowDiff(D, windowKey, visitState, activeYearsSet) {
    const sel = selectSnapshotForWindow(D, windowKey, visitState);
    if (!sel.snap) {
      return {
        windowKey,
        since: '',
        sinceGenerated: '',
        yearsCompared: [],
        yearScopeNote: '',
        historyIncomplete: true,
        windowNote: sel.windowNote,
        hasAnyChanges: false,
        new_in_pool: [],
        left_pool: [],
        rank_moves: [],
        rating_moves: [],
        watching_growth: [],
        profile_changes: []
      };
    }

    const snap = sel.snap;
    const snapYears = Array.isArray(snap.years_covered) ? snap.years_covered : [2026];
    const activeArr = activeYearsSet ? Array.from(activeYearsSet) : [2026];
    let commonYears = snapYears.filter(y => !activeYearsSet || activeYearsSet.has(y));
    let yearScopeNote = '';
    if (!commonYears.length) {
      // Например, выбран только 2018 год, а сравниваем с 2026-11-15-baseline (где охвачен только 2026)
      yearScopeNote = `Выбранный снимок (${formatRuDateTime(snap.date === BASELINE_DATE ? BASELINE_DATE : snap.generated)}) охватывал только ${describeYears(new Set(snapYears), 'plain')}; ниже для базы показаны изменения по ${describeYears(new Set(snapYears), 'plain')}, а по вашему профилю — за все годы.`;
      commonYears = snapYears.slice();
    } else if (activeArr.length > commonYears.length) {
      yearScopeNote = `Сопоставимое пересечение лет со снимком: ${describeYears(new Set(commonYears), 'plain')} (без ложного «прироста» за годы, которых не было в старом снимке).`;
    }

    const yearsSet = new Set(commonYears);
    const pd = snap.pool_delta || { left: [], added_ids: [], prev: {} };
    const prd = snap.prof_delta || { left: [], added_ids: [], prev: {} };
    const addedSet = new Set(pd.added_ids || []);
    const prevMap = pd.prev || {};

    const curSub = (D.pool || []).filter(p => yearsSet.has(p.year));
    const newInPool = curSub
      .filter(p => addedSet.has(p.id))
      .sort((a, b) => (a.year - b.year) || (a.rankYear - b.rankYear))
      .map(p => ({ id: p.id, title: p.title, year: p.year, rank: p.rankYear, score: p.score }));

    const leftPool = (pd.left || [])
      .filter(x => yearsSet.has(Number(x.year) || 2026))
      .map(x => ({ id: x.id, title: x.title, year: x.year || 2026, rank: x.rankYear || x.rank }));

    const rankMoves = [];
    const ratingMoves = [];
    const watchingGrowth = [];

    for (const p of curSub) {
      const pv = prevMap[String(p.id)];
      if (!pv) continue;
      const oRank = pv[0], oRating = pv[2], oWatch = pv[3];
      if (Math.min(oRank, p.rankYear) <= 50 && Math.abs(oRank - p.rankYear) >= 3) {
        rankMoves.push({ id: p.id, title: p.title, year: p.year, from: oRank, to: p.rankYear });
      }
      if (oRating != null && (p.voted || 0) >= 100 && Math.abs(p.rating - oRating) >= 0.05 - 1e-9) {
        ratingMoves.push({ id: p.id, title: p.title, year: p.year, from: +Number(oRating).toFixed(2), to: +Number(p.rating).toFixed(2) });
      }
      if (oWatch != null && p.watching > oWatch) {
        watchingGrowth.push({ id: p.id, title: p.title, year: p.year, from: oWatch, to: p.watching });
      }
    }
    rankMoves.sort((a, b) => (a.year - b.year) || (a.to - b.to));
    ratingMoves.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
    watchingGrowth.sort((a, b) => (b.to - b.from) - (a.to - a.from));

    // Изменения профиля владельца считаются по всем годам профиля KACTET
    const curProfById = new Map((D.profile_items || []).map(x => [x.id, x]));
    const profChanges = [];
    for (const sid of (prd.added_ids || [])) {
      const n = curProfById.get(sid);
      if (!n || !n.id || !n.title) continue;
      profChanges.push({
        id: n.id, title: n.title, year: n.year,
        from_status: null, to_status: n.watchStatus,
        from_episodes: 0, to_episodes: n.watchedEpisodes || 0,
        from_rating: null, to_rating: n.rating || null
      });
    }
    const prevProf = prd.prev || {};
    for (const sidStr of Object.keys(prevProf)) {
      const sid = Number(sidStr);
      const n = curProfById.get(sid);
      if (!n || !n.id || !n.title) continue;
      const pv = prevProf[sidStr];
      profChanges.push({
        id: n.id, title: n.title, year: n.year,
        from_status: pv[0], to_status: n.watchStatus,
        from_episodes: pv[1] || 0, to_episodes: n.watchedEpisodes || 0,
        from_rating: pv[2] || null, to_rating: n.rating || null
      });
    }
    for (const x of (prd.left || [])) {
      if (!x || !x.id || !x.title) continue;
      profChanges.push({
        id: x.id, title: x.title, year: x.year,
        from_status: x.watchStatus, to_status: null,
        from_episodes: x.watchedEpisodes || 0, to_episodes: 0,
        from_rating: x.rating || null, to_rating: null
      });
    }

    const hasAny = !!(newInPool.length || leftPool.length || rankMoves.length || ratingMoves.length || watchingGrowth.length || profChanges.length);

    return {
      windowKey,
      since: snap.date,
      sinceGenerated: snap.generated,
      yearsCompared: commonYears,
      yearScopeNote,
      historyIncomplete: !!sel.incomplete,
      windowNote: sel.windowNote || '',
      hasAnyChanges: hasAny,
      new_in_pool: newInPool.slice(0, 60),
      left_pool: leftPool.slice(0, 60),
      rank_moves: rankMoves.slice(0, 50),
      rating_moves: ratingMoves.slice(0, 50),
      watching_growth: watchingGrowth.slice(0, 15),
      profile_changes: profChanges
    };
  }

  function formatProfileChangeDetail(ch) {
    const parts = [];
    if (!ch.from_status && ch.to_status) {
      parts.push(`добавлено в «${statusLabelRu(ch.to_status)}»`);
    } else if (ch.from_status && !ch.to_status) {
      parts.push(`убрано из профиля (было «${statusLabelRu(ch.from_status)}»)`);
    } else if (ch.from_status !== ch.to_status) {
      parts.push(`из «${statusLabelRu(ch.from_status)}» в «${statusLabelRu(ch.to_status)}»`);
    } else if (ch.to_status) {
      parts.push(`статус «${statusLabelRu(ch.to_status)}»`);
    }
    if ((ch.from_episodes || 0) !== (ch.to_episodes || 0)) {
      if (!ch.from_episodes && ch.to_episodes > 0) {
        parts.push(`${fmt(ch.to_episodes)} ${pl(ch.to_episodes, 'серия', 'серии', 'серий')}`);
      } else {
        const diff = (ch.to_episodes || 0) - (ch.from_episodes || 0);
        const sign = diff > 0 ? `+${fmt(diff)}` : fmt(diff);
        parts.push(`серии ${fmt(ch.from_episodes)} → ${fmt(ch.to_episodes)} (${sign})`);
      }
    } else if (ch.to_status === 'watching' && !(ch.to_episodes > 0)) {
      parts.push('0 серий — на очереди');
    }
    const fr = ch.from_rating || null;
    const tr = ch.to_rating || null;
    if (fr !== tr) {
      if (!fr && tr) parts.push(`ваша оценка ${tr}`);
      else if (fr && !tr) parts.push(`снята оценка ${fr}`);
      else parts.push(`ваша оценка ${fr} → ${tr}`);
    }
    return parts.join(', ');
  }

  /* ---------- Сопоставимые графики истории без ложного скачка 158 → 2958 ---------- */
  function computeComparableHistoryCharts(D, activeYearsSet) {
    const hs = Array.isArray(D.history) ? D.history : [];
    if (hs.length < 2) return [];
    const activeArr = activeYearsSet ? Array.from(activeYearsSet).sort((a, b) => a - b) : [2026];

    // Проверяем, есть ли минимум 2 снимка, покрывающие все активные годы
    const fullMatchSnaps = hs.filter(h => {
      const cov = new Set(h.years_covered || [2026]);
      return activeArr.every(y => cov.has(y));
    });

    let plotSnaps = hs;
    let plotYears = [2026];

    if (fullMatchSnaps.length >= 2) {
      plotSnaps = fullMatchSnaps;
      plotYears = activeArr;
    } else {
      // Пересечение лет всех снимков истории (включает 2026 из baseline)
      let common = new Set(hs[0].years_covered || [2026]);
      for (let i = 1; i < hs.length; i++) {
        const s = new Set(hs[i].years_covered || [2026]);
        common = new Set(Array.from(common).filter(y => s.has(y)));
      }
      plotYears = common.size ? Array.from(common).sort((a, b) => a - b) : [2026];
    }

    const yLabel = describeYears(new Set(plotYears), 'plain');
    const sumByYear = (h, field) => {
      const by = h.by_year || {};
      let acc = 0;
      let ok = false;
      for (const y of plotYears) {
        if (by[String(y)] && by[String(y)][field] != null) {
          acc += Number(by[String(y)][field]) || 0;
          ok = true;
        }
      }
      return ok ? acc : (Number(h[field]) || 0);
    };

    const dates = plotSnaps.map(h => h.date);
    const gens = plotSnaps.map(h => h.generated || h.date);
    return [
      {
        key: 'catalog_total',
        label: `Премьер в каталоге (${yLabel})`,
        values: plotSnaps.map(h => sumByYear(h, 'catalog_total')),
        dates,
        generated: gens
      },
      {
        key: 'pool_total',
        label: `В подборке после фильтров (${yLabel})`,
        values: plotSnaps.map(h => sumByYear(h, 'pool_total')),
        dates,
        generated: gens
      },
      {
        key: 'profile_total',
        label: 'Сериалов в вашем профиле (все годы)',
        values: plotSnaps.map(h => Number(h.profile_total) || 0),
        dates,
        generated: gens
      }
    ];
  }

  function describeRefreshStatus(D) {
    return {hasError: false,
      text: `Сохраненные отметки: ${formatRuDateTime(D.updated)} · каталог: ${formatRuDateTime(D.catalog_updated || D.updated)}`};
  }

  /* ---------- Списки жанров в активном срезе ---------- */
  function collectGenreCounts(items) {
    const counts = {};
    let noGenre = 0;
    for (const p of items) {
      const gs = Array.isArray(p.genres) ? p.genres : [];
      if (!gs.length) {
        noGenre++;
      } else {
        for (const g of gs) counts[g] = (counts[g] || 0) + 1;
      }
    }
    const sorted = Object.keys(counts).sort((a, b) => (counts[b] - counts[a]) || a.localeCompare(b, 'ru'));
    return { counts, sorted, noGenre };
  }

  global.SerialsCore = {
    TASTE_HI,
    TASTE_LO,
    YEAR_PRESETS,
    COUNTRY_GROUPS,
    NETWORK_GROUPS,
    SORT_MODES,
    STATUS_RU,
    fmt,
    esc,
    pl,
    normSearch,
    formatRuDateTime,
    formatRuDateShort,
    imgSrc,
    imgFallback,
    makePlaceholderDataUri,
    createFilterState,
    resetFilterState,
    isDefaultYears,
    hasNonYearFilters,
    hasAnyActiveChange,
    activePresetKey,
    describeYears,
    getSliceCandidates,
    isRiskItem,
    matchesFilters,
    sortItems,
    computeFunnelForYears,
    buildShowcaseNote,
    computeShowcase,
    formatExitedStarterHtml,
    computeRisks,
    initVisitState,
    saveVisitStateLocal,
    computeWindowDiff,
    formatProfileChangeDetail,
    computeComparableHistoryCharts,
    describeRefreshStatus,
    collectGenreCounts
  };
})(window);
