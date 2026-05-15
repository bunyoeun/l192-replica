const SUPABASE_URL = 'https://vbhgmxyaeucxwqpwutxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaGdteHlhZXVjeHdxcHd1dHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Mzc1ODAsImV4cCI6MjA5NDQxMzU4MH0.yzzuixy8Q4N32oSIOCzLXtAbf2pKfj6BESmbYU52QGA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
