/* ─── Monthly budgets ───
 * Ported 1:1 from the original single-file implementation.
 * renderBudgetProgress(catExp) was inlined inside renderUI() before;
 * it is now a separate function with identical output.
 * Phase-4 audit: budgets are a SENSITIVE_KEY — persistence goes through the
 * centralized mode-aware layer (vault when a PIN is set, plaintext otherwise). */

import { state, categories, saveAndRender } from './storage.js';
import { formatNumber, escapeHTML } from './utils.js';
import { toPersianNum } from './jalali-calendar.js';

export function openBudgetModal(){
    const c = document.getElementById('budget-inputs-container'); c.innerHTML = '';
    categories.expense.forEach(cat=>{
        // Number() coercion → a tampered/legacy string value can never break out
        // of the value attribute (finding #5). cat.name is a trusted static list.
        c.innerHTML += `<div><label class="block text-[11px] text-[var(--text-muted)] mb-1">${cat.name}</label><input id="bgt-${cat.id}" type="number" value="${Number(state.budgets[cat.name])||0}" class="input"></div>`;
    });
    document.getElementById('budget-modal').classList.replace('hidden','flex');
}
export function closeBudgetModal(){ document.getElementById('budget-modal').classList.replace('flex','hidden'); }
export function saveBudgets(){
    categories.expense.forEach(cat=>{ state.budgets[cat.name] = Number(document.getElementById(`bgt-${cat.id}`).value) || 0; });
    /* vault mode → encrypted inside poolham_vault; pinless → legacy plaintext.
     * (Never write poolham_budgets directly — it is a SENSITIVE_KEY.) */
    saveAndRender();
    closeBudgetModal();
}

/* Budget progress bars (exact port of the renderUI budget block).
 * Category keys can come from a restored backup file → escapeHTML them. */
export function renderBudgetProgress(catExp){
    const bC = document.getElementById('budget-progress-container'); bC.innerHTML = '';
    Object.entries(state.budgets).forEach(([cat,limit])=>{
        const lim = Number(limit) || 0;
        if(lim <= 0) return;
        const spent = catExp[cat] || 0;
        const pct = Math.min(Math.round((spent/lim)*100), 100);
        const col = pct >= 90 ? 'bg-red-500' : 'bg-[var(--invert-bg)]';
        bC.innerHTML += `<div><div class="flex justify-between text-[10px] font-bold mb-1"><span class="text-[var(--text-muted)]">${escapeHTML(cat)}</span><span class="text-[var(--text-muted)]">${toPersianNum(formatNumber(spent))} / ${toPersianNum(formatNumber(lim))} ت</span></div><div class="h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden"><div class="h-full rounded-full ${col}" style="width:${pct}%"></div></div></div>`;
    });
}

/* Inline HTML handlers */
Object.assign(window, { openBudgetModal, closeBudgetModal, saveBudgets });
