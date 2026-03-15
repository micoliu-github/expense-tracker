import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertFixedItemSchema, insertFoodSettingsSchema, insertExpenseSchema, insertMonthSummarySchema, insertAnnualSavingsSchema } from "@shared/schema";
import * as XLSX from "xlsx";
import multer from "multer";
import { getAuthUrl, exchangeCode, isAuthenticated, revokeToken } from "./googleAuth";
import { syncMonthToSheets } from "./sheetsSync";
import type { InsertExpense } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Fixed Items ──────────────────────────────────────────────────────────────
  app.get("/api/fixed-items", async (_req, res) => {
    res.json(await storage.getFixedItems());
  });
  app.post("/api/fixed-items", async (req, res) => {
    const parsed = insertFixedItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertFixedItem(parsed.data));
  });
  app.put("/api/fixed-items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const parsed = insertFixedItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertFixedItem({ ...parsed.data, id }));
  });
  app.delete("/api/fixed-items/:id", async (req, res) => {
    await storage.deleteFixedItem(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Food Settings ────────────────────────────────────────────────────────────
  app.get("/api/food-settings", async (_req, res) => {
    res.json(await storage.getFoodSettings());
  });
  app.post("/api/food-settings", async (req, res) => {
    const parsed = insertFoodSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertFoodSettings(parsed.data));
  });
  app.put("/api/food-settings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const parsed = insertFoodSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertFoodSettings({ ...parsed.data, id }));
  });

  // ── Expenses ─────────────────────────────────────────────────────────────────
  app.get("/api/expenses", async (req, res) => {
    const { month } = req.query;
    if (month && typeof month === "string") {
      res.json(await storage.getExpenses(month));
    } else {
      res.json(await storage.getAllExpenses());
    }
  });
  app.post("/api/expenses", async (req, res) => {
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.addExpense(parsed.data));
  });
  app.put("/api/expenses/:id", async (req, res) => {
    res.json(await storage.updateExpense(parseInt(req.params.id), req.body));
  });
  app.delete("/api/expenses/:id", async (req, res) => {
    await storage.deleteExpense(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Month Summaries ──────────────────────────────────────────────────────────
  app.get("/api/month-summaries", async (_req, res) => {
    res.json(await storage.getAllMonthSummaries());
  });
  app.get("/api/month-summaries/:month", async (req, res) => {
    const s = await storage.getMonthSummary(req.params.month);
    res.json(s ?? null);
  });
  app.post("/api/month-summaries", async (req, res) => {
    const parsed = insertMonthSummarySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertMonthSummary(parsed.data));
  });

  // ── Annual Savings ───────────────────────────────────────────────────────────
  app.get("/api/annual-savings", async (_req, res) => {
    res.json(await storage.getAllAnnualSavings());
  });
  app.get("/api/annual-savings/:year", async (req, res) => {
    res.json((await storage.getAnnualSavings(req.params.year)) ?? null);
  });
  app.post("/api/annual-savings", async (req, res) => {
    const parsed = insertAnnualSavingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertAnnualSavings(parsed.data));
  });
  app.put("/api/annual-savings/:year", async (req, res) => {
    const existing = await storage.getAnnualSavings(req.params.year);
    const parsed = insertAnnualSavingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.upsertAnnualSavings({ ...parsed.data, id: existing?.id }));
  });
  app.delete("/api/annual-savings/:year", async (req, res) => {
    await storage.deleteAnnualSavings(req.params.year);
    res.json({ ok: true });
  });

  // ── Annual Big Spending ──────────────────────────────────────────────────────
  // Must be before /:year so it isn't captured as a year param
  app.get("/api/big-spending/all", async (_req, res) => {
    res.json(await storage.getAllBigSpending());
  });
  app.get("/api/big-spending/:year", async (req, res) => {
    res.json(await storage.getBigSpending(req.params.year));
  });
  app.post("/api/big-spending", async (req, res) => {
    const { fiscalYear, item, amount } = req.body;
    if (!fiscalYear || !item || amount == null) return res.status(400).json({ error: "Missing fields" });
    res.json(await storage.addBigSpending({ fiscalYear, item, amount: parseFloat(amount) }));
  });
  app.put("/api/big-spending/:id", async (req, res) => {
    const { item, amount } = req.body;
    res.json(await storage.updateBigSpending(parseInt(req.params.id), { item, amount: amount != null ? parseFloat(amount) : undefined }));
  });
  app.delete("/api/big-spending/:id", async (req, res) => {
    await storage.deleteBigSpending(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Grocery Items ─────────────────────────────────────────────────────────────
  app.get("/api/grocery", async (req, res) => {
    const { month } = req.query;
    if (month && typeof month === "string") {
      res.json(await storage.getGroceryItems(month));
    } else {
      res.json(await storage.getAllGroceryItems());
    }
  });
  app.post("/api/grocery", async (req, res) => {
    const { month, date, item, category, amount } = req.body;
    if (!month || !date || amount == null) return res.status(400).json({ error: "Missing required fields: month, date, amount" });
    res.json(await storage.addGroceryItem({
      month,
      date,
      item: item ?? "",
      category: category ?? "Food",
      amount: parseFloat(amount),
    }));
  });
  app.put("/api/grocery/:id", async (req, res) => {
    const { date, item, category, amount } = req.body;
    res.json(await storage.updateGroceryItem(parseInt(req.params.id), {
      date,
      item,
      category,
      amount: amount != null ? parseFloat(amount) : undefined,
    }));
  });
  app.delete("/api/grocery/:id", async (req, res) => {
    await storage.deleteGroceryItem(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── XLSX Import ───────────────────────────────────────────────────────────────
  // POST /api/import/preview  — parse file, return what will be imported, list conflict months
  app.post("/api/import/preview", upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      // Debug: log raw sheet names with char codes so we can diagnose encoding issues
      const rawNames = wb.SheetNames.map((n: string) => ({
        name: n,
        codes: [...n].map(c => c.charCodeAt(0)),
      }));
      console.log("[import] raw sheet names:", JSON.stringify(rawNames));

      const parsed = parseWorkbook(wb);
      // Check which months already have data
      const conflicts: string[] = [];
      for (const month of Object.keys(parsed)) {
        const existing = await storage.getExpenses(month);
        if (existing.length > 0) conflicts.push(month);
      }
      // Build summary for preview
      const summary = Object.entries(parsed).map(([month, rows]) => ({
        month,
        food: rows.filter(r => r.category === "food").length,
        shopping: rows.filter(r => r.category === "shopping").length,
        grocery: rows.filter(r => r.category === "grocery").length,
        total: rows.length,
        hasConflict: conflicts.includes(month),
      }));

      if (summary.length === 0) {
        // Return raw sheet names in error so user can see what was found
        const foundNames = wb.SheetNames.join(", ") || "(none)";
        return res.json({
          summary: [],
          conflicts: [],
          totalSheets: 0,
          debugSheetNames: wb.SheetNames,
        });
      }

      res.json({ summary, conflicts, totalSheets: summary.length });
    } catch (err: any) {
      res.status(400).json({ error: "Failed to parse XLSX: " + err.message });
    }
  });

  // POST /api/import/commit  — actually write to DB (overwrite=true|false per month)
  app.post("/api/import/commit", upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    // overwriteMonths is a JSON array of month strings the user confirmed to overwrite
    let overwriteMonths: string[] = [];
    try { overwriteMonths = JSON.parse(req.body.overwriteMonths ?? "[]"); } catch {}
    let skipMonths: string[] = [];
    try { skipMonths = JSON.parse(req.body.skipMonths ?? "[]"); } catch {}

    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const parsed = parseWorkbook(wb);
      const results: Record<string, { imported: number; skipped: boolean; overwritten: boolean }> = {};

      for (const [month, rows] of Object.entries(parsed)) {
        const existing = await storage.getExpenses(month);
        const hasConflict = existing.length > 0;

        if (hasConflict && skipMonths.includes(month)) {
          results[month] = { imported: 0, skipped: true, overwritten: false };
          continue;
        }
        if (hasConflict && !overwriteMonths.includes(month)) {
          // Not told what to do — skip for safety
          results[month] = { imported: 0, skipped: true, overwritten: false };
          continue;
        }
        if (hasConflict && overwriteMonths.includes(month)) {
          await storage.deleteExpensesByMonth(month);
        }
        await storage.bulkAddExpenses(rows);
        results[month] = { imported: rows.length, skipped: false, overwritten: hasConflict };
      }

      // Invalidate month summaries (petty cash) for imported months so auto-sync re-fires on next visit
      res.json({ ok: true, results });
    } catch (err: any) {
      res.status(400).json({ error: "Import failed: " + err.message });
    }
  });

  // ── Export to Google Sheets (XLSX download) ──────────────────────────────────────────────
  app.get("/api/export/xlsx/:month", async (req, res) => {
    const { month } = req.params;
    const wb = await buildWorkbook(month);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Expense_${month}.xlsx"`);
    res.send(buf);
  });

  // Export full workbook (all months)
  app.get("/api/export/xlsx", async (_req, res) => {
    const allExpenses = await storage.getAllExpenses();
    const months = [...new Set(allExpenses.map(e => e.month))].sort();
    const wb = XLSX.utils.book_new();
    for (const month of months) {
      await addSheetToWorkbook(wb, month);
    }
    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["No data yet"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Info");
    }
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Household_Monthly_Expense.xlsx"`);
    res.send(buf);
  });


  // ── Google Auth ───────────────────────────────────────────────────────────────
  // Check auth status
  app.get("/api/google/status", (_req, res) => {
    res.json({ authenticated: isAuthenticated() });
  });

  // Redirect user to Google consent screen
  app.get("/api/google/auth", (_req, res) => {
    res.json({ url: getAuthUrl() });
  });

  // OAuth2 callback — Google redirects here with ?code=...
  app.get("/oauth2callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing code");
    try {
      await exchangeCode(code);
      res.send(`
        <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0">
          <div style="text-align:center">
            <div style="font-size:48px;margin-bottom:16px">✓</div>
            <h2 style="color:#34d399;margin-bottom:8px">Connected to Google Sheets!</h2>
            <p style="color:#94a3b8">You can close this tab and return to the app.</p>
          </div>
        </body></html>
      `);
    } catch (err: any) {
      res.status(500).send("Auth failed: " + err.message);
    }
  });

  // Disconnect Google
  app.post("/api/google/disconnect", (_req, res) => {
    revokeToken();
    res.json({ ok: true });
  });

  // ── Google Sheets Sync ────────────────────────────────────────────────────────
  app.post("/api/google/sync/:month", async (req, res) => {
    const { month } = req.params;
    const [allFixed, foodSettingsList, expenses] = await Promise.all([
      storage.getFixedItems(),
      storage.getFoodSettings(),
      storage.getExpenses(month),
    ]);
    const result = await syncMonthToSheets(month, allFixed, foodSettingsList, expenses);
    res.json(result);
  });

  // Sync all months that have expense data
  app.post("/api/google/sync-all", async (_req, res) => {
    const allExpenses = await storage.getAllExpenses();
    const months = [...new Set(allExpenses.map(e => e.month))].sort();
    const [allFixed, foodSettingsList] = await Promise.all([
      storage.getFixedItems(),
      storage.getFoodSettings(),
    ]);
    const results: Record<string, any> = {};
    for (const month of months) {
      const expenses = await storage.getExpenses(month);
      results[month] = await syncMonthToSheets(month, allFixed, foodSettingsList, expenses);
    }
    res.json({ results });
  });

  return httpServer;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function buildWorkbook(month: string) {
  const wb = XLSX.utils.book_new();
  await addSheetToWorkbook(wb, month);
  return wb;
}

