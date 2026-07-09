import { getLegalPageMeta } from "@/config/legal/meta";
import { PolitiqueConfidentialiteContent } from "@/components/legal/PolitiqueConfidentialiteContent";
import { createLegalPageMetadata } from "@/lib/legal-page-metadata";

const page = getLegalPageMeta("/politique-de-confidentialite")!;

export const metadata = createLegalPageMetadata(page);

export default function PolitiqueConfidentialitePage() {
  return <PolitiqueConfidentialiteContent />;
}
