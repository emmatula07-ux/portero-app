import VisitorFlow from "@/components/VisitorFlow";

export default async function AccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VisitorFlow token={token} />;
}
