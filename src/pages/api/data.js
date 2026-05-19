// src/pages/api/data.js
const SHEET_ID = '1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes';
const csvUrl = (sheet) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

function parseCSV(text) {
  var rows = [], current = '', inQuotes = false, row = [];
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i+1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(current.trim()); current = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(current.trim());
        if (row.some(function(c){return c!=='';})) rows.push(row);
        row = []; current = '';
      } else { current += ch; }
    }
  }
  row.push(current.trim());
  if (row.some(function(c){return c!=='';})) rows.push(row);
  return rows;
}

function num(v) {
  if (v == null || v === '' || v === '-' || v === '\u2014' || v === 'n/a') return null;
  var s = String(v).replace(/,/g,'').replace(/%/g,'').trim();
  if (s === '' || s === '-' || s === '\u2014') return null;
  var n = parseFloat(s); return isNaN(n) ? null : n;
}

function normalizeWeek(w) {
  var m = (w||'').trim().match(/^W(\d+)\s+(\d{4})/i);
  if (!m) return (w||'').trim();
  var wn = m[1].length === 1 ? '0'+m[1] : m[1];
  return 'W'+wn+' '+m[2];
}

function parseWeekHeaders(rows) {
  var weeks = [], dateRanges = [];
  if (!rows || !rows.length) return {weeks:weeks, dateRanges:dateRanges};
  var headerRow = -1;
  for (var r = 0; r < Math.min(rows.length, 5); r++) {
    for (var c = 1; c < (rows[r]||[]).length; c++) {
      if (/^W\d+/i.test(rows[r][c]||'')) { headerRow = r; break; }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) return {weeks:weeks, dateRanges:dateRanges};
  var hRow = rows[headerRow], nextRow = rows[headerRow+1]||[];
  var nfd = (nextRow[1]||'').trim();
  var twoRow = nfd.length > 0 && /[A-Z][a-z]{2}\s+\d/.test(nfd) &&
    !/(leads|sold|sent|contract|conversion|generated)/i.test(nfd);
  if (twoRow) {
    for (var c = 1; c < hRow.length; c++) {
      var wk = (hRow[c]||'').trim();
      if (/^W\d+/i.test(wk)) { weeks.push(normalizeWeek(wk)); dateRanges.push((nextRow[c]||'').trim()); }
    }
  } else {
    for (var c = 1; c < hRow.length; c++) {
      var cell = (hRow[c]||'').trim();
      if (!cell || !/^W\d+/i.test(cell)) continue;
      var m = cell.match(/^(W\d+\s+\d{4})\s+(.+)$/i);
      if (m) { weeks.push(normalizeWeek(m[1])); dateRanges.push(m[2].trim()); }
      else { weeks.push(normalizeWeek(cell)); dateRanges.push(''); }
    }
  }
  return {weeks:weeks, dateRanges:dateRanges};
}

function getTabWeekInfo(rows) {
  var weekLabels = [], weekCols = [];
  for (var r = 0; r < Math.min(rows.length, 3); r++) {
    for (var c = 0; c < (rows[r]||[]).length; c++) {
      var val = (rows[r][c]||'').trim();
      if (/^W\d+/i.test(val)) { weekLabels.push(normalizeWeek(val)); weekCols.push(c); }
    }
    if (weekLabels.length > 0) break;
  }
  return {weekLabels:weekLabels, weekCols:weekCols};
}

function findSection(rows, label, startFrom) {
  var start = startFrom||0, lbl = label.toLowerCase().trim();
  for (var r = start; r < rows.length; r++) {
    var cell = ((rows[r]||[])[0]||'').toLowerCase().trim();
    if (cell === lbl || cell.startsWith(lbl)) return r;
  }
  return -1;
}

function parseBusinessSection(rows, sectionRow, weekCount) {
  var result = {gen:[],sold:[],sp:[],tlS:[],tlC:[],tlR:[],pwS:[],pwC:[],pwR:[]};
  var metricRows = [];
  for (var r = sectionRow+1; r < Math.min(sectionRow+15, rows.length); r++) {
    var label = ((rows[r]||[])[0]||'').trim().toLowerCase();
    if (r > sectionRow+1 && /^(springzip|myaccident|lgm|tier\s*1|tier\s*2)/i.test(label)) break;
    metricRows.push({label:label, row:rows[r]});
  }
  var tlSentFound = false, pwSentFound = false;
  for (var i = 0; i < metricRows.length; i++) {
    var label = metricRows[i].label, row = metricRows[i].row, vals = [];
    for (var c = 1; c <= weekCount; c++) vals.push(num(row?row[c]:''));
    if (/leads?\s*generated/i.test(label)) result.gen = vals;
    else if (/leads?\s*sold/i.test(label)||/sold\s*\(excl/i.test(label)) result.sold = vals;
    else if (/sold\s*%/i.test(label)) result.sp = vals;
    else if (/sent\s*to\s*(tl|thompson)/i.test(label)) { result.tlS = vals; tlSentFound = true; }
    else if (/sent\s*to\s*(pacific|pw)/i.test(label)) { result.pwS = vals; pwSentFound = true; }
    else if (/contract\s*signed/i.test(label)) {
      if (pwSentFound && !result.pwC.length) result.pwC = vals;
      else if (tlSentFound && !result.tlC.length) result.tlC = vals;
    } else if (/conversion\s*rate/i.test(label)) {
      if (pwSentFound && !result.pwR.length) result.pwR = vals;
      else if (tlSentFound && !result.tlR.length) result.tlR = vals;
    }
  }
  return result;
}

function alignToTrend(rawVals, tabWeekLabels, trendWeeks) {
  if (!rawVals || !rawVals.length) return [];
  var result = [];
  for (var i = 0; i < trendWeeks.length; i++) result.push(null);
  for (var t = 0; t < tabWeekLabels.length; t++) {
    for (var tw = 0; tw < trendWeeks.length; tw++) {
      if (trendWeeks[tw] === tabWeekLabels[t]) {
        if (t < rawVals.length) result[tw] = rawVals[t];
        break;
      }
    }
  }
  return result;
}

function parseStateData(rows, format, trendWeeks) {
  var states = {}, TRACKED = ['TX','AZ','CA','GA','OH','IL'];
  var tabInfo = getTabWeekInfo(rows);
  var tabWeekLabels = tabInfo.weekLabels, weekCols = tabInfo.weekCols;
  if (!weekCols.length) {
    var maxCols = 0;
    for (var r = 0; r < rows.length; r++) if ((rows[r]||[]).length > maxCols) maxCols = rows[r].length;
    for (var c = 2; c < maxCols; c++) weekCols.push(c);
  }

  function extractRaw(row) {
    var vals = [];
    for (var i = 0; i < weekCols.length; i++) vals.push(num(row?row[weekCols[i]]:''));
    return vals;
  }
  function align(raw) {
    return (tabWeekLabels.length && trendWeeks.length) ? alignToTrend(raw, tabWeekLabels, trendWeeks) : raw;
  }
  // IMPORTANT: check % Sent BEFORE Leads Sent, and use anchored patterns
  function assignMetric(st, metricLabel, row) {
    var raw = extractRaw(row), vals = align(raw), ml = metricLabel.toLowerCase();
    if (/^%\s*sent/i.test(metricLabel) || /^routing/i.test(metricLabel)) states[st].tp = vals;
    else if (/leads?\s*generated/i.test(ml)) states[st].gen = vals;
    else if (/leads?\s*routed\s*\(/i.test(ml) || (/leads?\s*routed/i.test(ml) && !/routed\s*to\s*lgm/i.test(ml))) states[st].rt = vals;
    else if (/leads?\s*sent\s*to\s*tl/i.test(ml) || /sent\s*to\s*tl/i.test(ml)) states[st].ts = vals;
    else if (/contract\s*signed/i.test(ml)) states[st].cs = vals;
    else if (/conversion/i.test(ml)) states[st].cr = vals;
  }
  var emptyS = function(){return{gen:[],rt:[],ts:[],tp:[],cs:[],cr:[]};};

  // Both LGM, SpringZip, and MA use same format: col0 = state abbreviation, col1 = metric name
  // Find the "By State" section start
  var stateStart = -1;
  for (var r = 0; r < rows.length; r++) {
    var c0 = ((rows[r]||[])[0]||'').trim().toLowerCase();
    var c1 = ((rows[r]||[])[1]||'').trim().toLowerCase();
    if (/by\s*state/i.test(c0) || /by\s*state/i.test(c1)) { stateStart = r + 1; break; }
  }
  if (stateStart < 0) stateStart = 0;

  var blankCount = 0;
  var lastStateSeen = null;
  var rowsSinceLastState = 0;
  for (var r = stateStart; r < rows.length; r++) {
    var c0raw = ((rows[r]||[])[0]||'').trim();
    var c1raw = ((rows[r]||[])[1]||'').trim();

    // Count blank rows - stop after 3+ consecutive blanks
    if (!c0raw && !c1raw) { blankCount++; if (blankCount >= 3 && lastStateSeen) break; continue; }
    blankCount = 0;

    // Skip Workers Comp sections entirely
    if (/workers?\s*comp/i.test(c0raw) || /workers?\s*comp/i.test(c1raw)) break;

    var st = c0raw.toUpperCase();
    // Also check if col1 starts with a state (SpringZip "AZ Vehicle" style in col1)
    var st1 = c1raw.toUpperCase();
    var matchedState = null;
    for (var s = 0; s < TRACKED.length; s++) {
      if (st === TRACKED[s]) { matchedState = TRACKED[s]; break; }
    }

    if (matchedState) {
      // This is a state row — check if col1 is a metric or a section header
      var metric = c1raw;
      if (!metric || /vehicle|^$/i.test(metric.trim())) {
        // Section header like "TX" alone or "TX Vehicle" — just note the state
        if (!states[matchedState]) states[matchedState] = emptyS();
        lastStateSeen = matchedState;
        continue;
      }
      // Skip non-metric labels
      if (/workers?\s*comp|pacific\s*worker|summary/i.test(metric)) break;

      if (!states[matchedState]) states[matchedState] = emptyS();
      lastStateSeen = matchedState;
      assignMetric(matchedState, metric, rows[r]);
    } else {
      // Col0 is not a tracked state — maybe it's a section header in col1 (SpringZip)
      var foundViaC1 = null;
      for (var s = 0; s < TRACKED.length; s++) {
        if (st1.indexOf(TRACKED[s]) === 0 && /vehicle/i.test(c1raw)) {
          foundViaC1 = TRACKED[s]; break;
        }
      }
      if (foundViaC1) {
        if (!states[foundViaC1]) states[foundViaC1] = emptyS();
        lastStateSeen = foundViaC1;
        continue;
      }
      // Col0 is empty but we have a metric — use lastStateSeen
      if (lastStateSeen && c1raw && states[lastStateSeen]) {
        if (/workers?\s*comp|pacific\s*worker|summary/i.test(c1raw)) break;
        assignMetric(lastStateSeen, c1raw, rows[r]);
      }
    }
  }
  return states;
}

function emptyBiz(){return{gen:[],sold:[],sp:[],tlS:[],tlC:[],tlR:[],pwS:[],pwC:[],pwR:[]};}

export default async function handler(req, res) {
  try {
    var responses = await Promise.all([
      fetch(csvUrl('Weekly Performance Trend')).then(function(r){return r.text();}),
      fetch(csvUrl('LGM')).then(function(r){return r.text();}),
      fetch(csvUrl('SpringZip')).then(function(r){return r.text();}),
      fetch(csvUrl('MyAccident')).then(function(r){return r.text();}),
    ]);
    var trendRows = parseCSV(responses[0]);
    var h = parseWeekHeaders(trendRows);
    var weeks = h.weeks, dateRanges = h.dateRanges, weekCount = weeks.length;
    if (!weekCount) {
      return res.status(200).json({
        error:'No weeks found in spreadsheet',
        _debug:{totalRows:trendRows.length,firstRows:trendRows.slice(0,10).map(function(r){return r.slice(0,5);})},
        weeks:[],dateRanges:[],lgm:emptyBiz(),spz:emptyBiz(),maTier1:emptyBiz(),maTier23:emptyBiz(),
        lgmStates:{},spzStates:{},maStates:{},lastUpdated:new Date().toISOString(),
      });
    }
    var lgmRow = findSection(trendRows,'LGM');
    var spzRow = findSection(trendRows,'SpringZip', lgmRow>-1?lgmRow+1:0);
    var maRow = findSection(trendRows,'MyAccident', spzRow>-1?spzRow+1:0);
    var lgm = lgmRow>-1 ? parseBusinessSection(trendRows,lgmRow,weekCount) : emptyBiz();
    var spz = spzRow>-1 ? parseBusinessSection(trendRows,spzRow,weekCount) : emptyBiz();
    var maTier1 = emptyBiz(), maTier23 = emptyBiz();
    if (maRow > -1) {
      var t1 = findSection(trendRows,'Tier 1',maRow), t23 = findSection(trendRows,'Tier 2/3',maRow);
      if (t1>-1) maTier1 = parseBusinessSection(trendRows,t1,weekCount);
      if (t23>-1) maTier23 = parseBusinessSection(trendRows,t23,weekCount);
    }

    // Parse state data with debug for SpringZip
    var spzRows = parseCSV(responses[2]);
    var spzStates = parseStateData(spzRows, 'springzip', weeks);

    // Debug: capture SpringZip parsing info regardless
    var spzDebug = null;
    var txData = spzStates['TX'];
    if (!txData || !txData.gen || !txData.gen.length || txData.gen.every(function(v){return v===null;})) {
      var tabI = getTabWeekInfo(spzRows);
      spzDebug = {
        tabWeekLabels: tabI.weekLabels.slice(0,5),
        weekCols: tabI.weekCols.slice(0,5),
        totalRows: spzRows.length,
        statesFound: Object.keys(spzStates),
        txHasGen: txData ? txData.gen.length : 'no TX',
        // Show rows 15-35 (around By State section)
        rows15to35: []
      };
      for (var r = 15; r < Math.min(spzRows.length, 40); r++) {
        spzDebug.rows15to35.push({
          r: r,
          c0: ((spzRows[r]||[])[0]||'').substring(0,25),
          c1: ((spzRows[r]||[])[1]||'').substring(0,25)
        });
      }
    }

    // Also add blank-gap stop for SpringZip (CA Workers Comp section)
    // Already handled by the 'springzip' parser's section detection

    res.status(200).json({
      weeks:weeks, dateRanges:dateRanges,
      lgm:lgm, spz:spz, maTier1:maTier1, maTier23:maTier23,
      lgmStates: parseStateData(parseCSV(responses[1]), 'standard', weeks),
      spzStates: spzStates,
      maStates: parseStateData(parseCSV(responses[3]), 'standard', weeks),
      _spzDebug: spzDebug,
      lastUpdated: new Date().toISOString(),
    });
  } catch(err) {
    res.status(500).json({error:err.message, stack:err.stack});
  }
}
