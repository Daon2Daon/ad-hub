interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
}

export const KpiCard = ({ title, value, description }: KpiCardProps) => (
  <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
    <span className="text-xs font-medium text-slate-500 md:text-sm">{title}</span>
    <span className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">{value}</span>
    {description ? <p className="mt-3 text-xs text-slate-500 md:text-sm">{description}</p> : null}
  </section>
);
