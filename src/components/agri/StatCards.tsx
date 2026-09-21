import { Sprout, Bug, Activity, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  crops: number;
  pests: number;
  active: number;
  alert: boolean;
}

export function StatCards({ crops, pests, active, alert }: Props) {
  const cards = [
    { icon: Sprout, label: "Crops", value: crops, tone: "text-crop" },
    { icon: Bug, label: "Pests", value: pests, tone: "text-pest" },
    { icon: Activity, label: "Active Tracks", value: active, tone: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="panel p-4">
          <div className="flex items-center gap-2 text-xs tracking-widest text-muted-foreground uppercase">
            <c.icon className={cn("h-4 w-4", c.tone)} />
            {c.label}
          </div>
          <div className={cn("font-display mt-2 text-3xl font-bold", c.tone)}>{c.value}</div>
        </div>
      ))}
      <div className={cn("panel p-4", alert && "alert-flash")}>
        <div className="flex items-center gap-2 text-xs tracking-widest text-muted-foreground uppercase">
          <ShieldAlert className={cn("h-4 w-4", alert ? "text-alert" : "text-crop")} />
          Alert
        </div>
        <div
          className={cn(
            "font-display mt-2 text-2xl font-bold",
            alert ? "text-alert" : "text-crop",
          )}
        >
          {alert ? "PEST ALERT" : "NORMAL"}
        </div>
      </div>
    </div>
  );
}
