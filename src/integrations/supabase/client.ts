import { postJson, queryServer } from '@/lib/serverApi';
import { savePendingBid, selectLocalTable } from '@/lib/localFirst';

type Listener = (event: string, session: Session | null) => void;

type Session = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user: any;
};

type Filter = { op: string; column: string; value: any };

const SESSION_KEY = 'hauliq_replit_session';
const listeners = new Set<Listener>();

function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: Session | null, event: string) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  listeners.forEach((listener) => listener(event, session));
}

class QueryBuilder {
  private action = 'select';
  private selected = '*';
  private options: any = {};
  private values: any = undefined;
  private filters: Filter[] = [];
  private orderBy: any = null;
  private limitBy: number | null = null;
  private singleResult = false;
  private maybeSingleResult = false;

  constructor(private table: string) {}

  select(columns = '*', options: any = {}) {
    this.action = this.action || 'select';
    this.selected = columns;
    this.options = options || {};
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.values = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.values = values;
    return this;
  }

  upsert(values: any) {
    this.action = 'upsert';
    this.values = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ op: 'gte', column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ op: 'in', column, value });
    return this;
  }

  match(values: Record<string, any>) {
    Object.entries(values).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  order(column: string, options: any = {}) {
    this.orderBy = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.limitBy = value;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleResult = true;
    return this;
  }

  async execute() {
    if (this.action === 'delete') return { data: null, error: { message: 'Delete is not enabled in this migration layer' }, count: null };
    if (this.action === 'select' && ['loads', 'bids'].includes(this.table)) {
      const rows = await selectLocalTable(this.table, this.filters, this.orderBy, this.limitBy || undefined, this.singleResult, this.maybeSingleResult);
      return { data: rows, error: null, count: Array.isArray(rows) ? rows.length : rows ? 1 : 0 };
    }
    if (this.action === 'insert' && this.table === 'bids') {
      const rows = Array.isArray(this.values) ? this.values : [this.values];
      const saved = [];
      for (const row of rows) {
        saved.push(await savePendingBid({
          load_id: row.load_id,
          driver_id: row.driver_id,
          amount: Number(row.amount),
          message: row.message || null,
          note: row.note || null,
          eta: row.eta || null,
        }));
      }
      return { data: this.singleResult ? saved[0] : saved, error: null, count: saved.length };
    }
    return queryServer({
      table: this.table,
      action: this.action,
      selected: this.selected,
      values: this.values,
      filters: this.filters,
      order: this.orderBy,
      limit: this.limitBy,
      single: this.singleResult,
      maybeSingle: this.maybeSingleResult,
      count: this.options?.count || null,
      head: this.options?.head || false,
    });
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const supabase = {
  auth: {
    onAuthStateChange(callback: Listener) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    async getSession() {
      return { data: { session: getStoredSession() }, error: null };
    },
    async getUser() {
      const session = getStoredSession();
      return { data: { user: session?.user || null }, error: null };
    },
    async signUp({ email, password, options }: any) {
      const result = await postJson('/api/auth/signup', { email, password, data: options?.data || {} });
      if (result.error) return result;
      setStoredSession(result.data.session, 'SIGNED_IN');
      return result;
    },
    async signInWithPassword({ email, password }: any) {
      const result = await postJson('/api/auth/signin', { email, password });
      if (result.error) return result;
      setStoredSession(result.data.session, 'SIGNED_IN');
      return result;
    },
    async signOut() {
      setStoredSession(null, 'SIGNED_OUT');
      return { error: null };
    },
    async updateUser(values: any) {
      return postJson('/api/auth/update', values);
    },
    async setSession(tokens: Session) {
      setStoredSession(tokens, 'SIGNED_IN');
      return { data: { session: tokens }, error: null };
    },
  },
  from(table: string) {
    return new QueryBuilder(table);
  },
  functions: {
    async invoke(name: string, options: any = {}) {
      return postJson(`/api/functions/${name}`, options.body || {});
    },
  },
  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File) {
          const dataUrl = await fileToDataUrl(file);
          const result = await postJson('/api/storage/upload', { path, dataUrl });
          return { data: result.data, error: result.error };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `/uploads/verification-documents/${path}` } };
        },
      };
    },
  },
  channel(_name: string) {
    return {
      on() { return this; },
      subscribe() { return this; },
    };
  },
  removeChannel(_channel: any) {},
};
