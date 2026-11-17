(function (global) {
  'use strict';
  const states = new WeakMap();
  function render(D, host) {
    if (!host) return;
    const C = global.SerialsCore, E = C.esc, F = C.fmt;
    const state = states.get(host) || {mode: 'absolute', scope: 'all', publicMore: false, growthMore: false};
    states.set(host, state);
    const T = D.trends || {}, P = T.public || {}, groups = T.growth_groups || {'2026': T.growth}, G = groups[state.scope];
    const date = value => value ? value.slice(0, 10).split('-').reverse().join('.') : '';
    const percent = value => value === null ? 'рост с нуля' : value < 0.01 ? '<0,01%' : `+${value.toLocaleString('ru-RU', {maximumFractionDigits: 2})}%`;
    const link = x => `<a href="https://myshows.me/view/${Number(x.id)}/" target="_blank" rel="noopener">${E(x.title)}</a>`;
    const source = '<a href="https://myshows.me/ratings/trends/" target="_blank" rel="noopener">Рейтинг MyShows</a>';
    const publicItems = P.items || [];
    let publicBody = '<p>Рейтинг пока недоступен. Он появится после успешного обновления.</p>';
    if (publicItems.length) {
      const visible = state.publicMore ? publicItems : publicItems.slice(0, 5);
      publicBody = `<ol class="tr-list tr-public">${visible.map(x => `<li><span class="tr-rank">${x.rank}</span><div>${link(x)}<small>${x.year || ''}</small></div><span class="tr-rating">${typeof x.rating === 'number' ? x.rating.toFixed(2) + ' / 5' : ''}</span></li>`).join('')}</ol>`;
      if (publicItems.length > 5) publicBody += `<button type="button" class="tr-more" data-more="public" aria-expanded="${state.publicMore}">${state.publicMore ? 'Свернуть до пяти' : 'Показать все ' + publicItems.length}</button>`;
    }
    const status = publicItems.length ? `${P.ok === false || P.stale ? 'Показан сохранённый рейтинг' : 'Обновлён'} ${C.formatRuDateTime(P.updated)}.` : '';
    let growthBody = '<p>Для расчёта нужны снимки каталога за два разных дня. Первый снимок будет сравнен со следующим обновлением.</p>';
    if (G) {
      const items = G[state.mode] || [], visible = state.growthMore ? items : items.slice(0, 5);
      growthBody = `<p class="tr-period">Сравнение ${date(G.from_date)} и ${date(G.to_date)}</p>${G.limited_history ? `<p class="tr-coverage">История прошлых лет неполная: сравниваются только сериалы из сохранённой прежней подборки. ${G.first_full_date ? `Общий каталог без личного отбора сохраняется с ${date(G.first_full_date)}.` : ''}</p>` : ''}` +
        `<div class="tr-controls" role="group" aria-label="Сортировка роста популярности"><button type="button" data-mode="absolute" aria-pressed="${state.mode === 'absolute'}">По приросту аудитории</button><button type="button" data-mode="relative" aria-pressed="${state.mode === 'relative'}">По росту в %</button></div>` +
        `<p class="tr-explain">${state.mode === 'relative' ? 'Для сравнения темпа: не менее 1 000 смотрящих в первом снимке.' : 'Разница счётчика смотрящих MyShows между двумя снимками.'}</p>` +
        (items.length ? `<ol class="tr-list tr-growth">${visible.map((x, i) => `<li><span class="tr-rank">${i + 1}</span><div>${link(x)}<small>${x.year ? x.year + ' · ' : ''}${F(x.before)} → ${F(x.after)} смотрящих</small></div><div class="tr-number"><strong>+${F(x.delta)}</strong><small>${percent(x.percent)}</small></div></li>`).join('')}</ol>` : `<p class="tr-empty">${state.mode === 'relative' ? 'Нет сериалов с положительным приростом и базой от 1 000 смотрящих.' : 'За этот период положительный прирост не зафиксирован.'}</p>`) +
        (items.length > 5 ? `<button type="button" class="tr-more" data-more="growth" aria-expanded="${state.growthMore}">${state.growthMore ? 'Свернуть до пяти' : 'Показать все ' + items.length}</button>` : '') +
        `<p class="tr-note">Сопоставлено ${F(G.compared)} сериалов; рост у ${F(G.growing)}. ${G.new_ids ? `${F(G.new_ids)} записей без предыдущего наблюдения в расчёт прироста не входят. ` : ''}Период между снимками может отличаться от суток. Это динамика MyShows, а не число просмотров серий.</p>`;
    }
    host.innerHTML = `<div class="tr-columns"><div class="tr-block"><h3>Популярное за месяц</h3><p class="tr-period">Все годы выпуска. Порядок из общего рейтинга MyShows за 30 дней.</p>${publicBody}<p class="tr-note">${source}. ${E(status)} Полная методика рейтинга на странице источника не раскрыта.</p></div><div class="tr-block"><h3>Что набирает аудиторию</h3><p class="tr-scope">${state.scope === 'all' ? 'Годы премьеры: 2015-2026.' : state.scope === 'past' ? 'Годы премьеры: 2015-2025.' : 'Премьеры 2026 года.'} Сравниваются доступные наблюдения MyShows.</p><div class="tr-controls tr-years" role="group" aria-label="Годы выпуска для роста популярности">${[['all','Все 2015-2026'],['past','Прошлые годы'],['2026','Премьеры 2026']].map(([key,label]) => `<button type="button" data-scope="${key}" aria-pressed="${state.scope === key}">${label}</button>`).join('')}</div>${growthBody}</div></div><p class="tr-foot">Показан сохраненный срез трендов. Периоды указаны у списков; новые данные появляются после публикации следующего среза.</p>`;
    host.querySelectorAll('[data-scope]').forEach(button => button.onclick = () => {
      state.scope = button.dataset.scope; state.growthMore = false; render(D, host);
      host.querySelector(`[data-scope="${state.scope}"]`).focus({preventScroll: true});
    });
    host.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
      state.mode = button.dataset.mode; render(D, host);
      host.querySelector(`[data-mode="${state.mode}"]`).focus({preventScroll: true});
    });
    host.querySelectorAll('[data-more]').forEach(button => button.onclick = () => {
      const type = button.dataset.more; state[type + 'More'] = !state[type + 'More']; render(D, host);
      host.querySelector(`[data-more="${type}"]`).focus({preventScroll: true});
    });
  }
  global.SerialsTrends = {render};
})(window);
