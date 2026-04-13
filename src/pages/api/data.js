const SHEET_ID = "1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes";

async function fetchSheet(sheetName) {
  const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName);
  const res = await fetch(url, { next: { revalidate: 300 } });
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  var lines = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if (ch === "\n" && !inQuotes) { lines.push(current); current = ""; }
    else { current += ch; }
  }
  if (current) lines.push(current);
  var rows = [];
  for (var li = 0; li < lines.length; li++) {
    var cells = []; var cell = ""; var q = false;
    for (var j = 0; j < lines[li].length; j++) {
      var c = lines[li][j];
      if (c === '"') { if (q && lines[li][j+1] === '"') { cell += '"'; j++; } else q = !q; }
      else if (c === "," && !q) { cells.push(cell.trim()); cell = ""; }
      else { cell += c; }
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

function toNum(s) {
  if (!s || s === "" || s === "-" || s === "-%" || s === "#DIV/0!") return null;
  var cleaned = s.replace(/[$,%]/g, "").replace(/\((.+)\)/, "-$1");
  var n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function getVals(rows, rowIdx, startCol, endCol) {
  if (rowIdx < 0 || rowIdx >= rows.length) return [];
  var vals = [];
  for (var c = startCol; c <= endCol; c++) {
    vals.push(toNum(rows[rowIdx] ? rows[rowIdx][c] : null));
  }
  return vals;
}

function findRow(rows, col, value, startRow) {
  for (var r = startRow || 0; r < rows.length; r++) {
    if (rows[r] && rows[r][col] && rows[r][col].trim() === value) return r;
  }
  return -1;
}

function extractTrend(rows) {
  var weekRow = rows[0] || [];
  var dateRow = rows[1] || [];
  var weeks = []; var dateRanges = [];
  var startCol = -1; var endCol = -1;
  for (var c = 1; c < weekRow.length; c++) {
    var val = (weekRow[c] || "").trim();
    if (val && val.match(/W\d+/)) {
      if (startCol === -1) startCol = c;
      endCol = c;
      weeks.push(val);
      dateRanges.push((dateRow[c] || "").trim());
    }
  }
  var lgmStart = findRow(rows, 0, "LGM", 0);
  var spzStart = findRow(rows, 0, "SpringZip", lgmStart > 0 ? lgmStart : 10);
  var ma1Start = findRow(rows, 0, "Tier 1", spzStart > 0 ? spzStart : 20);
  var ma23Start = findRow(rows, 0, "Tier 2/3", ma1Start > 0 ? ma1Start : 30);

  function sectionMetrics(start) {
    if (start < 0) return { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] };
    var gen = getVals(rows, start + 1, startCol, endCol);
    var sold = getVals(rows, start + 2, startCol, endCol);
    var sp = getVals(rows, start + 3, startCol, endCol);
    var tlSent = getVals(rows, start + 5, startCol, endCol);
    var tlSigned = getVals(rows, start + 6, startCol, endCol);
    var tlConv = getVals(rows, start + 7, startCol, endCol);
    var pwSent = getVals(rows, start + 9, startCol, endCol);
    var pwSigned = getVals(rows, start + 10, startCol, endCol);
    var pwConv = getVals(rows, start + 11, startCol, endCol);
    return {
      gen: gen, sold: sold,
      sp: sp.map(function(v) { return v != null ? v * 100 : null; }),
      tlS: tlSent, tlC: tlSigned,
      tlR: tlConv.map(function(v) { return v != null ? v * 100 : null; }),
      pwS: pwSent, pwC: pwSigned,
      pwR: pwConv.map(function(v) { return v != null ? v * 100 : null; })
    };
  }
  return { weeks: weeks, dateRanges: dateRanges, lgm: sectionMetrics(lgmStart), spz: sectionMetrics(spzStart), maTier1: sectionMetrics(ma1Start), maTier23: sectionMetrics(ma23Start) };
}

function extractByState(rows, startCol, endCol) {
  var states = {};
  var stateMetricMap = { "Leads Generated": "gen", "Leads Routed": "rt", "Leads Routed ": "rt", "Leads Sent to TL": "ts", "% Sent to TL": "tp", "Contract Signed": "cs", "Conversion Rate": "cr", "Leads Routed (Excl. LGM)": "rt", "Leads sent to PW": "ts", "% Sent to PW": "tp" };
  for (var r = 0; r < rows.length; r++) {
    var col0 = (rows[r] && rows[r][0] ? rows[r][0] : "").trim();
    var col1 = (rows[r] && rows[r][1] ? rows[r][1] : "").trim();
    if (col0 && col0.length <= 3 && /^[A-Z]{2}$/.test(col0) && col1 && stateMetricMap[col1]) {
      if (!states[col0]) states[col0] = {};
      var key = stateMetricMap[col1];
      var vals = getVals(rows, r, startCol, endCol);
      if (key === "tp" || key === "cr") { states[col0][key] = vals.map(function(v) { return v != null ? v * 100 : null; }); }
      else { states[col0][key] = vals; }
    }
  }
  return states;
}

function extractBizSheet(rows) {
  var weekRow = rows[0] || [];
  var startCol = -1; var endCol = -1;
  for (var c = 2; c < weekRow.length; c++) {
    var val = (weekRow[c] || "").trim();
    if (val && val.match(/W\d+/)) { if (startCol === -1) startCol = c; endCol = c; }
  }
  if (startCol === -1) return {};
  return extractByState(rows, startCol, endCol);
}

export default async function handler(req, res) {
  try {
    var results = await Promise.all([
      fetchSheet("Weekly Performance Trend"),
      fetchSheet("LGM"),
      fetchSheet("SpringZip"),
      fetchSheet("MyAccident"),
    ]);
    var trend = extractTrend(results[0]);
    res.status(200).json({
      weeks: trend.weeks, dateRanges: trend.dateRanges,
      lgm: trend.lgm, spz: trend.spz, maTier1: trend.maTier1, maTier23: trend.maTier23,
      lgmStates: extractBizSheet(results[1]),
      spzStates: extractBizSheet(results[2]),
      maStates: extractBizSheet(results[3]),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sheet data", details: error.message });
  }
}
