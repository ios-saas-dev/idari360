import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';

export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Alias for convenience
export const createClient = createBrowserClient;
