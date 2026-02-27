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
    Button
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';

const API_URL = 'http://localhost:3001';

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
            if (user) localStorage.setItem('user', JSON.stringify(user));

            notifications.show({
                title: 'Login Berhasil',
                message: `Selamat datang, ${user?.username || username}!`,
                color: 'green',
            });

            router.push('/wms/dashboard');
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
            backgroundColor: '#f1f3f5',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center'
        }}>
            <Container size={420} my={40}>
                <Title ta="center" fw={900}>
                    WMS Login
                </Title>
                <Text c="dimmed" size="sm" ta="center" mt={5}>
                    Gunakan akun dari seed: <br />
                    (foreman1, admin1, atau superadmin)
                </Text>

                <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                    <form onSubmit={handleLogin}>
                        <TextInput
                            label="Username"
                            placeholder="Masukkan username"
                            required
                            value={username}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                        />
                        <PasswordInput
                            label="Password"
                            placeholder="Masukkan password"
                            required
                            mt="md"
                            value={password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        />
                        <Button fullWidth mt="xl" type="submit" loading={loading}>
                            Masuk
                        </Button>
                    </form>
                </Paper>
            </Container>
        </div>
    );
}
