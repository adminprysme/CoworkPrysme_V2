import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/location-bureaux-equipes-lyon",
);

export const metadata = pageMetadata;
export default StubRoutePage;
