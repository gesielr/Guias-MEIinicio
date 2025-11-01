import { createClient } from '@supabase/supabase-js';

// Suporta Vite (VITE_*) e fallback para CRA (REACT_APP_*)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabaseClient = null;

if (!supabaseUrl || !supabaseAnonKey) {
  // Development environment without Supabase configured: fall back to a lightweight mock.
  console.warn('Aviso: variaveis VITE_SUPABASE_URL/ANON_KEY (ou REACT_APP_*) nao encontradas. Usando mock de supabase para desenvolvimento.');

  const mockAuth = {
    async getSession() { return { data: { session: null }, error: null }; },
    async setSession() { return { data: { session: null }, error: null }; },
    async getUser() { return { data: { user: null }, error: null }; },
    onAuthStateChange() {
      const subscription = { unsubscribe: () => {} };
      return { data: { subscription }, error: null, subscription };
    },
    async signOut() { return { error: null }; },
    async signUp({ email, role = 'partner' }) {
      const id = 'mock_' + Date.now();
      return { data: { user: { id, email, user_metadata: { role, user_type: role } } }, error: null };
    }
  };

  const createMockQuery = (rows = []) => {
    const response = { data: rows, error: null, count: rows.length };
    const builder = {
      select() { return builder; },
      in() { return builder; },
      eq() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      single() { return Promise.resolve({ data: response.data[0] ?? null, error: null }); },
      maybeSingle() { return Promise.resolve({ data: response.data[0] ?? null, error: null }); },
      insert: async (payload) => ({ data: Array.isArray(payload) ? payload : [payload], error: null }),
      update: async (payload) => ({ data: Array.isArray(payload) ? payload : [payload], error: null }),
      delete: async () => ({ data: [], error: null }),
      upsert: async (payload) => ({ data: payload, error: null }),
      then(onFulfilled, onRejected) {
        return Promise.resolve(response).then(onFulfilled, onRejected);
      }
    };
    return builder;
  };

  supabaseClient = {
    auth: mockAuth,
    from() {
      return createMockQuery();
    }
  };

} else {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseClient;
