import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Gauge,
  Compass,
  MapPin,
  Trash2,
  Play,
  Square,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  RotateCw,
  Wifi,
  WifiOff,
  ArrowUpCircle,
  X,
} from 'lucide-react';
import type {
  ConnectionStatus,
  RobotState,
  GoalPoint,
  NavStatus,
  RTKFixType,
} from '../types/ros';
import { CONFIG } from '../config';

// ============================================
// Sub-components
// ============================================

function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div
      className="flex items-center gap-2 pb-2 mb-3"
      style={{ borderBottom: '1px solid var(--border-primary)' }}
    >
      <Icon size={13} style={{ color: 'var(--accent-blue)' }} />
      <span
        className="text-xs font-semibold tracking-wider uppercase"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-secondary)',
        }}
      >
        {title}
      </span>
    </div>
  );
}

function DataRow({
  label,
  value,
  color,
  unit,
}: {
  label: string;
  value: string | number;
  color?: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="text-xs font-medium"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: color || 'var(--text-primary)',
        }}
      >
        {value}
        {unit && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

// ============================================
// Navigation Status
// ============================================

const navStatusConfig: Record<NavStatus, { label: string; color: string }> = {
  idle: { label: '空闲', color: 'var(--text-muted)' },
  navigating: { label: '导航中', color: 'var(--accent-blue)' },
  succeeded: { label: '已到达', color: 'var(--accent-green)' },
  failed: { label: '导航失败', color: 'var(--accent-red)' },
  canceled: { label: '已取消', color: 'var(--accent-yellow)' },
};

const rtkFixConfig: Record<RTKFixType, { color: string }> = {
  none: { color: 'var(--accent-red)' },
  sps: { color: 'var(--accent-yellow)' },
  dgps: { color: 'var(--accent-yellow)' },
  rtk_float: { color: 'var(--accent-cyan)' },
  rtk_fix: { color: 'var(--accent-green)' },
};

// ============================================
// Main Component
// ============================================

interface ControlPanelProps {
  connectionStatus: ConnectionStatus;
  robotState: RobotState;
  goalPoints: GoalPoint[];
  currentGoalIndex: number;
  isOpen: boolean;
  onConnect: (url?: string) => void;
  onDisconnect: () => void;
  onSendGoalAt: (index: number) => void;
  onDeleteGoal: (id: string) => void;
  onStop: () => void;
  onClearGoals: () => void;
  onSendCmdVel: (linear: number, angular: number) => void;
  onClose: () => void;
}

export function ControlPanel({
  connectionStatus,
  robotState,
  goalPoints,
  currentGoalIndex,
  isOpen,
  onConnect,
  onDisconnect,
  onSendGoalAt,
  onDeleteGoal,
  onStop,
  onClearGoals,
  onSendCmdVel,
  onClose,
}: ControlPanelProps) {
  const [rosbridgeUrl, setRosbridgeUrl] = useState<string>(CONFIG.ROSBRIDGE_URL);
  const isConnected = connectionStatus === 'connected';
  const cmdVelIntervalRef = useRef<number | null>(null);

  // 手动控制 — 按住发送速度，松开停止
  const startCmdVel = useCallback(
    (linear: number, angular: number) => {
      onSendCmdVel(linear, angular);
      cmdVelIntervalRef.current = window.setInterval(() => {
        onSendCmdVel(linear, angular);
      }, 100);
    },
    [onSendCmdVel]
  );

  const stopCmdVel = useCallback(() => {
    if (cmdVelIntervalRef.current) {
      clearInterval(cmdVelIntervalRef.current);
      cmdVelIntervalRef.current = null;
    }
    onSendCmdVel(0, 0);
  }, [onSendCmdVel]);

  useEffect(() => {
    return () => {
      if (cmdVelIntervalRef.current) clearInterval(cmdVelIntervalRef.current);
    };
  }, []);

  const navStatusInfo = navStatusConfig[robotState.navStatus];
  const rtkInfo = rtkFixConfig[robotState.rtkFixType];

  return (
    <aside
      className={[
        'w-72 flex flex-col overflow-y-auto shrink-0',
        // 桌面端：正常流布局，始终可见
        'md:relative md:h-full md:translate-x-0',
        // 移动端：固定覆盖层，右滑进入
        'fixed inset-y-0 right-0 z-50',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
      ].join(' ')}
      style={{
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-primary)',
      }}
    >
      {/* 移动端关闭按钮 */}
      <button
        onClick={onClose}
        className="md:hidden absolute top-3 left-3 z-10 w-7 h-7 flex items-center justify-center rounded cursor-pointer"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}
        title="关闭面板"
      >
        <X size={14} />
      </button>

      {/* Connection */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <SectionHeader title="连接" icon={isConnected ? Wifi : WifiOff} />
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={rosbridgeUrl}
            onChange={(e) => setRosbridgeUrl(e.target.value)}
            placeholder="ws://192.168.x.x:9090"
            className="flex-1 text-xs px-2.5 py-1.5 rounded outline-none transition-colors"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent-blue)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-primary)')}
          />
        </div>
        <button
          onClick={() =>
            isConnected ? onDisconnect() : onConnect(rosbridgeUrl)
          }
          className="w-full text-xs font-medium py-1.5 rounded transition-all duration-150 cursor-pointer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: isConnected ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
            color: isConnected ? 'var(--accent-red)' : 'white',
            border: `1px solid ${isConnected ? 'var(--accent-red)' : 'var(--accent-blue)'}`,
          }}
        >
          {isConnected ? '断开连接' : '连接'}
        </button>
      </div>

      {/* Robot Status */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <SectionHeader title="机器人状态" icon={Gauge} />

        <DataRow
          label="导航状态"
          value={navStatusInfo.label}
          color={navStatusInfo.color}
        />
        <DataRow
          label="RTK 状态"
          value={robotState.rtkFixType.toUpperCase()}
          color={rtkInfo.color}
        />
        <DataRow
          label="线速度"
          value={robotState.linearVelocity.toFixed(2)}
          unit="m/s"
        />
        <DataRow
          label="角速度"
          value={robotState.angularVelocity.toFixed(2)}
          unit="rad/s"
        />

        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <DataRow
            label="航向角"
            value={robotState.yaw.toFixed(1)}
            unit="°"
            color="var(--accent-cyan)"
          />
          <DataRow
            label="X"
            value={robotState.position.x.toFixed(3)}
            unit="m"
          />
          <DataRow
            label="Y"
            value={robotState.position.y.toFixed(3)}
            unit="m"
          />
        </div>

        {/* GPS 位置 — 有 fix 时才显示 */}
        {robotState.latitude !== 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <DataRow
              label="纬度"
              value={robotState.latitude.toFixed(7)}
              color="var(--accent-cyan)"
            />
            <DataRow
              label="经度"
              value={robotState.longitude.toFixed(7)}
              color="var(--accent-cyan)"
            />
            <DataRow
              label="海拔"
              value={robotState.altitude.toFixed(1)}
              unit="m"
            />
            {robotState.positionCovariance.length >= 5 && (
              <DataRow
                label="水平精度"
                value={`±${Math.sqrt(
                  robotState.positionCovariance[0] + robotState.positionCovariance[4]
                ).toFixed(2)}`}
                unit="m"
                color="var(--text-secondary)"
              />
            )}
          </div>
        )}
      </div>

      {/* Goal Points */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <SectionHeader title="航点规划" icon={MapPin} />

        {goalPoints.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
            点击地图依次添加航点
          </p>
        ) : (
          <div className="flex flex-col gap-1 mb-3 max-h-48 overflow-y-auto">
            {goalPoints.map((goal, index) => {
              const isCurrent = index === currentGoalIndex;
              const isDone = currentGoalIndex >= 0 && index < currentGoalIndex;
              return (
                <div
                  key={goal.id}
                  className="flex items-center gap-2 py-1 px-2 rounded"
                  style={{
                    background: isCurrent ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isCurrent ? 'var(--accent-blue)' : 'transparent'}`,
                  }}
                >
                  <span
                    className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isDone
                        ? 'var(--accent-green)'
                        : isCurrent
                        ? 'var(--accent-blue)'
                        : 'var(--accent-red)',
                      color: 'white',
                      fontSize: 10,
                    }}
                  >
                    {isDone ? '✓' : index + 1}
                  </span>
                  <span
                    className="flex-1 text-xs truncate"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isDone ? 'var(--text-muted)' : 'var(--text-secondary)',
                    }}
                  >
                    {goal.latitude.toFixed(5)}, {goal.longitude.toFixed(5)}
                  </span>
                  <button
                    onClick={() => onDeleteGoal(goal.id)}
                    className="shrink-0 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ color: 'var(--accent-red)', lineHeight: 1 }}
                    title="删除此航点"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          {/* 顺序导航：从第一个未到达的点开始 */}
          <button
            onClick={() => {
              const nextIdx = currentGoalIndex < 0 ? 0 : currentGoalIndex + 1;
              if (nextIdx < goalPoints.length) onSendGoalAt(nextIdx);
            }}
            disabled={goalPoints.length === 0 || !isConnected ||
              (currentGoalIndex >= 0 && currentGoalIndex >= goalPoints.length - 1)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none',
            }}
          >
            <Play size={11} />
            {currentGoalIndex < 0 ? '出发' : '下一个'}
          </button>
          <button
            onClick={onStop}
            disabled={!isConnected}
            className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--accent-red)',
              color: 'white',
              border: 'none',
            }}
          >
            <Square size={11} /> 停止
          </button>
          <button
            onClick={onClearGoals}
            disabled={goalPoints.length === 0}
            className="flex items-center justify-center text-xs py-1.5 px-2 rounded transition-all cursor-pointer disabled:opacity-30"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-muted)',
            }}
            title="清除全部航点"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Manual Control */}
      <div className="p-4">
        <SectionHeader title="手动控制" icon={Compass} />

        <div className="flex flex-col items-center gap-1.5">
          {/* Forward */}
          <ControlButton
            icon={ChevronUp}
            onStart={() => startCmdVel(0.3, 0)}
            onStop={stopCmdVel}
            disabled={!isConnected}
          />

          {/* Left, Stop, Right */}
          <div className="flex gap-1.5">
            <ControlButton
              icon={RotateCcw}
              onStart={() => startCmdVel(0, 0.5)}
              onStop={stopCmdVel}
              disabled={!isConnected}
            />
            <ControlButton
              icon={ArrowUpCircle}
              onStart={stopCmdVel}
              onStop={() => {}}
              disabled={!isConnected}
              isStop
            />
            <ControlButton
              icon={RotateCw}
              onStart={() => startCmdVel(0, -0.5)}
              onStop={stopCmdVel}
              disabled={!isConnected}
            />
          </div>

          {/* Backward */}
          <ControlButton
            icon={ChevronDown}
            onStart={() => startCmdVel(-0.3, 0)}
            onStop={stopCmdVel}
            disabled={!isConnected}
          />
        </div>

        <p
          className="text-center text-xs mt-3"
          style={{ color: 'var(--text-muted)' }}
        >
          按住按钮控制移动
        </p>
      </div>
    </aside>
  );
}

// ============================================
// Control Button
// ============================================

function ControlButton({
  icon: Icon,
  onStart,
  onStop,
  disabled,
  isStop,
}: {
  icon: any;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
  isStop?: boolean;
}) {
  return (
    <button
      onMouseDown={onStart}
      onMouseUp={onStop}
      onMouseLeave={onStop}
      onTouchStart={onStart}
      onTouchEnd={onStop}
      disabled={disabled}
      className="w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-100 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed active:scale-95"
      style={{
        background: isStop ? 'var(--accent-red)' : 'var(--bg-tertiary)',
        border: `1px solid ${isStop ? 'var(--accent-red)' : 'var(--border-primary)'}`,
        color: isStop ? 'white' : 'var(--text-secondary)',
      }}
    >
      <Icon size={18} />
    </button>
  );
}
