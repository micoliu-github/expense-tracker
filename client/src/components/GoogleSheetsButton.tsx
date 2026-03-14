import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SiGooglesheets } from "react-icons/si";
import { RefreshCw, LogOut, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { formatMonthLabel } from "@/lib/utils";

interface Props {
  month?: string; // if provided, shows sync for just that month
  fullWidth?: boolean;
}

export function GoogleSheetsButton({ month, fullWidth }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery<{ authenticated: boolean }>({
    queryKey: ["/api/google/status"],
    refetchInterval: open ? 3000 : false, // poll while panel is open
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/google/auth").then(r => r.json()),
    onSuccess: (data: { url: string }) => {
      window.open(data.url, "_blank", "width=500,height=600");
      toast({ title: "Google sign-in opened", description: "Complete sign-in in the new window, then come back here." });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/google/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google/status"] });
      toast({ title: "Disconnected from Google Sheets" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => {
      const url = month ? `/api/google/sync/${month}` : "/api/google/sync-all";
      return apiRequest("POST", url).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.success || data.results) {
        toast({ title: month ? `${formatMonthLabel(month)} synced to Google Sheets` : "All months synced to Google Sheets" });
        setOpen(false);
      } else {
        toast({ title: "Sync failed", description: data.error, variant: "destructive" });
      }
    },
  });

  const isAuth = status?.authenticated ?? false;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 text-xs${fullWidth ? " w-full justify-start" : ""}`}
          style={fullWidth ? { background: "hsl(var(--sidebar-accent))", border: "1px solid hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground))" } : undefined}
          data-testid="button-google-sheets"
        >
          <SiGooglesheets className="h-3.5 w-3.5 text-green-600" />
          Google Sheets
          {isAuth && <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SiGooglesheets className="h-5 w-5 text-green-600" />
            Google Sheets Sync
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Connection status */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Status</span>
              <Badge variant={isAuth ? "default" : "secondary"} className="text-xs gap-1">
                {isAuth
                  ? <><CheckCircle className="h-3 w-3" /> Connected</>
                  : <><XCircle className="h-3 w-3" /> Not connected</>
                }
              </Badge>
            </div>

            {isAuth ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connected to your Google account. Syncing will write to your
                  "Household Monthly Expense" spreadsheet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-google"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Sign in with Google to enable syncing your expense data
                  directly to your spreadsheet.
                </p>
                <Button
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  data-testid="button-connect-google"
                >
                  <SiGooglesheets className="h-3.5 w-3.5" />
                  {connectMutation.isPending ? "Opening..." : "Connect Google Account"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => refetchStatus()}
                  data-testid="button-recheck-auth"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  I've signed in — check status
                </Button>
              </div>
            )}
          </div>

          {/* Sync actions */}
          {isAuth && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Sync to Spreadsheet</p>
              <p className="text-xs text-muted-foreground">
                {month
                  ? `Writes ${formatMonthLabel(month)} data to the "${formatMonthLabel(month)}" tab.`
                  : "Writes all months to their respective tabs."
                }
              </p>
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync-sheets"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending
                  ? "Syncing..."
                  : month ? `Sync ${formatMonthLabel(month)}` : "Sync All Months"
                }
              </Button>
              <a
                href={`https://docs.google.com/spreadsheets/d/11f8ZRNOgBX394Vj4QtZS1B-hryXF8hF1E3RZuNK9RYA/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open spreadsheet
              </a>
            </div>
          )}

          {/* Info */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">What gets synced</p>
            <p>• Income &amp; fixed deductions for the month</p>
            <p>• Food / Shopping / Grocery expense entries</p>
            <p>• Petty cash remaining</p>
            <p>• A new tab is created if it doesn't exist yet</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
