// src/pages/api/data.js
// Fetches & parses Google Sheets CSV data for the Lead Gen BUs Dashboard

const SHEET_ID = '1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes';
const csvUrl = (sheet) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

// ── CSV Parser ──
function parseCSV(text) {
  var rows = [];
  var current = '';
  var inQuotes = false;
  var row = [];
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(current.trim()); current = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(current.trim());
        if (row.some(function(c) { return c !== ''; })) rows.push(row);
        row = []; current = '';
      } else { current += ch; }
    }
  }
  row.push(current.trim());
  if (row.some(function(c) { return c !== ''; })) rows.push(row);
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

// ── Normalize week label for matching: "W44 2025" → "W44 2025", "W01 2026" → "W01 2026" ──
function normalizeWeek(w) {
  var m = (w || '').trim().match(/^(W)(\d+)\s+(\d{4})/i);
  if (!m) return (w || '').trim();
  // Pad week number to 2 digits for consistent matching
  var wn = m[2].length === 1 ? '0' + m[2] : m[2];
  return 'W' + wn + ' ' + m[3];
}

// ── Parse week headers from a sheet ──
// Supports two formats:
//   Single-row: "W44 2025 Oct 27, 2025 - Nov 2, 2025" (trend tab)
//   Two-row: Row1="W16 2026", Row2="Apr 13, 2026 - Apr 19, 2026" (individual tabs)
// Returns { weeks: [...], dateRanges: [...] }
function parseWeekHeaders(rows) {
  var weeks = [];
  var dateRanges = [];
  if (!rows || rows.length === 0) return { weeks: weeks, dateRanges: dateRanges };

  // Find first row with W## pattern
  var headerRow = -1;
  for (var r = 0; r < Math.min(rows.length, 5); r++) {
    for (var c = 1; c < (rows[r] || []).length; c++) {
      if (/^W\d+/i.test(rows[r][c] || '')) { headerRow = r; break; }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) return { weeks: weeks, dateRanges: dateRanges };

  var hRow = rows[headerRow];
  var nextRow = rows[headerRow + 1] || [];
  var nextFirstData = (nextRow[1] || '').trim();
  var nextRowIsDateRange =
    nextFirstData.length > 0 &&
    /[A-Z][a-z]{2}\s+\d/.test(nextFirstData) &&
    !/(leads|sold|sent|contract|conversion|generated)/i.test(nextFirstData);

  if (nextRowIsDateRange) {
    for (var c = 1; c < hRow.length; c++) {
      var wk = (hRow[c] || '').trim();
      if (/^W\d+/i.test(wk)) {
        weeks.push(normalizeWeek(wk));
        dateRanges.push((nextRow[c] || '').trim());
      }
    }
  } else {
    for (var c = 1; c < hRow.length; c++) {
      var cell = (hRow[c] || '').trim();
      if (!cell || !/^W\d+/i.test(cell)) continue;
      var m = cell.match(/^(W\d+\s+\d{4})\s+(.+)$/i);
      if (m) {
        weeks.push(normalizeWeek(m[1]));
        dateRanges.push(m[2].trim());
      } else {
        weeks.push(normalizeWeek(cell));
        dateRanges.push('');
      }
    }
  }
  return { weeks: weeks, dateRanges: dateRanges };
}

// ── Extract week labels + column indices from individual business sheet tabs ──
// Returns { weekLabels: ["W01 2026", "W02 2026", ...], weekCols: [colIndex, ...] }
function getTabWeekInfo(rows) {
  var weekLabels = [];
  var weekCols = [];
  for (var r = 0; r < Math.min(rows.length, 3); r++) {
    for (var c = 0; c < (rows[r] || []).length; c++) {
      var val = (rows[r][c] || '').trim();
      if (/^W\d+/i.test(val)) {
        weekLabels.push(normalizeWeek(val));
        weekCols.push(c);
      }
    }
    if (weekLabels.length > 0) break;
  }
  return { weekLabels: weekLabels, weekCols: weekCols };
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
          label === 'tier 1' || label === 'tier 2/3') break;
    }
    metricRows.push({ label: label, row: rows[r] });
  }

  var tlSentFound = false;
  var pwSentFound = false;

  for (var i = 0; i < metricRows.length; i++) {
    var label = metricRows[i].label;
    var row = metricRows[i].row;
    var vals = [];
    for (var c = 1; c <= weekCount; c++) vals.push(num(row ? row[c] : ''));

    if (/leads?\s*generated/i.test(label)) result.gen = vals;
    else if (/leads?\s*sold/i.test(label) || /sold\s*\(excl/i.test(label)) result.sold = vals;
    else if (/sold\s*%/i.test(label)) result.sp = vals;
    else if (/sent\s*to\s*(tl|thompson)/i.test(label)) { result.tlS = vals; tlSentFound = true; }
    else if (/sent\s*to\s*(pacific|pw)/i.test(label)) { result.pwS = vals; pwSentFound = true; }
    else if (/contract\s*signed/i.test(label)) {
      if (pwSentFound && result.pwC.length === 0) result.pwC = vals;
      else if (tlSentFound && result.tlC.length === 0) result.tlC = vals;
    } else if (/conversion\s*rate/i.test(label)) {
      if (pwSentFound && result.pwR.length === 0) result.pwR = vals;
      else if (tlSentFound && result.tlR.length === 0) result.tlR = vals;
    }
  }
  return result;
}

