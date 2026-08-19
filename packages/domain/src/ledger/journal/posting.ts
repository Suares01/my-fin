import { Currency } from "../../shared/identity/currency.js"
import type { LedgerAccountId, PostingId } from "../../shared/identity/ids.js"
import { DomainError } from "../../shared/kernel/domain-error.js"
import { Money } from "../../shared/money.js"

export interface PostingSnapshot {
  readonly id: PostingId
  readonly accountId: LedgerAccountId
  readonly amountMinor: bigint
  readonly currency: string
}

export interface CreatePostingInput {
  readonly id: PostingId
  readonly accountId: LedgerAccountId
  readonly amount: Money
}

export class Posting {
  private constructor(
    private readonly postingId: PostingId,
    private readonly postingAccountId: LedgerAccountId,
    private readonly postingAmount: Money
  ) {}

  static create(input: CreatePostingInput): Posting {
    if (input.amount.amountMinor === 0n) {
      throw new DomainError(
        "ZERO_POSTING_AMOUNT",
        "Posting amount cannot be zero"
      )
    }

    return new Posting(input.id, input.accountId, input.amount)
  }

  static restore(snapshot: PostingSnapshot): Posting {
    return Posting.create({
      id: snapshot.id,
      accountId: snapshot.accountId,
      amount: Money.of(snapshot.amountMinor, Currency.parse(snapshot.currency)),
    })
  }

  get id(): PostingId {
    return this.postingId
  }

  get accountId(): LedgerAccountId {
    return this.postingAccountId
  }

  get amount(): Money {
    return this.postingAmount
  }

  reverse(id: PostingId): Posting {
    return Posting.create({
      id,
      accountId: this.accountId,
      amount: this.amount.negate(),
    })
  }

  toSnapshot(): PostingSnapshot {
    return {
      id: this.id,
      accountId: this.accountId,
      amountMinor: this.amount.amountMinor,
      currency: this.amount.currency.code,
    }
  }
}
