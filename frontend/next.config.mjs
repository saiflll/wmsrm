/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3002';

const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${BACKEND_URL}/:path*`,
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
