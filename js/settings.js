/* ─── Settings, themes, PIN lock/vault, backup/restore, CSV export ───
 * Phase 2: the PIN now drives REAL encryption (PBKDF2 + AES-GCM vault).
 * UX preserved: pinless users are never forced to create a PIN; lock screen,
 * toasts and flows look the same. The only unavoidable UX differences
 * (documented in PHASE2-REPORT.md): the old PIN can no longer be pre-filled
 * in settings (it is not stored anywhere), and a "حذف پین" button was added
 * so the PIN can be removed without typing it. */

import { state, saveAll, savePlaintextData, payloadFromState, applyPayloadToState, colorThemes, saveAndRender } from './storage.js';
import {
    vaultExists, hasSession, unlockVault, createVault, changePin, adoptVault,
    clearPlaintextData, clearStalePlaintextData, destroyVault,
    buildEncryptedBackup, importEncryptedBackup, LEGACY_PIN_KEY
} from './secure-storage.js';
import { showToast } from './utils.js';
import { renderUI } from './ui-render.js';

/* THEMES */
export function applyColorTheme(themeKey, skipRender = false) {
    if (!colorThemes[themeKey]) themeKey = 'purple';
    state.currentTheme = themeKey;
    localStorage.setItem('poolham_color_theme', themeKey);
    const t = colorThemes[themeKey];
    document.documentElement.style.setProperty('--bg-right', t.right);
    document.documentElement.style.setProperty('--primary', t.primary);
    if(!skipRender) renderUI();
}

export function applyDarkMode(init = false) {
    const icon = document.getElementById('dark-mode-icon');
    if (state.isDarkMode) {
        document.body.classList.add('dark-theme');
        icon.setAttribute('data-lucide', 'sun');
    } else {
        document.body.classList.remove('dark-theme');
        icon.setAttribute('data-lucide', 'moon');
    }
    if (!init) {
        lucide.createIcons();
        renderUI();
    }
}

export function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    localStorage.setItem('poolham_dark_mode', state.isDarkMode);
    applyDarkMode();
}

/* PIN LOCK → now the gate to the encrypted vault */
export function checkAppLock(){
    if (vaultExists()) {
        const l = document.getElementById('lock-screen');
        l.classList.remove('hidden'); l.classList.add('flex');
        document.getElementById('lock-pin-input').focus();
        return;
    }
    // legacy plaintext pin fallback (only if vault migration failed at boot)
    if(state.appPin && state.appPin.trim() !== ''){
        const l = document.getElementById('lock-screen');
        l.classList.remove('hidden'); l.classList.add('flex');
        document.getElementById('lock-pin-input').focus();
    }
}

let unlockBusy = false;
export async function unlockApp(){
    if (unlockBusy) return;
    const input = document.getElementById('lock-pin-input');
    const pin = input.value;
    if (!pin) { showToast('پین اشتباه است'); return; }
    unlockBusy = true;
    try {
        if (vaultExists()) {
            const payload = await unlockVault(pin);            // throws on wrong PIN
            applyPayloadToState(payload);
            clearStalePlaintextData();                          // interrupted-migration dupes
            document.getElementById('lock-screen').classList.replace('flex','hidden');
            input.value = '';
            renderUI();
        } else if (state.appPin && pin === state.appPin) {
            // legacy plaintext fallback (migration failed — data stays readable)
            document.getElementById('lock-screen').classList.replace('flex','hidden');
            input.value = '';
        } else {
            showToast('پین اشتباه است');
        }
    } catch (e) {
        showToast('پین اشتباه است');
    } finally {
        unlockBusy = false;
    }
}

/* GUIDE */
export function openGuideModal(){ document.getElementById('guide-modal').classList.replace('hidden','flex'); }
export function closeGuideModal(){ document.getElementById('guide-modal').classList.replace('flex','hidden'); }

/* SETTINGS */
export function openSettingsModal(){
    document.getElementById('user-name-setting').value = state.userName;
    // The PIN is never stored in readable form → cannot be pre-filled.
    document.getElementById('app-pin-setting').value = '';
    const removeBtn = document.getElementById('remove-pin-btn');
    if (removeBtn) removeBtn.classList.toggle('hidden', !vaultExists());
    document.getElementById('default-coffee-title').value = state.defaultTemplate.title || 'قهوه روزانه';
    document.getElementById('default-coffee-amount').value = state.defaultTemplate.amount || 70000;
    document.getElementById('settings-modal').classList.replace('hidden','flex');
}
export function closeSettingsModal(){ document.getElementById('settings-modal').classList.replace('flex','hidden'); }

