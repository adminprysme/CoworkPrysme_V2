import { ACCEPTED_IMAGE_TYPES, MAX_PHOTO_SIZE_BYTES, type BuildingFormValues } from "../types.js";

const URL_PATTERN = /^https?:\/\/.+/i;

export type BuildingFormErrors = Partial<
  Record<
    | "name"
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

export function validateBuildingForm(values: BuildingFormValues): BuildingFormErrors {
  const errors: BuildingFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Le nom du bâtiment est requis.";
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

export function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Format non pris en charge. Utilisez JPG, PNG ou WebP.";
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return "L'image dépasse 5 Mo.";
  }
  return null;
}

export function createEmptyFormValues(): BuildingFormValues {
  return {
    name: "",
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
