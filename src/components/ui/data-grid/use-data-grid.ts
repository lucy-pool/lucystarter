"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnVisibilityState,
  ColumnWidthsState,
  DataGridProps,
  PaginationState,
  RowSelectionState,
  SortingState,
  UseDataGridReturn,
} from "./types";

export function useDataGrid<TData>(
  props: DataGridProps<TData>
): UseDataGridReturn<TData> {
  const {
    data,
    columns,
    getRowId,
    defaultPageSize = 10,
    pageSizeOptions = [5, 10, 20, 50],
    enableSelection = false,
    enableGlobalFilter = true,
    enableColumnFilters = false,
    enableColumnVisibility = true,
    enableColumnResize = true,
    rowActions,
    emptyState,
    toolbarActions,
    loading,
  } = props;

  // ── Sorting (controlled/uncontrolled) ──
  const [internalSorting, setInternalSorting] = useState<SortingState | null>(
    props.defaultSorting ?? null
  );
  const sorting =
    props.sorting !== undefined ? props.sorting : internalSorting;
  const setSorting = props.onSortingChange ?? setInternalSorting;

  const handleSort = useCallback(
    (columnId: string) => {
      if (sorting?.id === columnId) {
        if (sorting.direction === "asc") {
          setSorting({ id: columnId, direction: "desc" });
        } else {
          setSorting(null);
        }
      } else {
        setSorting({ id: columnId, direction: "asc" });
      }
    },
    [sorting, setSorting]
  );

  // ── Pagination (controlled/uncontrolled) ──
  const [internalPagination, setInternalPagination] = useState<PaginationState>(
    { pageIndex: 0, pageSize: defaultPageSize }
  );
  const pagination = props.pagination ?? internalPagination;
  const setPagination = props.onPaginationChange ?? setInternalPagination;

  const setPage = useCallback(
    (page: number) => setPagination({ ...pagination, pageIndex: page }),
    [pagination, setPagination]
  );
  const setPageSize = useCallback(
    (size: number) => setPagination({ pageIndex: 0, pageSize: size }),
    [setPagination]
  );

  // ── Selection (controlled/uncontrolled) ──
  const [internalSelection, setInternalSelection] =
    useState<RowSelectionState>(new Set());
  const selectedRows = props.selection ?? internalSelection;
  const setSelectedRows = props.onSelectionChange ?? setInternalSelection;

  // ── Global filter (controlled/uncontrolled) ──
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");
  const globalFilter =
    props.globalFilter !== undefined
      ? props.globalFilter
      : internalGlobalFilter;
  const setGlobalFilter =
    props.onGlobalFilterChange ?? setInternalGlobalFilter;

  // ── Column filters (controlled/uncontrolled) ──
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>({});
  const columnFilters = props.columnFilters ?? internalColumnFilters;
  const setColumnFilters =
    props.onColumnFiltersChange ?? setInternalColumnFilters;
  const [showFilters, setShowFilters] = useState(false);

  const setColumnFilter = useCallback(
    (columnId: string, value: string) => {
      setColumnFilters({ ...columnFilters, [columnId]: value });
    },
    [columnFilters, setColumnFilters]
  );

  // ── Column visibility (controlled/uncontrolled) ──
  const [internalVisibility, setInternalVisibility] =
    useState<ColumnVisibilityState>({});
  const columnVisibility = props.columnVisibility ?? internalVisibility;
  const setColumnVisibility =
    props.onColumnVisibilityChange ?? setInternalVisibility;

  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      const current = columnVisibility[columnId] ?? true;
      setColumnVisibility({ ...columnVisibility, [columnId]: !current });
    },
    [columnVisibility, setColumnVisibility]
  );

  // ── Column widths (controlled/uncontrolled) ──
  const defaultWidths = useMemo(
    () =>
      Object.fromEntries(
        columns.map((c) => [c.id, c.width ?? 150])
      ),
    [columns]
  );
  const [internalWidths, setInternalWidths] =
    useState<ColumnWidthsState>(defaultWidths);
  const columnWidths = props.columnWidths ?? internalWidths;
  const setColumnWidths = props.onColumnWidthsChange ?? setInternalWidths;

  const handleResize = useCallback(
    (columnId: string, diff: number) => {
      const col = columns.find((c) => c.id === columnId);
      const minWidth = col?.minWidth ?? 60;
      setColumnWidths({
        ...columnWidths,
        [columnId]: Math.max(minWidth, (columnWidths[columnId] ?? 150) + diff),
      });
    },
    [columnWidths, setColumnWidths, columns]
  );

  // ── Visible columns ──
  const visibleColumns = useMemo(
    () => columns.filter((c) => columnVisibility[c.id] !== false),
    [columns, columnVisibility]
  );

  // ── Accessor helper ──
  const getAccessor = useCallback(
    (col: ColumnDef<TData>) => {
      if (col.accessorFn) return col.accessorFn;
      return (row: TData) => (row as Record<string, unknown>)[col.id];
    },
    []
  );

  // ── Filtering ──
  const filteredData = useMemo(() => {
    let result = data;

    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const val = getAccessor(col)(row);
          return String(val ?? "")
            .toLowerCase()
            .includes(q);
        })
      );
    }

    const activeFilters = Object.entries(columnFilters).filter(
      ([, v]) => v !== "" && v !== undefined
    );
    for (const [colId, value] of activeFilters) {
      const col = columns.find((c) => c.id === colId);
      if (!col) continue;
      const accessor = getAccessor(col);
      if (col.filterType === "enum") {
        result = result.filter((row) => String(accessor(row)) === value);
      } else if (col.filterType === "number") {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          result = result.filter((row) => Number(accessor(row)) >= num);
        }
      } else {
        const q = value.toLowerCase();
        result = result.filter((row) =>
          String(accessor(row) ?? "")
            .toLowerCase()
            .includes(q)
        );
      }
    }

    return result;
  }, [data, globalFilter, columnFilters, columns, getAccessor]);

  // ── Sorting ──
  const processedData = useMemo(() => {
    if (!sorting) return filteredData;
    const col = columns.find((c) => c.id === sorting.id);
    if (!col) return filteredData;
    const accessor = getAccessor(col);
    return [...filteredData].sort((a, b) => {
      const aVal = accessor(a);
      const bVal = accessor(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sorting.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sorting.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sorting, columns, getAccessor]);

  // ── Pagination ──
  const totalRows = processedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize));
  const currentPage = pagination.pageIndex;

  const paginatedData = useMemo(() => {
    const start = currentPage * pagination.pageSize;
    return processedData.slice(start, start + pagination.pageSize);
  }, [processedData, currentPage, pagination.pageSize]);

  // Reset page when filters change
  useEffect(() => {
    if (currentPage > 0 && currentPage >= totalPages) {
      setPage(0);
    }
  }, [totalPages, currentPage, setPage]);

  // ── Selection ──
  const allSelected =
    paginatedData.length > 0 &&
    paginatedData.every((r) => selectedRows.has(getRowId(r)));
  const someSelected =
    paginatedData.some((r) => selectedRows.has(getRowId(r))) && !allSelected;

  const toggleAllRows = useCallback(() => {
    const next = new Set(selectedRows);
    if (allSelected) {
      paginatedData.forEach((r) => next.delete(getRowId(r)));
    } else {
      paginatedData.forEach((r) => next.add(getRowId(r)));
    }
    setSelectedRows(next);
  }, [allSelected, paginatedData, selectedRows, setSelectedRows, getRowId]);

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selectedRows);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelectedRows(next);
    },
    [selectedRows, setSelectedRows]
  );

  // ── Filter helpers ──
  const hasActiveFilters =
    !!globalFilter || Object.values(columnFilters).some((v) => !!v);

  const clearFilters = useCallback(() => {
    setColumnFilters({});
    setGlobalFilter("");
  }, [setColumnFilters, setGlobalFilter]);

  // ── Reset all ──
  const resetAll = useCallback(() => {
    setSorting(null);
    setColumnFilters({});
    setGlobalFilter("");
    setSelectedRows(new Set());
    setColumnVisibility({});
    setColumnWidths(defaultWidths);
    setPagination({ pageIndex: 0, pageSize: defaultPageSize });
    setShowFilters(false);
  }, [
    setSorting,
    setColumnFilters,
    setGlobalFilter,
    setSelectedRows,
    setColumnVisibility,
    setColumnWidths,
    setPagination,
    defaultWidths,
    defaultPageSize,
  ]);

  return {
    processedData,
    paginatedData,
    visibleColumns,
    allColumns: columns,
    sorting,
    handleSort,
    currentPage,
    pageSize: pagination.pageSize,
    totalPages,
    totalRows,
    setPage,
    setPageSize,
    pageSizeOptions,
    selectedRows,
    toggleRow,
    toggleAllRows,
    allSelected,
    someSelected,
    globalFilter,
    setGlobalFilter,
    columnFilters,
    setColumnFilter,
    showFilters,
    setShowFilters,
    hasActiveFilters,
    clearFilters,
    columnVisibility,
    toggleColumnVisibility,
    columnWidths,
    handleResize,
    resetAll,
    getRowId,
    enableSelection,
    enableGlobalFilter,
    enableColumnFilters,
    enableColumnVisibility,
    enableColumnResize,
    rowActions,
    emptyState,
    toolbarActions,
    loading,
  };
}
