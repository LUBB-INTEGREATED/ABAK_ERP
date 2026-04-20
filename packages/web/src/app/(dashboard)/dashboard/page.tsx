export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-abak-blue mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        Overview of leads, pipeline, and quotes. Real metrics land in later sprints.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'New leads (MTD)', value: '—' },
          { label: 'Active quotes', value: '—' },
          { label: 'Pipeline value', value: '—' },
          { label: 'Quotes awaiting approval', value: '—' },
        ].map((card) => (
          <div key={card.label} className="card-abak">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-abak-blue">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
