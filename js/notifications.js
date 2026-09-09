/* ─── Bell notification system («وقتشه ها !») ───
 * Ported 1:1 from the original single-file implementation. */

import { state } from './storage.js';
import { formatNumber, getTodayISO, parseDate, escapeHTML } from './utils.js';
import { toPersianNum } from './jalali-calendar.js';

export function updateBellAlarm() {
    const badge = document.getElementById('bell-alarm-badge');
    const countEl = document.getElementById('bell-alarm-count');
    const dot = document.getElementById('bell-dot');
    const container = document.getElementById('notification-items-container');
    const totalBadge = document.getElementById('notif-total-badge');

    const todayISO = getTodayISO();
    const today = new Date(todayISO);
    let urgentItems = [];

    state.cheques.forEach(c => {
        if (!c.settled) {
            const dueDate = parseDate(c.date);
            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
                const label = diffDays === 0 ? 'سررسید امروز!' : `${toPersianNum(Math.abs(diffDays))} روز گذشته`;
                urgentItems.push({
                    type: 'cheque',
                    title: `چک / قسط: ${c.title}`,
                    amount: c.amount,
                    date: c.date,
                    status: label
                });
            }
        }
    });

    state.debts.forEach(d => {
        if (!d.settled && d.type === 'credit') {
            urgentItems.push({
                type: 'credit',
                title: `طلب از: ${d.person}`,
                amount: d.amount,
                date: d.date,
                status: 'وصول طلبکاری'
            });
        }
    });

    container.innerHTML = '';

    if (urgentItems.length > 0) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        countEl.textContent = toPersianNum(urgentItems.length);
        dot.classList.remove('hidden');
        totalBadge.textContent = `${toPersianNum(urgentItems.length)} مورد نیازمند پیگیری`;

        urgentItems.forEach(item => {
            const isCheque = item.type === 'cheque';
            const icon = isCheque ? 'credit-card' : 'hand-coins';
            const pDate = new Intl.DateTimeFormat('fa-IR').format(parseDate(item.date));

            container.innerHTML += `
                <div class="p-2.5 rounded-xl bg-[var(--hover-bg)] border border-[var(--border-color)] flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                            <i data-lucide="${icon}" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-[var(--text-main)]">${escapeHTML(item.title)}</p>
                            <p class="text-[9px] text-[var(--text-muted)] mt-0.5">${toPersianNum(pDate)} • <span class="font-bold text-rose-500">${item.status}</span></p>
                        </div>
                    </div>
                    <strong class="text-xs text-[var(--text-main)] shrink-0">${toPersianNum(formatNumber(item.amount))} ت</strong>
                </div>
            `;
        });
    } else {
        badge.classList.remove('flex');
        badge.classList.add('hidden');
        dot.classList.add('hidden');
        totalBadge.textContent = 'هیچ هشدار فوری ندارید';
        container.innerHTML = `
            <div class="text-center py-6 text-xs text-[var(--text-muted)]">
                <i data-lucide="check-circle" class="w-6 h-6 mx-auto mb-2 text-emerald-500"></i>
                تمام چک‌ها و مطالبات شما به‌روز و مرتب است!
            </div>
        `;
    }
    lucide.createIcons();
}

export function toggleNotificationDropdown() {
    const dd = document.getElementById('notification-dropdown');
    dd.classList.toggle('hidden');
}

/* Close dropdown on outside click */
document.addEventListener('click', function(e) {
    const dd = document.getElementById('notification-dropdown');
    const badge = document.getElementById('bell-alarm-badge');
    const bellBtn = document.getElementById('bell-icon');
    if (dd && !dd.classList.contains('hidden')) {
        if (!dd.contains(e.target) && !badge.contains(e.target) && !bellBtn.contains(e.target)) {
            dd.classList.add('hidden');
        }
    }
});

/* Inline HTML handlers */
Object.assign(window, { toggleNotificationDropdown });
