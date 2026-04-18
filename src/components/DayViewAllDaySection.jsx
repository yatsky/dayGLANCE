import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderTitleWithoutTags } from '../utils/textFormatting.jsx';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { useFeaturesCtx } from '../context/FeaturesContext.jsx';

// ── TaskChip ──────────────────────────────────────────────────────────────────

const TaskChip = ({ task, onClick, getTaskCalendarStyle, darkMode }) => {
  const isCalendarEvent = task.imported && !task.isTaskCalendar;
  const calStyle = (isCalendarEvent || task.isTaskCalendar) ? getTaskCalendarStyle(task, darkMode) : {};
  return (
    <button
      onClick={onClick}
      className={`${task.isTaskCalendar ? '' : task.color} text-white text-xs font-medium px-2 py-1 rounded-md shadow-sm truncate max-w-[200px] flex-shrink-0 ${task.completed ? 'opacity-50 line-through' : ''}`}
      style={calStyle}
      title={task.title}
    >
      {renderTitleWithoutTags(task.title)}
    </button>
  );
};

// ── GroupChips — one date group with 2-row height cap + "+N more" popover ────

const CHIP_ROW_H = 28; // px: approximate height of one chip row (text-xs + py-1)
const ROW_GAP = 4;     // px: gap-1 = 4px
const MAX_ROWS = 2;
const MAX_H = CHIP_ROW_H * MAX_ROWS + ROW_GAP * (MAX_ROWS - 1);

const GroupChips = ({ tasks, darkMode, textSecondary, borderClass, cardBg, getTaskCalendarStyle, openMobileEditTask }) => {
  const ghostRef = useRef(null);
  const overflowRef = useRef(null);
  const [limit, setLimit] = useState(null); // null = show all
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Measure which chips fit within MAX_ROWS. Re-runs on task count change AND
  // on container width change (ResizeObserver) so wrapping recalculates on resize.
  useLayoutEffect(() => {
    const el = ghostRef.current;
    if (!el) return;

    const measure = () => {
      const chips = Array.from(el.children);
      if (!chips.length || !tasks.length) { setLimit(null); return; }
      const rowTop = chips[0].offsetTop;
      const maxBottom = rowTop + MAX_H;
      let lastFit = chips.length;
      for (let i = 0; i < chips.length; i++) {
        if (chips[i].offsetTop + chips[i].offsetHeight > maxBottom + 2) {
          lastFit = i;
          break;
        }
      }
      setLimit(lastFit < chips.length ? Math.max(0, lastFit - 1) : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tasks.length]);

  // Click-outside dismisses the overflow popover
  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (e) => {
      if (!overflowRef.current?.contains(e.target)) setOverflowOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOverflowOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [overflowOpen]);

  const shown = limit !== null ? tasks.slice(0, limit) : tasks;
  const overflowTasks = limit !== null ? tasks.slice(limit) : [];

  return (
    <div className="relative p-1.5">
      {/* Ghost render for measurement — invisible, no pointer events */}
      <div
        ref={ghostRef}
        className="absolute top-1.5 left-1.5 right-1.5 flex flex-wrap gap-1 opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        {tasks.map(t => (
          <TaskChip key={t.id} task={t} darkMode={darkMode} getTaskCalendarStyle={getTaskCalendarStyle} />
        ))}
      </div>

      {/* Visible chips */}
      <div className="flex flex-wrap gap-1" style={{ maxHeight: MAX_H + 12 }}>
        {shown.map(t => (
          <TaskChip
            key={t.id}
            task={t}
            darkMode={darkMode}
            getTaskCalendarStyle={getTaskCalendarStyle}
            onClick={() => openMobileEditTask(t, false)}
          />
        ))}

        {/* "+N more" overflow chip + popover */}
        {overflowTasks.length > 0 && (
          <div ref={overflowRef} className="relative flex-shrink-0">
            <button
              onClick={() => setOverflowOpen(v => !v)}
              className={`text-xs font-medium px-2 py-1 rounded-md ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'} transition-colors`}
            >
              +{overflowTasks.length} more
            </button>
            {overflowOpen && (
              <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg shadow-xl border ${borderClass} ${cardBg} p-2 min-w-[160px] max-w-[260px] flex flex-col gap-1`}>
                {overflowTasks.map(t => (
                  <TaskChip
                    key={t.id}
                    task={t}
                    darkMode={darkMode}
                    getTaskCalendarStyle={getTaskCalendarStyle}
                    onClick={() => { setOverflowOpen(false); openMobileEditTask(t, false); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── DayViewAllDaySection ──────────────────────────────────────────────────────

const allDayOrder = (t) => {
  if (t.importSource === 'file') return 0;
  if (t.imported && !t.isTaskCalendar) return 1;
  if (t.isTaskCalendar) return 2;
  if (typeof t.id === 'string' && t.id.startsWith('recurring-')) return 4;
  return 3;
};

const DayViewAllDaySection = () => {
  const {
    darkMode,
    borderClass, textSecondary, cardBg,
    dayViewColumns,
    getTasksForDate, getTaskCalendarStyle,
    openMobileEditTask,
  } = useDayPlannerCtx();
  const { projectFilter } = useFeaturesCtx();

  // Build date groups (same logic as CalendarHeader day-mode header)
  const dateGroups = [];
  for (const col of dayViewColumns) {
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.dateStr === col.dateStr) {
      last.count++;
    } else {
      dateGroups.push({ dateStr: col.dateStr, date: col.date, count: 1 });
    }
  }

  const groupsWithTasks = dateGroups.map(group => ({
    ...group,
    tasks: getTasksForDate(group.date)
      .filter(t => t.isAllDay && (!projectFilter || t.projectId === projectFilter))
      .sort((a, b) => allDayOrder(a) - allDayOrder(b)),
  }));

  if (!groupsWithTasks.some(g => g.tasks.length > 0)) return null;

  return (
    <div className={`flex border-b ${borderClass} ${cardBg}`}>
      {groupsWithTasks.map(group => (
        <div key={group.dateStr} style={{ flex: group.count }} className="min-w-0">
          <GroupChips
            tasks={group.tasks}
            darkMode={darkMode}
            textSecondary={textSecondary}
            borderClass={borderClass}
            cardBg={cardBg}
            getTaskCalendarStyle={getTaskCalendarStyle}
            openMobileEditTask={openMobileEditTask}
          />
        </div>
      ))}
    </div>
  );
};

export default DayViewAllDaySection;
