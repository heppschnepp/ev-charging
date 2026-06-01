/// <reference types="vite-plugin-pwa/react" />

declare module "virtual:pwa-register" {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }): () => void;
}

declare module "leaflet/dist/images/*.png" {
  const value: string;
  export default value;
}