// ── Align state data arrays to the main trend weeks ──
// tabWeekLabels = week labels from the individual tab (e.g. ["W01 2026", "W02 2026", ...])
// trendWeeks = week labels from the trend tab (e.g. ["W44 2025", ..., "W20 2026"])
// rawVals = the extracted values array (length = tabWeekLabels.length)
// Returns: array of length trendWeeks.length, with nulls for weeks not in the tab
function alignToTrend(rawVals, tabWeekLabels, trendWeeks) {
  if (!rawVals || rawVals.length === 0) return [];
  var result = [];
  for (var i = 0; i < trendWeeks.length; i++) result.push(null);

  // Build a map from tab week label to its index in rawVals
  for (var t = 0; t < tabWeekLabels.length; t++) {
    var tabWeek = tabWeekLabels[t];
    // Find matching trend week
    for (var tw = 0; tw < trendWeeks.length; tw++) {
      if (trendWeeks[tw] === tabWeek) {
        if (t < rawVals.length) result[tw] = rawVals[t];
        break;
      }
    }
  }
  return result;
}

// ── Parse by-state data from individual business sheets, aligned to trend weeks ──
function parseStateData(rows, format, trendWeeks) {
  var states = {};
  var TRACKED = ['TX', 'AZ', 'CA', 'GA', 'OH', 'IL'];

  // Get week info from this tab
  var tabInfo = getTabWeekInfo(rows);
  var tabWeekLabels = tabInfo.weekLabels;
  var weekCols = tabInfo.weekCols;

  // Fallback: if no week columns found, use all columns after col 1
  if (weekCols.length === 0) {
    var maxCols = 0;
    for (var r = 0; r < rows.length; r++) {
      if ((rows[r] || []).length > maxCols) maxCols = rows[r].length;
    }
    for (var c = 2; c < maxCols; c++) weekCols.push(c);
  }

  function extractRawVals(row) {
    var vals = [];
    for (var i = 0; i < weekCols.length; i++) {
      vals.push(num(row ? row[weekCols[i]] : ''));
    }
    return vals;
  }

  function align(rawVals) {
    if (tabWeekLabels.length > 0 && trendWeeks.length > 0) {
      return alignToTrend(rawVals, tabWeekLabels, trendWeeks);
    }
    return rawVals; // No alignment possible, return as-is
  }

  function assignMetric(st, metric, row) {
    var raw = extractRawVals(row);
    var vals = align(raw);
    if (/leads?\s*generated/i.test(metric)) states[st].gen = vals;
    else if (/leads?\s*routed/i.test(metric)) states[st].rt = vals;
    else if (/^%\s*sent/i.test(metric) || /routing\s*%/i.test(metric)) states[st].tp = vals;
    else if (/leads?\s*sent\s*to\s*tl/i.test(metric)) states[st].ts = vals;
    else if (/contract\s*signed/i.test(metric)) states[st].cs = vals;
    else if (/conversion/i.test(metric)) states[st].cr = vals;
  }

  var emptyState = function() { return { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] }; };

  if (format === 'springzip') {
    var currentState = null;
    for (var r = 0; r < rows.length; r++) {
      var c0 = ((rows[r] || [])[0] || '').trim().toUpperCase();
      var c1 = ((rows[r] || [])[1] || '').trim().toUpperCase();

      var foundState = null;
      for (var s = 0; s < TRACKED.length; s++) {
        if (c0.indexOf(TRACKED[s]) === 0 || c1.indexOf(TRACKED[s]) === 0) {
          foundState = TRACKED[s]; break;
        }
      }
      if (foundState) {
        currentState = foundState;
        if (!states[currentState]) states[currentState] = emptyState();
        continue;
      }
      if (!currentState) continue;

      var metric = ((rows[r] || [])[1] || (rows[r] || [])[0] || '').trim();
      if (metric === '' || /^(by\s*state|total)/i.test(metric)) continue;
      assignMetric(currentState, metric, rows[r]);
    }
  } else {
    for (var r = 0; r < rows.length; r++) {
      var st = ((rows[r] || [])[0] || '').trim().toUpperCase();
      if (TRACKED.indexOf(st) === -1) continue;
      if (!states[st]) states[st] = emptyState();
      var metric = ((rows[r] || [])[1] || '').trim();
      assignMetric(st, metric, rows[r]);
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
      fetch(csvUrl('Weekly Performance Trend')).then(function(r) { return r.text(); }),
      fetch(csvUrl('LGM')).then(function(r) { return r.text(); }),
      fetch(csvUrl('SpringZip')).then(function(r) { return r.text(); }),
      fetch(csvUrl('MyAccident')).then(function(r) { return r.text(); }),
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
          firstRows: trendRows.slice(0, 10).map(function(r) { return r.slice(0, 5); }),
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

    // Parse state data, aligned to trend weeks
    var lgmStates = parseStateData(parseCSV(responses[1]), 'standard', weeks);
    var spzStates = parseStateData(parseCSV(responses[2]), 'springzip', weeks);
    var maStates = parseStateData(parseCSV(responses[3]), 'standard', weeks);

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
