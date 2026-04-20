import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://iunittdjpnmkhvlaizpo.supabase.co'
const SUPABASE_KEY = 'sb_publishable_EwHb8nCFdujAcA42481Mgg_aCsE6MAa'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)