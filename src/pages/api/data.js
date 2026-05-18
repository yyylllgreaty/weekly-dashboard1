// src/pages/api/data.js
// DIAGNOSTIC VERSION - shows raw CSV structure to debug parsing issues

const SHEET_ID = '1b62arI2j6Who4j4SlmxM2J5gXVF34w6N1tNdGKS-Xes';
const csv = (name) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;

function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const row = [];
    let inQuotes = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function num(v) {
  if (!v || v === '' || v === 'n/a' || v === '#DIV/0!' || v === '-') return 0;
  const s = String(v).replace(/,/g, '').replace(/%/g, '').replace(/\$/g, '').trim();
  if (s === '' || s === 'n/a' || s === '#DIV/0!' || s === '-' || s === '-%') return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function pct(v) {
  if (!v || v === '' || v === 'n/a' || v === '#DIV/0!' || v === '-' || v === '-%') return 0;
  const s = String(v).replace(/,/g, '').replace(/%/g, '').trim();
  if (s === '' || s === 'n/a' || s === '#DIV/0!' || s === '-') return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Find week header row - cells matching "W## ####"
function findWeekRow(rows, startFrom = 0) {
  for (let i = startFrom; i < rows.length; i++) {
    let weekCount = 0;
    for (let j = 0; j < rows[i].length; j++) {
      if (rows[i][j] && /^W\d+\s+\d{4}$/.test(rows[i][j].trim())) {
        weekCount++;
        if (weekCount >= 3) return i;
      }
    }
  }
  return -1;
}

// Find ALL week header rows
function findAllWeekRows(rows) {
  const results = [];
  let from = 0;
  while (from < rows.length) {
    const idx = findWeekRow(rows, from);
    if (idx === -1) break;
    let count = 0;
    for (let j = 0; j < rows[idx].length; j++) {
      if (rows[idx][j] && /^W\d+\s+\d{4}$/.test(rows[idx][j].trim())) count++;
    }
    results.push({ row: idx, weekCount: count, firstCells: rows[idx].slice(0, 5) });
    from = idx + 1;
  }
  return results;
}

// Find rows containing specific text
function findTextRows(rows, text, maxResults = 10) {
  const results = [];
  const t = text.toLowerCase();
  for (let i = 0; i < rows.length && results.length < maxResults; i++) {
    for (let j = 0; j < rows[i].length; j++) {
      if (rows[i][j] && rows[i][j].toLowerCase().includes(t)) {
        results.push({ row: i, col: j, value: rows[i][j], firstCells: rows[i].slice(0, 6) });
        break;
      }
    }
  }
  return results;
}

// Extract weeks and date ranges from the best week header row
function extractWeeks(rows) {
  // Find the week header row with the MOST week columns
  const allWeekRows = findAllWeekRows(rows);
  if (allWeekRows.length === 0) return { weeks: [], dateRanges: [], weekCols: [], weekRowIdx: -1 };

  // Use the one with most weeks
  allWeekRows.sort((a, b) => b.weekCount - a.weekCount);
  const bestRow = allWeekRows[0].row;

  const weeks = [];
  const dateRanges = [];
  const weekCols = [];

  for (let j = 0; j < rows[bestRow].length; j++) {
    const cell = (rows[bestRow][j] || '').trim();
    if (/^W\d+\s+\d{4}$/.test(cell)) {
      weeks.push(cell);
      weekCols.push(j);
      const dr = (bestRow + 1 < rows.length && rows[bestRow + 1][j]) ? rows[bestRow + 1][j].trim() : '';
      dateRanges.push(dr);
    }
  }

  return { weeks, dateRanges, weekCols, weekRowIdx: bestRow };
}

// Get values from specific columns for a row
function getRowVals(rows, rowIdx, weekCols) {
  if (rowIdx < 0 || rowIdx >= rows.length) return [];
  return weekCols.map(j => rows[rowIdx][j] || '');
}

// Find a metric row within a range, checking first few columns
function findMetricRow(rows, metricName, from, to) {
  const mn = metricName.toLowerCase().trim();
  for (let i = from; i < Math.min(to, rows.length); i++) {
    for (let j = 0; j < Math.min(rows[i].length, 4); j++) {
      const cell = (rows[i][j] || '').trim().toLowerCase();
      if (cell === mn) return i;
    }
  }
  // Partial match
  for (let i = from; i < Math.min(to, rows.length); i++) {
    for (let j = 0; j < Math.min(rows[i].length, 4); j++) {
      const cell = (rows[i][j] || '').trim().toLowerCase();
      if (cell.includes(mn)) return i;
    }
  }
  return -1;
}

// Parse a section of 9 metrics for a business
function parseBizSection(rows, sectionStart, sectionEnd, weekCols) {
  const nw = weekCols.length;
  const empty = new Array(nw).fill(0);

  const genRow = findMetricRow(rows, 'leads generated', sectionStart, sectionEnd);

  // Find leads sold - might be "leads sold" or "leads sold(excl. LGM)"
  let soldRow = findMetricRow(rows, 'leads sold', sectionStart, sectionEnd);

  const spRow = findMetricRow(rows, 'sold %', sectionStart, sectionEnd);

  // Leads Sent to TL
  let tlSRow = -1;
  for (let i = sectionStart; i < Math.min(sectionEnd, rows.length); i++) {
    for (let j = 0; j < Math.min(rows[i].length, 4); j++) {
      const cell = (rows[i][j] || '').trim().toLowerCase();
      if ((cell === 'leads sent to tl' || cell.includes('leads sent to tl')) && !cell.includes('pacific') && !cell.includes('pw')) {
        tlSRow = i;
        break;
      }
    }
    if (tlSRow !== -1) break;
  }

  // Contract Signed after TL
  let tlCRow = tlSRow !== -1 ? findMetricRow(rows, 'contract signed', tlSRow + 1, Math.min(tlSRow + 4, sectionEnd)) : -1;

  // Conversion rate after TL Contract
  let tlRRow = tlCRow !== -1 ? findMetricRow(rows, 'conversion rate', tlCRow + 1, Math.min(tlCRow + 4, sectionEnd)) : -1;

  // PW: Leads Sent to Pacific Workers
  let pwSRow = -1;
  const pwSearchStart = tlRRow !== -1 ? tlRRow + 1 : (tlCRow !== -1 ? tlCRow + 1 : sectionStart);
  for (let i = pwSearchStart; i < Math.min(sectionEnd, rows.length); i++) {
    for (let j = 0; j < Math.min(rows[i].length, 4); j++) {
      const cell = (rows[i][j] || '').trim().toLowerCase();
      if (cell.includes('pacific workers') || cell.includes('sent to pw')) {
        pwSRow = i;
        break;
      }
    }
    if (pwSRow !== -1) break;
  }

  let pwCRow = pwSRow !== -1 ? findMetricRow(rows, 'contract signed', pwSRow + 1, Math.min(pwSRow + 4, sectionEnd)) : -1;
  let pwRRow = pwCRow !== -1 ? findMetricRow(rows, 'conversion rate', pwCRow + 1, Math.min(pwCRow + 4, sectionEnd)) : -1;

  return {
    gen: genRow !== -1 ? getRowVals(rows, genRow, weekCols).map(num) : [...empty],
    sold: soldRow !== -1 ? getRowVals(rows, soldRow, weekCols).map(num) : [...empty],
    sp: spRow !== -1 ? getRowVals(rows, spRow, weekCols).map(pct) : [...empty],
    tlS: tlSRow !== -1 ? getRowVals(rows, tlSRow, weekCols).map(num) : [...empty],
    tlC: tlCRow !== -1 ? getRowVals(rows, tlCRow, weekCols).map(num) : [...empty],
    tlR: tlRRow !== -1 ? getRowVals(rows, tlRRow, weekCols).map(pct) : [...empty],
    pwS: pwSRow !== -1 ? getRowVals(rows, pwSRow, weekCols).map(num) : [...empty],
    pwC: pwCRow !== -1 ? getRowVals(rows, pwCRow, weekCols).map(num) : [...empty],
    pwR: pwRRow !== -1 ? getRowVals(rows, pwRRow, weekCols).map(pct) : [...empty],
    _debug: { genRow, soldRow, spRow, tlSRow, tlCRow, tlRRow, pwSRow, pwCRow, pwRRow }
  };
}

// Parse state sheet (LGM / MyAccident format)
function parseStateSheet(rows) {
  const states = {};
  const targetStates = ['TX', 'AZ', 'CA', 'GA', 'OH', 'IL'];

  for (let i = 0; i < rows.length; i++) {
    const col0 = (rows[i][0] || '').trim().toUpperCase();
    const col1 = (rows[i][1] || '').trim();

    if (targetStates.includes(col0) && col1) {
      if (!states[col0]) states[col0] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };
      const metric = col1.toLowerCase().trim();
      const vals = rows[i].slice(2);

      if (metric.includes('leads generated')) states[col0].gen = vals.map(num);
      else if (metric.includes('leads routed') && !metric.includes('lgm')) states[col0].rt = vals.map(num);
      else if (metric.includes('leads sent to tl') && !metric.includes('%')) states[col0].ts = vals.map(num);
      else if (metric.includes('% sent to tl') || metric.includes('sent to tl') && metric.includes('%')) states[col0].tp = vals.map(pct);
      else if (metric.includes('contract signed')) states[col0].cs = vals.map(num);
      else if (metric.includes('conversion rate') || metric.includes('conversion')) states[col0].cr = vals.map(pct);
    }
  }

  return states;
}

// Parse SpringZip state sheet
function parseSPZStateSheet(rows) {
  const states = {};
  const targetStates = ['TX', 'AZ', 'CA', 'GA', 'OH', 'IL'];
  let currentState = null;

  for (let i = 0; i < rows.length; i++) {
    const col0 = (rows[i][0] || '').trim();
    const col1 = (rows[i][1] || '').trim();

    // Check for state section header
    for (const st of targetStates) {
      const header = (col0 + ' ' + col1).toUpperCase();
      if (header.includes(st + ' VEHICLE') || header.includes(st + ' WORKERS') ||
          col0.toUpperCase() === st + ' VEHICLE' || col1.toUpperCase() === st + ' VEHICLE' ||
          col0.toUpperCase() === 'CA WORKERS COMP' || col1.toUpperCase() === 'CA WORKERS COMP') {
        if (header.includes('CA WORKERS')) currentState = 'CA';
        else currentState = st;
        if (!states[currentState]) states[currentState] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };
        break;
      }
    }

    // Check col0 for 2-letter state code with metric in col1
    if (col0.length === 2 && targetStates.includes(col0.toUpperCase()) && col1) {
      currentState = col0.toUpperCase();
      if (!states[currentState]) states[currentState] = { gen: [], rt: [], ts: [], tp: [], cs: [], cr: [] };
    }

    if (!currentState) continue;

    const metricCell = (col0.length === 2 && targetStates.includes(col0.toUpperCase())) ? col1 : col0;
    const dataStart = (col0.length === 2 && targetStates.includes(col0.toUpperCase())) ? 2 : 1;
    const metricLower = metricCell.toLowerCase().trim();
    const vals = rows[i].slice(dataStart);

    if (metricLower === 'leads generated') states[currentState].gen = vals.map(num);
    else if (metricLower.includes('leads routed') && !metricLower.includes('lgm')) states[currentState].rt = vals.map(num);
    else if (metricLower === 'leads sent to tl') states[currentState].ts = vals.map(num);
    else if (metricLower === '% sent to tl') states[currentState].tp = vals.map(pct);
    else if (metricLower === 'contract signed') states[currentState].cs = vals.map(num);
    else if (metricLower.includes('conversion rate')) states[currentState].cr = vals.map(pct);
  }

  return states;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // If ?debug=raw, show raw CSV structure
  const debug = req.query.debug;

  try {
    const [trendRes, lgmRes, spzRes, maRes] = await Promise.all([
      fetch(csv('Weekly Performance Trend')),
      fetch(csv('LGM')),
      fetch(csv('SpringZip')),
      fetch(csv('MyAccident')),
    ]);

    const [trendText, lgmText, spzText, maText] = await Promise.all([
      trendRes.text(),
      lgmRes.text(),
      spzRes.text(),
      maRes.text(),
    ]);

    const trendRows = parseCSV(trendText);

    if (debug === 'raw') {
      // Show first 80 rows with structure info
      const sample = trendRows.slice(0, 80).map((r, i) => ({
        row: i,
        numCols: r.length,
        cells: r.slice(0, 30).map((c, j) => c ? `[${j}]${c.substring(0, 40)}` : null).filter(Boolean)
      }));
      return res.status(200).json({
        totalRows: trendRows.length,
        maxCols: Math.max(...trendRows.map(r => r.length)),
        weekRows: findAllWeekRows(trendRows),
        lgmRows: findTextRows(trendRows, 'LGM'),
        springzipRows: findTextRows(trendRows, 'SpringZip'),
        myaccidentRows: findTextRows(trendRows, 'MyAccident'),
        tier1Rows: findTextRows(trendRows, 'Tier 1'),
        tier23Rows: findTextRows(trendRows, 'Tier 2/3'),
        leadsGenRows: findTextRows(trendRows, 'Leads Generated'),
        sentToTLRows: findTextRows(trendRows, 'Sent to TL'),
        pacificRows: findTextRows(trendRows, 'Pacific Workers'),
        sample
      });
    }

    if (debug === 'csv') {
      // Show raw CSV text (first 3000 chars)
      return res.status(200).json({
        trendCSV: trendText.substring(0, 5000),
        lgmCSV: lgmText.substring(0, 3000),
      });
    }

    // Parse main trend
    const { weeks, dateRanges, weekCols, weekRowIdx } = extractWeeks(trendRows);
    const nw = weeks.length;

    if (nw === 0) {
      return res.status(200).json({
        error: 'No weeks found in spreadsheet',
        _debug: {
          totalRows: trendRows.length,
          weekRows: findAllWeekRows(trendRows),
          firstRows: trendRows.slice(0, 10).map(r => r.slice(0, 5)),
        },
        weeks: [], dateRanges: [],
        lgm: { gen:[], sold:[], sp:[], tlS:[], tlC:[], tlR:[], pwS:[], pwC:[], pwR:[] },
        spz: { gen:[], sold:[], sp:[], tlS:[], tlC:[], tlR:[], pwS:[], pwC:[], pwR:[] },
        maTier1: { gen:[], sold:[], sp:[], tlS:[], tlC:[], tlR:[], pwS:[], pwC:[], pwR:[] },
        maTier23: { gen:[], sold:[], sp:[], tlS:[], tlC:[], tlR:[], pwS:[], pwC:[], pwR:[] },
        lgmStates: {}, spzStates: {}, maStates: {},
        lastUpdated: new Date().toISOString(),
      });
    }

    // Find section boundaries after the week header row
    const afterWeek = weekRowIdx + 2;

    // Find section labels
    function findLabel(label, from, to) {
      const lbl = label.toLowerCase();
      for (let i = from; i < Math.min(to || rows.length, trendRows.length); i++) {
        for (let j = 0; j < Math.min(trendRows[i].length, 4); j++) {
          const cell = (trendRows[i][j] || '').trim().toLowerCase();
          if (cell === lbl) return i;
        }
      }
      return -1;
    }

    // Find key section markers after the week header
    const tier1Row = findLabel('tier 1', afterWeek, trendRows.length);
    const tier23Row = findLabel('tier 2/3', tier1Row !== -1 ? tier1Row + 1 : afterWeek, trendRows.length);

    // LGM section: first "Leads Generated" after week header, before Tier 1
    const searchEnd = tier1Row !== -1 ? tier1Row : trendRows.length;

    // Find ALL "Leads Generated" rows between week header and Tier 1
    const genRowsBefore = [];
    for (let i = afterWeek; i < searchEnd; i++) {
      for (let j = 0; j < Math.min(trendRows[i].length, 4); j++) {
        if ((trendRows[i][j] || '').trim().toLowerCase() === 'leads generated') {
          genRowsBefore.push(i);
          break;
        }
      }
    }

    // First "Leads Generated" = LGM, Second = SpringZip
    let lgmSectionStart = genRowsBefore.length > 0 ? genRowsBefore[0] - 1 : afterWeek;
    let spzSectionStart = genRowsBefore.length > 1 ? genRowsBefore[1] - 1 : -1;

    let lgmSectionEnd = spzSectionStart !== -1 ? spzSectionStart : searchEnd;
    let spzSectionEnd = searchEnd;

    const lgm = parseBizSection(trendRows, lgmSectionStart, lgmSectionEnd, weekCols);
    const spz = spzSectionStart !== -1 ? parseBizSection(trendRows, spzSectionStart, spzSectionEnd, weekCols) : null;

    // MA Tier 1
    let tier1SectionEnd = tier23Row !== -1 ? tier23Row : (tier1Row !== -1 ? tier1Row + 30 : trendRows.length);
    const maTier1 = tier1Row !== -1 ? parseBizSection(trendRows, tier1Row, tier1SectionEnd, weekCols) : null;

    // MA Tier 2/3
    let tier23SectionEnd = tier23Row !== -1 ? tier23Row + 30 : trendRows.length;
    const maTier23 = tier23Row !== -1 ? parseBizSection(trendRows, tier23Row, tier23SectionEnd, weekCols) : null;

    // State data
    const lgmStateRows = parseCSV(lgmText);
    const spzStateRows = parseCSV(spzText);
    const maStateRows = parseCSV(maText);

    const lgmStates = parseStateSheet(lgmStateRows);
    const spzStates = parseSPZStateSheet(spzStateRows);
    const maStates = parseStateSheet(maStateRows);

    const emptyMetrics = { gen:[], sold:[], sp:[], tlS:[], tlC:[], tlR:[], pwS:[], pwC:[], pwR:[] };

    const result = {
      weeks,
      dateRanges,
      lgm: lgm || emptyMetrics,
      spz: spz || emptyMetrics,
      maTier1: maTier1 || emptyMetrics,
      maTier23: maTier23 || emptyMetrics,
      lgmStates,
      spzStates,
      maStates,
      lastUpdated: new Date().toISOString(),
      _debug: {
        weekRowIdx,
        weeksFound: nw,
        weekColsUsed: weekCols.slice(0, 5),
        tier1Row,
        tier23Row,
        genRowsBeforeTier1: genRowsBefore,
        lgmSectionRange: [lgmSectionStart, lgmSectionEnd],
        spzSectionRange: spzSectionStart !== -1 ? [spzSectionStart, spzSectionEnd] : null,
        lgmDebug: lgm ? lgm._debug : null,
        spzDebug: spz ? spz._debug : null,
        maTier1Debug: maTier1 ? maTier1._debug : null,
        maTier23Debug: maTier23 ? maTier23._debug : null,
        lgmGenSample: lgm ? lgm.gen.slice(-5) : [],
        spzGenSample: spz ? spz.gen.slice(-5) : [],
      }
    };

    // Clean up _debug from sub-objects
    if (result.lgm && result.lgm._debug) delete result.lgm._debug;
    if (result.spz && result.spz._debug) delete result.spz._debug;
    if (result.maTier1 && result.maTier1._debug) delete result.maTier1._debug;
    if (result.maTier23 && result.maTier23._debug) delete result.maTier23._debug;

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
