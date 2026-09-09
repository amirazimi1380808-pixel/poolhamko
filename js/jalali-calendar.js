/* ─── Jalali (Shamsi) calendar, Persian numerals & shared date helpers ───
 * Ported 1:1 from the original single-file implementation. */

export function toPersianNum(str) {
    if (str === null || str === undefined) return '';
    const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return String(str).replace(/[0-9]/g, function(w) { return persianDigits[w]; });
}

/* JALALI CONVERTER */
export function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + parseInt((gy2 + 3) / 4) - parseInt((gy2 + 99) / 100) + parseInt((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * parseInt(days / 12053);
    days %= 12053;
    jy += 4 * parseInt(days / 1461);
    days %= 1461;
    jy += parseInt((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
}

export function jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + ((parseInt(jy / 33)) * 8) + (parseInt(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * parseInt(days / 146097);
    days %= 146097;
    if (days > 36524) {
        gy += 100 * parseInt(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * parseInt(days / 1461);
    days %= 1461;
    gy += parseInt((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let gd = days + 1;
    let gm;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (gm = 0; gm < 13; gm++) {
        let v = sal_a[gm];
        if (gd <= v) break;
        gd -= v;
    }
    return [gy, gm, gd];
}

export const shamsiMonthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export function populateShamsiSelect(prefix, startYearOffset = -2, endYearOffset = 2) {
    const daySel = document.getElementById(`${prefix}-shamsi-day`);
    const monthSel = document.getElementById(`${prefix}-shamsi-month`);
    const yearSel = document.getElementById(`${prefix}-shamsi-year`);

    if(!daySel || !monthSel || !yearSel) return;

    daySel.innerHTML = '';
    for(let i = 1; i <= 31; i++) {
        daySel.innerHTML += `<option value="${i}">${toPersianNum(i)}</option>`;
    }

    monthSel.innerHTML = '';
    shamsiMonthNames.forEach((m, idx) => {
        monthSel.innerHTML += `<option value="${idx + 1}">${m}</option>`;
    });

    yearSel.innerHTML = '';
    const now = new Date();
    const [currY] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    for(let y = currY + startYearOffset; y <= currY + endYearOffset; y++) {
        yearSel.innerHTML += `<option value="${y}">${toPersianNum(y)}</option>`;
    }
}

export function setShamsiSelectValues(prefix, dateObj) {
    const [jy, jm, jd] = gregorianToJalali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
    const yEl = document.getElementById(`${prefix}-shamsi-year`);
    const mEl = document.getElementById(`${prefix}-shamsi-month`);
    const dEl = document.getElementById(`${prefix}-shamsi-day`);
    if(yEl && mEl && dEl) {
        yEl.value = jy;
        mEl.value = jm;
        dEl.value = jd;
    }
}

export function getShamsiISO(prefix) {
    const jy = Number(document.getElementById(`${prefix}-shamsi-year`).value);
    const jm = Number(document.getElementById(`${prefix}-shamsi-month`).value);
    const jd = Number(document.getElementById(`${prefix}-shamsi-day`).value);
    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

export function getCurrentTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function initAllShamsiSelectors() {
    populateShamsiSelect('trx', -2, 2);
    populateShamsiSelect('cheque', 0, 5);
    populateShamsiSelect('debt', -2, 2);
    populateShamsiSelect('bday', -80, 0);
}

export function toggleDatePickerMode() {
    const isGreg = document.getElementById('toggle-gregorian').checked;
    const shamsiContainer = document.getElementById('shamsi-picker-container');
    const gregContainer = document.getElementById('gregorian-picker-container');

    if (isGreg) {
        shamsiContainer.classList.add('hidden');
        gregContainer.classList.remove('hidden');
    } else {
        gregContainer.classList.add('hidden');
        shamsiContainer.classList.remove('hidden');
    }
}

/* Inline HTML handlers */
Object.assign(window, { toggleDatePickerMode });
