import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/domiciliation-entreprise-lyon-7",
);

export const metadata = pageMetadata;
export default StubRoutePage;
