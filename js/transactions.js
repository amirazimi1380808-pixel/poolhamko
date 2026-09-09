/* ─── Transactions (income/expense) + quick coffee ───
 * Ported 1:1 from the original single-file implementation. */

import { state, categories, saveAndRender } from './storage.js';
import { formatNumber, getTodayISO, parseDate, showToast, escapeHTML } from './utils.js';
import { toPersianNum, getShamsiISO, setShamsiSelectValues, getCurrentTimeStr, toggleDatePickerMode } from './jalali-calendar.js';
import { syncCardSelectors } from './cards.js';

export function updateCategories(type,selected=null){
    const sel = document.getElementById('trx-category'); sel.innerHTML = '';
    categories[type].forEach(cat=>{
        const opt = document.createElement('option'); opt.value = cat.name; opt.textContent = cat.name;
        if(selected === cat.name) opt.selected = true; sel.appendChild(opt);
    });
}

export function openTransactionModal(type='expense', id=null){
    const m = document.getElementById('transaction-modal');
    document.getElementById('trx-id').value = id || '';
    syncCardSelectors();

    document.getElementById('toggle-gregorian').checked = false;
    toggleDatePickerMode();

    const defTemplateBox = document.getElementById('default-template-option');
    if (type === 'expense') {
        defTemplateBox.classList.remove('hidden');
        document.getElementById('set-as-default-template').checked = false;
    } else {
        defTemplateBox.classList.add('hidden');
    }

    if(id){
        const t = state.transactions.find(x=>String(x.id)===String(id)); if(!t) return;
        document.getElementById('transaction-modal-title').textContent = t.type === 'expense' ? 'ویرایش هزینه' : 'ویرایش درآمد';
        document.getElementById('trx-type').value = t.type;
        document.getElementById('trx-amount').value = t.amount;
        document.getElementById('trx-account').value = t.account || state.userCards[0]?.id;
        document.getElementById('trx-title').value = t.title;
        document.getElementById('trx-description').value = t.description || '';
        document.getElementById('trx-time').value = t.time || getCurrentTimeStr();

        const dObj = parseDate(t.date);
        setShamsiSelectValues('trx', dObj);
        document.getElementById('trx-gregorian-date').value = t.date ? t.date.slice(0,10) : getTodayISO();

        updateCategories(t.type, t.category);
    } else {
        document.getElementById('transaction-modal-title').textContent = type === 'expense' ? 'ثبت هزینه' : 'ثبت درآمد';
        document.getElementById('trx-type').value = type;
        document.getElementById('trx-amount').value = '';
        document.getElementById('trx-title').value = '';
        document.getElementById('trx-description').value = '';
        document.getElementById('trx-time').value = getCurrentTimeStr();

        const now = new Date();
        setShamsiSelectValues('trx', now);
        document.getElementById('trx-gregorian-date').value = getTodayISO();

        document.getElementById('trx-account').value = state.userCards[0]?.id;
        updateCategories(type);
    }
    m.classList.replace('hidden','flex');
}
export function closeTransactionModal(){ document.getElementById('transaction-modal').classList.replace('flex','hidden'); }

document.getElementById('transaction-form').addEventListener('submit', function(e){
    e.preventDefault();
    const id = document.getElementById('trx-id').value;
    const isGreg = document.getElementById('toggle-gregorian').checked;

    let finalISODate = isGreg ? (document.getElementById('trx-gregorian-date').value || getTodayISO()) : getShamsiISO('trx');
    const timeVal = document.getElementById('trx-time').value || getCurrentTimeStr();

    const type = document.getElementById('trx-type').value;
    const amount = Number(document.getElementById('trx-amount').value);
    const category = document.getElementById('trx-category').value;
    const account = document.getElementById('trx-account').value;
    const title = document.getElementById('trx-title').value;
    const description = document.getElementById('trx-description').value.trim();

    if (type === 'expense' && document.getElementById('set-as-default-template').checked) {
        state.defaultTemplate = { title, amount, category: 'کافه' };
        showToast('این هزینه به عنوان الگوی پیش‌فرض ذخیره شد ⭐');
    }

    const data = { type, amount, category, account, title, description, date: finalISODate, time: timeVal };

    if(id){
        const idx = state.transactions.findIndex(t=>String(t.id)===String(id));
        if(idx !== -1) state.transactions[idx] = { ...state.transactions[idx], ...data };
    } else {
        state.transactions.unshift({ id: Date.now(), ...data });
    }
    closeTransactionModal();
    saveAndRender();
    showToast('تراکنش با موفقیت ذخیره شد');
});
export function deleteTransaction(id){ if(confirm('حذف شود؟')){ state.transactions = state.transactions.filter(t=>String(t.id)!==String(id)); saveAndRender(); } }

