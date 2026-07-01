import { z } from "zod";

import {
  BuildingDayScheduleInputSchema,
  BuildingDayScheduleResponseSchema,
  BuildingPhotoResponseSchema,
  BuildingStatusSchema,
} from "./buildings.js";

export const SPACE_TYPES = ["meeting_room", "private_office"] as const;

export const SpaceTypeSchema = z.enum(SPACE_TYPES);

export const SpaceStatusSchema = BuildingStatusSchema;

export const SPACE_DESCRIPTION_MAX_LENGTH = 2000;

export const SpaceDescriptionSchema = z
  .string()
  .trim()
  .max(SPACE_DESCRIPTION_MAX_LENGTH)
  .optional();

export const SpaceEquipmentInputSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
});

export const SpaceAccessCodeSchema = z.string().trim().optional();

export const CreateSpaceRequestSchema = z.object({
  type: SpaceTypeSchema,
  name: z.string().trim().min(1),
  description: SpaceDescriptionSchema,
  floor: z.string().trim().min(1),
  capacity: z.number().int().min(1),
  equipments: z.array(SpaceEquipmentInputSchema),
  openingHours: z.array(BuildingDayScheduleInputSchema).length(7),
  accessCode: SpaceAccessCodeSchema,
  status: SpaceStatusSchema,
});

export const UpdateSpaceRequestSchema = CreateSpaceRequestSchema;

export const SpaceSeoResponseSchema = z.object({
  slug: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

export const SpaceResponseSchema = z.object({
  id: z.string(),
  buildingId: z.string(),
  type: SpaceTypeSchema,
  name: z.string(),
  description: SpaceDescriptionSchema,
  floor: z.string(),
  capacity: z.number(),
  equipments: z.array(SpaceEquipmentInputSchema),
  openingHours: z.array(BuildingDayScheduleResponseSchema),
  accessCode: SpaceAccessCodeSchema,
  status: SpaceStatusSchema,
  photos: z.array(BuildingPhotoResponseSchema),
  seo: SpaceSeoResponseSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SpacesListResponseSchema = z.object({
  spaces: z.array(SpaceResponseSchema),
});

export type CreateSpaceRequest = z.infer<typeof CreateSpaceRequestSchema>;
export type UpdateSpaceRequest = z.infer<typeof UpdateSpaceRequestSchema>;
export type SpaceResponse = z.infer<typeof SpaceResponseSchema>;
export type SpacesListResponse = z.infer<typeof SpacesListResponseSchema>;
export type SpaceSeoResponse = z.infer<typeof SpaceSeoResponseSchema>;
