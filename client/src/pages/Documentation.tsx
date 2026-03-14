import { useState } from "react";
import { BookOpen, ChevronRight, DollarSign, Calendar, Settings, Utensils, PiggyBank, RefreshCw, Download, HelpCircle, Lightbulb, AlertCircle, Code2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Section {
  id: string;
  title: string;
  icon: any;
}

const SECTIONS: Section[] = [
  { id: "overview",        title: "Overview",           icon: BookOpen },
  { id: "getting-started", title: "Getting Started",    icon: ChevronRight },
  { id: "fixed-expenses",  title: "Fixed Expenses",     icon: Settings },
  { id: "food-budget",     title: "Food Budget",         icon: Utensils },
  { id: "monthly-entry",   title: "Monthly Entry",       icon: Calendar },
  { id: "annual-savings",  title: "Annual Savings",      icon: PiggyBank },
  { id: "google-sheets",   title: "Google Sheets Sync",  icon: RefreshCw },
  { id: "export",          title: "Exporting to Excel",  icon: Download },
  { id: "deployment",      title: "Zeabur Deployment",   icon: Globe },
  { id: "troubleshooting", title: "Troubleshooting",     icon: HelpCircle },
  { id: "quick-reference", title: "Quick Reference",     icon: Code2 },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-bold text-foreground mb-1">{children}</h1>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-muted-foreground mt-4 mb-1.5 uppercase tracking-wide">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground leading-relaxed mb-3">{children}</p>;
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 my-3">
      <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <p className="text-sm text-foreground leading-relaxed">{children}</p>
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 my-3">
      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-foreground leading-relaxed">{children}</p>
    </div>
  );
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted rounded-lg px-4 py-3 text-xs font-mono text-foreground overflow-x-auto my-3 leading-relaxed">
      {children}
    </pre>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-xs font-semibold first:rounded-tl-lg last:rounded-tr-lg">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/40"}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-xs text-foreground align-top border-b border-border last:border-r-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section content ────────────────────────────────────────────────────────────
function SectionOverview() {
  return (
    <div>
      <H1>Overview</H1>
      <p className="text-sm text-muted-foreground mb-5">What this app is and how it's structured.</p>

      <P>
        The Household Expense Tracker is a personal finance web app that runs locally on your computer.
        It mirrors your existing Google Sheets workbook, letting you record income, fixed monthly deductions,
        and irregular expenses — then sync everything directly to your spreadsheet at any time.
      </P>

      <H2>Key Concepts</H2>
      <Table
        headers={["Concept", "What it means"]}
        rows={[
          ["Fiscal year", "April of one year to March of the next. E.g. \"2025-2026\" = Apr 2025 – Mar 2026."],
          ["Fixed items", "Income and expenses that are roughly the same every month (salary, mortgage, maid, etc.)."],
          ["Irregular expenses", "Purchases that vary month to month — recorded in three categories: Food, Shopping, Grocery."],
          ["Petty cash", "Money left after subtracting fixed deductions and the food budget from your net income."],
          ["Food delta", "The difference between your actual food spend and your daily breakfast/lunch budget. Positive = overspent, negative = saved."],
          ["Carry-over", "Remaining petty cash from each month that rolls into the annual savings total."],
        ]}
      />

      <H2>Data Storage</H2>
      <P>
        All data is stored in a local SQLite database file called <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">data.db</code> inside
        the project folder. This file is created automatically on first start and persists across restarts —
        your data is never lost when you close the app.
        Google Sheets sync is a separate, on-demand action that copies your data to your spreadsheet.
      </P>
    </div>
  );
}

function SectionGettingStarted() {
  return (
    <div>
      <H1>Getting Started</H1>
      <p className="text-sm text-muted-foreground mb-5">How to start the app on your Mac.</p>

      <P>Requirements: Node.js v18 or later. Open Terminal and run:</P>
      <Code>{`cd ~/downloads/expense-tracker
npm install    # first time only
npm run dev`}</Code>
      <P>
        Then open <strong>http://localhost:3000</strong> in your browser.
        The app runs until you press <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+C</kbd> in Terminal.
      </P>
      <Tip>Keep the Terminal window open while using the app — closing it stops the server. Your data in data.db is always safe.</Tip>

      <H2>Pages in the Sidebar</H2>
      <Table
        headers={["Page", "What you do here"]}
        rows={[
          ["Dashboard", "Monthly summary cards, spending charts, and fiscal year overview."],
          ["Monthly Entry", "Add irregular expenses (food delta, shopping, grocery). View this month's totals."],
          ["Fixed Expenses", "Manage your income items and regular monthly deductions. Set effective dates."],
          ["Food Budget", "Set your daily breakfast and lunch cost. Changing this takes effect from a chosen month."],
          ["Annual Savings", "Record 13th month salary, bonus, and regular savings for the fiscal year."],
        ]}
      />
    </div>
  );
}

