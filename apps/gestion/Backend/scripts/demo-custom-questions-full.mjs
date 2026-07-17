/**
 * Démo complète — questions de spécificité (module Services)
 * Usage: node scripts/demo-custom-questions-full.mjs
 */
import { createHash, randomBytes } from "node:crypto";

import { connectMongo, getStaffProfileModel, getStaffSessionModel } from "@coworkprysme/db";

const API = "http://127.0.0.1:8003";
const SERVICE_LABEL = "Restauration événementielle";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-local-session-secret-32chars-min!!";

function hashToken(token) {
  return createHash("sha256").update(`${token}:${SESSION_SECRET}`).digest("hex");
}

async function createSession() {
  const token = randomBytes(32).toString("hex");
  await connectMongo();
  const StaffProfile = await getStaffProfileModel();
  const profile = await StaffProfile.findOne({ email: "paul.thomas@local.coworkprysme.dev" }).exec();
  if (!profile) throw new Error("Staff profile not found");
  const StaffSession = await getStaffSessionModel();
  await StaffSession.create({
    sessionTokenHash: hashToken(token),
    staffProfileId: profile._id,
    prysmAppUserId: profile.prysmAppUserId,
    authSource: "local",
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });
  return token;
}

async function api(path, { method = "GET", body } = {}, token) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `gestion_sid=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  }
  return json;
}

function printQuestions(title, questions) {
  console.log(`\n${title}`);
  for (const q of questions) {
    const req = q.required ? "obligatoire" : "optionnelle";
    const extra = q.type === "select" ? ` [${q.options.join(", ")}]` : "";
    console.log(`  ${q.order + 1}. ${q.label} (${q.type}, ${req})${extra}`);
  }
}

const token = await createSession();

console.log("=== Étape 0 — Nettoyage des démos précédentes ===");
const existing = await api("/services?status=all", {}, token);
for (const service of existing.services) {
  if (service.label.startsWith(SERVICE_LABEL)) {
    console.log(`  (service existant conservé: ${service.id} — ${service.label})`);
  }
}

// Use exact label; create fresh if not found with our demo marker in description
let service = existing.services.find(
  (item) => item.label === SERVICE_LABEL && item.description?.includes("DEMO customQuestions"),
);

if (!service) {
  console.log("\n=== Étape 1 — Création du service avec 3 questions ===");
  service = await api(
    "/services",
    {
      method: "POST",
      body: {
        label: SERVICE_LABEL,
        description: "DEMO customQuestions — démo module gestion",
        priceEurosHT: 50,
        vatRate: 20,
        promoEligible: false,
        status: "active",
        customQuestions: [
          {
            label: "Nombre de personnes ?",
            type: "number",
            required: true,
            order: 0,
          },
          {
            label: "Date de l'événement",
            type: "date_range",
            required: false,
            order: 1,
          },
          {
            label: "Menu souhaité",
            type: "select",
            required: true,
            order: 2,
            options: ["Entrée", "Plat", "Formule"],
          },
        ],
      },
    },
    token,
  );
  console.log(`  Service créé: id=${service.id}, key=${service.key}`);
  console.log(`  Q1 id généré serveur (sans id frontend): ${service.customQuestions[0].id}`);
} else {
  console.log("\n=== Étape 1 — Service déjà présent, réinitialisation des questions ===");
  service = await api(
    `/services/${service.id}`,
    {
      method: "PATCH",
      body: {
        customQuestions: [
          {
            label: "Nombre de personnes ?",
            type: "number",
            required: true,
            order: 0,
          },
          {
            label: "Date de l'événement",
            type: "date_range",
            required: false,
            order: 1,
          },
          {
            label: "Menu souhaité",
            type: "select",
            required: true,
            order: 2,
            options: ["Entrée", "Plat", "Formule"],
          },
        ],
      },
    },
    token,
  );
}

printQuestions("Questions après création:", service.customQuestions);

console.log("\n=== Étape 2 — Persistance (GET = rechargement page) ===");
const afterReload1 = await api(`/services/${service.id}`, {}, token);
printQuestions("Questions après rechargement:", afterReload1.customQuestions);

const qNumberId = afterReload1.customQuestions.find((q) => q.type === "number").id;
const qDateId = afterReload1.customQuestions.find((q) => q.type === "date_range").id;
const qMenuId = afterReload1.customQuestions.find((q) => q.type === "select").id;

console.log("\n=== Étape 3 — Réordonnancement: Menu → Nombre → Date ===");
const reordered = await api(
  `/services/${service.id}`,
  {
    method: "PATCH",
    body: {
      customQuestions: [
        {
          id: qMenuId,
          label: "Menu souhaité",
          type: "select",
          required: true,
          order: 0,
          options: ["Entrée", "Plat", "Formule"],
        },
        {
          id: qNumberId,
          label: "Nombre de personnes ?",
          type: "number",
          required: true,
          order: 1,
        },
        {
          id: qDateId,
          label: "Date de l'événement",
          type: "date_range",
          required: false,
          order: 2,
        },
      ],
    },
  },
  token,
);
printQuestions("Questions après réordonnancement (save):", reordered.customQuestions);

console.log("\n=== Étape 3b — Persistance après rechargement ===");
const afterReload2 = await api(`/services/${service.id}`, {}, token);
printQuestions("Questions après rechargement:", afterReload2.customQuestions);

console.log("\n=== Étape 4 — Suppression de « Date de l'événement » ===");
const trimmed = await api(
  `/services/${service.id}`,
  {
    method: "PATCH",
    body: {
      customQuestions: afterReload2.customQuestions
        .filter((q) => q.label !== "Date de l'événement")
        .map((q, index) => ({ ...q, order: index })),
    },
  },
  token,
);
printQuestions("Questions après suppression (save):", trimmed.customQuestions);

console.log("\n=== Étape 4b — Persistance après rechargement ===");
const afterReload3 = await api(`/services/${service.id}`, {}, token);
printQuestions("Questions finales après rechargement:", afterReload3.customQuestions);

console.log("\n=== RÉSUMÉ ===");
console.log(`Service: ${afterReload3.label} (${afterReload3.id})`);
console.log(`Questions finales: ${afterReload3.customQuestions.length} (Date supprimée ✓)`);
console.log(`Ordre final: ${afterReload3.customQuestions.map((q) => q.label).join(" → ")}`);
console.log(`\nURL gestion: http://localhost:3002/services`);
console.log(`Token session (pour tests manuels): ${token}`);

process.exit(0);
