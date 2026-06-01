// ============================================
// 校园智巡 - Campus Nav Console Configuration
// ============================================

export const CONFIG = {
  // 高德地图 API Key
  AMAP_KEY: '781e75d422a6fdb39f211b332466a786',
  // JS API 2.0 安全密钥 — 在高德开放平台「key 管理」页面找「JS API 安全密钥」
  // 缺少此项时地图对象能创建但瓦片全部被服务端拦截（黑屏，无 JS 报错）
  AMAP_SECURITY_CODE: '0b8c58e9faf4cd19ee478c85192fc7af',

  // rosbridge WebSocket 地址
  ROSBRIDGE_URL: 'ws://192.168.1.100:9090',

  // 地图默认中心点（天津理工大学中环信息学院）
  MAP_CENTER: {
    lng: 117.3246,
    lat: 39.1078,
  },

  // 地图默认缩放级别
  MAP_ZOOM: 18,

  // ROS 话题配置
  TOPICS: {
    ODOM: '/odometry/filtered',
    GOAL_POSE: '/goal_pose',
    CMD_VEL: '/cmd_vel',
    GPS_FIX: '/gps/fix',
    LIDAR: '/livox/lidar',
    NAV_STATUS: '/navigate_to_pose/_action/status',
  },

  // 坐标系
  FRAMES: {
    MAP: 'map',
    BASE_LINK: 'base_link',
  },
} as const;
