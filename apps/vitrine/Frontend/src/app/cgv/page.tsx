import { getLegalPageMeta } from "@/config/legal/meta";
import { CgvContent } from "@/components/legal/CgvContent";
import { createLegalPageMetadata } from "@/lib/legal-page-metadata";

const page = getLegalPageMeta("/cgv")!;

export const metadata = createLegalPageMetadata(page);

export default function CgvPage() {
  return <CgvContent />;
}
