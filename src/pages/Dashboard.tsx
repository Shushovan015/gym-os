import { Dumbbell, Flame, CalendarDays, TrendingUp } from "lucide-react";

const stats = [
  { label: "Workouts this week", value: "4", icon: Dumbbell },
  { label: "Calories burned", value: "2,450", icon: Flame },
  { label: "Next session", value: "Today 18:30", icon: CalendarDays },
  { label: "Progress", value: "+8%", icon: TrendingUp },
];

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-300">{label}</div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <Icon className="h-5 w-5 text-zinc-100" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">Updated just now</div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-300">
            Track your training, sessions, and progress in one place.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button className="rounded-xl bg-white text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-100 transition">
            Start workout
          </button>
          <button className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 transition">
            View plan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} Icon={s.icon} />
        ))}
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Weekly overview */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Weekly overview</h2>
            <span className="text-xs text-zinc-400">Last 7 days</span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-black/30 p-3 text-center"
              >
                <div className="text-xs text-zinc-400">{d}</div>
                <div className="mt-2 h-12 rounded-lg bg-white/10" />
                <div className="mt-2 text-xs text-zinc-300">—</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-sm text-zinc-300">
            Tip: Consistency beats intensity. Aim for 3–5 sessions/week.
          </div>
        </div>

        {/* Quick actions / upcoming */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <h2 className="text-base font-semibold">Quick actions</h2>

          <div className="mt-4 space-y-3">
            <button className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left hover:bg-black/40 transition">
              <div className="text-sm font-medium">Log a workout</div>
              <div className="text-xs text-zinc-400 mt-1">
                Add sets, reps, and notes
              </div>
            </button>

            <button className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left hover:bg-black/40 transition">
              <div className="text-sm font-medium">Create a plan</div>
              <div className="text-xs text-zinc-400 mt-1">
                Build a weekly routine
              </div>
            </button>

            <button className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left hover:bg-black/40 transition">
              <div className="text-sm font-medium">Check progress</div>
              <div className="text-xs text-zinc-400 mt-1">
                Weight, PRs, measurements
              </div>
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-zinc-400">Next up</div>
            <div className="mt-1 text-sm font-medium">Push Day • 18:30</div>
            <div className="mt-1 text-xs text-zinc-400">Chest • Shoulders • Triceps</div>
          </div>
        </div>
      </div>
    </div>
  );
}
