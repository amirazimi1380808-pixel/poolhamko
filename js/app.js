/* ─── App bootstrap: migration, vault gate, drag & drop widgets, FAB, init ───
 * Ported 1:1 from the original single-file implementation.
 * Init order is identical to the original bottom-of-file block, extended with
 * the phase-2 security boot: legacy plaintext auto-migration + vault lock. */

import { state, hydrateFromLocal, payloadFromState } from './storage.js';
import { showToast } from './utils.js';
import { toPersianNum, initAllShamsiSelectors } from './jalali-calendar.js';
import { updateCategories } from './transactions.js';
import { applyDarkMode, applyColorTheme, checkAppLock } from './settings.js';
import { renderUI } from './ui-render.js';
import { vaultExists, createVault, clearPlaintextData, SENSITIVE_KEYS, LEGACY_PIN_KEY } from './secure-storage.js';

/* FAB BUTTON */
export function toggleFabMenu() {
    const menu = document.getElementById('quick-fab-menu');
    menu.classList.toggle('hidden');
    menu.classList.toggle('flex');
}

/* DRAG & DROP */
let draggedElement = null;
function initDragAndDrop() {
    const container = document.getElementById('modular-container');
    const widgets = container.querySelectorAll('.draggable-widget');
    const savedOrder = JSON.parse(localStorage.getItem('poolham_widget_order'));
    if (savedOrder && Array.isArray(savedOrder)) {
        savedOrder.forEach(id => {
            const el = document.getElementById(id);
            if (el) container.appendChild(el);
        });
    }

    widgets.forEach(widget => {
        widget.addEventListener('dragstart', function(e) { draggedElement = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', this.id); });
        widget.addEventListener('dragend', function() { this.classList.remove('dragging'); widgets.forEach(w => w.classList.remove('drag-over')); saveLayoutOrder(); });
        widget.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (this !== draggedElement) this.classList.add('drag-over'); });
        widget.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
        widget.addEventListener('drop', function(e) {
            e.preventDefault(); this.classList.remove('drag-over');
            if (this !== draggedElement) {
                const allWidgets = [...container.querySelectorAll('.draggable-widget')];
                if (allWidgets.indexOf(draggedElement) < allWidgets.indexOf(this)) this.after(draggedElement); else this.before(draggedElement);
                saveLayoutOrder();
                showToast('ترتیب چیدمان ذخیره شد');
            }
        });
    });
}
function saveLayoutOrder() {
    const ids = [...document.getElementById('modular-container').querySelectorAll('.draggable-widget')].map(w => w.id);
    localStorage.setItem('poolham_widget_order', JSON.stringify(ids));
}
export function resetLayoutOrder() { localStorage.removeItem('poolham_widget_order'); showToast('چیدمان ریست شد.'); setTimeout(() => location.reload(), 1000); }

/* ─── Legacy migration (mandatory, task 3) ───
 * Old version stored data as plaintext + plaintext PIN (poolham_pin).
 * If both exist and no vault is present yet → encrypt into a verified vault,
 * and only then remove the plaintext copies. If anything fails, plaintext
 * data and the legacy PIN lock remain untouched (fallback + clear error). */
async function migrateLegacyIfNeeded() {
    if (vaultExists()) return;
    const legacyPin = (localStorage.getItem(LEGACY_PIN_KEY) || '').trim();
    const hasData = SENSITIVE_KEYS.some(k => localStorage.getItem(k));
    if (!legacyPin || !hasData) return;
    try {
        hydrateFromLocal();
        await createVault(legacyPin, payloadFromState());   // verified write
        clearPlaintextData();                               // only after verify succeeded
        state.appPin = '';
        showToast('اطلاعات شما به‌صورت رمزنگاری‌شده منتقل شد 🔐');
    } catch (e) {
        console.error('migration failed:', e);
        state.appPin = legacyPin;                           // legacy lock keeps working
        showToast('مهاجرت رمزنگاری ناموفق بود؛ داده‌های شما دست‌نخورده ماندند');
    }
}

/* ─── INIT (original order + security boot) ─── */
document.getElementById('today-date').textContent = toPersianNum(new Date().toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'}));
initAllShamsiSelectors();
applyDarkMode(true);
applyColorTheme(state.currentTheme, true);
updateCategories('expense');
initDragAndDrop();

await migrateLegacyIfNeeded();

if (vaultExists()) {
    /* Vault mode: boot locked — sensitive state stays EMPTY until unlock */
    renderUI();          // empty shell behind the lock overlay
    checkAppLock();
} else {
    /* Pinless mode: identical to the original behavior */
    hydrateFromLocal();
    renderUI();
    checkAppLock();
}
lucide.createIcons();

/* Inline HTML handlers */
Object.assign(window, { toggleFabMenu, resetLayoutOrder });