function SectionFixedExpenses() {
  return (
    <div>
      <H1>Fixed Expenses</H1>
      <p className="text-sm text-muted-foreground mb-5">Income, savings deductions, and regular monthly outgoings.</p>

      <P>
        Fixed items are the backbone of your monthly budget. They include everything that is roughly
        the same each month: your salary, allowances, insurance, mortgage, and so on.
        Use the <strong>Fixed Expenses</strong> page to manage these.
      </P>

      <H2>Item Types</H2>
      <Table
        headers={["Type", "Effect on budget"]}
        rows={[
          ["Income", "Added to your net income (positive = adds money, negative = deducted like MPF)."],
          ["Saving (deducted)", "Treated as income but marked as saving — subtracted from spendable income."],
          ["Fixed Deduction", "Regular expense subtracted before petty cash is calculated (insurance, mortgage, etc.)."],
        ]}
      />

      <H2>Effective Dates</H2>
      <P>
        Every fixed item has an <strong>Effective From</strong> month (format: YYYY-MM).
        The app always uses the most recent version of an item whose effective date is on or before the month you are viewing.
      </P>
      <Table
        headers={["Scenario", "What to do"]}
        rows={[
          ["Increase insurance from May 2026", "Add a new Insurance entry with amount $4,500 and Effective From 2026-05. Apr 2026 and earlier automatically keep the old value."],
          ["Salary change from a future month", "Add a new Income entry with the new amount and the correct Effective From date."],
          ["Temporarily remove an item", "Add a new entry for the same name with amount 0 from the month it should stop."],
        ]}
      />
      <Tip>
        You never need to edit historical months — just add a new row for the new amount. The old value continues to apply to all previous months automatically.
      </Tip>
    </div>
  );
}

function SectionFoodBudget() {
  return (
    <div>
      <H1>Food Budget</H1>
      <p className="text-sm text-muted-foreground mb-5">Daily meal allowances and how food deltas work.</p>

      <P>
        The Food Budget page lets you set the daily allowance for breakfast and lunch.
        The default is <strong>$40/day for breakfast</strong> and <strong>$75/day for lunch</strong> over 30 days,
        giving a monthly baseline of <strong>$3,450</strong>. This baseline is deducted from your income when calculating petty cash.
      </P>

      <H2>How Food Deltas Work</H2>
      <P>
        Because your food baseline is already budgeted, you only record the <em>difference</em> from the standard amount.
        This is called a <strong>food delta</strong>.
      </P>
      <Table
        headers={["Situation", "Amount to enter", "Sign"]}
        rows={[
          ["Lunch cost $250 (standard $75)", "175  (= 250 − 75)", "+ Extra spend"],
          ["Skipped breakfast", "40", "− Didn't spend"],
          ["Skipped lunch", "75", "− Didn't spend"],
          ["Expensive dinner out $600", "600 (full cost, no baseline)", "+ Extra spend"],
          ["Free meal, nothing spent", "0 or skip", "—"],
        ]}
      />
      <Tip>
        The food total in Monthly Entry is the net delta — all extra spending minus any savings.
        A negative total means you spent less than your food budget this month.
      </Tip>
      <Note>
        Like fixed items, food settings have effective dates. Change the breakfast/lunch cost from a chosen month and earlier months are unaffected.
      </Note>
    </div>
  );
}

