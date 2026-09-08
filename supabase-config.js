const SUPABASE_URL =
  "https://dhuvyechxcziodhtjcd.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_z-5bpCobS846lBpP5RFsmQ_J__eFGw9";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
