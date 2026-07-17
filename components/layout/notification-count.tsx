'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type NotificationCountValue = {
  count: number;
  setCount: (count: number) => void;
};

const NotificationCountContext = createContext<NotificationCountValue>({ count: 0, setCount: () => undefined });

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function NotificationCountProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const loaded = useRef(false);
  const value = useMemo(() => ({ count, setCount }), [count]);

  useEffect(() => {
    if (loaded.current) return;
    if (pathname === '/notifications') {
      loaded.current = true;
      return;
    }
    loaded.current = true;

    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/notifications/unread', {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) return;
        const result = await response.json() as { unread?: number };
        setCount(Math.max(0, Number(result.unread) || 0));
      } catch {
        // The badge is optional; navigation must never wait for it.
      }
    };

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(() => void load(), { timeout: 1500 });
      return () => {
        controller.abort();
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(() => void load(), 300);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [pathname]);

  return <NotificationCountContext.Provider value={value}>{children}</NotificationCountContext.Provider>;
}

export function useNotificationCount() {
  return useContext(NotificationCountContext).count;
}

export function NotificationCountSync({ count }: { count: number }) {
  const { setCount } = useContext(NotificationCountContext);

  useEffect(() => {
    setCount(Math.max(0, count));
  }, [count, setCount]);

  return null;
}
