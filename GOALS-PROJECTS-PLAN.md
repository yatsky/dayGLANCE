# Goals & Projects — Feature Plan

Tasks already have `title`, `startTime`, `duration`, `color`, `isAllDay`, `priority`, `deadline`, `recurrence`, `notes`, `subtasks`, `focusMinutes`, and `tags`. But no project/goal concept yet.

---

## Core Idea

A lightweight layer _above_ tasks. A **Goal** contains **Projects**, a **Project** contains **Tasks**. But it's fully opt-in at every level:

- Tasks don't need to belong to a project
- Projects don't need to belong to a goal
- Unaffiliated tasks work exactly as they do today

The feature can be toggled off entirely for users who don't need it, or turned on as-needed.

---

## Data Model

### Goal

```
Goal {
  id
  title
  description?
  targetDate?
  status          // active | completed | archived
  color?          // Tailwind bg-* class (same system as tasks)
  createdAt
  updatedAt
}
```

### Project

```
Project {
  id
  goalId?         // nullable — projects can exist without a goal
  title
  description?
  status          // active | completed | archived
  createdAt
  updatedAt
}
```

### Task (addition only)

```
Task {
  ...existing fields
  projectId?      // nullable — one new optional field, no migration needed
}
```

No deep nesting. No required fields. Existing tasks just have `projectId: undefined`.

---

## Progress Calculation

### Effort weighting via task duration

Rather than treating all tasks equally, progress is weighted by task duration — a 2-hour task contributes more than a 15-minute one. This requires no new user input since duration is already a first-class task attribute.

```
project progress =
  sum(duration of completed tasks where projectId = X) /
  sum(duration of all non-archived tasks where projectId = X)
```

**Fallback for tasks with no duration set:** treat as 30 minutes (a sensible default that keeps unset tasks contributing meaningfully without forcing the user to think about it).

### Goal progress

Bird's-eye view derived from child project completion, weighted by each project's total task duration:

```
goal progress =
  weighted average of progress across all active + completed projects where goalId = Y
```

Goals show overall completion direction. Projects show the detailed breakdown.

### Stalled indicator

A project is considered stalled when:
- It has at least one incomplete task, AND
- No task has `completedAt` within the last 7 days

---

## Unscheduled Tasks & the Inbox

**Unscheduled tasks with a `projectId` do NOT go to the inbox.** They live in the project card on the Goals & Projects dashboard. The inbox is for loose, unaffiliated tasks. A project-tied task already has a home.

- Unscheduled task + no `projectId` → inbox (existing behavior)
- Unscheduled task + `projectId` → project card on dashboard
- When the feature is toggled off, the inbox exclusion is lifted — project-tied unscheduled tasks reappear in the inbox so nothing is hidden from the user

---

## File Structure

```
src/components/goals/
  GoalCard.jsx          // Flowchart node: color, title, target date, days remaining,
                        // progress bar, collapse toggle, SVG line anchor points
  GoalDashboard.jsx     // Top-level composer: flowchart (desktop) + carousel (mobile)
  GoalProgress.jsx      // Progress bar UI for a single goal

src/components/projects/
  ProjectCard.jsx       // Flowchart node: progress bar, task counts, stalled badge,
                        // Project Focus button, quick-add task inline
  ProjectProgress.jsx   // Progress bar UI for a single project

src/utils/
  goalProgress.js       // Weighted average of progress across child projects
  projectProgress.js    // Duration-weighted task completion for a single project
```

`GoalDashboard.jsx` owns layout only. All progress logic lives in utils, referenced by cards and eventually by Weekly Review.

---

## How It Fits Into dayGLANCE

### Day view

Unchanged. Tasks still show on the timeline. A small project chip appears next to the task title so the user knows what it belongs to. Tapping the chip filters the day view to show only tasks with that `projectId`. Tapping again (or changing date) clears the filter. Chips are hidden when the feature is toggled off.

### Task creation / inbox

Tasks can optionally be assigned to a project via a dropdown in both the desktop and mobile new task modals. The dropdown shows only active projects, grouped by goal where applicable. Unassigned tasks stay in the inbox as today. Project-assigned unscheduled tasks go to the dashboard, not the inbox.

### Goals & Projects dashboard

**Entry points:**
- **Desktop:** Floating button in the bottom-left of the GLANCE panel
- **Mobile:** Dedicated "Goals" tab in the tab bar (only rendered when the feature is enabled)
- Both entry points disappear when the feature is toggled off

**Desktop layout — Flowchart:**
- Goals rendered as top-row cards, horizontally laid out
- SVG overlay drawn on the dashboard container; lines connect each Goal card to its child Project cards below
- Lines inherit the goal's color
- Collapsing a Goal card animates its project nodes out and retracts the SVG lines
- Standalone Projects section below the flowchart, visually separated, no connecting lines

