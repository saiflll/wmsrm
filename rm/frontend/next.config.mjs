/** @type {import('next').NextConfig} */
// URL backend di-hardcode karena next.config.mjs dibaca saat BUILD,
// bukan saat runtime container, sehingga env var tidak tersedia.
// Dalam Docker Compose, 'backend' adalah nama service yang selalu bisa diakses.
const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3011';

const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${BACKEND_URL}/api/:path*`,
            },
        ];
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    }
};

export default nextConfig;
