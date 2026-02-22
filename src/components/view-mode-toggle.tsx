"use client";

import { TreePine, Users } from "lucide-react";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ViewModeToggle() {
  const { viewMode, setViewMode, isLoydOnly } = useViewMode();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setViewMode(isLoydOnly ? "full" : "loyd")}
            className={`
              relative inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium
              transition-all duration-300 cursor-pointer select-none
              ${
                isLoydOnly
                  ? "border-primary/60 bg-primary/8 text-primary hover:bg-primary/15"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }
            `}
            aria-label={isLoydOnly ? "Switch to Full Family view" : "Switch to Loyd Only view"}
          >
            {isLoydOnly ? (
              <>
                <TreePine className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Loyd Only</span>
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Full Family</span>
              </>
            )}
            {/* Active indicator dot */}
            <span
              className={`ml-0.5 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                isLoydOnly ? "bg-primary" : "bg-muted-foreground/40"
              }`}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isLoydOnly
            ? "Showing Loyd lineage only (surname LOYD/LLOYD + LOYD: numbers). Click to show all."
            : "Showing entire family including non-Loyd spouses and descendants. Click to filter to Loyds only."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
