import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports("/bureaux-privatifs");

export const metadata = pageMetadata;
export default StubRoutePage;
