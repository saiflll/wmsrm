'use client';
import { useState } from 'react';
import { TextInput, Button, Paper, Title, Stack, Container } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import api from '../fg/lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      const data = res.data || res;
      localStorage.setItem('fg_token', data.access_token);
      localStorage.setItem('fg_user', JSON.stringify(data.user));
      notifications.show({ title: 'Login Berhasil', message: `Selamat datang, ${data.user.namaUser}`, color: 'green' });
      router.push('/fg/dashboard');
    } catch (err: any) {
      notifications.show({ title: 'Login Gagal', message: err.response?.data?.message || 'Terjadi kesalahan', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={400} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper p="xl" shadow="md" radius="md" w="100%">
        <Stack>
          <Title order={2} ta="center">FG WMS</Title>
          <Title order={4} ta="center" c="dimmed">Finished Goods Inventory</Title>
          <TextInput label="Username" placeholder="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} required />
          <TextInput label="Password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required />
          <Button fullWidth loading={loading} onClick={handleLogin}>Login</Button>
        </Stack>
      </Paper>
    </Container>
  );
}
