import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useMap } from 'react-leaflet';
import { cn } from '@/lib/utils';

type FullScreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullScreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

const fsDoc = () => document as FullScreenDocument;
const isFullscreen = () => Boolean(document.fullscreenElement ?? fsDoc().webkitFullscreenElement);

const exitFullscreen = async () => {
  if (document.exitFullscreen) {
    await document.exitFullscreen().catch(() => {});
  } else if (fsDoc().webkitExitFullscreen) {
    await Promise.resolve(fsDoc().webkitExitFullscreen?.()).catch(() => {});
  }
};

const requestFullscreen = async (el: HTMLElement) => {
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if ((el as FullScreenElement).webkitRequestFullscreen) {
    await Promise.resolve((el as FullScreenElement).webkitRequestFullscreen?.()).catch(() => {});
  }
};

interface FullscreenMapProps {
  className?: string;
  children: ReactNode;
}

export function FullscreenMap({ className, children }: FullscreenMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(isFullscreen);

  useEffect(() => {
    const onChange = () => setIsFull(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen()) {
        void exitFullscreen();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => {
    if (isFullscreen()) {
      void exitFullscreen();
    } else if (containerRef.current) {
      void requestFullscreen(containerRef.current);
    }
  };

  return (
    <div ref={containerRef} className={cn('fullscreen-map relative', className)}>
      {children}
      <button
        type="button"
        onClick={toggle}
        title={isFull ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        aria-label={isFull ? 'Exit fullscreen' : 'Enter fullscreen'}
        className="absolute top-2 right-2 z-[1000] flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white/90 text-gray-700 shadow-md transition-colors hover:bg-white dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-300 dark:hover:bg-gray-900"
      >
        {isFull ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
    </div>
  );
}

/**
 * Rendered inside a `MapContainer` so the Leaflet map gets resized when its
 * wrapper enters/exits fullscreen (otherwise tiles render tiny/stretched).
 */
export function MapResizeOnFullscreen() {
  const map = useMap();
  const [full, setFull] = useState(isFullscreen);

  useEffect(() => {
    const onChange = () => setFull(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(frame);
  }, [full, map]);

  return null;
}
