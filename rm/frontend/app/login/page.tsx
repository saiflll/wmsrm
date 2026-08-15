// @ts-nocheck
'use client';

import {
    TextInput,
    PasswordInput,
    Button,
    Paper,
    Text,
    Container,
    Group,
    Stack,
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

            const landingByRole: Record<number, string> = {
                1: '/inbound',
                2: '/dashboard',
                3: '/planning-inbound',
                4: '/dashboard',
                5: '/dashboard',
                6: '/dashboard',
            };
            router.push(landingByRole[Number(user?.role)] || '/about');
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
            margin: 0,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            backgroundColor: '#f4f6f8',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* SVG Icon Pattern Background */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23dde1e6' stroke-width='1.6'%3E%3Cpath d='M20 30 L35 22 L50 30 L50 50 L35 58 L20 50 Z'/%3E%3Cpath d='M20 30 L35 38 L50 30'/%3E%3Cpath d='M35 38 L35 58'/%3E%3Crect x='90' y='20' width='34' height='22' rx='2'/%3E%3Cline x1='90' y1='27' x2='124' y2='27'/%3E%3Cline x1='90' y1='34' x2='124' y2='34'/%3E%3Cpath d='M25 100 h20 M35 90 v20 M28 96 l7 -6 l7 6'/%3E%3Crect x='90' y='95' width='36' height='24' rx='2'/%3E%3Cline x1='96' y1='100' x2='96' y2='114'/%3E%3Cline x1='101' y1='100' x2='101' y2='114'/%3E%3Cline x1='107' y1='100' x2='107' y2='114'/%3E%3Cline x1='112' y1='100' x2='112' y2='114'/%3E%3Cline x1='118' y1='100' x2='118' y2='114'/%3E%3C/g%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
                backgroundSize: '160px 160px',
            }} />

            {/* Soft Blurred Color Blobs */}
            <div style={{
                position: 'fixed',
                borderRadius: '50%',
                filter: 'blur(60px)',
                zIndex: 0,
                width: 380,
                height: 380,
                top: -80,
                left: -100,
                background: 'rgba(37, 99, 235, 0.18)'
            }} />
            <div style={{
                position: 'fixed',
                borderRadius: '50%',
                filter: 'blur(60px)',
                zIndex: 0,
                width: 320,
                height: 320,
                bottom: -100,
                right: -80,
                background: 'rgba(236, 0, 141, 0.14)'
            }} />
            <div style={{
                position: 'fixed',
                borderRadius: '50%',
                filter: 'blur(60px)',
                zIndex: 0,
                width: 260,
                height: 260,
                top: '40%',
                right: '10%',
                background: 'rgba(2, 178, 214, 0.12)'
            }} />

            <div style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                maxWidth: 400,
                margin: '40px auto',
                padding: '0 16px',
            }}>
                {/* Logo Stack */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 28,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-0.03em', color: '#111827', lineHeight: 1 }}>DW</div>
                        <div style={{ width: 1.5, height: 26, background: '#94a3b8', margin: '0 12px', opacity: 0.6 }} />
                        <div style={{ fontWeight: 800, color: '#111827', fontSize: '1.8rem', letterSpacing: '0.03em', lineHeight: 1 }}>RM</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', letterSpacing: '0.02em', fontWeight: 600 }}>
                        Raw Material — Digitalitation Wherehouse System
                    </div>
                </div>

                {/* Glassmorphism Card Paper */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.6)',
                    borderRadius: 20,
                    padding: '34px 30px',
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                    boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                }}>
                    <form onSubmit={handleLogin}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                                Username <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                name="username"
                                autoComplete="username"
                                placeholder="Masukkan username"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={{
                                    width: '100%',
                                    fontSize: 13.5,
                                    padding: '10px 12px',
                                    border: '1px solid rgba(255,255,255,0.7)',
                                    borderRadius: 8,
                                    outline: 'none',
                                    background: 'rgba(255, 255, 255, 0.5)',
                                    color: '#0f172a',
                                    backdropFilter: 'blur(6px)',
                                    WebkitBackdropFilter: 'blur(6px)',
                                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                                }}
                            />
                        </div>

                        <div style={{ marginTop: 18 }}>
                            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                                Password <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                autoComplete="current-password"
                                placeholder="Masukkan password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    fontSize: 13.5,
                                    padding: '10px 12px',
                                    border: '1px solid rgba(255,255,255,0.7)',
                                    borderRadius: 8,
                                    outline: 'none',
                                    background: 'rgba(255, 255, 255, 0.5)',
                                    color: '#0f172a',
                                    backdropFilter: 'blur(6px)',
                                    WebkitBackdropFilter: 'blur(6px)',
                                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                marginTop: 26,
                                padding: '11px 16px',
                                fontSize: 13.5,
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                color: '#fff',
                                backgroundColor: 'rgba(37, 99, 235, 0.9)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: 8,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                                backdropFilter: 'blur(6px)',
                                WebkitBackdropFilter: 'blur(6px)',
                                transition: 'background-color 0.15s ease, transform 0.05s ease',
                            }}
                        >
                            {loading ? 'Memproses...' : 'MASUK KE SISTEM DW'}
                        </button>
                    </form>
                </div>

                <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                    © 2026 Digitalitation Wherehouse System
                </div>
            </div>
        </div>
    );
}
