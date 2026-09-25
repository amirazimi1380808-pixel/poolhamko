require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);

// مینی‌اپ لینک (این لینک گیت‌هاب پیج توئه که اپلیکیشن روش سواره)
const webAppUrl = 'https://amirazimi1380808-pixel.github.io/poolhamko';

// ===== دسته‌بندی‌های هم‌سان با اپلیکیشن =====
const EXPENSE_CATS = ['کافه', 'خوراک و سوپرمارکت', 'حمل‌ونقل و تاکسی', 'ابزار و نرم‌افزار', 'آموزش و کتاب', 'سلامت و درمان', 'متفرقه'];
const INCOME_CATS = ['ترید و بازارهای مالی', 'حقوق و دستمزد', 'پروژه و فریلنس', 'سایر درآمدها'];

// حدس دسته از روی متن
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

// تشخیص درآمد از متن
function isIncomeText(text) {
    return /درآمد|حقوق|فروش|دریافت|سود|پرداخت شد|واریز شد/.test(text);
}

function guessIncomeCategory(title) {
    const t = String(title);
    if (/ترید|بازار|ارز|سهام|بیت|کریپتو|فارکس/.test(t)) return 'ترید و بازارهای مالی';
    if (/حقوق|دستمزد/.test(t)) return 'حقوق و دستمزد';
    if (/پروژه|فریلنس|سفارش|پروژه/.test(t)) return 'پروژه و فریلنس';
    return 'سایر درآمدها';
}

// ردیف‌های دکمه‌های دسته‌بندی برای ثبت/ویرایش
function categoryKeyboard(txId, currentCat) {
    const row = (arr) => arr.map(name => ({
        text: (name === currentCat ? '✓ ' : '') + name,
        callback_data: `cat:${txId}:${name}`
    }));
    return [
        row(EXPENSE_CATS.slice(0, 3)),
        row(EXPENSE_CATS.slice(3, 6)),
        row([EXPENSE_CATS[6]]),
    ];
}

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;

    // ذخیره یا آپدیت کاربر در دیتابیس
    await supabase.from('users').upsert({
        id: user.id,
        first_name: user.first_name,
        username: user.username
    });

    bot.sendMessage(chatId, `سلام ${user.first_name} عزیز! 👋\nبه ربات هوشمند پول‌هام خوش آمدی.\n\nمی‌توانی هزینه‌ها و درآمدهایت را همینجا تایپ کنی (مثلاً بنویس: "۵۰ هزار تومن قهوه") یا دکمهٔ زیر را بزنی تا وارد اپلیکیشن گرافیکی شوی و حساب‌هایت را مدیریت کنی 👇`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'باز کردن اپلیکیشن پول‌هام 💸', web_app: { url: webAppUrl } }],
                [{ text: '🗑 لیست و حذف تراکنش‌ها', callback_data: 'list' }]
            ]
        }
    });
});

// نمایش لیست تراکنش‌ها با دکمه حذف (− قرمز)
async function showTransactionList(chatId, userId) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !data || !data.length) {
        bot.sendMessage(chatId, '📭 تراکنشی برای نمایش نیست.');
        return;
    }

    let text = '📋 آخرین تراکنش‌ها (برای حذف، دکمهٔ − کنار هر مورد را بزن):\n\n';
    const keyboard = [];

    data.forEach(t => {
        const sign = t.type === 'income' ? '🟢' : '🔴';
        text += `${sign} ${t.title} — ${Number(t.amount).toLocaleString()} تومان [${t.category || 'بدون دسته'}]\n`;
        keyboard.push([{ text: `− حذف: ${t.title} (${Number(t.amount).toLocaleString()})`, callback_data: `del:${t.id}` }]);
    });

    keyboard.push([{ text: '🔄 به‌روزرسانی', callback_data: 'list' }]);

    bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
}

