"use client";

import { useState, useTransition } from "react";
import { createChallenge } from "@/actions/challenge";
import { parseMetricInput } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PresetRow {
  enabled: boolean;
  name: string;
  platform: "linkedin" | "medium" | "reddit" | "newsletter" | "other";
  unit: string;
  primaryMetric: string;
  baseline: string;
  target: string;
}

const PRESETS: PresetRow[] = [
  { enabled: true, name: "LinkedIn", platform: "linkedin", unit: "followers", primaryMetric: "followers", baseline: "", target: "5000" },
  { enabled: true, name: "Medium", platform: "medium", unit: "followers", primaryMetric: "followers", baseline: "", target: "5000" },
  { enabled: true, name: "Reddit", platform: "reddit", unit: "karma", primaryMetric: "karma", baseline: "", target: "5000" },
  { enabled: false, name: "Newsletter", platform: "newsletter", unit: "subscribers", primaryMetric: "subscribers", baseline: "", target: "1000" },
];

export function OnboardingWizard({ defaultStartDate }: { defaultStartDate: string }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState("90-Day Creator Sprint");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [pacing, setPacing] = useState<"compounding" | "linear">("compounding");
  const [rows, setRows] = useState<PresetRow[]>(PRESETS);
  const [custom, setCustom] = useState({ enabled: false, name: "", unit: "", direction: "increase" as "increase" | "decrease", baseline: "", target: "" });
  const [pillars, setPillars] = useState("build-in-public, lessons-learned, how-to");
  const [postsPerWeek, setPostsPerWeek] = useState("5");

  function patch(i: number, p: Partial<PresetRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }

  function submit() {
    setError("");
    type TrackablePayload = {
      name: string;
      unit: string;
      primaryMetric: string;
      direction: "increase" | "decrease";
      kind: "platform_account" | "custom";
      platform?: string;
      baseline: number;
      target: number;
    };

    const trackables: TrackablePayload[] = rows
      .filter((r) => r.enabled)
      .map((r) => ({
        name: r.name,
        unit: r.unit,
        primaryMetric: r.primaryMetric,
        direction: "increase",
        kind: "platform_account",
        platform: r.platform,
        baseline: parseMetricInput(r.baseline) ?? 0,
        target: parseMetricInput(r.target) ?? 0,
      }));

    if (custom.enabled && custom.name) {
      trackables.push({
        name: custom.name,
        unit: custom.unit || "units",
        primaryMetric: "value",
        direction: custom.direction,
        kind: "custom",
        baseline: parseMetricInput(custom.baseline) ?? 0,
        target: parseMetricInput(custom.target) ?? 0,
      });
    }

    startTransition(async () => {
      const res = await createChallenge({
        name,
        startDate,
        durationDays: 90,
        pacingModel: pacing,
        trackables,
        pillars: pillars.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 8),
        weeklyPostTarget: parseMetricInput(postsPerWeek) ?? undefined,
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Setup · step {step + 1} of 3
      </p>

      {step === 0 && (
        <div className="mt-2 space-y-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Name the sprint</h1>
          <Card><CardContent className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="cname">Challenge name</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cstart">Day 1</Label>
              <Input id="cstart" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pace curve</Label>
              <div className="flex gap-2">
                {(["compounding", "linear"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPacing(p)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-left text-sm",
                      pacing === p ? "border-accent bg-accent/5" : "border-line"
                    )}
                  >
                    <span className="font-medium capitalize">{p}</span>
                    <span className="block text-xs text-muted">
                      {p === "compounding" ? "Slow start, steep finish — how audiences actually grow" : "Same amount every day"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Next: platforms</Button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-2 space-y-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">What are we growing?</h1>
          <p className="text-sm text-muted">Baseline = today&apos;s number. Open each app and copy it in.</p>
          {rows.map((r, i) => (
            <Card key={r.name} className={cn(!r.enabled && "opacity-50")}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.name}</p>
                  <button
                    type="button"
                    onClick={() => patch(i, { enabled: !r.enabled })}
                    className="text-xs text-accent hover:underline"
                  >
                    {r.enabled ? "Skip this one" : "Track it"}
                  </button>
                </div>
                {r.enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Today ({r.unit})</Label>
                      <Input inputMode="decimal" className="font-mono" value={r.baseline}
                        onChange={(e) => patch(i, { baseline: e.target.value })} placeholder="e.g. 1,247" />
                    </div>
                    <div className="space-y-1">
                      <Label>Day-90 target</Label>
                      <Input inputMode="decimal" className="font-mono" value={r.target}
                        onChange={(e) => patch(i, { target: e.target.value })} />
                    </div>
                    {r.platform === "reddit" && (
                      <div className="col-span-2 flex gap-2 text-xs">
                        {(["karma", "followers"] as const).map((m) => (
                          <button key={m} type="button"
                            onClick={() => patch(i, { primaryMetric: m, unit: m })}
                            className={cn("rounded-full border px-3 py-1",
                              r.primaryMetric === m ? "border-accent bg-accent/10 text-accent" : "border-line text-muted")}>
                            track {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Card className={cn(!custom.enabled && "border-dashed")}>
            <CardContent className="pt-4">
              {custom.enabled ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label>Custom trackable</Label>
                    <Input placeholder="e.g. Body weight" value={custom.name}
                      onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit</Label>
                    <Input placeholder="kg" value={custom.unit}
                      onChange={(e) => setCustom((c) => ({ ...c, unit: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Direction</Label>
                    <div className="flex gap-1">
                      {(["increase", "decrease"] as const).map((d) => (
                        <button key={d} type="button"
                          onClick={() => setCustom((c) => ({ ...c, direction: d }))}
                          className={cn("flex-1 rounded-lg border px-2 py-2 text-xs capitalize",
                            custom.direction === d ? "border-accent bg-accent/5" : "border-line")}>
                          {d === "increase" ? "↑ grow" : "↓ reduce"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Today</Label>
                    <Input inputMode="decimal" className="font-mono" value={custom.baseline}
                      onChange={(e) => setCustom((c) => ({ ...c, baseline: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Day-90 target</Label>
                    <Input inputMode="decimal" className="font-mono" value={custom.target}
                      onChange={(e) => setCustom((c) => ({ ...c, target: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <button type="button" className="w-full py-2 text-sm text-muted hover:text-ink"
                  onClick={() => setCustom((c) => ({ ...c, enabled: true }))}>
                  + Add anything else with a number (weight, savings, words written…)
                </button>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(2)}>Next: content pillars</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-2 space-y-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Content pillars</h1>
          <p className="text-sm text-muted">
            The 2–4 themes you&apos;ll keep returning to. Comma-separated; editable later.
          </p>
          <Card><CardContent className="space-y-4 pt-4">
            <Input value={pillars} onChange={(e) => setPillars(e.target.value)} />
            <div className="space-y-1.5 border-t border-line pt-4">
              <Label htmlFor="ppw">Publishing target (posts per week, all platforms)</Label>
              <Input id="ppw" inputMode="numeric" className="w-24 font-mono" value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(e.target.value)} />
            </div>
          </CardContent></Card>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button variant="accent" className="flex-1" disabled={pending} onClick={submit}>
              {pending ? "Creating…" : "Start Day 1"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
