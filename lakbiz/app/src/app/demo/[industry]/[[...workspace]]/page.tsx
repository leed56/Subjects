import { notFound } from "next/navigation";
import { DemoWorkspace } from "@/components/demo/demo-workspace";
import {
  INDUSTRY_TEMPLATES,
  industryTemplate,
  WORKSPACES,
} from "@/lib/erp/industry-templates";
export function generateStaticParams() {
  return INDUSTRY_TEMPLATES.flatMap((t) => [
    { industry: t.id, workspace: [] },
    ...WORKSPACES.map((w) => ({ industry: t.id, workspace: [w.id] })),
  ]);
}
export default async function IndustryDemoPage({
  params,
}: {
  params: Promise<{ industry: string; workspace?: string[] }>;
}) {
  const { industry, workspace } = await params;
  const template = industryTemplate(industry),
    page = workspace?.[0] ?? "overview";
  if (
    !template ||
    (workspace && workspace.length > 1) ||
    !WORKSPACES.some((w) => w.id === page)
  )
    notFound();
  return (
    <DemoWorkspace
      key={industry}
      template={template}
      workspace={page as (typeof WORKSPACES)[number]["id"]}
    />
  );
}
