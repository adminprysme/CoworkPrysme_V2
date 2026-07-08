import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/coworking-lyon-7-jean-mace",
);

export const metadata = pageMetadata;
export default StubRoutePage;
