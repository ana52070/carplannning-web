import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { CONFIG } from './config';

// 必须在 AMap 脚本加载前设置，否则 2.0 API 的瓦片请求被服务端静默拦截
(window as any)._AMapSecurityConfig = {
  securityJsCode: CONFIG.AMAP_SECURITY_CODE,
};

createRoot(document.getElementById('root')!).render(<App />);
