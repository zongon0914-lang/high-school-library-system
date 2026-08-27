/* ===== 高中數位資源圖書館 — 互動邏輯 ===== */

const SECTIONS = [
  { type: 'magazine',  label: '期刊雜誌', platform: 'KONO 電子雜誌', layout: 'cards',
    home: 'https://library.thekono.com/ljsh/libraries/chinese' },
  { type: 'ebook',     label: '電子書',   platform: 'TumbleBook Library', layout: 'cards',
    home: 'https://www.tumblebooklibrary.com/auto_login.aspx?U=ntl&P=libra' },
  { type: 'audiobook', label: '有聲書 — 小魯數位', platform: '小魯數位有聲書 (LibriSpace)', layout: 'tiles',
    home: 'https://librispace.flysheet.com.tw/' },
  { type: 'flybook',   label: '有聲書 — 飛聽Book', platform: '飛聽Book 有聲書平台', layout: 'tiles',
    home: 'https://flybook.flysheet.com.tw/' },
  { type: 'newspaper', label: '電子報紙', platform: 'The New York Times', layout: 'news',
    home: 'https://www.nytimes.com/' },
];

const TYPE_LABEL = { magazine: '雜誌', newspaper: '報紙', ebook: '電子書', audiobook: '有聲書', flybook: '有聲書' };


let activeTab      = 'all';
let keyword        = '';
let activeCategory = null;   // { type, name } or null

/* ---------- 建立畫面 ---------- */
function render() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  let shown = 0;

  SECTIONS.forEach(sec => {
    if (activeTab !== 'all' && activeTab !== sec.type) return;
    if (activeCategory && activeCategory.type !== sec.type) return;

    // 新聞牆是純展示區塊：搜尋或分類篩選時整區隱藏，不混進館藏查詢結果
    const isNews = sec.layout === 'news';
    if (isNews && (keyword || activeCategory)) return;

    const items = isNews ? (LIBRARY_DATA[sec.type] || [])
                         : (LIBRARY_DATA[sec.type] || []).filter(matches);
    if (!items.length) return;
    shown += items.length;

    const el = document.createElement('section');
    el.className = 'section';
    el.dataset.type = sec.type;
    el.id = 'sec-' + sec.type;

    el.innerHTML = `
      <div class="section-head">
        <h2>${sec.label}</h2>
        <span class="platform">${sec.platform}</span>
        <span class="count">共 ${items.length} ${isNews ? '個頭版欄目' : '筆'}</span>
      </div>
      <div class="grid"></div>`;

    if (isNews) {
      el.querySelector('.grid').replaceWith(makeNewsGrid(items));
      if (LIBRARY_DATA.newspaperSections) {
        el.appendChild(makeNewsSectionIndex(LIBRARY_DATA.newspaperSections));
      }
      el.insertAdjacentHTML('beforeend',
        '<p class="m-note">＊ 新聞標題與圖片擷取自 The New York Times，點擊可前往原文閱讀。</p>');
    } else {
      const grid = el.querySelector('.grid');
      if (sec.layout === 'tiles') grid.classList.add('grid-tiles');
      items.forEach(item => grid.appendChild(makeCard(item, sec)));
    }
    main.appendChild(el);
  });

  if (!shown) {
    main.innerHTML = `<p class="empty">找不到符合「${escapeHtml(keyword)}」的資源，換個關鍵字試試看。</p>`;
  }
}

/* ---------- 單張書封卡片 ---------- */
function makeCard(item, sec) {
  // 有聲書分類磚：直接點進該系列頁面
  if (item.tile) {
    const tile = document.createElement('a');
    tile.className = 'tile-card';
    tile.href = item.link;
    tile.target = '_blank';
    tile.rel = 'noopener';
    // 飛聽Book 磚加上文字標籤覆蓋層
    const label = item.type === 'flybook'
      ? `<div class="tile-label"><span class="tile-label-title">${escapeHtml(item.title)}</span><span class="tile-label-sub">${escapeHtml(item.subtitle || '')}</span></div>`
      : '';
    tile.innerHTML = `<img src="${item.file}" alt="${escapeHtml(item.title)} ${escapeHtml(item.subtitle || '')}" loading="lazy">${label}`;
    return tile;
  }

  const card = document.createElement('div');
  card.className = 'card';

  const sub = item.author || item.subtitle || '';

  card.innerHTML = `
    <div class="cover-wrap">
      <span class="badge ${item.type}">${TYPE_LABEL[item.type]}</span>
      <button class="heart" title="加入收藏">&#10084;</button>
      <img class="cover" src="${item.file}" alt="${escapeHtml(item.title)}" loading="lazy">
    </div>
    <div class="meta">
      <div class="title">${escapeHtml(item.title)}</div>
      ${sub ? `<div class="author">${escapeHtml(sub)}</div>` : ''}
    </div>`;

  // 愛心收藏（純視覺）
  card.querySelector('.heart').addEventListener('click', e => {
    e.stopPropagation();
    e.currentTarget.classList.toggle('on');
  });

  // 每張封面都可以點進詳情
  card.addEventListener('click', () => openModal(item, sec));

  return card;
}

