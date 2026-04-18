import { useState, useEffect } from 'react';

// Column header row is ~32px (py-1.5 + text-xs line-height).
// Subtracted so 8 hour rows fill exactly the remaining vertical space.
const COL_HEADER_HEIGHT = 32;

export default function useDayViewHourHeight(calendarRef, stickyHeaderRef) {
  const [hourHeight, setHourHeight] = useState(80);

  useEffect(() => {
    const compute = () => {
      if (!calendarRef?.current) return;
      const totalH = calendarRef.current.clientHeight;
      const stickyH = stickyHeaderRef?.current?.offsetHeight || 0;
      const usable = Math.max(160, totalH - stickyH - COL_HEADER_HEIGHT);
      setHourHeight(Math.max(20, Math.floor((usable - 8) / 8)));
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (calendarRef?.current) ro.observe(calendarRef.current);
    if (stickyHeaderRef?.current) ro.observe(stickyHeaderRef.current);
    return () => ro.disconnect();
  }, []); // refs are stable objects — no deps needed

  return hourHeight;
}
