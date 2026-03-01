"use client";

import type { ReactNode } from "react";
import { SearchX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataGridEmptyProps {
  colSpan: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  children?: ReactNode;
}

export function DataGridEmpty({
  colSpan,
  hasActiveFilters,
  onClearFilters,
  children,
}: DataGridEmptyProps) {
  if (children) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-16">
          {children}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <SearchX className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search or filter criteria
            </p>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              Clear all filters
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
