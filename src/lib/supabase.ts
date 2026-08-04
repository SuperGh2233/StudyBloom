import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { AppError } from '../utils/errorMessage';

type ViteEnv = Record<string, string | undefined>;

const env = ((import.meta as ImportMeta & { env?: ViteEnv }).env ?? {}) as ViteEnv;
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

/** Null is intentional: local UI can render before Supabase env is configured. */
export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new AppError('Supabase 尚未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY', 'CONFIG_MISSING');
  }
  return supabase;
}

