import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { formatCurrency, formatMonthLabel, currentMonth } from "@/lib/utils";
import type { FoodSettings as FoodSettingsType, InsertFoodSettings } from "@shared/schema";

export default function FoodSettings() {
  const { toast } = useToast();
  const [breakfast, setBreakfast] = useState("40");
  const [lunch, setLunch] = useState("75");
  const [days, setDays] = useState("30");
  const [effectiveFrom, setEffectiveFrom] = useState(currentMonth());

  const { data: settingsList = [], isLoading } = useQuery<FoodSettingsType[]>({ queryKey: ["/api/food-settings"] });

  const saveMutation = useMutation({
    mutationFn: (data: InsertFoodSettings) => apiRequest("POST", "/api/food-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food-settings"] });
      toast({ title: "Food budget settings saved" });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      breakfastCost: parseFloat(breakfast),
      lunchCost: parseFloat(lunch),
      days: parseInt(days),
      effectiveFrom,
    });
  };

  const sortedSettings = [...settingsList].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Food Budget Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          The baseline food budget is calculated as (breakfast + lunch) × days per month. 
          Changes are applied from the effective month onwards.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Settings form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Set New Food Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-3" data-testid="form-food-settings">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Breakfast / day ($)</Label>
                  <Input
                    type="number" step="0.5" value={breakfast}
                    onChange={e => setBreakfast(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-breakfast-cost"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lunch / day ($)</Label>
                  <Input
                    type="number" step="0.5" value={lunch}
                    onChange={e => setLunch(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-lunch-cost"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Days / month</Label>
                  <Input
                    type="number" value={days}
                    onChange={e => setDays(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-days"
                  />
                </div>
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">Monthly baseline</p>
                <p className="text-muted-foreground mt-0.5">
                  Breakfast: ${breakfast} × {days} = {formatCurrency(parseFloat(breakfast || "0") * parseInt(days || "0"))}
                </p>
                <p className="text-muted-foreground">
                  Lunch: ${lunch} × {days} = {formatCurrency(parseFloat(lunch || "0") * parseInt(days || "0"))}
                </p>
                <p className="font-semibold text-primary mt-1">
                  Total: {formatCurrency((parseFloat(breakfast || "0") + parseFloat(lunch || "0")) * parseInt(days || "0"))}/month
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Effective From</Label>
                <Input
                  type="month" value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="h-8 text-sm w-40"
                  data-testid="input-food-effective-from"
                />
              </div>

              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">How food delta entries work</p>
                <p>You record the <strong>difference</strong> from the daily baseline — not the actual amount paid.</p>
                <p>• Lunch costs $250 (vs $75 baseline) → record <strong>+175</strong></p>
                <p>• Skipped breakfast → record <strong>−40</strong> (saved that day)</p>
                <p>• Dinner out (no baseline) → record <strong>+full amount</strong></p>
              </div>

              <Button type="submit" size="sm" disabled={saveMutation.isPending} data-testid="button-save-food-settings">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {saveMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Settings History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : sortedSettings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No settings saved yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 text-xs text-muted-foreground font-medium">From</th>
                    <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Breakfast</th>
                    <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Lunch</th>
                    <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSettings.map(s => (
                    <tr key={s.id} className="border-b last:border-0" data-testid={`row-food-setting-${s.id}`}>
                      <td className="py-2 text-sm">{formatMonthLabel(s.effectiveFrom)}</td>
                      <td className="py-2 pr-3 text-sm text-right">{formatCurrency(s.breakfastCost)}</td>
                      <td className="py-2 pr-3 text-sm text-right">{formatCurrency(s.lunchCost)}</td>
                      <td className="py-2 text-sm text-right">{s.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
