'use strict';

/* ------------------------------------------------------------------
 * 共有されたASIN／Amazonリンクを商品リスト化し、
 * 鈴鹿市周辺の店舗ごとに在庫有無と店頭価格を記録する。
 * データはすべてlocalStorageに保存する（外部送信なし）。
 * ------------------------------------------------------------------ */

var STORAGE_KEY = 'amazonProductList.v1';
var SETTING_KEY = 'amazonProductList.settings.v1';
var STORE_KEY = 'amazonProductList.stores.v1';

var STATUSES = ['未確認', '検討中', '仕入済', '出品済', '見送り'];
var STOCK_STATES = ['未確認', 'あり', 'なし'];

/* 鈴鹿市周辺の店舗（公開情報を元にした初期値。ユーザーが編集・追加できる） */
var DEFAULT_STORES = [
  { id: 'donki-suzuka', name: 'ドン・キホーテ 鈴鹿店', address: '鈴鹿市磯山4-6-18', note: '9:00-翌3:00' },
  { id: 'mega-donki-uny', name: 'MEGAドン・キホーテUNY 鈴鹿店', address: '鈴鹿市南玉垣町3628', note: '8:00-24:00' },
  { id: 'yamada-suzuka', name: 'ヤマダデンキ テックランド鈴鹿店', address: '鈴鹿市北玉垣町中野787', note: '家電' },
  { id: 'ks-suzuka', name: 'ケーズデンキ 鈴鹿店', address: '鈴鹿市算所町山之相419-1', note: '家電' },
  { id: 'edion-aeonmall', name: 'エディオン イオンモール鈴鹿店', address: '鈴鹿市庄野羽山4-1-2 ウエスト2F', note: '家電' },
  { id: 'kohnan-aeontown', name: 'コーナン イオンタウン鈴鹿店', address: '鈴鹿市庄野羽山4-20-1', note: 'ホームセンター' },
  { id: 'vivahome-suzuka', name: 'スーパービバホーム 鈴鹿店', address: '鈴鹿市住吉町8910', note: 'ホームセンター' },
  { id: 'dcm-suzuka', name: 'DCM 鈴鹿店', address: '鈴鹿市北玉垣町中野784', note: 'ホームセンター' },
  { id: 'aeonmall-suzuka', name: 'イオンモール鈴鹿', address: '鈴鹿市庄野羽山4-1-2', note: 'モール' },
  { id: 'aeon-suzuka', name: 'イオン鈴鹿店', address: '', note: '総合スーパー' },
  { id: 'suzuka-hunter', name: '鈴鹿ハンターショッピングセンター', address: '鈴鹿市算所2-5-1', note: 'モール' },
  { id: 'bookoff-hunter', name: 'BOOKOFF 鈴鹿ハンター店', address: '鈴鹿市算所2-5-1 2F', note: 'リユース' },
  { id: 'hardoff-circuit', name: 'ハードオフ・オフハウス 鈴鹿サーキット通り店', address: '鈴鹿市稲生', note: 'リユース' },
  { id: 'geo-saijo', name: 'ゲオ 鈴鹿西条店', address: '', note: 'ゲーム・リユース' },
  { id: 'secondstreet-saijo', name: 'セカンドストリート 鈴鹿西条店', address: '', note: 'リユース' },
  { id: 'birthday-tamagaki', name: 'バースデイ イオンタウン鈴鹿玉垣店', address: '鈴鹿市南玉垣町5520-106', note: 'ベビー・子供用品' },
  { id: 'daiso-mega-donki', name: 'ダイソー MEGAドン・キホーテUNY鈴鹿店', address: '鈴鹿市南玉垣町3628', note: '100均' },
  { id: 'komeri-suzuka', name: 'コメリハード＆グリーン 鈴鹿店', address: '', note: 'ホームセンター・ペット' },
  { id: 'komeri-pro-shiroko', name: 'コメリPRO 鈴鹿白子店', address: '', note: 'ホームセンター・ペット' },
  { id: 'valor-suzuka', name: 'ホームセンターバロー 鈴鹿店（ペット大好き併設）', address: '鈴鹿市東旭が丘', note: 'ホームセンター・ペット' },
  { id: 'aoki-sumiyoshi', name: 'クスリのアオキ 鈴鹿住吉店', address: '', note: 'ドラッグストア' },
  { id: 'aoki-sanjo', name: 'クスリのアオキ 算所店', address: '', note: 'ドラッグストア' },
  { id: 'sugi-sumiyoshi', name: 'スギ薬局 鈴鹿住吉店', address: '鈴鹿市住吉3-20-1', note: 'ドラッグストア' }
];

var STORE_VERSION = 2;

