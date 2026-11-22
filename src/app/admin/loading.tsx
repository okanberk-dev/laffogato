/**
 * The panel's page skeleton while a page loads (admin audit SHE-12).
 *
 * Every admin page is dynamic and reads Postgres on each request, and a
 * click on the sidebar used to show nothing until the server answered:
 * operators clicked again or thought the panel had frozen. This sits inside
 * admin/layout.tsx, so the sidebar and the top bar stay put and only the
 * page area turns into the skeleton. The pulse stops under reduced motion.
 */
export default function AdminLoading() {
  const block = "rounded-xl bg-[var(--admin-neutral-soft)]";
  return (
    <main
      aria-busy="true"
      className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6"
    >
      <p role="status" className="sr-only">
        Sayfa yükleniyor
      </p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-8 flex flex-col gap-3">
          <div className="h-3 w-32 rounded-full bg-[var(--admin-neutral-soft)]" />
          <div className="h-8 w-64 max-w-full rounded-lg bg-[var(--admin-neutral-soft)]" />
          <div className="h-4 w-96 max-w-full rounded-full bg-[var(--admin-neutral-soft)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`h-24 ${block}`} />
          <div className={`h-24 ${block}`} />
          <div className={`h-24 ${block}`} />
        </div>
        <div className={`mt-6 h-72 ${block}`} />
      </div>
    </main>
  );
}
