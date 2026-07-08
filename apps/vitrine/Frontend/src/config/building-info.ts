/** Mock building data — replace with cowork_bdd fetch in a later step. */
export interface BuildingInfo {
  name: string;
  address: {
    line1: string;
    line2: string;
    postalCode: string;
    city: string;
    full: string;
  };
  phone: string;
  phoneHref: string;
  email: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  mapExternalUrl: string;
}

export const MOCK_BUILDING_INFO: BuildingInfo = {
  name: "Cowork Prysme — Technopark, Bâtiment A1",
  address: {
    line1: "Technopark Lyon — Bâtiment A1",
    line2: "Entrée rue Saint-Jean-de-Dieu",
    postalCode: "69007",
    city: "Lyon",
    full: "Technopark Lyon — Bâtiment A1, entrée rue Saint-Jean-de-Dieu, 69007 Lyon",
  },
  phone: "04 78 86 92 55",
  phoneHref: "tel:+33478869255",
  email: "accueil-technopark-a1@coworkprysme.eu",
  coordinates: {
    lat: 45.7284,
    lng: 4.8378,
  },
  mapExternalUrl: "https://www.openstreetmap.org/?mlat=45.7284&mlon=4.8378#map=16/45.7284/4.8378",
};
