import { createClient } from '@supabase/supabase-js';
import { postJson, queryServer } from '@/lib/serverApi';
import { savePendingBid, selectLocalTable } from '@/lib/localFirst';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Create official Supabase client
const _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

type Filter = { op: string; column: string; value: any };

class LocalFirstQueryBuilder {
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
    // Local-first for reads on specific tables
    if (this.action === 'select' && ['loads', 'bids'].includes(this.table)) {
      const rows = await selectLocalTable(
        this.table,
        this.filters,
        this.orderBy,
        this.limitBy || undefined,
        this.singleResult,
        this.maybeSingleResult
      );
      return {
        data: rows,
        error: null,
        count: Array.isArray(rows) ? rows.length : rows ? 1 : 0,
      };
    }

    // Local-first for pending bids insert
    if (this.action === 'insert' && this.table === 'bids') {
      const rows = Array.isArray(this.values) ? this.values : [this.values];
      const saved = [];
      for (const row of rows) {
        saved.push(
          await savePendingBid({
            load_id: row.load_id,
            driver_id: row.driver_id,
            amount: Number(row.amount),
            message: row.message || null,
            note: row.note || null,
            eta: row.eta || null,
          })
        );
      }
      return {
        data: this.singleResult ? saved[0] : saved,
        error: null,
        count: saved.length,
      };
    }

    // Prevent deletes through this layer
    if (this.action === 'delete') {
      return {
        data: null,
        error: { message: 'Delete is not enabled in this migration layer' },
        count: null,
      };
    }

    // Fall back to server API for all other operations
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

/**
 * Supabase wrapper with local-first capabilities
 * 
 * Features:
 * - Uses official @supabase/supabase-js SDK
 * - Local-first reads for 'loads' and 'bids' tables via selectLocalTable
 * - Pending bids insert support via savePendingBid
 * - Server API fallback for other operations
 * - Direct access to official Supabase client via supabase._raw
 */
export const supabase = {
  auth: _supabaseClient.auth,

  from(table: string) {
    return new LocalFirstQueryBuilder(table);
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

  channel: _supabaseClient.channel.bind(_supabaseClient),
  removeChannel: _supabaseClient.removeChannel.bind(_supabaseClient),

  /**
   * Direct access to official Supabase client for features not wrapped
   */
  _raw: _supabaseClient,
};
