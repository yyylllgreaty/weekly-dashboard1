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
  if (v == null || v === '') return null;
  const s = String(v).replace(/,/g, '').replace(/%/g, '').trim();
  if (s === '' || s === '-') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── Parse week headers ──
// Handles format: "W44 2025 Oct 27, 2025 - Nov 2, 2025" (single cell)
// Also handles two-row: row1 = "W14 2026", row2 = "Mar 30, 2026 - Apr 5, 2026"
function parseWeekHeaders(rows) {
  if (!rows || rows.length === 0) return { weeks: [], dateRanges: [], dataStartRow: 0 };

  const weeks = [];
  const dateRanges = [];

  // Find the first row that has week-like headers (W## pattern) starting from col 1+
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    for (let c = 1; c < rows[r].length; c++) {
      if (/^W\d+/i.test(rows[r][c])) {
        headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) return { weeks: [], dateRanges: [], dataStartRow: 0 };

  const hRow = rows[headerRow];

  // Check if next row looks like date ranges (not a metric name)
  const nextRow = rows[headerRow + 1];
  const nextRowIsDateRange =
    nextRow &&
    nextRow.length > 1 &&
    /[A-Z][a-z]{2}\s+\d/.test(nextRow[1]) &&
    !/(leads|sold|sent|contract|conversion|generated)/i.test(nextRow[1]);

  if (nextRowIsDateRange) {
    // Two-row format: row1 = "W14 2026", row2 = "Mar 30, 2026 - Apr 5, 2026"
    for (let c = 1; c < hRow.length; c++) {
      const wk = hRow[c];
      if (/^W\d+/i.test(wk)) {
        weeks.push(wk.trim());
        dateRanges.push(nextRow[c] ? nextRow[c].trim() : '');
      }
    }
    return { weeks, dateRanges, dataStartRow: headerRow + 2 };
  } else {
    // Single-row format: "W44 2025 Oct 27, 2025 - Nov 2, 2025"
    for (let c = 1; c < hRow.length; c++) {
      const cell = hRow[c];
      if (!cell || !/^W\d+/i.test(cell)) continue;

      // Match: W## YYYY <date range>
      const m = cell.match(/^(W\d+\s+\d{4})\s+(.+)$/i);
      if (m) {
        weeks.push(m[1].trim());
        dateRanges.push(m[2].trim());
      } else {
        // Just "W## YYYY" with no date range
        weeks.push(cell.trim());
        dateRanges.push('');
      }
    }
    return { weeks, dateRanges, dataStartRow: headerRow + 1 };
  }
}

// ── Find section in rows ──
function findSection(rows, label, startFrom = 0) {
  const lbl = label.toLowerCase().trim();
  for (let r = startFrom; r < rows.length; r++) {
    const cell = (rows[r][0] || '').toLowerCase().trim();
    if (cell === lbl || cell.startsWith(lbl)) return r;
  }
  return -1;
}

// ── Extract metric values from a row ──
function extractValues(row, count) {
  const vals = [];
  for (let c = 1; c <= count; c++) {
    vals.push(row && row[c] ? row[c] : '');
  }
  return vals;
}

// ── Parse a business section (9 metric rows after header) ──
// Rows: Leads Generated, Leads Sold, Sold %, [blank], Leads Sent to TL,
//        Contract Signed, Conversion Rate, Leads Sent to PW, Contract Signed, Conversion Rate
function parseBusinessSection(rows, sectionRow, weekCount) {
  const result = { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] };

  // Find the metric rows after the section header
  // Skip any blank rows between header and first metric
  let startRow = sectionRow + 1;
  while (startRow < rows.length && (!rows[startRow] || !rows[startRow][0] || rows[startRow][0].trim() === '')) {
    startRow++;
  }

  // Map metric names to their data
  const metricRows = [];
  for (let r = startRow; r < Math.min(startRow + 15, rows.length); r++) {
    const label = (rows[r] && rows[r][0] ? rows[r][0] : '').toLowerCase().trim();
    // Stop if we hit another section header
    if (
      label === 'springzip' ||
      label === 'myaccident' ||
      label === 'lgm' ||
      label === 'tier 1' ||
      label === 'tier 2/3'
    ) {
      // Only stop if this isn't the section we just started
      if (r > startRow + 1) break;
    }
    metricRows.push({ label, row: rows[r], rowIndex: r });
  }

  // Extract metrics by name matching
  for (const { label, row } of metricRows) {
    const vals = extractValues(row, weekCount);
    if (/leads?\s*generated/i.test(label)) {
      result.gen = vals.map(num);
    } else if (/leads?\s*sold/i.test(label) || /sold\s*\(excl/i.test(label)) {
      result.sold = vals.map(num);
    } else if (/sold\s*%/i.test(label) || /sell.*through/i.test(label)) {
      result.sp = vals.map(num);
    } else if (/sent\s*to\s*tl/i.test(label) || /leads?\s*sent\s*to\s*(thompson|tl)/i.test(label)) {
      result.tlS = vals.map(num);
    } else if (/sent\s*to\s*(pacific|pw)/i.test(label)) {
      result.pwS = vals.map(num);
    } else if (/conversion\s*rate/i.test(label)) {
      // Could be TL or PW conversion — depends on position
      if (result.tlR.length === 0 && result.tlS.length > 0) {
        result.tlR = vals.map(num);
      } else if (result.pwR.length === 0 && result.pwS.length > 0) {
        result.pwR = vals.map(num);
      }
    } else if (/contract\s*signed/i.test(label)) {
      if (result.tlC.length === 0 && result.tlS.length > 0) {
        result.tlC = vals.map(num);
      } else if (result.pwC.length === 0 && result.pwS.length > 0) {
        result.pwC = vals.map(num);
      }
    }
  }

  return result;
}

// ── Parse by-state data from individual business sheets ──
function parseStateData(rows, format) {
  const states = {};
  const TRACKED = ['TX', 'AZ', 'CA', 'GA', 'OH', 'IL'];
  const weekCount = rows[0] ? rows[0].length - 2 : 0; // col0=state, col1=metric, rest=weeks

  if (format === 'springzip') {
    // SpringZip: section headers like "TX Vehicle", "AZ Vehicle" in col0 or col1
    let currentState = null;
    for (let r = 0; r < rows.length; r++) {
      const c0 = (rows[r][0] || '').trim();
      const c1 = (rows[r][1] || '').trim();

      // Check for state header
      for (const st of TRACKED) {
        if (c0.toUpperCase().startsWith(st) || c1.toUpperCase().startsWith(st)) {
          currentState = st;
          if (!states[st]) states[st] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };
          break;
        }
      }

      if (!currentState) continue;

      const metric = (c1 || c0).toLowerCase();
      const vals = [];
      for (let c = 2; c < rows[r].length; c++) {
        vals.push(num(rows[r][c]));
      }

      if (/leads?\s*generated/i.test(metric)) states[currentState].gen = vals;
      else if (/leads?\s*routed/i.test(metric)) states[currentState].rt = vals;
      else if (/sent\s*to\s*tl/i.test(metric) || /leads?\s*sent/i.test(metric))
        states[currentState].ts = vals;
      else if (/%\s*sent/i.test(metric) || /routing/i.test(metric)) states[currentState].tp = vals;
      else if (/contract\s*signed/i.test(metric)) states[currentState].cs = vals;
      else if (/conversion/i.test(metric)) states[currentState].cr = vals;
    }
  } else {
    // LGM & MA: col0 = state abbreviation, col1 = metric name
    for (let r = 0; r < rows.length; r++) {
      const st = (rows[r][0] || '').trim().toUpperCase();
      if (!TRACKED.includes(st)) continue;

      if (!states[st]) states[st] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };

      const metric = (rows[r][1] || '').toLowerCase();
      const vals = [];
      for (let c = 2; c < rows[r].length; c++) {
        vals.push(num(rows[r][c]));
      }

      if (/leads?\s*generated/i.test(metric)) states[st].gen = vals;
      else if (/leads?\s*routed/i.test(metric)) states[st].rt = vals;
      else if (/sent\s*to\s*tl/i.test(metric) || /leads?\s*sent/i.test(metric)) states[st].ts = vals;
      else if (/%\s*sent/i.test(metric) || /routing/i.test(metric)) states[st].tp = vals;
      else if (/contract\s*signed/i.test(metric)) states[st].cs = vals;
      else if (/conversion/i.test(metric)) states[st].cr = vals;
    }
  }

  return states;
}

