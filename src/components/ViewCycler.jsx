import React from 'react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';

const STATES = ['multi', 'day', 'week'];
const LABELS = { multi: 'MULTI', day: 'DAY', week: 'WEEK' };
const ORANGE = '#fe8b00';

const MultiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="16" height="16" rx="2" fill={ORANGE} />
  </svg>
);

const DayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1"  y="2" width="5" height="16" rx="1" fill={ORANGE} fillOpacity="1"    />
    <rect x="7.5" y="2" width="5" height="16" rx="1" fill={ORANGE} fillOpacity="0.55" />
    <rect x="14" y="2" width="5" height="16" rx="1" fill={ORANGE} fillOpacity="0.28" />
  </svg>
);

const WeekIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {[0, 3, 6, 9, 12, 15, 18].map((x, i) => (
      <rect
        key={i}
        x={x}
        y="2"
        width="2"
        height="16"
        rx="1"
        fill={ORANGE}
        fillOpacity={i === 0 || i === 6 ? 0.5 : 1}
      />
    ))}
  </svg>
);

const ICONS = { multi: MultiIcon, day: DayIcon, week: WeekIcon };

const ViewCycler = () => {
  const { viewMode, setViewMode, textSecondary } = useDayPlannerCtx();

  const cycle = () => {
    const idx = STATES.indexOf(viewMode);
    setViewMode(STATES[(idx + 1) % STATES.length]);
  };

  const Icon = ICONS[viewMode] || MultiIcon;

  return (
    <button
      onClick={cycle}
      className="flex flex-col items-center justify-center gap-0.5 w-full h-full py-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded"
      title={`View: ${LABELS[viewMode]} (1/2/3 to switch)`}
      aria-label={`Current view: ${LABELS[viewMode]}. Click to cycle view.`}
    >
      <Icon />
      <span
        className={`text-[11px] font-semibold tracking-widest uppercase ${textSecondary} leading-none`}
      >
        {LABELS[viewMode]}
      </span>
    </button>
  );
};

export default ViewCycler;
