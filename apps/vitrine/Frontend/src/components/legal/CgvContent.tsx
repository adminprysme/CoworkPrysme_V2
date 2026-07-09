import Link from "next/link";

import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  LegalList,
  LegalParagraph,
  LegalSection,
  LegalSubSection,
} from "@/components/legal/LegalSection";
import { LegalTable } from "@/components/legal/LegalTable";
import type { TocEntry } from "@/components/legal/LegalTableOfContents";

const TOC: TocEntry[] = [
  { id: "preambule", label: "Préambule" },
  { id: "article-1", label: "Article 1 - Objet" },
  { id: "article-2", label: "Article 2 - Description des services" },
  { id: "article-3", label: "Article 3 - Réservation" },
  { id: "article-4", label: "Article 4 - Tarifs et paiement" },
  { id: "article-5", label: "Article 5 - Annulation et modification" },
  { id: "article-6", label: "Article 6 - Droit de rétractation (Consommateurs)" },
  { id: "article-7", label: "Article 7 - Obligations du Client" },
  { id: "article-8", label: "Article 8 - Responsabilité" },
  { id: "article-9", label: "Article 9 - Assurance" },
  { id: "article-10", label: "Article 10 - Protection des données personnelles" },
  { id: "article-11", label: "Article 11 - Propriété intellectuelle" },
  { id: "article-12", label: "Article 12 - Réclamations et médiation" },
  { id: "article-13", label: "Article 13 - Droit applicable et juridiction" },
  { id: "article-14", label: "Article 14 - Dispositions diverses" },
];

const CANCELLATION_TABLE_A = {
  caption: "A) Réservations à l'heure ou à la demi-journée",
  headers: ["Délai", "Remboursement"],
  rows: [
    ["Plus de 48 heures avant", "Remboursement intégral"],
    ["Entre 24 et 48 heures avant", "Remboursement de 50%"],
    ["Moins de 24 heures avant", "Aucun remboursement"],
    ["Non-présentation", "Aucun remboursement"],
  ],
};

const CANCELLATION_TABLE_B = {
  caption: "B) Réservations à la journée",
  headers: ["Délai", "Remboursement"],
  rows: [
    ["Plus de 7 jours avant", "Remboursement intégral"],
    ["Entre 3 et 7 jours avant", "Remboursement de 50%"],
    ["Moins de 3 jours avant", "Aucun remboursement"],
    ["Non-présentation", "Aucun remboursement"],
  ],
};

const CANCELLATION_TABLE_C = {
  caption: "C) Réservations à la semaine",
  headers: ["Délai", "Remboursement"],
  rows: [
    ["Plus de 14 jours avant", "Remboursement intégral"],
    ["Entre 7 et 14 jours avant", "Remboursement de 50%"],
    ["Moins de 7 jours avant", "Aucun remboursement"],
    ["Non-présentation", "Aucun remboursement"],
  ],
};

const CANCELLATION_TABLE_D = {
  caption: "D) Réservations au mois ou plus",
  headers: ["Délai", "Remboursement"],
  rows: [
    ["Plus de 30 jours avant le début", "Remboursement intégral"],
    ["Entre 15 et 30 jours avant", "Remboursement de 50%"],
    ["Moins de 15 jours avant", "Aucun remboursement"],
    [
      "Résiliation anticipée en cours de contrat",
      "Préavis de 30 jours requis. En l'absence de préavis, le mois entamé reste dû.",
    ],
    ["Non-présentation", "Aucun remboursement"],
  ],
};

