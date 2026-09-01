import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  header: string;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
};

/**
 * A scrollable, sticky-header table for row-shaped widget data — deploys,
 * payments, issues, sent emails. One shell, columns defined by the caller.
 */
export function DataTable<T>({ data, columns, rowKey }: DataTableProps<T>) {
  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.header}
                className={cn(
                  "h-9",
                  column.align === "right" && "text-right",
                  column.className,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.header}
                  className={cn(
                    "py-2",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
