import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMonthLabel, getFiscalYear, getFiscalMonths, currentMonth } from "@/lib/utils";
import type { Expense, FixedItem, MonthSummary, FoodSettings } from "@shared/schema";
import { TrendingUp, TrendingDown, Wallet, ShoppingBag, Utensils, ShoppingCart } from "lucide-react";

const CATEGORY_COLORS = {
  food: "hsl(var(--chart-3))",
  shopping: "hsl(var(--chart-2))",
  grocery: "hsl(var(--chart-1))",
};

function StatCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string; value: string; subtitle?: string; icon: any; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="rounded-lg p-2 bg-accent">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const month = currentMonth();
  const fiscalYear = getFiscalYear(month);
  const fiscalMonths = getFiscalMonths(fiscalYear);

  const { data: allExpenses = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: fixedItems = [] } = useQuery<FixedItem[]>({ queryKey: ["/api/fixed-items"] });
  const { data: foodSettingsList = [] } = useQuery<FoodSettings[]>({ queryKey: ["/api/food-settings"] });
  const { data: monthSummaries = [] } = useQuery<MonthSummary[]>({ queryKey: ["/api/month-summaries"] });

  // Current month calculations
  const thisMonthExpenses = allExpenses.filter(e => e.month === month);
  const effectiveFoodSettings = getEffective(foodSettingsList, month) ?? { breakfastCost: 40, lunchCost: 75, days: 30 };
  const foodMonthly = effectiveFoodSettings.breakfastCost * effectiveFoodSettings.days +
    effectiveFoodSettings.lunchCost * effectiveFoodSettings.days;
  const effectiveFixed = getEffectiveItems(fixedItems.filter(f => f.type === "income" || f.type === "saving"), month);
  const effectiveDebit = getEffectiveItems(fixedItems.filter(f => f.type === "debit"), month);
  const totalIncome = effectiveFixed.reduce((s, i) => s + i.amount, 0);
  const totalDebit = effectiveDebit.reduce((s, i) => s + i.amount, 0);
  const pettyCash = totalIncome - totalDebit - foodMonthly;

  const foodExpenses = thisMonthExpenses.filter(e => e.category === "food");
  const shoppingExpenses = thisMonthExpenses.filter(e => e.category === "shopping");
  const groceryExpenses = thisMonthExpenses.filter(e => e.category === "grocery");

  const foodTotal = foodExpenses.reduce((s, e) => s + e.amount, 0);
  const shoppingTotal = shoppingExpenses.reduce((s, e) => s + e.amount, 0);
  const groceryTotal = groceryExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIrregular = foodTotal + shoppingTotal + groceryTotal;
  const remaining = pettyCash - totalIrregular;

  // Monthly bar chart data (fiscal year)
  const monthlyData = fiscalMonths.map(m => {
    const mExpenses = allExpenses.filter(e => e.month === m);
    const mFood = mExpenses.filter(e => e.category === "food").reduce((s, e) => s + e.amount, 0);
    const mShopping = mExpenses.filter(e => e.category === "shopping").reduce((s, e) => s + e.amount, 0);
    const mGrocery = mExpenses.filter(e => e.category === "grocery").reduce((s, e) => s + e.amount, 0);
    return {
      name: formatMonthLabel(m).split(" ")[0],
      Food: Math.max(0, mFood),
      Shopping: mShopping,
      Grocery: mGrocery,
    };
  });

  // Petty cash remaining chart (fiscal year)
  const pettyData = fiscalMonths.map(m => {
    const summary = monthSummaries.find(s => s.month === m);
    return {
      name: formatMonthLabel(m).split(" ")[0],
      remaining: summary?.remainingPettyCash ?? 0,
    };
  });

  // Pie chart for current month
  const pieData = [
    { name: "Food extra", value: Math.max(0, foodTotal) },
    { name: "Shopping", value: shoppingTotal },
    { name: "Grocery", value: groceryTotal },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">{formatMonthLabel(month)} — Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Fiscal year {fiscalYear} · Apr to Mar</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Petty Cash" value={formatCurrency(pettyCash)}
          subtitle="After fixed deductions" icon={Wallet}
        />
        <StatCard
          title="Food Extra" value={formatCurrency(foodTotal)}
          subtitle={`Base: ${formatCurrency(foodMonthly)}/mo`} icon={Utensils}
          trend={foodTotal > 0 ? "down" : "up"}
        />
        <StatCard
          title="Shopping Expense" value={formatCurrency(shoppingTotal)}
          subtitle="Petty cash items" icon={ShoppingBag}
        />
        <StatCard
          title="Grocery Expense" value={formatCurrency(groceryTotal)}
          subtitle="This month" icon={ShoppingCart}
        />
      </div>

      {/* Remaining petty cash highlight */}
      <Card className={remaining >= 0 ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"}>
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Remaining Petty Cash — {formatMonthLabel(month)}</p>
            <p className={`text-2xl font-bold mt-1 ${remaining >= 0 ? "value-positive" : "value-negative"}`}>
              {formatCurrency(remaining, true)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pettyCash.toFixed(0)} petty − {totalIrregular.toFixed(0)} spent = {remaining.toFixed(0)}
            </p>
          </div>
          {remaining >= 0 ? <TrendingUp className="h-8 w-8 text-emerald-500" /> : <TrendingDown className="h-8 w-8 text-red-500" />}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Monthly spend bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Irregular Spend — FY {fiscalYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barSize={12}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Food" stackId="a" fill={CATEGORY_COLORS.food} />
                <Bar dataKey="Shopping" stackId="a" fill={CATEGORY_COLORS.shopping} />
                <Bar dataKey="Grocery" stackId="a" fill={CATEGORY_COLORS.grocery} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Petty cash remaining over year */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Petty Cash Remaining — FY {fiscalYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pettyData} barSize={12}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                {pettyData.map((entry, idx) => null)}
                <Bar dataKey="remaining" radius={[3, 3, 0, 0]}>
                  {pettyData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.remaining >= 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pie chart for current month if there's data */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Spend Breakdown — {formatMonthLabel(month)}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={Object.values(CATEGORY_COLORS)[idx % 3]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly summary table */}
      {monthSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Petty Cash Summary — FY {fiscalYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Month</th>
                    <th className="text-right py-2 font-medium text-muted-foreground text-xs">Remaining</th>
                    <th className="text-left py-2 pl-4 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscalMonths.map(m => {
                    const summary = monthSummaries.find(s => s.month === m);
                    const val = summary?.remainingPettyCash ?? null;
                    return (
                      <tr key={m} className="border-b last:border-0">
                        <td className="py-2 pr-4">{formatMonthLabel(m)}</td>
                        <td className={`py-2 text-right font-mono text-xs ${val == null ? "text-muted-foreground" : val >= 0 ? "value-positive" : "value-negative"}`}>
                          {val == null ? "—" : formatCurrency(val)}
                        </td>
                        <td className="py-2 pl-4">
                          {val != null && (
                            <Badge variant={val >= 0 ? "default" : "destructive"} className="text-xs h-5">
                              {val >= 0 ? "Surplus" : "Overspent"}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// helpers
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
