/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['cheerio'],
  turbopack: {
    root: __dirname,
  },
}
module.exports = nextConfig