export async function saveSettings(){
    const pinField = document.getElementById('app-pin-setting').value.trim();

    /* ── PIN transitions ── */
    try {
        if (vaultExists()) {
            if (!hasSession()) { showToast('نشست قفل است — دوباره وارد شوید'); return; }
            if (pinField) {
                await changePin(pinField, payloadFromState());   // verified re-encrypt
                clearStalePlaintextData();
                showToast('پین با رمزنگاری جدید ذخیره شد 🔐');
            }
            // empty field = keep current PIN (it is not stored, so no pre-fill)
        } else if (pinField) {
            // pinless → PIN: migrate plaintext data into the encrypted vault
            await createVault(pinField, payloadFromState());
            clearPlaintextData();                                // only after verify succeeded
            state.appPin = '';
            showToast('داده‌ها رمزنگاری و قفل شدند 🔐');
        }
    } catch (e) {
        console.error(e);
        showToast('خطا در رمزنگاری: داده‌ها دست‌نخورده ماندند');
        return;
    }

    /* ── regular settings ── */
    state.userName = document.getElementById('user-name-setting').value.trim() || 'کاربر عزیز';
    localStorage.setItem('poolham_username', state.userName);

    state.defaultTemplate.title = document.getElementById('default-coffee-title').value.trim() || 'قهوه روزانه';
    state.defaultTemplate.amount = Number(document.getElementById('default-coffee-amount').value) || 70000;

    await saveAll();   // persists template/… in the active mode (vault or plaintext)

    closeSettingsModal(); renderUI();
    if (!pinField || !vaultExists()) showToast('تغییرات ذخیره شد');
}

/* Remove the PIN: decrypt back to plaintext storage (explicit user action) */
export async function removePinFlow(){
    if (!vaultExists()) return;
    if (!confirm('با حذف پین، اطلاعات مالی شما به‌صورت متن ساده (بدون رمزنگاری) ذخیره می‌شود. ادامه می‌دهید؟')) return;
    if (!hasSession()) { showToast('نشست قفل است — دوباره وارد شوید'); return; }
    savePlaintextData();      // write readable copies back first
    destroyVault();           // then remove the encrypted vault
    state.appPin = '';
    localStorage.removeItem(LEGACY_PIN_KEY);
    renderUI();
    showToast('پین حذف شد — اطلاعات بدون رمزنگاری ذخیره می‌شود');
}

export function resetAllData(){ if(confirm('کل داده‌ها پاک شود؟')) { localStorage.clear(); location.reload(); } }

/* ─── BACKUP / RESTORE ───
 * PIN set  → backup is ENCRYPTED with the same AES-GCM model (preferred path).
 * No PIN   → plaintext JSON (legacy-compatible) with an explicit warning. */
