// @ts-nocheck
'use client';

import {
    TextInput,
    PasswordInput,
    Checkbox,
    Anchor,
    Paper,
    Title,
    Text,
    Container,
    Group,
    Button,
    Stack,
    Badge,
    Box
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';

const API_URL = '/api';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                username,
                password,
            });

            // Adjust for TransformInterceptor wrapping
            const payload = response.data?.data || response.data;
            const { access_token, user } = payload;

            if (!access_token) throw new Error('No access token received');

            localStorage.setItem('token', access_token);
            document.cookie = `token=${access_token}; path=/; max-age=86400; SameSite=Lax`;
            if (user) localStorage.setItem('user', JSON.stringify(user));

            notifications.show({
                title: 'Login Berhasil',
                message: `Selamat datang, ${user?.username || username}!`,
                color: 'green',
            });

            router.push('/dashboard');
        } catch (error: any) {
            notifications.show({
                title: 'Login Gagal',
                message: error.response?.data?.message || error.message || 'Username atau password salah',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            backgroundColor: '#0f172a',
            backgroundImage: 'radial-gradient(at 0% 0%, hsla(217,100%,39%,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(24,100%,50%,0.15) 0px, transparent 50%)',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Container size={420} my={40}>
                <Stack align="center" gap={8} mb="lg">
                    <Group gap={0} align="center" justify="center" wrap="nowrap">
                        <img src="/dw_logo.png" alt="DW Logo" style={{ height: 45, margin: 0, padding: '0 6px', objectFit: 'contain', display: 'block' }} />
                        <Box style={{ width: 2, height: 30, background: '#38bdf8', margin: '0 10px' }} />
                        <Text fw={900} style={{ color: '#0ea5e9', fontSize: '1.8rem', letterSpacing: '0.05em' }}>
                            RM
                        </Text>
                    </Group>
                    <Text size="xs" c="gray.4" ta="center">
                        Raw Material — Digitalisation Warehouse System
                    </Text>
                </Stack>

                <Paper withBorder shadow="xl" p={30} radius="lg" style={{ background: '#ffffff', borderColor: '#334155' }}>
                    <form onSubmit={handleLogin}>
                        <TextInput
                            label="Username"
                            placeholder="Masukkan username"
                            required
                            size="xs"
                            value={username}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                        />
                        <PasswordInput
                            label="Password"
                            placeholder="Masukkan password"
                            required
                            size="xs"
                            mt="md"
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        />
                        <Button fullWidth mt="xl" size="sm" type="submit" loading={loading} color="blue" style={{ fontWeight: 800 }}>
                            MASUK KE SISTEM DW
                        </Button>
                    </form>
                </Paper>
            </Container>
        </div>
    );
}
