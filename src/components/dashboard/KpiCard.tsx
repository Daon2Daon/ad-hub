interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
}

export const KpiCard = ({ title, value, description }: KpiCardProps) => (
  <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <span className="text-sm font-medium text-slate-500">{title}</span>
    <span className="mt-2 text-3xl font-semibold text-slate-900">{value}</span>
    {description ? <p className="mt-3 text-sm text-slate-500">{description}</p> : null}
  </section>
);
