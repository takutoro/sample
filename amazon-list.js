'use strict';

/* ------------------------------------------------------------------
 * LINEのトーク履歴からAmazon商品を抽出して一覧化する
 * データはすべてブラウザのlocalStorageに保存する（外部送信なし）
 * ------------------------------------------------------------------ */

var STORAGE_KEY = 'amazonProductList.v1';
var SETTING_KEY = 'amazonProductList.settings.v1';
var STATUSES = ['未確認', '検討中', '仕入済', '出品済', '見送り'];

var AMAZON_HOST = /(^|\.)(amazon\.(co\.jp|com|co\.uk|de|fr|it|es|ca|com\.mx|com\.au|in|nl|se|pl|com\.tr|sg|ae|sa|com\.br)|amzn\.asia|amzn\.to|a\.co)$/i;
var ASIN_PATTERNS = [
  /\/(?:dp|gp\/product|gp\/aw\/d|ASIN|product|gp\/offer-listing)\/([A-Z0-9]{10})(?![A-Z0-9])/i,
  /[?&](?:asin|ASIN)=([A-Z0-9]{10})(?![A-Z0-9])/
];

var products = load(STORAGE_KEY, {});
var settings = load(SETTING_KEY, { feeRate: 15 });

/* ---------------- ストレージ ---------------- */

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
  } catch (e) {
    alert('保存に失敗しました。ブラウザの保存容量が上限に達している可能性があります。');
  }
}

/* ---------------- パース ---------------- */

// LINEエクスポート形式（Android: 2024/01/15(月) / iPhone: 2024.01.15 月曜日）
var DATE_LINE = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:\s*[(（].{1,3}[)）]|\s+.{1,4}曜日)?\s*$/;
var MSG_TAB = /^(?:(午前|午後)\s*)?(\d{1,2}):(\d{2})\t([^\t]*)\t([\s\S]*)$/;
var MSG_SPACE = /^(?:(午前|午後)\s*)?(\d{1,2}):(\d{2})[ 　]+(\S+)[ 　]+([\s\S]*)$/;
var URL_RE = /https?:\/\/[^\s"'<>「」『』（）()【】、,]+/g;

function pad(n) { return (n < 10 ? '0' : '') + n; }

function toTimestamp(date, ampm, hour, minute) {
  if (!date) return '';
  var h = parseInt(hour, 10);
  if (ampm === '午後' && h < 12) h += 12;
  if (ampm === '午前' && h === 12) h = 0;
  return date + ' ' + pad(h) + ':' + minute;
}

// テキストからLINEメッセージの配列を作る
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
      current = {
        at: toTimestamp(date, m[1], m[2], m[3]),
        sharer: (m[4] || '').trim() || '不明',
        text: m[5]
      };
      continue;
    }
    if (current) current.text += '\n' + line;
  }
  flush();
  return messages;
}

function normalizeUrl(url) {
  return url.replace(/[).,、。]+$/, '');
}

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
  try {
    var host = new URL(url).hostname.replace(/^www\./, '');
    if (/^amzn\.|^a\.co$/.test(host)) host = 'www.amazon.co.jp';
    else host = 'www.' + host;
    return 'https://' + host + '/dp/' + asin;
  } catch (e) {
    return 'https://www.amazon.co.jp/dp/' + asin;
  }
}

function toNumber(str) {
  var n = parseInt(String(str).replace(/[,，\s¥￥円]/g, ''), 10);
  return isNaN(n) ? '' : n;
}

// 「仕入1200円」「売値2,980円」のようなラベル付き金額を拾う
function extractPrices(text) {
  var result = { cost: '', price: '' };
  var cost = text.match(/(?:仕入(?:れ|値|価格)?|原価|買値)\s*[:：=]?\s*[¥￥]?\s*([\d,，]+)\s*円?/);
  var price = text.match(/(?:売値|売価|販売(?:価格)?|出品(?:価格)?|Amazon価格|amazon価格)\s*[:：=]?\s*[¥￥]?\s*([\d,，]+)\s*円?/);
  if (cost) result.cost = toNumber(cost[1]);
  if (price) result.price = toNumber(price[1]);
  if (!cost && !price) {
    var any = text.match(/[¥￥]\s*([\d,，]+)|([\d,，]+)\s*円/);
    if (any) result.price = toNumber(any[1] || any[2]);
  }
  return result;
}