var AMAZON_HOST = /(^|\.)(amazon\.(co\.jp|com|co\.uk|de|fr|it|es|ca|com\.mx|com\.au|in|nl|se|pl|com\.tr|sg|ae|sa|com\.br)|amzn\.asia|amzn\.to|a\.co)$/i;
var ASIN_PATTERNS = [
  /\/(?:dp|gp\/product|gp\/aw\/d|ASIN|product|gp\/offer-listing)\/([A-Z0-9]{10})(?![A-Z0-9])/i,
  /[?&](?:asin|ASIN)=([A-Z0-9]{10})(?![A-Z0-9])/
];
var BARE_ASIN = /(?:^|[^0-9A-Za-z])(B0[0-9A-Z]{8})(?![0-9A-Za-z])/g;
var JAN_CODE = /(?:JAN\s*[:：]?\s*)?(?:^|[^0-9])(\d{13})(?![0-9])/;
var URL_RE = /https?:\/\/[^\s"'<>「」『』（）()【】、,]+/g;

var products = load(STORAGE_KEY, {});
var settings = load(SETTING_KEY, { feeRate: 15 });
var stores = initStores();
var currentView = 'product';

/* ---------------- ストレージ ---------------- */

// 既定の店舗を追加したとき、保存済みのマスタにも不足分を取り込む
function initStores() {
  var saved = load(STORE_KEY, null);
  if (!Array.isArray(saved) || saved.length === 0) {
    settings.storeVersion = STORE_VERSION;
    return DEFAULT_STORES.slice();
  }
  if ((settings.storeVersion || 1) < STORE_VERSION) {
    DEFAULT_STORES.forEach(function (d) {
      var exists = saved.some(function (s) { return s.id === d.id; });
      if (!exists) saved.push(d);
    });
    settings.storeVersion = STORE_VERSION;
  }
  return saved;
}

function load(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    localStorage.setItem(SETTING_KEY, JSON.stringify(settings));
    localStorage.setItem(STORE_KEY, JSON.stringify(stores));
  } catch (e) {
    alert('保存に失敗しました。ブラウザの保存容量が上限に達している可能性があります。');
  }
}

/* ---------------- LINEトーク履歴のパース ---------------- */

var DATE_LINE = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:\s*[(（].{1,3}[)）]|\s+.{1,4}曜日)?\s*$/;
var MSG_TAB = /^(?:(午前|午後)\s*)?(\d{1,2}):(\d{2})\t([^\t]*)\t([\s\S]*)$/;
var MSG_SPACE = /^(?:(午前|午後)\s*)?(\d{1,2}):(\d{2})[ 　]+(\S+)[ 　]+([\s\S]*)$/;

function pad(n) { return (n < 10 ? '0' : '') + n; }

function nowStamp() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function toTimestamp(date, ampm, hour, minute) {
  if (!date) return '';
  var h = parseInt(hour, 10);
  if (ampm === '午後' && h < 12) h += 12;
  if (ampm === '午前' && h === 12) h = 0;
  return date + ' ' + pad(h) + ':' + minute;
}

function parseMessages(text) {
  var lines = text.replace(/\r\n?/g, '\n').split('\n');
  var messages = [];
  var current = null;
  var date = '';

  function flush() {
    if (current) messages.push(current);
    current = null;
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var d = line.match(DATE_LINE);
    if (d) {
      flush();
      date = d[1] + '-' + pad(parseInt(d[2], 10)) + '-' + pad(parseInt(d[3], 10));
      continue;
    }
    var m = line.match(MSG_TAB) || (line.indexOf('\t') === -1 ? line.match(MSG_SPACE) : null);
    if (m) {
      flush();
      current = { at: toTimestamp(date, m[1], m[2], m[3]), sharer: (m[4] || '').trim() || '不明', text: m[5] };
      continue;
    }
    if (current) current.text += '\n' + line;
  }
  flush();
  return messages;
}

/* ---------------- URL / ASIN ---------------- */

function normalizeUrl(url) { return url.replace(/[).,、。]+$/, ''); }

function extractAsin(url) {
  for (var i = 0; i < ASIN_PATTERNS.length; i++) {
    var m = url.match(ASIN_PATTERNS[i]);
    if (m) return m[1].toUpperCase();
  }
  return '';
}

function isAmazonUrl(url) {
  try {
    return AMAZON_HOST.test(new URL(url).hostname);
  } catch (e) {
    return false;
  }
}

// 短縮URL(amzn.asia等)はブラウザからASINを解決できないためURLをキーにする
function keyOf(asin, url) {
  if (asin) return asin;
  try {
    var u = new URL(url);
    return (u.hostname + u.pathname).toLowerCase().replace(/\/$/, '');
  } catch (e) {
    return url.toLowerCase();
  }
}

function canonicalUrl(asin, url) {
  if (!asin) return url;
  var host = 'www.amazon.co.jp';
  try {
    var h = new URL(url).hostname.replace(/^www\./, '');
    if (!/^amzn\.|^a\.co$/.test(h)) host = 'www.' + h;
  } catch (e) { /* ASIN直接入力の場合はco.jpを使う */ }
  return 'https://' + host + '/dp/' + asin;
}

function toNumber(str) {
  var n = parseInt(String(str).replace(/[,，\s¥￥円]/g, ''), 10);
  return isNaN(n) ? '' : n;
}

