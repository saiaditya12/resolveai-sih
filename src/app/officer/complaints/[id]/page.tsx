import { requireRole } from "@/lib/supabase/auth";
import { loadPersistentComplaint } from "@/lib/persistence/api";
import { notFound } from "next/navigation";
import { OfficerCase } from "@/components/officer/OfficerCase";
import { officerSeedCases } from "@/lib/officer-demo";
export function generateStaticParams() {
  return officerSeedCases.map((c) => ({ id: c.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole(["officer"]);
  if (profile && !(await loadPersistentComplaint(id, profile))) notFound();
  return <OfficerCase id={id} />;
}