// URLとその周辺の記号を除いた本文を商品名の初期値にする
function guessName(text, url) {
  var cleaned = text.split(url).join(' ').replace(URL_RE, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > 60 ? cleaned.slice(0, 60) + '…' : cleaned;
}

// メッセージ配列から商品を取り込む（同一の共有は何度読み込んでも重複しない）
function importMessages(messages) {
  var added = 0;
  var occurrences = 0;

  messages.forEach(function (msg) {
    var urls = (msg.text.match(URL_RE) || []).map(normalizeUrl).filter(isAmazonUrl);
    var seen = {};
    urls.forEach(function (url) {
      var asin = extractAsin(url);
      var key = keyOf(asin, url);
      if (seen[key]) return;
      seen[key] = true;

      var item = products[key];
      if (!item) {
        var prices = extractPrices(msg.text);
        item = products[key] = {
          key: key,
          asin: asin,
          url: canonicalUrl(asin, url),
          name: guessName(msg.text, url),
          cost: prices.cost,
          price: prices.price,
          status: STATUSES[0],
          memo: '',
          occurrences: []
        };
        added++;
      }
      if (!item.asin && asin) {
        item.asin = asin;
        item.url = canonicalUrl(asin, url);
      }
      var stamp = msg.at + '|' + msg.sharer;
      var dup = item.occurrences.some(function (o) { return o.at + '|' + o.sharer === stamp; });
      if (!dup) {
        item.occurrences.push({
          at: msg.at,
          sharer: msg.sharer,
          text: msg.text.length > 200 ? msg.text.slice(0, 200) + '…' : msg.text
        });
        occurrences++;
      }
    });
  });

  return { added: added, occurrences: occurrences };
}

function importText(text) {
  var messages = parseMessages(text);
  // 日時付きの行が無い貼り付け（メモ書きなど）でもURLだけは拾う
  if (messages.length === 0) {
    messages = [{ at: '', sharer: '不明', text: text }];
  }
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

/* ---------------- 描画 ---------------- */

function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
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

  var items = allItems().filter(function (item) {
    if (status && item.status !== status) return false;
    if (sharer && sharersOf(item).indexOf(sharer) === -1) return false;
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
    else if (parts[0] === 'profit') { av = profitOf(a); bv = profitOf(b); av = av === null ? -Infinity : av; bv = bv === null ? -Infinity : bv; }
    else if (parts[0] === 'name') { return (a.name || a.asin).localeCompare(b.name || b.asin, 'ja') * dir; }
    else { av = firstAt(a); bv = firstAt(b); }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return items;
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
    sharersOf(item).forEach(function (s) {
      if (sharers.indexOf(s) === -1) sharers.push(s);
    });
  });
  sharers.sort(function (a, b) { return a.localeCompare(b, 'ja'); });

  var sel = $('sharerFilter');
  var current = sel.value;
  sel.innerHTML = '<option value="">すべての共有者</option>';
  sharers.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = opt.textContent = s;
    if (s === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderStats(items) {
  var totalShares = items.reduce(function (sum, i) { return sum + i.occurrences.length; }, 0);
  var sharers = {};
  items.forEach(function (i) { sharersOf(i).forEach(function (s) { sharers[s] = true; }); });
  var profitSum = items.reduce(function (sum, i) {
    var p = profitOf(i);
    return p === null ? sum : sum + p;
  }, 0);
  var pending = items.filter(function (i) { return i.status === '未確認' || i.status === '検討中'; }).length;

  var cards = [
    { label: '商品数', value: items.length },
    { label: '共有回数', value: totalShares },
    { label: '共有者', value: Object.keys(sharers).length + '人' },
    { label: '未確認・検討中', value: pending },
    { label: '想定利益 合計', value: '¥' + profitSum.toLocaleString('ja-JP') }
  ];

  $('stats').innerHTML = cards.map(function (c) {
    return '<div class="stat-card"><div class="label">' + c.label + '</div><div class="value">' + c.value + '</div></div>';
  }).join('');
}

function render() {
  renderFilters();
  var items = visibleItems();
  renderStats(items);

  $('emptyState').style.display = allItems().length === 0 ? 'block' : 'none';
  if (allItems().length > 0 && items.length === 0) {
    $('emptyState').style.display = 'block';
    $('emptyState').textContent = '条件に一致する商品がありません。';
  } else if (allItems().length > 0) {
    $('emptyState').textContent = '';
  } else {
    $('emptyState').textContent = 'まだ商品がありません。上のフォームからトーク履歴を取り込んでください。';
  }

  $('tableBody').innerHTML = items.map(function (item) {
    var profit = profitOf(item);
    var margin = marginOf(item);
    var profitCell = profit === null
      ? '<span class="muted">-</span>'
      : '<span class="' + (profit >= 0 ? 'profit-plus' : 'profit-minus') + '">¥' + profit.toLocaleString('ja-JP') + '</span>'
        + (margin === null ? '' : '<br><span class="muted">' + margin + '%</span>');
    var snippet = item.occurrences.length
      ? item.occurrences[0].text.replace(URL_RE, '').replace(/\s+/g, ' ').trim()
      : '';
    var at = firstAt(item);

    return '<tr data-key="' + escapeHtml(item.key) + '">'
      + '<td class="col-name">'
      + '<input type="text" data-field="name" value="' + escapeHtml(item.name) + '" placeholder="商品名を入力">'
      + '<a class="product-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.url) + '</a>'
      + '<span class="snippet">' + escapeHtml(snippet) + '</span>'
      + '</td>'
      + '<td class="col-asin"><span class="asin-code">' + (item.asin ? escapeHtml(item.asin) : '<span class="muted">短縮URL</span>') + '</span></td>'
      + '<td class="col-sharer">' + escapeHtml(sharersOf(item).join(', ')) + '</td>'
      + '<td class="col-date">' + (at ? escapeHtml(at.slice(0, 10)) + '<br><span class="muted">' + escapeHtml(at.slice(11)) + '</span>' : '-') + '</td>'
      + '<td class="col-count">' + item.occurrences.length + '</td>'
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
  }).join('');
}

/* ---------------- CSV ---------------- */

function csvCell(value) {
  var s = value === null || value === undefined ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function exportCsv() {
  var header = ['商品名', 'ASIN', 'URL', '共有者', '初回共有日時', '共有回数', '仕入値', '売値', '想定利益', '利益率(%)', 'ステータス', 'メモ', '元メッセージ'];
  var rows = visibleItems().map(function (item) {
    return [
      item.name, item.asin, item.url, sharersOf(item).join(' / '), firstAt(item),
      item.occurrences.length, item.cost, item.price,
      profitOf(item) === null ? '' : profitOf(item),
      marginOf(item) === null ? '' : marginOf(item),
      item.status, item.memo,
      item.occurrences.length ? item.occurrences[0].text.replace(/\s+/g, ' ') : ''
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
  var msg = result.occurrences === 0
    ? 'Amazonのリンクが見つかりませんでした。'
    : '新規 ' + result.added + '件 / 共有 ' + result.occurrences + '件を取り込みました。';
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
    reader.onerror = function () {
      if (--pending === 0) reportImport(total);
    };
    reader.readAsText(file, 'utf-8');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  $('feeRate').value = settings.feeRate;

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

  $('manualAddBtn').addEventListener('click', function () {
    var url = $('manualUrl').value.trim();
    if (!url) return;
    if (!isAmazonUrl(url)) {
      $('importResult').textContent = 'AmazonのURLを入力してください。';
      return;
    }
    var sharer = $('manualSharer').value.trim() || '手動追加';
    var now = new Date();
    var at = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
      + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    reportImport(importMessages([{ at: at, sharer: sharer, text: url }]));
    $('manualUrl').value = '';
  });

  ['searchInput', 'statusFilter', 'sharerFilter', 'sortSelect'].forEach(function (id) {
    $(id).addEventListener('input', render);
    $(id).addEventListener('change', render);
  });

  $('feeRate').addEventListener('change', function () {
    settings.feeRate = Number($('feeRate').value) || 0;
    save();
    render();
  });

  $('csvBtn').addEventListener('click', exportCsv);

  $('clearBtn').addEventListener('click', function () {
    if (!confirm('保存しているすべての商品を削除します。よろしいですか？')) return;
    products = {};
    save();
    render();
  });

  var tbody = $('tableBody');

  tbody.addEventListener('change', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var row = e.target.closest('tr');
    var item = products[row.getAttribute('data-key')];
    if (!item) return;
    item[field] = (field === 'cost' || field === 'price') ? toNumber(e.target.value) : e.target.value;
    save();
    if (field === 'cost' || field === 'price' || field === 'status') render();
  });

  tbody.addEventListener('click', function (e) {
    if (e.target.getAttribute('data-action') !== 'delete') return;
    var row = e.target.closest('tr');
    var key = row.getAttribute('data-key');
    if (!confirm('この商品を削除しますか？')) return;
    delete products[key];
    save();
    render();
  });

  render();
});