function extractPrices(text) {
  var result = { cost: '', price: '' };
  var cost = text.match(/(?:仕入(?:れ|値|価格)?|原価|買値|店頭)\s*[:：=]?\s*[¥￥]?\s*([\d,，]+)\s*円?/);
  var price = text.match(/(?:売値|売価|販売(?:価格)?|出品(?:価格)?|Amazon価格|amazon価格)\s*[:：=]?\s*[¥￥]?\s*([\d,，]+)\s*円?/);
  if (cost) result.cost = toNumber(cost[1]);
  if (price) result.price = toNumber(price[1]);
  if (!cost && !price) {
    var any = text.match(/[¥￥]\s*([\d,，]+)|([\d,，]+)\s*円/);
    if (any) result.price = toNumber(any[1] || any[2]);
  }
  return result;
}

function extractJan(text) {
  var m = text.match(JAN_CODE);
  return m ? m[1] : '';
}

// URL・ASIN・JANを取り除いて商品名の候補を作る
function cleanName(text, token) {
  var cleaned = text.split(token).join(' ').replace(URL_RE, ' ').replace(BARE_ASIN, ' ')
    .replace(/JAN\s*[:：]?\s*\d{13}/gi, ' ').replace(/(?:^|[^0-9])\d{13}(?![0-9])/g, ' ')
    .replace(/[（(][\s、,／\/]*[)）]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  URL_RE.lastIndex = 0;
  BARE_ASIN.lastIndex = 0;
  return cleaned;
}

// トーク本文から推測する場合だけ、長すぎる本文を切り詰める
function guessName(text, token) {
  var cleaned = cleanName(text, token);
  return cleaned.length > 60 ? cleaned.slice(0, 60) + '…' : cleaned;
}

/* ---------------- 取り込み ---------------- */

function addOccurrence(item, msg) {
  var stamp = msg.at + '|' + msg.sharer;
  var dup = item.occurrences.some(function (o) { return o.at + '|' + o.sharer === stamp; });
  if (dup) return false;
  item.occurrences.push({
    at: msg.at,
    sharer: msg.sharer,
    text: msg.text.length > 200 ? msg.text.slice(0, 200) + '…' : msg.text
  });
  return true;
}

function upsert(key, asin, url, msg, nameOverride) {
  var item = products[key];
  var added = false;
  if (!item) {
    var prices = extractPrices(msg.text);
    item = products[key] = {
      key: key,
      asin: asin,
      url: url,
      name: nameOverride || guessName(msg.text, asin || url),
      cost: prices.cost,
      price: prices.price,
      status: STATUSES[0],
      memo: '',
      jan: extractJan(msg.text),
      stores: {},
      occurrences: []
    };
    added = true;
  }
  if (!item.asin && asin) {
    item.asin = asin;
    item.url = canonicalUrl(asin, item.url);
  }
  if (!item.name && nameOverride) item.name = nameOverride;
  if (!item.jan) item.jan = extractJan(msg.text);
  return { item: item, added: added, counted: addOccurrence(item, msg) };
}

// メッセージ配列から商品を取り込む（同じ内容を再取り込みしても重複しない）
function importMessages(messages) {
  var added = 0;
  var occurrences = 0;

  messages.forEach(function (msg) {
    var seen = {};

    (msg.text.match(URL_RE) || []).map(normalizeUrl).filter(isAmazonUrl).forEach(function (url) {
      var asin = extractAsin(url);
      var key = keyOf(asin, url);
      if (seen[key]) return;
      seen[key] = true;
      var r = upsert(key, asin, canonicalUrl(asin, url), msg, msg.name);
      if (r.added) added++;
      if (r.counted) occurrences++;
    });

    // 本文中にASINが直接書かれているケース
    var m;
    BARE_ASIN.lastIndex = 0;
    while ((m = BARE_ASIN.exec(msg.text)) !== null) {
      var asin2 = m[1];
      if (seen[asin2]) continue;
      seen[asin2] = true;
      var r2 = upsert(asin2, asin2, canonicalUrl(asin2, ''), msg, msg.name);
      if (r2.added) added++;
      if (r2.counted) occurrences++;
    }
    URL_RE.lastIndex = 0;
  });

  return { added: added, occurrences: occurrences };
}

// shared-list.js の共有リストを取り込む
function importSharedList() {
  var data = window.SHARED_LIST;
  var result = { added: 0, occurrences: 0, storeMarks: 0 };
  if (!data || !data.items) return result;

  data.items.forEach(function (entry) {
    if (!entry.asin) return;
    var msg = {
      at: entry.sharedAt || '',
      sharer: entry.sharer || 'グループ共有',
      text: entry.name || entry.asin
    };
    var r = upsert(entry.asin, entry.asin, canonicalUrl(entry.asin, ''), msg, entry.name);
    if (r.added) result.added++;
    if (r.counted) result.occurrences++;

    var item = r.item;
    if (entry.name && !item.name) item.name = entry.name;
    if (entry.jan && !item.jan) item.jan = entry.jan;
    if (entry.memo && !item.memo) item.memo = entry.memo;

    (entry.stores || []).forEach(function (s) {
      if (!s.id) return;
      var e = storeEntry(item, s.id);
      // 自分で確認済みの店舗は共有情報で上書きしない
      if (e.state !== '未確認') return;
      e.state = s.state || 'あり';
      if (!e.memo) e.memo = s.memo || '';
      if (e.price === '' && s.price) e.price = toNumber(s.price);
      result.storeMarks++;
    });
  });

  return result;
}

function importText(text) {
  var messages = parseMessages(text);
  // 日時付きの行が無い貼り付け（メモ書きなど）でもリンク・ASINは拾う
  if (messages.length === 0) messages = [{ at: '', sharer: '不明', text: text }];
  return importMessages(messages);
}

// 「B0XXXXXXXX 商品名」形式のASIN一覧を取り込む
function importAsinList(text, sharer) {
  var at = nowStamp();
  var messages = [];
  text.replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
    var raw = line.trim();
    if (!raw) return;
    var m = raw.match(/^([0-9A-Za-z]{10})(?![0-9A-Za-z])[\s,、\t|]*(.*)$/);
    if (m && !/^https?:/i.test(raw)) {
      messages.push({
        at: at, sharer: sharer,
        text: m[1].toUpperCase() + ' ' + m[2],
        name: cleanName(m[2], m[1])
      });
    } else {
      messages.push({ at: at, sharer: sharer, text: raw });
    }
  });
  return importMessages(messages);
}

