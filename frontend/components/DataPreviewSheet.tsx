"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPipelinePreview } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Download } from "lucide-react";

interface Props {
  pipelineId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Side sheet that shows the last 20 ingested rows for a pipeline.
 * Columns are detected automatically from the first row's keys.
 * A client-side "Download CSV" button exports the visible rows.
 */
export function DataPreviewSheet({ pipelineId, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeline-preview", pipelineId],
    queryFn: () => fetchPipelinePreview(pipelineId!),
    enabled: open && pipelineId !== null,
    staleTime: 30_000,
  });

  // Derive columns from the keys of the first row
  const columns: string[] =
    data?.rows && data.rows.length > 0 ? Object.keys(data.rows[0]) : [];

  function handleDownloadCsv() {
    if (!data || data.rows.length === 0) return;

    const cols = Object.keys(data.rows[0]);
    const header = cols.join(",");
    const body = data.rows
      .map((row) =>
        cols
          .map((c) => {
            const val = row[c];
            const str =
              val === null || val === undefined ? "" : String(val);
            // Quote values that contain commas, quotes, or newlines
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([`${header}\n${body}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.pipeline_name.replace(/\s+/g, "_")}_data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const lastSyncedText =
    data?.last_synced
      ? `Last synced ${formatDistanceToNow(new Date(data.last_synced), { addSuffix: true })}`
      : "Not yet synced";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-xl">
            {isLoading ? "Loading..." : data?.pipeline_name ?? "Data Preview"}
          </SheetTitle>
          {!isLoading && (
            <p className="text-sm text-muted-foreground">{lastSyncedText}</p>
          )}
          {!isLoading && data && data.total_count > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(data.rows.length, 20)} of{" "}
              {data.total_count.toLocaleString()} rows
            </p>
          )}
        </SheetHeader>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive py-4">
            Could not load data. Please try again.
          </p>
        )}

        {!isLoading && !error && data && (
          <>
            {data.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground text-sm">
                  No data yet. Run this pipeline to start ingesting records.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead
                            key={col}
                            className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row, i) => (
                        <TableRow key={i}>
                          {columns.map((col) => {
                            const val = row[col];
                            const display =
                              val === null || val === undefined
                                ? ""
                                : typeof val === "object"
                                ? JSON.stringify(val)
                                : String(val);
                            return (
                              <TableCell
                                key={col}
                                className="text-xs max-w-[200px] truncate"
                                title={display}
                              >
                                {display}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCsv}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
