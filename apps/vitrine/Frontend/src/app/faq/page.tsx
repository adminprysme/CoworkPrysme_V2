import { FaqPageContent } from "@/components/faq/FaqPageContent";
import { FAQ_PAGE_SEO } from "@/config/faq-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(FAQ_PAGE_SEO);

export default function FaqPage() {
  return <FaqPageContent />;
}
