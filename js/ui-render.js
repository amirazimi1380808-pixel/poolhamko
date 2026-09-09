/* ─── Core render engine ───
 * Ported 1:1 from the original single-file implementation. */

import { state, categories, setRenderHook } from './storage.js';
import { formatNumber, parseDate, escapeHTML } from './utils.js';
import { toPersianNum } from './jalali-calendar.js';
import { syncCardSelectors, updateCardView } from './cards.js';
import { renderBudgetProgress } from './budgets.js';
import { renderBirthdays } from './birthdays.js';
import { renderCheques } from './cheques.js';
import { renderDebts } from './debts.js';
import { renderTransactions } from './transactions.js';
import { drawCharts } from './charts.js';
import { updateBellAlarm } from './notifications.js';

export function renderUI(){
    document.getElementById('display-user-name').textContent = state.userName;
    syncCardSelectors();

    let inc = 0, exp = 0;
    let cardBalances = {};
    state.userCards.forEach(c => cardBalances[c.id] = c.initial || 0);

    const catExp = {};
    categories.expense.forEach(c=>catExp[c.name]=0);

    state.transactions.forEach(t=>{
        const v = Number(t.amount)||0;
        const a = t.account || state.userCards[0]?.id;
        if(t.type === 'income'){
            inc += v;
            if(cardBalances[a] !== undefined) cardBalances[a] += v;
        } else {
            exp += v;
            if(cardBalances[a] !== undefined) cardBalances[a] -= v;
            if(catExp[t.category] !== undefined) catExp[t.category] += v;
        }
    });

    const netBal = Object.values(cardBalances).reduce((a,b)=>a+b, 0);
    document.getElementById('total-balance').textContent = toPersianNum(formatNumber(netBal));
    document.getElementById('total-expense').textContent = toPersianNum(formatNumber(exp));

    updateCardView();

    renderBudgetProgress(catExp);

    const net = inc - exp;
    document.getElementById('weekly-advice-box').innerHTML = `وضعیت نقدینگی شما <strong class="text-[var(--text-main)]">${net>=0?'مثبت':'منفی'}</strong> است. (${toPersianNum(formatNumber(net))} ت)`;

    renderBirthdays();
    renderCheques();
    renderDebts();
    renderTransactions();
    drawCharts();
    updateBellAlarm();
    lucide.createIcons();
}

/* Register as the render hook so storage.saveAndRender() re-renders the UI */
setRenderHook(renderUI);

/* Inline HTML handlers */
Object.assign(window, { renderUI });
