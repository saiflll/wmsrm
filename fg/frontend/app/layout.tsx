import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

export const metadata = { title: 'FG WMS - Finished Goods', description: 'Finished Goods Warehouse Management System' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light">
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
