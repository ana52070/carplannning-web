# 校园智巡 · Nav Console

基于 RTK 的校园自主导航机器人 Web 上位机。

## 技术栈

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **roslib** (rosbridge WebSocket 通信)
- **高德地图 JS API 2.0** (卫星地图底图)
- **Lucide React** (图标库)

## 快速开始

```bash
# 安装依赖
npm install

# 填入高德地图 API Key
# 编辑 src/config/index.ts，将 AMAP_KEY 改为你的 Key

# 启动开发服务器
npm run dev
```

浏览器访问 `http://localhost:5173`

## 配置说明

所有可配置项在 `src/config/index.ts`：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `AMAP_KEY` | 高德地图 JS API Key | 空（需填入） |
| `ROSBRIDGE_URL` | rosbridge WebSocket 地址 | `ws://192.168.1.100:9090` |
| `MAP_CENTER` | 地图默认中心点（学校坐标） | 天津理工中环学院 |
| `MAP_ZOOM` | 地图默认缩放级别 | 18 |

## 项目结构

```
src/
├── components/
│   ├── StatusBar.tsx         # 顶部状态栏（连接/RTK/坐标/时间）
│   ├── MapView.tsx           # 高德地图主视图
│   └── ControlPanel.tsx      # 右侧控制面板
├── hooks/
│   └── useROS.ts             # rosbridge 连接 & ROS 通信 hook
├── types/
│   ├── ros.ts                # ROS 消息类型定义
│   └── roslib.d.ts           # roslib 类型声明
├── config/
│   └── index.ts              # 配置常量
├── App.tsx                   # 主布局
├── main.tsx                  # 入口
└── index.css                 # 全局样式 + Tailwind
```

## 功能清单

### 已实现
- [x] 项目脚手架 (React + TS + Vite + Tailwind)
- [x] 深色主题控制台 UI 布局
- [x] 高德地图集成（卫星/标准图层切换）
- [x] rosbridge WebSocket 连接管理
- [x] ROS 话题订阅（odometry、GPS）
- [x] 小车位置实时标记（带方向指示）
- [x] 点击地图设置目标点
- [x] 目标点发布到 /goal_pose
- [x] 手动控制（前进/后退/左转/右转）
- [x] 机器人状态面板（速度/航向/RTK状态）

### 待完成
- [ ] WGS84 → GCJ02 精确坐标转换
- [ ] costmap / 障碍物可视化叠加
- [ ] 路径轨迹显示
- [ ] 多目标点航线规划
- [ ] 手机端响应式适配优化

## 部署到 Xavier NX

```bash
npm run build
scp -r dist/ nvidia@192.168.x.x:~/nav-console/
# Xavier NX 上
cd ~/nav-console && python3 -m http.server 8080
```

## 注意事项

1. **坐标转换**：UM982 输出 WGS84，高德使用 GCJ02，偏差约 100-600m。需接入精确转换。
2. **rosbridge**：Xavier NX 需安装并启动 `rosbridge_suite`。
3. **网络**：浏览器与 Xavier NX 需在同一局域网。
