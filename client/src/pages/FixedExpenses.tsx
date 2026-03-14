import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { formatCurrency, formatMonthLabel, currentMonth } from "@/lib/utils";
import type { FixedItem, InsertFixedItem } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function EditableRow({ item, onSave, onDelete }: {
  item: FixedItem;
  onSave: (id: number, updated: InsertFixedItem) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [effectiveFrom, setEffectiveFrom] = useState(item.effectiveFrom);

  function save() {
    onSave(item.id, { name, amount: parseFloat(amount), type: item.type, effectiveFrom });
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b bg-accent/30">
        <td className="py-1.5 pr-2"><Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-xs w-full" data-testid={`input-edit-name-${item.id}`} /></td>
        <td className="py-1.5 pr-2"><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-7 text-xs w-24" data-testid={`input-edit-amount-${item.id}`} /></td>
        <td className="py-1.5 pr-2"><Input type="month" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-7 text-xs w-32" data-testid={`input-edit-from-${item.id}`} /></td>
        <td className="py-1.5">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary" onClick={save} data-testid={`button-save-item-${item.id}`}><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(false)} data-testid={`button-cancel-edit-${item.id}`}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0 group" data-testid={`row-fixed-${item.id}`}>
      <td className="py-2 pr-3 text-sm">{item.name}</td>
      <td className={`py-2 pr-3 text-sm font-mono text-right ${item.amount < 0 ? "value-negative" : "value-positive"}`}>{formatCurrency(item.amount)}</td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatMonthLabel(item.effectiveFrom)}</td>
      <td className="py-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(true)} data-testid={`button-edit-item-${item.id}`}><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onDelete(item.id)} data-testid={`button-delete-item-${item.id}`}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </div>
      </td>
    </tr>
  );
}

export default function FixedExpenses() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"income" | "debit" | "saving">("debit");
  const [newFrom, setNewFrom] = useState(currentMonth());

  const { data: fixedItems = [], isLoading } = useQuery<FixedItem[]>({ queryKey: ["/api/fixed-items"] });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id?: number; data: InsertFixedItem }) =>
      id ? apiRequest("PUT", `/api/fixed-items/${id}`, data) : apiRequest("POST", "/api/fixed-items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-items"] });
      toast({ title: "Fixed item saved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/fixed-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-items"] });
      toast({ title: "Fixed item deleted" });
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newAmount) return;
    saveMutation.mutate({ data: { name: newName, amount: parseFloat(newAmount), type: newType, effectiveFrom: newFrom } });
    setNewName(""); setNewAmount("");
  }

  const incomeItems = fixedItems.filter(f => f.type === "income" || f.type === "saving");
  const debitItems = fixedItems.filter(f => f.type === "debit");
  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
  const totalDebit = debitItems.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Fixed Expenses</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Changes apply from the specified month onwards. Old records are kept for historical accuracy.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Income / Credits */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Income &amp; Credits</CardTitle>
            <Badge variant="secondary" className="text-xs">{formatCurrency(totalIncome)} net</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="text-left py-1.5 pr-3 text-xs text-muted-foreground font-medium">From</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {incomeItems.map(item => (
                    <EditableRow
                      key={item.id} item={item}
                      onSave={(id, data) => saveMutation.mutate({ id, data })}
                      onDelete={id => deleteMutation.mutate(id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Debit items */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Fixed Deductions</CardTitle>
            <Badge variant="destructive" className="text-xs">{formatCurrency(totalDebit)} total</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-right py-1.5 pr-3 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="text-left py-1.5 pr-3 text-xs text-muted-foreground font-medium">From</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {debitItems.map(item => (
                    <EditableRow
                      key={item.id} item={item}
                      onSave={(id, data) => saveMutation.mutate({ id, data })}
                      onDelete={id => deleteMutation.mutate(id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add new item */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add New Fixed Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="form-add-fixed">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. New subscription" className="h-8 text-sm" required data-testid="input-new-fixed-name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (HK$)</Label>
              <Input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" required data-testid="input-new-fixed-amount" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-new-fixed-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income / Credit</SelectItem>
                  <SelectItem value="saving">Saving (deducted)</SelectItem>
                  <SelectItem value="debit">Fixed Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Effective From</Label>
              <div className="flex gap-2">
                <Input type="month" value={newFrom} onChange={e => setNewFrom(e.target.value)} className="h-8 text-sm flex-1" data-testid="input-new-fixed-from" />
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="submit" size="sm" className="h-8 shrink-0" disabled={saveMutation.isPending} data-testid="button-add-fixed">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-56 text-xs leading-relaxed">
                      Adds this new income or expense item. Changes apply from the month you set in "Effective From".
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
