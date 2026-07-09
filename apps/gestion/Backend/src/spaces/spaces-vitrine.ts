import { BadRequestException } from "@nestjs/common";

export interface SpaceVitrineFlagsInput {
  status: "active" | "inactive";
  featuredOnVitrine: boolean;
  vitrineOrder?: number;
}

export interface SpaceVitrineFlags {
  featuredOnVitrine: boolean;
  vitrineOrder?: number;
}

export function resolveSpaceVitrineFlags(input: SpaceVitrineFlagsInput): SpaceVitrineFlags {
  if (input.status === "inactive") {
    if (input.featuredOnVitrine) {
      throw new BadRequestException(
        "Un espace inactif ne peut pas être mis en avant sur la vitrine.",
      );
    }
    return { featuredOnVitrine: false, vitrineOrder: input.vitrineOrder };
  }

  return {
    featuredOnVitrine: input.featuredOnVitrine,
    vitrineOrder: input.vitrineOrder,
  };
}
