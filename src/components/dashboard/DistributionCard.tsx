import type { DistributionSlice } from "@/types/dashboard";

const CHART_COLORS = ["#2563eb", "#7c3aed", "#f97316", "#0ea5e9", "#ec4899", "#22c55e"];
const CIRCUMFERENCE = 2 * Math.PI * 36;
const percentageFormatter = new Intl.NumberFormat("ko-KR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

interface DistributionCardProps {
  title: string;
  slices: DistributionSlice[];
  emptyMessage?: string;
}

export const DistributionCard = ({
  title,
  slices,
  emptyMessage = "표시할 데이터가 없습니다.",
}: DistributionCardProps) => {
  const normalizedId = title.toLowerCase().replace(/\s+/g, "-");
  const cardTitleId = `${normalizedId}-title`;
  const descriptionId = `${normalizedId}-description`;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (slices.length === 0 || total === 0) {
    return (
      <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <header className="mb-3 flex items-center justify-between md:mb-4">
          <h2 id={cardTitleId} className="text-base font-semibold text-slate-900 md:text-lg">
            {title}
          </h2>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            도넛 차트
          </span>
        </header>
        <p className="text-xs text-slate-500 md:text-sm">{emptyMessage}</p>
      </section>
    );
  }

  let cumulativeLength = 0;

  const formattedSlices = slices.map((slice, index) => {
    const ratio = slice.value / total;
    const arcLength = CIRCUMFERENCE * ratio;
    const dasharray = `${arcLength} ${Math.max(CIRCUMFERENCE - arcLength, 0)}`;
    const color = CHART_COLORS[index % CHART_COLORS.length];

    const dashoffset = CIRCUMFERENCE - cumulativeLength;
    cumulativeLength += arcLength;

    return {
      ...slice,
      ratio,
      dasharray,
      dashoffset,
      color,
    };
  });

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <header className="mb-3 flex items-center justify-between md:mb-4">
        <h2 id={cardTitleId} className="text-base font-semibold text-slate-900 md:text-lg">
          {title}
        </h2>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <figure
          className="mx-auto flex h-40 w-40 flex-col items-center justify-center md:h-48 md:w-48 md:mx-0"
          role="img"
          aria-labelledby={cardTitleId}
          aria-describedby={descriptionId}
        >
          <svg width="192" height="192" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="36" fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
            {formattedSlices.map((slice) => (
              <circle
                key={slice.label}
                cx="48"
                cy="48"
                r="36"
                fill="transparent"
                stroke={slice.color}
                strokeWidth="12"
                strokeDasharray={slice.dasharray}
                strokeDashoffset={slice.dashoffset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <figcaption className="mt-2 text-center text-xs text-slate-500 md:text-sm" id={descriptionId}>
            총 {currencyFormatter.format(total)}
          </figcaption>
        </figure>

        <ol className="flex-1 space-y-3">
          {formattedSlices.map((slice) => (
            <li
              key={slice.label}
              className="flex flex-col gap-2 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
            >
              <div className="flex items-center gap-2 sm:contents">
                <span
                  aria-hidden
                  className="block h-3 w-3 flex-shrink-0 rounded-full sm:h-3 sm:w-3"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-sm font-medium text-slate-700 sm:text-sm sm:font-normal sm:text-slate-600">
                  {slice.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 sm:contents">
                <span className="text-base font-semibold tabular-nums text-slate-900 sm:min-w-[6.5rem] sm:text-right sm:text-sm">
                  {currencyFormatter.format(slice.value)}
                </span>
                <span className="text-sm font-medium tabular-nums text-slate-500 sm:min-w-[3.5rem] sm:text-right sm:text-xs sm:text-slate-400">
                  {percentageFormatter.format(slice.ratio)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
