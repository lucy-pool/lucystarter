import type { ReactNode } from "react";

// ─── Sorting ────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export interface SortingState {
  id: string;
  direction: SortDirection;
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

// ─── Selection ──────────────────────────────────────────────────────────────

export type RowSelectionState = Set<string>;

// ─── Column Filters ─────────────────────────────────────────────────────────

export type ColumnFilterValue = string;
export type ColumnFiltersState = Record<string, ColumnFilterValue>;

// ─── Column Visibility ──────────────────────────────────────────────────────

export type ColumnVisibilityState = Record<string, boolean>;

// ─── Column Widths ──────────────────────────────────────────────────────────

export type ColumnWidthsState = Record<string, number>;

// ─── Column Definition ──────────────────────────────────────────────────────

export type FilterType = "text" | "number" | "date" | "enum";

export interface CellContext<TData> {
  row: TData;
  value: unknown;
}

export interface ColumnDef<TData> {
  id: string;
  header?: string | (() => ReactNode);
  cell?: (ctx: CellContext<TData>) => ReactNode;
  accessorFn?: (row: TData) => unknown;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: FilterType;
  filterOptions?: string[];
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
  hideable?: boolean;
  resizable?: boolean;
}

// ─── DataGrid Props ─────────────────────────────────────────────────────────

export interface DataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  getRowId: (row: TData) => string;

  // Sorting (controlled/uncontrolled)
  sorting?: SortingState | null;
  onSortingChange?: (sorting: SortingState | null) => void;
  defaultSorting?: SortingState | null;

  // Pagination (controlled/uncontrolled)
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  defaultPageSize?: number;
  pageSizeOptions?: number[];

  // Selection (controlled/uncontrolled)
  selection?: RowSelectionState;
  onSelectionChange?: (selection: RowSelectionState) => void;

  // Global filter (controlled/uncontrolled)
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;

  // Column filters (controlled/uncontrolled)
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;

  // Column visibility (controlled/uncontrolled)
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (visibility: ColumnVisibilityState) => void;

  // Column widths (controlled/uncontrolled)
  columnWidths?: ColumnWidthsState;
  onColumnWidthsChange?: (widths: ColumnWidthsState) => void;

  // Feature toggles
  enableSelection?: boolean;
  enableGlobalFilter?: boolean;
  enableColumnFilters?: boolean;
  enableColumnVisibility?: boolean;
  enableColumnResize?: boolean;

  // Slots
  toolbarActions?: ReactNode;
  rowActions?: (row: TData) => ReactNode;
  emptyState?: ReactNode;

  // UI
  loading?: boolean;
  hideToolbar?: boolean;
  className?: string;
}

// ─── UseDataGrid return type ────────────────────────────────────────────────

export interface UseDataGridReturn<TData> {
  // Data
  processedData: TData[];
  paginatedData: TData[];

  // Columns
  visibleColumns: ColumnDef<TData>[];
  allColumns: ColumnDef<TData>[];

  // Sorting
  sorting: SortingState | null;
  handleSort: (columnId: string) => void;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];

  // Selection
  selectedRows: RowSelectionState;
  toggleRow: (id: string) => void;
  toggleAllRows: () => void;
  allSelected: boolean;
  someSelected: boolean;

  // Global filter
  globalFilter: string;
  setGlobalFilter: (value: string) => void;

  // Column filters
  columnFilters: ColumnFiltersState;
  setColumnFilter: (columnId: string, value: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;

  // Column visibility
  columnVisibility: ColumnVisibilityState;
  toggleColumnVisibility: (columnId: string) => void;

  // Column widths
  columnWidths: ColumnWidthsState;
  handleResize: (columnId: string, diff: number) => void;

  // Reset
  resetAll: () => void;

  // Props passthrough
  getRowId: (row: TData) => string;
  enableSelection: boolean;
  enableGlobalFilter: boolean;
  enableColumnFilters: boolean;
  enableColumnVisibility: boolean;
  enableColumnResize: boolean;
  rowActions?: (row: TData) => ReactNode;
  emptyState?: ReactNode;
  toolbarActions?: ReactNode;
  loading?: boolean;
}
