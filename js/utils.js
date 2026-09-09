/* ─── Small shared helpers ───
 * Ported 1:1 from the original single-file implementation. */

export function formatNumber(num){ return Number(num || 0).toLocaleString('fa-IR'); }

export function getTodayISO(){ const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; }

export function parseDate(date){
    if(!date) return new Date();
    if(date.length === 10){ const p = date.split('-'); return new Date(Number(p[0]), Number(p[1])-1, Number(p[2])); }
    return new Date(date);
}

export function showToast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 2200); }

export function escapeHTML(v){ return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
