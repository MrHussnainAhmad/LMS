"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "./input";
import { EmptyState } from "./empty-state";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKey?: keyof T;
  searchPlaceholder?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Search...",
  emptyStateTitle = "No data found",
  emptyStateDescription = "Get started by creating a new record.",
  onRowClick,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = React.useMemo(() => {
    if (!searchKey || !searchQuery) return data;
    return data.filter((item) => {
      const val = item[searchKey];
      return String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data, searchKey, searchQuery]);

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key: keyof T) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null; // toggle off
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="w-full space-y-4">
      {searchKey && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-md border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-stone-500 bg-stone-50 uppercase border-b border-border sticky top-0">
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-6 py-3 font-medium tracking-wider",
                      col.sortable && "cursor-pointer hover:bg-stone-100 transition-colors"
                    )}
                    onClick={() => col.sortable && col.accessorKey && handleSort(col.accessorKey)}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && col.accessorKey && sortConfig?.key === col.accessorKey && (
                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedData.length > 0 ? (
                sortedData.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={cn(
                      "bg-surface transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-stone-50 hover:shadow-sm" : "hover:bg-stone-50/50"
                    )}
                  >
                    {columns.map((col, i) => (
                      <td key={i} className="px-6 py-4 whitespace-nowrap">
                        {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? '') : ''}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <EmptyState
                      title={emptyStateTitle}
                      description={emptyStateDescription}
                      className="border-none bg-transparent"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
