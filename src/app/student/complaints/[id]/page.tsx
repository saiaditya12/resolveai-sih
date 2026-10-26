import "../tracking.css";
import "../new/flow.css";
import { complaints } from "@/lib/demo-student";
import { ComplaintDetail } from "@/components/complaints/ComplaintDetail";
export function generateStaticParams() {
  return complaints.map((complaint) => ({ id: complaint.id }));
}
export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ComplaintDetail id={id} />;
}

