import { useEffect, useState, useCallback } from 'react';

const KEY = 'hauliq:bookmarked-loads';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('hauliq:bookmarks-changed'));
  } catch {
    /* ignore */
  }
}

export function useBookmarks() {
  const [ids, setIds] = useState<string[]>(read);

  useEffect(() => {
    const sync = () => setIds(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('hauliq:bookmarks-changed', sync as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hauliq:bookmarks-changed', sync as EventListener);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    write(next);
    setIds(next);
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, has };
}
