import { executeInvestmentRequest } from "../shared/execute-investment-request.js"
import { setOpeningBalanceInTransaction } from "../../ledger/journal/set-opening-balance.js"
import type {
  Clock,
  IdGenerator,
  SetInvestmentOpeningBalanceCommand,
  TransactionManager,
} from "../../ports/index.js"
import { DomainEventDispatcher } from "../../core/event-dispatcher.js"

export class SetInvestmentOpeningBalance {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}
  async execute(command: SetInvestmentOpeningBalanceCommand) {
    return executeInvestmentRequest({
      command,
      transactionManager: this.transactionManager,
      eventDispatcher: this.eventDispatcher,
      clock: this.clock,
      work: async (repositories) => {
        const entry = await setOpeningBalanceInTransaction(
          repositories,
          command,
          this.ids,
          this.clock
        )
        return {
          requestId: command.requestId,
          journalEntryIds: [entry.id],
          warnings: [],
        }
      },
    })
  }
}
