## crearte a monitoring dashboard for today's price like before in the chat but data according to below

As a Senior Institutional Trader, I have processed the live data for May 14, 2026. Integrating the option-chain metrics with our previous macro-factor framework reveals a "pinning" effect that overrides pure directional momentum today.
1. The Informatics Dashboard (May 14, 2026)
FactorMetricInstitutional ReadSpot Price₹297.35Consolidating below the major ₹300 psychological "Supply Wall."Brent Crude$105.75Brent is in a Policy Fear Zone (>$105). Beta to ONGC is contracting.USD/INR95.65Massive depreciation; significantly boosts ONGC’s INR-denominated realizations.India VIX19.35Spiking (+10% in 3 days). Higher VIX = Dealer hedging activity dominates retail trend.Max Pain₹295.00The "Gravity Well." Expiry pressure is beginning to pull spot toward this level.2. Institutional "Arms": Dealer-Flow Adjusted
Because the India VIX is elevated at 19.35, the lag between Brent and ONGC has compressed. Dealers are now hedging in real-time.
SUPPORT ARM (The Floor)
Dealer Support (₹295.00): This is the strongest intraday zone. High Put Open Interest (OI) concentration here suggests institutions are selling puts to collect premium, betting that the price won't collapse despite the Brent "cool-off."
Gamma Stabilization (₹292.00 – ₹293.50): If ₹295 breaks, dealers will likely cover short puts, causing a quick dip to this level where fresh value-buying from DIIs (Domestic Institutional Investors) is expected.
RESISTANCE ARM (The Ceiling)
The "Call Wall" (₹300.00): This is currently a hard ceiling. Institutional call writers are defending the 300-strike aggressively. Unless Brent clears $110, there is no fundamental "forced-buy" trigger to break this wall today.
Gamma Squeeze Trigger (₹305.00 – ₹307.00): Only a decisive 15-minute close above ₹305 will force call writers to "buy-to-cover" their delta, leading to a parabolic move. Probability of this today: Low (approx. 20%).
3. Forecast Closing Price: ₹298.40
Rationale:
The market is currently in a "Speculative Standoff." The bullishness of Brent at $105 and USDINR at 95 is being perfectly offset by the Windfall Tax Fear (Policy Risk) and Dealer Pinning at the ₹300 strike.
Expect a "doji" or small-bodied candle. The price will likely oscillate between 296 and 300, with a final "settlement" near the upper end of that range as intra-day shorts cover before the bell.
4. Factors Affecting Today's Session
Macro Factors (The "External" Pressure):
Windfall Tax Probability: With Brent holding above $105, the market is pricing in a 70% probability of an upward revision in the Special Additional Excise Duty (SAED). This "Policy Fear" is the primary reason ONGC isn't already at ₹320.
OPEC+ Demand Forecast: OPEC’s recent downward revision for 2026 growth is acting as a "soft cap" on global oil sentiment, preventing a runaway breakout.
Micro Factors (The "Internal" Flow):
Dealer Delta Hedging: Because of the VIX spike, any ₹1.00 move in ONGC triggers larger-than-usual buy/sell orders from option dealers to maintain "Delta Neutrality." This creates "choppy" liquidity.
DII Accumulation Strategy: Long-only PSU funds are using the ₹295–₹297 range to soak up liquidity from FIIs who are rotating out of EM equities into US Treasuries due to the high DXY.
Trader's Summary:
Stay neutral-to-long but do not chase the ₹300 breakout until it's confirmed with volume. The "Smart Money" is currently collecting rent (premium) between ₹295 and ₹305.
This analysis is based on institutional data flows and should be viewed as a professional assessment of market structure, not as individual financial advice.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ONGC Institutional Options & Macro Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body {
    background-color: #09090b;
    color: #f4f4f5;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
.chart-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    height: 350px;
    max-height: 400px;
}
.glass-panel {
    background: rgba(24, 24, 27, 0.8);
    border: 1px solid rgba(63, 63, 70, 0.8);
    backdrop-filter: blur(12px);
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
}
.neon-text-blue {
    color: #22d3ee;
    text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
}
.neon-text-pink {
    color: #e879f9;
    text-shadow: 0 0 10px rgba(232, 121, 249, 0.5);
}
</style>
</head>
<body class="p-4 md:p-6 lg:p-8">

