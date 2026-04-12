"use client";

import { useState } from "react";
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
// Types
// ---------------------------------------------------------------------------

type SourceType = "rest_api" | "postgresql" | "csv";

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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConnectionConfig(form: FormState): Record<string, string> {
  if (form.source_type === "rest_api") {
    return { url: form.url, api_key: form.api_key };
  }
  if (form.source_type === "postgresql") {
    return {
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.db_username,
      password: form.db_password,
    };
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

  const mutation = useMutation({
    mutationFn: (payload: PipelineCreatePayload) => createPipeline(payload),
    onSuccess: () => {
      setOpen(false);
      setForm(INITIAL_FORM);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setErrorMessage("Pipeline name is required.");
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
    }
    setOpen(next);
  }

  const isSubmitting = mutation.isPending;

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
            </fieldset>
          )}

          {/* Connection Config — CSV */}
          {form.source_type === "csv" && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              No connection required. Upload your CSV file via the API after the pipeline is created.
            </p>
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
              {isSubmitting ? "Creating..." : "Create Pipeline"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
