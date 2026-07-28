import React from 'react';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './table-resize.css';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

export const metadata = {
    title: 'DW - Digitalisation Warehouse',
    description: 'Digitalisation Warehouse Management System',
};
const theme = createTheme({
    primaryColor: 'blue',
    fontFamily: 'Inter, sans-serif',
    defaultRadius: 'sm',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" data-mantine-color-scheme="light">
            <head>
                <ColorSchemeScript />
            </head>
            <body>
                <MantineProvider theme={theme}>
                    <Notifications />
                    {children}
                </MantineProvider>
            </body>
        </html>
    );
}