function SectionMonthlyEntry() {
  return (
    <div>
      <H1>Monthly Entry</H1>
      <p className="text-sm text-muted-foreground mb-5">Recording your day-to-day irregular spending.</p>

      <P>
        This is where you record your day-to-day spending. Navigate between months using the arrows at the top,
        or use the month picker to jump directly to any month.
      </P>

      <H2>Adding an Expense</H2>
      <Table
        headers={["Field", "Description"]}
        rows={[
          ["Date", "The date of the purchase (defaults to today)."],
          ["Category", "Food, Shopping, or Grocery — determines which table it appears in."],
          ["Sign (food only)", "'+' for extra spending above budget; '−' for skipping a meal or spending less."],
          ["Food type", "For Food category: Breakfast or Lunch (optional, helps track which meal)."],
          ["Item / Description", "Description of the purchase. Optional for food deltas, recommended for Shopping/Grocery."],
          ["Amount (HK$)", "The amount. For food: enter the delta value, not the full meal cost."],
        ]}
      />

      <H2>Categories Explained</H2>
      <Table
        headers={["Category", "What to record here"]}
        rows={[
          ["Food", "Extra spending above your breakfast/lunch daily budget, or savings from skipped meals."],
          ["Shopping", "Any one-off purchases from petty cash: transport, entertainment, personal items, etc."],
          ["Grocery", "Supermarket and household shopping paid from petty cash."],
        ]}
      />

      <H2>Summary Bar</H2>
      <P>Four cards at the top show your financial position for the selected month:</P>
      <Table
        headers={["Card", "What it shows"]}
        rows={[
          ["Total Income", "Sum of all income items after deductions like MPF and savings."],
          ["Fixed Deductions", "Total of all regular monthly expenses."],
          ["Petty Cash Budget", "Income minus deductions minus food baseline."],
          ["Remaining", "Petty cash budget minus all irregular spending so far this month."],
        ]}
      />

      <H2>Saving Remaining Petty Cash</H2>
      <P>
        When you are done entering for the month, click <strong>Save Remaining</strong> at the bottom.
        This records the month's remaining balance. That figure is picked up automatically
        by the Annual Savings page as the petty cash carry-over for the fiscal year.
      </P>
      <Tip>You can update and re-save the remaining amount at any time — clicking Save Remaining always overwrites the previous figure for that month.</Tip>
    </div>
  );
}

function SectionAnnualSavings() {
  return (
    <div>
      <H1>Annual Savings</H1>
      <p className="text-sm text-muted-foreground mb-5">Tracking your total savings across the fiscal year.</p>

      <P>
        The Annual Savings page tracks your total savings for each fiscal year (April to March).
        It combines four components into a single total.
      </P>
      <Table
        headers={["Component", "When received", "Where to enter"]}
        rows={[
          ["13th month salary", "Paid in March (year-end)", "Annual Savings form — 13th Month Salary field"],
          ["Bonus", "Collected in March", "Annual Savings form — Bonus field"],
          ["Regular saving", "Accumulated across the year", "Annual Savings form — Regular Saving field"],
          ["Petty cash carry-over", "Auto-calculated", "Filled automatically from saved monthly remainders"],
        ]}
      />
      <P>
        The petty cash carry-over is the sum of all <strong>Save Remaining</strong> values recorded in Monthly Entry
        throughout the fiscal year. If a month has no saved value it shows a dash and counts as zero.
        A negative carry-over means you overspent your petty cash across the year.
      </P>
      <Tip>Click "Load saved" to fill the form with your previously entered values for that fiscal year — useful when making small updates.</Tip>
    </div>
  );
}

function SectionGoogleSheets() {
  return (
    <div>
      <H1>Google Sheets Sync</H1>
      <p className="text-sm text-muted-foreground mb-5">Writing your data directly to your spreadsheet.</p>

      <P>
        The app can write your data directly to your Google Sheets workbook (<em>Household Monthly Expense</em>).
        Sync is always manual — click when you want it. Your data in data.db is always the source of truth.
      </P>

      <H2>First-Time Setup</H2>
      <Table
        headers={["Step", "What to do"]}
        rows={[
          ["1", "Start the app and open it in your browser."],
          ["2", "Click the Google Sheets button in the sidebar."],
          ["3", "Click Connect Google Account — a browser tab opens with Google's sign-in."],
          ["4", "Sign in and approve the Sheets permission when prompted."],
          ["5", "The tab shows a green ✓. Close it and return to the app."],
          ["6", "The button now shows a small green dot — you are connected."],
          ["7", "Your token is saved in google_token.json in the project folder and persists across restarts."],
        ]}
      />

      <H2>Syncing Data</H2>
      <Table
        headers={["Action", "Where", "What it does"]}
        rows={[
          ["Sync one month", "Monthly Entry → Google Sheets button", "Writes this month's data to the matching tab (e.g. 'Mar 2026')."],
          ["Sync all months", "Sidebar → Google Sheets button", "Writes every month with expense data to its own tab."],
          ["Open spreadsheet", "Either Google Sheets panel", "Opens your Google Sheets workbook in a new tab."],
          ["Disconnect", "Either Google Sheets panel", "Removes the stored token. You'll need to sign in again next time."],
        ]}
      />
      <Note>
        Each sync <strong>clears the existing tab</strong> and rewrites it from scratch. Any manual edits made directly in Google Sheets will be overwritten. Edit data in the app, not in the sheet.
      </Note>
      <Tip>The tab name format is 'Mar 2026', 'Feb 2026' etc. — the app creates the tab automatically if it doesn't exist yet.</Tip>
    </div>
  );
}