export function renderTransactions(){
    const list = document.getElementById('transaction-list');
    const search = (document.getElementById('search-input').value||'').trim().toLowerCase();
    const acc = document.getElementById('account-filter').value;
    const dateF = document.getElementById('date-filter').value;

    const filtered = state.transactions.filter(t=>{
        // جستجوی پیشرفته در عنوان، دسته‌بندی و توضیحات (Keywords)
        const matchSearch = !search ||
            t.title.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search) ||
            (t.description && t.description.toLowerCase().includes(search));

        const matchAcc = acc === 'all' || t.account === acc;
        let matchDate = true; const d = parseDate(t.date); const now = new Date();
        if(dateF === 'today') matchDate = d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if(dateF === 'week') matchDate = d >= new Date(now.getTime() - 7*86400000);
        if(dateF === 'month') matchDate = d >= new Date(now.getTime() - 30*86400000);
        if(dateF === 'year') matchDate = d >= new Date(now.getTime() - 365*86400000);
        return matchSearch && matchAcc && matchDate;
    });

    list.innerHTML = '';
    if(!filtered.length){ list.innerHTML = `<div class="text-center text-xs text-[var(--text-muted)] py-5">تراکنشی یافت نشد</div>`; return; }

    filtered.forEach(t=>{
        const isInc = t.type === 'income';
        const iconName = isInc ? 'arrow-down-left' : (t.category === 'کافه' ? 'coffee' : 'shopping-bag');
        const pDate = new Intl.DateTimeFormat('fa-IR').format(parseDate(t.date));
        const cardObj = state.userCards.find(c => c.id === t.account);
        const cardLabel = cardObj ? cardObj.name : 'حساب';
        const timeDisplay = t.time ? ` • ساعت ${toPersianNum(t.time)}` : '';
        const descDisplay = t.description ? `<p class="text-[9px] text-[var(--text-muted)] italic mt-0.5">💬 ${escapeHTML(t.description)}</p>` : '';

        list.innerHTML += `
            <div class="flex items-start justify-between py-2 group border-b border-[var(--border-color)] last:border-0">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full bg-[var(--invert-bg)] text-[var(--invert-text)] flex items-center justify-center cursor-pointer shrink-0 mt-0.5" onclick="openTransactionModal('${t.type}','${t.id}')">
                        <i data-lucide="${iconName}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <p class="font-bold text-[13px] text-[var(--text-main)]">${escapeHTML(t.title)}</p>
                        <p class="text-[10px] text-[var(--text-muted)] font-medium">${toPersianNum(pDate)}${timeDisplay} • ${escapeHTML(t.category)} • <span class="text-[var(--primary)] font-bold">${cardLabel}</span></p>
                        ${descDisplay}
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <div class="font-bold text-[13px] text-[var(--text-main)]">${isInc?'':'-'} ${toPersianNum(formatNumber(t.amount))} ت</div>
                    <button onclick="deleteTransaction('${t.id}')" class="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

/* QUICK COFFEE */
export function promptCoffeePrice() {
    document.getElementById('coffee-quick-price-input').value = state.defaultTemplate.amount || 70000;
    document.getElementById('coffee-confirm-modal').classList.replace('hidden', 'flex');
    document.getElementById('coffee-quick-price-input').focus();
}

export function closeCoffeeConfirmModal() {
    document.getElementById('coffee-confirm-modal').classList.replace('flex', 'hidden');
}

export function submitQuickCoffee() {
    const enteredPrice = Number(document.getElementById('coffee-quick-price-input').value);
    if (!enteredPrice || enteredPrice <= 0) {
        showToast('لطفاً مبلغ معتبری وارد کنید');
        return;
    }

    state.defaultTemplate.amount = enteredPrice;
    localStorage.setItem('poolham_default_template', JSON.stringify(state.defaultTemplate));

    const defaultAcc = state.userCards[0]?.id;
    const newTrx = {
        id: Date.now(),
        type: 'expense',
        amount: enteredPrice,
        category: 'کافه',
        account: defaultAcc,
        title: state.defaultTemplate.title || 'قهوه روزانه',
        description: 'ثبت سریع روزانه',
        date: getTodayISO(),
        time: getCurrentTimeStr()
    };
    state.transactions.unshift(newTrx);
    saveAndRender();
    closeCoffeeConfirmModal();
    showToast(`هزینه قهوه روزانه (${toPersianNum(formatNumber(enteredPrice))} ت) در ساعت ${toPersianNum(newTrx.time)} ثبت شد ☕`);
}

document.getElementById('coffee-quick-price-input')?.addEventListener('keydown', function(e){
    if(e.key === 'Enter') submitQuickCoffee();
});

/* Inline HTML handlers */
Object.assign(window, {
    openTransactionModal, closeTransactionModal, deleteTransaction,
    renderTransactions, promptCoffeePrice, closeCoffeeConfirmModal, submitQuickCoffee
});
