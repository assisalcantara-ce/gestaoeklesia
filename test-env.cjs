require('dotenv').config({ path: '.env.local' });
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Service Key Length:", process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : "undefined");
console.log("Anon Key Length:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length : "undefined");
