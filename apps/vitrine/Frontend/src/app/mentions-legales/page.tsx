import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports("/mentions-legales");

export const metadata = pageMetadata;
export default StubRoutePage;
