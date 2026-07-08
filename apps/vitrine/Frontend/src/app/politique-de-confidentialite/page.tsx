import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports(
  "/politique-de-confidentialite",
);

export const metadata = pageMetadata;
export default StubRoutePage;
