import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
/** The browser's Supabase client; the session persists in localStorage. */
export const db = createClient(SUPABASE_URL, ANON_KEY);
