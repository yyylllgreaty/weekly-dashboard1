var SHEET_ID = "1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes";

async function fetchSheet(sheetName) {
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName);
  var res = await fetch(url);
  var text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  var lines = [];
  var current = "";
  var inQ = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') { inQ = !inQ; current += ch; }
    else if (ch === "\n" && !inQ) { lines.push(current); current = ""; }
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
  var isPct = s.indexOf("%") >= 0;
  var cleaned = s.replace(/[$,%\s]/g, "").replace(/,/g, "");
  var n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return isPct ? n : n;
}

function parseHeader(headerRow) {
  var weeks = [];
  var dateRanges = [];
  var startCol = -1;
  var endCol = -1;
  for (var c = 1; c < headerRow.length; c++) {
    var val = (headerRow[c] || "").trim();
    if (!val) continue;
    var m = val.match(/^(W\d+)\s+(\d{4})\s+(.+)$/);
    if (m) {
      var wk = m[1];
      var yr = m[2];
      var dr = m[3].trim();
      if (yr === "2025") continue;
      if (startCol === -1) startCol = c;
      endCol = c;
      weeks.push(wk);
      dateRanges.push(dr);
    }
  }
  return { weeks: weeks, dateRanges: dateRanges, startCol: startCol, endCol: endCol };
}

function getVals(row, startCol, endCol) {
  var vals = [];
  for (var c = startCol; c <= endCol; c++) {
    vals.push(toNum(row ? row[c] : null));
  }
  return vals;
}

function extractTrend(rows) {
  var hdr = parseHeader(rows[0] || []);
  var sc = hdr.startCol;
  var ec = hdr.endCol;

  function section(baseRow) {
    return {
      gen: getVals(rows[baseRow + 1], sc, ec),
      sold: getVals(rows[baseRow + 2], sc, ec),
      sp: getVals(rows[baseRow + 3], sc, ec),
      tlS: getVals(rows[baseRow + 4], sc, ec),
      tlC: getVals(rows[baseRow + 5], sc, ec),
      tlR: getVals(rows[baseRow + 6], sc, ec),
      pwS: getVals(rows[baseRow + 7], sc, ec),
      pwC: getVals(rows[baseRow + 8], sc, ec),
      pwR: getVals(rows[baseRow + 9], sc, ec),
    };
  }

  return {
    weeks: hdr.weeks,
    dateRanges: hdr.dateRanges,
    lgm: section(0),
    spz: section(10),
    maTier1: section(21),
    maTier23: section(31),
  };
}

function extractByState(rows) {
  var hdr = parseHeader(rows[0] || []);
  var sc = hdr.startCol;
  var ec = hdr.endCol;
  var states = {};
  var metricMap = {
    "Leads Generated": "gen",
    "Leads Routed": "rt",
    "Leads Routed ": "rt",
    "Leads Routed (Excl. LGM)": "rt",
    "Leads Sent to TL": "ts",
    "% Sent to TL": "tp",
    "Contract Signed": "cs",
    "Conversion Rate": "cr",
    "Leads sent to PW": "ts",
    "% Sent to PW": "tp",
  };
  for (var r = 0; r < rows.length; r++) {
    var col0 = (rows[r] && rows[r][0] ? rows[r][0] : "").trim();
    var col1 = (rows[r] && rows[r][1] ? rows[r][1] : "").trim();
    if (col0 && /^[A-Z]{2}$/.test(col0) && col1 && metricMap[col1]) {
      if (!states[col0]) states[col0] = {};
      states[col0][metricMap[col1]] = getVals(rows[r], sc, ec);
    }
  }
  return states;
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
      weeks: trend.weeks,
      dateRanges: trend.dateRanges,
      lgm: trend.lgm,
      spz: trend.spz,
      maTier1: trend.maTier1,
      maTier23: trend.maTier23,
      lgmStates: extractByState(results[1]),
      spzStates: extractByState(results[2]),
      maStates: extractByState(results[3]),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch data", details: error.message });
  }
}
