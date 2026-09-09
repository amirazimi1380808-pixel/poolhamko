/* ─── Cheques / installments ───
 * Ported 1:1 from the original single-file implementation. */

import { state, saveAndRender } from './storage.js';
import { formatNumber, parseDate, showToast, escapeHTML } from './utils.js';
import { toPersianNum, getShamsiISO, setShamsiSelectValues } from './jalali-calendar.js';

export function openChequeModal(){
    document.getElementById('cheque-modal').classList.replace('hidden','flex');
    setShamsiSelectValues('cheque', new Date());
}
export function closeChequeModal(){ document.getElementById('cheque-modal').classList.replace('flex','hidden'); }

document.getElementById('cheque-form').addEventListener('submit', function(e){
    e.preventDefault();
    state.cheques.unshift({
        id: Date.now(),
        type: document.getElementById('cheque-type').value,
        amount: Number(document.getElementById('cheque-amount').value),
        title: document.getElementById('cheque-title').value,
        date: getShamsiISO('cheque'),
        target: document.getElementById('cheque-target').value,
        settled: false
    });
    this.reset(); closeChequeModal(); saveAndRender(); showToast('چک / قسط ثبت شد');
});

export function toggleChequeStatus(id){ const item = state.cheques.find(c=>String(c.id)===String(id)); if(item){ item.settled = !item.settled; saveAndRender(); } }
export function deleteCheque(id){ if(confirm('حذف شود؟')){ state.cheques = state.cheques.filter(c=>String(c.id)!==String(id)); saveAndRender(); } }

export function renderCheques(){
    const list = document.getElementById('cheque-list'); list.innerHTML = '';
    if(!state.cheques.length){ list.innerHTML = `<div class="text-[10px] text-[var(--text-muted)] py-2">خالی است</div>`; return; }
    state.cheques.forEach(c=>{
        const pDate = new Intl.DateTimeFormat('fa-IR').format(parseDate(c.date));
        list.innerHTML += `
            <div class="p-3 bg-[var(--hover-bg)] rounded-xl flex justify-between items-center border border-[var(--border-color)] ${c.settled ? 'opacity-50' : ''}">
                <div>
                    <p class="text-xs font-bold text-[var(--text-main)] ${c.settled ? 'line-through' : ''}">${escapeHTML(c.title)}</p>
                    <p class="text-[9px] text-[var(--text-muted)] mt-0.5">سررسید: ${toPersianNum(pDate)} • ${toPersianNum(formatNumber(c.amount))} ت</p>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="toggleChequeStatus('${c.id}')" class="text-[10px] px-2 py-1 bg-[var(--card-bg)] text-[var(--text-main)] rounded shadow-sm hover:opacity-80">${c.settled?'بازگشت':'تسویه'}</button>
                    <button onclick="deleteCheque('${c.id}')" class="text-[var(--text-muted)] hover:text-red-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>
        `;
    });
}

/* Inline HTML handlers */
Object.assign(window, { openChequeModal, closeChequeModal, toggleChequeStatus, deleteCheque });