// ── Main API Handler ──
export default async function handler(req, res) {
  try {
    // Fetch all four sheets
    const [trendCSV, lgmCSV, spzCSV, maCSV] = await Promise.all([
      fetch(csvUrl('Weekly Performance Trend')).then((r) => r.text()),
      fetch(csvUrl('LGM')).then((r) => r.text()),
      fetch(csvUrl('SpringZip')).then((r) => r.text()),
      fetch(csvUrl('MyAccident')).then((r) => r.text()),
    ]);

    const trendRows = parseCSV(trendCSV);

    // Parse week headers
    const { weeks, dateRanges, dataStartRow } = parseWeekHeaders(trendRows);
    const weekCount = weeks.length;

    if (weekCount === 0) {
      // Debug: return first few rows to help diagnose
      return res.status(200).json({
        error: 'No weeks found in spreadsheet',
        _debug: {
          totalRows: trendRows.length,
          weekRows: [],
          firstRows: trendRows.slice(0, 10).map((r) => r.slice(0, 5)),
        },
        weeks: [],
        dateRanges: [],
        lgm: { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] },
        spz: { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] },
        maTier1: { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] },
        maTier23: { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] },
        lgmStates: {},
        spzStates: {},
        maStates: {},
        lastUpdated: new Date().toISOString(),
      });
    }

    // Find sections in the trend sheet
    const lgmRow = findSection(trendRows, 'LGM');
    const spzRow = findSection(trendRows, 'SpringZip', lgmRow > -1 ? lgmRow + 1 : 0);
    const maRow = findSection(trendRows, 'MyAccident', spzRow > -1 ? spzRow + 1 : 0);

    // Parse each business section
    const lgm = lgmRow > -1 ? parseBusinessSection(trendRows, lgmRow, weekCount) : emptyBiz();
    const spz = spzRow > -1 ? parseBusinessSection(trendRows, spzRow, weekCount) : emptyBiz();

    // MyAccident has Tier 1 and Tier 2/3 subsections
    let maTier1 = emptyBiz();
    let maTier23 = emptyBiz();
    if (maRow > -1) {
      const t1Row = findSection(trendRows, 'Tier 1', maRow);
      const t23Row = findSection(trendRows, 'Tier 2/3', maRow);
      if (t1Row > -1) maTier1 = parseBusinessSection(trendRows, t1Row, weekCount);
      if (t23Row > -1) maTier23 = parseBusinessSection(trendRows, t23Row, weekCount);
    }

    // Parse by-state data from individual sheets
    const lgmStateRows = parseCSV(lgmCSV);
    const spzStateRows = parseCSV(spzCSV);
    const maStateRows = parseCSV(maCSV);

    const lgmStates = parseStateData(lgmStateRows, 'standard');
    const spzStates = parseStateData(spzStateRows, 'springzip');
    const maStates = parseStateData(maStateRows, 'standard');

    res.status(200).json({
      weeks,
      dateRanges,
      lgm,
      spz,
      maTier1,
      maTier23,
      lgmStates,
      spzStates,
      maStates,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}

function emptyBiz() {
  return { gen: [], sold: [], sp: [], tlS: [], tlC: [], tlR: [], pwS: [], pwC: [], pwR: [] };
}
