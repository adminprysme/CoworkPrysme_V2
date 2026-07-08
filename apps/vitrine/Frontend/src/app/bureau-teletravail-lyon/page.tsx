import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/bureau-teletravail-lyon",
);

export const metadata = pageMetadata;
export default StubRoutePage;
