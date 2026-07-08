import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports("/faq");

export const metadata = pageMetadata;
export default StubRoutePage;