async function addSheetToWorkbook(wb: any, month: string) {
  const allFixed = await storage.getFixedItems();
  const foodSettingsList = await storage.getFoodSettings();
  const expenses = await storage.getExpenses(month);

  // Get food settings effective for this month
  const effectiveFoodSettings = getEffective(foodSettingsList, month) ?? {
    breakfastCost: 40, lunchCost: 75, days: 30,
  };

  // Get fixed items effective for this month
  const incomeItems = getEffectiveItems(allFixed.filter(f => f.type === "income" || f.type === "saving"), month);
  const debitItems = getEffectiveItems(allFixed.filter(f => f.type === "debit"), month);

  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
  const totalDebit = debitItems.reduce((s, i) => s + i.amount, 0);
  const foodMonthly = effectiveFoodSettings.breakfastCost * effectiveFoodSettings.days +
    effectiveFoodSettings.lunchCost * effectiveFoodSettings.days;
  const pettyCash = totalIncome - totalDebit - foodMonthly;

  const foodExpenses = expenses.filter(e => e.category === "food");
  const shoppingExpenses = expenses.filter(e => e.category === "shopping");
  const groceryExpenses = expenses.filter(e => e.category === "grocery");

  const foodTotal = foodExpenses.reduce((s, e) => s + e.amount, 0);
  const shoppingTotal = shoppingExpenses.reduce((s, e) => s + e.amount, 0);
  const groceryTotal = groceryExpenses.reduce((s, e) => s + e.amount, 0);
  const remaining = pettyCash - shoppingTotal - groceryTotal - foodTotal;

  const monthLabel = formatMonthLabel(month);
  const rows: any[][] = [];

  // Header row
  rows.push([monthLabel, "", "Credit", "", "Debit", "", "", "Food", "Days", "Per cost", "Monthly"]);
  rows.push(["", "Income", totalIncome.toFixed(2), "", "", "", "", ""]);

  // Side-by-side income/debit + food settings
  const maxRows = Math.max(incomeItems.length, debitItems.length, 3);
  for (let i = 0; i < maxRows; i++) {
    const inc = incomeItems[i];
    const deb = debitItems[i];
    const row: any[] = [
      "", inc ? inc.name : "", inc ? inc.amount : "",
      "", deb ? deb.name : "", deb ? deb.amount : "",
      "", "", "", "", "",
    ];
    if (i === 0) { row[7] = "Breakfast"; row[8] = effectiveFoodSettings.days; row[9] = effectiveFoodSettings.breakfastCost; row[10] = effectiveFoodSettings.breakfastCost * effectiveFoodSettings.days; }
    if (i === 1) { row[7] = "Lunch"; row[8] = effectiveFoodSettings.days; row[9] = effectiveFoodSettings.lunchCost; row[10] = effectiveFoodSettings.lunchCost * effectiveFoodSettings.days; }
    if (i === 2) { row[7] = ""; row[8] = ""; row[9] = "Monthly cost"; row[10] = foodMonthly; }
    rows.push(row);
  }

  rows.push([]);
  rows.push(["", "Total Credit", totalIncome.toFixed(2), "", "Total Debit", totalDebit.toFixed(2), "", "Food + Petty", pettyCash.toFixed(2)]);
  rows.push([]);
  rows.push(["", "Petty Cash Remaining", remaining.toFixed(2)]);
  rows.push(["", "Extra money on food", foodTotal.toFixed(2)]);
  rows.push([]);

  // Expense columns: Date | Food | Date | Shopping | Date | Grocery
  rows.push(["Date", "Food", "Date", "Shopping (Petty Cash)", "Date", "Grocery"]);

  const maxExp = Math.max(foodExpenses.length, shoppingExpenses.length, groceryExpenses.length);
  for (let i = 0; i < maxExp; i++) {
    const f = foodExpenses[i];
    const sh = shoppingExpenses[i];
    const gr = groceryExpenses[i];
    rows.push([
      f ? f.date : "", f ? f.amount : "",
      sh ? sh.date : "", sh ? sh.item : "", sh ? sh.amount : "",
      gr ? gr.date : "", gr ? gr.item : "", gr ? gr.amount : "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, monthLabel);
}

function getEffective<T extends { effectiveFrom: string }>(items: T[], month: string): T | undefined {
  const sorted = [...items]
    .filter(i => i.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return sorted[0];
}

function getEffectiveItems<T extends { name: string; effectiveFrom: string }>(items: T[], month: string): T[] {
  // Group by name, pick most recent effectiveFrom <= month
  const grouped = new Map<string, T>();
  for (const item of items) {
    if (item.effectiveFrom > month) continue;
    const existing = grouped.get(item.name);
    if (!existing || item.effectiveFrom > existing.effectiveFrom) {
      grouped.set(item.name, item);
    }
  }
  return Array.from(grouped.values());
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${year}`;
}

// ── XLSX import parser ────────────────────────────────────────────────────────
/**
 * Parse the exported XLSX workbook back into InsertExpense arrays keyed by month ("YYYY-MM").
 *
 * Sheet name format: "Jan 2026", "Feb 2026", etc.
 * Expense rows start after the header row that contains "Date" in column A
 * and "Food" in column B (the first such row in the sheet).
 *
 * Expense row layout (0-indexed columns):
 *   0: food_date   (YYYY-MM-DD or empty)
 *   1: food_amount (number or empty)
 *   2: shop_date
 *   3: shop_item
 *   4: shop_amount
 *   5: grocery_date
 *   6: grocery_item
 *   7: grocery_amount
 *
 * Rows stop when all 8 columns are empty/undefined.
 */
function parseWorkbook(wb: any): Record<string, InsertExpense[]> {
  const MONTH_NAMES: Record<string, string> = {
    // Short names (our export format)
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    // Full names (in case user renames sheet tabs)
    January: "01", February: "02", March: "03", April: "04",
    June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12",
  };

  const result: Record<string, InsertExpense[]> = {};

  for (const sheetName of wb.SheetNames) {
    // Normalise: trim edges, collapse any multi-space or non-breaking space to single space
    const normalised = sheetName.replace(/[\u00a0\u2009\u202f\s]+/g, " ").trim();
    // Accept "Mon YYYY" or "Month YYYY" e.g. "Mar 2026", "July 2025"
    const match = normalised.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!match) continue; // skip unknown sheets (e.g. "Info")
    // Normalise capitalisation for lookup ("JUL" → "Jul", "july" → "Jul")
    const monthName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    // Also try just the first 3 chars (handles "July" → "Jul")
    const monthNum = MONTH_NAMES[monthName] ?? MONTH_NAMES[monthName.slice(0, 3)];
    if (!monthNum) continue;
    const year = match[2];
    const monthKey = `${year}-${monthNum}`; // "YYYY-MM"

    const ws = wb.Sheets[sheetName];
    // Convert sheet to array of arrays
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

    // Debug: print first 30 rows' first 8 columns to diagnose header detection
    console.log(`[import] sheet "${sheetName}" has ${rows.length} rows. Scanning for header...`);
    for (let dbg = 0; dbg < Math.min(rows.length, 35); dbg++) {
      const r = rows[dbg];
      console.log(`[import]  row[${dbg}]:`, JSON.stringify((r || []).slice(0, 8)));
    }

    // Find the expense header row: scan ALL columns of every row for the pattern
    //   [Date][Food][Date][Shopping...][Date][Grocery]
    // Record the column offset so we can handle tables that don't start at column A.
    let startIdx = -1;
    let colOffset = 0; // index of the "Date" (food-date) column
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      for (let c = 0; c < (r.length || 0); c++) {
        const cell = String(r[c] ?? "").trim().toLowerCase();
        const next = String(r[c + 1] ?? "").trim().toLowerCase();
        if (cell === "date" && next === "food") {
          colOffset = c;
          startIdx = i + 1;
          console.log(`[import]  → header found at row ${i}, col offset ${c}`);
          break;
        }
      }
      if (startIdx !== -1) break;
    }
    if (startIdx === -1) {
      console.log(`[import]  → header not found in "${sheetName}", skipping`);
      continue; // no expense section found in this sheet
    }

    const expenses: InsertExpense[] = [];

    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i];
      // Stop when the relevant columns are all empty
      const slice = (r || []).slice(colOffset, colOffset + 8);
      const allEmpty = slice.every(v => v === null || v === undefined || v === "");
      if (allEmpty) break;

      // Food: col offset+0 = date, col offset+1 = amount
      const foodDate  = normaliseDate(r[colOffset + 0], monthKey);
      const foodAmt   = toNum(r[colOffset + 1]);
      if (foodDate && foodAmt !== null) {
        expenses.push({
          month: monthKey,
          date: foodDate,
          item: "Food delta",
          amount: foodAmt,
          category: "food",
          isFoodDelta: true,
          foodType: null,
        });
      }

      // Shopping: col offset+2 = date, col offset+3 = item, col offset+4 = amount
      const shopDate  = normaliseDate(r[colOffset + 2], monthKey);
      const shopItem  = String(r[colOffset + 3] ?? "").trim();
      const shopAmt   = toNum(r[colOffset + 4]);
      if (shopDate && shopAmt !== null) {
        expenses.push({
          month: monthKey,
          date: shopDate,
          item: shopItem || "Shopping",
          amount: shopAmt,
          category: "shopping",
          isFoodDelta: false,
          foodType: null,
        });
      }

      // Grocery: col offset+5 = date, col offset+6 = item, col offset+7 = amount
      const grocDate  = normaliseDate(r[colOffset + 5], monthKey);
      const grocItem  = String(r[colOffset + 6] ?? "").trim();
      const grocAmt   = toNum(r[colOffset + 7]);
      if (grocDate && grocAmt !== null) {
        expenses.push({
          month: monthKey,
          date: grocDate,
          item: grocItem || "Grocery",
          amount: grocAmt,
          category: "grocery",
          isFoodDelta: false,
          foodType: null,
        });
      }
    }

    if (expenses.length > 0) {
      result[monthKey] = expenses;
    }
  }

  return result;
}

/** Convert a cell value to a YYYY-MM-DD string, or null if invalid.
 *  Handles:
 *   - string "2026-03-01" (ISO, from our own export)
 *   - string "7/2/25" or "7/2/2025" (M/D/YY or M/D/YYYY — US Excel default)
 *   - Excel serial date number (integer like 45840 = 2025-07-02)
 */
function normaliseDate(raw: any, _fallbackMonth: string): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number") {
    // Excel serial → date via pure JS (avoids XLSX.SSF bundling issues)
    // Excel epoch is Dec 30 1899; serial 1 = Jan 1 1900
    // We use the JS Date epoch offset
    try {
      // Excel bug: serial 60 = Feb 29 1900 (doesn't exist), adjust
      const serial = raw >= 60 ? raw - 1 : raw;
      const msPerDay = 24 * 60 * 60 * 1000;
      const epochMs = Date.UTC(1900, 0, 1) + (serial - 1) * msPerDay;
      const d = new Date(epochMs);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch {
      return null;
    }
  }

  // JS Date object (produced when cellDates:true is passed to XLSX.read)
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const str = String(raw).trim();

  // Already ISO YYYY-MM-DD (our own export format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // ISO datetime string "YYYY-MM-DDTHH:mm:ss.000Z" (what cellDates:true produces when
  // sheet_to_json serialises Date objects into the array — common on Mac Excel)
  const isoFull = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoFull) return isoFull[1];

  // M/D/YY or M/D/YYYY (Excel US locale default, e.g. "7/2/25" = July 2, 2025)
  const slash2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash2) {
    const [, mon, day, yr] = slash2;
    const year = yr.length === 2 ? "20" + yr : yr;
    return `${year}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

/** Convert a cell to a number or null. */
function toNum(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return isNaN(n) ? null : n;
}