export function CgvContent() {
  return (
    <LegalPageShell title="Conditions Générales de Vente" path="/cgv" toc={TOC}>
      <LegalSection id="preambule" title="Préambule">
        <LegalParagraph>
          Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations
          contractuelles entre :
        </LegalParagraph>
        <LegalSubSection title="Le Prestataire :">
          <LegalList
            items={[
              "CG Développement, SAS au capital variable",
              "Siège social : 36 Allée des Prés Rouets, 69510 Messimy, France",
              "RCS Lyon : 882 095 839 | SIRET : 882 095 839 00016",
              "TVA : FR50888833258",
              "Email : contact@prysme.eu | Tél : 04 78 86 92 55",
            ]}
          />
        </LegalSubSection>
        <LegalParagraph>
          Et toute personne physique ou morale (ci-après « le Client ») souhaitant bénéficier des
          services de location d&apos;espaces de coworking proposés par CoWork Prysme.
        </LegalParagraph>
        <LegalParagraph>
          Toute réservation implique l&apos;acceptation sans réserve des présentes CGV.
        </LegalParagraph>
        {/* BOOKING_TUNNEL: CGV acceptance checkbox before payment — see @/config/booking.ts */}
      </LegalSection>

      <LegalSection id="article-1" title="Article 1 - Objet">
        <LegalParagraph>
          Les présentes CGV ont pour objet de définir les conditions dans lesquelles CG
          Développement, sous la marque CoWork Prysme, met à disposition du Client des espaces de
          travail partagés (bureaux, salles de réunion, espaces communs) et services associés.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="article-2" title="Article 2 - Description des services">
        <LegalParagraph>CoWork Prysme propose les services suivants :</LegalParagraph>
        <LegalList
          items={[
            "Location de bureaux : Postes de travail individuels ou partagés, bureaux privatifs",
            "Location de salles de réunion : Espaces équipés pour réunions et formations",
            "Services inclus : Accès WiFi, électricité, chauffage/climatisation, accès aux espaces communs",
            "Services optionnels : Places de parking, casiers, services de restauration, domiciliation",
          ]}
        />
        <LegalParagraph>
          Les caractéristiques détaillées de chaque espace et service sont présentées sur le site
          internet et lors de la réservation.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="article-3" title="Article 3 - Réservation">
        <LegalSubSection title="3.1 Processus de réservation">
          <LegalParagraph>La réservation s&apos;effectue :</LegalParagraph>
          <LegalList
            items={[
              "En ligne via le site internet CoWork Prysme",
              "Par téléphone au 04 78 86 92 55",
              "Par email à contact@prysme.eu",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.2 Confirmation de réservation">
          <LegalParagraph>La réservation est considérée comme définitive après :</LegalParagraph>
          <LegalList
            items={[
              "Réception d'un email de confirmation de la part de CoWork Prysme",
              "Paiement intégral ou versement de l'acompte requis",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.3 Disponibilité">
          <LegalParagraph>
            Les réservations sont soumises à disponibilité. CoWork Prysme se réserve le droit de
            refuser une réservation en cas d&apos;indisponibilité ou pour tout motif légitime.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="article-4" title="Article 4 - Tarifs et paiement">
        <LegalSubSection title="4.1 Tarifs">
          <LegalParagraph>Les tarifs sont indiqués en euros et s&apos;entendent :</LegalParagraph>
          <LegalList
            items={[
              "Hors Taxes (HT) pour les clients professionnels",
              "Toutes Taxes Comprises (TTC) pour les particuliers",
            ]}
          />
          <LegalParagraph>
            La TVA applicable est de 20%. Les tarifs peuvent être modifiés à tout moment, mais les
            réservations confirmées restent au tarif en vigueur lors de la confirmation.
          </LegalParagraph>
        </LegalSubSection>
        <LegalSubSection title="4.2 Modalités de paiement">
          <LegalParagraph>Le paiement peut être effectué par :</LegalParagraph>
          <LegalList
            items={[
              "Carte bancaire : Via notre plateforme sécurisée Stripe",
              "Prélèvement SEPA : Pour les clients récurrents (sur accord préalable)",
              "Virement bancaire : Les coordonnées sont communiquées sur devis/facture",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="4.3 Échéances">
          <LegalList
            items={[
              "Réservation ponctuelle : Paiement intégral à la réservation",
              "Abonnement mensuel : Paiement en début de mois",
              "Clients B2B : Paiement à 30 jours date de facture (sur accord préalable)",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="4.4 Retard de paiement">
          <LegalParagraph>Tout retard de paiement entraîne de plein droit :</LegalParagraph>
          <LegalList
            items={[
              "L'application de pénalités de retard au taux de 3 fois le taux d'intérêt légal",
              "Une indemnité forfaitaire pour frais de recouvrement de 40€ (article L.441-10 du Code de commerce)",
              "La suspension de l'accès aux services jusqu'à régularisation",
            ]}
          />
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="article-5" title="Article 5 - Annulation et modification">
        <LegalSubSection title="5.1 Annulation par le Client">
          <LegalParagraph>
            Les conditions d&apos;annulation varient selon la durée de la réservation :
          </LegalParagraph>
          <LegalTable {...CANCELLATION_TABLE_A} />
          <LegalTable {...CANCELLATION_TABLE_B} />
          <LegalTable {...CANCELLATION_TABLE_C} />
          <LegalTable {...CANCELLATION_TABLE_D} />
        </LegalSubSection>
        <LegalSubSection title="5.2 Annulation par CoWork Prysme">
          <LegalParagraph>
            En cas d&apos;annulation de notre fait (force majeure, travaux, etc.), le Client sera
            remboursé intégralement ou se verra proposer un espace de remplacement équivalent.
          </LegalParagraph>
        </LegalSubSection>
        <LegalSubSection title="5.3 Modification de réservation">
          <LegalParagraph>
            Les demandes de modification sont soumises à disponibilité et doivent être effectuées au
            minimum 48h avant la date de réservation initiale.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="article-6" title="Article 6 - Droit de rétractation (Consommateurs)">
        <LegalParagraph>
          Conformément aux articles L.221-18 et suivants du Code de la consommation, le Client
          consommateur dispose d&apos;un délai de 14 jours pour exercer son droit de rétractation à
          compter de la confirmation de réservation, sans avoir à justifier de motifs ni à payer de
          pénalités.
        </LegalParagraph>
        <LegalParagraph>
          Ce droit de rétractation est réservé aux Clients agissant en qualité de consommateurs au
          sens du Code de la consommation. Les Clients professionnels (personnes morales ou
          personnes physiques agissant dans le cadre de leur activité professionnelle) ne
          bénéficient pas de ce droit.
        </LegalParagraph>
        <LegalParagraph>
          Conformément à l&apos;article L.221-28 du Code de la consommation, le droit de
          rétractation ne peut être exercé pour les prestations de services d&apos;hébergement
          (autres que résidentiel), de location de voitures, de restauration ou d&apos;activités de
          loisirs devant être fournis à une date ou période déterminée. Si la prestation a été
          exécutée intégralement avant la fin du délai de rétractation avec l&apos;accord du Client,
          celui-ci ne pourra plus exercer son droit de rétractation.
        </LegalParagraph>
        <LegalParagraph>
          Pour exercer ce droit, contactez-nous par email à contact@prysme.eu en indiquant
          clairement votre souhait de vous rétracter.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="article-7" title="Article 7 - Obligations du Client">
        <LegalParagraph>Le Client s&apos;engage à :</LegalParagraph>
        <LegalList
          items={[
            "Utiliser les locaux conformément à leur destination (activité professionnelle)",
            "Respecter le règlement intérieur de l'espace de coworking",
            "Ne pas sous-louer ou céder sa réservation sans accord préalable",
            "Respecter les horaires d'ouverture et les consignes de sécurité",
            "Maintenir les locaux en bon état et signaler tout dysfonctionnement",
            "Ne pas perturber les autres occupants de l'espace",
            "Respecter l'interdiction de fumer dans les locaux",
          ]}
        />
        <LegalSubSection title="Sanctions en cas de manquement :">
          <LegalParagraph>
            Tout manquement à ces obligations pourra entraîner, selon la gravité des faits et après
            mise en demeure restée sans effet :
          </LegalParagraph>
          <LegalList
            items={[
              "Un avertissement écrit",
              "La suspension temporaire de l'accès aux services",
              "La résiliation immédiate de la réservation sans remboursement",
              "Des poursuites en réparation des préjudices subis",
            ]}
          />
          <LegalParagraph>
            CoWork Prysme se réserve le droit d&apos;appliquer ces mesures de manière proportionnée
            à la gravité du manquement constaté.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="article-8" title="Article 8 - Responsabilité">
        <LegalSubSection title="8.1 Responsabilité de CoWork Prysme">
          <LegalParagraph>
            CoWork Prysme s&apos;engage à fournir les services réservés avec diligence. Sa
            responsabilité est limitée au montant de la prestation. CoWork Prysme ne saurait être
            tenu responsable :
          </LegalParagraph>
          <LegalList
            items={[
              "Des dommages indirects (perte de chiffre d'affaires, préjudice commercial...)",
              "Des vols ou dommages aux biens personnels du Client",
              "Des interruptions de service dues à des tiers (coupure internet, électricité...)",
              "Des cas de force majeure",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="8.2 Responsabilité du Client">
          <LegalParagraph>
            Le Client est responsable des dommages causés aux locaux, équipements ou à des tiers du
            fait de son utilisation des services. Il s&apos;engage à indemniser CoWork Prysme de
            tout préjudice subi.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="article-9" title="Article 9 - Assurance">
        <LegalParagraph>
          CoWork Prysme dispose d&apos;une assurance responsabilité civile professionnelle couvrant
          les locaux.
        </LegalParagraph>
        <LegalParagraph>
          Il est recommandé au Client de souscrire une assurance responsabilité civile
          professionnelle pour couvrir les dommages qu&apos;il pourrait causer ou subir dans le
          cadre de son activité.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="article-10" title="Article 10 - Protection des données personnelles">
        <LegalParagraph>
          Les données personnelles collectées dans le cadre de la relation commerciale sont traitées
          conformément à notre{" "}
          <Link href="/politique-de-confidentialite">Politique de Confidentialité</Link>.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="article-11" title="Article 11 - Propriété intellectuelle">
        <LegalParagraph>
          La marque CoWork Prysme, le logo, le site internet et l&apos;ensemble des contenus
          associés sont la propriété exclusive de CG Développement. Toute reproduction, même
          partielle, est interdite sans autorisation écrite préalable.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="article-12" title="Article 12 - Réclamations et médiation">
        <LegalSubSection title="12.1 Réclamations">
          <LegalParagraph>Toute réclamation doit être adressée à :</LegalParagraph>
          <LegalParagraph>CG Développement - Service Client</LegalParagraph>
          <LegalParagraph>36 Allée des Prés Rouets, 69510 Messimy</LegalParagraph>
          <LegalParagraph>Email : contact@prysme.eu</LegalParagraph>
        </LegalSubSection>
        <LegalSubSection title="12.2 Médiation (Consommateurs)">
          <LegalParagraph>
            Conformément aux articles L.612-1 et suivants du Code de la consommation, en cas de
            litige non résolu, le Client consommateur peut recourir gratuitement au médiateur de la
            consommation suivant :
          </LegalParagraph>
          <LegalParagraph>Médiatrice : Anaïs CARREL</LegalParagraph>
          <LegalParagraph>Téléphone : 01 83 64 02 12</LegalParagraph>
          <LegalParagraph>
            Le consommateur peut saisir le médiateur dans un délai d&apos;un an à compter de sa
            réclamation écrite auprès de CG Développement.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="article-13" title="Article 13 - Droit applicable et juridiction">
        <LegalParagraph>Les présentes CGV sont régies par le droit français.</LegalParagraph>
        <LegalParagraph>
          En cas de litige, et après échec de toute tentative de résolution amiable, les tribunaux
          compétents seront :
        </LegalParagraph>
        <LegalList
          items={[
            "Pour les professionnels : Tribunal de Commerce de Lyon",
            "Pour les consommateurs : Tribunal du lieu de résidence du consommateur ou du lieu de la prestation",
          ]}
        />
      </LegalSection>

      <LegalSection id="article-14" title="Article 14 - Dispositions diverses">
        <LegalParagraph>
          Si l&apos;une des clauses des présentes CGV était déclarée nulle, elle serait réputée non
          écrite sans affecter la validité des autres clauses.
        </LegalParagraph>
        <LegalParagraph>
          Le fait de ne pas exercer un droit prévu aux présentes CGV ne constitue pas une
          renonciation à ce droit.
        </LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  );
}
