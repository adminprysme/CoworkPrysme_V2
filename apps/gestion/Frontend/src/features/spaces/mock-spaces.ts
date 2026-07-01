import { createDefaultDaySchedules } from "./utils/schedule.js";
import type { Space } from "./space-types.js";

function demoPhoto(seed: string, fileName: string) {
  return {
    id: seed,
    previewUrl: `https://picsum.photos/seed/${seed}/400/300`,
    fileName,
    fileSize: 0,
    mimeType: "image/jpeg",
  };
}

export function createMockSpacesForBuilding(buildingId: string, floorNames: string[]): Space[] {
  const floor = (index: number) => floorNames[index] ?? floorNames[0] ?? "RDC";

  return [
    {
      id: `${buildingId}-space-1`,
      buildingId,
      type: "meeting_room",
      name: "Salon Part-Dieu",
      description:
        "Grande salle lumineuse avec vue sur le parvis, idéale pour les réunions plénières.",
      floor: floor(0),
      capacity: 12,
      equipments: [
        { key: "projector", label: "Vidéoprojecteur" },
        { key: "whiteboard", label: "Paperboard" },
        { key: "videoconf", label: "Visioconférence" },
        { key: "wifi", label: "Wifi" },
      ],
      openingHours: createDefaultDaySchedules(),
      status: "active",
      photos: [demoPhoto(`${buildingId}-s1`, "salon-part-dieu.jpg")],
    },
    {
      id: `${buildingId}-space-2`,
      buildingId,
      type: "meeting_room",
      name: "Cabinet Confluence",
      description: "Salle compacte pour comités restreints et visioconférences.",
      floor: floor(1),
      capacity: 6,
      equipments: [
        { key: "screen", label: "Écran" },
        { key: "videoconf", label: "Visioconférence" },
        { key: "ac", label: "Climatisation" },
      ],
      openingHours: createDefaultDaySchedules(),
      status: "active",
      photos: [demoPhoto(`${buildingId}-s2`, "cabinet-confluence.jpg")],
    },
    {
      id: `${buildingId}-space-3`,
      buildingId,
      type: "private_office",
      name: "Bureau Atlas",
      description: "Bureau privatif pour 2 postes, calme et isolé.",
      floor: floor(1),
      capacity: 2,
      equipments: [
        { key: "wifi", label: "Wifi" },
        { key: "ac", label: "Climatisation" },
        { key: "coffee", label: "Machine à café" },
      ],
      openingHours: createDefaultDaySchedules(),
      status: "active",
      photos: [demoPhoto(`${buildingId}-s3`, "bureau-atlas.jpg")],
    },
    {
      id: `${buildingId}-space-4`,
      buildingId,
      type: "private_office",
      name: "Studio Rhône",
      description: "Espace en cours de réaménagement — réservations suspendues.",
      floor: floor(0),
      capacity: 4,
      equipments: [{ key: "wifi", label: "Wifi" }],
      openingHours: createDefaultDaySchedules(),
      status: "inactive",
      photos: [],
    },
  ];
}
