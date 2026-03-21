/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/secretaria/congregacoes',
        destination: '/secretaria/estrutura-hierarquica',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
