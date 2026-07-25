import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IdCardsClient } from "./IdCardsClient";

export default async function IdCardsPage() {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) redirect("/login");

  // The student picker is search-driven and fetched lazily on the client so we
  // never have to SSR/load every active student just to render this page.
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">ID / Admit Cards</h1>
        <p className="mt-1 text-stone-500">Select students, then print ten cards per A4 page.</p>
      </div>
      <IdCardsClient />
    </div>
  );
}
