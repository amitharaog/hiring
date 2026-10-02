import { CandidateDetail } from "@/components/hiring/CandidateDetail";

export default async function CandidatePage({ params }: PageProps<"/hiring/candidate/[id]">) {
  const { id } = await params;
  return <CandidateDetail id={id} />;
}
