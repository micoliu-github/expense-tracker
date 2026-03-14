import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, formatMonthLabel, getFiscalYear, getFiscalMonths, currentMonth } from "@/lib/utils";
import type { AnnualSavings, MonthSummary, InsertAnnualSavings, InsertMonthSummary, AnnualBigSpending } from "@shared/schema";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";

/** Returns the default visible fiscal years (current ± 2) merged with any already-saved ones. */
function getDefaultFiscalYears(savedYears: string[]): string[] {
  const current = getFiscalYear(currentMonth());
  const [startYear] = current.split("-").map(Number);
  const defaults = new Set<string>();
  for (let y = startYear - 2; y <= startYear + 1; y++) {
    defaults.add(`${y}-${y + 1}`);
  }
  // Always include any years that have saved records
  for (const y of savedYears) defaults.add(y);
  return Array.from(defaults).sort().reverse();
}

/** Validate that a string is a valid fiscal year like "2027-2028" */
function isValidFiscalYear(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{4})$/);
  if (!m) return false;
  return parseInt(m[2]) === parseInt(m[1]) + 1;
}

// ── Inline-editable petty cash row ───────────────────────────────────────────
function PettyCashRow({
  month,
  autoValue,
  savedValue,
  onSave,
}: {
  month: string;
  autoValue: number | null;
  savedValue: number | null | undefined;
  onSave: (month: string, value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Effective display value: savedValue if present, else autoValue
  const displayValue = savedValue != null ? savedValue : autoValue;
  const [draft, setDraft] = useState(displayValue != null ? String(displayValue) : "");

  // Sync draft when savedValue changes externally (e.g. year switch)
  useEffect(() => {
    const v = savedValue != null ? savedValue : autoValue;
    setDraft(v != null ? String(v) : "");
  }, [savedValue, autoValue]);

  function commit() {
    const num = parseFloat(draft);
    if (!isNaN(num)) onSave(month, num);
    setEditing(false);
  }

  function cancel() {
    const v = savedValue != null ? savedValue : autoValue;
    setDraft(v != null ? String(v) : "");
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between text-xs py-0.5 gap-2">
      <span className="text-muted-foreground shrink-0">{formatMonthLabel(month)}</span>
      {editing ? (
        <div className="flex items-center gap-1 ml-auto">
          <Input
            type="number"
            step="0.01"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="h-6 w-28 text-xs px-1.5"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          />
          <button onClick={commit} className="text-emerald-500 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 ml-auto">
          <span className={displayValue == null ? "text-muted-foreground" : displayValue >= 0 ? "value-positive" : "value-negative"}>
            {displayValue != null ? formatCurrency(displayValue) : "—"}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
            title="Edit this month's petty cash"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline-editable big spending row ─────────────────────────────────────────
function BigSpendingRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: AnnualBigSpending;
  onUpdate: (id: number, item: string, amount: number) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftItem, setDraftItem] = useState(entry.item);
  const [draftAmount, setDraftAmount] = useState(String(entry.amount));

  useEffect(() => {
    setDraftItem(entry.item);
    setDraftAmount(String(entry.amount));
  }, [entry.item, entry.amount]);

  function commit() {
    const num = parseFloat(draftAmount);
    if (!draftItem.trim() || isNaN(num) || num <= 0) return;
    onUpdate(entry.id, draftItem.trim(), num);
    setEditing(false);
  }

  function cancel() {
    setDraftItem(entry.item);
    setDraftAmount(String(entry.amount));
    setEditing(false);
  }

  return (
    <tr className="group border-b last:border-0" data-testid={`row-big-spending-${entry.id}`}>
      {editing ? (
        <>
          <td className="py-1.5 pr-2">
            <Input
              value={draftItem}
              onChange={e => setDraftItem(e.target.value)}
              className="h-6 text-xs px-1.5"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
              data-testid={`input-big-spending-item-${entry.id}`}
            />
          </td>
          <td className="py-1.5 pr-2">
            <Input
              type="number"
              step="0.01"
              value={draftAmount}
              onChange={e => setDraftAmount(e.target.value)}
              className="h-6 w-28 text-xs px-1.5"
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
              data-testid={`input-big-spending-amount-${entry.id}`}
            />
          </td>
          <td className="py-1.5 text-right">
            <div className="flex items-center justify-end gap-1">
              <button onClick={commit} className="text-emerald-500 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="py-2 text-sm">{entry.item}</td>
          <td className="py-2 text-sm text-right value-negative pr-2">−{formatCurrency(entry.amount)}</td>
          <td className="py-2 text-right">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground"
                title="Edit"
                data-testid={`button-edit-big-spending-${entry.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="text-destructive hover:text-destructive/80"
                title="Delete"
                data-testid={`button-delete-big-spending-${entry.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </>
      )}
    </tr>
  );
}

export default function Savings() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(getFiscalYear(currentMonth()));
  const [thirteenth, setThirteenth] = useState("");
  const [bonus, setBonus] = useState("");
  const [regularSaving, setRegularSaving] = useState("");
  const [note, setNote] = useState("");
  // Extra years added manually via the + button
  const [extraYears, setExtraYears] = useState<string[]>([]);
  // Default years the user has dismissed (no saved data, just hiding from list)
  const [hiddenDefaultYears, setHiddenDefaultYears] = useState<Set<string>>(new Set());
  // State for the "add year" inline input
  const [addingYear, setAddingYear] = useState(false);
  const [newYearDraft, setNewYearDraft] = useState("");
  // Big spending add form
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");

  const { data: allSavings = [] } = useQuery<AnnualSavings[]>({ queryKey: ["/api/annual-savings"] });
  const { data: monthSummaries = [] } = useQuery<MonthSummary[]>({ queryKey: ["/api/month-summaries"] });
  const { data: bigSpending = [] } = useQuery<AnnualBigSpending[]>({
    queryKey: ["/api/big-spending", selectedYear],
  });

  const saveMutation = useMutation({
    mutationFn: (data: InsertAnnualSavings) => apiRequest("PUT", `/api/annual-savings/${selectedYear}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/annual-savings"] });
      toast({ title: "Annual savings updated" });
    },
  });

  const deleteSavingsMutation = useMutation({
    mutationFn: (fy: string) => apiRequest("DELETE", `/api/annual-savings/${fy}`),
    onSuccess: (_, fy) => {
      queryClient.invalidateQueries({ queryKey: ["/api/annual-savings"] });
      // Remove from extraYears if it was manually added
      setExtraYears(prev => prev.filter(y => y !== fy));
      // Switch to current fiscal year if we deleted the selected one
      if (selectedYear === fy) {
        setSelectedYear(getFiscalYear(currentMonth()));
        setThirteenth(""); setBonus(""); setRegularSaving(""); setNote("");
      }
      toast({ title: `FY ${fy} deleted` });
    },
  });

  // Mutation to manually override a month's petty cash
  const savePettyMutation = useMutation({
    mutationFn: (data: InsertMonthSummary) => apiRequest("POST", "/api/month-summaries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/month-summaries"] });
      toast({ title: "Petty cash updated" });
    },
  });

  // ── Big spending mutations ────────────────────────────────────────────────────
  const addBigSpendingMutation = useMutation({
    mutationFn: (data: { fiscalYear: string; item: string; amount: number }) =>
      apiRequest("POST", "/api/big-spending", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/big-spending", selectedYear] });
      setNewItemName("");
      setNewItemAmount("");
      toast({ title: "Big spending item added" });
    },
  });

  const updateBigSpendingMutation = useMutation({
    mutationFn: ({ id, item, amount }: { id: number; item: string; amount: number }) =>
      apiRequest("PUT", `/api/big-spending/${id}`, { item, amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/big-spending", selectedYear] });
      toast({ title: "Item updated" });
    },
  });

  const deleteBigSpendingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/big-spending/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/big-spending", selectedYear] });
      toast({ title: "Item deleted" });
    },
  });

  // Build the full list: defaults + already-saved + manually added, minus dismissed ones
  const savedFiscalYears = allSavings.map(s => s.fiscalYear);
  const visibleYears = Array.from(
    new Set([...getDefaultFiscalYears(savedFiscalYears), ...extraYears])
  )
    .filter(fy => !hiddenDefaultYears.has(fy) || savedFiscalYears.includes(fy))
    .sort().reverse();

  function handleAddYear() {
    const trimmed = newYearDraft.trim();
    if (!isValidFiscalYear(trimmed)) {
      toast({ title: "Invalid format", description: "Use YYYY-YYYY, e.g. 2027-2028", variant: "destructive" });
      return;
    }
    setExtraYears(prev => Array.from(new Set([...prev, trimmed])));
    setSelectedYear(trimmed);
    setThirteenth(""); setBonus(""); setRegularSaving(""); setNote("");
    setAddingYear(false);
    setNewYearDraft("");
  }

  const currentSavings = allSavings.find(s => s.fiscalYear === selectedYear);
  const fiscalMonths = getFiscalMonths(selectedYear);

  // Petty cash: use saved value if present, else 0 (auto-calculated values come from MonthlyEntry "Save Remaining")
  const pettyCarriedOver = fiscalMonths.reduce((sum, m) => {
    const summary = monthSummaries.find(s => s.month === m);
    return sum + (summary?.remainingPettyCash ?? 0);
  }, 0);

  const thirteenthNum = parseFloat(thirteenth || String(currentSavings?.thirteenthSalary || 0));
  const bonusNum = parseFloat(bonus || String(currentSavings?.bonus || 0));
  const regularNum = parseFloat(regularSaving || String(currentSavings?.regularSaving || 0));

  // Big spending total (deduction from savings)
  const bigSpendingTotal = bigSpending.reduce((sum, item) => sum + item.amount, 0);

  const totalSavings = thirteenthNum + bonusNum + regularNum + pettyCarriedOver - bigSpendingTotal;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      fiscalYear: selectedYear,
      thirteenthSalary: thirteenthNum,
      bonus: bonusNum,
      regularSaving: regularNum,
      note: note || currentSavings?.note || null,
    });
  }

  function loadSavedData() {
    if (currentSavings) {
      setThirteenth(String(currentSavings.thirteenthSalary));
      setBonus(String(currentSavings.bonus));
      setRegularSaving(String(currentSavings.regularSaving));
      setNote(currentSavings.note || "");
    }
  }

  function handlePettyCashEdit(month: string, value: number) {
    savePettyMutation.mutate({ month, remainingPettyCash: value, note: null });
  }

  function handleAddBigSpending() {
    const name = newItemName.trim();
    const amount = parseFloat(newItemAmount);
    if (!name) {
      toast({ title: "Enter an item name", variant: "destructive" });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid positive amount", variant: "destructive" });
      return;
    }
    addBigSpendingMutation.mutate({ fiscalYear: selectedYear, item: name, amount });
  }

  // ── Year-on-year chart data ──────────────────────────────────────────────────
  const chartData = allSavings.map(s => {
    const fy = s.fiscalYear;
    const sFiscalMonths = getFiscalMonths(fy);
    const sPetty = sFiscalMonths.reduce((sum, m) => {
      const ms = monthSummaries.find(ms => ms.month === m);
      return sum + (ms?.remainingPettyCash ?? 0);
    }, 0);
    // Note: chart uses raw savings without big spending deductions for simplicity
    const tot = s.thirteenthSalary + s.bonus + s.regularSaving + sPetty;
    // Compact label: "2025-2026" → "25/26"
    const [a, b] = fy.split("-");
    const label = `${a.slice(2)}/${b.slice(2)}`;
    return { fy, label, total: tot };
  }).sort((a, b) => a.fy.localeCompare(b.fy));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Annual Savings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fiscal year runs Apr to Mar. Savings = 13th month salary + bonus + regular saving + petty cash carried over − big spending.
        </p>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground shrink-0">Fiscal Year:</Label>

        {visibleYears.map(fy => {
          const hasSavedData = savedFiscalYears.includes(fy);
          const isActive = selectedYear === fy;
          return (
            <div key={fy} className="group relative flex items-center">
              <button
                onClick={() => { setSelectedYear(fy); setThirteenth(""); setBonus(""); setRegularSaving(""); setNote(""); }}
                className={`pl-3 pr-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
                data-testid={`button-fy-${fy}`}
              >
                {fy}
                {/* Trash — visible on hover for every pill */}
                <span
                  role="button"
                  onClick={e => {
                    e.stopPropagation();
                    // If there's saved data, delete from DB; otherwise just hide from list
                    if (hasSavedData) {
                      deleteSavingsMutation.mutate(fy);
                    } else {
                      // Remove from extraYears (manually added) or add to hidden set
                      setExtraYears(prev => prev.filter(y => y !== fy));
                      setHiddenDefaultYears(prev => new Set([...prev, fy]));
                      if (selectedYear === fy) {
                        setSelectedYear(getFiscalYear(currentMonth()));
                        setThirteenth(""); setBonus(""); setRegularSaving(""); setNote("");
                      }
                      toast({ title: `FY ${fy} removed` });
                    }
                  }}
                  className={`ml-0.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isActive
                      ? "hover:bg-white/20 text-primary-foreground"
                      : "hover:bg-destructive/20 text-destructive"
                  }`}
                  title={`Remove FY ${fy}`}
                  data-testid={`button-delete-fy-${fy}`}
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </button>
            </div>
          );
        })}

        {/* Add fiscal year */}
        {addingYear ? (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              value={newYearDraft}
              onChange={e => setNewYearDraft(e.target.value)}
              placeholder="e.g. 2027-2028"
              className="h-7 w-32 text-xs font-mono px-2"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleAddYear(); if (e.key === "Escape") { setAddingYear(false); setNewYearDraft(""); } }}
              data-testid="input-add-fiscal-year"
            />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-600" onClick={handleAddYear} data-testid="button-confirm-add-year">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => { setAddingYear(false); setNewYearDraft(""); }} data-testid="button-cancel-add-year">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <TooltipProvider delayDuration={300}>
            <UITooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setAddingYear(true)}
                  className="h-7 w-7 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center"
                  data-testid="button-add-fiscal-year"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Add a future fiscal year (e.g. 2027-2028)
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Savings form */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">FY {selectedYear} Savings</CardTitle>
            {currentSavings && (
              <TooltipProvider delayDuration={300}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={loadSavedData} data-testid="button-load-saved">
                      Load saved
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-56 text-xs leading-relaxed">
                    Fills the form with your previously saved values for this fiscal year.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-3" data-testid="form-annual-savings">
              <div className="space-y-1">
                <Label className="text-xs">13th Month Salary (collected in March)</Label>
                <Input
                  type="number" step="0.01" value={thirteenth}
                  onChange={e => setThirteenth(e.target.value)}
                  placeholder={String(currentSavings?.thirteenthSalary ?? 0)}
                  className="h-8 text-sm"
                  data-testid="input-thirteenth"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bonus (March)</Label>
                <Input
                  type="number" step="0.01" value={bonus}
                  onChange={e => setBonus(e.target.value)}
                  placeholder={String(currentSavings?.bonus ?? 0)}
                  className="h-8 text-sm"
                  data-testid="input-bonus"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Regular Saving (full year)</Label>
                <Input
                  type="number" step="0.01" value={regularSaving}
                  onChange={e => setRegularSaving(e.target.value)}
                  placeholder={String(currentSavings?.regularSaving ?? 0)}
                  className="h-8 text-sm"
                  data-testid="input-regular-saving"
                />
              </div>

              {/* Petty cash — editable per month */}
              <div className="rounded-md bg-muted p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Petty cash carried over</span>
                  <span className={pettyCarriedOver >= 0 ? "value-positive" : "value-negative"}>
                    {formatCurrency(pettyCarriedOver)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Values are automatically synced from Monthly Entry. Click the pencil icon to manually override any month.
                </p>
                <div className="mt-1 space-y-0 group">
                  {fiscalMonths.map(m => {
                    const s = monthSummaries.find(ms => ms.month === m);
                    return (
                      <PettyCashRow
                        key={m}
                        month={m}
                        autoValue={null}
                        savedValue={s?.remainingPettyCash ?? null}
                        onSave={handlePettyCashEdit}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Apr 2025 - Mar 2026"
                  className="text-sm h-16 resize-none"
                  data-testid="input-savings-note"
                />
              </div>

              <TooltipProvider delayDuration={300}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button type="submit" size="sm" className="w-full" disabled={saveMutation.isPending} data-testid="button-save-savings">
                      {saveMutation.isPending ? "Saving..." : "Save Annual Savings"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-56 text-xs leading-relaxed">
                    Saves your annual savings record (13th month + bonus + regular saving + petty cash carry-over) for this fiscal year.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </form>
          </CardContent>
        </Card>

        {/* Right column: summary + all years table */}
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Savings — FY {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "13th month salary", value: thirteenthNum },
                { label: "Bonus (March)", value: bonusNum },
                { label: "Regular saving", value: regularNum },
                { label: "Petty cash carried over", value: pettyCarriedOver },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={value < 0 ? "value-negative" : ""}>{formatCurrency(value)}</span>
                </div>
              ))}
              {bigSpendingTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Big spending deductions</span>
                  <span className="value-negative">−{formatCurrency(bigSpendingTotal)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className={`text-lg ${totalSavings >= 0 ? "value-positive" : "value-negative"}`}>
                  {formatCurrency(totalSavings)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* All years table */}
          {allSavings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">All Years</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 text-xs text-muted-foreground font-medium">FY</th>
                      <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Regular</th>
                      <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Bonus</th>
                      <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSavings.map(s => {
                      const sFiscalMonths = getFiscalMonths(s.fiscalYear);
                      const sPetty = sFiscalMonths.reduce((sum, m) => {
                        const ms = monthSummaries.find(ms => ms.month === m);
                        return sum + (ms?.remainingPettyCash ?? 0);
                      }, 0);
                      const tot = s.thirteenthSalary + s.bonus + s.regularSaving + sPetty;
                      return (
                        <tr key={s.fiscalYear} className="border-b last:border-0" data-testid={`row-savings-${s.fiscalYear}`}>
                          <td className="py-2 text-sm">{s.fiscalYear}</td>
                          <td className="py-2 pr-3 text-sm text-right">{formatCurrency(s.regularSaving)}</td>
                          <td className="py-2 pr-3 text-sm text-right">{formatCurrency(s.bonus)}</td>
                          <td className="py-2 text-sm text-right font-semibold value-positive">{formatCurrency(tot)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Big Spending Items ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Big Spending Items — FY {selectedYear}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Large one-off purchases that are deducted from total savings.
              </p>
            </div>
            {bigSpendingTotal > 0 && (
              <span className="text-sm font-semibold value-negative">
                Total deduction: −{formatCurrency(bigSpendingTotal)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Unified table: add row + existing items */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Item</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium w-36">Amount</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {/* Add new item row */}
                <tr className="border-b bg-muted/20">
                  <td className="py-2 px-3">
                    <Input
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      placeholder="e.g. New laptop, Holiday trip"
                      className="h-7 text-sm border-dashed"
                      onKeyDown={e => { if (e.key === "Enter") handleAddBigSpending(); }}
                      data-testid="input-new-big-spending-item"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={newItemAmount}
                      onChange={e => setNewItemAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-7 text-sm text-right border-dashed"
                      onKeyDown={e => { if (e.key === "Enter") handleAddBigSpending(); }}
                      data-testid="input-new-big-spending-amount"
                    />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <TooltipProvider delayDuration={300}>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={handleAddBigSpending}
                            disabled={addBigSpendingMutation.isPending}
                            data-testid="button-add-big-spending"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Add a big spending item for FY {selectedYear}
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </td>
                </tr>

                {/* Existing items */}
                {bigSpending.length > 0 ? (
                  bigSpending.map(entry => (
                    <BigSpendingRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(id, item, amount) => updateBigSpendingMutation.mutate({ id, item, amount })}
                      onDelete={id => deleteBigSpendingMutation.mutate(id)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-xs text-muted-foreground">
                      No big spending items yet — add one above.
                    </td>
                  </tr>
                )}
              </tbody>
              {bigSpendingTotal > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/40">
                    <td className="py-2 px-3 text-sm font-semibold">Total deduction</td>
                    <td className="py-2 px-3 text-sm font-semibold text-right value-negative">
                      −{formatCurrency(bigSpendingTotal)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Year-on-year savings chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Savings Year on Year</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={32} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  labelFormatter={(label: string) => `FY ${label}`}
                />
                <Bar dataKey="total" name="Total Savings" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.fy === selectedYear ? "hsl(var(--primary))" : "hsl(var(--chart-1))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Highlighted bar = currently selected fiscal year
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
