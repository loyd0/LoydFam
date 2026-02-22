"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  TreePine,
  Clock,
  BarChart3,
  Network,
} from "lucide-react";

const tabs = [
  { title: "Home", href: "/", icon: LayoutDashboard },
  { title: "People", href: "/people", icon: Users },
  { title: "Tree", href: "/tree", icon: TreePine },
  { title: "Map", href: "/mindmap", icon: Network },
  { title: "Stats", href: "/stats", icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl safe-area-inset-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 min-w-0 px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <span className="absolute inset-0 rounded-xl bg-primary/8 animate-in fade-in duration-150" />
              )}
              <tab.icon
                className={`h-5 w-5 transition-transform duration-200 ${active ? "scale-110" : ""}`}
              />
              <span className={`text-[10px] font-medium leading-none ${active ? "opacity-100" : "opacity-70"}`}>
                {tab.title}
              </span>
              {active && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
