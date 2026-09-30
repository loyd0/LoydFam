"use client";

import { Moon, Sun, Monitor, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { ViewModeToggle } from "@/components/view-mode-toggle";

/** Search action, available on touch and keyboard layouts. */
function SearchButton() {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label="Search the family archive"
      className="size-11 shrink-0 gap-2 border-border/60 bg-muted/40 p-0 text-xs text-muted-foreground transition-colors hover:bg-muted/60 md:h-9 md:w-auto md:px-3 md:py-1.5"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { metaKey: true, key: "k", bubbles: true })
        )
      }
    >
      <Search aria-hidden="true" className="size-4 md:hidden" />
      <span className="hidden md:inline">Search</span>
      <kbd className="pointer-events-none hidden h-4 select-none items-center gap-0.5 rounded border bg-background px-1 font-mono text-[9px] md:inline-flex">
        <span>⌘</span>K
      </kbd>
    </Button>
  );
}

/** Light / dark / system theme toggle. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 sm:size-9" aria-label="Toggle theme">
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** All interactive header actions — grouped into one client component. */
export function HeaderActions() {
  return (
    <>
      <SearchButton />
      <ViewModeToggle />
      <ThemeToggle />
    </>
  );
}
