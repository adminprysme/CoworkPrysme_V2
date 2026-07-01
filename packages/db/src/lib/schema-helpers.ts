import { Schema, type SchemaDefinitionProperty } from "mongoose";

export const DEFAULT_CURRENCY = "EUR" as const;

export const CENTS_VALIDATOR = {
  validator: (value: number) => Number.isInteger(value),
  message: "Amount must be an integer number of cents",
};

export function centsField(options?: {
  required?: boolean;
  min?: number;
}): SchemaDefinitionProperty<number> {
  const validators: Array<{ validator: (v: number) => boolean; message: string }> = [
    CENTS_VALIDATOR,
  ];
  if (options?.min !== undefined) {
    validators.push({
      validator: (value: number) => value >= options.min!,
      message: `Amount must be >= ${options.min}`,
    });
  }
  return {
    type: Number,
    required: options?.required ?? true,
    validate: validators,
  };
}

export const objectIdRef = (ref: string, required = true): SchemaDefinitionProperty => ({
  type: Schema.Types.ObjectId,
  ref,
  required,
});

export const optionalObjectIdRef = (ref: string): SchemaDefinitionProperty => ({
  type: Schema.Types.ObjectId,
  ref,
  required: false,
});

export const TIMESTAMP_OPTIONS = { timestamps: true } as const;

export const CREATED_AT_ONLY = { timestamps: { createdAt: true, updatedAt: false } } as const;
