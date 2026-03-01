"use client";

import type { UseDataGridReturn } from "./types";
import { Search, SlidersHorizontal, X, Columns3, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataGridToolbarProps<TData> {
  grid: UseDataGridReturn<TData>;
}

export function DataGridToolbar<TData>({ grid }: DataGridToolbarProps<TData>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b">
      {/* Left side */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Global search */}
        {grid.enableGlobalFilter && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={grid.globalFilter}
              onChange={(e) => grid.setGlobalFilter(e.target.value)}
              placeholder="Search all columns..."
              className="pl-9 pr-8 h-9"
            />
            {grid.globalFilter && (
              <button
                onClick={() => grid.setGlobalFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter toggle */}
        {grid.enableColumnFilters && (
          <Button
            variant={grid.showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => grid.setShowFilters(!grid.showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {grid.hasActiveFilters && (
              <span className="ml-1 h-4 min-w-[16px] rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                {Object.values(grid.columnFilters).filter(Boolean).length +
                  (grid.globalFilter ? 1 : 0)}
              </span>
            )}
          </Button>
        )}

        {/* Clear filters */}
        {grid.hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={grid.clearFilters}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {grid.enableSelection && grid.selectedRows.size > 0 && (
          <span className="text-xs text-muted-foreground font-medium mr-1">
            {grid.selectedRows.size} selected
          </span>
        )}

        {/* Column visibility */}
        {grid.enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {grid.allColumns
                .filter((c) => c.hideable !== false && c.header)
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={grid.columnVisibility[col.id] !== false}
                    onCheckedChange={() =>
                      grid.toggleColumnVisibility(col.id)
                    }
                  >
                    {typeof col.header === "string" ? col.header : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Custom toolbar actions slot */}
        {grid.toolbarActions}
      </div>
    </div>
  );
}
