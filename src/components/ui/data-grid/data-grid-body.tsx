"use client";

import type { UseDataGridReturn } from "./types";
import { Checkbox } from "@/components/ui/checkbox";
import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { DataGridEmpty } from "./data-grid-empty";

interface DataGridBodyProps<TData> {
  grid: UseDataGridReturn<TData>;
}

export function DataGridBody<TData>({ grid }: DataGridBodyProps<TData>) {
  const colSpan =
    grid.visibleColumns.length +
    (grid.enableSelection ? 1 : 0) +
    (grid.rowActions ? 1 : 0);

  if (grid.paginatedData.length === 0) {
    return (
      <TableBody>
        <DataGridEmpty
          colSpan={colSpan}
          hasActiveFilters={grid.hasActiveFilters}
          onClearFilters={grid.clearFilters}
        >
          {grid.emptyState}
        </DataGridEmpty>
      </TableBody>
    );
  }

  return (
    <TableBody>
      {grid.paginatedData.map((row) => {
        const rowId = grid.getRowId(row);
        const isSelected = grid.selectedRows.has(rowId);

        return (
          <TableRow
            key={rowId}
            data-state={isSelected ? "selected" : undefined}
          >
            {grid.enableSelection && (
              <TableCell className="w-[48px]">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => grid.toggleRow(rowId)}
                  aria-label={`Select row ${rowId}`}
                />
              </TableCell>
            )}
            {grid.visibleColumns.map((col) => {
              const accessor = col.accessorFn
                ? col.accessorFn
                : (r: TData) => (r as Record<string, unknown>)[col.id];
              const value = accessor(row);

              return (
                <TableCell
                  key={col.id}
                  style={{
                    width: grid.columnWidths[col.id] ?? col.width,
                    textAlign: col.align ?? "left",
                  }}
                >
                  {col.cell
                    ? col.cell({ row, value })
                    : String(value ?? "")}
                </TableCell>
              );
            })}
            {grid.rowActions && (
              <TableCell className="w-[60px]">
                {grid.rowActions(row)}
              </TableCell>
            )}
          </TableRow>
        );
      })}
    </TableBody>
  );
}
