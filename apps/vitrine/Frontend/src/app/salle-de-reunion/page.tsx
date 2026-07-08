import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } = createStubPageExports("/salle-de-reunion");

export const metadata = pageMetadata;
export default StubRoutePage;
