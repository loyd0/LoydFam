"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { usePermissions, type PermissionKey } from "@/hooks/use-permissions";
import { Home, MapPin, MoreHorizontal, TreePine, Users } from "lucide-react";

const items = [
  { label: "Home", href: "/", icon: Home, permission: "dashboard.view" },
  { label: "People", href: "/people", icon: Users, permission: "people.view" },
  { label: "Tree", href: "/tree", icon: TreePine, permission: "tree.view" },
  { label: "Map", href: "/map", icon: MapPin, permission: "map.view" },
] satisfies { label: string; href: string; icon: typeof Home; permission: PermissionKey }[];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { can } = usePermissions();
  const visibleItems = items.filter((item) => can(item.permission));

  return (
    <nav aria-label="Primary" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pt-1.5 backdrop-blur-lg md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
        {visibleItems.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <li className="min-w-0 flex-1" key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Open all sections"
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
            <span>More</span>
          </button>
        </li>
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
