/**
 * Google Sheets sync — mirrors the exact layout of your existing
 * "Household Monthly Expense" spreadsheet.
 *
 * Sheet layout per tab (e.g. "Mar 2026"):
 *
 * Row 1  : [Month label] | | Credit | | Debit | | | Salary | ...
 * Row 2  : Michael | Income | <amount> | Insurance | <amount> | ...
 * ...      (income items alongside debit items)
 * Row N  : Total Credit | <val> | Total Debit | <val>
 * Row N+2: Food section header (Days / Per cost / Monthly)
 * Row N+3: Breakfast | <days> | <cost> | <monthly>
 * Row N+4: Lunch     | <days> | <cost> | <monthly>
 * Row N+5: Monthly food cost total
 * Row N+7: Food+Petty | <petty cash total>
 * Row N+8: Remaining  | <remaining>  (highlighted green/red)
 * Row N+9: Extra money on food | <food delta total>
 * Row N+11: Headers: Date | Food | Date | Shopping | Date | Grocery
 * Row N+12+: expense rows
 */

import { google, sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "./googleAuth";
import type { Expense, FixedItem, FoodSettings } from "@shared/schema";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? "11f8ZRNOgBX394Vj4QtZS1B-hryXF8hF1E3RZuNK9RYA";

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${year}`;
}

function getEffective<T extends { effectiveFrom: string }>(items: T[], month: string): T | undefined {
  return [...items]
    .filter(i => i.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

function getEffectiveItems<T extends { name: string; effectiveFrom: string }>(items: T[], month: string): T[] {
  const grouped = new Map<string, T>();
  for (const item of items) {
    if (item.effectiveFrom > month) continue;
    const existing = grouped.get(item.name);
    if (!existing || item.effectiveFrom > existing.effectiveFrom) grouped.set(item.name, item);
  }
  return Array.from(grouped.values());
}

export async function syncMonthToSheets(
  month: string,
  allFixedItems: FixedItem[],
  foodSettingsList: FoodSettings[],
  expenses: Expense[],
): Promise<{ success: boolean; error?: string }> {
  const auth = getAuthorizedClient();
  if (!auth) return { success: false, error: "Not authenticated with Google" };

  const sheets = google.sheets({ version: "v4", auth });
  const sheetTitle = formatMonthLabel(month);

  try {
    // ── 1. Ensure the sheet tab exists ──────────────────────────────────────
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = meta.data.sheets?.map(s => s.properties?.title) ?? [];

    if (!existingSheets.includes(sheetTitle)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetTitle } } }],
        },
      });
    }

    // ── 2. Build data ────────────────────────────────────────────────────────
    const incomeItems = getEffectiveItems(allFixedItems.filter(f => f.type === "income" || f.type === "saving"), month);
    const debitItems = getEffectiveItems(allFixedItems.filter(f => f.type === "debit"), month);
    const foodSettings = getEffective(foodSettingsList, month) ?? { breakfastCost: 40, lunchCost: 75, days: 30 };

    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalDebit = debitItems.reduce((s, i) => s + i.amount, 0);
    const foodMonthly = (foodSettings.breakfastCost + foodSettings.lunchCost) * foodSettings.days;
    const pettyCash = totalIncome - totalDebit - foodMonthly;

    const foodExpenses = expenses.filter(e => e.category === "food");
    const shoppingExpenses = expenses.filter(e => e.category === "shopping");
    const groceryExpenses = expenses.filter(e => e.category === "grocery");

    const foodTotal = foodExpenses.reduce((s, e) => s + e.amount, 0);
    const shoppingTotal = shoppingExpenses.reduce((s, e) => s + e.amount, 0);
    const groceryTotal = groceryExpenses.reduce((s, e) => s + e.amount, 0);
    const remaining = pettyCash - foodTotal - shoppingTotal - groceryTotal;

    // ── 3. Build rows (columns A–K matching your original layout) ───────────
    //  A          B                    C          D               E          F           G   H     I         J        K
    //  Person   | Income label       | Credit  | Debit label    | Debit   | Food+Petty |   | Days| Per cost | Monthly | Travel
    const rows: any[][] = [];

    // Row 1 — header
    rows.push([sheetTitle, "", "Credit", "", "Debit", "", "", "Salary", totalIncome]);

    // Row 2 — income line 1 + debit line 1
    const maxRows = Math.max(incomeItems.length, debitItems.length);
    for (let i = 0; i < maxRows; i++) {
      const inc = incomeItems[i];
      const deb = debitItems[i];
      const row: any[] = [
        i === 0 ? "Michael" : "",
        inc ? inc.name : "",
        inc ? inc.amount : "",
        "",
        deb ? deb.name : "",
        deb ? deb.amount : "",
        "",
        "",
        "",
        "",
        "",
      ];
      rows.push(row);
    }

    // Blank row
    rows.push([]);

    // Totals row
    rows.push(["", "Total Credit", totalIncome, "", "Total Debit", totalDebit, "", "Food + Petty", pettyCash]);
    rows.push([]);

    // Food section header
    rows.push(["", "", "", "", "", "", "", "Days", "Per cost", "Monthly"]);
    rows.push(["", "", "", "", "", "", "Breakfast", foodSettings.days, foodSettings.breakfastCost, foodSettings.breakfastCost * foodSettings.days]);
    rows.push(["", "", "", "", "", "", "Lunch", foodSettings.days, foodSettings.lunchCost, foodSettings.lunchCost * foodSettings.days]);
    rows.push(["", "", "", "", "", "", "", "", "Monthly cost", foodMonthly]);
    rows.push([]);

    // Petty cash / remaining
    rows.push(["", "", "", "Food+ Petty", "", pettyCash]);
    rows.push(["", "", "", "Remaining", "", remaining]);
    rows.push(["", "", "", "Extra money on food", "", foodTotal]);
    rows.push([]);

    // Expense table headers
    rows.push(["Date", "Food", "", "Date", "Shopping", "Petty cash", "", "Date", "Grocery", "", ""]);

    // Expense rows side by side
    const maxExp = Math.max(foodExpenses.length, shoppingExpenses.length, groceryExpenses.length);
    for (let i = 0; i < maxExp; i++) {
      const f = foodExpenses[i];
      const sh = shoppingExpenses[i];
      const gr = groceryExpenses[i];
      rows.push([
        f ? f.date : "", f ? f.amount : "", "",
        sh ? sh.date : "", sh ? sh.item : "", sh ? sh.amount : "", "",
        gr ? gr.date : "", gr ? gr.item : "", gr ? gr.amount : "", "",
      ]);
    }

    // Totals
    rows.push([]);
    rows.push(["", foodTotal, "", "", "", shoppingTotal, "", "", "", groceryTotal]);

    // ── 4. Clear existing content and write new data ─────────────────────────
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A1:Z200`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    // ── 5. Apply basic formatting ────────────────────────────────────────────
    const sheetId = await getSheetId(sheets, sheetTitle);
    if (sheetId !== null) {
      await applyFormatting(sheets, sheetId, remaining);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Sheets sync error:", err.message);
    return { success: false, error: err.message };
  }
}

async function getSheetId(sheets: sheets_v4.Sheets, title: string): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === title);
  return sheet?.properties?.sheetId ?? null;
}

async function applyFormatting(sheets: sheets_v4.Sheets, sheetId: number, remaining: number) {
  // Bold the header row and totals; colour remaining cell green/red
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        // Bold row 1
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
        // Colour remaining value green or red
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 11 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "#,##0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}