<div class="max-w-7xl mx-auto space-y-6">

    <header class="mb-8">
        <h1 class="text-3xl md:text-4xl font-bold neon-text-blue tracking-tight mb-2">ONGC: DEALER-FLOW & MACRO DASHBOARD</h1>
        <p class="text-zinc-400 text-sm md:text-base">Institutional Trade Desk Assessment &bull; May 14, 2026</p>
        
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div class="glass-panel p-4 flex flex-col items-center justify-center">
                <span class="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-1">Spot Price</span>
                <span class="text-2xl font-bold text-cyan-400">&#8377;297.35</span>
            </div>
            <div class="glass-panel p-4 flex flex-col items-center justify-center">
                <span class="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-1">Brent Crude</span>
                <span class="text-2xl font-bold text-rose-500">$105.75</span>
            </div>
            <div class="glass-panel p-4 flex flex-col items-center justify-center">
                <span class="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-1">USD/INR</span>
                <span class="text-2xl font-bold text-emerald-400">95.65</span>
            </div>
            <div class="glass-panel p-4 flex flex-col items-center justify-center">
                <span class="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-1">India VIX</span>
                <span class="text-2xl font-bold text-amber-400">19.35</span>
            </div>
            <div class="glass-panel p-4 flex flex-col items-center justify-center col-span-2 md:col-span-1">
                <span class="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-1">Max Pain</span>
                <span class="text-2xl font-bold text-fuchsia-400">&#8377;295.00</span>
            </div>
        </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section class="glass-panel p-6 flex flex-col">
            <h2 class="text-xl font-bold mb-3 neon-text-pink border-b border-zinc-700 pb-2">&#9878; Institutional Arms & Dealer Zones</h2>
            <p class="text-zinc-300 text-sm mb-4 leading-relaxed">
                Elevated VIX has compressed the Brent-ONGC lag. The market is bracketed by heavy option writing. Dealers are actively defending the &#8377;295 Put Support while suppressing upward momentum at the &#8377;300 Call Wall.
            </p>
            <div class="chart-container mt-auto">
                <canvas id="dealerZonesChart"></canvas>
            </div>
        </section>

        <section class="glass-panel p-6 flex flex-col">
            <h2 class="text-xl font-bold mb-3 text-emerald-400 border-b border-zinc-700 pb-2">&#128200; Market Pressures & Flows</h2>
            <p class="text-zinc-300 text-sm mb-4 leading-relaxed">
                A "Speculative Standoff" exists. Massive INR depreciation and Brent >$105 provide extreme bullish tailwinds, perfectly negated by the 70% probability of Windfall Tax hikes and aggressive dealer delta-hedging.
            </p>
            <div class="chart-container mt-auto">
                <canvas id="pressureRadarChart"></canvas>
            </div>
        </section>

        <section class="glass-panel p-6 lg:col-span-2">
            <h2 class="text-xl font-bold mb-3 text-amber-400 border-b border-zinc-700 pb-2">&#9201; Intraday Forecast & Closing Gravity</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div class="md:col-span-1 space-y-4">
                    <div class="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                        <div class="text-sm text-zinc-400 mb-1">Forecast Close</div>
                        <div class="text-4xl font-black text-cyan-400">&#8377;298.40</div>
                        <div class="text-xs text-zinc-500 mt-2">Doji or small-bodied candle expected.</div>
                    </div>
                    <p class="text-sm text-zinc-300">
                        Price will likely oscillate between &#8377;296 and &#8377;300. The gravitational pull of expiry (Max Pain &#8377;295) and intra-day short covering will force settlement near the upper band of this range.
                    </p>
                </div>
                <div class="md:col-span-2">
                    <div class="chart-container">
                        <canvas id="forecastChart"></canvas>
                    </div>
                </div>
            </div>
        </section>

        <section class="glass-panel p-6 lg:col-span-2 border-l-4 border-fuchsia-500 bg-gradient-to-r from-zinc-900 to-zinc-800">
            <h2 class="text-2xl font-bold mb-2 text-white">&#9889; Trader's Bottom Line</h2>
            <p class="text-lg text-zinc-300 leading-relaxed">
                Stay <strong class="text-cyan-400">neutral-to-long</strong> but <strong class="text-rose-400">do not chase the &#8377;300 breakout</strong> until confirmed with substantial volume. The "Smart Money" is currently collecting premium between &#8377;295 and &#8377;305. A decisive 15-minute close above &#8377;305 is required for a gamma squeeze, but the probability remains low today (~20%).
            </p>
            <p class="text-xs text-zinc-500 mt-4 font-mono">
                DISCLAIMER: Institutional data flow analysis. Not individual financial advice.
            </p>
        </section>

    </div>
