require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

const webAppUrl = 'https://amirazimi1380808-pixel.github.io/poolhamko';

/* ===================== دسته‌بندی‌ها ===================== */
const EXPENSE_CATS = ['کافه', 'خوراک و سوپرمارکت', 'حمل‌ونقل و تاکسی', 'ابزار و نرم‌افزار', 'آموزش و کتاب', 'سلامت و درمان', 'متفرقه'];
const INCOME_CATS = ['ترید و بازارهای مالی', 'حقوق و دستمزد', 'پروژه و فریلنس', 'سایر درآمدها'];

const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
const pad = (n) => String(n).padStart(2, '0');

/* ============ تبدیل تاریخ میلادی به شمسی ============ */
function gregorianToJalali(gy, gm, gd) {
    const g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = gy <= 1600 ? 0 : 979;
    gy -= gy <= 1600 ? 621 : 1600;
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
        + Math.floor((gy2 + 399) / 400) - 80 + gd + g[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
}

// امروز به وقت تهران (UTC+3:30)
function tehranNow() {
    return new Date(Date.now() + (3 * 60 + 30) * 60000);
}
function todayJalaliParts() {
    const t = tehranNow();
    return gregorianToJalali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function todayJalaliStr() {
    const [y, m, d] = todayJalaliParts();
    return `${y}-${pad(m)}-${pad(d)}`;
}
function jalaliMonthKey(offset = 0) {
    let [y, m] = todayJalaliParts();
    m -= offset;
    while (m < 1) { m += 12; y -= 1; }
    return `${y}-${pad(m)}`;
}
const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/* ===================== کمکی‌های دیتابیس ===================== */
async function ensureUser(msg) {
    const user = msg.from;
    const { error } = await supabase.from('users').upsert({
        id: user.id,
        first_name: user.first_name,
        username: user.username
    });
    if (error) console.error('ensureUser:', error.message);
    return user.id;
}

async function userExpenseCats(userId) {
    const { data } = await supabase.from('custom_categories')
        .select('name').eq('user_id', userId).eq('kind', 'expense');
    const custom = (data || []).map(r => r.name);
    return [...new Set([...EXPENSE_CATS, ...custom])];
}

function guessCategory(title) {
    const t = String(title);
    const rules = [
        [/قهوه|کافه|چای|اسپرسو|لاتته|موکا/, 'کافه'],
        [/بنزین|گاز|ماشین|تاکسی|اتوبوس|بلیط|مترو|اسنپ|پارکینگ|عوارض/, 'حمل‌ونقل و تاکسی'],
        [/نان|شیر|گوشت|مرغ|میوه|سوپر|مارکت|نانوایی|رستوران|پیتزا|غذا|ناهار|شام|صبحانه|خرید هفتگی/, 'خوراک و سوپرمارکت'],
        [/نرم|افزار|اپلیکیشن|اشتراک|هاست|دامنه|برنامه|گیم|استیم/, 'ابزار و نرم‌افزار'],
        [/کتاب|دوره|آموزش|کلاس|دانشگاه|مدرسه|تمرین/, 'آموزش و کتاب'],
        [/دارو|دکتر|درمان|بیمارستان|دندان|آزمایش|ویزیت/, 'سلامت و درمان'],
    ];
    for (const [re, cat] of rules) if (re.test(t)) return cat;
    return 'متفرقه';
}
const isIncomeText = (s) => /درآمد|حقوق|فروش|دریافت|سود|واریز شد|پرداخت شد/.test(s);
function guessIncomeCategory(title) {
    const t = String(title);
    if (/ترید|بازار|ارز|سهام|بیت|کریپتو|فارکس/.test(t)) return 'ترید و بازارهای مالی';
    if (/حقوق|دستمزد/.test(t)) return 'حقوق و دستمزد';
    if (/پروژه|فریلنس|سفارش/.test(t)) return 'پروژه و فریلنس';
    return 'سایر درآمدها';
}

async function categoryKeyboard(txId, currentCat, userId) {
    const cats = await userExpenseCats(userId);
    const row = (arr) => arr.map(name => ({
        text: (name === currentCat ? '✓ ' : '') + name,
        callback_data: `cat:${txId}:${name}`
    }));
    const rows = [];
    for (let i = 0; i < cats.length; i += 3) rows.push(row(cats.slice(i, i + 3)));
    return rows;
}

/* ===================== ثبت تراکنش ===================== */
async function insertTx(userId, { title, amount, type, category, photoFileId }) {
    const txId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const { error } = await supabase.from('transactions').insert([{
        id: txId,
        user_id: userId,
        title,
        amount,
        type,
        category,
        date: todayJalaliStr(),
        photo_file_id: photoFileId || null
    }]);
    if (error) { console.error('insert:', error.message); return { error }; }
    return { txId };
}

async function txConfirmMsg(chatId, userId, { title, amount, type, category, txId, photoFileId }) {
    const typeLabel = type === 'income' ? '🟢 درآمد' : '🔴 هزینه';
    const kb = [
        [{ text: 'مشاهده در اپلیکیشن 📊', web_app: { url: webAppUrl } }],
        ...(await categoryKeyboard(txId, category, userId)),
        [{ text: '− حذف این تراکنش', callback_data: `del:${txId}` }]
    ];
    const opts = { reply_markup: { inline_keyboard: kb } };
    if (photoFileId) opts.photo = photoFileId;
    const text = `✅ ثبت شد!\n\n${typeLabel}: ${fa(amount)} تومان\n📝 بابت: ${title}\n🏷 دسته: ${category}\n📅 تاریخ: ${todayJalaliStr().replace(/-/g, '/')}\n\nاگر دسته درست نیست از دکمه‌های پایین عوضش کن:`;
    if (photoFileId) await bot.sendPhoto(chatId, photoFileId, { caption: text, ...opts });
    else await bot.sendMessage(chatId, text, opts);
}

/* ===================== لیست و حذف ===================== */
async function showTransactionList(chatId, userId) {
    const { data, error } = await supabase.from('transactions')
        .select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(10);

    if (error || !data || !data.length) {
        await bot.sendMessage(chatId, '📭 تراکنشی برای نمایش نیست.');
        return;
    }
    let text = '📋 آخرین تراکنش‌ها (برای حذف دکمهٔ − را بزن):\n\n';
    const keyboard = [];
    data.forEach(t => {
        const sign = t.type === 'income' ? '🟢' : '🔴';
        text += `${sign} ${t.title} — ${fa(t.amount)} تومان [${t.category || 'بدون دسته'}]${t.photo_file_id ? ' 📷' : ''}\n`;
        keyboard.push([{ text: `− حذف: ${t.title} (${fa(t.amount)})`, callback_data: `del:${t.id}` }]);
    });
    keyboard.push([{ text: '🔄 به‌روزرسانی', callback_data: 'list' }]);
    await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

/* ===================== گزارش و تحلیل ===================== */
async function buildReport(userId) {
    const monthKey = jalaliMonthKey(0);
    const prevKey = jalaliMonthKey(1);
    const todayKey = todayJalaliStr();

    const { data: txs } = await supabase.from('transactions')
        .select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1000);

    const all = txs || [];
    const inMonth = (t, key) => String(t.date || '').startsWith(key);
    const monthTxs = all.filter(t => inMonth(t, monthKey));
    const prevTxs = all.filter(t => inMonth(t, prevKey));
    const todayTxs = all.filter(t => t.date === todayKey);

    const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount || 0), 0);
    const todayExp = sum(todayTxs, 'expense');
    const todayInc = sum(todayTxs, 'income');
    const monthExp = sum(monthTxs, 'expense');
    const prevExp = sum(prevTxs, 'expense');

    // برترین دسته‌ها
    const byCat = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
        const c = t.category || 'متفرقه';
        byCat[c] = (byCat[c] || 0) + Number(t.amount || 0);
    });
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // بزرگ‌ترین هزینه ماه
    const biggest = monthTxs.filter(t => t.type === 'expense')
        .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    // پرخرج‌ترین روز هفته (بر اساس ثبت در ۳۰ روز اخیر به وقت تهران)
    const dayCount = {};
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    all.forEach(t => {
        const ts = new Date(t.created_at).getTime();
        if (ts >= since && t.type === 'expense') {
            const wd = new Date(ts + (3.5 * 3600 * 1000)).getUTCDay();
            dayCount[wd] = (dayCount[wd] || 0) + 1;
        }
    });
    const busiest = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

    // مقایسه ماه
    let compareLine = '📊 مقایسه با ماه پیش: — (داده‌ای نیست)';
    if (prevExp > 0) {
        const diff = Math.round(((monthExp - prevExp) / prevExp) * 100);
        if (diff < 0) compareLine = `📊 نسبت به ماه پیش: ${fa(Math.abs(diff))}٪ کمتر خرج کردی 🎉`;
        else if (diff > 0) compareLine = `📊 نسبت به ماه پیش: ${fa(diff)}٪ بیشتر خرج کردی ⚠️`;
        else compareLine = '📊 نسبت به ماه پیش: بدون تغییر';
    }

    let text = `🌙 گزارش پول‌هام — ${todayJalaliStr().replace(/-/g, '/')}\n\n`;
    text += `📅 امروز:\n• 🔴 هزینه: ${fa(todayExp)} تومان\n• 🟢 درآمد: ${fa(todayInc)} تومان\n`;
    text += `📅 ماه جاری: ${fa(monthExp)} تومان هزینه\n${compareLine}\n\n`;

    if (topCats.length) {
        text += '🏆 برترین دسته‌های این ماه:\n';
        topCats.forEach(([c, v], i) => {
            const pct = monthExp ? Math.round((v / monthExp) * 100) : 0;
            text += `${i + 1}. ${c} — ${fa(v)} (${fa(pct)}٪)\n`;
        });
    }
    if (biggest) text += `\n💸 بزرگ‌ترین هزینه: ${biggest.title} (${fa(biggest.amount)})`;
    if (busiest) text += `\n💡 ${WEEKDAYS[busiest[0]]}ها پرترددترین روز ثبت هزینه‌هات بوده`;

    // بودجه‌ها
    const { data: budgetRows } = await supabase.from('budgets')
        .select('category, amount').eq('user_id', userId);
    const activeBudgets = (budgetRows || []).filter(b => Number(b.amount) > 0);
    if (activeBudgets.length) {
        text += '\n\n🏧 بودجه این ماه:\n';
        for (const b of activeBudgets) {
            const spent = monthTxs.filter(t => t.type === 'expense' && t.category === b.category)
                .reduce((s, t) => s + Number(t.amount || 0), 0);
            const left = Number(b.amount) - spent;
            const flag = left >= 0 ? '✅' : '❌';
            text += `${flag} ${b.category}: ${fa(spent)} از ${fa(b.amount)} ${left >= 0 ? `(مانده ${fa(left)})` : `(بیشتر ${fa(-left)})`}\n`;
        }
    }

    // یادآورهای نزدیک
    const todayStr = todayJalaliStr();
    const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const soonJ = gregorianToJalali(soon.getUTCFullYear(), soon.getUTCMonth() + 1, soon.getUTCDate());
    const soonStr = `${soonJ[0]}-${pad(soonJ[1])}-${pad(soonJ[2])}`;
    const { data: rems } = await supabase.from('reminders')
        .select('*').eq('user_id', userId).eq('settled', false);
    const near = (rems || []).filter(r => r.due_date >= todayStr && r.due_date <= soonStr);
    if (near.length) {
        text += '\n\n⏰ سررسیدهای نزدیک:\n';
        near.forEach(r => {
            text += `• ${r.title}${r.amount ? ` — ${fa(r.amount)} تومان` : ''} (${r.due_date.replace(/-/g, '/')})\n`;
        });
    }
    return text;
}