/* ---------------- 集計 ---------------- */

function firstAt(item) {
  return item.occurrences.reduce(function (min, o) {
    if (!o.at) return min;
    return !min || o.at < min ? o.at : min;
  }, '');
}

function sharersOf(item) {
  var list = [];
  item.occurrences.forEach(function (o) {
    if (list.indexOf(o.sharer) === -1) list.push(o.sharer);
  });
  return list;
}

function storeEntry(item, storeId) {
  if (!item.stores) item.stores = {};
  if (!item.stores[storeId]) item.stores[storeId] = { state: '未確認', price: '', memo: '' };
  return item.stores[storeId];
}

function foundStores(item) {
  if (!item.stores) return [];
  return stores.filter(function (s) {
    return item.stores[s.id] && item.stores[s.id].state === 'あり';
  });
}

function checkedCount(item) {
  if (!item.stores) return 0;
  return stores.filter(function (s) {
    return item.stores[s.id] && item.stores[s.id].state !== '未確認';
  }).length;
}

function bestStorePrice(item) {
  var best = null;
  foundStores(item).forEach(function (s) {
    var p = toNumber(item.stores[s.id].price);
    if (p !== '' && (best === null || p < best)) best = p;
  });
  return best;
}

function profitOf(item) {
  var price = toNumber(item.price);
  var cost = toNumber(item.cost);
  if (price === '' || cost === '') return null;
  var rate = Number(settings.feeRate) || 0;
  return Math.round(price * (1 - rate / 100) - cost);
}

function marginOf(item) {
  var profit = profitOf(item);
  var price = toNumber(item.price);
  if (profit === null || !price) return null;
  return Math.round((profit / price) * 1000) / 10;
}

/* ---------------- リサーチリンク ---------------- */

function searchQuery(item) {
  return item.name ? item.name.replace(/…$/, '') : item.asin;
}

function researchLinks(item) {
  var q = encodeURIComponent(searchQuery(item));
  var jan = (item.jan || '').replace(/[^0-9]/g, '');
  var shopQ = jan ? encodeURIComponent(jan) : q;
  var asin = item.asin;
  var links = [
    { label: 'Amazon商品ページ', url: item.url, hint: '仕様欄で型番・JANを確認' }
  ];
  if (jan) {
    links.push({ label: 'JANで取扱店を検索', url: 'https://www.google.com/search?q=' + encodeURIComponent(jan + ' 取扱店'), hint: 'JAN ' + jan });
  } else if (asin) {
    links.push({ label: '型番・JANを検索', url: 'https://www.google.com/search?q=' + encodeURIComponent(asin + ' JAN 型番'), hint: 'ASINから商品を特定' });
  }
  if (asin) {
    links.push({ label: 'Keepa（価格推移）', url: 'https://keepa.com/#!product/5-' + asin, hint: '相場と回転を確認' });
  }
  links.push({ label: '価格.com', url: 'https://kakaku.com/search_results/' + q + '/', hint: '実売価格の相場' });
  links.push({ label: '楽天市場', url: 'https://search.rakuten.co.jp/search/mall/' + shopQ + '/', hint: jan ? 'JANで検索' : '' });
  links.push({ label: 'Yahoo!ショッピング', url: 'https://shopping.yahoo.co.jp/search?p=' + shopQ, hint: jan ? 'JANで検索' : '' });
  links.push({ label: 'メルカリ（売切れ）', url: 'https://jp.mercari.com/search?keyword=' + q + '&status=sold_out', hint: '実際に売れた価格' });
  links.push({ label: '鈴鹿市周辺の取扱店を地図で探す', url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(searchQuery(item) + ' 取扱店 鈴鹿市'), hint: '' });
  return links;
}

function storeMapUrl(store) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(store.name + ' ' + (store.address || '三重県鈴鹿市'));
}

/* ---------------- 描画 ---------------- */

function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
  return String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function allItems() {
  return Object.keys(products).map(function (k) { return products[k]; });
}

