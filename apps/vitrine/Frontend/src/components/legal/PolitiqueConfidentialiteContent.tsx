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
  { id: "introduction", label: "1. Introduction" },
  { id: "responsable", label: "2. Responsable du traitement" },
  { id: "donnees-collectees", label: "3. Données personnelles collectées" },
  { id: "finalites", label: "4. Finalités du traitement" },
  { id: "conservation", label: "5. Durée de conservation" },
  { id: "destinataires", label: "6. Destinataires des données" },
  { id: "transferts", label: "7. Transferts hors Union Européenne" },
  { id: "cookies", label: "8. Cookies" },
  { id: "droits", label: "9. Vos droits" },
  { id: "securite", label: "10. Sécurité des données" },
  { id: "modifications", label: "11. Modifications de la politique" },
  { id: "contact", label: "12. Contact" },
];

export function PolitiqueConfidentialiteContent() {
  return (
    <LegalPageShell
      title="Politique de Confidentialité"
      path="/politique-de-confidentialite"
      toc={TOC}
    >
      <LegalSection id="introduction" title="1. Introduction">
        <LegalParagraph>
          La société CG Développement (ci-après « nous », « notre », « nos »), exploitant le site
          CoWork Prysme, s&apos;engage à protéger la vie privée des utilisateurs de son site
          internet et de ses services.
        </LegalParagraph>
        <LegalParagraph>
          La présente Politique de Confidentialité décrit les types de données personnelles que nous
          collectons, comment nous les utilisons, les partageons et les protégeons, conformément au
          Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679) et à la loi
          française Informatique et Libertés.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="responsable" title="2. Responsable du traitement">
        <LegalParagraph>CG Développement</LegalParagraph>
        <LegalParagraph>36 Allée des Prés Rouets, 69510 Messimy, France</LegalParagraph>
        <LegalParagraph>Email : contact@prysme.eu</LegalParagraph>
        <LegalParagraph>Téléphone : 04 78 86 92 55</LegalParagraph>
        <LegalParagraph>Contact RGPD : Christophe GARNIER - contact@prysme.eu</LegalParagraph>
      </LegalSection>

      <LegalSection id="donnees-collectees" title="3. Données personnelles collectées">
        <LegalParagraph>
          Nous collectons les catégories de données personnelles suivantes :
        </LegalParagraph>
        <LegalSubSection title="3.1 Données d'identification">
          <LegalList
            items={[
              "Nom et prénom",
              "Adresse email",
              "Numéro de téléphone",
              "Nom de l'entreprise (pour les clients B2B)",
              "Fonction/poste occupé",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.2 Données de connexion">
          <LegalList
            items={[
              "Identifiants de connexion (email, mot de passe chiffré)",
              "Adresse IP",
              "Logs de connexion et d'activité",
              "Type de navigateur et appareil utilisé",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.3 Données de réservation">
          <LegalList
            items={[
              "Historique des réservations",
              "Préférences d'espaces de travail",
              "Demandes et réclamations",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.4 Données de paiement">
          <LegalList
            items={[
              "Historique des transactions",
              "Données de facturation (nom, adresse, SIRET pour les professionnels)",
            ]}
          />
          <LegalParagraph>
            Note : Les données bancaires (numéro de carte, IBAN) sont traitées directement par notre
            prestataire de paiement Stripe et ne sont jamais stockées sur nos serveurs.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="finalites" title="4. Finalités du traitement">
        <LegalParagraph>
          Vos données personnelles sont collectées et traitées pour les finalités suivantes :
        </LegalParagraph>
        <LegalTable
          headers={["Finalité", "Base légale"]}
          rows={[
            ["Gestion de votre compte utilisateur", "Exécution du contrat"],
            ["Traitement des réservations d'espaces", "Exécution du contrat"],
            ["Facturation et paiement", "Exécution du contrat / Obligation légale"],
            ["Service client et support", "Exécution du contrat / Intérêt légitime"],
            ["Envoi de communications commerciales", "Consentement"],
            ["Amélioration de nos services", "Intérêt légitime"],
            ["Sécurité du site et prévention de la fraude", "Intérêt légitime / Obligation légale"],
          ]}
        />
      </LegalSection>

      <LegalSection id="conservation" title="5. Durée de conservation">
        <LegalParagraph>
          Vos données personnelles sont conservées pendant les durées suivantes :
        </LegalParagraph>
        <LegalList
          items={[
            "Données de compte : Pendant toute la durée de la relation contractuelle, puis 3 ans après la dernière activité",
            "Données de facturation : 10 ans (obligation légale comptable)",
            "Logs de connexion : 1 an",
            "Cookies : 13 mois maximum",
            "Demandes de support : 3 ans après la clôture du ticket",
          ]}
        />
        <LegalParagraph>
          À l&apos;expiration de ces délais, vos données sont supprimées ou anonymisées.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="destinataires" title="6. Destinataires des données">
        <LegalParagraph>
          Vos données personnelles peuvent être transmises aux destinataires suivants :
        </LegalParagraph>
        <LegalList
          items={[
            "Personnel habilité de CG Développement (équipe commerciale, support client, comptabilité)",
            "Prestataires de paiement : Stripe (traitement des paiements)",
            "Hébergeur : Sharpheberg (hébergement des données)",
            "Autorités compétentes en cas d'obligation légale",
          ]}
        />
        <LegalParagraph>
          Nous ne vendons ni ne louons vos données personnelles à des tiers.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="transferts" title="7. Transferts hors Union Européenne">
        <LegalParagraph>
          Certains de nos prestataires (notamment Stripe) peuvent transférer des données en dehors
          de l&apos;Union Européenne. Dans ce cas, ces transferts sont encadrés par :
        </LegalParagraph>
        <LegalList
          items={[
            "Des clauses contractuelles types approuvées par la Commission Européenne",
            "Des certifications appropriées (ex: Data Privacy Framework pour les USA)",
          ]}
        />
      </LegalSection>

      <LegalSection id="cookies" title="8. Cookies">
        <LegalParagraph>Notre site utilise des cookies pour :</LegalParagraph>
        <LegalSubSection title="8.1 Cookies strictement nécessaires">
          <LegalParagraph>
            Ces cookies sont indispensables au fonctionnement du site (authentification, sécurité,
            préférences de session). Ils ne nécessitent pas votre consentement.
          </LegalParagraph>
        </LegalSubSection>
        <LegalSubSection title="8.2 Cookies de performance et d'analyse">
          <LegalParagraph>
            Ces cookies nous permettent d&apos;analyser l&apos;utilisation du site pour
            l&apos;améliorer. Ils sont soumis à votre consentement.
          </LegalParagraph>
        </LegalSubSection>
        <LegalParagraph>
          Vous pouvez gérer vos préférences de cookies à tout moment via les paramètres de votre
          navigateur ou en nous contactant.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="droits" title="9. Vos droits">
        <LegalParagraph>Conformément au RGPD, vous disposez des droits suivants :</LegalParagraph>
        <LegalTable
          headers={["Droit", "Description"]}
          rows={[
            [
              "Droit d'accès",
              "Obtenir confirmation que vos données sont traitées et en recevoir une copie",
            ],
            ["Droit de rectification", "Faire corriger des données inexactes ou incomplètes"],
            ["Droit à l'effacement", "Demander la suppression de vos données dans certains cas"],
            ["Droit à la limitation", "Restreindre le traitement de vos données"],
            ["Droit à la portabilité", "Recevoir vos données dans un format structuré et lisible"],
            ["Droit d'opposition", "Vous opposer au traitement pour des motifs légitimes"],
          ]}
        />
        <LegalSubSection title="Pour exercer vos droits">
          <LegalParagraph>
            Contactez-nous par email à contact@prysme.eu ou par courrier à notre siège social.
          </LegalParagraph>
          <LegalParagraph>
            Nous répondrons à votre demande dans un délai d&apos;un mois.
          </LegalParagraph>
        </LegalSubSection>
        <LegalParagraph>
          Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL
          (Commission Nationale de l&apos;Informatique et des Libertés) :{" "}
          <a href="https://www.cnil.fr" rel="noopener noreferrer">
            www.cnil.fr
          </a>
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="securite" title="10. Sécurité des données">
        <LegalParagraph>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
          protéger vos données personnelles :
        </LegalParagraph>
        <LegalList
          items={[
            "Chiffrement des données en transit (HTTPS/TLS)",
            "Chiffrement des mots de passe (hachage bcrypt)",
            "Accès restreint aux données selon le principe du moindre privilège",
            "Sauvegardes régulières et sécurisées",
            "Surveillance et détection des intrusions",
          ]}
        />
      </LegalSection>

      <LegalSection id="modifications" title="11. Modifications de la politique">
        <LegalParagraph>
          Nous nous réservons le droit de modifier cette Politique de Confidentialité à tout moment.
          En cas de modification substantielle, nous vous en informerons par email ou via une
          notification sur le site.
        </LegalParagraph>
        <LegalParagraph>
          La date de dernière mise à jour est indiquée en bas de cette page.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact">
        <LegalParagraph>
          Pour toute question relative à cette Politique de Confidentialité ou au traitement de vos
          données personnelles, contactez-nous :
        </LegalParagraph>
        <LegalParagraph>Email : contact@prysme.eu</LegalParagraph>
        <LegalParagraph>Téléphone : 04 78 86 92 55</LegalParagraph>
        <LegalParagraph>
          Courrier : CG Développement - 36 Allée des Prés Rouets, 69510 Messimy, France
        </LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  );
}
