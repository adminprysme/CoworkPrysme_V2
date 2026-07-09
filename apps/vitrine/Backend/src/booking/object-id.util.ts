import { Types } from "mongoose";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

export function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}