**Mobile layout — Swipe Carousel:**
- Each Goal is a full-width "page"
- Goal card at top: color, title, target date, days remaining, overall progress bar
- Project cards stacked below it, scrollable vertically within the page
- Final page: "Standalone Projects"
- Dot indicators at the bottom showing current page
- CSS scroll-snap for smooth swipe behavior (same pattern as Weekly Review carousel)

**Each Project card shows:**
- Title
- Mini progress bar
- Completed / total task count
- Stalled badge (if applicable)
- Project Focus button
- Inline quick-add task
- Unscheduled tasks tied to this project

### Focus Mode integration

**Existing entry point unchanged:** Focus Mode still activates when the current time is within a task and 45+ minutes of task time remain.

**New "Project Focus" entry point:** Each Project card on the dashboard has a Project Focus button. Tapping it launches Focus Mode with `focusBlockTasks` pre-populated with that project's incomplete tasks for today. If no tasks are scheduled today for that project, the user is prompted: "No tasks scheduled today for this project — add one or pick a date."

Focus session logs are tagged with `projectId` so future enhancements can surface per-project focus time.

### Weekly Review / AI summary integration

The AI summary gains goal and project context:

- "You completed 4/7 tasks in Project X this week"
- "Goal Y is 60% complete with 12 days until target"
- Nudges for stalled projects (no tasks completed in 7+ days)
- Progress trend: is a goal accelerating or stalling compared to last week?

### Mobile navigation

The tab bar currently supports up to six tabs when all features are enabled: `dayglance | timeline | inbox | routines | frames | settings`. Adding Goals would exceed a reasonable limit.

**Resolution:** Frames is moved from the tab bar into the Settings modal on mobile. Desktop is unaffected (Frames remains accessible via its timeline FAB). The tab bar becomes: `dayglance | timeline | inbox | routines | goals | settings` — with Goals and Routines tabs only appearing when their respective features are enabled.

### Feature toggle

Located in Settings alongside Habits and Routines. When toggled off:
- Goals tab hidden from mobile tab bar
- GLANCE panel button hidden on desktop
- Project chips hidden from day view tasks
- Project-assigned unscheduled tasks reappear in inbox
- All data is preserved exactly as-is — toggling back on restores full state

### Existing stats

Weekly and all-time stats can be sliced by project or goal in a future enhancement. Phase 1 ensures the data (`projectId` on tasks, focus log tagging) is in place to support this.

---

## What It Deliberately Does NOT Do

- No Gantt charts, dependencies, or critical paths
- No separate project timelines or views
- No team or collaboration features
- No effort/weight field — weight is always inferred from task duration
- No required fields at any level — the hierarchy is always opt-in
- No migration needed — existing tasks just have `projectId: undefined`

---

## External Integrations (Future / Phase 2)

If a user wants TaskNotes (Obsidian plugin) or CalDAV as the source of truth for tasks, dayGLANCE acts as the scheduler and tracker — reading and writing tasks through the integration while owning the Goals and Projects layer natively. The data model doesn't change; `projectId` just gets populated from an external source.

**Phase 1:** Native layer only. Nail the data model, dashboard, focus mode integration, and progress calculations before adding any external dependency.

**Phase 2 candidate — CalDAV:** More universal than TaskNotes and already used by the target audience (Nextcloud users). Better first integration target.

**Phase 3 candidate — TaskNotes HTTP API:** Desktop-only due to the plugin's localhost HTTP server limitation. Useful for power users deep in the Obsidian ecosystem.

---

## UX Flow Example

1. User creates Goal: "Launch dayGLANCE v2.0" with a June target date
2. Adds Projects: "Cloud Sync", "iOS App", "Docs Rewrite" (all linked to the goal)
3. When adding daily tasks, they optionally pick a project from a dropdown
4. Unscheduled tasks tied to a project appear in that project's card on the dashboard, not the inbox
5. Goals dashboard shows bird's-eye progress across all three projects in a flowchart layout
6. User hits "Project Focus" on "Cloud Sync" — Focus Mode launches with that project's tasks
7. Weekly Review says "Cloud Sync is 70% done, 'iOS App' has stalled — no tasks completed in 8 days"

---

## Versioning

This feature is targeted for **v1.4.0** — the first feature release on the refactored codebase. As with all dayGLANCE releases, all three deployment targets ship together to avoid version mismatches.

---

## Why It Works for dayGLANCE

The app's strength is the _daily_ view — this feature adds a _why_ layer without changing the daily workflow. You still plan your day the same way; you just optionally tag tasks with a project so the app can tell you whether you're making progress on bigger goals over weeks and months. The toggle means it's invisible to users who don't want it and powerful for those who do.

---

---

# Build Plan

## State Additions (App.jsx)

Following the existing pattern exactly:

```javascript
const [goals, setGoals] = useState([])
const [projects, setProjects] = useState([])
const [showGoalsDashboard, setShowGoalsDashboard] = useState(false)
const [goalsProjectsEnabled, setGoalsProjectsEnabled] = useState(false)
```

