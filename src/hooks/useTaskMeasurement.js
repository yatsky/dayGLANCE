import { useState, useRef, useEffect } from 'react';

export default function useTaskMeasurement({ tasks, visibleDays, mobileActiveTab }) {
  const [taskWidths, setTaskWidths] = useState({});
  const taskElementRefs = useRef({});

  // Measure task widths using ResizeObserver
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const newWidths = {};
      let hasChanges = false;

      for (const entry of entries) {
        const taskId = entry.target.dataset.taskId;
        if (taskId) {
          const width = entry.contentRect.width;
          if (taskWidths[taskId] !== width) {
            newWidths[taskId] = width;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        setTaskWidths(prev => ({ ...prev, ...newWidths }));
      }
    });

    // Observe all registered task elements
    Object.values(taskElementRefs.current).forEach(el => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tasks, visibleDays, mobileActiveTab]); // Re-setup when tasks, visible days, or mobile tab change

  // Ref callback for task elements
  const setTaskRef = (taskId) => (element) => {
    if (element) {
      taskElementRefs.current[taskId] = element;
      // Measure after layout settles (calc-based widths need a frame to resolve)
      requestAnimationFrame(() => {
        if (!element.isConnected) return;
        const width = element.offsetWidth;
        if (width > 0 && taskWidths[taskId] !== width) {
          setTaskWidths(prev => ({ ...prev, [taskId]: width }));
        }
      });
    } else {
      delete taskElementRefs.current[taskId];
    }
  };

  return { taskWidths, setTaskRef };
}
