import { BUILDING_DESCRIPTION_MAX_LENGTH } from "@coworkprysme/shared";

import { ACCEPTED_IMAGE_TYPES, MAX_PHOTO_SIZE_BYTES, type BuildingFormValues } from "../types.js";

const URL_PATTERN = /^https?:\/\/.+/i;

export type BuildingFormErrors = Partial<
  Record<
    | "name"
    | "description"
    | "phone"
    | "email"
    | "street"
    | "postalCode"
    | "city"
    | "country"
    | "coordinates"
    | "conciergeLink"
    | "floors"
    | "photos",
    string
  >
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s+().-]{6,32}$/;

export function validateBuildingForm(values: BuildingFormValues): BuildingFormErrors {
  const errors: BuildingFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Le nom du bâtiment est requis.";
  }

  if (values.description.length > BUILDING_DESCRIPTION_MAX_LENGTH) {
    errors.description = `La description ne peut pas dépasser ${BUILDING_DESCRIPTION_MAX_LENGTH} caractères.`;
  }

  const phone = values.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = "Le numéro de téléphone n'est pas valide.";
  }

  const email = values.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = "L'adresse e-mail n'est pas valide.";
  }

  if (!values.address.street.trim()) {
    errors.street = "La rue est requise.";
  }

  if (!values.address.postalCode.trim()) {
    errors.postalCode = "Le code postal est requis.";
  } else if (
    values.address.country.trim().toLowerCase() === "france" &&
    !/^\d{5}$/.test(values.address.postalCode.trim())
  ) {
    errors.postalCode = "Le code postal français doit contenir 5 chiffres.";
  }

  if (!values.address.city.trim()) {
    errors.city = "La ville est requise.";
  }

  if (!values.address.country.trim()) {
    errors.country = "Le pays est requis.";
  }

  if (values.concierge.link.trim() && !URL_PATTERN.test(values.concierge.link.trim())) {
    errors.conciergeLink = "L'URL de la conciergerie n'est pas valide.";
  }

  if (values.floors.length === 0) {
    errors.floors = "Ajoutez au moins un étage.";
  } else if (values.floors.some((floor) => !floor.name.trim())) {
    errors.floors = "Chaque étage doit avoir un nom.";
  }

  return errors;
}

export function validatePhotoFile(
  file: File,
  maxBytes: number = MAX_PHOTO_SIZE_BYTES,
): string | null {
  if (file.size === 0) {
    return "Le fichier image est vide.";
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Format non pris en charge. Utilisez JPG, PNG ou WebP.";
  }
  if (file.size > maxBytes) {
    const maxMo = Math.round(maxBytes / (1024 * 1024));
    return `L'image dépasse ${maxMo} Mo.`;
  }
  return null;
}

export function createEmptyFormValues(): BuildingFormValues {
  return {
    name: "",
    description: "",
    phone: "",
    email: "",
    address: {
      street: "",
      postalCode: "",
      city: "",
      country: "France",
    },
    lat: null,
    lng: null,
    floors: [],
    status: "active",
    accessibilityHours: [],
    receptionHours: [],
    concierge: { link: "", accessCode: "" },
    photos: [],
  };
}
