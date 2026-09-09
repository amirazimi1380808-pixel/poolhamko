/* ─── Data model, persistence & global app state ───
 * Ported from the original single-file implementation.
 * All previously-global variables now live on the mutable `state` object
 * (ES module imports are read-only bindings, so shared mutable data is grouped).
 *
 * Persistence has TWO modes (phase 2):
 *  - plaintext mode (no PIN): unchanged legacy keys — original behavior kept
 *  - vault mode (PIN set): sensitive keys live ONLY inside the AES-GCM vault
 *    (js/secure-storage.js); prefs stay plaintext (not sensitive).
 * localStorage keys and data shapes are UNCHANGED. */

import { secureSave, vaultExists, hasSession, clearPlaintextData, SENSITIVE_KEYS, LEGACY_PIN_KEY } from './secure-storage.js';
import { showToast } from './utils.js';

/* Categories (unchanged) */
export const categories = {
    income:[
        {id:'trading',name:'ترید و بازارهای مالی'},
        {id:'salary',name:'حقوق و دستمزد'},
        {id:'freelance',name:'پروژه و فریلنس'},
        {id:'other_inc',name:'سایر درآمدها'}
    ],
    expense:[
        {id:'coffee',name:'کافه'},
        {id:'food',name:'خوراک و سوپرمارکت'},
        {id:'transport',name:'حمل‌ونقل و تاکسی'},
        {id:'tech',name:'ابزار و نرم‌افزار'},
        {id:'edu',name:'آموزش و کتاب'},
        {id:'health',name:'سلامت و درمان'},
        {id:'other_exp',name:'متفرقه'}
    ]
};

/* Color themes (unchanged) */
export const colorThemes = {
    purple: { right: '#faefe7', primary: '#8a63f7', chartGrad: 'rgba(138, 99, 247, 0.2)' },
    green:  { right: '#e6f9f0', primary: '#10b981', chartGrad: 'rgba(16, 185, 129, 0.2)' },
    blue:   { right: '#eef2ff', primary: '#4f46e5', chartGrad: 'rgba(79, 70, 229, 0.2)' },
    rose:   { right: '#fff1f2', primary: '#e11d48', chartGrad: 'rgba(225, 29, 72, 0.2)' }
};

/* Safe JSON loader — identical outcome to the original
 * `JSON.parse(localStorage.getItem(k)) || fallback` for all valid/empty data,
 * but also survives corrupted JSON instead of crashing at startup. */
function loadJSON(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return (v === null || v === undefined) ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

const DEFAULT_BUDGETS = {
    'کافه':1000000, 'خوراک و سوپرمارکت':2000000, 'حمل‌ونقل و تاکسی':1000000, 'ابزار و نرم‌افزار':1500000, 'آموزش و کتاب':1000000, 'سلامت و درمان':1000000, 'متفرقه':1000000
};

const DEFAULT_CARDS = [
    { id: 'card_main', name: 'حساب اصلی', bank: 'بانک ملت', digits: '۱۶۵۵', initial: 0, color: 'skin-black' },
    { id: 'card_prop', name: 'صرافی / پراپ', bank: 'بروکر', digits: '۲۰۲۰', initial: 0, color: 'skin-blue' },
    { id: 'card_cash', name: 'پول نقد', bank: 'کیف دستی', digits: '۰۰۰۰', initial: 0, color: 'skin-green' }
];

/* Non-sensitive prefs load immediately (always plaintext, as before).
 * Sensitive data is NOT loaded here — in vault mode the app must boot locked
 * with empty state; hydration happens explicitly at the right moment. */
export const state = {
    userCards: DEFAULT_CARDS,
    defaultTemplate: { title: 'قهوه روزانه', amount: 70000, category: 'کافه' },
    transactions: [],
    debts: [],
    cheques: [],
    birthdays: [],
    budgets: DEFAULT_BUDGETS,

    appPin: localStorage.getItem(LEGACY_PIN_KEY) || '',   // legacy plaintext fallback only
    userName: localStorage.getItem('poolham_username') || 'کاربر عزیز',

    currentTheme: localStorage.getItem('poolham_color_theme') || 'purple',
    isDarkMode: localStorage.getItem('poolham_dark_mode') === 'true'
};

/* Load sensitive data from plaintext localStorage (pinless mode only). */
export function hydrateFromLocal() {
    state.userCards        = loadJSON('poolham_cards', DEFAULT_CARDS);
    state.defaultTemplate  = loadJSON('poolham_default_template', { title: 'قهوه روزانه', amount: 70000, category: 'کافه' });
    state.transactions     = loadJSON('poolham_transactions', []);
    state.debts            = loadJSON('poolham_debts', []);
    state.cheques          = loadJSON('poolham_cheques', []);
    state.birthdays        = loadJSON('poolham_birthdays', []);
    state.budgets          = loadJSON('poolham_budgets', DEFAULT_BUDGETS);
    state.appPin           = localStorage.getItem(LEGACY_PIN_KEY) || '';
}

/* Snapshot of sensitive data (for vault encryption / plaintext writes) */
export function payloadFromState() {
    return {
        userCards: state.userCards,
        defaultTemplate: state.defaultTemplate,
        transactions: state.transactions,
        debts: state.debts,
        cheques: state.cheques,
        birthdays: state.birthdays,
        budgets: state.budgets
    };
}

/* Load a decrypted vault payload into runtime state (after unlock) */
export function applyPayloadToState(p) {
    state.userCards        = p.userCards || DEFAULT_CARDS;
    state.defaultTemplate  = p.defaultTemplate || { title: 'قهوه روزانه', amount: 70000, category: 'کافه' };
    state.transactions     = p.transactions || [];
    state.debts            = p.debts || [];
    state.cheques          = p.cheques || [];
    state.birthdays        = p.birthdays || [];
    state.budgets          = p.budgets || DEFAULT_BUDGETS;
}

/* Write sensitive data as plaintext (pinless mode / PIN removal) —
 * same keys & shapes as the original saveAndRender + default template. */
export function savePlaintextData() {
    localStorage.setItem('poolham_cards', JSON.stringify(state.userCards));
    localStorage.setItem('poolham_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('poolham_debts', JSON.stringify(state.debts));
    localStorage.setItem('poolham_cheques', JSON.stringify(state.cheques));
    localStorage.setItem('poolham_birthdays', JSON.stringify(state.birthdays));
    localStorage.setItem('poolham_budgets', JSON.stringify(state.budgets));
    localStorage.setItem('poolham_default_template', JSON.stringify(state.defaultTemplate));
}

/* Mode-aware persistence. Returns a promise in vault mode. */
export function saveAll(){
    if (vaultExists()) {
        if (!hasSession()) {
            console.error('vault exists but session is locked — data not written');
            return Promise.reject(new Error('locked-session'));
        }
        return secureSave(payloadFromState());
    }
    savePlaintextData();
    return Promise.resolve();
}

/* saveAndRender with an injected render hook (avoids circular imports).
 * ui-render.js registers itself via setRenderHook(renderUI). */
let renderHook = null;
export function setRenderHook(fn){ renderHook = fn; }
export function saveAndRender(){
    try {
        const p = saveAll();
        if (p && typeof p.catch === 'function') {
            p.catch(err => { console.error(err); showToast('خطا در ذخیره‌سازی امن: ' + err.message); });
        }
    } catch (err) {
        console.error(err);
        showToast('خطا در ذخیره‌سازی: ' + err.message);
    }
    if (renderHook) renderHook();
}

export { clearPlaintextData, SENSITIVE_KEYS, LEGACY_PIN_KEY };
