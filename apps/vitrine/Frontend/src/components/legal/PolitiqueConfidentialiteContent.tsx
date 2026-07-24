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
              "Adresse IP (voir aussi § 5 pour la distinction entre IP de connexion et IP d'acceptation de devis)",
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
        <LegalSubSection title="3.5 Données relatives aux devis">
          <LegalParagraph>
            Lorsque vous demandez ou recevez un devis, nous pouvons collecter :
          </LegalParagraph>
          <LegalList
            items={[
              "Identité et coordonnées du prospect (nom, prénom, email, téléphone)",
              "Informations professionnelles le cas échéant (raison sociale, SIRET, adresse de facturation)",
              "Contenu du devis (prestations, montants, conditions)",
              "Données liées à l'acceptation du devis, notamment l'horodatage de l'acceptation et l'adresse IP capturée à ce moment (preuve d'acceptation contractuelle — voir § 5)",
              "Le cas échéant, les données nécessaires à la création d'un compte utilisateur si vous n'en disposez pas encore",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.6 Documents associés à votre dossier (cardex)">
          <LegalParagraph>
            Dans le cadre de la gestion de votre dossier client, des documents peuvent être déposés
            par notre personnel :
          </LegalParagraph>
          <LegalList
            items={[
              "Contrats : visibles par le client dans son espace",
              "Autres documents (pièces internes, par exemple éléments de type RIB ou pièce d'identité) : conservés pour le suivi administratif, non visibles par le client",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.7 Invitation de collaborateurs">
          <LegalParagraph>
            Lorsqu&apos;un propriétaire de compte invite un collaborateur à rejoindre le dossier
            d&apos;une société :
          </LegalParagraph>
          <LegalList
            items={[
              "Adresse email du collaborateur invité",
              "Rôle associé au compte (propriétaire ou collaborateur)",
              "Données liées à l'acceptation de l'invitation (création ou rattachement de compte)",
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="3.8 Statut du compte (désactivation)">
          <LegalParagraph>
            Un compte peut être désactivé par notre personnel (par exemple départ d&apos;un
            collaborateur). Dans ce cas, nous conservons notamment :
          </LegalParagraph>
          <LegalList
            items={[
              "L'état de désactivation du compte",
              "La date de désactivation et, le cas échéant, un motif",
              "Les informations permettant une réactivation ultérieure par le personnel habilité",
            ]}
          />
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
            [
              "Établissement, envoi et acceptation des devis (y compris preuve d'acceptation)",
              "Exécution du contrat / Obligation légale",
            ],
            [
              "Invitation et gestion des collaborateurs rattachés à un compte société",
              "Exécution du contrat / Intérêt légitime",
            ],
            [
              "Désactivation ou réactivation d'un compte par le personnel habilité",
              "Exécution du contrat / Intérêt légitime",
            ],
            [
              "Conservation et mise à disposition des documents de dossier (contrats visibles client ; pièces internes non visibles client)",
              "Exécution du contrat / Obligation légale",
            ],
            ["Facturation et paiement", "Exécution du contrat / Obligation légale"],
            [
              "Mise à disposition d'un lien de paiement sécurisé par carte et d'un QR code sur facture (règlement des devis acceptés), envoyés par email et/ou affichés sur la facture",
              "Exécution du contrat",
            ],
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
            "Données de compte : pendant toute la durée de la relation contractuelle, puis 3 ans après la dernière activité",
            "Données de facturation : 10 ans (obligation légale comptable)",
            "Adresse IP capturée lors de l'acceptation d'un devis (preuve d'acceptation contractuelle, horodatée et rattachée au devis / document commercial) : 10 ans, alignée sur la durée de conservation de la facturation",
            "Adresse IP de connexion et logs techniques classiques : 1 an",
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
