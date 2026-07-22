/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Stripe webhook route explicitly sets `export const runtime = 'nodejs'`
  // so it can access the raw request body for signature verification.
  // No additional bodyParser config is needed in App Router — each route
  // opts in to the Node.js runtime individually via that export.

  // Silence the "Critical dependency" warnings from @supabase/ssr during build
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    return config
  },
}

export default nextConfig;
