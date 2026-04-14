var SHEET_ID = "1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes";

async function fetchSheet(sheetName) {
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName);
  var res = await fetch(url);
  return parseCSV(await res.text());
}

function parseCSV(text) {
  var lines = [], current = "", inQ = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') { inQ = !inQ; current += ch; }
    else if (ch === "\n" && !inQ) { lines.push(current); current = ""; }
    else { current += ch; }
  }
  if (current) lines.push(current);
  var rows = [];
  for (var li = 0; li < lines.length; li++) {
    var cells = [], cell = "", q = false;
    for (var j = 0; j < lines[li].length; j++) {
      var c = lines[li][j];
      if (c === '"') { if (q && lines[li][j + 1] === '"') { cell += '"'; j++; } else q = !q; }
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
  var cleaned = s.replace(/%/g, "").replace(/,/g, "").replace(/\$/g, "").trim();
  var n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseHeader(headerRow) {
  var weeks = [], dateRanges = [], cols = [];
  for (var c = 1; c < headerRow.length; c++) {
    var val = (headerRow[c] || "").trim();
    if (!val) continue;
    var parts = val.split(" ", 2);
    var wk = parts[0] || "";
    var yr = parts[1] || "";
    if (yr !== "2026") continue;
    var rest = val.substring(wk.length + yr.length + 2).trim();
    weeks.push(wk);
    dateRanges.push(rest);
    cols.push(c);
  }
  return { weeks: weeks, dateRanges: dateRanges, cols: cols };
}

function getVals(row, cols) {
  return cols.map(function(c) { return toNum(row ? row[c] : null); });
}

function findRow(rows, label, startFrom) {
  for (var r = startFrom || 0; r < rows.length; r++) {
    var val = (rows[r][0] || "").trim();
    if (val === label || val === label + " ") return r;
  }
  return -1;
}

function findNextMetric(rows, label, startFrom) {
  for (var r = startFrom || 0; r < rows.length; r++) {
    var val = (rows[r][0] || "").trim();
    if (val === label || val === label + " ") return r;
  }
  return -1;
}

function extractSection(rows, sectionLabel, cols, startFrom) {
  var start = findRow(rows, sectionLabel, startFrom || 0);
  if (start === -1) return { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [], endRow: startFrom };

  var gen = [], sold = [], sp = [], tlS = [], tlC = [], tlR = [], pwS = [], pwC = [], pwR = [];
  var foundTL = false;
  var foundPW = false;
  var tlCRow = -1;
  var pwCRow = -1;

  for (var r = start + 1; r < rows.length; r++) {
    var label = (rows[r][0] || "").trim();
    if (label === "SpringZip" || label === "MyAccident" || label === "Tier 1" || label === "Tier 1 " || label === "Tier 2/3") {
      if (r > start + 1) break;
    }
    if (label === "Leads Generated") { gen = getVals(rows[r], cols); }
    else if (label === "leads sold" || label === "leads sold(excl. LGM)") { sold = getVals(rows[r], cols); }
    else if (label === "Sold %") { sp = getVals(rows[r], cols); }
    else if (label === "Leads Sent to TL" && !foundTL) { tlS = getVals(rows[r], cols); foundTL = true; }
    else if (label === "Contract Signed" && foundTL && !foundPW && tlCRow === -1) { tlC = getVals(rows[r], cols); tlCRow = r; }
    else if (label === "Conversion rate" || label === "Conversion rate ") {
      if (foundTL && tlCRow !== -1 && !foundPW) { tlR = getVals(rows[r], cols); }
      else if (foundPW && pwCRow !== -1) { pwR = getVals(rows[r], cols); break; }
    }
    else if (label === "Leads Sent to Pacific Workers") { pwS = getVals(rows[r], cols); foundPW = true; }
    else if (label === "Contract Signed" && foundPW && pwCRow === -1) { pwC = getVals(rows[r], cols); pwCRow = r; }
  }

  return { gen: gen, sold: sold, sp: sp, tlS: tlS, tlC: tlC, tlR: tlR, pwS: pwS, pwC: pwC, pwR: pwR };
}

function extractByState(rows) {
  var hdr = parseHeader(rows[0] || []);
  var cols = hdr.cols;
  var states = {};
  var metricNames = {
    "Leads Generated": "gen", "Leads Routed": "rt", "Leads Routed ": "rt",
    "Leads Routed (Excl. LGM)": "rt", "Leads Sent to TL": "ts",
    "% Sent to TL": "tp", "Contract Signed": "cs", "Conversion Rate": "cr",
    "Leads sent to PW": "ts", "% Sent to PW": "tp"
  };
  var currentState = null;
  for (var r = 0; r < rows.length; r++) {
    var c0 = (rows[r][0] || "").trim();
    var c1 = (rows[r][1] || "").trim();
    if (c0 && /^[A-Z]{2}$/.test(c0) && c1 && metricNames[c1]) {
      if (!states[c0]) states[c0] = {};
      states[c0][metricNames[c1]] = getVals(rows[r], cols);
      currentState = c0;
    } else if (c0 && /^[A-Z]{2}$/.test(c0) && c1) {
      currentState = c0;
    } else if (!c0 && c1) {
      var stMatch = c1.match(/^([A-Z]{2})\s/);
      if (stMatch && (c1.indexOf("Vehicle") >= 0 || c1.indexOf("Workers") >= 0 || /^[A-Z]{2}\s*$/.test(c1))) {
        currentState = stMatch[1];
      } else if (currentState && metricNames[c1]) {
        if (!states[currentState]) states[currentState] = {};
        states[currentState][metricNames[c1]] = getVals(rows[r], cols);
      }
    }
  }
  return states;
}

export default async function handler(req, res) {
  try {
    var sheets = await Promise.all([
      fetchSheet("Weekly Performance Trend"),
      fetchSheet("LGM"),
      fetchSheet("SpringZip"),
      fetchSheet("MyAccident")
    ]);
    var trend = sheets[0];
    var hdr = parseHeader(trend[0] || []);
    var cols = hdr.cols;
    res.status(200).json({
      weeks: hdr.weeks,
      dateRanges: hdr.dateRanges,
      lgm: extractSection(trend, "LGM", cols),
      spz: extractSection(trend, "SpringZip", cols),
      maTier1: extractSection(trend, "Tier 1", cols),
      maTier23: extractSection(trend, "Tier 2/3", cols),
      lgmStates: extractByState(sheets[1]),
      spzStates: extractByState(sheets[2]),
      maStates: extractByState(sheets[3]),
      lastUpdated: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch data", details: e.message });
  }
}
