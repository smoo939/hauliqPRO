import { useEffect, useSyncExternalStore } from 'react';
import { queryServer } from '@/lib/serverApi';

export type LocalBidStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'accepted' | 'rejected';

export type LocalBid = {
  id: string;
  load_id: string;
  driver_id: string;
  amount: number;
  message?: string | null;
  note?: string | null;
  status: LocalBidStatus;
  created_at: string;
  updated_at: string;
  server_bid_id?: string | null;
  last_error?: string | null;
};

type Listener = () => void;
type LocalSnapshot = {
  online: boolean;
  syncActive: boolean;
  loads: any[];
  pendingBids: LocalBid[];
};

const DB_NAME = 'hauliq_local_first';
const DB_VERSION = 1;
const LOADS_STORE = 'available_loads';
const BIDS_STORE = 'pending_bids';
const META_STORE = 'sync_meta';
const listeners = new Set<Listener>();

let dbPromise: Promise<IDBDatabase> | null = null;
let syncTimer: number | null = null;
let currentUserId: string | null = null;
let capacitorNetworkReady = false;

const snapshot: LocalSnapshot = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncActive: false,
  loads: [],
  pendingBids: [],
};

function emit() {
  listeners.forEach((listener) => listener());
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOADS_STORE)) db.createObjectStore(LOADS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BIDS_STORE)) db.createObjectStore(BIDS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function runStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    let result: T | undefined;
    if (request) {
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getAll<T>(storeName: string) {
  return (await runStore<T[]>(storeName, 'readonly', (store) => store.getAll())) || [];
}

async function put(storeName: string, value: any) {
  await runStore(storeName, 'readwrite', (store) => store.put(value));
}

async function putMany(storeName: string, values: any[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function sortByCreatedDesc(rows: any[]) {
  return [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

function applyFilters(rows: any[], filters: any[] = []) {
  return rows.filter((row) => filters.every((filter) => {
    if (filter.op === 'eq') return row[filter.column] === filter.value;
    if (filter.op === 'neq') return row[filter.column] !== filter.value;
    if (filter.op === 'gte') return row[filter.column] >= filter.value;
    if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
    return true;
  }));
}

async function loadSnapshot() {
  const [loads, pendingBids] = await Promise.all([getAll<any>(LOADS_STORE), getAll<LocalBid>(BIDS_STORE)]);
  snapshot.loads = sortByCreatedDesc(loads);
  snapshot.pendingBids = sortByCreatedDesc(pendingBids) as LocalBid[];
  emit();
}

export function subscribeLocalFirst(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocalFirstSnapshot() {
  return snapshot;
}

export function useLocalFirstSnapshot() {
  return useSyncExternalStore(subscribeLocalFirst, getLocalFirstSnapshot, getLocalFirstSnapshot);
}

export function useOfflineStatus() {
  return useLocalFirstSnapshot().online === false;
}

export function useLocalAvailableLoads() {
  return useLocalFirstSnapshot().loads.filter((load) => load.status === 'posted');
}

export function useLocalBidForLoad(loadId: string, driverId?: string) {
  return useLocalFirstSnapshot().pendingBids.find((bid) => bid.load_id === loadId && (!driverId || bid.driver_id === driverId));
}

export async function selectLocalTable(table: string, filters: any[] = [], order?: any, limit?: number, single?: boolean, maybeSingle?: boolean) {
  await loadSnapshot();
  if (table === 'loads') {
    let rows = applyFilters(snapshot.loads, filters);
    if (order?.column) rows = [...rows].sort((a, b) => String(a[order.column] || '').localeCompare(String(b[order.column] || '')) * (order.ascending === false ? -1 : 1));
    if (limit) rows = rows.slice(0, limit);
    return single || maybeSingle ? rows[0] || null : rows;
  }
  if (table === 'bids') {
    let rows = applyFilters(snapshot.pendingBids, filters).map((bid) => ({
      ...bid,
      loads: snapshot.loads.find((load) => load.id === bid.load_id) || null,
    }));
    if (order?.column) rows = [...rows].sort((a, b) => String(a[order.column] || '').localeCompare(String(b[order.column] || '')) * (order.ascending === false ? -1 : 1));
    if (limit) rows = rows.slice(0, limit);
    return single || maybeSingle ? rows[0] || null : rows;
  }
  return null;
}

export async function refreshAvailableLoadsFromServer() {
  if (!snapshot.online) return;
  const requests = [queryServer({
    table: 'loads',
    action: 'select',
    filters: [{ op: 'eq', column: 'status', value: 'posted' }],
    order: { column: 'created_at', ascending: false },
    limit: 100,
  })];
  if (currentUserId) {
    requests.push(queryServer({
      table: 'loads',
      action: 'select',
      filters: [{ op: 'eq', column: 'driver_id', value: currentUserId }],
      order: { column: 'created_at', ascending: false },
      limit: 100,
    }));
    requests.push(queryServer({
      table: 'loads',
      action: 'select',
      filters: [{ op: 'eq', column: 'shipper_id', value: currentUserId }],
      order: { column: 'created_at', ascending: false },
      limit: 100,
    }));
  }
  const results = await Promise.all(requests);
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message || 'Could not refresh loads');
  const merged = Array.from(new Map(results.flatMap((result) => result.data || []).map((load: any) => [load.id, load])).values());
  await putMany(LOADS_STORE, merged);
  await refreshBidsFromServer(merged);
  await put(META_STORE, { key: 'available_loads_last_sync', value: new Date().toISOString() });
  await loadSnapshot();
}

async function refreshBidsFromServer(localLoads: any[]) {
  if (!currentUserId) return;
  const bidRequests = [
    queryServer({
      table: 'bids',
      action: 'select',
      filters: [{ op: 'eq', column: 'driver_id', value: currentUserId }],
      order: { column: 'created_at', ascending: false },
      limit: 100,
    }),
  ];
  const shipperLoadIds = localLoads.filter((load) => load.shipper_id === currentUserId).map((load) => load.id);
  if (shipperLoadIds.length > 0) {
    bidRequests.push(queryServer({
      table: 'bids',
      action: 'select',
      filters: [{ op: 'in', column: 'load_id', value: shipperLoadIds }],
      order: { column: 'created_at', ascending: false },
      limit: 200,
    }));
  }
  const results = await Promise.all(bidRequests);
  if (results.some((result) => result.error)) return;
  const existing = await getAll<LocalBid>(BIDS_STORE);
  const knownServerIds = new Set(existing.map((bid) => bid.server_bid_id).filter(Boolean));
  const localSyncedKeys = new Set(existing.filter((bid) => bid.status === 'synced').map((bid) => `${bid.load_id}:${bid.driver_id}:${bid.amount}`));
  const remoteBids = Array.from(new Map(results.flatMap((result) => result.data || []).map((bid: any) => [bid.id, bid])).values());
  const bidsToStore = remoteBids
    .filter((bid: any) => !knownServerIds.has(bid.id) && !localSyncedKeys.has(`${bid.load_id}:${bid.driver_id}:${Number(bid.amount)}`))
    .map((bid: any) => ({
      id: bid.id,
      load_id: bid.load_id,
      driver_id: bid.driver_id,
      amount: Number(bid.amount),
      message: bid.message || null,
      note: bid.note || bid.message || null,
      status: bid.status || 'pending',
      created_at: bid.created_at || new Date().toISOString(),
      updated_at: bid.updated_at || new Date().toISOString(),
      server_bid_id: bid.id,
      last_error: null,
    }));
  if (bidsToStore.length > 0) await putMany(BIDS_STORE, bidsToStore);
}

export async function savePendingBid(input: { load_id: string; driver_id: string; amount: number; message?: string | null; note?: string | null }) {
  const now = new Date().toISOString();
  const bid: LocalBid = {
    id: crypto.randomUUID(),
    load_id: input.load_id,
    driver_id: input.driver_id,
    amount: input.amount,
    message: input.message || null,
    note: input.note || input.message || null,
    status: 'pending',
    created_at: now,
    updated_at: now,
    server_bid_id: null,
    last_error: null,
  };
  await put(BIDS_STORE, bid);
  await loadSnapshot();
  void syncPendingBids();
  return bid;
}

async function updateLocalBid(id: string, patch: Partial<LocalBid>) {
  const bids = await getAll<LocalBid>(BIDS_STORE);
  const bid = bids.find((item) => item.id === id);
  if (!bid) return;
  await put(BIDS_STORE, { ...bid, ...patch, updated_at: new Date().toISOString() });
  await loadSnapshot();
}

export async function syncPendingBids() {
  if (!snapshot.online || snapshot.syncActive) return;
  snapshot.syncActive = true;
  emit();
  try {
    const bids = await getAll<LocalBid>(BIDS_STORE);
    for (const bid of bids.filter((item) => !item.server_bid_id && (item.status === 'pending' || item.status === 'failed'))) {
      await updateLocalBid(bid.id, { status: 'syncing', last_error: null });
      const result = await queryServer({
        table: 'bids',
        action: 'insert',
        values: {
          load_id: bid.load_id,
          driver_id: bid.driver_id,
          amount: bid.amount,
          message: bid.message || bid.note || null,
          note: bid.note || bid.message || null,
          status: 'pending',
        },
        single: true,
      });
      if (result.error) {
        await updateLocalBid(bid.id, { status: 'failed', last_error: result.error.message || 'Sync failed' });
      } else {
        await updateLocalBid(bid.id, { status: 'synced', server_bid_id: result.data?.id || null, last_error: null });
      }
    }
  } finally {
    snapshot.syncActive = false;
    emit();
  }
}

async function setupCapacitorNetworkWatcher() {
  if (capacitorNetworkReady) return;
  capacitorNetworkReady = true;
  try {
    const network = await import('@capacitor/network');
    const status = await network.Network.getStatus();
    snapshot.online = status.connected;
    emit();
    await network.Network.addListener('networkStatusChange', (status) => {
      snapshot.online = status.connected;
      emit();
      if (status.connected) {
        void refreshAvailableLoadsFromServer();
        void syncPendingBids();
      }
    });
  } catch {
    snapshot.online = navigator.onLine;
  }
}

async function setupCapacitorSqlite() {
  try {
    await import('@capacitor-community/sqlite');
  } catch {
    return;
  }
}

export function startLocalFirstSync(userId?: string | null) {
  currentUserId = userId || currentUserId;
  void setupCapacitorNetworkWatcher();
  void setupCapacitorSqlite();
  void loadSnapshot();
  if (typeof window !== 'undefined') {
    const online = () => {
      snapshot.online = true;
      emit();
      void refreshAvailableLoadsFromServer();
      void syncPendingBids();
    };
    const offline = () => {
      snapshot.online = false;
      emit();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
  }
  if (syncTimer == null) {
    syncTimer = window.setInterval(() => {
      if (snapshot.online) {
        void refreshAvailableLoadsFromServer();
        void syncPendingBids();
      }
    }, 30000);
  }
  if (snapshot.online) {
    void refreshAvailableLoadsFromServer();
    void syncPendingBids();
  }
}

export function useStartLocalFirstSync(userId?: string | null) {
  useEffect(() => {
    startLocalFirstSync(userId);
  }, [userId]);
}