export async function exportJSONBackup(){
    const prefs = { userName: state.userName, currentTheme: state.currentTheme, isDarkMode: state.isDarkMode };
    let content;
    if (vaultExists()) {
        content = await buildEncryptedBackup(prefs, payloadFromState());
    } else {
        if (!confirm('هشدار: این فایل بکاپ شامل اطلاعات مالی شما به‌صورت متنِ خوانا (بدون رمزنگاری) است.\nآن را در جای امنی نگه دارید. ادامه می‌دهید؟')) return;
        content = Object.assign({ format: 'poolham-backup', version: 1, encrypted: false, app: 'poolhamko', exportedAt: new Date().toISOString(), prefs }, payloadFromState(), { appPin: '' });
    }
    const b = new Blob([JSON.stringify(content, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `poolham-backup.json`; a.click();
}

export async function restoreJSONBackup(e){
    const r = new FileReader(); r.onload = function(evt){
        Promise.resolve(handleRestore(evt.target.result)).catch(err => {
            console.error(err);
            showToast(err && err.message === 'wrong-pin' ? 'پین بکاپ اشتباه است' : 'فایل نامعتبر');
        });
    }; r.readAsText(e.target.files[0]);
}

async function handleRestore(rawText){
    let d;
    try { d = JSON.parse(rawText); } catch { throw new Error('bad-file'); }
    if (!d || typeof d !== 'object') throw new Error('bad-file');

    const isNewFormat = d.format === 'poolham-backup';

    /* ── new encrypted backup ── */
    if (isNewFormat && d.encrypted) {
        const pin = prompt('این بکاپ رمزنگاری‌شده است. پینی که هنگام گرفتن بکاپ استفاده می‌شد را وارد کنید:');
        if (pin === null) return;
        const { payload, key, kdf } = await importEncryptedBackup(d, pin);  // throws wrong-pin
        applyPrefs(d.prefs);
        applyPayloadToState(payload);
        // adopt the backup envelope as the active vault (already verified by decrypt)
        adoptVault(d.vault, key, kdf);
        clearStalePlaintextData();
        saveAndRender(); closeSettingsModal(); showToast('بازیابی شد');
        return;
    }

    /* ── new plaintext backup (v1 pinless) or LEGACY flat backup — same shape ── */
    applyPrefs(d.prefs);
    if (d.userName) state.userName = d.userName;
    if(d.currentTheme) applyColorTheme(d.currentTheme, true);
    if(d.isDarkMode !== undefined) { state.isDarkMode = d.isDarkMode; localStorage.setItem('poolham_dark_mode', state.isDarkMode); applyDarkMode(true); }
    state.defaultTemplate = d.defaultTemplate || state.defaultTemplate;
    state.userCards = d.userCards || state.userCards;
    state.transactions=d.transactions||[]; state.debts=d.debts||[]; state.cheques=d.cheques||[]; state.birthdays=d.birthdays||[]; state.budgets=d.budgets||state.budgets;

    const legacyPin = (d.appPin || '').toString().trim();
    if (vaultExists()) {
        // vault stays as the storage mode; restored data is re-encrypted with it
        await saveAll();
    } else if (legacyPin) {
        // legacy backup had a PIN → keep the lock, but securely (vault, not plaintext pin)
        await createVault(legacyPin, payloadFromState());
        clearPlaintextData();
        state.appPin = '';
    } else {
        savePlaintextData();
    }
    saveAndRender(); closeSettingsModal(); showToast('بازیابی شد');
}

function applyPrefs(prefs) {
    if (!prefs) return;
    if (prefs.userName) state.userName = prefs.userName;
    if (prefs.currentTheme) applyColorTheme(prefs.currentTheme, true);
    if (prefs.isDarkMode !== undefined) { state.isDarkMode = prefs.isDarkMode; localStorage.setItem('poolham_dark_mode', state.isDarkMode); applyDarkMode(true); }
}

export function exportToCSV(){
    /* CSV is intentionally plaintext — but when the vault is active the user
     * must be warned that the export contains readable financial data (#6). */
    if (vaultExists() && !confirm('هشدار: فایل CSV شامل اطلاعات مالی شما به‌صورت متنِ خوانا (بدون رمزنگاری) است.\nآن را در جای امنی نگه دارید. ادامه می‌دهید؟')) return;
    // quote-doubling: a '"' inside any field must not break the CSV structure
    const cell = v => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    let csv = '\uFEFFعنوان,توضیحات,نوع,مبلغ,دسته‌بندی,کارت/حساب,تاریخ,ساعت\n';
    state.transactions.forEach(t=>{
        const cardObj = state.userCards.find(c => c.id === t.account);
        csv += `${cell(t.title)},${cell(t.description||'')},${cell(t.type==='income'?'درآمد':'هزینه')},${Number(t.amount)||0},${cell(t.category)},${cell(cardObj?cardObj.name:'')},${cell(t.date)},${cell(t.time||'')}\n`;
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download = `transactions.csv`; a.click();
}

/* Inline HTML handlers */
Object.assign(window, {
    applyColorTheme, toggleDarkMode, unlockApp,
    openGuideModal, closeGuideModal,
    openSettingsModal, closeSettingsModal, saveSettings, removePinFlow, resetAllData,
    exportJSONBackup, restoreJSONBackup, exportToCSV
});
