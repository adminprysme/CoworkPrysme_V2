import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports("/avis");

export const metadata = pageMetadata;
export default StubRoutePage;
