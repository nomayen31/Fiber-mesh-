/**
 * CSV serialisation with an Excel-friendly UTF-8 BOM so Bengali text opens
 * correctly in Microsoft Excel (which otherwise shows mojibake).
 */

export type CsvColumn<T> = {
  /** Key of the source object (or a getter for computed values). */
  key: keyof T | string;
  /** Column header written to the file. */
  label: string;
  /** Optional custom cell renderer. */
  value?: (row: T) => string | number | null | undefined;
};

function escapeCell(input: unknown): string {
  if (input === null || input === undefined) return "";
  const value = String(input);
  // Quote when the value contains a delimiter, quote or newline.
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv<T extends Record<string, unknown>>(
  columns: CsvColumn<T>[],
  rows: T[],
): string {
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const raw = column.value
          ? column.value(row)
          : (row as Record<string, unknown>)[String(column.key)];
        return escapeCell(raw);
      })
      .join(","),
  );
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}

/** `fiber-mesh-orders-2026-10-17.csv` */
export function csvFileName(prefix: string, date: Date = new Date()): string {
  return `${prefix}-${date.toISOString().slice(0, 10)}.csv`;
}
