import { Injectable } from "@nestjs/common";
import { runCoworkReadinessCheck } from "@coworkprysme/db";

@Injectable()
export class DbService {
  runCoworkReadinessCheck() {
    return runCoworkReadinessCheck();
  }
}
