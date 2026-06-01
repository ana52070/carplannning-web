import { useEffect, useRef, useState, useCallback } from 'react';
import { Ros, Topic } from 'roslib';
import { CONFIG } from '../config';
import type {
  ConnectionStatus,
  RobotState,
  Odometry,
  NavSatFix,
  RTKFixType,
  OccupancyGrid,
} from '../types/ros';
import { DEFAULT_ROBOT_STATE } from '../types/ros';

/**
 * 四元数转 yaw 角（度）
 */
function quaternionToYaw(q: { x: number; y: number; z: number; w: number }): number {
  const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  return (Math.atan2(siny_cosp, cosy_cosp) * 180) / Math.PI;
}

/**
 * GPS status 转 RTK fix type
 */
function gpsStatusToFixType(status: number): RTKFixType {
  switch (status) {
    case -1: return 'none';
    case 0: return 'sps';
    case 1: return 'dgps';
    case 2: return 'rtk_float';
    // status=2 也可能是 RTK fix，取决于 covariance 精度
    // 实际使用时可能需要根据 UM982 的具体输出做更精细判断
    default: return 'none';
  }
}

export function useROS() {
  const rosRef = useRef<Ros | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [robotState, setRobotState] = useState<RobotState>(DEFAULT_ROBOT_STATE);
  const [costmap, setCostmap] = useState<OccupancyGrid | null>(null);

  // 连接 rosbridge
  const connect = useCallback((url?: string) => {
    const wsUrl = url || CONFIG.ROSBRIDGE_URL;

    if (rosRef.current) {
      rosRef.current.close();
    }

    setStatus('connecting');

    const ros = new Ros({ url: wsUrl });

    ros.on('connection', () => {
      console.log('[ROS] Connected to', wsUrl);
      setStatus('connected');
    });

    ros.on('error', (error: unknown) => {
      console.error('[ROS] Error:', error);
      setStatus('error');
    });

    ros.on('close', () => {
      console.log('[ROS] Connection closed');
      setStatus('disconnected');
    });

    rosRef.current = ros;

    // 订阅里程计
    const odomSub = new Topic({
      ros,
      name: CONFIG.TOPICS.ODOM,
      messageType: 'nav_msgs/Odometry',
    });

    odomSub.subscribe((msg: any) => {
      const odom = msg as unknown as Odometry;
      setRobotState((prev) => ({
        ...prev,
        position: odom.pose.pose.position,
        orientation: odom.pose.pose.orientation,
        yaw: quaternionToYaw(odom.pose.pose.orientation),
        linearVelocity: Math.sqrt(
          odom.twist.twist.linear.x ** 2 + odom.twist.twist.linear.y ** 2
        ),
        angularVelocity: odom.twist.twist.angular.z,
        lastUpdate: Date.now(),
      }));
    });

    // 订阅 GPS
    const gpsSub = new Topic({
      ros,
      name: CONFIG.TOPICS.GPS_FIX,
      messageType: 'sensor_msgs/NavSatFix',
    });

    gpsSub.subscribe((msg: any) => {
      const fix = msg as unknown as NavSatFix;
      setRobotState((prev) => ({
        ...prev,
        latitude: fix.latitude,
        longitude: fix.longitude,
        altitude: fix.altitude,
        rtkFixType: gpsStatusToFixType(fix.status.status),
        positionCovariance: fix.position_covariance ?? [],
      }));
    });

    // 订阅 costmap（local_costmap 更新频率较高，global 较低）
    const costmapSub = new Topic({
      ros,
      name: '/local_costmap/costmap',
      messageType: 'nav_msgs/OccupancyGrid',
    });
    costmapSub.subscribe((msg: any) => {
      setCostmap(msg as unknown as OccupancyGrid);
    });
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (rosRef.current) {
      rosRef.current.close();
      rosRef.current = null;
    }
  }, []);

  // 发布导航目标
  const sendGoal = useCallback((x: number, y: number, yaw: number = 0) => {
    if (!rosRef.current) return;

    const goalPub = new Topic({
      ros: rosRef.current,
      name: CONFIG.TOPICS.GOAL_POSE,
      messageType: 'geometry_msgs/PoseStamped',
    });

    // yaw → quaternion
    const halfYaw = (yaw * Math.PI) / 360;
    const goal = ({
      header: {
        stamp: { sec: 0, nanosec: 0 },
        frame_id: CONFIG.FRAMES.MAP,
      },
      pose: {
        position: { x, y, z: 0 },
        orientation: {
          x: 0,
          y: 0,
          z: Math.sin(halfYaw),
          w: Math.cos(halfYaw),
        },
      },
    });

    goalPub.publish(goal);
    setRobotState((prev) => ({ ...prev, navStatus: 'navigating' }));
    console.log(`[ROS] Goal published: (${x.toFixed(2)}, ${y.toFixed(2)})`);
  }, []);

  // 发布速度指令（手动控制）
  const sendCmdVel = useCallback((linear: number, angular: number) => {
    if (!rosRef.current) return;

    const cmdPub = new Topic({
      ros: rosRef.current,
      name: CONFIG.TOPICS.CMD_VEL,
      messageType: 'geometry_msgs/Twist',
    });

    cmdPub.publish(
      ({
        linear: { x: linear, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: angular },
      })
    );
  }, []);

  // 停止运动
  const stop = useCallback(() => {
    sendCmdVel(0, 0);
    setRobotState((prev) => ({ ...prev, navStatus: 'canceled' }));
  }, [sendCmdVel]);

  // 清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    robotState,
    costmap,
    connect,
    disconnect,
    sendGoal,
    sendCmdVel,
    stop,
  };
}
