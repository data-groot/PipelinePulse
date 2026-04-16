"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createPipeline, PipelineCreatePayload } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceType = "rest_api" | "postgresql" | "csv";

interface CsvFileState {
  file: File;
  rowCount: number;
}

interface ScheduleOption {
  label: string;
  cron: string;
}

const SCHEDULE_OPTIONS: ScheduleOption[] = [
  { label: "Every 5 min", cron: "*/5 * * * *" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Daily", cron: "0 0 * * *" },
  { label: "Weekly", cron: "0 0 * * 0" },
];

interface FormState {
  name: string;
  source_type: SourceType;
  schedule: string;
  // rest_api
  url: string;
  api_key: string;
  // postgresql
  host: string;
  port: string;
  database: string;
  db_username: string;
  db_password: string;
  pg_query: string;
  pg_table: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  source_type: "rest_api",
  schedule: "*/5 * * * *",
  url: "",
  api_key: "",
  host: "",
  port: "5432",
  database: "",
  db_username: "",
  db_password: "",
  pg_query: "",
  pg_table: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConnectionConfig(form: FormState): Record<string, string> {
  if (form.source_type === "rest_api") {
    return { url: form.url, api_key: form.api_key };
  }
  if (form.source_type === "postgresql") {
    const config: Record<string, string> = {
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.db_username,
      password: form.db_password,
    };
    if (form.pg_query.trim()) config.query = form.pg_query.trim();
    if (form.pg_table.trim()) config.table = form.pg_table.trim();
    return config;
  }
  // csv — no connection config required
  return {};
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onSuccess: () => void;
}

export function CreatePipelineDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // CSV upload state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<CsvFileState | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadResult, setUploadResult] = useState<{
    filename: string;
    rows: number;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: PipelineCreatePayload) => createPipeline(payload),
    onSuccess: async (created) => {
      // If CSV source, upload the file now that we have a pipeline id
      if (form.source_type === "csv" && csvFile) {
        setUploadStatus("uploading");
        try {
          const formData = new FormData();
          formData.append("file", csvFile.file);
          const resp = await fetch(
            `/api/pipelines/${created.id}/upload`,
            { method: "POST", body: formData }
          );
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body?.detail ?? `Upload failed (${resp.status})`);
          }
          const result = await resp.json();
          setUploadResult({ filename: result.filename, rows: result.rows });
          setUploadStatus("done");
          // Brief pause so the user sees the success message before dialog closes
          await new Promise((r) => setTimeout(r, 1200));
        } catch (err: unknown) {
          setUploadStatus("error");
          setErrorMessage(
            err instanceof Error ? err.message : "File upload failed."
          );
          return; // Do not close dialog — let the user see the error
        }
      }

      setOpen(false);
      setForm(INITIAL_FORM);
      setCsvFile(null);
      setCsvError(null);
      setUploadStatus("idle");
      setUploadResult(null);
      setErrorMessage(null);
      onSuccess();
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  function handleChange(
    field: keyof FormState,
    value: string
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage(null);
  }

  // Count rows client-side using FileReader + csv splitting
  async function countCsvRows(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? "";
        // Split on newlines; first line is header
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
        resolve(Math.max(0, lines.length - 1));
      };
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsText(file);
    });
  }

  async function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvError(null);
    setCsvFile(null);
    setUploadStatus("idle");
    setUploadResult(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Only .csv files are accepted.");
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setCsvError("File exceeds the 10 MB limit.");
      return;
    }

    try {
      const rowCount = await countCsvRows(file);
      if (rowCount === 0) {
        setCsvError("CSV file must contain at least one data row.");
        return;
      }
      setCsvFile({ file, rowCount });
    } catch {
      setCsvError("Could not read the file.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setErrorMessage("Pipeline name is required.");
      return;
    }

    if (form.source_type === "csv" && !csvFile) {
      setErrorMessage("Please select a CSV file to upload.");
      return;
    }

    const payload: PipelineCreatePayload = {
      name: form.name.trim(),
      source_type: form.source_type,
      schedule: form.schedule,
      connection_config: buildConnectionConfig(form),
    };

    mutation.mutate(payload);
  }

  // Reset state when the dialog closes without submitting
  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm(INITIAL_FORM);
      setErrorMessage(null);
      setCsvFile(null);
      setCsvError(null);
      setUploadStatus("idle");
      setUploadResult(null);
    }
    setOpen(next);
  }

  const isSubmitting = mutation.isPending || uploadStatus === "uploading";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            Create Pipeline
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Pipeline</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Pipeline Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pipeline-name">Pipeline Name</Label>
            <Input
              id="pipeline-name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Orders Ingest"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Source Type */}
          <div className="space-y-1.5">
            <Label htmlFor="source-type">Source Type</Label>
            <select
              id="source-type"
              value={form.source_type}
              onChange={(e) =>
                handleChange("source_type", e.target.value as SourceType)
              }
              disabled={isSubmitting}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            >
              <option value="rest_api">REST API</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="csv">CSV Upload</option>
            </select>
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule">Schedule</Label>
            <select
              id="schedule"
              value={form.schedule}
              onChange={(e) => handleChange("schedule", e.target.value)}
              disabled={isSubmitting}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            >
              {SCHEDULE_OPTIONS.map((opt) => (
                <option key={opt.cron} value={opt.cron}>
                  {opt.label} — {opt.cron}
                </option>
              ))}
            </select>
          </div>

          {/* Connection Config — REST API */}
          {form.source_type === "rest_api" && (
            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Connection
              </legend>
              <div className="space-y-1.5">
                <Label htmlFor="rest-url">URL</Label>
                <Input
                  id="rest-url"
                  type="text"
                  value={form.url}
                  onChange={(e) => handleChange("url", e.target.value)}
                  placeholder="https://api.example.com/data"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rest-apikey">API Key</Label>
                <Input
                  id="rest-apikey"
                  type="password"
                  value={form.api_key}
                  onChange={(e) => handleChange("api_key", e.target.value)}
                  placeholder="sk-..."
                  disabled={isSubmitting}
                />
              </div>
            </fieldset>
          )}

          {/* Connection Config — PostgreSQL */}
          {form.source_type === "postgresql" && (
            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Connection
              </legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="pg-host">Host</Label>
                  <Input
                    id="pg-host"
                    value={form.host}
                    onChange={(e) => handleChange("host", e.target.value)}
                    placeholder="localhost"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pg-port">Port</Label>
                  <Input
                    id="pg-port"
                    value={form.port}
                    onChange={(e) => handleChange("port", e.target.value)}
                    placeholder="5432"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-database">Database</Label>
                <Input
                  id="pg-database"
                  value={form.database}
                  onChange={(e) => handleChange("database", e.target.value)}
                  placeholder="my_database"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-username">Username</Label>
                <Input
                  id="pg-username"
                  value={form.db_username}
                  onChange={(e) => handleChange("db_username", e.target.value)}
                  placeholder="postgres"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-password">Password</Label>
                <Input
                  id="pg-password"
                  type="password"
                  value={form.db_password}
                  onChange={(e) => handleChange("db_password", e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-query">
                  Custom Query{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional — leave blank to use table name)
                  </span>
                </Label>
                <textarea
                  id="pg-query"
                  rows={3}
                  value={form.pg_query}
                  onChange={(e) => handleChange("pg_query", e.target.value)}
                  placeholder="SELECT * FROM orders LIMIT 1000"
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none dark:bg-input/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-table">
                  Table Name{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional — used if no custom query)
                  </span>
                </Label>
                <Input
                  id="pg-table"
                  value={form.pg_table}
                  onChange={(e) => handleChange("pg_table", e.target.value)}
                  placeholder="orders"
                  disabled={isSubmitting}
                />
              </div>
            </fieldset>
          )}

          {/* Connection Config — CSV */}
          {form.source_type === "csv" && (
            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                CSV File
              </legend>

              {/* Hidden native file input */}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvSelect}
                disabled={isSubmitting}
              />

              {/* Click-to-select area */}
              {!csvFile && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => csvInputRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-input bg-muted/20 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  Click to select a .csv file (max 10 MB)
                </button>
              )}

              {/* File chosen — preview */}
              {csvFile && uploadStatus !== "done" && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium truncate max-w-[220px]">
                      {csvFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {csvFile.rowCount} rows previewed
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvFile(null);
                      if (csvInputRef.current) csvInputRef.current.value = "";
                    }}
                    disabled={isSubmitting}
                    className="ml-3 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Uploading indicator */}
              {uploadStatus === "uploading" && (
                <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  Uploading file...
                </p>
              )}

              {/* Upload success */}
              {uploadStatus === "done" && uploadResult && (
                <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                  File uploaded — {uploadResult.rows} rows ready to ingest
                </p>
              )}

              {/* File-selection error */}
              {csvError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {csvError}
                </p>
              )}
            </fieldset>
          )}

          {/* Inline error */}
          {errorMessage && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {uploadStatus === "uploading"
                ? "Uploading..."
                : mutation.isPending
                ? "Creating..."
                : "Create Pipeline"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
