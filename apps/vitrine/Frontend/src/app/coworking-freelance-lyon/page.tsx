import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/coworking-freelance-lyon",
);

export const metadata = pageMetadata;
export default StubRoutePage;
