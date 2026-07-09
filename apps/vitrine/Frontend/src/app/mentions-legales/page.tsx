import { getLegalPageMeta } from "@/config/legal/meta";
import { MentionsLegalesContent } from "@/components/legal/MentionsLegalesContent";
import { createLegalPageMetadata } from "@/lib/legal-page-metadata";

const page = getLegalPageMeta("/mentions-legales")!;

export const metadata = createLegalPageMetadata(page);

export default function MentionsLegalesPage() {
  return <MentionsLegalesContent />;
}
