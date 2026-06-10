import { classifyPace, type DailyProgressRow, type Trackable } from "@/lib/domain/types";
import { fmtDelta, fmtNumber } from "@/lib/domain/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const paceLabel: Record<string, string> = {
  ahead: "Ahead of pace",
  on_track: "On track",
  recoverable: "Recoverable",
  recalibrate: "Recalibrate?",
};

export function TrackableCard({
  trackable,
  latest,
}: {
  trackable: Trackable;
  latest: DailyProgressRow | null;
}) {
  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{trackable.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          No entries yet. Baseline {fmtNumber(trackable.baseline_value)} → target{" "}
          {fmtNumber(trackable.target_value)} {trackable.unit}.
        </CardContent>
      </Card>
    );
  }

  const state = classifyPace(latest);
  const gap = latest.value - latest.pace_target;
  const dec = trackable.direction === "decrease";
  const gapGood = dec ? gap <= 0 : gap >= 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{trackable.name}</CardTitle>
        <Badge tone={state}>{paceLabel[state]}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium tabular-nums">{fmtNumber(latest.value)}</span>
          <span className="text-xs text-muted">{trackable.unit}</span>
          {latest.delta !== null && (
            <span className={`font-mono text-xs tabular-nums ${(dec ? -1 : 1) * latest.delta >= 0 ? "text-accent" : "text-warn"}`}>
              {fmtDelta(latest.delta)} today
            </span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted">Pace says</dt>
            <dd className="font-mono text-sm tabular-nums">{fmtNumber(latest.pace_target)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted">Gap</dt>
            <dd className={`font-mono text-sm tabular-nums ${gapGood ? "text-accent" : "text-warn"}`}>
              {fmtDelta(gap)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted">Need /day</dt>
            <dd className="font-mono text-sm tabular-nums">
              {latest.required_velocity !== null ? fmtDelta(latest.required_velocity) : "—"}
            </dd>
          </div>
        </dl>

        {latest.velocity_7d !== null && (
          <p className="mt-2 text-[11px] text-muted">
            Last 7 days: <span className="font-mono tabular-nums">{fmtDelta(latest.velocity_7d)}/day</span>
            {latest.required_velocity !== null && (
              <> · needs <span className="font-mono tabular-nums">{fmtDelta(latest.required_velocity)}/day</span> to land the target</>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
