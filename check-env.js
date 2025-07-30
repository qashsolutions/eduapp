// Run this with: node check-env.js
require('dotenv').config({ path: '.env.local' });
console.log('Checking environment variables...\n');

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY'
];

const missing = [];
const configured = [];

required.forEach(key => {
  if (process.env[key]) {
    configured.push(key);
  } else {
    missing.push(key);
  }
});

console.log(`✅ Configured (${configured.length}):`);
configured.forEach(key => console.log(`  - ${key}`));

console.log(`\n❌ Missing (${missing.length}):`);
missing.forEach(key => console.log(`  - ${key}`));

if (missing.length > 0) {
  console.log('\n⚠️  Add missing variables to your .env.local file or Vercel environment variables');
}