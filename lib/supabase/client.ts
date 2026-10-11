import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

// Alias for convenience
export const createClient = createBrowserClient;
