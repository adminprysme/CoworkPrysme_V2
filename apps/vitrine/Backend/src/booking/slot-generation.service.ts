import { Injectable } from "@nestjs/common";
import type { Space } from "@coworkprysme/db";
import type { BuildingDaySchedule, RangeBlockingCache } from "@coworkprysme/db";
import {
  eachParisIsoDateBetween,
  parisDateParts,
  parisLocalToUtc,
  parseTimeToMinutes,
} from "@coworkprysme/db";
import {
  BOOKING_PHASE1_DURATION_CLASSES,
  DURATION_CLASS_LABELS,
  type BookingPhase1DurationClass,
  type BookingSlot,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { AvailabilityService } from "./availability.service.js";

type SpaceLean = Space & { _id: Types.ObjectId };

function scheduleForDay(
  openingHours: BuildingDaySchedule[],
  day: BuildingDaySchedule["day"],
): BuildingDaySchedule | undefined {
  return openingHours.find((entry) => entry.day === day);
}

function enabledDurationClasses(space: SpaceLean): BookingPhase1DurationClass[] {
  const enabled = new Set(
    space.tariffs
      .filter((tariff) => tariff.enabled !== false)
      .map((tariff) => tariff.durationClass),
  );
  return BOOKING_PHASE1_DURATION_CLASSES.filter((durationClass) => enabled.has(durationClass));
}

function formatMinutesAsTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

@Injectable()
export class SlotGenerationService {
  constructor(private readonly availability: AvailabilityService) {}

  async generateSlots(
    space: SpaceLean,
    rangeStart: Date,
    rangeEnd: Date,
    now: Date = new Date(),
  ): Promise<BookingSlot[]> {
    const durationClasses = enabledDurationClasses(space);
    if (durationClasses.length === 0 || space.openingHours.length === 0) {
      return [];
    }

    const blockingCache = await this.availability.loadBlockingCache(
      space,
      rangeStart,
      rangeEnd,
      now,
    );
    const slots: BookingSlot[] = [];
    const seen = new Set<string>();

    for (const isoDate of eachParisIsoDateBetween(rangeStart, rangeEnd)) {
      const day = parisDateParts(parisLocalToUtc(isoDate, "12:00")).day;
      const schedule = scheduleForDay(space.openingHours, day);
      if (!schedule || (!schedule.is24h && schedule.open >= schedule.close)) {
        continue;
      }

      const parsedOpen = parseTimeToMinutes(schedule.open);
      const parsedClose = parseTimeToMinutes(schedule.close);

      let openMinutes: number;
      let closeMinutes: number;
      if (parsedClose > parsedOpen) {
        openMinutes = parsedOpen;
        closeMinutes = parsedClose;
      } else if (schedule.is24h) {
        openMinutes = 0;
        closeMinutes = 24 * 60;
      } else {
        continue;
      }

      if (durationClasses.includes("daily")) {
        const startAt = parisLocalToUtc(
          isoDate,
          schedule.is24h && parsedClose <= parsedOpen ? "00:00" : schedule.open,
        );
        const endAt = parisLocalToUtc(
          isoDate,
          schedule.is24h && parsedClose <= parsedOpen ? "23:59" : schedule.close,
        );
        this.pushSlot(space, slots, seen, blockingCache, {
          startAt,
          endAt,
          durationClass: "daily",
          now,
          rangeStart,
          rangeEnd,
        });
      }

      if (durationClasses.includes("hourly") && closeMinutes > openMinutes) {
        for (let minute = openMinutes; minute + 60 <= closeMinutes; minute += 60) {
          const startAt = parisLocalToUtc(isoDate, formatMinutesAsTime(minute));
          const endMinutes = minute + 60;
          const endAt = parisLocalToUtc(
            isoDate,
            endMinutes >= 24 * 60 ? "23:59" : formatMinutesAsTime(endMinutes),
          );
          this.pushSlot(space, slots, seen, blockingCache, {
            startAt,
            endAt,
            durationClass: "hourly",
            now,
            rangeStart,
            rangeEnd,
          });
        }
      }
    }

    return slots.sort(
      (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
    );
  }

  private pushSlot(
    space: SpaceLean,
    slots: BookingSlot[],
    seen: Set<string>,
    blockingCache: RangeBlockingCache,
    input: {
      startAt: Date;
      endAt: Date;
      durationClass: BookingPhase1DurationClass;
      now: Date;
      rangeStart: Date;
      rangeEnd: Date;
    },
  ): void {
    if (input.endAt <= input.startAt) {
      return;
    }
    if (input.startAt < input.rangeStart || input.endAt > input.rangeEnd) {
      return;
    }
    if (input.startAt < input.now) {
      return;
    }

    const key = `${input.startAt.toISOString()}|${input.endAt.toISOString()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const selectable = this.availability.isSpaceAvailableWithCache(
      space,
      input.startAt,
      input.endAt,
      blockingCache,
      input.now,
    );

    slots.push({
      startAt: input.startAt.toISOString(),
      endAt: input.endAt.toISOString(),
      durationClass: input.durationClass,
      selectable,
    });
  }

  durationLabel(durationClass: BookingPhase1DurationClass): string {
    return DURATION_CLASS_LABELS[durationClass as keyof typeof DURATION_CLASS_LABELS];
  }
}
