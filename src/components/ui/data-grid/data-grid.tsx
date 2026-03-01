"use client";

import type { DataGridProps } from "./types";
import { useDataGrid } from "./use-data-grid";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataGridToolbar } from "./data-grid-toolbar";
import { DataGridHeader } from "./data-grid-header";
import { DataGridBody } from "./data-grid-body";
import { DataGridPagination } from "./data-grid-pagination";

export function DataGrid<TData>(props: DataGridProps<TData>) {
  const grid = useDataGrid(props);

  return (
    <div className={cn("rounded-xl border", props.className)}>
      {!props.hideToolbar && <DataGridToolbar grid={grid} />}
      <Table
        style={{
          minWidth: grid.visibleColumns.reduce(
            (sum, c) => sum + (grid.columnWidths[c.id] ?? c.width ?? 150),
            0
          ) + (grid.enableSelection ? 48 : 0) + (grid.rowActions ? 60 : 0),
        }}
      >
        <DataGridHeader grid={grid} />
        <DataGridBody grid={grid} />
      </Table>
      <DataGridPagination grid={grid} />
    </div>
  );
}
