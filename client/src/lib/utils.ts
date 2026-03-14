import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, showSign = false): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (showSign) {
    return value >= 0 ? `+$${formatted}` : `-$${formatted}`;
  }
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${year}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getFiscalYear(month: string): string {
  // Fiscal year is Apr-Mar. e.g. Apr 2025 - Mar 2026 = "2025-2026"
  const [year, m] = month.split("-").map(Number);
  const startYear = m >= 4 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function getFiscalMonths(fiscalYear: string): string[] {
  const [start] = fiscalYear.split("-").map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${start}-${String(m).padStart(2, "0")}`);
  for (let m = 1; m <= 3; m++) months.push(`${start + 1}-${String(m).padStart(2, "0")}`);
  return months;
}

export function parseMonthInput(value: string): string {
  // Accepts YYYY-MM
  return value;
}
