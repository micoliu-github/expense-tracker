import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Download, ChevronLeft, ChevronRight, Pencil, Check, X } from "lucide-react";
import { formatCurrency, formatMonthLabel, currentMonth, getFiscalYear } from "@/lib/utils";
import type { Expense, FixedItem, FoodSettings, InsertExpense } from "@shared/schema";
import { GoogleSheetsButton } from "@/components/GoogleSheetsButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

/** Returns today if it falls within the given month, otherwise the 1st of that month. */
function defaultDateForMonth(m: string): string {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  if (today.startsWith(m)) return today;
  return `${m}-01`;
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, "0")}`;
}

// ── Expense row — view + inline edit ─────────────────────────────────────────
function ExpenseRow({
  expense,
  onDelete,
  onUpdate,
}: {
  expense: Expense;
  onDelete: (id: number) => void;
  onUpdate: (id: number, patch: Partial<Pick<Expense, "date" | "item" | "amount">>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(expense.date);
  const [draftItem, setDraftItem] = useState(expense.item);
  // For food entries the stored amount may be negative (saved money). Show absolute + sign prefix.
  const [draftAmount, setDraftAmount] = useState(String(expense.amount));

  function startEdit() {
    setDraftDate(expense.date);
    setDraftItem(expense.item);
    setDraftAmount(String(expense.amount));
    setEditing(true);
  }

  function commitEdit() {
    const amount = parseFloat(draftAmount);
    if (isNaN(amount)) return;
    onUpdate(expense.id, { date: draftDate, item: draftItem, amount });
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b last:border-0 bg-accent/40" data-testid={`row-expense-${expense.id}`}>
        {/* Date */}
        <td className="py-1.5 pr-2">
          <Input
            type="date"
            value={draftDate}
            onChange={e => setDraftDate(e.target.value)}
            className="h-7 text-xs w-28"
            data-testid={`edit-date-${expense.id}`}
          />
        </td>
        {/* Item */}
        <td className="py-1.5 pr-2">
          <Input
            value={draftItem}
            onChange={e => setDraftItem(e.target.value)}
            className="h-7 text-xs"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            data-testid={`edit-item-${expense.id}`}
          />
        </td>
        {/* Amount — raw number, sign included */}
        <td className="py-1.5 pr-2">
          <Input
            type="number"
            step="0.01"
            value={draftAmount}
            onChange={e => setDraftAmount(e.target.value)}
            className="h-7 text-xs w-24 text-right font-mono"
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            data-testid={`edit-amount-${expense.id}`}
          />
        </td>
        {/* Actions */}
        <td className="py-1.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-600" onClick={commitEdit} data-testid={`button-confirm-edit-${expense.id}`}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={cancelEdit} data-testid={`button-cancel-edit-${expense.id}`}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="border-b last:border-0 group cursor-pointer hover:bg-muted/40 transition-colors"
      data-testid={`row-expense-${expense.id}`}
      onDoubleClick={startEdit}
    >
      <td className="py-2 pr-3 text-xs text-muted-foreground">{expense.date.split("-").slice(1).join("/")}</td>
      <td className="py-2 pr-3 text-sm">{expense.item}</td>
      <td className={`py-2 pr-3 text-right text-sm font-mono ${expense.amount < 0 ? "value-positive" : "value-negative"}`}>
        {formatCurrency(expense.amount, true)}
      </td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost" size="sm"
            className="h-6 w-6 p-0"
            onClick={startEdit}
            data-testid={`button-edit-expense-${expense.id}`}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onDelete(expense.id)}
            data-testid={`button-delete-expense-${expense.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Month Pills ─────────────────────────────────────────────────────────────
// Shows all months that have expense data + any manually pinned months.
// + button to pin a new month, trash on hover to unpin manually-added ones.
function MonthPills({
  currentMonth,
  allExpenses,
  onNavigate,
}: {
  currentMonth: string;
  allExpenses: Expense[];
  onNavigate: (m: string) => void;
}) {
  const { toast } = useToast();
  // Months pinned manually by the user (persisted across renders via state)
  const [pinnedMonths, setPinnedMonths] = useState<string[]>([]);
  const [addingMonth, setAddingMonth] = useState(false);
  const [draft, setDraft] = useState("");

  // Months that have at least one expense entry
  const monthsWithData = useMemo(() => {
    return Array.from(new Set(allExpenses.map(e => e.month))).sort().reverse();
  }, [allExpenses]);

  // Visible = data months + pinned, deduplicated, sorted newest first
  const visibleMonths = useMemo(() => {
    return Array.from(new Set([...monthsWithData, ...pinnedMonths, currentMonth]))
      .sort().reverse();
  }, [monthsWithData, pinnedMonths, currentMonth]);

  function handleAdd() {
    const trimmed = draft.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
      toast({ title: "Invalid format", description: "Use YYYY-MM, e.g. 2026-05", variant: "destructive" });
      return;
    }
    setPinnedMonths(prev => Array.from(new Set([...prev, trimmed])));
    onNavigate(trimmed);
    setDraft("");
    setAddingMonth(false);
  }

  function handleRemove(m: string) {
    // Can only remove months that were manually pinned (not ones with data)
    setPinnedMonths(prev => prev.filter(p => p !== m));
    // If we removed the currently viewed month, go to the most recent with data
    if (m === currentMonth) {
      const fallback = monthsWithData[0] || currentMonth;
      if (fallback !== currentMonth) onNavigate(fallback);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground shrink-0">Month:</span>

      {visibleMonths.map(m => {
        const hasData = monthsWithData.includes(m);
        const isPinned = pinnedMonths.includes(m);
        const isActive = m === currentMonth;
        // Can delete if manually pinned AND no expense data
        const canDelete = isPinned && !hasData;

        return (
          <div key={m} className="relative flex items-center">
            {/* Pill button — navigate only */}
            <button
              onClick={() => onNavigate(m)}
              className={`pl-3 ${canDelete ? "pr-6" : "pr-3"} py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
              data-testid={`button-month-pill-${m}`}
            >
              {formatMonthLabel(m)}
              {hasData && (
                <span className={`inline-block h-1.5 w-1.5 rounded-full ml-0.5 ${
                  isActive ? "bg-primary-foreground/60" : "bg-primary/50"
                }`} />
              )}
            </button>
            {/* Trash — always visible when canDelete, works on touch and mouse */}
            {canDelete && (
              <button
                onClick={e => { e.stopPropagation(); handleRemove(m); }}
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors ${
                  isActive
                    ? "hover:bg-white/20 active:bg-white/30 text-primary-foreground/70"
                    : "hover:bg-destructive/20 active:bg-destructive/30 text-destructive/60"
                }`}
                title={`Remove ${formatMonthLabel(m)}`}
                data-testid={`button-remove-month-${m}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* Add month */}
      {addingMonth ? (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="YYYY-MM"
            className="h-7 w-24 text-xs font-mono px-2"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAddingMonth(false); setDraft(""); }
            }}
            data-testid="input-add-month-picker"
          />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-600" onClick={handleAdd} data-testid="button-confirm-add-month">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => { setAddingMonth(false); setDraft(""); }} data-testid="button-cancel-add-month">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setAddingMonth(true)}
                className="h-7 w-7 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center"
                data-testid="button-add-month"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Pin a month to quickly jump to it
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export default function MonthlyEntry() {
  const [location, navigate] = useLocation();
  const params = useParams<{ month?: string }>();
  const { toast } = useToast();

  const month = params.month || currentMonth();

  // Form state
  const [entryDate, setEntryDate] = useState(() => defaultDateForMonth(month));
  const [entryItem, setEntryItem] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryCategory, setEntryCategory] = useState<"food" | "shopping" | "grocery">("food");
  const [foodDeltaSign, setFoodDeltaSign] = useState<"+" | "-">("+");
  const [foodType, setFoodType] = useState<"breakfast" | "lunch" | "dinner" | "">("");

  // When month changes (pill click / chevron nav), reset the form date to that month
  useEffect(() => {
    setEntryDate(defaultDateForMonth(month));
    setEntryItem("");
    setEntryAmount("");
  }, [month]);

  const { data: allExpenses = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: fixedItems = [] } = useQuery<FixedItem[]>({ queryKey: ["/api/fixed-items"] });
  const { data: foodSettingsList = [] } = useQuery<FoodSettings[]>({ queryKey: ["/api/food-settings"] });

  const monthExpenses = allExpenses.filter(e => e.month === month);
  const foodExpenses = monthExpenses.filter(e => e.category === "food");
  const shoppingExpenses = monthExpenses.filter(e => e.category === "shopping");
  const groceryExpenses = monthExpenses.filter(e => e.category === "grocery");

  const effectiveFoodSettings = getEffective(foodSettingsList, month) ?? { breakfastCost: 40, lunchCost: 75, days: 30 };
  const foodMonthly = effectiveFoodSettings.breakfastCost * effectiveFoodSettings.days +
    effectiveFoodSettings.lunchCost * effectiveFoodSettings.days;

  const effectiveFixed = getEffectiveItems(fixedItems.filter(f => f.type === "income" || f.type === "saving"), month);
  const effectiveDebit = getEffectiveItems(fixedItems.filter(f => f.type === "debit"), month);
  const totalIncome = effectiveFixed.reduce((s, i) => s + i.amount, 0);
  const totalDebit = effectiveDebit.reduce((s, i) => s + i.amount, 0);
  const pettyCash = totalIncome - totalDebit - foodMonthly;

  const foodTotal = foodExpenses.reduce((s, e) => s + e.amount, 0);
  const shoppingTotal = shoppingExpenses.reduce((s, e) => s + e.amount, 0);
  const groceryTotal = groceryExpenses.reduce((s, e) => s + e.amount, 0);
  const remaining = pettyCash - foodTotal - shoppingTotal - groceryTotal;

  const addMutation = useMutation({
    mutationFn: (data: InsertExpense) => apiRequest("POST", "/api/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setEntryItem("");
      setEntryAmount("");
      toast({ title: "Entry added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/expenses"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Pick<Expense, "date" | "item" | "amount">> }) =>
      apiRequest("PUT", `/api/expenses/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Entry updated" });
    },
  });

  // Silent auto-sync — upserts remaining petty cash whenever expenses change
  const autoSyncMutation = useMutation({
    mutationFn: (value: number) => apiRequest("POST", "/api/month-summaries", { month, remainingPettyCash: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/month-summaries"] });
    },
  });

  // Whenever the calculated remaining changes (expense added/edited/deleted),
  // auto-save it silently so Savings page always reflects live data.
  // Skip on first render (allExpenses still loading) by checking length > 0 or
  // month has no expenses yet (still useful to write 0 so Savings shows it).
  const autoSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Debounce slightly so rapid edits don't fire many requests
    if (autoSyncRef.current) clearTimeout(autoSyncRef.current);
    autoSyncRef.current = setTimeout(() => {
      autoSyncMutation.mutate(remaining);
    }, 600);
    return () => { if (autoSyncRef.current) clearTimeout(autoSyncRef.current); };
  }, [remaining, month]);

  const saveSummaryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/month-summaries", { month, remainingPettyCash: remaining }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/month-summaries"] });
      toast({ title: `Petty cash for ${formatMonthLabel(month)} saved`, description: formatCurrency(remaining) });
    },
  });

  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(entryAmount);
    if (isNaN(amountNum)) return;

    let finalAmount = amountNum;
    let item = entryItem || entryCategory;
    let isFoodDelta = false;

    if (entryCategory === "food") {
      // Food entries: user enters raw delta from baseline
      finalAmount = foodDeltaSign === "-" ? -Math.abs(amountNum) : Math.abs(amountNum);
      isFoodDelta = true;
      if (!entryItem) {
        const ft = foodType || "food";
        item = foodType ? `${ft} delta` : "food delta";
      }
    }

    addMutation.mutate({
      month,
      date: entryDate,
      item,
      amount: finalAmount,
      category: entryCategory,
      isFoodDelta,
      foodType: entryCategory === "food" && foodType ? foodType : null,
    });
  }

  function downloadMonth() {
    const a = document.createElement("a");
    a.href = `/api/export/xlsx/${month}`;
    a.download = `Expense_${month}.xlsx`;
    a.click();
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/entry/${prevMonth(month)}`)} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Go to previous month</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div>
            <h1 className="text-xl font-bold">{formatMonthLabel(month)}</h1>
            <p className="text-xs text-muted-foreground">FY {getFiscalYear(month)}</p>
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/entry/${nextMonth(month)}`)} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Go to next month</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={downloadMonth} data-testid="button-export-month">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export XLSX
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-52 text-xs leading-relaxed">
                Downloads this month's expenses as an Excel file (.xlsx) to your computer.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <GoogleSheetsButton month={month} />
        </div>
      </div>

      {/* Month pills + add/remove */}
      <MonthPills
        currentMonth={month}
        allExpenses={allExpenses}
        onNavigate={m => navigate(`/entry/${m}`)}
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Income", value: totalIncome, sub: "After deductions" },
          { label: "Fixed Deductions", value: -totalDebit, sub: "Regular expenses" },
          { label: "Petty Cash Budget", value: pettyCash, sub: `Incl. food $${foodMonthly.toFixed(0)}/mo` },
          { label: "Remaining", value: remaining, sub: "After all spending" },
        ].map(({ label, value, sub }) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-base font-bold mt-0.5 ${value >= 0 ? "value-positive" : "value-negative"}`}>{formatCurrency(value)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Add Entry Form ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Expense Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEntry} className="space-y-3" data-testid="form-add-expense">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-entry-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={entryCategory} onValueChange={(v: any) => setEntryCategory(v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="shopping">Shopping</SelectItem>
                      <SelectItem value="grocery">Grocery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {entryCategory === "food" && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Food delta entry</p>
                  <p className="text-xs text-muted-foreground">
                    Baseline: B ${effectiveFoodSettings.breakfastCost} + L ${effectiveFoodSettings.lunchCost}/day × {effectiveFoodSettings.days} days = ${foodMonthly.toFixed(0)}/mo
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Meal type</Label>
                      <Select value={foodType} onValueChange={(v: any) => setFoodType(v)}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-food-type">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">+/−</Label>
                      <Select value={foodDeltaSign} onValueChange={(v: any) => setFoodDeltaSign(v)}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-food-sign">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="+">+ Extra spend</SelectItem>
                          <SelectItem value="-">− Didn't spend / saved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    e.g. Lunch $250 → enter 175 with + (250−75). Skipped breakfast → enter 40 with −.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Item / Description {entryCategory === "food" ? "(optional)" : ""}</Label>
                <Input
                  value={entryItem}
                  onChange={e => setEntryItem(e.target.value)}
                  placeholder={entryCategory === "food" ? "e.g. Dinner out" : "e.g. Amazon purchase"}
                  className="h-8 text-sm"
                  data-testid="input-entry-item"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Amount (HK$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={entryAmount}
                  onChange={e => setEntryAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-sm"
                  required
                  data-testid="input-entry-amount"
                />
              </div>

              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="submit" size="sm" className="w-full" disabled={addMutation.isPending} data-testid="button-add-expense">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      {addMutation.isPending ? "Adding..." : "Add Entry"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-56 text-xs leading-relaxed">
                    Saves this expense entry to the current month. Fill in date, category, and amount first.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </form>
          </CardContent>
        </Card>

        {/* ── Fixed Expenses Summary ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Fixed Expenses — {formatMonthLabel(month)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Income / Credit</p>
                <div className="space-y-0.5">
                  {effectiveFixed.map(item => (
                    <div key={item.id} className="flex justify-between text-sm py-0.5">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className={item.amount < 0 ? "value-negative" : "value-positive"}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                    <span>Net income</span>
                    <span className="value-positive">{formatCurrency(totalIncome)}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Fixed Deductions</p>
                <div className="space-y-0.5">
                  {effectiveDebit.map(item => (
                    <div key={item.id} className="flex justify-between text-sm py-0.5">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="value-negative">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                    <span>Total deductions</span>
                    <span className="value-negative">{formatCurrency(totalDebit)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-md bg-primary/5 p-2.5 border border-primary/20">
                <div className="flex justify-between text-sm font-bold">
                  <span>Petty Cash (incl. food budget)</span>
                  <span className="text-primary">{formatCurrency(pettyCash)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>Food budget baseline</span>
                  <span>{formatCurrency(foodMonthly)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Expense Tables ── */}
      <Tabs defaultValue="food">
        <TabsList className="h-8">
          <TabsTrigger value="food" className="text-xs h-7">
            Food <Badge variant="secondary" className="ml-1.5 h-4 text-xs">{foodExpenses.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="shopping" className="text-xs h-7">
            Shopping <Badge variant="secondary" className="ml-1.5 h-4 text-xs">{shoppingExpenses.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="grocery" className="text-xs h-7">
            Grocery <Badge variant="secondary" className="ml-1.5 h-4 text-xs">{groceryExpenses.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {[
          { key: "food", data: foodExpenses, total: foodTotal, label: "Food Delta", color: "amber" },
          { key: "shopping", data: shoppingExpenses, total: shoppingTotal, label: "Shopping", color: "blue" },
          { key: "grocery", data: groceryExpenses, total: groceryTotal, label: "Grocery", color: "green" },
        ].map(({ key, data, total, label }) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{label} Entries</CardTitle>
                <div className="text-sm font-semibold">
                  Total: <span className={total < 0 ? "value-positive" : total > 0 ? "value-negative" : ""}>{formatCurrency(total, true)}</span>
                </div>
              </CardHeader>
              <CardContent>
                {data.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No entries yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 pr-3 text-xs text-muted-foreground font-medium">Date</th>
                          <th className="text-left py-1.5 pr-3 text-xs text-muted-foreground font-medium">Item</th>
                          <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Amount</th>
                          <th className="w-16 text-right py-1.5 text-xs text-muted-foreground font-medium">Edit / Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map(exp => (
                          <ExpenseRow
                            key={exp.id}
                            expense={exp}
                            onDelete={id => deleteMutation.mutate(id)}
                            onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Save Petty Cash Summary ── */}
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Month Petty Cash Remaining</p>
            <p className={`text-xl font-bold mt-0.5 ${remaining >= 0 ? "value-positive" : "value-negative"}`}>
              {formatCurrency(remaining, true)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Save to track in annual summary</p>
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => saveSummaryMutation.mutate()}
                  disabled={saveSummaryMutation.isPending}
                  data-testid="button-save-petty-cash"
                >
                  {saveSummaryMutation.isPending ? "Saving..." : "Save Remaining"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-xs leading-relaxed">
                Records this month's remaining petty cash balance so it rolls into your annual savings summary.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
