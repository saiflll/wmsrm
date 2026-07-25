/** @type {import('next').NextConfig} */
import { execSync } from 'child_process';

let commitCount = 109;
try {
    const output = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    if (output) commitCount = parseInt(output, 10);
} catch (e) {
    commitCount = 109;
}

const minor = Math.floor(commitCount / 100);
const patch = commitCount % 100;
const APP_VERSION = `1.${minor}.${patch}`;

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:3011';

const nextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    },
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
