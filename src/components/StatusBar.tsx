import {
  Wifi,
  WifiOff,
  Satellite,
  Clock,
  Cpu,
} from 'lucide-react';
import type { ConnectionStatus, RobotState, RTKFixType } from '../types/ros';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  robotState: RobotState;
}

const connectionLabels: Record<ConnectionStatus, string> = {
  disconnected: '未连接',
  connecting: '连接中…',
  connected: '已连接',
  error: '连接错误',
};

const connectionColors: Record<ConnectionStatus, string> = {
  disconnected: 'var(--text-muted)',
  connecting: 'var(--accent-yellow)',
  connected: 'var(--accent-green)',
  error: 'var(--accent-red)',
};

const rtkLabels: Record<RTKFixType, string> = {
  none: '无信号',
  sps: 'SPS',
  dgps: 'DGPS',
  rtk_float: 'RTK Float',
  rtk_fix: 'RTK Fix',
};

const rtkColors: Record<RTKFixType, string> = {
  none: 'var(--accent-red)',
  sps: 'var(--accent-yellow)',
  dgps: 'var(--accent-yellow)',
  rtk_float: 'var(--accent-cyan)',
  rtk_fix: 'var(--accent-green)',
};

export function StatusBar({ connectionStatus, robotState }: StatusBarProps) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });

  const isConnected = connectionStatus === 'connected';
  const WifiIcon = isConnected ? Wifi : WifiOff;

  return (
    <header
      className="flex items-center justify-between px-5 h-10 shrink-0 select-none"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {/* Left: Project title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: connectionColors[connectionStatus],
              boxShadow: isConnected
                ? '0 0 6px var(--accent-green)'
                : 'none',
            }}
          />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-secondary)',
            }}
          >
            校园智巡
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
          }}
        >
          NAV CONSOLE v1.0
        </span>
      </div>

      {/* Center: Status indicators */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* ROS Connection */}
        <div className="flex items-center gap-1.5">
          <WifiIcon
            size={13}
            style={{ color: connectionColors[connectionStatus] }}
          />
          <span
            className="text-xs"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: connectionColors[connectionStatus],
            }}
          >
            {connectionLabels[connectionStatus]}
          </span>
        </div>

        {/* RTK Status */}
        <div className="flex items-center gap-1.5">
          <Satellite size={13} style={{ color: rtkColors[robotState.rtkFixType] }} />
          <span
            className="text-xs"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: rtkColors[robotState.rtkFixType],
            }}
          >
            {rtkLabels[robotState.rtkFixType]}
          </span>
        </div>

        {/* Coordinates — 仅桌面显示 */}
        {robotState.latitude !== 0 && (
          <span
            className="hidden md:inline text-xs"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-muted)',
            }}
          >
            {robotState.latitude.toFixed(6)}, {robotState.longitude.toFixed(6)}
          </span>
        )}
      </div>

      {/* Right: System info — 仅桌面显示 */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu size={12} style={{ color: 'var(--text-muted)' }} />
          <span
            className="text-xs"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-muted)',
            }}
          >
            Xavier NX
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={12} style={{ color: 'var(--text-muted)' }} />
          <span
            className="text-xs"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-muted)',
            }}
          >
            {timeStr}
          </span>
        </div>
      </div>
    </header>
  );
}
