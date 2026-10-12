import { DEMAND_GRID, DemandCardSkeleton } from "@/components/vendor/DemandBoard";

export default function DemandLoading() {
  return <main className="min-w-0 p-4 sm:p-6" aria-busy="true" aria-label="Loading customer demand">
    <div className="mb-5"><div className="h-8 w-56 animate-pulse rounded bg-neutral-200" /><div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-neutral-100" /></div>
    <div className={DEMAND_GRID}>{Array.from({ length: 6 }, (_, index) => <DemandCardSkeleton key={index} />)}</div>
  </main>;
}
