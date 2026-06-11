"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveQuickLog } from "@/actions/metrics";
import { parseMetricInput } from "@/lib/domain/schemas";
import type { MetricType, Trackable } from "@/lib/domain/types";
import { useQuickLogQueue } from "@/lib/hooks/use-quick-log-queue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Leading-indicator fields by platform (creator module defaults).
const ACTIVITY_FIELDS: Record<string, { key: string; label: string }[]> = {
  linkedin: [
    { key: "comments_made", label: "Comments made" },
    { key: "connections_sent", label: "Connection requests" },
  ],
  reddit: [{ key: "replies_made", label: "Replies posted" }],
};

interface Props {
  challengeId: string;
  today: string;
  trackables: Trackable[];
  todayValues: { trackableId: string; metricType: MetricType; value: number }[];
  lastKnown: Record<string, { value: number; date: string }>;
  todayActivities: { trackableId: string; activityKey: string; count: number }[];
}

export function QuickLogForm({
  challengeId,
  today,
  trackables,
  todayValues,
  lastKnown,
  todayActivities,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { enqueue, queued } = useQuickLogQueue();

  const initialValues = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of trackables) {
      const existing = todayValues.find(
        (v) => v.trackableId === t.id && v.metricType === t.primary_metric
      );
      const prior = lastKnown[`${t.id}:${t.primary_metric}`];
      m[t.id] = existing ? String(existing.value) : prior ? String(prior.value) : "";
    }
    return m;
  }, [trackables, todayValues, lastKnown]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [acts, setActs] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const a of todayActivities) m[`${a.trackableId}:${a.activityKey}`] = String(a.count);
    return m;
  });
  const [error, setError] = useState("");
  const [outlierPrompt, setOutlierPrompt] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function buildPayload(confirmed: boolean) {
    const snapshots = trackables
      .map((t) => {
        const parsed = parseMetricInput(values[t.id] ?? "");
        return parsed === null
          ? null
          : { trackableId: t.id, metricType: t.primary_metric, value: parsed };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const activities = Object.entries(acts)
      .map(([k, v]) => {
        const n = parseMetricInput(v);
        if (n === null) return null;
        const [trackableId, activityKey] = k.split(":");
        return { trackableId, activityKey, count: n };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    return {
      challengeId,
      localDate: today,
      snapshots,
      activities,
      outlierConfirmed: confirmed,
      clientToken: crypto.randomUUID(),
    };
  }

  function submit(confirmed = false) {
    setError("");
    setOutlierPrompt(null);
    const payload = buildPayload(confirmed);
    if (payload.snapshots.length === 0) {
      setError("Enter at least one number.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveQuickLog(payload);
        if (!res.ok) {
          if (res.code === "outlier_confirm") setOutlierPrompt(res.error);
          else setError(res.error);
          return;
        }
        setSavedFlash(true);
        setTimeout(() => router.push("/dashboard"), 500);
      } catch {
        // network failure → queue for replay, keep going offline-first
        enqueue(payload);
        setSavedFlash(true);
        setTimeout(() => router.push("/dashboard"), 500);
      }
    });
  }

  return (
    <div className="space-y-4">
      {queued > 0 && (
        <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
          {queued} earlier {queued === 1 ? "entry is" : "entries are"} saved on this device and will
          sync when you&apos;re back online.
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 pt-4">
          {trackables.map((t) => {
            const prior = lastKnown[`${t.id}:${t.primary_metric}`];
            return (
              <div key={t.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor={`v-${t.id}`}>{t.name}</Label>
                  {prior && !(values[t.id] ?? "") && (
                    <span className="font-mono text-[11px] tabular-nums text-muted">
                      last: {prior.value.toLocaleString("en-IN")} ({prior.date.slice(5)})
                    </span>
                  )}
                </div>
                <Input
                  id={`v-${t.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus={trackables.indexOf(t) === 0}
                  placeholder={prior ? String(prior.value) : `${t.unit}`}
                  value={values[t.id] ?? ""}
                  onChange={(e) => setValues((m) => ({ ...m, [t.id]: e.target.value }))}
                  className="h-12 font-mono text-lg"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Only render activity card if there are actual fields to show */}
      {trackables.some((t) => {
        const platform = (t.config as { platform?: string }).platform ?? "";
        return (ACTIVITY_FIELDS[platform] ?? []).length > 0;
      }) && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Inputs (what you did today)
            </p>
            {trackables.flatMap((t) => {
              const platform = (t.config as { platform?: string }).platform ?? "";
              return (ACTIVITY_FIELDS[platform] ?? []).map((f) => (
                <div key={`${t.id}:${f.key}`} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`a-${t.id}-${f.key}`} className="text-sm font-normal text-ink">
                    {f.label}
                  </Label>
                  <Input
                    id={`a-${t.id}-${f.key}`}
                    inputMode="numeric"
                    className="h-10 w-28 text-right font-mono text-base"
                    value={acts[`${t.id}:${f.key}`] ?? ""}
                    onChange={(e) =>
                      setActs((m) => ({ ...m, [`${t.id}:${f.key}`]: e.target.value }))
                    }
                  />
                </div>
              ));
            })}
          </CardContent>
        </Card>
      )}

      {outlierPrompt && (
        <div className="space-y-2 rounded-xl border border-warn/40 bg-warn/5 p-3">
          <p className="text-sm">{outlierPrompt}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOutlierPrompt(null)}>
              Let me fix it
            </Button>
            <Button size="sm" onClick={() => submit(true)} disabled={pending}>
              Yes, save it
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || savedFlash}
        onClick={() => submit(false)}
      >
        {savedFlash ? "Saved ✓" : pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
