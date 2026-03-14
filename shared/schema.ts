import { pgTable, text, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Fixed / Regular Expense Item ──────────────────────────────────────────────
// Represents a single line in the "Credit" or "Debit" section.
// effectiveFrom = "YYYY-MM" – applies from this month onwards until changed.
export const fixedItems = pgTable("fixed_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),           // positive = income/credit, negative = deduction
  type: text("type").notNull(),              // "income" | "debit" | "saving"
  effectiveFrom: text("effective_from").notNull(), // "YYYY-MM"
});

export const insertFixedItemSchema = createInsertSchema(fixedItems).omit({ id: true });
export type InsertFixedItem = z.infer<typeof insertFixedItemSchema>;
export type FixedItem = typeof fixedItems.$inferSelect;

// ── Food Settings ─────────────────────────────────────────────────────────────
export const foodSettings = pgTable("food_settings", {
  id: serial("id").primaryKey(),
  breakfastCost: real("breakfast_cost").notNull().default(40),
  lunchCost: real("lunch_cost").notNull().default(75),
  days: integer("days").notNull().default(30),
  effectiveFrom: text("effective_from").notNull(), // "YYYY-MM"
});

export const insertFoodSettingsSchema = createInsertSchema(foodSettings).omit({ id: true });
export type InsertFoodSettings = z.infer<typeof insertFoodSettingsSchema>;
export type FoodSettings = typeof foodSettings.$inferSelect;

// ── Irregular Expense Entry ───────────────────────────────────────────────────
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),            // "YYYY-MM"
  date: text("date").notNull(),              // "YYYY-MM-DD"
  item: text("item").notNull(),
  amount: real("amount").notNull(),          // positive = expense; negative = saving (e.g. -40 breakfast not eaten)
  category: text("category").notNull(),      // "food" | "shopping" | "grocery"
  isFoodDelta: boolean("is_food_delta").notNull().default(false), // true if it's a +/- against breakfast/lunch budget
  foodType: text("food_type"),               // "breakfast" | "lunch" | "dinner" | null
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// ── Month Summary (cached / computed) ────────────────────────────────────────
// We store the petty cash remaining each month for the annual summary.
export const monthSummaries = pgTable("month_summaries", {
  id: serial("id").primaryKey(),
  month: text("month").notNull().unique(),   // "YYYY-MM"
  remainingPettyCash: real("remaining_petty_cash"),
  note: text("note"),
});

export const insertMonthSummarySchema = createInsertSchema(monthSummaries).omit({ id: true });
export type InsertMonthSummary = z.infer<typeof insertMonthSummarySchema>;
export type MonthSummary = typeof monthSummaries.$inferSelect;

// ── Annual Savings Entry ──────────────────────────────────────────────────────
// Each fiscal year Apr-Mar gets one record with bonus/13th salary components.
export const annualSavings = pgTable("annual_savings", {
  id: serial("id").primaryKey(),
  fiscalYear: text("fiscal_year").notNull().unique(), // e.g. "2025-2026"
  thirteenthSalary: real("thirteenth_salary").notNull().default(0),
  bonus: real("bonus").notNull().default(0),
  regularSaving: real("regular_saving").notNull().default(0),
  note: text("note"),
});

export const insertAnnualSavingsSchema = createInsertSchema(annualSavings).omit({ id: true });
export type InsertAnnualSavings = z.infer<typeof insertAnnualSavingsSchema>;
export type AnnualSavings = typeof annualSavings.$inferSelect;

// ── Annual Big Spending Items ─────────────────────────────────────────────────
// Large one-off purchases in a fiscal year that are deducted from total savings.
export const annualBigSpending = pgTable("annual_big_spending", {
  id: serial("id").primaryKey(),
  fiscalYear: text("fiscal_year").notNull(),  // e.g. "2025-2026"
  item: text("item").notNull(),
  amount: real("amount").notNull(),           // always positive
});

export const insertAnnualBigSpendingSchema = createInsertSchema(annualBigSpending).omit({ id: true });
export type InsertAnnualBigSpending = z.infer<typeof insertAnnualBigSpendingSchema>;
export type AnnualBigSpending = typeof annualBigSpending.$inferSelect;

// ── Grocery Items ─────────────────────────────────────────────────────────────
// Standalone grocery log — not linked to Monthly Entry spending totals.
export const groceryItems = pgTable("grocery_items", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),          // "YYYY-MM"
  date: text("date").notNull(),            // "YYYY-MM-DD"
  item: text("item").notNull().default(""), // optional, defaults to empty
  category: text("category").notNull().default("Food"), // "Food" | "Household"
  amount: real("amount").notNull(),
});

export const insertGroceryItemSchema = createInsertSchema(groceryItems).omit({ id: true });
export type InsertGroceryItem = z.infer<typeof insertGroceryItemSchema>;
export type GroceryItem = typeof groceryItems.$inferSelect;
