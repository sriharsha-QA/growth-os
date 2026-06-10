"use client";

import { useState, useTransition } from "react";
import { updateProfile, updateTarget } from "@/actions/challenge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TargetRow {
  id: string;
  name: string;
  unit: string;
  direction: "increase" | "decrease";
  baseline: number;
  target: number;
}

export function SettingsForm(props: {
  displayName: string;
  timezone: string;
  dayRolloverHour: string;
  trackables: TargetRow[];
}) {
  const [displayName, setDisplayName] = useState(props.displayName);
  const [timezone, setTimezone] = useState(props.timezone);
  const [rollover, setRollover] = useState(props.dayRolloverHour);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  function save() {
    setMsg("");
    startTransition(async () => {
      const res = await updateProfile({ displayName, timezone, dayRolloverHour: rollover });
      setMsg(res.ok ? "Saved." : res.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz">Timezone (IANA)</Label>
            <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ro">Day rolls over at</Label>
            <Input id="ro" type="time" value={rollover} onChange={(e) => setRollover(e.target.value)} className="w-32" />
            <p className="text-xs text-muted">
              Log at 1 a.m.? With a 04:00 rollover it still counts as yesterday. Changing this
              applies from now on — past days keep their dates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            {msg && <span className="text-xs text-muted">{msg}</span>}
          </div>
        </CardContent>
      </Card>

      {props.trackables.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Targets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted">
              Recalibrating is allowed — every change is recorded, and pace recomputes from the
              new target. Changing the number doesn&apos;t change the work.
            </p>
            {props.trackables.map((t) => (
              <TargetEditor key={t.id} row={t} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Your data</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted">
            Everything you&apos;ve logged, in open formats. No lock-in — this is the product&apos;s
            escape hatch and its backup.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => (location.href = "/api/export?format=json")}>
              Download JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => (location.href = "/api/export?format=csv")}>
              Download CSV (snapshots)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TargetEditor({ row }: { row: TargetRow }) {
  const [value, setValue] = useState(String(row.target));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const dirty = Number(value) !== row.target && value !== "";

  function save() {
    setMsg("");
    startTransition(async () => {
      const res = await updateTarget({ trackableId: row.id, target: Number(value) });
      setMsg(res.ok ? "Updated." : res.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="font-mono text-[11px] tabular-nums text-muted">
          from {row.baseline.toLocaleString("en-IN")} {row.unit} {row.direction === "decrease" ? "↓" : "↑"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          className="h-9 w-28 text-right font-mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {dirty && (
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>
            {pending ? "…" : "Update"}
          </Button>
        )}
        {msg && <span className="text-[11px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}
