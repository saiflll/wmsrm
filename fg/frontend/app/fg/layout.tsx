"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Burger,
  Group,
  Title,
  Text,
  Button,
  Stack,
  Box,
  NavLink,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconDashboard,
  IconLogout,
  IconArrowDown,
  IconArrowUp,
  IconTruck,
  IconClipboardList,
  IconTransfer,
  IconShieldCheck,
  IconMapPin,
  IconFileReport,
  IconBuilding,
  IconUsers,
  IconPackage,
  IconScan,
  IconArrowsShuffle,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    label: "Dashboard",
    href: "/fg/dashboard",
    icon: IconDashboard,
    roles: [],
    color: "blue",
  },
  {
    label: "Barang Masuk",
    href: "/fg/barang-masuk",
    icon: IconArrowDown,
    roles: ["KOORDINATOR_IN", "SUPERVISOR"],
    color: "green",
  },
  {
    label: "Barang Keluar",
    href: "/fg/barang-keluar",
    icon: IconArrowUp,
    roles: ["KOORDINATOR_OUT", "SUPERVISOR"],
    color: "red",
  },
  {
    label: "OTDR",
    href: "/fg/otdr",
    icon: IconTruck,
    roles: ["KOORDINATOR_OUT", "SUPERVISOR"],
    color: "orange",
  },
  {
    label: "Picking List",
    href: "/fg/picking-list",
    icon: IconClipboardList,
    roles: ["KOORDINATOR_OUT", "SUPERVISOR", "ADMIN"],
    color: "red",
  },
  {
    label: "Mutasi",
    href: "/fg/mutasi",
    icon: IconTransfer,
    roles: ["KOORDINATOR_IN", "KOORDINATOR_OUT", "SUPERVISOR"],
    color: "grape",
  },
  {
    label: "QC FIFO",
    href: "/fg/qc-fifo",
    icon: IconShieldCheck,
    roles: ["QUALITY_CONTROL", "SUPERVISOR"],
    color: "teal",
  },
  {
    label: "Stock",
    href: "/fg/stock",
    icon: IconPackage,
    roles: [],
    color: "blue",
  },
  {
    label: "Scanner",
    href: "/fg/scan",
    icon: IconScan,
    roles: [],
    color: "violet",
  },
  {
    label: "Update Lokasi",
    href: "/fg/stock-opname",
    icon: IconMapPin,
    roles: ["INVENTORY", "SUPERVISOR"],
    color: "grape",
  },
  {
    label: "Relocation",
    href: "/fg/relocation",
    icon: IconArrowsShuffle,
    roles: ["INVENTORY", "SUPERVISOR"],
    color: "orange",
  },
  {
    label: "Admin IT",
    href: "/fg/admin-it",
    icon: IconUsers,
    roles: ["ADMIN", "SUPERVISOR"],
    color: "pink",
  },
  {
    label: "Report",
    href: "/fg/report",
    icon: IconFileReport,
    roles: ["SUPERVISOR"],
    color: "gray",
  },
  {
    label: "Master Barang",
    href: "/fg/master-barang",
    icon: IconBuilding,
    roles: ["SUPERVISOR"],
    color: "dark",
  },
  {
    label: "Master Rak",
    href: "/fg/master-rak",
    icon: IconBuilding,
    roles: ["SUPERVISOR"],
    color: "dark",
  },
  {
    label: "Master Resto",
    href: "/fg/master-resto",
    icon: IconBuilding,
    roles: ["SUPERVISOR"],
    color: "dark",
  },
  {
    label: "Users",
    href: "/fg/users",
    icon: IconUsers,
    roles: ["SUPERVISOR", "ADMIN"],
    color: "pink",
  },
];

export default function FgLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [opened, { toggle }] = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("fg_user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("fg_token");
    localStorage.removeItem("fg_user");
    router.push("/login");
  };

  const userRole = user?.role || "";
  const isSpv = userRole === "SUPERVISOR";
  const filteredMenu = menuItems.filter(
    (item) => item.roles.length === 0 || item.roles.includes(userRole) || isSpv,
  );

  if (!user) return null;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group
          h="100%"
          px="md"
          style={{ background: "#1c1c1c", color: "white" }}
        >
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="sm"
            size="sm"
            color="white"
          />
          <Title order={4} style={{ color: "#e6921e" }}>
            FG WMS
          </Title>
          <Text size="xs" c="dimmed" ml="sm">
            | {user.namaUser} ({userRole})
          </Text>
          <Button
            ml="auto"
            variant="subtle"
            color="red"
            size="xs"
            onClick={handleLogout}
            leftSection={<IconLogout size={14} />}
          >
            Logout
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" style={{ background: "#f8f9fa" }}>
        <Stack gap={2}>
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                label={item.label}
                leftSection={<Icon size={18} />}
                active={active}
                color={item.color}
                variant="light"
                style={{ borderRadius: 6, fontWeight: 600, marginBottom: 2 }}
                onClick={() => {
                  if (window.innerWidth < 768) toggle();
                }}
              />
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: "#f8f9fa", minHeight: "100vh" }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
