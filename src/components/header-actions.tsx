"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

/** Search ⌘K button — dispatches a synthetic keyboard event for the command palette. */
function SearchButton() {
  return (
    <button
      className="hidden md:flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { metaKey: true, key: "k", bubbles: true })
        )
      }
    >
      <span>Search</span>
      <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-background px-1 font-mono text-[9px]">
        <span>⌘</span>K
      </kbd>
    </button>
  );
}

/** Light / dark / system theme toggle. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle theme">
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
      <ThemeToggle />
    </>
  );
}
