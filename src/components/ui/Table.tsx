import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  dense?: boolean;
  rowClassName?: (row: T) => string;
}

export function Table<T>({ columns, rows, rowKey, onRowClick, empty, dense, rowClassName }: TableProps<T>) {
  const pad = dense ? "px-3 py-2" : "px-4 py-3";
  return (
    <div className="w-full overflow-x-auto hb-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
            {columns.map((c) => (
              <th key={c.key} className={`${pad} font-semibold ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-muted">
                {empty ?? "Nimic de afișat."}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-line/70 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-surface" : ""} ${rowClassName?.(r) ?? ""}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`${pad} align-middle ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${c.className ?? ""}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
