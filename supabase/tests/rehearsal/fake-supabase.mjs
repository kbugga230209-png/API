// Minimal in-memory stand-in for the bits of supabase-js the Edge Functions use.
//
// Scope is deliberate: only the query shapes the payment functions actually
// build (insert/select/update with eq/neq/in/order/limit/maybeSingle and rpc).
// Anything outside that throws instead of silently returning empty data, so a
// refactor of a function surfaces here as a failure rather than a false pass.

export class FakeDb {
  constructor() {
    this.tables = new Map();
    this.rpcCalls = [];
    this.uniqueKeys = { payment_events: ['event_id'] };
    this.rpcHandlers = {};
    this.rateLimitDenied = new Set();
    this.nextId = 1;
  }

  rows(table) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table);
  }

  seed(table, rows) {
    this.rows(table).push(...rows.map((row) => ({ ...row })));
    return this;
  }

  all(table) {
    return this.rows(table);
  }

  last(table) {
    const rows = this.rows(table);
    return rows[rows.length - 1];
  }

  onRpc(name, handler) {
    this.rpcHandlers[name] = handler;
    return this;
  }
}

function matches(row, filters) {
  return filters.every(({ column, value, negate }) => {
    const actual = row[column];
    const equal = Array.isArray(value) ? value.includes(actual) : actual === value;
    return negate ? !equal : equal;
  });
}

class Query {
  constructor(db, table, op, payload) {
    this.db = db;
    this.table = table;
    this.op = op;
    this.payload = payload;
    this.filters = [];
    this.wantRows = false;
    this.orderBy = null;
    this.limitCount = null;
  }

  select() {
    this.wantRows = true;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value, negate: false });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, value, negate: true });
    return this;
  }

  in(column, value) {
    this.filters.push({ column, value, negate: false });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderBy = { column, ascending };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    return this.#execute(true);
  }

  single() {
    return this.#execute(true);
  }

  then(onFulfilled, onRejected) {
    return this.#execute(false).then(onFulfilled, onRejected);
  }

  async #execute(single) {
    const rows = this.db.rows(this.table);

    if (this.op === 'insert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
      const unique = this.db.uniqueKeys[this.table] ?? [];
      for (const candidate of incoming) {
        for (const key of unique) {
          if (rows.some((row) => row[key] === candidate[key])) {
            return {
              data: null,
              error: { code: '23505', message: `duplicate key value violates unique constraint "${this.table}_${key}_key"` },
            };
          }
        }
      }
      const inserted = incoming.map((candidate) => {
        const row = { id: candidate.id ?? `${this.table}-${this.db.nextId++}`, ...candidate };
        rows.push(row);
        return { ...row };
      });
      return { data: single ? inserted[0] : inserted, error: null };
    }

    const selected = rows.filter((row) => matches(row, this.filters));

    if (this.op === 'update') {
      for (const row of selected) Object.assign(row, this.payload);
      const updated = selected.map((row) => ({ ...row }));
      if (single) return { data: updated[0] ?? null, error: null };
      return { data: this.wantRows ? updated : null, error: null };
    }

    let result = selected;
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    if (single) return { data: result[0] ? { ...result[0] } : null, error: null };
    return { data: result.map((row) => ({ ...row })), error: null };
  }
}

// The harness sets the active context before importing a function; the function
// itself calls createClient(url, key) exactly as supabase-js is called in Deno.
let active = null;

export function setContext(context) {
  active = context;
}

export function clearContext() {
  active = null;
}

export function createClient(_url, key) {
  if (!active) throw new Error('fake supabase client used before setContext()');
  const { db, anonKey, user } = active;
  const isAdmin = key !== anonKey;
  const client = {
    from(table) {
      if (!isAdmin) throw new Error(`the function tried to use the user-scoped client on table "${table}"`);
      return {
        insert: (payload) => new Query(db, table, 'insert', payload),
        select: () => new Query(db, table, 'select'),
        update: (payload) => new Query(db, table, 'update', payload),
      };
    },
    async rpc(name, args) {
      if (!isAdmin) throw new Error(`rpc "${name}" called with the user-scoped client`);
      db.rpcCalls.push({ name, args });
      return db.rpcHandlers[name] ? db.rpcHandlers[name](args, db) : { data: null, error: null };
    },
    auth: {
      async getUser() {
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'no session' } };
      },
    },
  };
  return client;
}
