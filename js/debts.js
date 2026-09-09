/* ─── Debts & credits ───
 * Ported 1:1 from the original single-file implementation. */

import { state, saveAndRender } from './storage.js';
import { formatNumber, parseDate, showToast, escapeHTML, escapeAttr } from './utils.js';
import { toPersianNum, getShamsiISO, setShamsiSelectValues, getCurrentTimeStr } from './jalali-calendar.js';

export function openDebtModal(){
    document.getElementById('debt-modal').classList.replace('hidden','flex');
    setShamsiSelectValues('debt', new Date());
    document.getElementById('debt-time').value = getCurrentTimeStr();
}
export function closeDebtModal(){ document.getElementById('debt-modal').classList.replace('flex','hidden'); }

document.getElementById('debt-form').addEventListener('submit', function(e){
    e.preventDefault();
    state.debts.unshift({
        id: Date.now(),
        type: document.getElementById('debt-type').value,
        amount: Number(document.getElementById('debt-amount').value),
        person: document.getElementById('debt-person').value,
        date: getShamsiISO('debt'),
        time: document.getElementById('debt-time').value || getCurrentTimeStr(),
        settled: false
    });
    this.reset(); closeDebtModal(); saveAndRender(); showToast('ثبت شد');
});

export function toggleDebtStatus(id){ const d = state.debts.find(x=>String(x.id)===String(id)); if(d){ d.settled = !d.settled; saveAndRender(); } }
export function deleteDebt(id){ if(confirm('حذف شود؟')){ state.debts = state.debts.filter(x=>String(x.id)!==String(id)); saveAndRender(); } }

export function renderDebts(){
    const list = document.getElementById('debt-list'); list.innerHTML = '';
    if(!state.debts.length){ list.innerHTML = `<div class="text-[10px] text-[var(--text-muted)] py-2">خالی است</div>`; return; }
    state.debts.forEach(d=>{
        const pDate = new Intl.DateTimeFormat('fa-IR').format(parseDate(d.date));
        const timeDisplay = d.time ? ` ساعت ${toPersianNum(d.time)}` : '';
        list.innerHTML += `
            <div class="p-3 bg-[var(--hover-bg)] rounded-xl flex justify-between items-center border border-[var(--border-color)] ${d.settled?'opacity-50':''}">
                <div>
                    <p class="text-xs font-bold text-[var(--text-main)] ${d.settled?'line-through':''}">${escapeHTML(d.person)} <span class="text-[9px] font-normal text-[var(--text-muted)]">(${d.type==='debt'?'بدهی':'طلب'})</span></p>
                    <p class="text-[10px] text-[var(--text-muted)] mt-0.5">${toPersianNum(pDate)}${timeDisplay} • ${toPersianNum(formatNumber(d.amount))} ت</p>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="toggleDebtStatus('${escapeAttr(d.id)}')" class="text-[10px] px-2 py-1 bg-[var(--card-bg)] text-[var(--text-main)] rounded shadow-sm hover:opacity-80">${d.settled?'لغو':'تسویه'}</button>
                    <button onclick="deleteDebt('${escapeAttr(d.id)}')" class="text-[var(--text-muted)] hover:text-red-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>
        `;
    });
}

/* Inline HTML handlers */
Object.assign(window, { openDebtModal, closeDebtModal, toggleDebtStatus, deleteDebt });