function visibleItems() {
  var q = $('searchInput').value.trim().toLowerCase();
  var status = $('statusFilter').value;
  var sharer = $('sharerFilter').value;
  var storeId = $('storeFilter').value;

  var items = allItems().filter(function (item) {
    if (status && item.status !== status) return false;
    if (sharer && sharersOf(item).indexOf(sharer) === -1) return false;
    if (storeId && !(item.stores && item.stores[storeId] && item.stores[storeId].state === 'あり')) return false;
    if (!q) return true;
    var hay = [item.name, item.asin, item.memo, item.url, sharersOf(item).join(' '),
      item.occurrences.map(function (o) { return o.text; }).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  var parts = $('sortSelect').value.split('-');
  var dir = parts[1] === 'asc' ? 1 : -1;
  items.sort(function (a, b) {
    var av, bv;
    if (parts[0] === 'count') { av = a.occurrences.length; bv = b.occurrences.length; }
    else if (parts[0] === 'found') { av = foundStores(a).length; bv = foundStores(b).length; }
    else if (parts[0] === 'profit') {
      av = profitOf(a); bv = profitOf(b);
      av = av === null ? -Infinity : av; bv = bv === null ? -Infinity : bv;
    } else if (parts[0] === 'name') {
      return (a.name || a.asin).localeCompare(b.name || b.asin, 'ja') * dir;
    } else { av = firstAt(a); bv = firstAt(b); }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return items;
}

function fillSelect(sel, values, placeholder) {
  var current = sel.value;
  sel.innerHTML = '<option value="">' + placeholder + '</option>';
  values.forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v.value;
    opt.textContent = v.label;
    if (v.value === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderFilters() {
  var statusSel = $('statusFilter');
  if (statusSel.options.length <= 1) {
    STATUSES.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = opt.textContent = s;
      statusSel.appendChild(opt);
    });
  }

  var sharers = [];
  allItems().forEach(function (item) {
    sharersOf(item).forEach(function (s) { if (sharers.indexOf(s) === -1) sharers.push(s); });
  });
  sharers.sort(function (a, b) { return a.localeCompare(b, 'ja'); });
  fillSelect($('sharerFilter'), sharers.map(function (s) { return { value: s, label: s }; }), 'すべての共有者');

  fillSelect($('storeFilter'), stores.map(function (s) {
    return { value: s.id, label: s.name + 'で在庫あり' };
  }), 'すべての店舗');
}

function renderStats(items) {
  var totalShares = items.reduce(function (sum, i) { return sum + i.occurrences.length; }, 0);
  var found = items.filter(function (i) { return foundStores(i).length > 0; }).length;
  var unchecked = items.filter(function (i) { return checkedCount(i) === 0; }).length;
  var profitSum = items.reduce(function (sum, i) {
    var p = profitOf(i);
    return p === null ? sum : sum + p;
  }, 0);

  var cards = [
    { label: '商品数', value: items.length },
    { label: '共有回数', value: totalShares },
    { label: '店舗で発見', value: found },
    { label: '店舗未確認', value: unchecked },
    { label: '想定利益 合計', value: '¥' + profitSum.toLocaleString('ja-JP') }
  ];
  $('stats').innerHTML = cards.map(function (c) {
    return '<div class="stat-card"><div class="label">' + c.label + '</div><div class="value">' + c.value + '</div></div>';
  }).join('');
}

function detailHtml(item) {
  var links = researchLinks(item).map(function (l) {
    return '<a class="research-link" href="' + escapeHtml(l.url) + '" target="_blank" rel="noopener noreferrer">'
      + escapeHtml(l.label) + '</a>'
      + (l.hint ? '<span class="hint">' + escapeHtml(l.hint) + '</span>' : '');
  }).join('');

  var checklist = stores.map(function (s) {
    var e = storeEntry(item, s.id);
    return '<div class="store-row" data-store="' + escapeHtml(s.id) + '">'
      + '<div class="store-name">'
      + '<a href="' + escapeHtml(storeMapUrl(s)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(s.name) + '</a>'
      + (s.address ? '<span class="hint">' + escapeHtml(s.address) + '</span>' : '')
      + '</div>'
      + '<select data-store-field="state" class="state-' + (e.state === 'あり' ? 'yes' : e.state === 'なし' ? 'no' : 'unknown') + '">'
      + STOCK_STATES.map(function (st) {
        return '<option value="' + st + '"' + (st === e.state ? ' selected' : '') + '>' + st + '</option>';
      }).join('')
      + '</select>'
      + '<input type="number" data-store-field="price" value="' + escapeHtml(e.price) + '" placeholder="店頭価格">'
      + '<input type="text" data-store-field="memo" value="' + escapeHtml(e.memo) + '" placeholder="棚・在庫数など">'
      + '</div>';
  }).join('');

  var best = bestStorePrice(item);

  return '<div class="detail">'
    + '<div class="detail-block"><h4>リサーチ</h4>'
    + '<label class="jan-field">JANコード'
    + '<input type="text" data-field="jan" value="' + escapeHtml(item.jan || '') + '" placeholder="4520699688045">'
    + '</label>'
    + '<div class="research-links">' + links + '</div>'
    + '<p class="hint">ASINから店舗在庫を自動取得することはできません。上のリンクで型番・JANを特定し、店頭またはお店の在庫検索で確認してください。</p></div>'
    + '<div class="detail-block"><h4>店舗チェックリスト'
    + (best === null ? '' : ' <span class="badge">最安店頭 ¥' + best.toLocaleString('ja-JP') + '</span>'
      + ' <button class="btn btn-outline btn-sm" data-action="apply-cost">仕入値に反映</button>')
    + '</h4>'
    + '<div class="store-list">' + checklist + '</div></div>'
    + '</div>';
}

function renderProductTable() {
  renderFilters();
  var items = visibleItems();
  renderStats(items);

  var empty = $('emptyState');
  if (allItems().length === 0) {
    empty.style.display = 'block';
    empty.textContent = 'まだ商品がありません。上のフォームからASINを貼り付けてください。';
  } else if (items.length === 0) {
    empty.style.display = 'block';
    empty.textContent = '条件に一致する商品がありません。';
  } else {
    empty.style.display = 'none';
  }

  var openKeys = {};
  Array.prototype.forEach.call(document.querySelectorAll('#tableBody tr.detail-row'), function (tr) {
    openKeys[tr.getAttribute('data-key')] = true;
  });

  $('tableBody').innerHTML = items.map(function (item) {
    var profit = profitOf(item);
    var margin = marginOf(item);
    var profitCell = profit === null
      ? '<span class="muted">-</span>'
      : '<span class="' + (profit >= 0 ? 'profit-plus' : 'profit-minus') + '">¥' + profit.toLocaleString('ja-JP') + '</span>'
        + (margin === null ? '' : '<br><span class="muted">' + margin + '%</span>');
    var at = firstAt(item);
    var snippet = item.occurrences.length
      ? item.occurrences[0].text.replace(URL_RE, '').replace(/\s+/g, ' ').trim() : '';
    URL_RE.lastIndex = 0;
    var found = foundStores(item);
    var open = openKeys[item.key];

    var row = '<tr data-key="' + escapeHtml(item.key) + '">'
      + '<td class="col-name">'
      + '<input type="text" data-field="name" value="' + escapeHtml(item.name) + '" placeholder="商品名を入力">'
      + '<a class="product-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.url) + '</a>'
      + (snippet ? '<span class="snippet">' + escapeHtml(snippet) + '</span>' : '')
      + '</td>'
      + '<td class="col-asin"><span class="asin-code">' + (item.asin ? escapeHtml(item.asin) : '<span class="muted">短縮URL</span>') + '</span></td>'
      + '<td class="col-sharer">' + escapeHtml(sharersOf(item).join(', ')) + '</td>'
      + '<td class="col-date">' + (at ? escapeHtml(at.slice(0, 10)) + '<br><span class="muted">' + escapeHtml(at.slice(11)) + '</span>' : '-') + '</td>'
      + '<td class="col-count">' + item.occurrences.length + '</td>'
      + '<td class="col-store">'
      + '<button class="btn btn-outline btn-sm" data-action="toggle">' + (open ? '閉じる' : '店舗') + '</button>'
      + '<div class="store-summary">'
      + (found.length
        ? '<span class="badge badge-yes">' + found.length + '店舗であり</span>'
        : '<span class="muted">' + (checkedCount(item) ? '未発見' : '未確認') + '</span>')
      + '</div></td>'
      + '<td class="col-money"><input type="number" data-field="cost" value="' + escapeHtml(item.cost) + '" placeholder="0"></td>'
      + '<td class="col-money"><input type="number" data-field="price" value="' + escapeHtml(item.price) + '" placeholder="0"></td>'
      + '<td class="col-profit">' + profitCell + '</td>'
      + '<td class="col-status"><select data-field="status">'
      + STATUSES.map(function (s) {
        return '<option value="' + s + '"' + (s === item.status ? ' selected' : '') + '>' + s + '</option>';
      }).join('')
      + '</select></td>'
      + '<td class="col-memo"><input type="text" data-field="memo" value="' + escapeHtml(item.memo) + '" placeholder="メモ"></td>'
      + '<td class="col-actions"><button class="icon-btn" data-action="delete" title="削除">×</button></td>'
      + '</tr>';

    if (open) {
      row += '<tr class="detail-row" data-key="' + escapeHtml(item.key) + '"><td colspan="12">' + detailHtml(item) + '</td></tr>';
    }
    return row;
  }).join('');
}

function renderStoreView() {
  var html = stores.map(function (s) {
    var items = allItems().filter(function (item) {
      return item.stores && item.stores[s.id] && item.stores[s.id].state === 'あり';
    });
    if (items.length === 0) return '';

    var rows = items.map(function (item) {
      var e = item.stores[s.id];
      var profit = profitOf(item);
      return '<tr>'
        + '<td><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">'
        + escapeHtml(item.name || item.asin) + '</a>'
        + '<span class="hint">' + escapeHtml(item.asin) + '</span></td>'
        + '<td class="col-money">' + (e.price === '' ? '-' : '¥' + Number(e.price).toLocaleString('ja-JP')) + '</td>'
        + '<td class="col-money">' + (item.price === '' ? '-' : '¥' + Number(item.price).toLocaleString('ja-JP')) + '</td>'
        + '<td class="col-profit">' + (profit === null ? '-'
          : '<span class="' + (profit >= 0 ? 'profit-plus' : 'profit-minus') + '">¥' + profit.toLocaleString('ja-JP') + '</span>') + '</td>'
        + '<td>' + escapeHtml(item.status) + '</td>'
        + '<td>' + escapeHtml(e.memo) + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="store-block">'
      + '<h3><a href="' + escapeHtml(storeMapUrl(s)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(s.name) + '</a>'
      + ' <span class="badge badge-yes">' + items.length + '点</span></h3>'
      + (s.address ? '<p class="hint">' + escapeHtml(s.address) + '</p>' : '')
      + '<div class="table-scroll"><table class="store-table"><thead><tr>'
      + '<th>商品</th><th class="col-money">店頭価格</th><th class="col-money">売値</th>'
      + '<th class="col-profit">想定利益</th><th>ステータス</th><th>メモ</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }).join('');

  $('storeViewBody').innerHTML = html
    || '<p class="empty">「あり」と記録された商品がまだありません。商品別ビューの「店舗」ボタンから店舗チェックリストを開いて記録してください。</p>';
}

function renderStoreMaster() {
  $('storeCount').textContent = stores.length + '店舗';
  $('storeMasterList').innerHTML = stores.map(function (s) {
    return '<li data-store="' + escapeHtml(s.id) + '">'
      + '<a href="' + escapeHtml(storeMapUrl(s)) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(s.name) + '</a>'
      + (s.address ? '<span class="hint">' + escapeHtml(s.address) + '</span>' : '')
      + (s.note ? '<span class="tag">' + escapeHtml(s.note) + '</span>' : '')
      + '<button class="icon-btn" data-action="delete-store" title="削除">×</button>'
      + '</li>';
  }).join('');
}

function render() {
  renderStoreMaster();
  if (currentView === 'product') renderProductTable();
  else { renderFilters(); renderStats(allItems()); renderStoreView(); }
}

/* ---------------- CSV ---------------- */

function csvCell(value) {
  return '"' + String(value === null || value === undefined ? '' : value).replace(/"/g, '""') + '"';
}

function exportCsv() {
  var header = ['商品名', 'ASIN', 'JAN', 'URL', '共有者', '初回共有日時', '共有回数', '在庫あり店舗', '最安店頭価格',
    '仕入値', '売値', '想定利益', '利益率(%)', 'ステータス', 'メモ'];
  var items = currentView === 'product' ? visibleItems() : allItems();
  var rows = items.map(function (item) {
    var best = bestStorePrice(item);
    return [
      item.name, item.asin, item.jan || '', item.url, sharersOf(item).join(' / '), firstAt(item), item.occurrences.length,
      foundStores(item).map(function (s) { return s.name; }).join(' / '),
      best === null ? '' : best,
      item.cost, item.price,
      profitOf(item) === null ? '' : profitOf(item),
      marginOf(item) === null ? '' : marginOf(item),
      item.status, item.memo
    ].map(csvCell).join(',');
  });

  var csv = '﻿' + [header.map(csvCell).join(',')].concat(rows).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  var now = new Date();
  link.href = URL.createObjectURL(blob);
  link.download = 'amazon-list-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/* ---------------- イベント ---------------- */

function reportImport(result) {
  var msg;
  if (result.occurrences === 0 && !result.storeMarks) {
    msg = 'ASIN／Amazonリンクが見つかりませんでした。';
  } else {
    msg = '新規 ' + result.added + '件 / 共有 ' + result.occurrences + '件を取り込みました。';
    if (result.storeMarks) msg += ' 店舗情報 ' + result.storeMarks + '件を反映しました。';
  }
  $('importResult').textContent = msg;
  save();
  render();
}

function readFiles(files) {
  var pending = files.length;
  var total = { added: 0, occurrences: 0 };
  if (!pending) return;
  Array.prototype.forEach.call(files, function (file) {
    var reader = new FileReader();
    reader.onload = function () {
      var r = importText(String(reader.result));
      total.added += r.added;
      total.occurrences += r.occurrences;
      if (--pending === 0) reportImport(total);
    };
    reader.onerror = function () { if (--pending === 0) reportImport(total); };
    reader.readAsText(file, 'utf-8');
  });
}

function switchView(view) {
  currentView = view;
  $('productView').hidden = view !== 'product';
  $('storeView').hidden = view !== 'store';
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.classList.toggle('is-active', b.getAttribute('data-view') === view);
  });
  render();
}

document.addEventListener('DOMContentLoaded', function () {
  $('feeRate').value = settings.feeRate;

  Array.prototype.forEach.call(document.querySelectorAll('#importTabs .tab'), function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('#importTabs .tab'), function (t) {
        t.classList.toggle('is-active', t === tab);
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-body]'), function (b) {
        b.hidden = b.getAttribute('data-body') !== name;
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () { switchView(b.getAttribute('data-view')); });
  });

  $('asinImportBtn').addEventListener('click', function () {
    var text = $('asinArea').value;
    if (!text.trim()) {
      $('importResult').textContent = 'ASINを貼り付けてください。';
      return;
    }
    reportImport(importAsinList(text, $('asinSharer').value.trim() || '共有'));
    $('asinArea').value = '';
  });

  if (window.SHARED_LIST && window.SHARED_LIST.items) {
    $('sharedListInfo').textContent = window.SHARED_LIST.items.length + '件（更新 '
      + (window.SHARED_LIST.updated || '不明') + '）';
  } else {
    $('sharedListBtn').disabled = true;
    $('sharedListInfo').textContent = 'shared-list.js を読み込めませんでした';
  }

  $('sharedListBtn').addEventListener('click', function () {
    var result = importSharedList();
    if (!result.added && !result.occurrences && !result.storeMarks) {
      $('importResult').textContent = '共有リストはすでに取り込み済みです。';
      return;
    }
    reportImport(result);
  });

  $('importBtn').addEventListener('click', function () {
    var text = $('pasteArea').value;
    if (!text.trim()) {
      $('importResult').textContent = 'テキストを貼り付けてください。';
      return;
    }
    reportImport(importText(text));
    $('pasteArea').value = '';
  });

  $('fileInput').addEventListener('change', function (e) {
    readFiles(e.target.files);
    e.target.value = '';
  });

  var dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(function (type) {
    dz.addEventListener(type, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    dz.addEventListener(type, function (e) { e.preventDefault(); dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) readFiles(e.dataTransfer.files);
  });

  ['searchInput', 'statusFilter', 'sharerFilter', 'storeFilter', 'sortSelect'].forEach(function (id) {
    $(id).addEventListener('input', renderProductTable);
    $(id).addEventListener('change', renderProductTable);
  });

  $('feeRate').addEventListener('change', function () {
    settings.feeRate = Number($('feeRate').value) || 0;
    save();
    render();
  });

  $('csvBtn').addEventListener('click', exportCsv);

  $('clearBtn').addEventListener('click', function () {
    if (!confirm('保存しているすべての商品を削除します。よろしいですか？（店舗マスタは残ります）')) return;
    products = {};
    save();
    render();
  });

  $('addStoreBtn').addEventListener('click', function () {
    var name = $('newStoreName').value.trim();
    if (!name) return;
    stores.push({
      id: 'custom-' + Date.now(),
      name: name,
      address: $('newStoreAddress').value.trim(),
      note: ''
    });
    $('newStoreName').value = '';
    $('newStoreAddress').value = '';
    save();
    render();
  });

  $('storeMasterList').addEventListener('click', function (e) {
    if (e.target.getAttribute('data-action') !== 'delete-store') return;
    var id = e.target.closest('li').getAttribute('data-store');
    var store = stores.filter(function (s) { return s.id === id; })[0];
    if (!store || !confirm('「' + store.name + '」を店舗マスタから削除しますか？')) return;
    stores = stores.filter(function (s) { return s.id !== id; });
    allItems().forEach(function (item) { if (item.stores) delete item.stores[id]; });
    save();
    render();
  });

  var tbody = $('tableBody');

  tbody.addEventListener('change', function (e) {
    var item = products[e.target.closest('tr').getAttribute('data-key')];
    if (!item) return;

    var storeField = e.target.getAttribute('data-store-field');
    if (storeField) {
      var storeId = e.target.closest('.store-row').getAttribute('data-store');
      var entry = storeEntry(item, storeId);
      entry[storeField] = storeField === 'price' ? toNumber(e.target.value) : e.target.value;
      save();
      renderProductTable();
      return;
    }

    var field = e.target.getAttribute('data-field');
    if (!field) return;
    item[field] = (field === 'cost' || field === 'price') ? toNumber(e.target.value) : e.target.value;
    save();
    if (field === 'cost' || field === 'price' || field === 'status' || field === 'jan') renderProductTable();
  });

  tbody.addEventListener('click', function (e) {
    var action = e.target.getAttribute('data-action');
    if (!action) return;
    var row = e.target.closest('tr');
    var key = row.getAttribute('data-key');
    var item = products[key];

    if (action === 'toggle') {
      var detail = document.querySelector('#tableBody tr.detail-row[data-key="' + key.replace(/"/g, '\\"') + '"]');
      if (detail) {
        detail.remove();
        e.target.textContent = '店舗';
      } else {
        var tr = document.createElement('tr');
        tr.className = 'detail-row';
        tr.setAttribute('data-key', key);
        tr.innerHTML = '<td colspan="12">' + detailHtml(item) + '</td>';
        row.parentNode.insertBefore(tr, row.nextSibling);
        e.target.textContent = '閉じる';
      }
      return;
    }

    if (action === 'apply-cost') {
      var best = bestStorePrice(item);
      if (best !== null) {
        item.cost = best;
        save();
        renderProductTable();
      }
      return;
    }

    if (action === 'delete') {
      if (!confirm('この商品を削除しますか？')) return;
      delete products[key];
      save();
      renderProductTable();
    }
  });

  render();
});
