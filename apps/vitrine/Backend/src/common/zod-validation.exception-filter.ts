import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

import { BOOKING_ERROR_CODES } from "@coworkprysme/shared";

export interface ZodValidationErrorBody {
  statusCode: number;
  code: typeof BOOKING_ERROR_CODES.VALIDATION_ERROR;
  message: string;
  errors: Array<{ path: string[]; message: string }>;
}

@Catch(ZodError)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const body: ZodValidationErrorBody = {
      statusCode: HttpStatus.BAD_REQUEST,
      code: BOOKING_ERROR_CODES.VALIDATION_ERROR,
      message: "Validation failed",
      errors: exception.issues.map((issue) => ({
        path: issue.path.map(String),
        message: issue.message,
      })),
    };

    response.status(HttpStatus.BAD_REQUEST).json(body);
  }
}
