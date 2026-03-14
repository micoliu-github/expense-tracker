/**
 * Grocery page
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone grocery log. Not connected to Monthly Entry totals.
 * Features:
 *  • Month selector (free-type text, YYYY-MM)
 *  • Add entry inline: date (YYYY-MM-DD), item (optional), category (Food | Household), amount
 *  • Editable / deletable rows
 *  • Bar chart — monthly totals (last 12 months with data)
 *  • Pie chart — category spending % for selected month
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, Check, X, Plus, ShoppingCart } from "lucide-react";
import { formatCurrency, formatMonthLabel, currentMonth } from "@/lib/utils";
import type { GroceryItem } from "@shared/schema";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const CATEGORIES = ["Food", "Household"] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLORS: Record<Category, string> = {
  Food:      "hsl(var(--chart-1))",
  Household: "hsl(var(--chart-2))",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Inline-editable row ───────────────────────────────────────────────────────
function GroceryRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: GroceryItem;
  onUpdate: (id: number, patch: Partial<Pick<GroceryItem, "date" | "item" | "category" | "amount">>) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate]       = useState(entry.date);
  const [item, setItem]       = useState(entry.item);
  const [cat, setCat]         = useState<Category>(entry.category as Category);
  const [amt, setAmt]         = useState(String(entry.amount));

  function commit() {
    const num = parseFloat(amt);
    if (isNaN(num) || num <= 0) return;
    onUpdate(entry.id, { date, item, category: cat, amount: num });
    setEditing(false);
  }
  function cancel() {
    setDate(entry.date); setItem(entry.item);
    setCat(entry.category as Category); setAmt(String(entry.amount));
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b border-border bg-muted/30">
        <td className="px-3 py-1.5">
          <Input type="text" value={date} onChange={e => setDate(e.target.value)}
            placeholder="YYYY-MM-DD" className="h-7 text-xs w-28 px-1.5" />
        </td>
        <td className="px-3 py-1.5">
          <Input type="text" value={item} onChange={e => setItem(e.target.value)}
            placeholder="Item (optional)" className="h-7 text-xs px-1.5 w-full" />
        </td>
        <td className="px-3 py-1.5">
          <Select value={cat} onValueChange={v => setCat(v as Category)}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-1.5 text-right">
          <Input type="number" step="0.01" min="0" value={amt}
            onChange={e => setAmt(e.target.value)}
            className="h-7 text-xs w-24 px-1.5 text-right ml-auto" />
        </td>
        <td className="px-3 py-1.5 text-right whitespace-nowrap">
          <button onClick={commit} className="text-emerald-500 hover:text-emerald-600 mr-1" data-testid={`btn-commit-${entry.id}`}>
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} className="text-muted-foreground hover:text-foreground" data-testid={`btn-cancel-${entry.id}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border group hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 text-xs text-muted-foreground">{entry.date}</td>
      <td className="px-3 py-2 text-xs">{entry.item || <span className="text-muted-foreground italic">—</span>}</td>
      <td className="px-3 py-2 text-xs">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          entry.category === "Food"
            ? "bg-chart-1/10 text-chart-1"
            : "bg-chart-2/10 text-chart-2"
        }`} style={{
          background: entry.category === "Food" ? "hsl(var(--chart-1) / 0.12)" : "hsl(var(--chart-2) / 0.12)",
          color: entry.category === "Food" ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))",
        }}>
          {entry.category}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-right font-medium tabular-nums">{formatCurrency(entry.amount)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-1.5"
          data-testid={`btn-edit-grocery-${entry.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`btn-delete-grocery-${entry.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Grocery() {
  const { toast } = useToast();
  const [month, setMonth]     = useState(currentMonth());
  const [monthInput, setMonthInput] = useState(currentMonth());

  // Add-row state
  const [newDate, setNewDate]   = useState(todayString());
  const [newItem, setNewItem]   = useState("");
  const [newCat, setNewCat]     = useState<Category>("Food");
  const [newAmt, setNewAmt]     = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery<GroceryItem[]>({
    queryKey: ["/api/grocery", month],
    queryFn: () => fetch(`/api/grocery?month=${month}`).then(r => r.json()),
  });

  const { data: allItems = [] } = useQuery<GroceryItem[]>({
    queryKey: ["/api/grocery"],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/grocery", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery"] });
      setNewItem(""); setNewAmt("");
      toast({ title: "Grocery entry added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<GroceryItem> }) =>
      apiRequest("PUT", `/api/grocery/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery"] });
      toast({ title: "Entry updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/grocery/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grocery"] });
      toast({ title: "Entry deleted" });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(newAmt);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    addMutation.mutate({ month, date: newDate, item: newItem, category: newCat, amount: amountNum });
  }

  function applyMonth() {
    const trimmed = monthInput.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      setMonth(trimmed);
    } else {
      toast({ title: "Enter month as YYYY-MM", variant: "destructive" });
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const monthTotal = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);

  // Pie chart: category breakdown for selected month
  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const it of items) {
      totals[it.category] = (totals[it.category] ?? 0) + it.amount;
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  // Bar chart: last ≤12 months with data, sorted chronologically
  const barData = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const it of allItems) {
      totals[it.month] = (totals[it.month] ?? 0) + it.amount;
    }
    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([m, total]) => ({ month: formatMonthLabel(m), total: Math.round(total * 100) / 100 }));
  }, [allItems]);

  // ── Category totals for selected month ────────────────────────────────────
  const catTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const it of items) {
      out[it.category] = (out[it.category] ?? 0) + it.amount;
    }
    return out;
  }, [items]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
        <div>
          <h1 className="text-lg font-semibold">Grocery</h1>
          <p className="text-xs text-muted-foreground">Log grocery purchases. Totals are independent from Monthly Entry.</p>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Input
            type="text"
            value={monthInput}
            onChange={e => setMonthInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") applyMonth(); }}
            placeholder="YYYY-MM"
            className="h-8 w-32 text-xs"
            data-testid="input-grocery-month"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyMonth} data-testid="btn-apply-month">
          Go
        </Button>
        <span className="text-sm font-medium ml-2">{formatMonthLabel(month)}</span>
        <span className="text-sm text-muted-foreground ml-auto">Total: <span className="font-semibold text-foreground">{formatCurrency(monthTotal)}</span></span>
      </div>

      {/* Add entry form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddEntry} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Date */}
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="text"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="h-8 text-xs"
                data-testid="input-new-date"
              />
            </div>
            {/* Item */}
            <div className="space-y-1">
              <Label className="text-xs">Item <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="text"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="e.g. Milk, Rice…"
                className="h-8 text-xs"
                data-testid="input-new-item"
              />
            </div>
            {/* Category */}
            <div className="space-y-1">
              <Label className="text-xs">Category <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={newCat} onValueChange={v => setNewCat(v as Category)}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-new-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Amount */}
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAmt}
                  onChange={e => setNewAmt(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs flex-1"
                  data-testid="input-new-amount"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3"
                  disabled={addMutation.isPending}
                  data-testid="btn-add-entry"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Entry table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Entries — {formatMonthLabel(month)}</span>
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">{items.length} item{items.length !== 1 ? "s" : ""}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No entries for {formatMonthLabel(month)} yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Item</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(entry => (
                    <GroceryRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
                      onDelete={id => deleteMutation.mutate(id)}
                    />
                  ))}
                  {/* Total row */}
                  <tr className="bg-muted/20 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-xs text-muted-foreground">Total</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{formatCurrency(monthTotal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart — monthly totals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Grocery Expense</CardTitle>
            <p className="text-xs text-muted-foreground">Last months with recorded data</p>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={v => `$${v}`}
                    width={52}
                  />
                  <RTooltip
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart — category breakdown for selected month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Category Breakdown — {formatMonthLabel(month)}</CardTitle>
            <p className="text-xs text-muted-foreground">Spending by category for this month</p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No data for this month</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={CAT_COLORS[entry.name as Category] ?? "hsl(var(--chart-3))"}
                        />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(value: number) => [formatCurrency(value), ""]}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Category totals table */}
                <div className="mt-2 space-y-1">
                  {Object.entries(catTotals)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, total]) => (
                      <div key={cat} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                            background: CAT_COLORS[cat as Category] ?? "hsl(var(--chart-3))"
                          }} />
                          <span className="text-muted-foreground">{cat}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-medium">{formatCurrency(total)}</span>
                          <span className="text-muted-foreground tabular-nums w-10 text-right">
                            {monthTotal > 0 ? `${((total / monthTotal) * 100).toFixed(0)}%` : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
