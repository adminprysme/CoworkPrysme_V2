import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/salle-reunion-a-lheure-lyon",
);

export const metadata = pageMetadata;
export default StubRoutePage;
