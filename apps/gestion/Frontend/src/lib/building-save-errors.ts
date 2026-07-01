import type { BuildingFormErrors } from "../features/spaces/utils/validation.js";

const PHOTO_ERROR_MESSAGES: Record<string, string> = {
  "Missing file": "Le fichier photo n'a pas pu être envoyé. Réessayez de l'ajouter.",
  "Empty file": "Le fichier image est vide.",
  "Unsupported file type": "Format non pris en charge. Utilisez JPG, PNG ou WebP.",
  "Unknown photo":
    "Une photo n'est plus disponible sur le serveur. Retirez-la et ajoutez-la à nouveau.",
  "Maximum photos reached": "Nombre maximum de photos atteint.",
  "File exceeds maximum size": "L'image dépasse 5 Mo.",
};

function photoErrorMessage(message: string): string {
  return PHOTO_ERROR_MESSAGES[message] ?? message;
}

export function mapBuildingSaveError(error: unknown): BuildingFormErrors {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("localiser cette adresse") || message.includes("rechercher l'adresse")) {
    return { coordinates: message };
  }

  if (
    message in PHOTO_ERROR_MESSAGES ||
    message.includes("photo") ||
    message.includes("image") ||
    message.includes("Format") ||
    message.includes("5 Mo")
  ) {
    return { photos: photoErrorMessage(message) };
  }

  return { coordinates: "Impossible d'enregistrer ce bâtiment." };
}
