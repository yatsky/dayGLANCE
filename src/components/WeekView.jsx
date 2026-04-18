import React from 'react';
import { useDayPlannerCtx } from '../context/DayPlannerContext.jsx';

const WeekView = () => {
  const { textSecondary } = useDayPlannerCtx();
  return (
    <div className="flex flex-1 items-center justify-center" style={{ height: '100%' }}>
      <span className={`text-sm ${textSecondary}`}>Week view coming soon</span>
    </div>
  );
};

export default WeekView;
