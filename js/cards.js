/* ─── Bank cards management ───
 * Ported 1:1 from the original single-file implementation. */

import { state, saveAndRender } from './storage.js';
import { formatNumber, showToast } from './utils.js';
import { toPersianNum } from './jalali-calendar.js';

export function openNewCardModal() { document.getElementById('card-modal').classList.replace('hidden', 'flex'); }
export function closeNewCardModal() { document.getElementById('card-modal').classList.replace('flex', 'hidden'); document.getElementById('card-form').reset(); }

document.getElementById('card-form').addEventListener('submit', function(e){
    e.preventDefault();
    const newCard = {
        id: 'card_' + Date.now(),
        name: document.getElementById('new-card-name').value.trim(),
        bank: document.getElementById('new-card-bank').value.trim() || 'بانک',
        digits: document.getElementById('new-card-digits').value.trim() || '۰۰۰۰',
        initial: Number(document.getElementById('new-card-initial').value) || 0,
        color: document.getElementById('new-card-color').value
    };
    state.userCards.push(newCard);
    saveAndRender();
    closeNewCardModal();
    showToast('کارت جدید اضافه شد 🎉');
});

export function deleteActiveCard() {
    const sel = document.getElementById('card-selector').value;
    if(sel === 'all') return;
    if(confirm('آیا این کارت حذف شود؟')) {
        state.userCards = state.userCards.filter(c => c.id !== sel);
        document.getElementById('card-selector').value = 'all';
        saveAndRender();
        showToast('کارت حذف شد');
    }
}

export function syncCardSelectors() {
    const cardSel = document.getElementById('card-selector');
    const chartCardSel = document.getElementById('chart-card-filter');
    const trxAcc = document.getElementById('trx-account');
    const accFilter = document.getElementById('account-filter');

    const currCardVal = cardSel.value;
    const currChartVal = chartCardSel.value;
    const currTrxVal = trxAcc.value;
    const currAccFilterVal = accFilter.value;

    cardSel.innerHTML = '<option value="all">همه حساب‌ها</option>';
    chartCardSel.innerHTML = '<option value="all">مجموع همه کارت‌ها</option>';
    trxAcc.innerHTML = '';
    accFilter.innerHTML = '<option value="all">همه</option>';

    state.userCards.forEach(c => {
        const optText = `${c.name} (${c.bank})`;
        cardSel.innerHTML += `<option value="${c.id}">${optText}</option>`;
        chartCardSel.innerHTML += `<option value="${c.id}">${optText}</option>`;
        trxAcc.innerHTML += `<option value="${c.id}">${optText}</option>`;
        accFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });

    if ([...cardSel.options].some(o => o.value === currCardVal)) cardSel.value = currCardVal;
    if ([...chartCardSel.options].some(o => o.value === currChartVal)) chartCardSel.value = currChartVal;
    if ([...trxAcc.options].some(o => o.value === currTrxVal)) trxAcc.value = currTrxVal;
    if ([...accFilter.options].some(o => o.value === currAccFilterVal)) accFilter.value = currAccFilterVal;
}

export function updateCardView() {
    const sel = document.getElementById('card-selector').value;
    const titleEl = document.getElementById('card-display-title');
    const bankEl = document.getElementById('card-display-bank');
    const balEl = document.getElementById('card-display-balance');
    const cardPanel = document.getElementById('card-panel');
    const mockNum = document.getElementById('card-mock-number');
    const delBtn = document.getElementById('card-delete-btn');

    let balances = {};
    state.userCards.forEach(c => balances[c.id] = c.initial || 0);

    state.transactions.forEach(t => {
        const v = Number(t.amount) || 0;
        const a = t.account || state.userCards[0]?.id;
        if (balances[a] !== undefined) {
            if (t.type === 'income') balances[a] += v;
            else balances[a] -= v;
        }
    });

    cardPanel.className = 'rounded-2xl p-6 text-white relative overflow-hidden mb-4 shadow-xl';

    if (sel === 'all') {
        const total = Object.values(balances).reduce((a, b) => a + b, 0);
        titleEl.textContent = 'مجموع حساب‌ها';
        bankEl.textContent = 'سیستم یکپارچه';
        cardPanel.classList.add('skin-black');
        mockNum.textContent = toPersianNum('**** **** **** ۱۶۵۵');
        balEl.textContent = toPersianNum(formatNumber(total)) + ' تومان';
        delBtn.classList.add('hidden');
    } else {
        const c = state.userCards.find(card => card.id === sel);
        if(c) {
            titleEl.textContent = c.name;
            bankEl.textContent = c.bank;
            cardPanel.classList.add(c.color || 'skin-black');
            mockNum.textContent = toPersianNum(`**** **** **** ${c.digits}`);
            balEl.textContent = toPersianNum(formatNumber(balances[c.id])) + ' تومان';
            delBtn.classList.remove('hidden');
        }
    }
}

/* Inline HTML handlers */
Object.assign(window, { openNewCardModal, closeNewCardModal, deleteActiveCard, updateCardView });