// مدیریت دکمه‌های شیشه‌ای (حذف و لیست)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (data === 'list') {
        bot.answerCallbackQuery(query.id);
        await showTransactionList(chatId, userId);
        return;
    }

    if (data.startsWith('del:')) {
        const txId = data.slice(4);
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', txId)
            .eq('user_id', userId); // فقط تراکنش‌های خود کاربر

        bot.answerCallbackQuery(query.id, { text: error ? '❌ خطا در حذف' : '✅ حذف شد' });
        if (error) {
            console.error('delete error:', error.message);
        } else {
            // پیام لیست را با لیست تازه جایگزین کن
            bot.editMessageText('✅ تراکنش حذف شد. لیست به‌روز:', {
                chat_id: chatId,
                message_id: query.message.message_id
            });
            await showTransactionList(chatId, userId);
        }
    }

    // تغییر دسته‌بندی تراکنش
    if (data.startsWith('cat:')) {
        const parts = data.split(':');
        const txId = parts[1];
        const catName = parts.slice(2).join(':'); // نام دسته ممکن است دو بخشی باشد

        const { error } = await supabase
            .from('transactions')
            .update({ category: catName })
            .eq('id', txId)
            .eq('user_id', userId);

        bot.answerCallbackQuery(query.id, { text: error ? '❌ خطا' : `🏷 دسته: ${catName}` });
        if (error) {
            console.error('cat error:', error.message);
        } else {
            // دکمه‌های پیام را با علامت ✓ جدید به‌روز کن
            const msgText = query.message.text.replace(/🏷 دسته: .*/, `🏷 دسته: ${catName}`);
            bot.editMessageText(msgText, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'مشاهده در اپلیکیشن 📊', web_app: { url: webAppUrl } }],
                        ...categoryKeyboard(txId, catName),
                        [{ text: '− حذف این تراکنش', callback_data: `del:${txId}` }]
                    ]
                }
            });
        }
    }
});

// اطمینان از وجود کاربر در دیتابیس (قبل از هر تراکنشی صدا زده می‌شود)
async function ensureUser(msg) {
    const user = msg.from;
    const { error } = await supabase.from('users').upsert({
        id: user.id,
        first_name: user.first_name,
        username: user.username
    });
    if (error) console.error('ensureUser error:', error.message);
    return user.id;
}

// دستور /list — نمایش لیست تراکنش‌ها برای حذف
bot.onText(/\/list/, async (msg) => {
    const userId = msg.from.id;
    await ensureUser(msg);
    await showTransactionList(msg.chat.id, userId);
});

// پردازش پیام‌های متنی برای ثبت سریع تراکنش (مثلا: 50 هزار قهوه)
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const text = msg.text;

        // یک پردازش متن خیلی ساده (با هوش مصنوعی هم میشه پیشرفته‌اش کرد)
        // فرمت فرض شده: [مبلغ] [هزار/تومن/ریال] [بابت]
        const amountRegex = /(\d+)\s*(هزار|تومن|تومان|ریال)?\s+(.+)/;
        const match = text.match(amountRegex);

        if (match) {
            let amount = parseInt(match[1]);
            const unit = match[2] || '';
            const title = match[3].trim();

            if (unit.includes('هزار')) amount *= 1000;
            if (unit === 'ریال') amount /= 10; // تبدیل به تومان

            // تشخیص نوع (درآمد/هزینه) و دسته از روی متن
            const type = isIncomeText(title) ? 'income' : 'expense';
            const category = type === 'income' ? guessIncomeCategory(title) : guessCategory(title);

            // اول اطمینان از ثبت کاربر، بعد ثبت تراکنش
            const userId = await ensureUser(msg);

            // تولید آیدی منحصر‌به‌فرد شبیه چیزی که تو خود اپلیکیشن داری
            const txId = 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const today = new Date().toLocaleDateString('en-CA'); // فرمت YYYY-MM-DD

            const { data, error } = await supabase
                .from('transactions')
                .insert([{
                    id: txId,
                    user_id: userId,
                    title: title,
                    amount: amount,
                    type: type,
                    category: category,
                    date: today
                }]);

            if (error) {
                console.error('insert error:', error.message, JSON.stringify(error));
                bot.sendMessage(chatId, '❌ خطا: ' + error.message);
            } else {
                const typeLabel = type === 'income' ? '🟢 درآمد' : '🔴 هزینه';
                bot.sendMessage(chatId, `✅ ثبت شد!\n\n${typeLabel}: ${amount.toLocaleString()} تومان\n📝 بابت: ${title}\n🏷 دسته: ${category}\n📅 تاریخ: امروز\n\nاگر دسته درست نبود، از دکمه‌های پایین عوضش کن:`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'مشاهده در اپلیکیشن 📊', web_app: { url: webAppUrl } }],
                            ...categoryKeyboard(txId, category),
                            [{ text: '− حذف این تراکنش', callback_data: `del:${txId}` }]
                        ]
                    }
                });
            }
        } else {
            bot.sendMessage(chatId, 'متوجه نشدم! 🧐\nلطفاً با این فرمت بنویس: "مبلغ [تومان/هزار] بابت"\nمثال: ۵۰ هزار بنزین');
        }
    }
});

console.log('🤖 ربات پول‌هام روشن شد و در حال گوش دادن است...');