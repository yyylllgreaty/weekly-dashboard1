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

function parseHeader(headerRow, dateRow) {
  var weeks = [], dateRanges = [], cols = [];
  for (var c = 1; c < headerRow.length; c++) {
    var val = (headerRow[c] || "").trim();
    if (!val) continue;

    // Try original format: "W14 2026 Mar 30, 2026 - Apr 5, 2026" (all in one cell)
    var parts = val.split(" ", 2);
    var wk = parts[0] || "";
    var yr = parts[1] || "";

    if (yr === "2026") {
      var rest = val.substring(wk.length + yr.length + 2).trim();
      // If rest is empty, date range might be in a second row
      if (!rest && dateRow && dateRow[c]) {
        rest = (dateRow[c] || "").trim();
      }
      weeks.push(wk);
      dateRanges.push(rest);
      cols.push(c);
    }
  }
  return { weeks: weeks, dateRanges: dateRanges, cols: cols };
}

function getVals(row, cols) {
  return cols.map(function (c) { return toNum(row ? row[c] : null); });
}

function section(rows, baseRow, cols) {
  return {
    gen: getVals(rows[baseRow + 1], cols),
    sold: getVals(rows[baseRow + 2], cols),
    sp: getVals(rows[baseRow + 3], cols),
    tlS: getVals(rows[baseRow + 4], cols),
    tlC: getVals(rows[baseRow + 5], cols),
    tlR: getVals(rows[baseRow + 6], cols),
    pwS: getVals(rows[baseRow + 7], cols),
    pwC: getVals(rows[baseRow + 8], cols),
    pwR: getVals(rows[baseRow + 9], cols)
  };
}

function extractByState(rows) {
  // Try row 0 first, then row 0 + row 1 for two-row headers
  var hdr = parseHeader(rows[0] || [], rows[1] || []);
  var cols = hdr.cols;
  var states = {};
  var metricNames = {
    "Leads Generated": "gen",
    "Leads Routed": "rt",
    "Leads Routed ": "rt",
    "Leads Routed (Excl. LGM)": "rt",
    "Leads Sent to TL": "ts",
    "% Sent to TL": "tp",
    "Contract Signed": "cs",
    "Conversion Rate": "cr",
    "Leads sent to PW": "ts",
    "% Sent to PW": "tp"
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

// Find the row index where a section header appears (e.g. "LGM", "SpringZip", "MyAccident")
function findSectionRow(rows, label) {
  for (var r = 0; r < rows.length; r++) {
    var c0 = (rows[r][0] || "").trim();
    if (c0 === label) return r;
  }
  return -1;
}

// Find sub-header row (e.g. "Tier 1", "Tier 2/3") after a given start row
function findSubRow(rows, label, startRow) {
  for (var r = startRow; r < rows.length; r++) {
    var c0 = (rows[r][0] || "").trim();
    var c1 = (rows[r][1] || "").trim();
    if (c0 === label || c1 === label) return r;
  }
  return -1;
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

    // Parse header — try row 0 alone first, then row 0 + row 1 for two-row headers
    var hdr = parseHeader(trend[0] || [], trend[1] || []);
    var c = hdr.cols;

    // Find section headers dynamically instead of hardcoding row numbers
    var lgmRow = findSectionRow(trend, "LGM");
    var spzRow = findSectionRow(trend, "SpringZip");
    var maRow = findSectionRow(trend, "MyAccident");

    // For MA, find Tier 1 and Tier 2/3 sub-headers
    var t1Row = -1;
    var t23Row = -1;
    if (maRow >= 0) {
      t1Row = findSubRow(trend, "Tier 1", maRow);
      t23Row = findSubRow(trend, "Tier 2/3", maRow);
    }

    res.status(200).json({
      weeks: hdr.weeks,
      dateRanges: hdr.dateRanges,
      lgm: lgmRow >= 0 ? section(trend, lgmRow, c) : section(trend, 0, c),
      spz: spzRow >= 0 ? section(trend, spzRow, c) : section(trend, 10, c),
      maTier1: t1Row >= 0 ? section(trend, t1Row, c) : section(trend, 21, c),
      maTier23: t23Row >= 0 ? section(trend, t23Row, c) : section(trend, 31, c),
      lgmStates: extractByState(sheets[1]),
      spzStates: extractByState(sheets[2]),
      maStates: extractByState(sheets[3]),
      lastUpdated: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch data", details: e.message });
  }
}
