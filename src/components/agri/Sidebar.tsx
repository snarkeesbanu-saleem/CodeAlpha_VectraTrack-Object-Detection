import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgriClassMapper } from "@/lib/agri";
import type { ClassFilter, TrackingState } from "./useTracking";

const FILTERS: { value: ClassFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "crops", label: "Crops only" },
  { value: "pests", label: "Pests only" },
];

export function Sidebar({ state }: { state: TrackingState }) {
  return (
    <aside className="panel h-fit space-y-6 p-5">
      <div>
        <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">
          Pest alert threshold
        </p>
        <Slider
          value={[state.threshold]}
          min={1}
          max={15}
          step={1}
          onValueChange={([v]) => state.setThreshold(v ?? 5)}
        />
        <p className="font-display mt-2 text-lg">{state.threshold} pests</p>
      </div>

      <div>
        <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">Show</p>
        <div className="flex flex-col gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={state.filter === f.value ? "default" : "outline"}
              className={cn("justify-start")}
              onClick={() => state.setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm">Pest trajectories</span>
        <Switch checked={state.showTrajectory} onCheckedChange={state.setShowTrajectory} />
      </div>

      <div className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <p className="tracking-widest uppercase">Class mapping</p>
        <p>
          <span className="text-crop">🌱 Crop</span> — {AgriClassMapper.crops.join(", ")}
        </p>
        <p>
          <span className="text-pest">🐛 Pest</span> — {AgriClassMapper.pests.join(", ")}
        </p>
        <p>⬛ Ignored — person, car, truck, …</p>
      </div>
    </aside>
  );
}
