import Link from "next/link";

import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  LegalDefinitionList,
  LegalList,
  LegalParagraph,
  LegalSection,
} from "@/components/legal/LegalSection";
import type { TocEntry } from "@/components/legal/LegalTableOfContents";

const TOC: TocEntry[] = [
  { id: "editeur", label: "1. Éditeur du site" },
  { id: "directeur", label: "2. Directeur de la publication" },
  { id: "hebergement", label: "3. Hébergement" },
  { id: "propriete", label: "4. Propriété intellectuelle" },
  { id: "donnees", label: "5. Protection des données personnelles" },
  { id: "cookies", label: "6. Cookies" },
  { id: "responsabilite", label: "7. Limitation de responsabilité" },
  { id: "liens", label: "8. Liens hypertextes" },
  { id: "droit", label: "9. Droit applicable et juridiction compétente" },
];

export function MentionsLegalesContent() {
  return (
    <LegalPageShell title="Mentions Légales" path="/mentions-legales" toc={TOC}>
      <LegalSection id="editeur" title="1. Éditeur du site">
        <LegalParagraph>
          Le site CoWork Prysme (ci-après « le Site ») est édité par :
        </LegalParagraph>
        <LegalDefinitionList
          items={[
            ["Raison sociale", "CG Développement"],
            ["Forme juridique", "Société par Actions Simplifiée (SAS)"],
            ["Capital social", "Variable"],
            ["Siège social", "36 Allée des Prés Rouets, 69510 Messimy, France"],
            ["RCS Lyon", "882 095 839"],
            ["SIRET", "882 095 839 00016"],
            ["Code APE", "7010Z – Activités des sièges sociaux"],
            ["Numéro de TVA intracommunautaire", "FR50888833258"],
            ["Email", "contact@prysme.eu"],
            ["Téléphone", "04 78 86 92 55"],
          ]}
        />
      </LegalSection>

      <LegalSection id="directeur" title="2. Directeur de la publication">
        <LegalParagraph>
          Le directeur de la publication du Site est Monsieur Christophe GARNIER, en qualité de
          Président de la société CG Développement.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="hebergement" title="3. Hébergement">
        <LegalParagraph>Le Site est hébergé par :</LegalParagraph>
        <LegalParagraph>Sharpheberg</LegalParagraph>
        <LegalParagraph>Hébergeur web professionnel</LegalParagraph>
        <LegalParagraph>
          Site web :{" "}
          <a href="https://sharpheberg.com/" rel="noopener noreferrer">
            https://sharpheberg.com/
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="propriete" title="4. Propriété intellectuelle">
        <LegalParagraph>
          L&apos;ensemble des éléments constituant le Site (textes, graphismes, logiciels,
          photographies, images, vidéos, sons, plans, logos, marques, créations et œuvres
          protégeables diverses, bases de données, etc.) ainsi que le Site lui-même, relèvent des
          législations françaises et internationales sur le droit d&apos;auteur et la propriété
          intellectuelle.
        </LegalParagraph>
        <LegalParagraph>
          Ces éléments sont la propriété exclusive de CG Développement. Toute reproduction,
          représentation, modification, publication, transmission, dénaturation, totale ou partielle
          du Site ou de son contenu, par quelque procédé que ce soit, et sur quelque support que ce
          soit est interdite sans l&apos;autorisation écrite préalable de CG Développement.
        </LegalParagraph>
        <LegalParagraph>
          Toute exploitation non autorisée du Site ou de son contenu, des informations qui y sont
          divulguées, engagerait la responsabilité de l&apos;utilisateur et constituerait une
          contrefaçon sanctionnée par les articles L. 335-2 et suivants du Code de la Propriété
          Intellectuelle.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="donnees" title="5. Protection des données personnelles">
        <LegalParagraph>
          Les informations concernant la collecte et le traitement des données personnelles sont
          détaillées dans notre{" "}
          <Link href="/politique-de-confidentialite">Politique de Confidentialité</Link>.
        </LegalParagraph>
        <LegalParagraph>
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
          Informatique et Libertés, vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de limitation, de portabilité et d&apos;opposition au traitement de vos
          données personnelles.
        </LegalParagraph>
        <LegalParagraph>
          Pour exercer ces droits, vous pouvez nous contacter à l&apos;adresse : contact@prysme.eu
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="cookies" title="6. Cookies">
        <LegalParagraph>
          Le Site utilise des cookies pour améliorer l&apos;expérience utilisateur et réaliser des
          statistiques de visites. Pour plus d&apos;informations sur l&apos;utilisation des cookies,
          veuillez consulter notre{" "}
          <Link href="/politique-de-confidentialite">Politique de Confidentialité</Link>.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="responsabilite" title="7. Limitation de responsabilité">
        <LegalParagraph>
          CG Développement s&apos;efforce d&apos;assurer au mieux l&apos;exactitude et la mise à
          jour des informations diffusées sur le Site. Toutefois, CG Développement ne peut garantir
          l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à
          disposition sur le Site.
        </LegalParagraph>
        <LegalParagraph>
          En conséquence, CG Développement décline toute responsabilité :
        </LegalParagraph>
        <LegalList
          items={[
            "Pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur le Site",
            "Pour tous dommages résultant d'une intrusion frauduleuse d'un tiers ayant entraîné une modification des informations mises à disposition sur le Site",
            "Et plus généralement, pour tous dommages, directs ou indirects, qu'elles qu'en soient les causes, origines, natures ou conséquences",
          ]}
        />
      </LegalSection>

      <LegalSection id="liens" title="8. Liens hypertextes">
        <LegalParagraph>
          Le Site peut contenir des liens hypertextes vers d&apos;autres sites internet. CG
          Développement n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité
          quant à leur contenu ou aux éventuels collectes et traitements de données personnelles
          effectués par ces sites.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="droit" title="9. Droit applicable et juridiction compétente">
        <LegalParagraph>
          Les présentes mentions légales sont régies par le droit français. En cas de litige, et
          après tentative de recherche d&apos;une solution amiable, les tribunaux français seront
          seuls compétents.
        </LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  );
}
