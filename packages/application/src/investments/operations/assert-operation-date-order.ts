import type { InvestmentPosition } from "@workspace/domain"
import { ApplicationError } from "../../ports/errors.js"
import type { RepositoryContext } from "../../ports/repositories.js"

export async function assertOperationDateOrder(
  repositories: RepositoryContext,
  bookId: string,
  position: InvestmentPosition,
  occurredOn: string
): Promise<void> {
  const last = await repositories.investmentOperations.findLastEffective(
    bookId,
    position.id
  )
  if (last !== null && occurredOn < last.toSnapshot().occurredOn)
    throw new ApplicationError(
      "INVALID_INVESTMENT_OPERATION",
      "Investment operation date precedes the last effective operation"
    )
}
