const SUPABASE_URL =
  "https://dhuvyehchxcziodhtjcd.supabase.co/rest/v1/";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_z-5bpCobS846lBpP5RFsmQ_J__eFGw9";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
