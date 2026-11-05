export default function ErpLoading() {
  return (
    <main className="min-h-screen bg-cloud p-6 text-ink">
      <p role="status" aria-busy="true" className="mx-auto max-w-7xl rounded-md bg-surface px-5 py-4 text-sm text-muted">
        Loading your workspace…
      </p>
    </main>
  );
}
