import { useEffect } from 'react';

export default function useAppInit({
  loadData, fetchAllDailyContent, setContentRotation,
  dataLoaded, hasZeroRealTasks,
  hasCheckedInitialWelcome,
  showWelcome, setShowWelcome,
}) {
  // Load data and fetch daily content on mount; rotate content every 15 minutes
  useEffect(() => {
    loadData();
    fetchAllDailyContent();

    // Rotate content every 15 minutes
    const rotationInterval = setInterval(() => {
      setContentRotation(prev => (prev + 1) % 4);
    }, 15 * 60 * 1000);

    return () => {
      clearInterval(rotationInterval);
    };
  }, []);

  // Persist welcome dismissal only when user has real tasks
  useEffect(() => {
    if (!showWelcome && !hasZeroRealTasks) {
      localStorage.setItem('welcomeDismissed', 'true');
    }
  }, [showWelcome, hasZeroRealTasks]);

  // Show welcome only on initial load with zero tasks (not when zeroing out during session)
  useEffect(() => {
    if (dataLoaded && !hasCheckedInitialWelcome.current) {
      hasCheckedInitialWelcome.current = true;
      if (hasZeroRealTasks) {
        setShowWelcome(true);
        localStorage.removeItem('welcomeDismissed');
      } else {
        setShowWelcome(false);
      }
    }
  }, [dataLoaded, hasZeroRealTasks]);
}
