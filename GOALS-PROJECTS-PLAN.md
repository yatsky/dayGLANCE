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
  color?          // for visual grouping in dashboard and focus mode
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

---

## File Structure

Goals and projects are distinct enough in data shape, progress logic, and UI surface to live in separate directories. Progress utilities are self-contained and referenced from multiple places (dashboard, focus mode, weekly review), so they live in `/utils` rather than inside any component.

```
/components/goals/
  GoalCard.jsx          // collapsible card with color, target date, days remaining, progress bar
  GoalDashboard.jsx     // parent composer — renders goal cards with nested project cards
  GoalProgress.jsx      // progress bar UI for a single goal

/components/projects/
  ProjectCard.jsx       // mini progress bar, task counts, stalled indicator, quick-add
  ProjectProgress.jsx   // progress bar UI for a single project

/utils/
  goalProgress.js       // weighted average of progress across child projects
  projectProgress.js    // duration-weighted task completion for a single project
```

`GoalDashboard.jsx` is the single entry point rendered from the nav. It composes both goal and project components but owns no progress logic itself — that stays in the utils.

---

## How It Fits Into dayGLANCE

### Day view

Unchanged. Tasks still show on the timeline. A small project dot/chip appears next to the task title so the user knows what it belongs to. Tapping the chip filters to that project (effectively triggering focus mode for that project).

### Task creation / inbox

Tasks can optionally be assigned to a project via a dropdown when created. Unassigned tasks stay in the inbox as today.

### Goals & Projects dashboard

Accessible from the nav. On desktop it opens as a modal; on mobile it is a dedicated tab.

The dashboard shows:

- Each goal as a collapsible card with its color, target date, and days remaining
- Overall goal progress bar (duration-weighted, derived from child projects)
- Nested projects with their own mini progress bars
- Per-project task counts (completed / total)
- Stalled project indicator (no tasks completed in 7+ days)
- Quick-add task to project inline

### Focus Mode integration

When starting a focus session, optionally scope it to a single project. The day view filters to show only tasks with that `projectId`. Session stats roll up to the project level and feed into the dashboard progress calculations. This makes Focus Mode aware of _why_ you're working, not just _what_ you're working on.

### Weekly Review / AI summary integration

The AI summary gains goal and project context:

- "You completed 4/7 tasks in Project X this week"
- "Goal Y is 60% complete with 12 days until target"
- Nudges for stalled projects (no tasks completed in 7+ days)
- Progress trend: is a goal accelerating or stalling compared to last week?

### Existing stats

Weekly and all-time stats can be sliced by project or goal, showing duration logged and tasks completed within each context.

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
2. Adds Projects: "Cloud Sync", "iOS App", "Docs Rewrite" (no goalId required on any of them, but in this case all three are linked to the goal)
3. When adding daily tasks, they optionally pick a project from a dropdown
4. Goals dashboard shows bird's-eye progress across all three projects
5. User triggers Focus Mode for "Cloud Sync" — day view filters to only those tasks
6. Weekly Review says "Cloud Sync is 70% done, 'iOS App' project has stalled — no tasks completed in 8 days"

---

## Versioning

This feature is targeted for **v1.4.0** — the first feature release on the refactored codebase. As with all dayGLANCE releases, all three deployment targets ship together to avoid version mismatches.

---

## Why It Works for dayGLANCE

The app's strength is the _daily_ view — this feature adds a _why_ layer without changing the daily workflow. You still plan your day the same way; you just optionally tag tasks with a project so the app can tell you whether you're making progress on bigger goals over weeks and months. The toggle means it's invisible to users who don't want it and powerful for those who do.
