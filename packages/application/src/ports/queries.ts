import type { BookId, LedgerAccountId, LocalDate } from "@workspace/domain"

import type { LedgerAccountKind } from "@workspace/domain"

export interface AccountBalanceView {
  readonly accountId: string
  readonly accountName: string
  readonly accountKind: LedgerAccountKind
  readonly rawBalanceMinor: string
  readonly displayBalanceMinor: string
  readonly asOf: string | null
  readonly amountMinor: string
  readonly currency: string
}

export interface AccountBalanceItemView extends AccountBalanceView {
  readonly archived: boolean
  readonly version?: number
}

export interface LedgerQueries {
  getAccountBalance(input: {
    bookId: BookId
    accountId: LedgerAccountId
    asOf?: LocalDate
  }): Promise<AccountBalanceView>
}
