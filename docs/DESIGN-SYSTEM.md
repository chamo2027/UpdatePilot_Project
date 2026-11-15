# UpdatePilot UI/UX Design System & Screen Specifications

UpdatePilot features an enterprise-grade developer and IT operations interface inspired by modern cloud infrastructure dashboards (such as Vercel, Datadog, and GitHub Enterprise).

---

## 1. Visual Direction & Principles

* **Restrained Palette**: Neutral slate and zinc backgrounds with high contrast and intentional semantic accents.
* **Information Density**: Compact data tables, clear typography hierarchy, and minimal decorative noise.
* **Semantic Status Indicators**: Consistent status colors throughout the application:
  * **Emerald (`#10b981`)**: Up to date, verified success, online agent.
  * **Amber (`#f59e0b`)**: Update available, restart required, pending confirmation.
  * **Rose (`#f43f5e`)**: Critical advisory, failed verification, disconnected agent.
  * **Slate / Neutral (`#64748b`)**: Unmanaged registry package, unknown status.

---

## 2. Color Tokens

### Dark Mode (Operations & NOC)
* **Background**: `#0b1120` (Deep slate)
* **Surface**: `#0f172a` (Card & panel surface)
* **Surface Muted**: `#1e293b` (Subtle input & table row highlight)
* **Surface Border**: `#334155` (Dividers & card borders)
* **Foreground**: `#f8fafc` (Primary text)
* **Muted Foreground**: `#94a3b8` (Secondary labels & metadata)

### Light Mode (Executive & Daylight)
* **Background**: `#f8fafc` (Off-white canvas)
* **Surface**: `#ffffff` (Elevated card background)
* **Surface Muted**: `#f1f5f9` (Subtle container fill)
* **Surface Border**: `#e2e8f0` (Crisp container boundaries)
* **Foreground**: `#0f172a` (High-contrast typography)
* **Muted Foreground**: `#64748b` (Secondary labels)

---

## 3. Typography & Hierarchy

* **Font Family**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
* **Monospace**: JetBrains Mono, Fira Code, Consolas, Courier New (used for Package Identifiers, Version numbers, and Shell logs).
* **Scale**:
  * Heading 1: `24px` (`text-2xl`), Semi-Bold / Bold, `-0.02em` tracking.
  * Heading 2: `18px` (`text-lg`), Semi-Bold.
  * Section Headers: `14px` (`text-sm`), Bold, Uppercase tracking.
  * Body Text: `13px` / `14px` (`text-xs` / `text-sm`), Regular / Medium.
  * Data Tables & Metadata: `12px` (`text-xs`) with `11px` for status badges.

---

## 4. Key Screen Layouts

### 1. Overview Dashboard (`/`)
* **Top Header**: Host status badge, active device name, trigger scan button, theme switcher.
* **Fleet Metrics (4 KPI Cards)**: Installed Applications, Updates Available, Up-to-Date Apps, Security Advisories.
* **Visual Breakdown**: Recharts interactive Donut / Pie distribution chart alongside Target Host telemetry specs.
* **Recent Activity Feed**: Timeline of recent audit events with timestamps and target packages.

### 2. Application Inventory (`/applications`)
* **Toolbar**: Real-time debounce search, Status filter dropdown (All, Update Available, Up to Date, Unsupported, Unknown), Source filter (WinGet, Registry), Sort selector.
* **Data Table**: Paginated rows with App Name, Publisher, Monospace Package ID, Installed Version, Available Version, Source, Status Badge, and contextual action buttons.

### 3. Update Center (`/updates`)
* **Safety Banner**: Notice affirming the Safe Update Guarantee and lack of automated silent updates.
* **Update Cards**: Card layout highlighting current version $\rightarrow$ target version, publisher info, changelog link, and major version jump alerts.

### 4. Security Insights (`/security`)
* **Advisory Banner**: Explaining the conservative vulnerability matching policy.
* **Findings Feed**: Severity badges (Critical, High, Medium, Low), advisory identifier (GHSA / CVE), summary, affected range, and remediation links.

### 5. Audit & History (`/history`)
* **Export Controls**: One-click export for Inventory CSV, Inventory JSON, and Update Report CSV (with CSV injection defense).
* **Audit Table**: Chronological table of `SCAN_REQUESTED`, `SCAN_COMPLETED`, `UPDATE_CONFIRMED`, `UPDATE_SUCCESS`, `UPDATE_RESTART_REQUIRED`.

### 6. Settings & Agent Management (`/settings`)
* **Agent Card**: Status, device name, OS version, agent version, token preview, and instant Revocation button.
* **Theme Controls**: Dark and Light theme toggle.

---

## 5. Accessibility (WCAG 2.2 AA)

* **Focus Trapping**: Modals (`SafeUpdateModal`, `AppDetailModal`) utilize `useModalFocus` to cycle focus within the dialog and return focus to the triggering element upon dismissal.
* **Keyboard Escape**: All modals and overlays dismiss on the `Escape` key.
* **Contrast Compliance**: Contrast ratios between foreground text and backgrounds exceed $4.5:1$ for normal text and $3:1$ for large headings.
* **Screen Reader Labels**: Interactive icon buttons contain explicit `aria-label` or `title` attributes.

