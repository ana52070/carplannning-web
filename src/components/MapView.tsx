import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { MapPin, Crosshair, ZoomIn, ZoomOut, Layers, SlidersHorizontal } from 'lucide-react';
import { CONFIG } from '../config';
import type { RobotState, GoalPoint, OccupancyGrid } from '../types/ros';

interface MapViewProps {
  robotState: RobotState;
  onGoalSet: (lat: number, lng: number) => void;
  goalPoints: GoalPoint[];
  costmap: OccupancyGrid | null;
  onTogglePanel: () => void;
}

// WGS84 → GCJ02（火星坐标系）转换
// 适用于中国大陆范围内，偏差修正约 100-600 m
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function _outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}
function _transformLat(x: number, y: number): number {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2 / 3;
  r += (160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y / 30) * Math.PI)) * 2 / 3;
  return r;
}
function _transformLng(x: number, y: number): number {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2 / 3;
  r += (150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2 / 3;
  return r;
}
function wgs84ToGcj02(lat: number, lng: number): [number, number] {
  if (_outOfChina(lng, lat)) return [lat, lng];
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const dLat = (_transformLat(lng - 105, lat - 35) * 180) /
    (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  const dLng = (_transformLng(lng - 105, lat - 35) * 180) /
    ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lat + dLat, lng + dLng];
}

export function MapView({ robotState, onGoalSet, goalPoints, costmap, onTogglePanel }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const robotMarkerRef = useRef<any>(null);
  const goalMarkersRef = useRef<any[]>([]);
  const trajectoryRef = useRef<any>(null);
  const trajectoryPointsRef = useRef<any[]>([]);
  const costmapOverlayRef = useRef<any>(null);    // AMap.CanvasLayer 实例
  const onGoalSetRef = useRef(onGoalSet);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'satellite' | 'standard'>('satellite');
  const hasKey = CONFIG.AMAP_KEY.length > 0;

  // 保持回调 ref 最新，不触发地图重建
  useLayoutEffect(() => {
    onGoalSetRef.current = onGoalSet;
  });

  // 初始化地图
  useEffect(() => {
    if (!hasKey || !mapContainerRef.current) return;

    let cancelled = false;

    import('@amap/amap-jsapi-loader').then(({ default: AMapLoader }) => {
      AMapLoader.load({
        key: CONFIG.AMAP_KEY,
        version: '2.0',
        plugins: ['AMap.Scale'],
      }).then((AMap: any) => {
        if (cancelled || !mapContainerRef.current) return;

        const { clientWidth: w, clientHeight: h } = mapContainerRef.current;
        console.log(`[MapView] container size: ${w}×${h}`);
        if (w === 0 || h === 0) {
          console.error('[MapView] 容器尺寸为 0，AMap 无法渲染，请检查布局');
        }

        const map = new AMap.Map(mapContainerRef.current, {
          viewMode: '2D',
          zoom: CONFIG.MAP_ZOOM,
          center: [CONFIG.MAP_CENTER.lng, CONFIG.MAP_CENTER.lat],
          layers: [new AMap.TileLayer.Satellite(), new AMap.TileLayer.RoadNet()],
        });

        map.on('complete', () => {
          console.log('[MapView] map ready');
        });

        map.addControl(new AMap.Scale());

        map.on('click', (e: any) => {
          const { lng, lat } = e.lnglat;
          onGoalSetRef.current(lat, lng);
        });

        mapInstanceRef.current = map;
        setMapReady(true);
      }).catch((err: unknown) => {
        console.error('[MapView] AMap.load failed:', err);
      });
    }).catch((err: unknown) => {
      console.error('[MapView] amap-jsapi-loader import failed:', err);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
        robotMarkerRef.current = null;
        trajectoryRef.current = null;
        trajectoryPointsRef.current = [];
        costmapOverlayRef.current = null;
        setMapReady(false);
      }
    };
  }, [hasKey]);

  // 更新小车位置标记
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    if (robotState.latitude === 0 && robotState.longitude === 0) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    const [gcjLat, gcjLng] = wgs84ToGcj02(robotState.latitude, robotState.longitude);
    const position = new AMap.LngLat(gcjLng, gcjLat);

    if (!robotMarkerRef.current) {
      // 创建小车标记 — 使用自定义 SVG
      const markerContent = document.createElement('div');
      markerContent.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 32 32" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
          <circle cx="16" cy="16" r="12" fill="#3d8bfd" stroke="#fff" stroke-width="2" opacity="0.9"/>
          <polygon points="16,6 22,22 16,18 10,22" fill="white" transform="rotate(${robotState.yaw}, 16, 16)"/>
        </svg>
      `;
      robotMarkerRef.current = new AMap.Marker({
        position,
        content: markerContent,
        offset: new AMap.Pixel(-16, -16),
        zIndex: 100,
      });
      mapInstanceRef.current.add(robotMarkerRef.current);
    } else {
      robotMarkerRef.current.setPosition(position);
      // 更新方向
      const svg = robotMarkerRef.current.getContent().querySelector('polygon');
      if (svg) {
        svg.setAttribute('transform', `rotate(${robotState.yaw}, 16, 16)`);
      }
    }

    // 追加轨迹点
    trajectoryPointsRef.current.push(new AMap.LngLat(gcjLng, gcjLat));
    if (!trajectoryRef.current) {
      trajectoryRef.current = new AMap.Polyline({
        path: trajectoryPointsRef.current,
        strokeColor: '#3d8bfd',
        strokeWeight: 3,
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
        zIndex: 80,
      });
      mapInstanceRef.current.add(trajectoryRef.current);
    } else {
      trajectoryRef.current.setPath(trajectoryPointsRef.current);
    }
  }, [mapReady, robotState.latitude, robotState.longitude, robotState.yaw]);

  // Costmap 渲染（nav_msgs/OccupancyGrid → AMap CanvasLayer）
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !costmap) return;
    const AMap = (window as any).AMap;
    if (!AMap?.CanvasLayer) return; // CanvasLayer 需要 AMap 2.0

    const { info, data } = costmap;
    const { resolution, width, height, origin } = info;

    // origin 是 map frame 坐标（WGS84 相对量），需要叠加地图原点 GPS 坐标
    // 这里暂用 CONFIG.MAP_CENTER 作为 map frame 原点估算（接 TF 后替换）
    const originLat = CONFIG.MAP_CENTER.lat + (origin.position.y / 111320);
    const originLng = CONFIG.MAP_CENTER.lng + (origin.position.x / (111320 * Math.cos(CONFIG.MAP_CENTER.lat * Math.PI / 180)));

    // 经纬度跨度
    const latSpan = (resolution * height) / 111320;
    const lngSpan = (resolution * width) / (111320 * Math.cos(originLat * Math.PI / 180));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      const row = Math.floor(i / width);
      // OccupancyGrid 行序是从下到上，canvas 是从上到下
      const col = i % width;
      const pixelRow = height - 1 - row;
      const idx = (pixelRow * width + col) * 4;

      if (v === -1) {
        // 未知区域：半透明灰
        imgData.data[idx] = 128; imgData.data[idx+1] = 128; imgData.data[idx+2] = 128;
        imgData.data[idx+3] = 60;
      } else if (v >= 65) {
        // 占用：红色半透明
        imgData.data[idx] = 239; imgData.data[idx+1] = 68; imgData.data[idx+2] = 68;
        imgData.data[idx+3] = Math.round(v * 1.8);
      }
      // 自由区域（v < 65）保持透明，不遮挡底图
    }
    ctx.putImageData(imgData, 0, 0);

    const bounds = new AMap.Bounds(
      new AMap.LngLat(originLng, originLat),
      new AMap.LngLat(originLng + lngSpan, originLat + latSpan),
    );

    if (costmapOverlayRef.current) {
      mapInstanceRef.current.remove(costmapOverlayRef.current);
    }
    costmapOverlayRef.current = new AMap.CanvasLayer({
      canvas,
      bounds,
      opacity: 0.7,
      zIndex: 85,
    });
    mapInstanceRef.current.add(costmapOverlayRef.current);
  }, [mapReady, costmap]);

  // 更新目标点标记
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const AMap = (window as any).AMap;
    if (!AMap) return;

    // 清除旧标记
    goalMarkersRef.current.forEach((m) => mapInstanceRef.current.remove(m));
    goalMarkersRef.current = [];

    goalPoints.forEach((goal, index) => {
      // goal.latitude/longitude 来自 AMap click 事件，已经是 GCJ02，不需要再转换
      const marker = new AMap.Marker({
        position: new AMap.LngLat(goal.longitude, goal.latitude),
        content: `
          <div style="
            width: 28px; height: 28px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          ">
            <span style="transform: rotate(45deg); color: white; font-size: 11px; font-weight: 700;">
              ${index + 1}
            </span>
          </div>
        `,
        offset: new AMap.Pixel(-14, -28),
        zIndex: 90,
      });
      mapInstanceRef.current.add(marker);
      goalMarkersRef.current.push(marker);
    });
  }, [mapReady, goalPoints]);

  // 切换地图图层
  const toggleMapType = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const AMap = (window as any).AMap;
    if (!AMap) return;

    const newType = mapType === 'satellite' ? 'standard' : 'satellite';
    setMapType(newType);

    mapInstanceRef.current.setLayers(
      newType === 'satellite'
        ? [new AMap.TileLayer.Satellite(), new AMap.TileLayer.RoadNet()]
        : [new AMap.TileLayer()]
    );
  }, [mapType]);

  // 定位到小车
  const centerOnRobot = useCallback(() => {
    if (!mapInstanceRef.current || robotState.latitude === 0) return;
    const AMap = (window as any).AMap;
    const [gcjLat, gcjLng] = wgs84ToGcj02(robotState.latitude, robotState.longitude);
    mapInstanceRef.current.setCenter(new AMap.LngLat(gcjLng, gcjLat));
  }, [robotState.latitude, robotState.longitude]);

  // 缩放
  const zoomIn = () => mapInstanceRef.current?.zoomIn();
  const zoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <div className="relative flex-1 h-full">
      {/* 地图容器 wrapper 固定定位，内层交给 AMap 管理
          AMap 初始化时会把容器的 position 改成 relative，
          若直接用 absolute inset-0 会被覆盖导致高度塌陷 */}
      <div className="absolute inset-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* 无 API Key 时的占位界面 */}
      {!hasKey && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: 'var(--bg-secondary)' }}
        >
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(var(--border-primary) 1px, transparent 1px),
                linear-gradient(90deg, var(--border-primary) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />

          {/* Center crosshair */}
          <div className="relative">
            <div
              className="w-48 h-48 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle, var(--bg-tertiary) 0%, transparent 70%)',
              }}
            >
              <Crosshair
                size={48}
                strokeWidth={1}
                style={{ color: 'var(--border-primary)' }}
              />
            </div>
          </div>

          <div className="text-center z-10">
            <p
              className="text-sm mb-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-muted)',
              }}
            >
              AWAITING MAP INITIALIZATION
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              在{' '}
              <code
                className="px-1.5 py-0.5 rounded text-xs"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--accent-blue)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                src/config/index.ts
              </code>
              {' '}中填入高德地图 API Key
            </p>
          </div>

          {/* Simulated coordinate display */}
          <div
            className="absolute bottom-4 left-4 px-3 py-2 rounded"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              CTR {CONFIG.MAP_CENTER.lat.toFixed(4)}°N, {CONFIG.MAP_CENTER.lng.toFixed(4)}°E
            </span>
          </div>
        </div>
      )}

      {/* 地图控制按钮 */}
      <div
        className="absolute top-4 right-4 flex flex-col gap-1.5 z-10"
      >
        {[
          { icon: ZoomIn, onClick: zoomIn, label: '放大' },
          { icon: ZoomOut, onClick: zoomOut, label: '缩小' },
          { icon: Crosshair, onClick: centerOnRobot, label: '定位小车' },
          { icon: Layers, onClick: toggleMapType, label: '切换图层' },
          // 仅移动端显示：打开控制面板
          { icon: SlidersHorizontal, onClick: onTogglePanel, label: '控制面板', mobileOnly: true },
        ].map(({ icon: Icon, onClick, label, mobileOnly }) => (
          <button
            key={label}
            onClick={onClick}
            title={label}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer${mobileOnly ? ' md:hidden' : ''}`}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      {/* 点击提示 */}
      {hasKey && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            opacity: 0.85,
          }}
        >
          <MapPin size={12} style={{ color: 'var(--accent-blue)' }} />
          <span
            className="text-xs"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-secondary)',
            }}
          >
            点击地图设置导航目标
          </span>
        </div>
      )}
    </div>
  );
}
