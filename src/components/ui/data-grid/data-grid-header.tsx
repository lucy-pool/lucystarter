"use client";

import type { UseDataGridReturn } from "./types";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { DataGridResizeHandle } from "./data-grid-resize-handle";

interface DataGridHeaderProps<TData> {
  grid: UseDataGridReturn<TData>;
}

export function DataGridHeader<TData>({ grid }: DataGridHeaderProps<TData>) {
  return (
    <TableHeader>
      <TableRow>
        {grid.enableSelection && (
          <TableHead className="w-[48px]">
            <Checkbox
              checked={grid.allSelected ? true : grid.someSelected ? "indeterminate" : false}
              onCheckedChange={grid.toggleAllRows}
              aria-label="Select all"
            />
          </TableHead>
        )}
        {grid.visibleColumns.map((col) => (
          <TableHead
            key={col.id}
            className="relative select-none"
            style={{
              width: grid.columnWidths[col.id] ?? col.width,
              minWidth: col.minWidth ?? 60,
              textAlign: col.align ?? "left",
            }}
          >
            {col.sortable !== false && col.header ? (
              <button
                onClick={() => grid.handleSort(col.id)}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <span>
                  {typeof col.header === "string"
                    ? col.header
                    : col.header()}
                </span>
                <span className="text-muted-foreground">
                  {grid.sorting?.id === col.id ? (
                    grid.sorting.direction === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
            ) : col.header ? (
              <span>
                {typeof col.header === "string" ? col.header : col.header()}
              </span>
            ) : null}
            {grid.enableColumnResize &&
              col.resizable !== false &&
              col.header && (
                <DataGridResizeHandle
                  onResize={(diff) => grid.handleResize(col.id, diff)}
                />
              )}
          </TableHead>
        ))}
        {grid.rowActions && <TableHead className="w-[60px]" />}
      </TableRow>

      {/* Column filter row */}
      {grid.showFilters && (
        <TableRow>
          {grid.enableSelection && <TableHead />}
          {grid.visibleColumns.map((col) => (
            <TableHead key={col.id} className="py-2">
              {col.filterable ? (
                col.filterType === "enum" && col.filterOptions ? (
                  <Select
                    value={grid.columnFilters[col.id] ?? ""}
                    onValueChange={(value) =>
                      grid.setColumnFilter(col.id, value === "__all__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {col.filterOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={
                      col.filterType === "number"
                        ? "number"
                        : col.filterType === "date"
                          ? "date"
                          : "text"
                    }
                    placeholder={
                      col.filterType === "number" ? "Min..." : "Filter..."
                    }
                    value={grid.columnFilters[col.id] ?? ""}
                    onChange={(e) =>
                      grid.setColumnFilter(col.id, e.target.value)
                    }
                    className="h-7 text-xs"
                  />
                )
              ) : null}
            </TableHead>
          ))}
          {grid.rowActions && <TableHead />}
        </TableRow>
      )}
    </TableHeader>
  );
}