New localStorage keys:
- `day-planner-goals`
- `day-planner-projects`
- `day-planner-goals-projects-enabled`

All three included in WebDAV sync payload and backup/restore from day one.

CRUD functions for goals and projects follow the same pattern as task CRUD already in `App.jsx`.

---

## PR Breakdown

All PRs branch from `goals-projects` and merge back into `goals-projects`. Once all PRs are merged and the feature is stable, `goals-projects` merges into `main` as v1.4.0.

---

### PR 1 — Data & Logic Foundation
*Everything behind the scenes. No UI. Independently testable.*

- [ ] Add `goals` and `projects` state to `App.jsx`
- [ ] localStorage read/write for `day-planner-goals` and `day-planner-projects`
- [ ] Add `goalsProjectsEnabled` setting + `day-planner-goals-projects-enabled` persistence
- [ ] Include goals and projects in WebDAV sync payload (`mergeSync.js`)
- [ ] Include goals and projects in backup/restore payload
- [ ] Add `projectId?` to task shape (no migration — undefined on existing tasks)
- [ ] Implement `projectProgress.js` — duration-weighted completion per project
- [ ] Implement `goalProgress.js` — weighted average across child projects
- [ ] Wire goals and projects into `DayPlannerContext`

---

### PR 2 — Dashboard UI
*All visual components and modal wiring. Depends on PR 1.*

- [ ] `GoalProgress.jsx` — progress bar UI for a single goal
- [ ] `ProjectProgress.jsx` — progress bar UI for a single project
- [ ] `ProjectCard.jsx` — progress bar, task counts, stalled badge, Project Focus button (button wired; scoping built in PR 5), quick-add task inline, unscheduled project tasks list
- [ ] `GoalCard.jsx` — collapsible, color-coded, target date, days remaining, child ProjectCards, SVG line anchor points
- [ ] `GoalDashboard.jsx`:
  - Desktop: flowchart layout with SVG overlay connecting Goal cards to Project cards; lines inherit goal color; collapse animates nodes and retracts lines; Standalone Projects section below
  - Mobile: CSS scroll-snap carousel, one goal per page, dot indicators, final page for Standalone Projects
- [ ] Wire `showGoalsDashboard` boolean flag in `App.jsx`
- [ ] Pass all required state/functions via context

---

### PR 3 — Navigation & Settings Toggle
*All entry points and feature gating. Depends on PR 2.*

- [ ] Desktop: floating button in bottom-left of GLANCE panel → opens `GoalDashboard`; hidden when `goalsProjectsEnabled` is false
- [ ] Mobile: add "Goals" tab to tab bar; only rendered when `goalsProjectsEnabled` is true
- [ ] Mobile: move Frames out of tab bar into Settings modal (desktop unaffected)
- [ ] Settings modal: add Goals & Projects toggle, grouped with Habits and Routines
- [ ] When toggled off: Goals tab hidden, GLANCE button hidden, project chips hidden, project-assigned unscheduled tasks reappear in inbox — data untouched

---

### PR 4 — Task Integration
*Connects tasks to projects. Depends on PR 1.*

- [ ] Project dropdown in `DesktopNewTaskModal` — active projects grouped by goal
- [ ] Project dropdown in `MobileNewTaskModal` — same
- [ ] Project chip rendered on task cards in day view (hidden when feature off)
- [ ] Tapping chip filters day view to tasks with that `projectId`; tapping again or changing date clears filter
- [ ] Inbox excludes tasks with a `projectId` when feature is enabled

---

### PR 5 — Focus Mode Integration
*Project-scoped focus sessions. Depends on PRs 1 and 2.*

- [ ] "Project Focus" button on each `ProjectCard` fully wired
- [ ] Launches Focus Mode with `focusBlockTasks` pre-populated with that project's incomplete tasks for today
- [ ] If no tasks today for that project: prompt user to add one or schedule from the project's unscheduled task list
- [ ] Focus session log entries tagged with `projectId`

---

### PR 6 — Weekly Review Integration
*AI summary gains goals/projects context. Depends on PR 1.*

- [ ] Pass active goals and projects into weekly review AI prompt in `ai-prompts.js`
- [ ] Summary can reference per-project task completion, goal progress %, days to target, stalled projects, week-over-week trend
- [ ] No new UI — leverages existing `WeeklyReviewModal` and AI summary flow

---

## Build Order

```
PR 1 (Foundation)
  └─→ PR 2 (Dashboard UI)
        └─→ PR 3 (Nav & Toggle)
  └─→ PR 4 (Task Integration)       [parallel with PR 2]
  └─→ PR 5 (Focus Mode)             [needs PR 1 + PR 2]
  └─→ PR 6 (Weekly Review)          [parallel with PR 2]
```

PRs 4 and 6 can begin as soon as PR 1 is merged. PR 5 needs both PR 1 and PR 2. PR 3 needs PR 2.