/* ---------- 新聞牆（NYT 各分類，圖片與標題皆連原文） ---------- */
function makeNewsGrid(items) {
  const wrap = document.createElement('div');
  wrap.className = 'news-grid';

  wrap.innerHTML = items.map(col => {
    const lead = col.headlines[0];
    const list = col.headlines.map(h =>
      `<li><a href="${h.link}" target="_blank" rel="noopener">${escapeHtml(h.title)}</a></li>`
    ).join('');
    const zh = col.zh ? `<span class="news-cat-zh">${escapeHtml(col.zh)}</span>` : '';

    return `
      <div class="news-col">
        <a class="news-cat" href="${col.link}" target="_blank" rel="noopener">${escapeHtml(col.category)}${zh}</a>
        <a class="news-photo-link" href="${lead.link}" target="_blank" rel="noopener">
          <img class="news-photo" src="${col.image}" alt="${escapeHtml(lead.title)}" loading="lazy">
        </a>
        <ul class="news-list">${list}</ul>
      </div>`;
  }).join('');

  return wrap;
}

/* ---------- NYT 完整分類索引（折疊） ---------- */
function makeNewsSectionIndex(groups) {
  const box = document.createElement('div');
  box.className = 'news-index';

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'news-index-head';
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  head.innerHTML =
    `<span class="news-index-title">瀏覽紐約時報全部分類</span>` +
    `<span class="news-index-n">${total}</span>` +
    `<span class="cat-caret">&#8250;</span>`;

  const body = document.createElement('div');
  body.className = 'news-index-body';
  body.hidden = true;
  body.innerHTML = groups.map(g => `
    <div class="news-index-group">
      <div class="news-index-group-title">${escapeHtml(g.zh)}<span>${escapeHtml(g.group)}</span></div>
      <div class="news-index-links">${g.items.map(it =>
        `<a href="${it.link}" target="_blank" rel="noopener">${escapeHtml(it.zh)}<span>${escapeHtml(it.name)}</span></a>`
      ).join('')}</div>
    </div>`).join('');

  head.addEventListener('click', () => {
    const open = box.classList.toggle('open');
    body.hidden = !open;
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  head.setAttribute('aria-expanded', 'false');

  box.appendChild(head);
  box.appendChild(body);
  return box;
}

/* ---------- 搜尋 + 分類比對 ---------- */
function matches(item) {
  if (activeCategory && item.category !== activeCategory.name) return false;
  if (!keyword) return true;
  const k = keyword.toLowerCase();
  const hay = [item.title, item.author, item.subtitle, item.source, item.category]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(k);
}

/* ---------- Modal ---------- */
function openModal(item, sec) {
  document.getElementById('m-img').src      = item.file;
  document.getElementById('m-title').textContent  = item.title;
  document.getElementById('m-author').textContent = item.author || item.subtitle || '';

  const rows = [
    ['資源類型', TYPE_LABEL[item.type]],
    ['來源平台', sec.platform],
  ];
  if (item.category) rows.push(['所屬分類', item.category]);
  if (item.format)   rows.push(['版本', item.format]);
  rows.push(['借閱方式', '校內 IP 或帳號登入後即可線上閱讀']);

  document.getElementById('m-rows').innerHTML =
    rows.map(([k, v]) => `<div><span>${k}</span><span>${escapeHtml(v)}</span></div>`).join('');

  document.getElementById('m-go').href = item.link || sec.home;
  document.getElementById('modal-bg').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('show');
}

document.getElementById('modal-bg').addEventListener('click', e => {
  if (e.target.id === 'modal-bg') closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- 左側分類抽屜 ---------- */
// 記住哪些主題是展開的；預設全部收起，使用者點主題才展開分類
const openGroups = new Set();

function buildCategorySidebar() {
  const body = document.getElementById('cat-drawer-body');
  body.innerHTML = '';

  SECTIONS.forEach(sec => {
    if (sec.layout === 'news') return;

    const items = LIBRARY_DATA[sec.type] || [];
    const counts = {};
    items.forEach(it => { counts[it.category] = (counts[it.category] || 0) + 1; });
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    if (!cats.length) return;

    // 目前篩選中的主題自動展開
    if (activeCategory && activeCategory.type === sec.type) openGroups.add(sec.type);
    const isOpen = openGroups.has(sec.type);

    const group = document.createElement('div');
    group.className = 'cat-group' + (isOpen ? ' open' : '');

    const head = document.createElement('button');
    head.className = 'cat-group-title ' + sec.type;
    head.type = 'button';
    head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    head.innerHTML =
      '<span class="dot"></span>' +
      '<span class="cat-group-name">' + escapeHtml(sec.label) + '</span>' +
      '<span class="cat-group-n">' + cats.length + '</span>' +
      '<span class="cat-caret">&#8250;</span>';

    const list = document.createElement('div');
    list.className = 'cat-group-list';
    list.hidden = !isOpen;

    head.addEventListener('click', () => {
      const nowOpen = !group.classList.contains('open');
      if (nowOpen) openGroups.add(sec.type); else openGroups.delete(sec.type);
      group.classList.toggle('open', nowOpen);
      head.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      list.hidden = !nowOpen;
    });

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-item';
      btn.dataset.type = sec.type;
      btn.dataset.cat = cat;
      if (activeCategory && activeCategory.type === sec.type && activeCategory.name === cat) {
        btn.classList.add('on');
      }
      btn.innerHTML = '<span>' + escapeHtml(cat) + '</span><span class="n">' + counts[cat] + '</span>';
      btn.addEventListener('click', () => {
        activeCategory = { type: sec.type, name: cat };
        activeTab = sec.type;
        syncTabButtons();
        closeDrawer();
        updateActiveFilterBanner();
        buildCategorySidebar();
        render();
      });
      list.appendChild(btn);
    });

    group.appendChild(head);
    group.appendChild(list);
    body.appendChild(group);
  });
}

function syncTabButtons() {
  document.querySelectorAll('#tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === activeTab);
  });
}

function updateActiveFilterBanner() {
  const bar = document.getElementById('active-filter');
  const label = document.getElementById('active-filter-label');
  if (activeCategory) {
    const secLabel = SECTIONS.find(s => s.type === activeCategory.type)?.label || '';
    label.textContent = `${secLabel} - ${activeCategory.name}`;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

function clearCategory() {
  activeCategory = null;
  updateActiveFilterBanner();
  buildCategorySidebar();
  render();
}

document.getElementById('active-filter-clear').addEventListener('click', clearCategory);

function openDrawer() {
  document.getElementById('cat-drawer').classList.add('show');
  document.getElementById('cat-backdrop').classList.add('show');
  document.getElementById('cat-toggle').classList.add('hide');
}
function closeDrawer() {
  document.getElementById('cat-drawer').classList.remove('show');
  document.getElementById('cat-backdrop').classList.remove('show');
  document.getElementById('cat-toggle').classList.remove('hide');
}
document.getElementById('cat-toggle').addEventListener('click', openDrawer);
document.getElementById('cat-close').addEventListener('click', closeDrawer);
document.getElementById('cat-backdrop').addEventListener('click', closeDrawer);

/* ---------- 分類 tab ---------- */
document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  activeTab = btn.dataset.t;
  syncTabButtons();
  if (activeCategory && activeCategory.type !== activeTab) {
    activeCategory = null;
    updateActiveFilterBanner();
    buildCategorySidebar();
  }
  render();
});

/* ---------- 搜尋框 ---------- */
document.getElementById('q').addEventListener('input', e => {
  keyword = e.target.value.trim();
  render();
});

/* ---------- 工具 ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 啟動 ---------- */
document.getElementById('s-mag').textContent  = LIBRARY_DATA.magazine.length;
document.getElementById('s-news').textContent = LIBRARY_DATA.newspaperSections
  ? LIBRARY_DATA.newspaperSections.reduce((n, g) => n + g.items.length, 0)
  : LIBRARY_DATA.newspaper.length;
document.getElementById('s-ebk').textContent  = LIBRARY_DATA.ebook.length;
document.getElementById('s-aud').textContent  = (LIBRARY_DATA.audiobook.length + (LIBRARY_DATA.flybook ? LIBRARY_DATA.flybook.length : 0));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
buildCategorySidebar();
render();
