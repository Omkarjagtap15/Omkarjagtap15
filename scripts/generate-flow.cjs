const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchSVG(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const username = 'Omkarjagtap15';
  console.log(`Fetching live GitHub contributions for ${username}...`);
  
  let rawSvg;
  try {
    rawSvg = await fetchSVG(`https://ghchart.rshah.org/${username}`);
    console.log(`Fetched ${rawSvg.length} bytes from ghchart.rshah.org`);
  } catch (err) {
    console.warn(`Could not fetch live, using local fallback: ${err.message}`);
    const localFallback = path.join(__dirname, '../../../.gemini/antigravity-ide/brain/dc709c24-e078-45e5-807a-ee3191b44e4f/raw_ghchart.svg');
    if (fs.existsSync(localFallback)) {
      rawSvg = fs.readFileSync(localFallback, 'utf8');
    } else {
      throw new Error('No contribution data source available.');
    }
  }

  // Parse all <rect> elements
  const rectRegex = /<rect[^>]+data-score="(\d+)"[^>]+data-date="([^"]+)"[^>]+x="(\d+)"[^>]+y="(\d+)"[^>]*\/>/g;
  const rects = [];
  let match;
  while ((match = rectRegex.exec(rawSvg)) !== null) {
    rects.push({
      score: parseInt(match[1], 10),
      date: match[2],
      rawX: parseInt(match[3], 10),
      rawY: parseInt(match[4], 10)
    });
  }

  // Parse month labels
  const textRegex = /<text[^>]+x="(\d+)"[^>]+y="(\d+)"[^>]*>([A-Za-z]+)<\/text>/g;
  const labels = [];
  while ((match = textRegex.exec(rawSvg)) !== null) {
    labels.push({
      x: parseInt(match[1], 10),
      y: parseInt(match[2], 10),
      text: match[3]
    });
  }

  const activeDays = rects.filter(r => r.score > 0).length;
  console.log(`Parsed ${rects.length} cells (${activeDays} active days).`);

  const minRawX = Math.min(...rects.map(r => r.rawX));
  const minRawY = Math.min(...rects.map(r => r.rawY));

  // Canvas: 880 x 155
  const gridStartX = 104;
  const gridStartY = 38;
  const cellSize = 10;
  const cellGap = 2.5; // step = 12.5

  // Level colors: GitHub dark theme palette
  const levelColors = {
    0: { fill: '#141d2e', stroke: '#1c283d' },
    1: { fill: '#0e4429', stroke: '#145c37' },
    2: { fill: '#006d32', stroke: '#008c40' },
    3: { fill: '#26a641', stroke: '#2fc24d' },
    4: { fill: '#39d353', stroke: '#4ff26a' }
  };

  // Generate Rect elements
  const cellsSvg = rects.map(r => {
    const colIndex = Math.round((r.rawX - minRawX) / 12);
    const rowIndex = Math.round((r.rawY - minRawY) / 12);
    const x = gridStartX + (colIndex * (cellSize + cellGap));
    const y = gridStartY + (rowIndex * (cellSize + cellGap));
    const color = levelColors[r.score] || levelColors[0];
    const strokeAttr = r.score === 0 ? `stroke="${color.stroke}" stroke-width="0.7"` : `stroke="${color.stroke}" stroke-width="0.5"`;
    const filterAttr = r.score >= 3 ? 'filter="url(#cellGlow)"' : '';
    return `    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color.fill}" ${strokeAttr} ${filterAttr}><title>${r.date}: Level ${r.score}</title></rect>`;
  }).join('\n');

  // Month labels
  const monthLabels = labels.filter(l => l.y < 20);
  const monthsSvg = monthLabels.map(m => {
    const colIndex = Math.round((m.x - minRawX) / 12);
    const x = gridStartX + (colIndex * (cellSize + cellGap));
    return `    <text x="${x.toFixed(1)}" y="${gridStartY - 10}" class="cal-label">${m.text}</text>`;
  }).join('\n');

  // Weekday labels (Mon, Wed, Fri)
  const weekdays = [
    { name: 'Mon', row: 1 },
    { name: 'Wed', row: 3 },
    { name: 'Fri', row: 5 }
  ];
  const weekdaysSvg = weekdays.map(w => {
    const y = gridStartY + (w.row * (cellSize + cellGap)) + 8;
    return `    <text x="${gridStartX - 12}" y="${y.toFixed(1)}" text-anchor="end" class="cal-label">${w.name}</text>`;
  }).join('\n');

  // Output SVG
  const outputSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 155" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060a14" />
      <stop offset="50%" stop-color="#091024" />
      <stop offset="100%" stop-color="#070c1a" />
    </linearGradient>

    <!-- Wave Stroke Gradients -->
    <linearGradient id="wave1Grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.05" />
      <stop offset="25%" stop-color="#38bdf8" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#60a5fa" stop-opacity="0.45" />
      <stop offset="90%" stop-color="#38bdf8" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.05" />
    </linearGradient>

    <linearGradient id="wave2Grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#818cf8" stop-opacity="0.03" />
      <stop offset="35%" stop-color="#60a5fa" stop-opacity="0.22" />
      <stop offset="75%" stop-color="#38bdf8" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0.04" />
    </linearGradient>

    <!-- Subtle Wave Area Underfill -->
    <linearGradient id="waveAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
    </linearGradient>

    <!-- Cell Glow for Active Hotspots -->
    <filter id="cellGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.6" flood-color="#39d353" flood-opacity="0.4" />
    </filter>
  </defs>

  <style>
    .cal-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 9.5px; font-weight: 600; fill: #64748b; }
    .legend-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 9.5px; font-weight: 500; fill: #64748b; }
    .meta-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; font-weight: 500; fill: #94a3b8; }
  </style>

  <!-- Container Box -->
  <rect width="880" height="155" rx="12" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="1.2" />

  <!-- Flowing Wave Layer 1 (Area fill underneath calendar) -->
  <path d="M 40,105 
           C 170,82 280,118 420,92 
           C 560,68 680,108 840,88 
           L 840,140 L 40,140 Z" 
        fill="url(#waveAreaGrad)" />

  <!-- Flowing Wave Layer 2 (Primary rhythmic curve) -->
  <path d="M 40,105 
           C 170,82 280,118 420,92 
           C 560,68 680,108 840,88" 
        fill="none" stroke="url(#wave1Grad)" stroke-width="1.6" stroke-linecap="round" />

  <!-- Flowing Wave Layer 3 (Secondary harmonic curve) -->
  <path d="M 40,118 
           C 190,126 310,94 450,112 
           C 590,128 710,96 840,105" 
        fill="none" stroke="url(#wave2Grad)" stroke-width="1.2" stroke-linecap="round" />

  <!-- Month Labels -->
  <g>
