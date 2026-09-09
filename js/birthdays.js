/* ─── Birthdays reminder ───
 * Ported 1:1 from the original single-file implementation. */

import { state, saveAndRender } from './storage.js';
import { parseDate, showToast, escapeHTML } from './utils.js';
import { toPersianNum, gregorianToJalali, shamsiMonthNames, getShamsiISO, setShamsiSelectValues } from './jalali-calendar.js';

export function openBirthdayModal(){
    document.getElementById('birthday-modal').classList.replace('hidden','flex');
    setShamsiSelectValues('bday', new Date(2000, 0, 1));
}
export function closeBirthdayModal(){ document.getElementById('birthday-modal').classList.replace('flex','hidden'); }

document.getElementById('birthday-form').addEventListener('submit', function(e){
    e.preventDefault();
    state.birthdays.unshift({
        id: Date.now(),
        name: document.getElementById('bday-name').value,
        date: getShamsiISO('bday'),
        relation: document.getElementById('bday-relation').value,
        gift: document.getElementById('bday-gift').value
    });
    this.reset(); closeBirthdayModal(); saveAndRender(); showToast('تاریخ تولد ثبت شد');
});

export function deleteBirthday(id){ if(confirm('حذف شود؟')){ state.birthdays = state.birthdays.filter(b=>String(b.id) !== String(id)); saveAndRender(); } }

export function renderBirthdays(){
    const c = document.getElementById('birthday-list'); c.innerHTML = '';
    if(!state.birthdays.length){ c.innerHTML = `<div class="text-[10px] text-[var(--text-muted)] py-2">خالی است</div>`; return; }
    const today = new Date(), currentYear = today.getFullYear();
    const sorted = [...state.birthdays].map(b=>{
        const bD = new Date(b.date); let nB = new Date(currentYear, bD.getMonth(), bD.getDate());
        if(nB < new Date(today.getFullYear(), today.getMonth(), today.getDate())) nB.setFullYear(currentYear + 1);
        return { ...b, diffDays: Math.ceil((nB - today) / (1000 * 60 * 60 * 24)) };
    }).sort((a,b)=>a.diffDays - b.diffDays);

    sorted.forEach(b=>{
        const [jy, jm, jd] = gregorianToJalali(parseDate(b.date).getFullYear(), parseDate(b.date).getMonth() + 1, parseDate(b.date).getDate());
        const shamsiDateStr = `${toPersianNum(jd)} ${shamsiMonthNames[jm-1]}`;
        c.innerHTML += `
            <div class="p-3 bg-[var(--hover-bg)] rounded-xl flex justify-between items-center border border-[var(--border-color)]">
                <div>
                    <p class="text-xs font-bold text-[var(--text-main)]">${escapeHTML(b.name)}</p>
                    <p class="text-[9px] text-[var(--text-muted)] mt-0.5">${shamsiDateStr} • ${b.diffDays===0?'امروز!':toPersianNum(b.diffDays)+' روز دیگر'} ${b.gift? ' • کادو: '+escapeHTML(b.gift):''}</p>
                </div>
                <button onclick="deleteBirthday('${b.id}')" class="text-[var(--text-muted)] hover:text-red-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        `;
    });
}

/* Inline HTML handlers */
Object.assign(window, { openBirthdayModal, closeBirthdayModal, deleteBirthday });
