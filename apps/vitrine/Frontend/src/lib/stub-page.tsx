import { StubPage } from "@/components/ui/StubPage";
import { createPageMetadata } from "@/lib/metadata";
import { getStubPage } from "@/config/site";

export function createStubPageExports(path: string) {
  const page = getStubPage(path);
  if (!page) {
    throw new Error(`Unknown stub page path: ${path}`);
  }

  const pageConfig = page;
  const metadata = createPageMetadata({
    title: pageConfig.title,
    description: pageConfig.description,
    path: pageConfig.path,
    noIndex: pageConfig.noIndex,
  });

  function Page() {
    return (
      <StubPage title={pageConfig.h1 ?? pageConfig.title} description={pageConfig.description} />
    );
  }

  return { metadata, Page };
}