${monthsSvg}
  </g>

  <!-- Weekday Labels -->
  <g>
${weekdaysSvg}
  </g>

  <!-- Real Contribution Grid -->
  <g>
${cellsSvg}
  </g>

  <!-- Footer Metadata & Legend -->
  <g transform="translate(32, 137)">
    <circle cx="4" cy="-3.5" r="3" fill="#39d353" opacity="0.85" />
    <text x="14" y="0" class="meta-text">
      <tspan fill="#38bdf8" font-weight="600">${activeDays} active days</tspan> in the last year &#160;•&#160; Building consistently, one commit at a time
    </text>
  </g>

  <g transform="translate(714, 129)">
    <text x="-6" y="8" text-anchor="end" class="legend-text">Less</text>
    <rect x="0" y="0" width="9" height="9" rx="1.5" fill="#141d2e" stroke="#1c283d" stroke-width="0.6" />
    <rect x="13" y="0" width="9" height="9" rx="1.5" fill="#0e4429" stroke="#145c37" stroke-width="0.5" />
    <rect x="26" y="0" width="9" height="9" rx="1.5" fill="#006d32" stroke="#008c40" stroke-width="0.5" />
    <rect x="39" y="0" width="9" height="9" rx="1.5" fill="#26a641" stroke="#2fc24d" stroke-width="0.5" />
    <rect x="52" y="0" width="9" height="9" rx="1.5" fill="#39d353" stroke="#4ff26a" stroke-width="0.5" />
    <text x="69" y="8" class="legend-text">More</text>
  </g>
</svg>`;

  const outputPath = path.join(__dirname, '../assets/contribution-flow.svg');
  fs.writeFileSync(outputPath, outputSvg, 'utf8');
  console.log(`Successfully generated streamlined: ${outputPath}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