function SectionExport() {
  return (
    <div>
      <H1>Exporting to Excel</H1>
      <p className="text-sm text-muted-foreground mb-5">Download your data as an Excel file anytime.</p>

      <P>
        You can download your data as an Excel file (.xlsx) at any time — no internet connection needed.
      </P>
      <Table
        headers={["Button", "Location", "What it exports"]}
        rows={[
          ["Export XLSX", "Monthly Entry page header", "This month's data only, as a single-tab workbook."],
          ["Export All to XLSX", "Sidebar bottom", "All months with data, each as a separate tab in one workbook."],
        ]}
      />
      <Tip>Use "Export All to XLSX" as a backup before making major changes, or to share a snapshot with someone else.</Tip>
    </div>
  );
}

function SectionDeployment() {
  return (
    <div>
      <H1>Zeabur Deployment</H1>
      <p className="text-sm text-muted-foreground mb-5">How to deploy this app to the cloud so you can use it on any device.</p>

      <P>
        Zeabur is a simple cloud hosting platform. Once deployed, your app runs 24/7 at a public URL like
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono mx-1">https://expense-tracker.zeabur.app</code>
        — accessible from your Mac, iPhone, iPad, or any browser.
      </P>

      <H2>Before You Start</H2>
      <P>You must first run the app locally at least once and authenticate with Google Sheets. This creates a
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono mx-1">google_token.json</code> file
        in your project folder. You'll need its contents later.
      </P>

      <H2>Step 1 — Prepare the Upload</H2>
      <P>Download the latest app zip from this app (use the sidebar export/download). Unzip it. Then open
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono mx-1">google_token.json</code>
        in any text editor and copy the entire contents.</P>

      <H2>Step 2 — Create a Zeabur Account</H2>
      <P>Go to <strong>zeabur.com</strong> and sign up (GitHub login is easiest). Create a new Project, then
        add a new Service → choose <strong>Git</strong> (connect GitHub) or <strong>Upload</strong> to upload
        your zip directly.</P>

      <H2>Step 3 — Set Environment Variables</H2>
      <P>In your Zeabur service, go to <strong>Variables</strong> and add each of the following:</P>
      <Table
        headers={["Variable", "Value"]}
        rows={[
          ["NODE_ENV", "production"],
          ["PORT", "3000"],
          ["GOOGLE_CLIENT_ID", "Your Google OAuth client ID"],
          ["GOOGLE_CLIENT_SECRET", "Your Google OAuth client secret"],
          ["GOOGLE_REDIRECT_URI", "https://<your-app>.zeabur.app/oauth2callback"],
          ["GOOGLE_SPREADSHEET_ID", "Your spreadsheet ID from the Google Sheets URL"],
          ["GOOGLE_TOKEN", "Paste the full contents of google_token.json here"],
        ]}
      />
      <Note>Replace <strong>&lt;your-app&gt;</strong> with the actual subdomain Zeabur gives your service.</Note>

      <H2>Step 4 — Add Redirect URI to Google</H2>
      <P>Go to <strong>console.cloud.google.com</strong> → Your project → Credentials → your OAuth client →
        Authorised redirect URIs. Add:</P>
      <Code>{`https://<your-app>.zeabur.app/oauth2callback`}</Code>
      <P>Save. Without this step, Google will show an error when you try to authenticate on Zeabur.</P>

      <H2>Step 5 — Deploy</H2>
      <P>Zeabur detects the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">zbpack.json</code> file and
        automatically runs <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">npm run build</code> then
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono mx-1">NODE_ENV=production node dist/index.cjs</code>.
        Once deployed, open the public URL — your app is live.</P>
      <Tip>Bookmark the Zeabur URL on your phone for quick access. Add it to your iPhone Home Screen via Safari → Share → Add to Home Screen for an app-like experience.</Tip>

      <H2>Persistent Storage Warning</H2>
      <Note>
        By default, Zeabur's file system is ephemeral — your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">data.db</code> resets
        if the service restarts. To prevent data loss, enable a <strong>Persistent Volume</strong> in Zeabur and
        mount it at <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/app/data</code>, then set the database path
        to <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/app/data/data.db</code>. Or use the Google Sheets sync
        regularly as a backup — your data is always safe in your spreadsheet.
      </Note>

      <H2>Updating the App</H2>
      <P>When you receive a new version of the app zip, re-upload it to Zeabur and redeploy. Your environment
        variables are preserved across redeploys — you only need to set them once.</P>
    </div>
  );
}

