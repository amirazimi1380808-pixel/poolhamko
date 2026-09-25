-- ===== نسخه ۲: قابلیت‌های جدید =====

-- دسته‌بندی‌های سفارشی کاربر
CREATE TABLE IF NOT EXISTS custom_categories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'expense',
    UNIQUE (user_id, name, kind)
);

-- بودجه ماهانه هر دسته
CREATE TABLE IF NOT EXISTS budgets (
    user_id BIGINT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    PRIMARY KEY (user_id, category)
);

-- یادآورها (چک و اقساط)
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC,
    due_date TEXT NOT NULL,      -- تاریخ شمسی YYYY-MM-DD
    kind TEXT NOT NULL DEFAULT 'cheque',
    settled BOOLEAN NOT NULL DEFAULT FALSE
);

-- ستون عکس برای تراکنش‌ها (فاکتور / چک)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS photo_file_id TEXT;

ALTER TABLE custom_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;
