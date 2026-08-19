import { Result } from "@workspace/domain"
import type { Result as ResultType } from "@workspace/domain"
import { ApplicationError } from "../ports/errors.js"
import type {
  BookCatalogQueries,
  FinancialBookSummary,
} from "./catalog-queries.js"

export class ListFinancialBooks {
  public constructor(private readonly queries: BookCatalogQueries) {}

  public async execute(): Promise<
    ResultType<readonly FinancialBookSummary[], ApplicationError>
  > {
    try {
      return Result.ok(await this.queries.listFinancialBooks())
    } catch {
      return Result.fail(
        new ApplicationError("UNEXPECTED_ERROR", "Financial query failed")
      )
    }
  }
}
