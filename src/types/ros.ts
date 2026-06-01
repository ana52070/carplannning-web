// ============================================
// ROS2 Message Type Definitions
// ============================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Pose {
  position: Vector3;
  orientation: Quaternion;
}

export interface Header {
  stamp: { sec: number; nanosec: number };
  frame_id: string;
}

export interface PoseStamped {
  header: Header;
  pose: Pose;
}

export interface Odometry {
  header: Header;
  child_frame_id: string;
  pose: {
    pose: Pose;
    covariance: number[];
  };
  twist: {
    twist: {
      linear: Vector3;
      angular: Vector3;
    };
    covariance: number[];
  };
}

export interface NavSatFix {
  header: Header;
  latitude: number;
  longitude: number;
  altitude: number;
  status: {
    status: number; // -1=no fix, 0=fix, 1=sbas, 2=gbas
    service: number;
  };
}

export interface Twist {
  linear: Vector3;
  angular: Vector3;
}

// ============================================
// Application State Types
// ============================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type NavStatus = 'idle' | 'navigating' | 'succeeded' | 'failed' | 'canceled';

export type RTKFixType = 'none' | 'sps' | 'dgps' | 'rtk_float' | 'rtk_fix';

export interface RobotState {
  // 位置信息
  position: Vector3;
  orientation: Quaternion;
  yaw: number; // degrees

  // GPS 信息
  latitude: number;
  longitude: number;
  altitude: number;
  rtkFixType: RTKFixType;

  // 运动信息
  linearVelocity: number;  // m/s
  angularVelocity: number; // rad/s

  // 导航状态
  navStatus: NavStatus;

  // 时间戳
  lastUpdate: number;
}

// nav_msgs/OccupancyGrid
export interface OccupancyGrid {
  header: Header;
  info: {
    resolution: number;      // m/cell
    width: number;           // cells
    height: number;          // cells
    origin: Pose;            // map frame, lower-left corner
  };
  data: number[];            // row-major, -1=unknown, 0=free, 100=occupied
}

export interface GoalPoint {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  timestamp: number;
}

export const DEFAULT_ROBOT_STATE: RobotState = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  yaw: 0,
  latitude: 0,
  longitude: 0,
  altitude: 0,
  rtkFixType: 'none',
  linearVelocity: 0,
  angularVelocity: 0,
  navStatus: 'idle',
  lastUpdate: 0,
};
