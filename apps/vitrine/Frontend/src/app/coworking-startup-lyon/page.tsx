import { createStubPageExports } from "@/lib/stub-page";

const { metadata: pageMetadata, Page: StubRoutePage } =
  createStubPageExports("/coworking-startup-lyon");

export const metadata = pageMetadata;
export default StubRoutePage;
