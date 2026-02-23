import { SessionProvider } from "next-auth/react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { HeaderActions } from "@/components/header-actions";
import { ViewModeProvider } from "@/hooks/use-view-mode";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ViewModeProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 min-w-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 !h-4" />
              <div className="flex-1" />
              <HeaderActions />
            </header>
            <main className="flex-1 w-full min-w-0 p-4 md:p-6 pb-24 md:pb-6">
              {children}
            </main>
          </SidebarInset>
          <CommandPalette />
        </SidebarProvider>
      </ViewModeProvider>
    </SessionProvider>
  );
}
