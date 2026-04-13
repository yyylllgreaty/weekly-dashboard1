var SHEET_ID = "1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes";

async function fetchSheet(sheetName) {
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheetName) + "&t=" + Date.now();
  var res = await fetch(url, { cache: 'no-store' }); 
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

function findMetricRow(rows, sectionName, metricName, startRow) {
  var foundSection = sectionName === null;
  for (var i = startRow || 0; i < rows.length; i++) {
    var label = (rows[i][0] || "").trim();
    if (!foundSection && label.toLowerCase().includes(sectionName.toLowerCase())) {
        foundSection = true;
        continue;
    }
    if (foundSection && label.toLowerCase().includes(metricName.toLowerCase())) {
        return i;
    }
  }
  return -1;
}

function section(rows, title, cols) {
  var start = 0;
  if (title) {
    for (var i = 0; i < rows.length; i++) {
        if ((rows[i][0] || "").trim().toLowerCase() === title.toLowerCase()) { start = i; break; }
    }
  }
  var rGen = findMetricRow(rows, null, "Leads Generated", start);
  var rSold = findMetricRow(rows, null, "Leads Sold", rGen);
  var rSP = findMetricRow(rows, null, "Sold %", rSold);
  var rTL_S = findMetricRow(rows, null, "Sent to TL", rSP);
  var rTL_C = findMetricRow(rows, null, "Contract Signed", rTL_S);
  var rTL_R = findMetricRow(rows, null, "Conversion rate", rTL_C);
  var rPW_S = findMetricRow(rows, null, "Sent to Pacific", rTL_R);
  var rPW_C = findMetricRow(rows, null, "Contract Signed", rPW_S);
  var rPW_R = findMetricRow(rows, null, "Conversion rate", rPW_C);

  return {
    gen: rGen !== -1 ? cols.map(c => toNum(rows[rGen][c])) : [],
    sold: rSold !== -1 ? cols.map(c => toNum(rows[rSold][c])) : [],
    sp: rSP !== -1 ? cols.map(c => toNum(rows[rSP][c])) : [],
    tlS: rTL_S !== -1 ? cols.map(c => toNum(rows[rTL_S][c])) : [],
    tlC: rTL_C !== -1 ? cols.map(c => toNum(rows[rTL_C][c])) : [],
    tlR: rTL_R !== -1 ? cols.map(c => toNum(rows[rTL_R][c])) : [],
    pwS: rPW_S !== -1 ? cols.map(c => toNum(rows[rPW_S][c])) : [],
    pwC: rPW_C !== -1 ? cols.map(c => toNum(rows[rPW_C][c])) : [],
    pwR: rPW_R !== -1 ? cols.map(c => toNum(rows[rPW_R][c])) : []
  };
}

function extractByState(rows) {
  var hdr = parseHeader(rows[0] || rows[1] || []);
  var cols = hdr.cols;
  var states = {};
  var map = { 
    "leads generated": "gen", 
    "leads routed": "rt", 
    "excl. lgm": "rt",
    "leads sent to tl": "ts", 
    "% sent to tl": "tp", 
    "contract signed": "cs", 
    "conversion rate": "cr",
    "leads sent to pw": "ts",
    "% sent to pw": "tp"
  };
  
  var currentState = null;
  for (var r = 0; r < rows.length; r++) {
    var c0 = (rows[r][0] || "").trim();
    var c1 = (rows[r][1] || "").trim();
    
    // Check if Column A or B is a state code (TX, AZ, etc)
    if (/^[A-Z]{2}$/.test(c0)) currentState = c0;
    else if (/^[A-Z]{2}$/.test(c1)) currentState = c1;

    if (currentState) {
      var searchLabel = (c0 + " " + c1).toLowerCase();
      for (var key in map) {
        if (searchLabel.includes(key)) {
          if (!states[currentState]) states[currentState] = {};
          states[currentState][map[key]] = cols.map(c => toNum(rows[r][c]));
        }
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
    var c = hdr.cols;
    res.status(200).json({
      weeks: hdr.weeks,
      dateRanges: hdr.dateRanges,
      lgm: section(trend, "LGM", c),
      spz: section(trend, "SpringZip", c),
      maTier1: section(trend, "Tier 1", c),
      maTier23: section(trend, "Tier 2/3", c),
      lgmStates: extractByState(sheets[1]),
      spzStates: extractByState(sheets[2]),
      maStates: extractByState(sheets[3]),
      lastUpdated: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch data", details: e.message });
  }
}
