import { AppSectionRouter } from "@/components/crm/section-router";

export default function AppSlugPage({ params }: { params: { slug?: string[] } }) {
  return <AppSectionRouter slug={params.slug} />;
}
