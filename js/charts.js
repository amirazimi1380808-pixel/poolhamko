/* ─── Financial trend chart (Chart.js, vendored locally) ───
 * Ported 1:1 from the original single-file implementation. */

import { state, colorThemes } from './storage.js';
import { formatNumber, getTodayISO, parseDate } from './utils.js';
import { toPersianNum } from './jalali-calendar.js';

let mainChartInstance = null;

export function drawCharts(){
    const dateF = document.getElementById('date-filter').value;
    const cardF = document.getElementById('chart-card-filter').value;
    const now = new Date();
    let filterDate = new Date(0);

    if(dateF === 'today') filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if(dateF === 'week') filterDate = new Date(now.getTime() - 7*86400000);
    if(dateF === 'month') filterDate = new Date(now.getTime() - 30*86400000);
    if(dateF === 'year') filterDate = new Date(now.getTime() - 365*86400000);

    const dailyMap = {};

    state.transactions.forEach(t => {
        const d = parseDate(t.date);
        if (d >= filterDate) {
            if (cardF === 'all' || t.account === cardF) {
                const dayStr = d.toISOString().slice(0, 10);
                if (!dailyMap[dayStr]) dailyMap[dayStr] = { inc: 0, exp: 0 };
                if (t.type === 'income') dailyMap[dayStr].inc += Number(t.amount);
                else dailyMap[dayStr].exp += Number(t.amount);
            }
        }
    });

    let labelsRaw = Object.keys(dailyMap).sort();
    if (labelsRaw.length === 0) labelsRaw = [getTodayISO()];

    const labels = labelsRaw.slice(-30);
    const incData = labels.map(d=>(dailyMap[d]?.inc || 0));
    const expData = labels.map(d=>(dailyMap[d]?.exp || 0));

    if(mainChartInstance) mainChartInstance.destroy();
    const ctx = document.getElementById('mainChart').getContext('2d');

    let mainGrad = ctx.createLinearGradient(0, 0, 0, 400);
    mainGrad.addColorStop(0, colorThemes[state.currentTheme].chartGrad);
    mainGrad.addColorStop(1, 'transparent');

    const outcomeColor = state.isDarkMode ? '#ffffff' : '#000000';
    const gridColor = state.isDarkMode ? '#334155' : '#f0f0f0';

    mainChartInstance = new Chart(ctx, {
        type:'line',
        data:{
            labels: labels.map(d=> new Intl.DateTimeFormat('fa-IR', {month:'short', day:'numeric'}).format(parseDate(d))),
            datasets:[
                {
                    label:'درآمد', data:incData, borderColor: colorThemes[state.currentTheme].primary, backgroundColor: mainGrad,
                    fill:true, tension:0.4, borderWidth:2, pointBackgroundColor: state.isDarkMode ? '#1e293b' : '#fff', pointBorderColor: colorThemes[state.currentTheme].primary, pointRadius: 4
                },
                {
                    label:'هزینه', data:expData, borderColor: outcomeColor, backgroundColor:'transparent',
                    fill:false, tension:0.4, borderWidth:2, pointBackgroundColor: state.isDarkMode ? '#1e293b' : '#fff', pointBorderColor: outcomeColor, pointRadius: 4
                }
            ]
        },
        options:{
            responsive:true, maintainAspectRatio:false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return context.dataset.label + ': ' + toPersianNum(formatNumber(context.raw)) + ' تومان'; }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: {size: 10, family: 'Vazirmatn'}, color: '#8b8d97' }, border: {display: false} },
                y: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        font: {size: 10, family: 'Vazirmatn'}, color: '#8b8d97', maxTicksLimit: 5,
                        callback: function(value) { return toPersianNum(value / 1000) + ' هزار'; }
                    },
                    border: {display: false}
                }
            }
        }
    });
}
