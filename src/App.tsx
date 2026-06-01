import { useState, useCallback, useEffect } from 'react';
import { StatusBar } from './components/StatusBar';
import { MapView } from './components/MapView';
import { ControlPanel } from './components/ControlPanel';
import { useROS } from './hooks/useROS';
import type { GoalPoint, OccupancyGrid } from './types/ros';

function App() {
  const {
    status,
    robotState,
    costmap,
    connect,
    disconnect,
    sendGoal,
    sendCmdVel,
    stop,
  } = useROS();

  const [goalPoints, setGoalPoints] = useState<GoalPoint[]>([]);
  const [currentGoalIndex, setCurrentGoalIndex] = useState<number>(-1);
  const [panelOpen, setPanelOpen] = useState(false);

  // 桌面端始终展开面板，移动端默认收起
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setPanelOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleGoalSet = useCallback((lat: number, lng: number) => {
    // lat/lng 来自 AMap click，坐标系为 GCJ02（非 WGS84）
    // 发给机器人前需要做 GCJ02→WGS84 反转，或统一用 map frame 坐标
    const newGoal: GoalPoint = {
      id: `goal_${Date.now()}`,
      latitude: lat,
      longitude: lng,
      timestamp: Date.now(),
    };
    setGoalPoints((prev) => [...prev, newGoal]);
  }, []);

  const handleDeleteGoal = useCallback((id: string) => {
    setGoalPoints((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      const next = prev.filter((g) => g.id !== id);
      setCurrentGoalIndex((ci) => {
        if (ci < 0) return ci;
        if (idx < ci) return ci - 1;
        if (idx === ci) return -1;
        return ci;
      });
      return next;
    });
  }, []);

  // TODO: 接入实际 GPS→map 坐标转换后替换此处的 lat/lng 透传
  const handleSendGoalAt = useCallback((index: number) => {
    const goal = goalPoints[index];
    if (!goal) return;
    sendGoal(goal.latitude, goal.longitude);
    setCurrentGoalIndex(index);
  }, [goalPoints, sendGoal]);

  const handleClearGoals = useCallback(() => {
    setGoalPoints([]);
    setCurrentGoalIndex(-1);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <StatusBar connectionStatus={status} robotState={robotState} />
      <div className="flex flex-1 overflow-hidden relative">
        <MapView
          robotState={robotState}
          onGoalSet={handleGoalSet}
          goalPoints={goalPoints}
          costmap={costmap}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* 移动端半透明遮罩 */}
        {panelOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setPanelOpen(false)}
          />
        )}

        <ControlPanel
          connectionStatus={status}
          robotState={robotState}
          goalPoints={goalPoints}
          currentGoalIndex={currentGoalIndex}
          isOpen={panelOpen}
          onConnect={connect}
          onDisconnect={disconnect}
          onSendGoalAt={handleSendGoalAt}
          onDeleteGoal={handleDeleteGoal}
          onStop={stop}
          onClearGoals={handleClearGoals}
          onSendCmdVel={sendCmdVel}
          onClose={() => setPanelOpen(false)}
        />
      </div>
    </div>
  );
}

export default App;
