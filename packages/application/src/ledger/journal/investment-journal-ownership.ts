import type { JournalEntryId } from "@workspace/domain"
import { ApplicationError } from "../../ports/errors.js"
import type { RepositoryContext } from "../../ports/repositories.js"

export async function assertJournalNotOwnedByInvestment(
  repositories: RepositoryContext,
  bookId: string,
  journalEntryId: JournalEntryId
): Promise<void> {
  const owner = await repositories.investmentOperations.findOwnerOfJournal(
    bookId,
    journalEntryId
  )
  if (owner !== null)
    throw new ApplicationError(
      "INVESTMENT_OPERATION_REQUIRED",
      "Investment journals must be corrected through their investment operation"
    )
}
