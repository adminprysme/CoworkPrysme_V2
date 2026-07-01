import { Injectable } from "@nestjs/common";
import { runReadinessCheck } from "@coworkprysme/db";

@Injectable()
export class DbService {
  runReadinessCheck() {
    return runReadinessCheck();
  }
}
