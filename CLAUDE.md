# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**校园智巡 (Campus Auto-Navigation) · Nav Console** — A web control console for a campus autonomous navigation robot (RTK-based). Built with React 19, TypeScript, Vite, Tailwind CSS v4, roslib (ROS WebSocket), and Amap JS API 2.0.

## Commands

```bash
npm run dev       # Start Vite dev server on 0.0.0.0:5173 with HMR
npm run build     # Type-check (tsc -b) then bundle for production → dist/
npm run lint      # Run ESLint across all files
npm run preview   # Serve the production dist/ locally
```

There is no test framework configured in this project.

## Architecture

### Data Flow

```
useROS (hook) ─── WebSocket/rosbridge ─── ROS robot
     │
     └──► App.tsx  ──► StatusBar.tsx   (connection/RTK/GPS/time)
                   ──► MapView.tsx     (Amap satellite map + markers)
                   ──► ControlPanel.tsx (connection UI, robot state, goals, manual drive)
```

`useROS` is the central state manager — it owns the ROSLIB connection, all subscriber/publisher instances, and the parsed `RobotState`. It exposes callbacks (`connect`, `disconnect`, `publishGoal`, `publishCmdVel`, etc.) that components call.

### Key Modules

- **`src/hooks/useROS.ts`** — All ROS logic: manages roslib `Ros`/`Topic` objects, subscribes to `/odometry/filtered` and `/gps/fix`, publishes to `/goal_pose` and `/cmd_vel`, converts quaternion → yaw, and maps GPS status codes to RTK fix types (SPS / DGPS / RTK Float / RTK Fix).

- **`src/components/MapView.tsx`** — Lazy-loads the Amap JS SDK (requires `AMAP_KEY`), renders the satellite map, places a rotating SVG robot marker and goal markers. Contains a placeholder for WGS84 → GCJ02 coordinate conversion (currently identity — a known TODO).

- **`src/components/ControlPanel.tsx`** — Right sidebar with connection URL input, robot state readout, goal list, and a manual control pad that fires `publishCmdVel` on mouse/touch events.

- **`src/config/index.ts`** — Single source for `AMAP_KEY`, `ROSBRIDGE_URL` (default `ws://192.168.1.100:9090`), `MAP_CENTER` (Tianjin University), and `MAP_ZOOM`.

- **`src/types/ros.ts`** — TypeScript types for ROS messages (`OdometryMsg`, `NavSatFixMsg`, `GoalPoseMsg`, `TwistMsg`) and `RobotState`.

- **`src/types/roslib.d.ts`** — Manual type declarations for the `roslib` npm package (the package ships no bundled types).

### Styling

Tailwind CSS v4 (Vite plugin). Dark terminal theme defined as CSS custom properties in `src/index.css`: background `#0a0e14`, accent colors blue/green/red/cyan. Fonts: JetBrains Mono (monospace readouts) + Outfit (UI text), loaded from Google Fonts in `index.html`.

### Deployment

`npm run build` → copy `dist/` to the Xavier NX companion computer and serve via any HTTP server. The robot must run `rosbridge_websocket` on port 9090 for the console to connect.

## Known TODOs (from README)

- Accurate WGS84 → GCJ02 coordinate conversion in `MapView.tsx`
- Costmap/obstacle layer visualization
- Path trajectory display on map
- Multi-point waypoint planning UI
- Mobile responsive layout
