/**
 * Storage layer — SQLite backed via better-sqlite3.
 * Database file: <project-root>/data.db  (created automatically on first run)
 * Falls back to in-memory if SQLite fails (shouldn't happen).
 */
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import {
  FixedItem, InsertFixedItem,
  FoodSettings, InsertFoodSettings,
  Expense, InsertExpense,
  MonthSummary, InsertMonthSummary,
  AnnualSavings, InsertAnnualSavings,
  AnnualBigSpending, InsertAnnualBigSpending,
  GroceryItem, InsertGroceryItem,
} from "@shared/schema";

// Ensure the data directory exists
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data.db");
// Ensure the directory exists (important when DATABASE_PATH points to a mounted volume)
import * as fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ── Schema ─────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS fixed_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    effective_from TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS food_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    breakfast_cost REAL NOT NULL DEFAULT 40,
    lunch_cost REAL NOT NULL DEFAULT 75,
    days INTEGER NOT NULL DEFAULT 30,
    effective_from TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    date TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    is_food_delta INTEGER NOT NULL DEFAULT 0,
    food_type TEXT
  );

  CREATE TABLE IF NOT EXISTS month_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL UNIQUE,
    remaining_petty_cash REAL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS annual_savings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year TEXT NOT NULL UNIQUE,
    thirteenth_salary REAL NOT NULL DEFAULT 0,
    bonus REAL NOT NULL DEFAULT 0,
    regular_saving REAL NOT NULL DEFAULT 0,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS annual_big_spending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS grocery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    date TEXT NOT NULL,
    item TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Food',
    amount REAL NOT NULL
  );
