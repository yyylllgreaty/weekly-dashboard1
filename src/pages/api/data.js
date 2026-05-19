// src/pages/api/data.js
// Fetches & parses Google Sheets CSV data for the Lead Gen BUs Dashboard

const SHEET_ID = '1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes';
const csvUrl = (sheet) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

// ── CSV Parser ──
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(current.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

// ── Number Parser ──
function num(v) {
  if (v == null || v === '' || v === '-' || v === '\u2014' || v === 'n/a') return null;
  var s = String(v).replace(/,/g, '').replace(/%/g, '').trim();
  if (s === '' || s === '-' || s === '\u2014') return null;
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── Parse week headers from Weekly Performance Trend ──
// Format: Row 0 = ["LGM", "W44 2025 Oct 27, 2025 - Nov 2, 2025", ...]
// Single cell contains week label + date range combined
function parseWeekHeaders(rows) {
  var weeks = [];
  var dateRanges = [];

  if (!rows || rows.length === 0) return { weeks: weeks, dateRanges: dateRanges };

  // Find the first row that has W## pattern in any column after 0
  var headerRow = -1;
  for (var r = 0; r < Math.min(rows.length, 5); r++) {
    for (var c = 1; c < (rows[r] || []).length; c++) {
      if (/^W\d+/i.test(rows[r][c] || '')) {
        headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) return { weeks: weeks, dateRanges: dateRanges };

  var hRow = rows[headerRow];

  // Check if next row is a date range row (two-row header format)
  var nextRow = rows[headerRow + 1] || [];
  var nextFirstData = (nextRow[1] || '').trim();
  var nextRowIsDateRange =
    nextFirstData.length > 0 &&
    /[A-Z][a-z]{2}\s+\d/.test(nextFirstData) &&
    !/(leads|sold|sent|contract|conversion|generated)/i.test(nextFirstData);

  if (nextRowIsDateRange) {
    // Two-row format: row1 = "W14 2026", row2 = "Mar 30, 2026 - Apr 5, 2026"
    for (var c = 1; c < hRow.length; c++) {
      var wk = (hRow[c] || '').trim();
      if (/^W\d+/i.test(wk)) {
        weeks.push(wk);
        dateRanges.push((nextRow[c] || '').trim());
      }
    }
  } else {
    // Single-row format: "W44 2025 Oct 27, 2025 - Nov 2, 2025"
    for (var c = 1; c < hRow.length; c++) {
      var cell = (hRow[c] || '').trim();
      if (!cell || !/^W\d+/i.test(cell)) continue;

      var m = cell.match(/^(W\d+\s+\d{4})\s+(.+)$/i);
      if (m) {
        weeks.push(m[1].trim());
        dateRanges.push(m[2].trim());
      } else {
        weeks.push(cell);
        dateRanges.push('');
      }
    }
  }

  return { weeks: weeks, dateRanges: dateRanges };
}

// ── Find section row by label ──
function findSection(rows, label, startFrom) {
  var start = startFrom || 0;
  var lbl = label.toLowerCase().trim();
  for (var r = start; r < rows.length; r++) {
    var cell = ((rows[r] || [])[0] || '').toLowerCase().trim();
    if (cell === lbl || cell.startsWith(lbl)) return r;
  }
  return -1;
}

// ── Parse a business section from Weekly Performance Trend ──
function parseBusinessSection(rows, sectionRow, weekCount) {
  var result = { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] };

  var metricRows = [];
  for (var r = sectionRow + 1; r < Math.min(sectionRow + 15, rows.length); r++) {
    var label = ((rows[r] || [])[0] || '').trim().toLowerCase();
    if (r > sectionRow + 1) {
      if (label === 'springzip' || label === 'myaccident' || label === 'lgm' ||
          label === 'tier 1' || label === 'tier 2/3') {
        break;
      }
    }
    metricRows.push({ label: label, row: rows[r] });
  }

  var tlSentFound = false;
  var pwSentFound = false;

  for (var i = 0; i < metricRows.length; i++) {
    var label = metricRows[i].label;
    var row = metricRows[i].row;
    var vals = [];
    for (var c = 1; c <= weekCount; c++) {
      vals.push(num(row ? row[c] : ''));
    }

    if (/leads?\s*generated/i.test(label)) {
      result.gen = vals;
    } else if (/leads?\s*sold/i.test(label) || /sold\s*\(excl/i.test(label)) {
      result.sold = vals;
    } else if (/sold\s*%/i.test(label)) {
      result.sp = vals;
    } else if (/sent\s*to\s*(tl|thompson)/i.test(label) || /sent\s*to\s*tl/i.test(label)) {
      result.tlS = vals;
      tlSentFound = true;
    } else if (/sent\s*to\s*(pacific|pw)/i.test(label)) {
      result.pwS = vals;
      pwSentFound = true;
    } else if (/contract\s*signed/i.test(label)) {
      if (pwSentFound && result.pwC.length === 0) {
        result.pwC = vals;
      } else if (tlSentFound && result.tlC.length === 0) {
        result.tlC = vals;
      }
    } else if (/conversion\s*rate/i.test(label)) {
      if (pwSentFound && result.pwR.length === 0) {
        result.pwR = vals;
      } else if (tlSentFound && result.tlR.length === 0) {
        result.tlR = vals;
      }
    }
  }

  return result;
}

// ── Find week column indices from individual business sheet tabs ──
// These tabs use two-row headers: Row 1 = "W16 2026", Row 2 = "Apr 13, 2026 - ..."
function findWeekColumns(rows) {
  var weekCols = [];
  for (var r = 0; r < Math.min(rows.length, 3); r++) {
    for (var c = 0; c < (rows[r] || []).length; c++) {
      if (/^W\d+/i.test((rows[r][c] || '').trim())) {
        weekCols.push(c);
      }
    }
    if (weekCols.length > 0) break;
  }
  return weekCols;
}

// ── Parse by-state data from individual business sheets ──
function parseStateData(rows, format) {
  var states = {};
  var TRACKED = ['TX', 'AZ', 'CA', 'GA', 'OH', 'IL'];

  // Find which columns contain week data
  var weekCols = findWeekColumns(rows);

  // Fallback: if no week columns found, use all columns after col 1
  if (weekCols.length === 0) {
    var maxCols = 0;
    for (var r = 0; r < rows.length; r++) {
      if ((rows[r] || []).length > maxCols) maxCols = rows[r].length;
    }
    for (var c = 2; c < maxCols; c++) {
      weekCols.push(c);
    }
  }

  function extractVals(row) {
    var vals = [];
    for (var i = 0; i < weekCols.length; i++) {
      vals.push(num(row ? row[weekCols[i]] : ''));
    }
    return vals;
  }

  function assignMetric(st, metric, vals) {
    if (/leads?\s*generated/i.test(metric)) states[st].gen = vals;
    else if (/leads?\s*routed/i.test(metric)) states[st].rt = vals;
    else if (/sent\s*to\s*tl/i.test(metric)) states[st].ts = vals;
    else if (/%\s*sent/i.test(metric) || /routing/i.test(metric)) states[st].tp = vals;
    else if (/contract\s*signed/i.test(metric)) states[st].cs = vals;
    else if (/conversion/i.test(metric)) states[st].cr = vals;
  }

  if (format === 'springzip') {
    var currentState = null;
    for (var r = 0; r < rows.length; r++) {
      var c0 = ((rows[r] || [])[0] || '').trim().toUpperCase();
      var c1 = ((rows[r] || [])[1] || '').trim().toUpperCase();

      // Check for state header (e.g. "TX Vehicle", "AZ Vehicle")
      var foundState = null;
      for (var s = 0; s < TRACKED.length; s++) {
        if (c0.indexOf(TRACKED[s]) === 0 || c1.indexOf(TRACKED[s]) === 0) {
          foundState = TRACKED[s];
          break;
        }
      }

      if (foundState) {
        currentState = foundState;
        if (!states[currentState]) {
          states[currentState] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };
        }
        continue;
      }

      if (!currentState) continue;

      var metric = ((rows[r] || [])[1] || (rows[r] || [])[0] || '').trim();
      if (metric === '' || /^(by\s*state|total)/i.test(metric)) continue;

      assignMetric(currentState, metric, extractVals(rows[r]));
    }
  } else {
    // LGM & MA: col0 = state abbreviation, col1 = metric name
    for (var r = 0; r < rows.length; r++) {
      var st = ((rows[r] || [])[0] || '').trim().toUpperCase();
      if (TRACKED.indexOf(st) === -1) continue;

      if (!states[st]) {
        states[st] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };
      }

      var metric = ((rows[r] || [])[1] || '').trim();
      assignMetric(st, metric, extractVals(rows[r]));
    }
  }

  return states;
}

function emptyBiz() {
  return { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] };
}

// ── Main API Handler ──
export default async function handler(req, res) {
  try {
    var responses = await Promise.all([
      fetch(csvUrl('Weekly Performance Trend')).then(function (r) { return r.text(); }),
      fetch(csvUrl('LGM')).then(function (r) { return r.text(); }),
      fetch(csvUrl('SpringZip')).then(function (r) { return r.text(); }),
      fetch(csvUrl('MyAccident')).then(function (r) { return r.text(); }),
    ]);

    var trendRows = parseCSV(responses[0]);
    var headerInfo = parseWeekHeaders(trendRows);
    var weeks = headerInfo.weeks;
    var dateRanges = headerInfo.dateRanges;
    var weekCount = weeks.length;

    if (weekCount === 0) {
      return res.status(200).json({
        error: 'No weeks found in spreadsheet',
        _debug: {
          totalRows: trendRows.length,
          weekRows: [],
          firstRows: trendRows.slice(0, 10).map(function (r) { return r.slice(0, 5); }),
        },
        weeks: [], dateRanges: [],
        lgm: emptyBiz(), spz: emptyBiz(), maTier1: emptyBiz(), maTier23: emptyBiz(),
        lgmStates: {}, spzStates: {}, maStates: {},
        lastUpdated: new Date().toISOString(),
      });
    }

    var lgmRow = findSection(trendRows, 'LGM');
    var spzRow = findSection(trendRows, 'SpringZip', lgmRow > -1 ? lgmRow + 1 : 0);
    var maRow = findSection(trendRows, 'MyAccident', spzRow > -1 ? spzRow + 1 : 0);

    var lgm = lgmRow > -1 ? parseBusinessSection(trendRows, lgmRow, weekCount) : emptyBiz();
    var spz = spzRow > -1 ? parseBusinessSection(trendRows, spzRow, weekCount) : emptyBiz();

    var maTier1 = emptyBiz();
    var maTier23 = emptyBiz();
    if (maRow > -1) {
      var t1Row = findSection(trendRows, 'Tier 1', maRow);
      var t23Row = findSection(trendRows, 'Tier 2/3', maRow);
      if (t1Row > -1) maTier1 = parseBusinessSection(trendRows, t1Row, weekCount);
      if (t23Row > -1) maTier23 = parseBusinessSection(trendRows, t23Row, weekCount);
    }

    var lgmStates = parseStateData(parseCSV(responses[1]), 'standard');
    var spzStates = parseStateData(parseCSV(responses[2]), 'springzip');
    var maStates = parseStateData(parseCSV(responses[3]), 'standard');

    res.status(200).json({
      weeks: weeks,
      dateRanges: dateRanges,
      lgm: lgm,
      spz: spz,
      maTier1: maTier1,
      maTier23: maTier23,
      lgmStates: lgmStates,
      spzStates: spzStates,
      maStates: maStates,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
