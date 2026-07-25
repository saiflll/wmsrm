'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Loader } from '@mantine/core';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (token && user) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }, [router]);

    return (
        <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f9fa' }}>
            <Loader size="md" color="orange" />
        </Box>
    );
}
