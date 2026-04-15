// src/pages/api/analyze.js

var BUDGET = {
  lgm: {
    leadsGenerated:   [6410, 6089, 6961, 7958, 7781, 7961, 9189, 9172, 8825, 10503, 9299, 9893],
    leadsRoutedToTL:  [102, 182, 256, 289, 345, 352, 448, 448, 433, 507, 457, 483],
    tlConversionPct:  [3.9, 10.4, 10.5, 10.4, 10.4, 10.5, 10.5, 10.5, 10.4, 10.5, 10.5, 10.6],
    contractsSigned:  [4, 19, 27, 30, 36, 37, 47, 47, 45, 53, 48, 51]
  },
  spz: {
    leadsGenerated:   [15128, 12768, 14136, 13680, 14136, 13680, 14136, 14136, 13680, 14136, 13680, 14136],
    leadsSold:        [9167, 8150, 9050, 8765, 9055, 8766, 9063, 9063, 8773, 9075, 8784, 9074],
    leadsRoutedToTL:  [378, 539, 656, 692, 790, 839, 916, 961, 975, 1055, 1066, 1149],
    tlConversionPct:  [9, 11, 11, 11, 12, 11, 12, 12, 12, 12, 12, 11],
    contractsSigned:  [32, 58, 74, 77, 92, 96, 108, 112, 117, 124, 124, 132]
  },
  ma: {
    tier1: {
      leadsGenerated:   [2110, 2171, 2214, 2270, 2396, 2402, 2490, 2509, 2623, 2643, 2731, 2743],
      leadsSold:        [1847, 1846, 1859, 1885, 1898, 1864, 1851, 1856, 1919, 1817, 1856, 1857],
      leadsRoutedToTL:  [145, 207, 236, 265, 377, 379, 481, 495, 540, 670, 716, 727],
      tlConversionPct:  [5.5, 6.5, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6],
      contractsSigned:  [8, 13.5, 18, 20, 29, 29, 37, 38, 41, 51, 54, 55]
    },
    tier23: {
      leadsGenerated:   [27806, 27891, 28243, 28768, 29793, 29873, 30608, 30840, 31712, 31952, 32687, 32840],
      leadsSold:        [19214, 18853, 19099, 18965, 19612, 19575, 19772, 19852, 20327, 20177, 20541, 20571]
    },
    total: {
      leadsGenerated:   [29916, 30062, 30457, 31038, 32189, 32275, 33098, 33349, 34335, 34595, 35418, 35583],
      leadsSold:        [21061, 20700, 20958, 20850, 21510, 21439, 21623, 21707, 22245, 21994, 22397, 22428]
    },
    tlByState: {
      TX: [81, 92, 92, 111, 111, 111, 129, 129, 129, 166, 166, 166],
      GA: [58, 58, 58, 70, 70, 70, 81, 81, 81, 105, 105, 105],
      CA: [0, 28, 38, 57, 91, 91, 132, 132, 172, 221, 255, 255],
      AZ: [6, 6, 6, 8, 8, 9, 10, 11, 11, 15, 15, 15],
      IL: [0, 23, 23, 0, 27, 27, 27, 32, 32, 32, 37, 37],
      OH: [0, 0, 19, 19, 23, 23, 23, 26, 26, 26, 30, 30]
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not set. Add it in Vercel Settings > Environment Variables." });
    }

    var body = req.body;
    var weekLabel = body.weekLabel;
    var mi = body.monthIndex;
    var actuals = body.actuals;
    var stateData = body.stateData;

    var wb = {
      lgm: {
        leadsGenerated:  Math.round(BUDGET.lgm.leadsGenerated[mi] / 4.33),
        leadsRoutedToTL: Math.round(BUDGET.lgm.leadsRoutedToTL[mi] / 4.33),
        tlConversionPct: BUDGET.lgm.tlConversionPct[mi],
        contractsSigned: Math.round(BUDGET.lgm.contractsSigned[mi] / 4.33 * 10) / 10
      },
      spz: {
        leadsGenerated:  Math.round(BUDGET.spz.leadsGenerated[mi] / 4.33),
        leadsSold:       Math.round(BUDGET.spz.leadsSold[mi] / 4.33),
        leadsRoutedToTL: Math.round(BUDGET.spz.leadsRoutedToTL[mi] / 4.33),
        tlConversionPct: BUDGET.spz.tlConversionPct[mi],
        contractsSigned: Math.round(BUDGET.spz.contractsSigned[mi] / 4.33 * 10) / 10
      },
      ma: {
        tier1: {
          leadsGenerated:  Math.round(BUDGET.ma.tier1.leadsGenerated[mi] / 4.33),
          leadsSold:       Math.round(BUDGET.ma.tier1.leadsSold[mi] / 4.33),
          leadsRoutedToTL: Math.round(BUDGET.ma.tier1.leadsRoutedToTL[mi] / 4.33),
          tlConversionPct: BUDGET.ma.tier1.tlConversionPct[mi],
          contractsSigned: Math.round(BUDGET.ma.tier1.contractsSigned[mi] / 4.33 * 10) / 10
        },
        tier23: {
          leadsGenerated:  Math.round(BUDGET.ma.tier23.leadsGenerated[mi] / 4.33),
          leadsSold:       Math.round(BUDGET.ma.tier23.leadsSold[mi] / 4.33)
        }
      }
    };

    var prompt = "You are a finance analyst assistant. Analyze weekly lead generation performance and produce a JSON response.\n\n" +
      "CONTEXT:\n" +
      "- Week: " + weekLabel + "\n" +
      "- Month index: " + mi + " (0=Jan)\n" +
      "- Three business units: LGM, SpringZip (SPZ), MyAccident (MA)\n" +
      "- AAA = Thompson Law (TL) + Pacific Workers (PW). Budget only covers TL. MA only has TL (no PW).\n" +
      "- For volume metrics, weekly budget = monthly budget / 4.33\n" +
      "- For rate metrics (sell-through %, conversion %), use the monthly budget % directly\n" +
      "- Percentages in actuals are already formatted (e.g. 70.33 means 70.33%, do NOT multiply by 100)\n\n" +
      "ACTUAL DATA THIS WEEK:\n" + JSON.stringify(actuals, null, 2) + "\n\n" +
      "WEEKLY BUDGET ESTIMATES:\n" + JSON.stringify(wb, null, 2) + "\n\n" +
      "STATE-LEVEL DATA (if available):\n" + JSON.stringify(stateData, null, 2) + "\n\n" +
      "STATE-LEVEL TL MONTHLY BUDGET (month " + mi + "):\n" +
      "MA: TX=" + BUDGET.ma.tlByState.TX[mi] + ", GA=" + BUDGET.ma.tlByState.GA[mi] +
      ", CA=" + BUDGET.ma.tlByState.CA[mi] + ", AZ=" + BUDGET.ma.tlByState.AZ[mi] +
      ", IL=" + BUDGET.ma.tlByState.IL[mi] + ", OH=" + BUDGET.ma.tlByState.OH[mi] + "\n\n" +
      "INSTRUCTIONS:\n" +
      "1. Compare actuals vs weekly budget estimates. Note significant over/under performance.\n" +
      "2. Check for anomalies: state-level routing ratio drops (especially TX and GA), multi-week declines, >15-20% deviations from 5-week average, conversion rate misses.\n" +
      "3. Draft an email using this EXACT template:\n\n" +
      "Dear Team,\n\n" +
      "Please find attached the Weekly Report for LGM/SpringZip/MyAccident.\n\n" +
      "Key highlights:\n\n" +
      "• [Overall leads generated/sold performance vs budget - specific numbers]\n" +
      "• PW: [Pacific Workers status - LGM and SPZ only]\n" +
      "• TL conversion rate and cases signed trended [above/below] expectations:\n" +
      "    • LGM: [X] cases signed ([Y]% conversion vs. [Z]% budget), [context]\n" +
      "    • MA: [X] cases signed ([Y]% conversion vs. [Z]% budget), [context]\n" +
      "    • SPZ: [X] cases signed ([Y]% conversion vs. [Z]% budget), [context]\n\n" +
      "Please let me know if you have any questions.\n\n" +
      "Best,\n\n" +
      "Return ONLY valid JSON (no markdown, no backticks) with this structure:\n" +
      '{"highlights":["bullet 1","bullet 2","bullet 3"],"anomalies":[{"severity":"high|medium|low","message":"description with numbers"}],"emailDraft":"the full email text"}';

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error("Claude API error:", errText);
      return res.status(500).json({ error: "Claude API request failed: " + errText.substring(0, 500) });
    }

    var apiData = await response.json();
    var rawText = apiData.content.map(function(c) { return c.text || ""; }).join("");
    var cleaned = rawText.replace(/```json|```/g, "").trim();

    var result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Parse failed:", cleaned);
      return res.status(500).json({ error: "Failed to parse AI response", raw: cleaned });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({ error: err.message });
  }
}
