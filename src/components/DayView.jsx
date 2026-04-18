import React from 'react';
import {
  Check, ChevronDown, ChevronUp, FileText, Inbox,
  Pencil, RefreshCw, SkipForward, Trash2,
} from 'lucide-react';
import { renderTitleWithoutTags } from '../utils/textFormatting.jsx';
import { dateToString } from '../utils/taskUtils.js';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';
import { useFeaturesCtx } from '../context/FeaturesContext.jsx';
import useDayViewHourHeight from '../hooks/useDayViewHourHeight.js';

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS = [
  { startHour: 0,  endHour: 8,  label12: '12a \u2013 8a',  label24: '00 \u2013 08' },
  { startHour: 8,  endHour: 16, label12: '8a \u2013 4p',   label24: '08 \u2013 16' },
  { startHour: 16, endHour: 24, label12: '4p \u2013 12a',  label24: '16 \u2013 00' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hourLabel(hour, use24h) {
  if (use24h) return hour.toString().padStart(2, '0');
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function getTaskSlice(task, col, hourHeight, timeToMinutes) {
  const taskStart = timeToMinutes(task.startTime || '0:00');
  const taskEnd = taskStart + (task.duration || 0);
  const colStart = col.startHour * 60;
  const colEnd = col.endHour * 60;

  if (taskEnd <= colStart || taskStart >= colEnd) return null;

  const visStart = Math.max(taskStart, colStart);
  const visEnd = Math.min(taskEnd, colEnd);
  const rawH = (visEnd - visStart) * hourHeight / 60;

  return {
    top: (visStart - colStart) * hourHeight / 60,
    height: Math.max(27, rawH),
    clippedTop: taskStart < colStart,
    clippedBottom: taskEnd > colEnd,
    showTitle: taskStart >= colStart,
  };
}

// Simple conflict layout — returns left/width percentages for a task among its
// overlapping peers within one column. More sophisticated conflict detection
// (matching TimeGrid's algorithm) is deferred to a follow-up PR.
function columnConflictPos(task, colTasks, timeToMinutes) {
  const tStart = timeToMinutes(task.startTime || '0:00');
  const tEnd = tStart + (task.duration || 0);

  const peers = colTasks.filter(other => {
    if (other.id === task.id) return false;
    const oStart = timeToMinutes(other.startTime || '0:00');
    const oEnd = oStart + (other.duration || 0);
    return tStart < oEnd && tEnd > oStart;
  });

  if (peers.length === 0) return { left: '0%', width: '100%' };

  const group = [task, ...peers].sort((a, b) => {
    const diff = timeToMinutes(a.startTime || '0:00') - timeToMinutes(b.startTime || '0:00');
    return diff !== 0 ? diff : String(a.id).localeCompare(String(b.id));
  });

  const idx = group.findIndex(t => t.id === task.id);
  const total = group.length;
  const pct = 100 / total;
  return { left: `${idx * pct}%`, width: `${pct}%` };
}

// ── DayViewColumn ─────────────────────────────────────────────────────────────

const DayViewColumn = ({ col, colIdx, date, dateStr, hourHeight }) => {
  const {
    isTablet,
    darkMode, use24HourClock,
    borderClass, textPrimary, textSecondary,
    tasks,
    expandedRecurringTasks,
    taskContextMenu, setTaskContextMenu,
    toggleComplete,
    moveToRecycleBin, moveToInbox, postponeTask,
    openMobileEditTask,
    setEditingRecurrenceTaskId,
    getTasksForDate,
    getTaskCalendarStyle,
    timeToMinutes, formatTime,
  } = useDayPlannerCtx();

  const { projectFilter } = useFeaturesCtx();

  const allDayTasks = getTasksForDate(date);
  const colTasks = allDayTasks.filter(t => {
    if (t.isAllDay || !t.startTime) return false;
    if (projectFilter && t.projectId !== projectFilter) return false;
    const start = timeToMinutes(t.startTime);
    const end = start + (t.duration || 0);
    return end > col.startHour * 60 && start < col.endHour * 60;
  });

  const colLabel = use24HourClock ? col.label24 : col.label12;
  const hours = Array.from({ length: 8 }, (_, i) => col.startHour + i);

  const altRow = darkMode ? 'bg-white/[0.04]' : 'bg-stone-100/50';

  return (
    <div className={`flex-1 flex flex-col min-w-0 ${colIdx > 0 ? `border-l ${borderClass}` : ''}`}>
      {/* Column header */}
      <div
        className={`flex items-center justify-center border-b ${borderClass} flex-shrink-0`}
        style={{ height: '32px' }}
      >
        <span className={`text-xs font-semibold tracking-wide ${textSecondary}`}>
          {colLabel}
        </span>
      </div>

      {/* Gutter + grid */}
      <div className="flex flex-1 relative">
        {/* Hour label gutter */}
        <div className={`flex-shrink-0 border-r ${borderClass}`} style={{ width: '40px' }}>
          {hours.map(hour => (
            <div
              key={hour}
              className={`px-1 flex items-start justify-end`}
              style={{ height: `${hourHeight}px` }}
            >
              <span className={`text-[10px] ${textSecondary} mt-0.5 leading-none`}>
                {hourLabel(hour, use24HourClock)}
              </span>
            </div>
          ))}
        </div>

        {/* Time slot rows */}
        <div className="flex-1 relative">
          {hours.map((hour, i) => (
            <div
              key={hour}
              className={`border-b ${borderClass} ${i % 2 === 1 ? altRow : ''}`}
              style={{ height: `${hourHeight}px` }}
            />
          ))}

          {/* Half-hour dashed lines */}
          {hours.map(hour => (
            <div
              key={`half-${hour}`}
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: `${(hour - col.startHour) * hourHeight + hourHeight / 2}px` }}
            >
              <div className={`border-b border-dashed ${borderClass} opacity-40`} />
            </div>
          ))}

          {/* Task pills */}
          {colTasks.map(task => {
            const slice = getTaskSlice(task, col, hourHeight, timeToMinutes);
            if (!slice) return null;

            const { top, height, clippedTop, clippedBottom, showTitle } = slice;
            const { left, width } = columnConflictPos(task, colTasks, timeToMinutes);

            const isImported = task.imported;
            const isCalendarEvent = isImported && !task.isTaskCalendar;
            const taskCalStyle = getTaskCalendarStyle(task, darkMode);
            const isCompleted = task.completed;
            const isRecurring = typeof task.id === 'string' && task.id.startsWith('recurring-');

            const radiusTop = clippedTop ? '' : 'rounded-t-lg';
            const radiusBot = clippedBottom ? '' : 'rounded-b-lg';

            return (
              <div
                key={`${task.id}-${col.startHour}`}
                data-ctx-menu
                className={`absolute pointer-events-auto shadow-md overflow-hidden
                  ${task.isTaskCalendar ? '' : task.color}
                  ${radiusTop} ${radiusBot}
                  ${isCompleted && !isCalendarEvent ? 'opacity-50' : ''}
                  ${isCalendarEvent ? 'cursor-default' : 'cursor-pointer'}
                `}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left,
                  width,
                  ...(isCalendarEvent || task.isTaskCalendar ? taskCalStyle : {}),
                }}
                onClick={() => {
                  if (!isCalendarEvent || task.isTaskCalendar || task.nativeEventId) {
                    openMobileEditTask(task, false);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTaskContextMenu({
                    x: e.clientX, y: e.clientY,
                    taskId: task.id,
                    isRecurring: !!isRecurring,
                    isImported: !!isImported,
                    isAllDay: false,
                    dateStr,
                  });
                }}
              >
                {/* Clipped-top indicator */}
                {clippedTop && (
                  <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none">
                    <ChevronUp size={12} className="text-white/70" />
                  </div>
                )}

                <div className="px-1.5 py-0.5 h-full flex flex-col text-white overflow-hidden">
                  {/* Completion checkbox + title row */}
                  {showTitle && (
                    <div className="flex items-start gap-1 min-w-0">
                      {(!isImported || task.isTaskCalendar) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComplete(task.id); }}
                          className={`mt-0.5 rounded flex-shrink-0 border-2 border-white w-3.5 h-3.5 flex items-center justify-center transition-colors ${task.completed ? 'bg-white/40' : 'bg-white/20'} hover:bg-white/30`}
                        >
                          {task.completed && <Check size={9} strokeWidth={3} />}
                        </button>
                      )}
                      {isRecurring && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingRecurrenceTaskId(task.id); }}
                          className="mt-0.5 flex-shrink-0 opacity-75 hover:opacity-100"
                        >
                          <RefreshCw size={10} />
                        </button>
                      )}
                      <div
                        className={`text-xs font-semibold leading-tight truncate flex-1 min-w-0 ${task.completed ? 'line-through' : ''}`}
                        title={task.title}
                      >
                        {renderTitleWithoutTags(task.title)}
                      </div>
                    </div>
                  )}

                  {/* Time label (shown when there's enough height) */}
                  {showTitle && height > 42 && (
                    <div className="text-[10px] opacity-80 leading-none mt-0.5 flex-shrink-0">
                      {formatTime(task.startTime)}
                      {task.duration ? ` \u00b7 ${task.duration}m` : ''}
                    </div>
                  )}
                </div>

                {/* Clipped-bottom indicator */}
                {clippedBottom && (
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none">
                    <ChevronDown size={12} className="text-white/70" />
                  </div>
                )}

                {/* Action buttons (non-imported, non-tablet) */}
                {!isImported && !isTablet && height > 55 && showTitle && (
                  <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); postponeTask(task.id); }}
                      className="hover:bg-white/20 rounded p-0.5 transition-colors text-white/80"
                      title="Postpone to tomorrow"
                    >
                      <SkipForward size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openMobileEditTask(task, false); }}
                      className="hover:bg-white/20 rounded p-0.5 transition-colors text-white/80"
                      title="Edit"
                    >
                      <Pencil size={11} />
                    </button>
                    {isRecurring ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); moveToRecycleBin(task.id); }}
                        className="hover:bg-white/20 rounded p-0.5 transition-colors text-white/80"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); moveToInbox(task.id); }}
                        className="hover:bg-white/20 rounded p-0.5 transition-colors text-white/80"
                        title="Move to Inbox"
                      >
                        <Inbox size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── DayView ───────────────────────────────────────────────────────────────────

const DayView = () => {
  const {
    selectedDate,
    calendarRef, stickyHeaderRef,
  } = useDayPlannerCtx();

  const hourHeight = useDayViewHourHeight(calendarRef, stickyHeaderRef);
  const dateStr = dateToString(selectedDate);

  return (
    <div className="flex" style={{ height: '100%' }}>
      {COLUMNS.map((col, colIdx) => (
        <DayViewColumn
          key={col.startHour}
          col={col}
          colIdx={colIdx}
          date={selectedDate}
          dateStr={dateStr}
          hourHeight={hourHeight}
        />
      ))}
    </div>
  );
};

export default DayView;