async function sendReport(chatId, userId) {
    const text = await buildReport(userId);
    await bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: [[{ text: '📊 در اپلیکیشن ببین', web_app: { url: webAppUrl } }]] }
    });
}

/* ===================== دستورات ===================== */
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await ensureUser(msg);
    bot.sendMessage(chatId, `سلام ${msg.from.first_name} عزیز! 👋\nبه پول‌هام هوشمند خوش آمدی.\n\n💸 ثبت سریع: «150 هزار بنزین»\n🟢 درآمد: /income 3000000 حقوق\n📊 گزارش: /report\n🔍 جست‌وجو: /search قهوه\n🏧 بودجه: /budget\n❓ راهنما: /help`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'باز کردن اپلیکیشن پول‌هام 💸', web_app: { url: webAppUrl } }],
                [{ text: '📊 گزارش امروز', callback_data: 'report' }, { text: '🏧 بودجه', callback_data: 'budget' }],
                [{ text: '🗑 لیست و حذف تراکنش‌ها', callback_data: 'list' }]
            ]
        }
    });
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📖 راهنمای ربات پول‌هام:\n\n` +
        `💸 ثبت هزینه:\n«150 هزار بنزین» یا «85000 ناهار»\n\n` +
        `🟢 ثبت درآمد:\n/income 3000000 حقوق\n\n` +
        `📊 گزارش روزانه، مقایسه ماه، بودجه و تحلیل:\n/report\n\n` +
        `🏧 وضعیت بودجه:\n/budget\n💳 تعیین بودجهٔ یک دسته:\n/budget غذا 3000 هزار\n\n` +
        `🔍 جست‌وجو در تراکنش‌ها:\n/search قهوه\n\n` +
        `🗑 لیست تراکنش‌ها برای حذف:\n/list\n\n` +
        `⏰ ثبت یادآور (چک/قسط):\n/remind 5000000 قسط ماشین 1404/08/15\n` +
        `📋 لیست یادآورها و تسویه:\n/reminders\n\n` +
        `📷 عکس فاکتور بفرست (با متن مبلغ) تا ثبت شود.\n\n` +
        `🌙 هر شب ساعت ۲۱ گزارش شبانه می‌گیری و ساعت ۹ صبح یادآورهات را یادآوری می‌کنم.`);
});

bot.onText(/\/report/, async (msg) => {
    const userId = await ensureUser(msg);
    await sendReport(msg.chat.id, userId);
});

async function budgetStatusText(userId) {
    const { data } = await supabase.from('budgets').select('category, amount').eq('user_id', userId);
    const rows = (data || []).filter(b => Number(b.amount) > 0);
    if (!rows.length) return null;
    const monthKey = jalaliMonthKey(0);
    const { data: txs } = await supabase.from('transactions')
        .select('category, amount, type').eq('user_id', userId).like('date', monthKey + '%');
    let text = '🏧 وضعیت بودجه این ماه:\n\n';
    rows.forEach(b => {
        const spent = (txs || []).filter(t => t.type === 'expense' && t.category === b.category)
            .reduce((s, t) => s + Number(t.amount || 0), 0);
        const pct = Number(b.amount) ? Math.min(999, Math.round((spent / Number(b.amount)) * 100)) : 0;
        const filled = Math.min(10, Math.round(pct / 10));
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        text += `${pct > 100 ? '❌' : '✅'} ${b.category}\n   ${bar} ${fa(pct)}٪ (${fa(spent)} از ${fa(b.amount)})\n`;
    });
    return text;
}

bot.onText(/\/budget(?:\s+(.+))?/, async (msg, match) => {
    const userId = await ensureUser(msg);
    const chatId = msg.chat.id;
    const rest = (match && match[1] || '').trim();

    if (rest) {
        const m = rest.match(/^(.+?)\s+(\d+)\s*(هزار|تومن|تومان)?$/);
        if (!m) {
            bot.sendMessage(chatId, '🏧 مثال:\n/budget غذا 3000 هزار\nیا: /budget کافه 1000000\n\nبرای دیدن وضعیت، بدون آرگومان بزن: /budget');
            return;
        }
        let amount = parseInt(m[2]);
        if ((m[3] || '').includes('هزار')) amount *= 1000;
        const category = m[1].trim();
        const { error } = await supabase.from('budgets')
            .upsert({ user_id: userId, category, amount }, { onConflict: 'user_id,category' });
        if (error) { bot.sendMessage(chatId, '❌ خطا: ' + error.message); return; }
        bot.sendMessage(chatId, `🏧 بودجه «${category}» روی ${fa(amount)} تومان تنظیم شد.\nبرای دیدن نوار پیشرفت: /budget`);
        return;
    }

    const text = await budgetStatusText(userId);
    bot.sendMessage(chatId, text || '🏧 هنوز بودجه‌ای ثبت نشده.\nمثال: /budget غذا 3000 هزار\nیا از داخل اپ ← بودجه‌بندی.');
});

bot.onText(/\/search(?:\s+(.+))?/, async (msg, match) => {
    const userId = await ensureUser(msg);
    const kw = (match && match[1] || '').trim();
    if (!kw) { bot.sendMessage(msg.chat.id, '🔍 مثال: /search قهوه'); return; }
    const { data } = await supabase.from('transactions')
        .select('*').eq('user_id', userId).ilike('title', `%${kw}%`)
        .order('created_at', { ascending: false }).limit(15);
    if (!data || !data.length) { bot.sendMessage(msg.chat.id, `📭 نتیجه‌ای برای «${kw}» پیدا نشد.`); return; }
    let text = `🔍 نتایج «${kw}»:\n\n`;
    const kb = [];
    data.forEach(t => {
        const sign = t.type === 'income' ? '🟢' : '🔴';
        text += `${sign} ${t.title} — ${fa(t.amount)} [${t.category || '—'}] (${String(t.date).replace(/-/g, '/')})\n`;
        kb.push([{ text: `− حذف: ${t.title}`, callback_data: `del:${t.id}` }]);
    });
    bot.sendMessage(msg.chat.id, text, kb.length ? { reply_markup: { inline_keyboard: kb } } : {});
});

bot.onText(/\/income(?:\s+(.+))?/, async (msg, match) => {
    const userId = await ensureUser(msg);
    const rest = (match && match[1] || '').trim();
    const m = rest.match(/^(\d+)\s*(هزار|تومن|تومان)?\s*(.*)$/);
    if (!m) { bot.sendMessage(msg.chat.id, '🟢 مثال: /income 3000000 حقوق\nیا: /income 500 هزار فروش'); return; }
    let amount = parseInt(m[1]);
    if ((m[2] || '').includes('هزار')) amount *= 1000;
    const title = (m[3] || 'درآمد').trim();
    const category = guessIncomeCategory(title);
    const r = await insertTx(userId, { title, amount, type: 'income', category });
    if (r.error) { bot.sendMessage(msg.chat.id, '❌ خطا: ' + r.error.message); return; }
    await txConfirmMsg(msg.chat.id, userId, { title, amount, type: 'income', category, txId: r.txId });
});

bot.onText(/\/list/, async (msg) => {
    const userId = await ensureUser(msg);
    await showTransactionList(msg.chat.id, userId);
});

/* ===================== یادآورها: لیست / ثبت / تسویه ===================== */
async function showReminders(chatId, userId) {
    const todayStr = todayJalaliStr();
    const { data, error } = await supabase.from('reminders')
        .select('*').eq('user_id', userId).eq('settled', false)
        .order('due_date', { ascending: true }).limit(12);
    if (error || !data || !data.length) {
        await bot.sendMessage(chatId, '⏰ یادآور فعالی نداری.\nمثال:\n/remind 5000000 قسط ماشین 1404/08/15');
        return;
    }
    let text = '⏰ یادآورهای فعال (چک / قسط):\n\n';
    const kb = [];
    data.forEach(r => {
        const overdue = String(r.due_date) < todayStr;
        text += `${overdue ? '🔴' : '🟡'} ${r.title}${r.amount ? ` — ${fa(r.amount)} تومان` : ''} (${r.due_date.replace(/-/g, '/')})${overdue ? ' سررسید گذشته!' : ''}\n`;
        kb.push([
            { text: `✅ تسویه: ${r.title}`, callback_data: `settle:${r.id}` },
            { text: '− حذف', callback_data: `rmdel:${r.id}` }
        ]);
    });
    await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: kb } });
}

async function createReminder(userId, chatId, rest) {
    const m = rest.match(/^(\d+)\s*(هزار|تومن|تومان|ریال)?\s+(.+?)\s+(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) {
        bot.sendMessage(chatId, '⏰ مثال:\n/remind 5000000 قسط ماشین 1404/08/15\nیا: /remind 5000 هزار قسط ماشین 1404/08/15\n\nبرای دیدن یادآورها: /reminders');
        return;
    }
    let amount = parseInt(m[1]);
    if ((m[2] || '').includes('هزار')) amount *= 1000;
    if (m[2] === 'ریال') amount = Math.round(amount / 10);
    const title = m[3].trim();
    const due = `${m[4]}-${pad(m[5])}-${pad(m[6])}`;
    const id = 'rm-' + Date.now();
    const { error } = await supabase.from('reminders').insert([{
        id, user_id: userId, title, amount, due_date: due, kind: 'cheque', settled: false
    }]);
    if (error) { bot.sendMessage(chatId, '❌ خطا: ' + error.message); return; }
    bot.sendMessage(chatId, `⏰ یادآور ثبت شد:\n📌 ${title} — ${fa(amount)} تومان\n📅 سررسید: ${due.replace(/-/g, '/')}\n\nتا سررسید بهت یادآوری می‌شود.\nلیست همه: /reminders`);
}

bot.onText(/^\/remind(?:ers?)?\s*(.*)$/i, async (msg, match) => {
    const userId = await ensureUser(msg);
    const rest = (match[1] || '').trim();
    if (!rest) { await showReminders(msg.chat.id, userId); return; }
    await createReminder(userId, msg.chat.id, rest);
});

/* ===================== پیام متنی (ثبت سریع) ===================== */
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text;
    const match = text.match(/(\d+)\s*(هزار|تومن|تومان|ریال)?\s+(.+)/);
    if (!match) {
        bot.sendMessage(chatId, 'متوجه نشدم! 🧐\nمثال: «150 هزار بنزین» یا /help برای راهنما');
        return;
    }
    let amount = parseInt(match[1]);
    const unit = match[2] || '';
    const title = match[3].trim();
    if (unit.includes('هزار')) amount *= 1000;
    if (unit === 'ریال') amount /= 10;

    const type = isIncomeText(title) ? 'income' : 'expense';
    const category = type === 'income' ? guessIncomeCategory(title) : guessCategory(title);
    const userId = await ensureUser(msg);

    const r = await insertTx(userId, { title, amount, type, category });
    if (r.error) { bot.sendMessage(chatId, '❌ خطا: ' + r.error.message); return; }
    await txConfirmMsg(chatId, userId, { title, amount, type, category, txId: r.txId });
});

/* ===================== عکس فاکتور ===================== */
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const caption = (msg.caption || '').trim();
    const match = caption.match(/(\d+)\s*(هزار|تومن|تومان|ریال)?\s+(.+)/);
    if (!match) {
        bot.sendMessage(chatId, '📷 عکس دریافت شد.\nبرای ثبت تراکنش، مبلغ و بابت را در کپشن بنویس:\nمثال: 150 هزار خرید سوپرمارکت');
        return;
    }
    let amount = parseInt(match[1]);
    const unit = match[2] || '';
    const title = match[3].trim();
    if (unit.includes('هزار')) amount *= 1000;
    if (unit === 'ریال') amount /= 10;

    const photo = msg.photo[msg.photo.length - 1];
    const type = isIncomeText(title) ? 'income' : 'expense';
    const category = type === 'income' ? guessIncomeCategory(title) : guessCategory(title);
    const userId = await ensureUser(msg);

    const r = await insertTx(userId, { title, amount, type, category, photoFileId: photo.file_id });
    if (r.error) { bot.sendMessage(chatId, '❌ خطا: ' + r.error.message); return; }
    await txConfirmMsg(chatId, userId, { title, amount, type, category, txId: r.txId, photoFileId: photo.file_id });
});

/* ===================== دکمه‌های شیشه‌ای ===================== */
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (data === 'list') {
        bot.answerCallbackQuery(query.id);
        await showTransactionList(chatId, userId);
        return;
    }
    if (data === 'report') {
        bot.answerCallbackQuery(query.id);
        await sendReport(chatId, userId);
        return;
    }
    if (data === 'budget') {
        bot.answerCallbackQuery(query.id);
        const text = await budgetStatusText(userId);
        await bot.sendMessage(chatId, text || '🏧 هنوز بودجه‌ای ثبت نشده.\nمثال: /budget غذا 3000 هزار');
        return;
    }

    if (data.startsWith('settle:')) {
        const remId = data.slice(7);
        const { error } = await supabase.from('reminders')
            .update({ settled: true }).eq('id', remId).eq('user_id', userId);
        bot.answerCallbackQuery(query.id, { text: error ? '❌ خطا' : '✅ تسویه شد' });
        if (!error) {
            await bot.editMessageText('✅ یادآور تسویه شد. لیست به‌روز:', {
                chat_id: chatId, message_id: query.message.message_id
            });
            await showReminders(chatId, userId);
        }
        return;
    }

    if (data.startsWith('rmdel:')) {
        const remId = data.slice(6);
        const { error } = await supabase.from('reminders')
            .delete().eq('id', remId).eq('user_id', userId);
        bot.answerCallbackQuery(query.id, { text: error ? '❌ خطا' : '✅ حذف شد' });
        if (!error) {
            await bot.editMessageText('🗑 یادآور حذف شد. لیست به‌روز:', {
                chat_id: chatId, message_id: query.message.message_id
            });
            await showReminders(chatId, userId);
        }
        return;
    }

    if (data.startsWith('del:')) {
        const txId = data.slice(4);
        const { error } = await supabase.from('transactions')
            .delete().eq('id', txId).eq('user_id', userId);
        bot.answerCallbackQuery(query.id, { text: error ? '❌ خطا در حذف' : '✅ حذف شد' });
        if (!error) {
            bot.editMessageText('✅ تراکنش حذف شد. لیست به‌روز:', {
                chat_id: chatId, message_id: query.message.message_id
            });
            await showTransactionList(chatId, userId);
        } else console.error('del:', error.message);
        return;
    }

    if (data.startsWith('cat:')) {
        const parts = data.split(':');
        const txId = parts[1];
        const catName = parts.slice(2).join(':');
        const { error } = await supabase.from('transactions')
            .update({ category: catName }).eq('id', txId).eq('user_id', userId);
        bot.answerCallbackQuery(query.id, { text: error ? '❌ خطا' : `🏷 دسته: ${catName}` });
        if (!error) {
            const msgText = query.message.text.replace(/🏷 دسته: .*/, `🏷 دسته: ${catName}`);
            bot.editMessageText(msgText, {
                chat_id: chatId, message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'مشاهده در اپلیکیشن 📊', web_app: { url: webAppUrl } }],
                        ...(await categoryKeyboard(txId, catName, userId)),
                        [{ text: '− حذف این تراکنش', callback_data: `del:${txId}` }]
                    ]
                }
            });
        } else console.error('cat:', error.message);
    }
});

/* ============ گزارش شبانه (هر شب ساعت ۲۱ تهران) + یادآورها (ساعت ۹) ============ */
const sentReports = new Set();   // "userId-YYYY-MM-DD-21"
const sentReminds = new Set();   // "userId-YYYY-MM-DD-9"

async function sendRemindersTo(userId) {
    const todayStr = todayJalaliStr();
    const t1 = new Date(Date.now() + 24 * 3600 * 1000);
    const j1 = gregorianToJalali(t1.getUTCFullYear(), t1.getUTCMonth() + 1, t1.getUTCDate());
    const tomorrow = `${j1[0]}-${pad(j1[1])}-${pad(j1[2])}`;
    const { data: rems } = await supabase.from('reminders')
        .select('*').eq('user_id', userId).eq('settled', false);
    const due = (rems || []).filter(r => r.due_date === todayStr || r.due_date === tomorrow);
    if (due.length) {
        let text = '⏰ یادآور پول‌هام:\n\n';
        due.forEach(r => {
            const when = r.due_date === todayStr ? 'امروز' : 'فردا';
            text += `📌 ${r.title}${r.amount ? ` — ${fa(r.amount)} تومان` : ''} (${when}، ${r.due_date.replace(/-/g, '/')})\n`;
        });
        await bot.sendMessage(userId, text);
    }
}

setInterval(async () => {
    const hour = tehranNow().getUTCHours();
    if (hour !== 9 && hour !== 21) return;

    const day = todayJalaliStr();
    const { data: users } = await supabase.from('users').select('id');
    for (const u of (users || [])) {
        const key = `${u.id}-${day}-${hour}`;
        const set = hour === 21 ? sentReports : sentReminds;
        if (set.has(key)) continue;
        set.add(key);
        try {
            if (hour === 21) await bot.sendMessage(u.id, await buildReport(u.id));
            else await sendRemindersTo(u.id);
        } catch (e) { console.error('timer:', e.message); }
    }
}, 60 * 1000);

console.log('🤖 ربات پول‌هام (نسخه ۲ — گزارش، بودجه، جست‌وجو، یادآور) روشن شد...');