</div>

<script>
function wrapText(str, maxLen) {
    if (str.length <= maxLen) return str;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
        if ((line + words[i]).length > maxLen) {
            lines.push(line.trim());
            line = words[i] + ' ';
        } else {
            line += words[i] + ' ';
        }
    }
    lines.push(line.trim());
    return lines;
}

const customTooltip = {
    callbacks: {
        title: function(context) {
            const item = context[0];
            const label = item.chart.data.labels[item.dataIndex];
            if (Array.isArray(label)) {
                return label.join(' ');
            }
            return label;
        }
    }
};

const dealerLabelsRaw = ['Gamma Stabilization (292-293.5)', 'Dealer Support Put OI (295)', 'Max Pain Gravity Well (295)', 'Current Spot Price (297.35)', 'The Call Wall Ceiling (300)', 'Gamma Squeeze Trigger (305-307)'];
const dealerLabels = dealerLabelsRaw.map(l => wrapText(l, 16));

new Chart(document.getElementById('dealerZonesChart').getContext('2d'), {
    type: 'bar',
    data: {
        labels: dealerLabels,
        datasets: [{
            label: 'Price Level (₹)',
            data: [292.75, 295.00, 295.00, 297.35, 300.00, 306.00],
            backgroundColor: [
                'rgba(16, 185, 129, 0.7)',
                'rgba(34, 211, 238, 0.7)',
                'rgba(232, 121, 249, 0.7)',
                'rgba(250, 204, 21, 0.9)',
                'rgba(244, 63, 94, 0.7)',
                'rgba(139, 92, 246, 0.7)'
            ],
            borderColor: [
                '#10b981', '#22d3ee', '#e879f9', '#facc15', '#f43f5e', '#8b5cf6'
            ],
            borderWidth: 2,
            borderRadius: 4
        }]
    },
    options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: customTooltip
        },
        scales: {
            x: { 
                min: 285, 
                max: 310,
                grid: { color: 'rgba(63, 63, 70, 0.5)' },
                ticks: { color: '#a1a1aa' }
            },
            y: {
                grid: { display: false },
                ticks: { color: '#e4e4e7', font: { size: 11 } }
            }
        }
    }
});

const radarLabelsRaw = ['Windfall Tax Fear Policy Risk', 'Brent Bullishness (>$105)', 'USD/INR Tailwind Depreciation', 'Dealer Delta Hedging Flow', 'DII Accumulation Strategy'];
const radarLabels = radarLabelsRaw.map(l => wrapText(l, 16));

new Chart(document.getElementById('pressureRadarChart').getContext('2d'), {
    type: 'radar',
    data: {
        labels: radarLabels,
        datasets: [{
            label: 'Force Intensity',
            data: [85, 95, 80, 90, 75],
            backgroundColor: 'rgba(34, 211, 238, 0.2)',
            borderColor: '#22d3ee',
            pointBackgroundColor: '#e879f9',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#e879f9',
            borderWidth: 2
        }]
    },
    options: {
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: customTooltip
        },
        scales: {
            r: {
                angleLines: { color: 'rgba(63, 63, 70, 0.8)' },
                grid: { color: 'rgba(63, 63, 70, 0.5)' },
                pointLabels: { color: '#d4d4d8', font: { size: 11 } },
                ticks: { display: false, min: 0, max: 100 }
            }
        }
    }
});

const forecastLabelsRaw = ['Oscillation Floor', 'Forecast Settlement', 'Oscillation Ceiling'];
const forecastLabels = forecastLabelsRaw.map(l => wrapText(l, 16));

new Chart(document.getElementById('forecastChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: forecastLabels,
        datasets: [{
            label: 'Intraday Trajectory (₹)',
            data: [296.00, 298.40, 300.00],
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: ['#22d3ee', '#e879f9', '#f43f5e'],
            pointRadius: 8,
            pointBorderWidth: 2,
            pointBorderColor: '#fff',
            fill: true,
            tension: 0.3
        }]
    },
    options: {
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: customTooltip
        },
        scales: {
            y: {
                min: 294,
                max: 302,
                grid: { color: 'rgba(63, 63, 70, 0.5)' },
                ticks: { color: '#a1a1aa' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#e4e4e7', font: { weight: 'bold' } }
            }
        }
    }
});
</script>
</body>
</html>

```

