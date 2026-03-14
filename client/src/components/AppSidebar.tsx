/**
 * AppSidebar — desktop sidebar + mobile bottom tab bar
 * On md+ screens: fixed left sidebar (w-56)
 * On small screens: hidden sidebar, bottom navigation bar instead
 */
import { Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { LayoutDashboard, CalendarDays, Settings, Utensils, PiggyBank, Moon, Sun, Download, BookOpen, MoreHorizontal, ShoppingCart, Upload, LogOut } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { GoogleSheetsButton } from "@/components/GoogleSheetsButton";
import { ImportDialog } from "@/components/ImportDialog";
import { useState } from "react";

const navItems = [
  { href: "/",             label: "Dashboard",     icon: LayoutDashboard, tip: "Overview of your spending, savings, and monthly summaries." },
  { href: "/entry",        label: "Monthly Entry", icon: CalendarDays,    tip: "Add and view irregular expenses (food, shopping, grocery) for any month." },
  { href: "/fixed",        label: "Fixed",         icon: Settings,        tip: "Manage your income, deductions, and regular monthly fixed expenses." },
  { href: "/food-settings",label: "Food Budget",   icon: Utensils,        tip: "Set your daily breakfast and lunch budget. Changes apply from the month you specify." },
  { href: "/savings",      label: "Savings",       icon: PiggyBank,       tip: "Record your annual savings: 13th month salary, bonus, regular savings (Apr–Mar fiscal year)." },
  { href: "/grocery",      label: "Grocery",       icon: ShoppingCart,    tip: "Log grocery purchases by item and category (Food / Household). Independent from other pages." },
  { href: "/docs",         label: "Docs",          icon: BookOpen,        tip: "Operator's manual — full guide on how every part of the app works." },
];

// ── Desktop sidebar nav item ──────────────────────────────────────────────────
function DesktopNavItem({ href, label, icon: Icon, tip }: { href: string; label: string; icon: any; tip: string }) {
  const [location] = useLocation();
  const isActive = href === "/" ? location === "/" || location === "" : location.startsWith(href);
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href}>
            <a
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </a>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-52 text-xs leading-relaxed">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Mobile bottom nav item ────────────────────────────────────────────────────
function MobileNavItem({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const [location] = useLocation();
  const isActive = href === "/" ? location === "/" || location === "" : location.startsWith(href);
  return (
    <Link href={href}>
      <a className={cn(
        "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
        <span className="text-[10px] leading-tight truncate">{label}</span>
      </a>
    </Link>
  );
}

// ── Logo SVG ──────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0" aria-label="Expense Tracker" fill="none">
      <rect x="3" y="3" width="26" height="26" rx="5" fill="hsl(var(--sidebar-primary))" />
      <path d="M10 16h12M10 11h7M10 21h9" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23" cy="11" r="2" fill="white" />
    </svg>
  );
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────
function DesktopSidebar({ onLogout }: { onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  const [importOpen, setImportOpen] = useState(false);

  async function downloadAll() {
    const a = document.createElement("a");
    a.href = "/api/export/xlsx";
    a.download = "Household_Monthly_Expense.xlsx";
    a.click();
  }

  return (
    <div
      className="hidden md:flex flex-col w-56 shrink-0 h-screen"
      style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Logo />
        <div>
          <div className="text-sm font-semibold leading-tight" style={{ color: "hsl(var(--sidebar-foreground))" }}>Household</div>
          <div className="text-xs" style={{ color: "hsl(var(--sidebar-primary))" }}>Expense Tracker</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(item => <DesktopNavItem key={item.href} {...item} />)}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t flex flex-col gap-2" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline" size="sm"
                className="w-full justify-start gap-2 text-xs"
                style={{ background: "hsl(var(--sidebar-accent))", border: "1px solid hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground))" }}
                onClick={downloadAll}
                data-testid="button-export-xlsx"
              >
                <Download className="h-3.5 w-3.5" />
                Export All to XLSX
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-52 text-xs leading-relaxed">
              Downloads all months as a single Excel workbook (.xlsx) to your computer.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <GoogleSheetsButton fullWidth />

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline" size="sm"
                className="w-full justify-start gap-2 text-xs"
                style={{ background: "hsl(var(--sidebar-accent))", border: "1px solid hsl(var(--sidebar-border))", color: "hsl(var(--sidebar-foreground))" }}
                onClick={() => setImportOpen(true)}
                data-testid="button-import-xlsx"
              >
                <Upload className="h-3.5 w-3.5" />
                Import XLSX
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-52 text-xs leading-relaxed">
              Import expense data from an XLSX file. Conflicts with existing months will be flagged for review.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-xs"
                style={{ color: "hsl(var(--sidebar-foreground))" }}
                onClick={toggle}
                data-testid="button-theme-toggle"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-52 text-xs leading-relaxed">
              Toggle between light and dark colour theme.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-xs"
                style={{ color: "hsl(var(--sidebar-foreground))" }}
                onClick={onLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-52 text-xs leading-relaxed">
              Sign out of the app.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

// ── Mobile bottom bar + "More" sheet ─────────────────────────────────────────
const primaryMobileNav = navItems.slice(0, 4); // Dashboard, Monthly Entry, Fixed, Food Budget
const moreMobileNav    = navItems.slice(4);    // Savings, Docs

function MobileBottomBar({ onLogout }: { onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function downloadAll() {
    const a = document.createElement("a");
    a.href = "/api/export/xlsx";
    a.download = "Household_Monthly_Expense.xlsx";
    a.click();
  }

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t flex items-center justify-around px-2 pb-safe"
      style={{
        background: "hsl(var(--sidebar-background))",
        borderColor: "hsl(var(--sidebar-border))",
        paddingTop: "8px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      {primaryMobileNav.map(item => (
        <MobileNavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
      ))}

      {/* "More" sheet for remaining items + actions */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground" data-testid="button-mobile-more">
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] leading-tight">More</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-safe" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-4">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* More nav items */}
          <div className="px-4 space-y-1 mb-4">
            {moreMobileNav.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    {item.label === "Docs" ? "Documentation" : item.label}
                  </a>
                </Link>
              );
            })}
          </div>

          <div className="border-t mx-4 pt-4 space-y-2">
            {/* Google Sheets */}
            <div className="px-1"><GoogleSheetsButton fullWidth /></div>

            {/* Export */}
            <Button
              variant="outline" size="sm"
              className="w-full justify-start gap-2 text-sm mx-1"
              style={{ width: "calc(100% - 8px)" }}
              onClick={() => { downloadAll(); setMoreOpen(false); }}
            >
              <Download className="h-4 w-4" />
              Export All to XLSX
            </Button>

            {/* Import */}
            <Button
              variant="outline" size="sm"
              className="w-full justify-start gap-2 text-sm mx-1"
              style={{ width: "calc(100% - 8px)" }}
              onClick={() => { setMoreOpen(false); setImportOpen(true); }}
            >
              <Upload className="h-4 w-4" />
              Import XLSX
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start gap-2 text-sm mx-1"
              style={{ width: "calc(100% - 8px)" }}
              onClick={() => { toggle(); setMoreOpen(false); }}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>

            {/* Sign out */}
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start gap-2 text-sm mx-1"
              style={{ width: "calc(100% - 8px)" }}
              onClick={() => { setMoreOpen(false); onLogout(); }}
              data-testid="button-logout-mobile"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

// ── Mobile top header bar ─────────────────────────────────────────────────────
function MobileHeader() {
  const [location] = useLocation();
  const current = navItems.find(n => n.href === "/" ? location === "/" || location === "" : location.startsWith(n.href));
  const title = current?.label === "Docs" ? "Documentation" : (current?.label ?? "Household Tracker");

  return (
    <div
      className="md:hidden flex items-center gap-3 px-4 py-3 border-b shrink-0"
      style={{ background: "hsl(var(--sidebar-background))", borderColor: "hsl(var(--sidebar-border))" }}
    >
      <Logo />
      <div>
        <div className="text-xs font-semibold leading-tight" style={{ color: "hsl(var(--sidebar-foreground))" }}>Household</div>
        <div className="text-[10px]" style={{ color: "hsl(var(--sidebar-primary))" }}>Expense Tracker</div>
      </div>
      <div className="ml-auto">
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
    </div>
  );
}

// ── Exported component ────────────────────────────────────────────────────────
export function AppSidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <DesktopSidebar onLogout={onLogout} />
      <MobileHeader />
      <MobileBottomBar onLogout={onLogout} />
    </>
  );
}
