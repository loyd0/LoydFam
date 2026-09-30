"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { signOut, useSession } from "next-auth/react";
import { usePermissions, type PermissionKey } from "@/hooks/use-permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  MapPin,
  Landmark,
  LayoutDashboard,
  Users,
  TreePine,
  Clock,
  BarChart3,
  Upload,
  ShieldAlert,
  Settings,
  LogOut,
  GitMerge,
  Layers,
  PieChart,
  Network,
  UserCog,
  FileClock,
  ChevronUp,
} from "lucide-react";

const mainNav = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
  { title: "People", href: "/people", icon: Users, permission: "people.view" },
  { title: "Family Tree", href: "/tree", icon: TreePine, permission: "tree.view" },
  { title: "Family Map", href: "/map", icon: MapPin, permission: "map.view" },
  { title: "Family Properties", href: "/properties", icon: Landmark, permission: "properties.view" },
  { title: "Mind Map", href: "/mindmap", icon: Network, permission: "mindmap.view" },
  { title: "Timeline", href: "/timeline", icon: Clock, permission: "timeline.view" },
  { title: "Stats", href: "/stats", icon: BarChart3, permission: "stats.view" },
  { title: "Generations", href: "/generations", icon: Layers, permission: "generations.view" },
  { title: "Fan Chart", href: "/fan-chart", icon: PieChart, permission: "fanChart.view" },
  { title: "Relationship", href: "/relationship", icon: GitMerge, permission: "relationship.view" },
  { title: "History", href: "/history", icon: FileClock, permission: "history.view" },
] satisfies { title: string; href: string; icon: typeof LayoutDashboard; permission: PermissionKey }[];

const accountNav = [
  { title: "My amendments", href: "/amendments", icon: FileClock },
  { title: "Settings", href: "/settings", icon: UserCog },
];

const adminNav = [
  { title: "Review amendments", href: "/admin/amendments", icon: FileClock },
  { title: "Imports", href: "/admin/imports", icon: Upload },
  { title: "Data Quality", href: "/admin/data-quality", icon: ShieldAlert },
  { title: "User Management", href: "/admin/settings", icon: Settings },
  { title: "Permissions", href: "/admin/permissions", icon: ShieldAlert },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const { can } = usePermissions();
  const [pending, setPending] = useState<{ mine: number; review: number } | null>(null);
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/amendments/counts", { cache: "no-store", signal: controller.signal });
        if (response.ok) setPending(await response.json());
      } catch { /* Keep the last known count during a temporary connection failure. */ }
    }
    void refresh();
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [userId, pathname]);
  const pendingCount = isAdmin ? pending?.review ?? 0 : pending?.mine ?? 0;
  const badge = (count: number) => count > 0 ? <span aria-label={`${count} pending changes`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{count}</span> : null;
  const visibleMainNav = mainNav.filter((item) => can(item.permission));

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15 relative overflow-hidden">
            <Image src="/family-crest.svg" alt="Loyd Family Crest" fill className="object-contain p-1.5 dark:invert opacity-90" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">
              Loyd Family
            </span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              History System
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="min-h-12 border border-sidebar-border bg-background/50" aria-label={`Account${isAdmin ? " and admin" : ""}${pendingCount ? `, ${pendingCount} pending changes` : ""}`}>
                  <UserCog className="size-4" />
                  <span>Account{isAdmin ? " & admin" : ""}</span>
                  {badge(pendingCount)}
                  <ChevronUp className={`size-4 ${pendingCount ? "" : "ml-auto"}`} />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-2">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Account</DropdownMenuLabel>
                {accountNav.map(item => <DropdownMenuItem key={item.href} asChild className="min-h-11 rounded-md">
                  <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={isActive(item.href) ? "page" : undefined}>
                    <item.icon /><span>{item.title}</span>{item.href === "/amendments" && badge(pending?.mine ?? 0)}
                  </Link>
                </DropdownMenuItem>)}
                {isAdmin && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
                  {adminNav.map(item => <DropdownMenuItem key={item.href} asChild className="min-h-11 rounded-md">
                    <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={isActive(item.href) ? "page" : undefined}>
                      <item.icon /><span>{item.title}</span>{item.href === "/admin/amendments" && badge(pending?.review ?? 0)}
                    </Link>
                  </DropdownMenuItem>)}
                </>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })} className="min-h-11 rounded-md">
                  <LogOut /><span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
