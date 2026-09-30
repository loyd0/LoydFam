import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { HeaderActions } from "@/components/header-actions";
import { ViewModeProvider } from "@/hooks/use-view-mode";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PermissionsProvider } from "@/hooks/use-permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <SessionProvider session={session}>
      <PermissionsProvider isAdmin={session.user?.role === "ADMIN"}>
       <ViewModeProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <header className="app-header sticky top-0 z-30 flex h-14 w-full shrink-0 min-w-0 items-center gap-2 border-b border-border/50 bg-background/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 hidden !h-4 sm:block" />
              <div className="flex-1" />
              <HeaderActions />
            </header>
            <main className="app-main min-w-0 w-full flex-1 px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-5 md:px-6 md:py-6 md:pb-6">
              {children}
            </main>
          </SidebarInset>
          <MobileBottomNav />
          <CommandPalette />
        </SidebarProvider>
       </ViewModeProvider>
      </PermissionsProvider>
    </SessionProvider>
  );
}