function SectionTroubleshooting() {
  return (
    <div>
      <H1>Troubleshooting</H1>
      <p className="text-sm text-muted-foreground mb-5">Common problems and how to fix them.</p>

      <Table
        headers={["Problem", "Solution"]}
        rows={[
          ["App won't start — port 3000 in use", "Another app is using port 3000. In server/index.ts change 3000 to 3001 and restart with npm run dev."],
          ["Data disappeared after restart", "Your data is in data.db. As long as this file exists in the project folder, data persists. Do not delete it."],
          ["Google Sheets sync fails — 'Not authenticated'", "Click the Google Sheets button and reconnect your Google account."],
          ["Google Sheets sync fails — 'Invalid Grant'", "Your token has expired. Disconnect, then reconnect your Google account."],
          ["Sync overwrote my manual edits in Google Sheets", "Sync always rewrites the tab from app data. Edit in the app, not directly in Google Sheets."],
          ["Food delta totals look wrong", "Verify that saved food entries use the correct sign: + for overspending, − for saving/skipping."],
          ["Fixed item not applying to a month", "Check the Effective From date. It must be on or before the month you are viewing."],
          ["App shows old data after editing fixed items", "Hard-refresh the browser with Cmd+Shift+R on Mac."],
        ]}
      />
    </div>
  );
}

function SectionQuickReference() {
  return (
    <div>
      <H1>Quick Reference</H1>
      <p className="text-sm text-muted-foreground mb-5">Key formulas and concepts at a glance.</p>

      <H3>Petty cash formula</H3>
      <Code>{`Petty Cash  = Net Income − Fixed Deductions − Food Baseline
Remaining   = Petty Cash − Food Delta Total − Shopping Total − Grocery Total`}</Code>

      <H3>Food baseline formula</H3>
      <Code>{`Food Baseline = (Breakfast Cost + Lunch Cost) × Days
Default: ($40 + $75) × 30 = $3,450 / month`}</Code>

      <H3>Annual savings formula</H3>
      <Code>{`Total Savings = 13th Month Salary + Bonus + Regular Saving + Petty Cash Carry-Over`}</Code>

      <H2>Food Delta Cheat Sheet</H2>
      <Table
        headers={["Situation", "Enter", "Sign"]}
        rows={[
          ["Lunch $250 (standard $75)", "175", "+"],
          ["Skipped breakfast", "40", "−"],
          ["Skipped lunch", "75", "−"],
          ["Dinner $600 (no daily budget)", "600", "+"],
        ]}
      />

      <H2>Fiscal Year Reference</H2>
      <Table
        headers={["Fiscal Year", "Covers", "13th salary / bonus paid"]}
        rows={[
          ["2025-2026", "Apr 2025 → Mar 2026", "March 2026"],
          ["2026-2027", "Apr 2026 → Mar 2027", "March 2027"],
        ]}
      />

      <H2>Date Format</H2>
      <P>
        All months use the format <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">YYYY-MM</code>, e.g. <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">2026-03</code> for March 2026.
        Tab names in Google Sheets use the format <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Mar 2026</code>.
      </P>
    </div>
  );
}

const SECTION_CONTENT: Record<string, () => JSX.Element> = {
  "overview":        SectionOverview,
  "getting-started": SectionGettingStarted,
  "fixed-expenses":  SectionFixedExpenses,
  "food-budget":     SectionFoodBudget,
  "monthly-entry":   SectionMonthlyEntry,
  "annual-savings":  SectionAnnualSavings,
  "google-sheets":   SectionGoogleSheets,
  "export":          SectionExport,
  "deployment":      SectionDeployment,
  "troubleshooting": SectionTroubleshooting,
  "quick-reference": SectionQuickReference,
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Documentation() {
  const [active, setActive] = useState("overview");
  const Content = SECTION_CONTENT[active];

  return (
    <div className="flex h-full" data-testid="page-documentation">
      {/* Doc sidebar */}
      <aside className="w-52 shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Documentation</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Operator's Manual</p>
        </div>
        <nav className="py-2">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
                  active === s.id
                    ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`doc-nav-${s.id}`}
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0 font-mono">{i + 1}.</span>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs leading-tight">{s.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {Content && <Content />}
        </div>
      </div>
    </div>
  );
}
