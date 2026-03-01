"use client";

import type { UseDataGridReturn } from "./types";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataGridPaginationProps<TData> {
  grid: UseDataGridReturn<TData>;
}

export function DataGridPagination<TData>({
  grid,
}: DataGridPaginationProps<TData>) {
  const start = grid.currentPage * grid.pageSize + 1;
  const end = Math.min(
    (grid.currentPage + 1) * grid.pageSize,
    grid.totalRows
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t">
      {/* Row count */}
      <div className="text-xs text-muted-foreground tabular-nums">
        {grid.totalRows > 0
          ? `${start}–${end} of ${grid.totalRows}`
          : "0 rows"}
      </div>

      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows:</span>
          <Select
            value={String(grid.pageSize)}
            onValueChange={(v) => grid.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {grid.pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page info */}
        <span className="text-xs text-muted-foreground tabular-nums">
          Page {grid.currentPage + 1} of {grid.totalPages}
        </span>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => grid.setPage(0)}
            disabled={grid.currentPage <= 0}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => grid.setPage(grid.currentPage - 1)}
            disabled={grid.currentPage <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => grid.setPage(grid.currentPage + 1)}
            disabled={grid.currentPage >= grid.totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => grid.setPage(grid.totalPages - 1)}
            disabled={grid.currentPage >= grid.totalPages - 1}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
