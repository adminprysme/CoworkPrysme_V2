import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/bureau-sans-engagement-lyon",
);

export const metadata = pageMetadata;
export default StubRoutePage;