`);

// ── Row mappers ────────────────────────────────────────────────────────────────
function toFixedItem(row: any): FixedItem {
  return { id: row.id, name: row.name, amount: row.amount, type: row.type, effectiveFrom: row.effective_from };
}
function toFoodSettings(row: any): FoodSettings {
  return { id: row.id, breakfastCost: row.breakfast_cost, lunchCost: row.lunch_cost, days: row.days, effectiveFrom: row.effective_from };
}
function toExpense(row: any): Expense {
  return { id: row.id, month: row.month, date: row.date, item: row.item, amount: row.amount, category: row.category, isFoodDelta: !!row.is_food_delta, foodType: row.food_type };
}
function toMonthSummary(row: any): MonthSummary {
  return { id: row.id, month: row.month, remainingPettyCash: row.remaining_petty_cash, note: row.note };
}
function toAnnualSavings(row: any): AnnualSavings {
  return { id: row.id, fiscalYear: row.fiscal_year, thirteenthSalary: row.thirteenth_salary, bonus: row.bonus, regularSaving: row.regular_saving, note: row.note };
}
function toAnnualBigSpending(row: any): AnnualBigSpending {
  return { id: row.id, fiscalYear: row.fiscal_year, item: row.item, amount: row.amount };
}
function toGroceryItem(row: any): GroceryItem {
  return { id: row.id, month: row.month, date: row.date, item: row.item, category: row.category, amount: row.amount };
}

// ── Storage implementation ─────────────────────────────────────────────────────
export interface IStorage {
  getFixedItems(): Promise<FixedItem[]>;
  upsertFixedItem(item: InsertFixedItem & { id?: number }): Promise<FixedItem>;
  deleteFixedItem(id: number): Promise<void>;
  getFoodSettings(): Promise<FoodSettings[]>;
  upsertFoodSettings(s: InsertFoodSettings & { id?: number }): Promise<FoodSettings>;
  getExpenses(month: string): Promise<Expense[]>;
  getAllExpenses(): Promise<Expense[]>;
  addExpense(e: InsertExpense): Promise<Expense>;
  updateExpense(id: number, e: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;
  getMonthSummary(month: string): Promise<MonthSummary | undefined>;
  getAllMonthSummaries(): Promise<MonthSummary[]>;
  upsertMonthSummary(s: InsertMonthSummary & { id?: number }): Promise<MonthSummary>;
  getAnnualSavings(fiscalYear: string): Promise<AnnualSavings | undefined>;
  getAllAnnualSavings(): Promise<AnnualSavings[]>;
  upsertAnnualSavings(s: InsertAnnualSavings & { id?: number }): Promise<AnnualSavings>;
  deleteAnnualSavings(fiscalYear: string): Promise<void>;
  getAllBigSpending(): Promise<AnnualBigSpending[]>;
  getBigSpending(fiscalYear: string): Promise<AnnualBigSpending[]>;
  addBigSpending(item: InsertAnnualBigSpending): Promise<AnnualBigSpending>;
  updateBigSpending(id: number, patch: Partial<Pick<AnnualBigSpending, "item" | "amount">>): Promise<AnnualBigSpending>;
  deleteBigSpending(id: number): Promise<void>;
  getGroceryItems(month: string): Promise<GroceryItem[]>;
  getAllGroceryItems(): Promise<GroceryItem[]>;
  addGroceryItem(item: InsertGroceryItem): Promise<GroceryItem>;
  updateGroceryItem(id: number, patch: Partial<Pick<GroceryItem, "date" | "item" | "category" | "amount">>): Promise<GroceryItem>;
  deleteGroceryItem(id: number): Promise<void>;
  // ── Import helpers ────────────────────────────────────────────────────────────
  deleteExpensesByMonth(month: string): Promise<void>;
  bulkAddExpenses(expenses: InsertExpense[]): Promise<void>;
}

class SQLiteStorage implements IStorage {
  // ── Fixed Items ──────────────────────────────────────────────────────────────
  async getFixedItems(): Promise<FixedItem[]> {
    return (db.prepare("SELECT * FROM fixed_items ORDER BY id").all() as any[]).map(toFixedItem);
  }
  async upsertFixedItem(item: InsertFixedItem & { id?: number }): Promise<FixedItem> {
    if (item.id) {
      db.prepare("UPDATE fixed_items SET name=?, amount=?, type=?, effective_from=? WHERE id=?")
        .run(item.name, item.amount, item.type, item.effectiveFrom, item.id);
      return toFixedItem(db.prepare("SELECT * FROM fixed_items WHERE id=?").get(item.id));
    }
    const info = db.prepare("INSERT INTO fixed_items (name, amount, type, effective_from) VALUES (?,?,?,?)")
      .run(item.name, item.amount, item.type, item.effectiveFrom);
    return toFixedItem(db.prepare("SELECT * FROM fixed_items WHERE id=?").get(info.lastInsertRowid));
  }
  async deleteFixedItem(id: number): Promise<void> {
    db.prepare("DELETE FROM fixed_items WHERE id=?").run(id);
  }

  // ── Food Settings ────────────────────────────────────────────────────────────
  async getFoodSettings(): Promise<FoodSettings[]> {
    return (db.prepare("SELECT * FROM food_settings ORDER BY effective_from DESC").all() as any[]).map(toFoodSettings);
  }
  async upsertFoodSettings(s: InsertFoodSettings & { id?: number }): Promise<FoodSettings> {
    if (s.id) {
      db.prepare("UPDATE food_settings SET breakfast_cost=?, lunch_cost=?, days=?, effective_from=? WHERE id=?")
        .run(s.breakfastCost, s.lunchCost, s.days, s.effectiveFrom, s.id);
      return toFoodSettings(db.prepare("SELECT * FROM food_settings WHERE id=?").get(s.id));
    }
    const info = db.prepare("INSERT INTO food_settings (breakfast_cost, lunch_cost, days, effective_from) VALUES (?,?,?,?)")
      .run(s.breakfastCost, s.lunchCost, s.days, s.effectiveFrom);
    return toFoodSettings(db.prepare("SELECT * FROM food_settings WHERE id=?").get(info.lastInsertRowid));
  }

  // ── Expenses ─────────────────────────────────────────────────────────────────
  async getExpenses(month: string): Promise<Expense[]> {
    return (db.prepare("SELECT * FROM expenses WHERE month=? ORDER BY date, id").all(month) as any[]).map(toExpense);
  }
  async getAllExpenses(): Promise<Expense[]> {
    return (db.prepare("SELECT * FROM expenses ORDER BY month, date, id").all() as any[]).map(toExpense);
  }
  async addExpense(e: InsertExpense): Promise<Expense> {
    const info = db.prepare(
      "INSERT INTO expenses (month, date, item, amount, category, is_food_delta, food_type) VALUES (?,?,?,?,?,?,?)"
    ).run(e.month, e.date, e.item, e.amount, e.category, e.isFoodDelta ? 1 : 0, e.foodType ?? null);
    return toExpense(db.prepare("SELECT * FROM expenses WHERE id=?").get(info.lastInsertRowid));
  }
  async updateExpense(id: number, e: Partial<InsertExpense>): Promise<Expense> {
    const existing = db.prepare("SELECT * FROM expenses WHERE id=?").get(id) as any;
    if (!existing) throw new Error(`Expense ${id} not found`);
    const merged = {
      month: e.month ?? existing.month,
      date: e.date ?? existing.date,
      item: e.item ?? existing.item,
      amount: e.amount ?? existing.amount,
      category: e.category ?? existing.category,
      isFoodDelta: e.isFoodDelta !== undefined ? (e.isFoodDelta ? 1 : 0) : existing.is_food_delta,
      foodType: e.foodType !== undefined ? e.foodType : existing.food_type,
    };
    db.prepare("UPDATE expenses SET month=?, date=?, item=?, amount=?, category=?, is_food_delta=?, food_type=? WHERE id=?")
      .run(merged.month, merged.date, merged.item, merged.amount, merged.category, merged.isFoodDelta, merged.foodType, id);
    return toExpense(db.prepare("SELECT * FROM expenses WHERE id=?").get(id));
  }
  async deleteExpense(id: number): Promise<void> {
    db.prepare("DELETE FROM expenses WHERE id=?").run(id);
  }

  // ── Month Summaries ──────────────────────────────────────────────────────────
  async getMonthSummary(month: string): Promise<MonthSummary | undefined> {
    const row = db.prepare("SELECT * FROM month_summaries WHERE month=?").get(month) as any;
    return row ? toMonthSummary(row) : undefined;
  }
  async getAllMonthSummaries(): Promise<MonthSummary[]> {
    return (db.prepare("SELECT * FROM month_summaries ORDER BY month").all() as any[]).map(toMonthSummary);
  }
  async upsertMonthSummary(s: InsertMonthSummary & { id?: number }): Promise<MonthSummary> {
    db.prepare("INSERT INTO month_summaries (month, remaining_petty_cash, note) VALUES (?,?,?) ON CONFLICT(month) DO UPDATE SET remaining_petty_cash=excluded.remaining_petty_cash, note=excluded.note")
      .run(s.month, s.remainingPettyCash ?? null, s.note ?? null);
    return toMonthSummary(db.prepare("SELECT * FROM month_summaries WHERE month=?").get(s.month));
  }

  // ── Annual Savings ───────────────────────────────────────────────────────────
  async getAnnualSavings(fiscalYear: string): Promise<AnnualSavings | undefined> {
    const row = db.prepare("SELECT * FROM annual_savings WHERE fiscal_year=?").get(fiscalYear) as any;
    return row ? toAnnualSavings(row) : undefined;
  }
  async getAllAnnualSavings(): Promise<AnnualSavings[]> {
    return (db.prepare("SELECT * FROM annual_savings ORDER BY fiscal_year DESC").all() as any[]).map(toAnnualSavings);
  }
  async upsertAnnualSavings(s: InsertAnnualSavings & { id?: number }): Promise<AnnualSavings> {
    db.prepare("INSERT INTO annual_savings (fiscal_year, thirteenth_salary, bonus, regular_saving, note) VALUES (?,?,?,?,?) ON CONFLICT(fiscal_year) DO UPDATE SET thirteenth_salary=excluded.thirteenth_salary, bonus=excluded.bonus, regular_saving=excluded.regular_saving, note=excluded.note")
      .run(s.fiscalYear, s.thirteenthSalary, s.bonus, s.regularSaving, s.note ?? null);
    return toAnnualSavings(db.prepare("SELECT * FROM annual_savings WHERE fiscal_year=?").get(s.fiscalYear));
  }
  async deleteAnnualSavings(fiscalYear: string): Promise<void> {
    db.prepare("DELETE FROM annual_savings WHERE fiscal_year=?").run(fiscalYear);
  }
  // ── Annual Big Spending ──────────────────────────────────────────────────────
  async getAllBigSpending(): Promise<AnnualBigSpending[]> {
    return (db.prepare("SELECT * FROM annual_big_spending ORDER BY fiscal_year, id").all() as any[]).map(toAnnualBigSpending);
  }
  async getBigSpending(fiscalYear: string): Promise<AnnualBigSpending[]> {
    return (db.prepare("SELECT * FROM annual_big_spending WHERE fiscal_year=? ORDER BY id").all(fiscalYear) as any[]).map(toAnnualBigSpending);
  }
  async addBigSpending(item: InsertAnnualBigSpending): Promise<AnnualBigSpending> {
    const result = db.prepare("INSERT INTO annual_big_spending (fiscal_year, item, amount) VALUES (?,?,?)").run(item.fiscalYear, item.item, item.amount);
    return toAnnualBigSpending(db.prepare("SELECT * FROM annual_big_spending WHERE id=?").get(result.lastInsertRowid));
  }
  async updateBigSpending(id: number, patch: Partial<Pick<AnnualBigSpending, "item" | "amount">>): Promise<AnnualBigSpending> {
    if (patch.item !== undefined) db.prepare("UPDATE annual_big_spending SET item=? WHERE id=?").run(patch.item, id);
    if (patch.amount !== undefined) db.prepare("UPDATE annual_big_spending SET amount=? WHERE id=?").run(patch.amount, id);
    return toAnnualBigSpending(db.prepare("SELECT * FROM annual_big_spending WHERE id=?").get(id));
  }
  async deleteBigSpending(id: number): Promise<void> {
    db.prepare("DELETE FROM annual_big_spending WHERE id=?").run(id);
  }

  // ── Grocery Items ─────────────────────────────────────────────────────────────
  async getGroceryItems(month: string): Promise<GroceryItem[]> {
    return (db.prepare("SELECT * FROM grocery_items WHERE month=? ORDER BY date, id").all(month) as any[]).map(toGroceryItem);
  }
  async getAllGroceryItems(): Promise<GroceryItem[]> {
    return (db.prepare("SELECT * FROM grocery_items ORDER BY month, date, id").all() as any[]).map(toGroceryItem);
  }
  async addGroceryItem(item: InsertGroceryItem): Promise<GroceryItem> {
    const info = db.prepare(
      "INSERT INTO grocery_items (month, date, item, category, amount) VALUES (?,?,?,?,?)"
    ).run(item.month, item.date, item.item, item.category, item.amount);
    return toGroceryItem(db.prepare("SELECT * FROM grocery_items WHERE id=?").get(info.lastInsertRowid));
  }
  async updateGroceryItem(id: number, patch: Partial<Pick<GroceryItem, "date" | "item" | "category" | "amount">>): Promise<GroceryItem> {
    const existing = db.prepare("SELECT * FROM grocery_items WHERE id=?").get(id) as any;
    if (!existing) throw new Error(`GroceryItem ${id} not found`);
    const merged = {
      date: patch.date ?? existing.date,
      item: patch.item !== undefined ? patch.item : existing.item,
      category: patch.category ?? existing.category,
      amount: patch.amount ?? existing.amount,
    };
    db.prepare("UPDATE grocery_items SET date=?, item=?, category=?, amount=? WHERE id=?")
      .run(merged.date, merged.item, merged.category, merged.amount, id);
    return toGroceryItem(db.prepare("SELECT * FROM grocery_items WHERE id=?").get(id));
  }
  async deleteGroceryItem(id: number): Promise<void> {
    db.prepare("DELETE FROM grocery_items WHERE id=?").run(id);
  }

  // ── Import helpers ────────────────────────────────────────────────────────────
  async deleteExpensesByMonth(month: string): Promise<void> {
    db.prepare("DELETE FROM expenses WHERE month=?").run(month);
  }
  async bulkAddExpenses(expenses: InsertExpense[]): Promise<void> {
    const stmt = db.prepare(
      "INSERT INTO expenses (month, date, item, amount, category, is_food_delta, food_type) VALUES (?,?,?,?,?,?,?)"
    );
    const insertMany = db.transaction((rows: InsertExpense[]) => {
      for (const e of rows) {
        stmt.run(e.month, e.date, e.item, e.amount, e.category, e.isFoodDelta ? 1 : 0, e.foodType ?? null);
      }
    });
    insertMany(expenses);
  }
}

export const storage = new SQLiteStorage();

// ── Seed initial data if DB is empty ──────────────────────────────────────────
const count = (db.prepare("SELECT COUNT(*) as c FROM fixed_items").get() as any).c;
if (count === 0) {
  seedInitialData();
}

function seedInitialData() {
  const incomeItems: InsertFixedItem[] = [
    { name: "Income", amount: 43811.1234, type: "income", effectiveFrom: "2025-04" },
    { name: "Baxter stock purchase", amount: 0, type: "income", effectiveFrom: "2025-04" },
    { name: "MPF", amount: -1500, type: "income", effectiveFrom: "2025-04" },
    { name: "Baxter Medical", amount: -144, type: "income", effectiveFrom: "2025-04" },
    { name: "Travel allowance", amount: 2100, type: "income", effectiveFrom: "2025-04" },
    { name: "Hardship allowance", amount: 1500, type: "income", effectiveFrom: "2025-04" },
    { name: "Leave pay", amount: 500, type: "income", effectiveFrom: "2025-04" },
    { name: "Saving", amount: -5000, type: "saving", effectiveFrom: "2025-04" },
    { name: "Carry over", amount: 0, type: "income", effectiveFrom: "2025-04" },
  ];
  const debitItems: InsertFixedItem[] = [
    { name: "Insurance", amount: 4000, type: "debit", effectiveFrom: "2025-04" },
    { name: "Travel (Citibank)", amount: 550, type: "debit", effectiveFrom: "2025-04" },
    { name: "Parents", amount: 0, type: "debit", effectiveFrom: "2025-04" },
    { name: "Internet and mobile", amount: 157, type: "debit", effectiveFrom: "2025-04" },
    { name: "Youtube premium", amount: 104, type: "debit", effectiveFrom: "2025-04" },
    { name: "Gas", amount: 350, type: "debit", effectiveFrom: "2025-04" },
    { name: "Water", amount: 400, type: "debit", effectiveFrom: "2025-04" },
    { name: "Electricity", amount: 750, type: "debit", effectiveFrom: "2025-04" },
    { name: "Mortgage", amount: 11623, type: "debit", effectiveFrom: "2025-04" },
    { name: "Land rent", amount: 800, type: "debit", effectiveFrom: "2025-04" },
    { name: "M fee", amount: 646, type: "debit", effectiveFrom: "2025-04" },
    { name: "Maid", amount: 4870, type: "debit", effectiveFrom: "2025-04" },
    { name: "Icloud", amount: 78, type: "debit", effectiveFrom: "2025-04" },
    { name: "Lok kindergarten fee", amount: 200, type: "debit", effectiveFrom: "2025-04" },
    { name: "Hair", amount: 75, type: "debit", effectiveFrom: "2025-04" },
    { name: "Storage", amount: 435, type: "debit", effectiveFrom: "2025-04" },
    { name: "Perplexity", amount: 128, type: "debit", effectiveFrom: "2025-04" },
  ];

  const stmt = db.prepare("INSERT INTO fixed_items (name, amount, type, effective_from) VALUES (?,?,?,?)");
  for (const item of [...incomeItems, ...debitItems]) {
    stmt.run(item.name, item.amount, item.type, item.effectiveFrom);
  }

  db.prepare("INSERT INTO food_settings (breakfast_cost, lunch_cost, days, effective_from) VALUES (?,?,?,?)")
    .run(40, 75, 30, "2025-04");

  // Seed Mar 2026 expenses from screenshot
  const expStmt = db.prepare("INSERT INTO expenses (month, date, item, amount, category, is_food_delta, food_type) VALUES (?,?,?,?,?,?,?)");
  const sampleExpenses = [
    ["2026-03", "2026-03-01", "Food delta", -115, "food", 1, null],
    ["2026-03", "2026-03-02", "Food delta", 98, "food", 1, null],
    ["2026-03", "2026-03-03", "Food delta", 155, "food", 1, null],
    ["2026-03", "2026-03-04", "Food delta", -75, "food", 1, null],
    ["2026-03", "2026-03-05", "Food delta", -75, "food", 1, null],
    ["2026-03", "2026-03-06", "Food delta", -80, "food", 1, null],
    ["2026-03", "2026-03-07", "Food delta", 369, "food", 1, null],
    ["2026-03", "2026-03-08", "Food delta", 32, "food", 1, null],
    ["2026-03", "2026-03-01", "Jolly Kingdom", 948, "shopping", 0, null],
    ["2026-03", "2026-03-02", "18\" monitor", 543, "shopping", 0, null],
    ["2026-03", "2026-03-03", "Likereal", 850, "shopping", 0, null],
    ["2026-03", "2026-03-04", "misc", 80, "shopping", 0, null],
    ["2026-03", "2026-03-05", "Taxi", 90, "shopping", 0, null],
    ["2026-03", "2026-03-06", "Lok Taewando", 400, "shopping", 0, null],
    ["2026-03", "2026-03-07", "wok and knife", 794, "shopping", 0, null],
    ["2026-03", "2026-03-08", "openrouter", 117, "shopping", 0, null],
    ["2026-03", "2026-03-01", "Grocery", 80, "grocery", 0, null],
  ];
  for (const e of sampleExpenses) {
    expStmt.run(...e);
  }

  db.prepare("INSERT INTO annual_savings (fiscal_year, thirteenth_salary, bonus, regular_saving, note) VALUES (?,?,?,?,?)")
    .run("2025-2026", 43811.1234, 145379, 60000, "Apr 2025 - Mar 2026");
}
