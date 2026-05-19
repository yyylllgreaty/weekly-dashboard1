// src/pages/api/analyze.js
// AI analysis endpoint - compares trends and flags anomalies

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables.' });
  }

  try {
    var body = req.body;
    var weekLabel = body.weekLabel || '';
    var actuals = body.actuals || {};
    var stateData = body.stateData || {};

    // Build the prompt with current week data and ask for trend analysis
    var prompt = `You are a finance analyst assistant for a legal lead generation company with 3 business units: LGM, SpringZip, and MyAccident.

Analyze the following weekly performance data for ${weekLabel} and provide insights.

## Current Week Actuals (${weekLabel})

### LGM (Legal Growth Marketing)
- Leads Generated: ${actuals.lgm?.leadsGenerated ?? 'N/A'}
- Leads Sold: ${actuals.lgm?.leadsSold ?? 'N/A'}
- Sell-Through %: ${actuals.lgm?.sellThroughPct ?? 'N/A'}%
- Leads Sent to TL: ${actuals.lgm?.leadsSentToTL ?? 'N/A'}
- TL Contracts Signed: ${actuals.lgm?.contractSignedTL ?? 'N/A'}
- TL Conversion Rate: ${actuals.lgm?.conversionRateTL ?? 'N/A'}%
- Leads Sent to PW: ${actuals.lgm?.leadsSentToPW ?? 'N/A'}
- PW Contracts Signed: ${actuals.lgm?.contractSignedPW ?? 'N/A'}

### SpringZip
- Leads Generated: ${actuals.spz?.leadsGenerated ?? 'N/A'}
- Leads Sold: ${actuals.spz?.leadsSold ?? 'N/A'}
- Sell-Through %: ${actuals.spz?.sellThroughPct ?? 'N/A'}%
- Leads Sent to TL: ${actuals.spz?.leadsSentToTL ?? 'N/A'}
- TL Contracts Signed: ${actuals.spz?.contractSignedTL ?? 'N/A'}
- TL Conversion Rate: ${actuals.spz?.conversionRateTL ?? 'N/A'}%
- Leads Sent to PW: ${actuals.spz?.leadsSentToPW ?? 'N/A'}
- PW Contracts Signed: ${actuals.spz?.contractSignedPW ?? 'N/A'}

### MyAccident Tier 1
- Leads Generated: ${actuals.maTier1?.leadsGenerated ?? 'N/A'}
- Leads Sold: ${actuals.maTier1?.leadsSold ?? 'N/A'}
- Sell-Through %: ${actuals.maTier1?.sellThroughPct ?? 'N/A'}%
- Leads Sent to TL: ${actuals.maTier1?.leadsSentToTL ?? 'N/A'}
- TL Contracts Signed: ${actuals.maTier1?.contractSignedTL ?? 'N/A'}
- TL Conversion Rate: ${actuals.maTier1?.conversionRateTL ?? 'N/A'}%

### MyAccident Tier 2/3
- Leads Generated: ${actuals.maTier23?.leadsGenerated ?? 'N/A'}
- Leads Sold: ${actuals.maTier23?.leadsSold ?? 'N/A'}
- Sell-Through %: ${actuals.maTier23?.sellThroughPct ?? 'N/A'}%

## State-Level Data (${weekLabel})
${JSON.stringify(stateData, null, 1)}

## Instructions
Analyze the data and respond with ONLY a JSON object (no markdown, no backticks, no explanation) in this exact format:
{
  "highlights": [
    "string - 3-5 key performance highlights for the week, focusing on notable numbers, trends, and comparisons between business units"
  ],
  "anomalies": [
    {
      "severity": "high|medium|low",
      "message": "string - specific anomaly or concern, referencing actual numbers"
    }
  ],
  "emailDraft": "string - professional email draft to leadership summarizing the week"
}

For highlights: Focus on overall lead volume, sell-through rates, TL conversion rates and contracts signed across all 3 BUs. Note any standout performance (good or bad).

For anomalies: Flag conversion rate drops, low contract counts, unusual state-level patterns (especially TX and GA routing), and any metrics that look concerning. Use "high" for significant drops or misses, "medium" for moderate concerns, "low" for minor notes.

For emailDraft: Write a concise professional email using this template:
"Dear Team,

Please find attached the Weekly Report for LGM/SpringZip/MyAccident.

Key highlights:

• [Overall leads generated/sold performance across BUs]
• PW: [Pacific Workers status - LGM and SPZ]
• TL conversion rate and cases signed:
    • LGM: [X] cases signed ([Y]% conversion), [context]
    • MA: [X] cases signed ([Y]% conversion), [context]
    • SPZ: [X] cases signed ([Y]% conversion), [context]

Please let me know if you have any questions.

Best,"

Remember: respond with ONLY the JSON object, nothing else.`;

    var apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!apiRes.ok) {
      var errText = await apiRes.text();
      return res.status(apiRes.status).json({
        error: 'Claude API request failed: ' + errText
      });
    }

    var apiData = await apiRes.json();

    // Extract text from response
    var text = '';
    if (apiData.content && apiData.content.length > 0) {
      for (var i = 0; i < apiData.content.length; i++) {
        if (apiData.content[i].type === 'text') {
          text += apiData.content[i].text;
        }
      }
    }

    if (!text) {
      return res.status(500).json({ error: 'Empty response from Claude API' });
    }

    // Clean up the response - remove any markdown fences or extra text
    var cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    // Parse JSON
    var result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      // Try to find JSON object in the response
      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return res.status(500).json({
            error: 'Failed to parse AI response',
            raw: cleaned.substring(0, 500)
          });
        }
      } else {
        return res.status(500).json({
          error: 'Failed to parse AI response',
          raw: cleaned.substring(0, 500)
        });
      }
    }

    // Validate structure
    if (!result.highlights) result.highlights = [];
    if (!result.anomalies) result.anomalies = [];
    if (!result.emailDraft) result.emailDraft = '';

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
