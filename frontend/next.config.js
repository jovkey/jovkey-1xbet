/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Relaie /api/* vers le backend en interne (serveur→serveur) pour que le navigateur
  // ne voie qu'un seul domaine (celui du frontend). Le cookie de session posé par le
  // backend devient alors 1st-party pour ce domaine : sans ça, Brave/Safari/Chrome
  // (protections tierces activées) bloquent silencieusement le cookie de connexion
  // puisque frontend (vercel.app) et backend (onrender.com) sont deux domaines distincts.
  async rewrites() {
    const backend = (process.env.BACKEND_API_URL || 'http://localhost:4000').trim().replace(/\/+$/, '');
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};
module.exports = nextConfig;
