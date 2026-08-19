export const MAX_INT64_MINOR = "9223372036854775807";

export type MoneyParseErrorCode =
  | "EMPTY"
  | "INVALID_FORMAT"
  | "AMBIGUOUS_SEPARATOR"
  | "TOO_MANY_DECIMALS"
  | "ZERO"
  | "OVERFLOW";

export type MoneyParseResult =
  | { readonly ok: true; readonly value: MoneyInputValue }
  | {
      readonly ok: false;
      readonly error: { readonly code: MoneyParseErrorCode; readonly message: string };
    };

export interface MoneyInputValue {
  readonly display: string;
  readonly amountMinor: string | null;
}

const errors: Record<MoneyParseErrorCode, string> = {
  EMPTY: "Informe um valor maior que zero.",
  INVALID_FORMAT: "Use apenas números e vírgula decimal.",
  AMBIGUOUS_SEPARATOR: "Use somente a vírgula decimal, sem separador de milhar.",
  TOO_MANY_DECIMALS: "Informe no máximo duas casas decimais.",
  ZERO: "Informe um valor maior que zero.",
  OVERFLOW: "O valor excede o limite permitido.",
};

function failure(code: MoneyParseErrorCode): MoneyParseResult {
  return { ok: false, error: { code, message: errors[code] } };
}

export function parseMoneyInput(display: string): MoneyParseResult {
  const normalized = display.trim();
  if (normalized.length === 0) return failure("EMPTY");
  if (/[.]/.test(normalized)) return failure("AMBIGUOUS_SEPARATOR");
  if (/[+-]/.test(normalized)) return failure("INVALID_FORMAT");
  if (/\s/.test(normalized)) return failure("INVALID_FORMAT");
  if (!/^\d+(?:,\d*)?$/.test(normalized)) return failure("INVALID_FORMAT");

  const [whole = "", fraction = ""] = normalized.split(",");
  if (fraction.length > 2) return failure("TOO_MANY_DECIMALS");

  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (minor === 0n) return failure("ZERO");
  if (minor > BigInt(MAX_INT64_MINOR)) return failure("OVERFLOW");

  return { ok: true, value: { display, amountMinor: minor.toString() } };
}

function currencyParts(
  amountMinor: bigint,
  currency: string,
  locale: string,
): Intl.NumberFormatPart[] {
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const parts = formatter.formatToParts(negative ? -whole : whole);
  let lastInteger = -1;
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]?.type === "integer") lastInteger = index;
  }
  if (lastInteger === -1 || !parts[lastInteger]) return parts;
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(
    (part) => part.type === "decimal",
  )?.value ?? ",";
  const integerPart = parts[lastInteger];
  if (!integerPart) return parts;
  parts[lastInteger] = {
    type: "integer",
    value: `${integerPart.value}${decimal}${fraction}`,
  };
  return parts;
}

export function formatMinorAmount(
  amountMinor: string,
  currency = "BRL",
  locale = "pt-BR",
): string {
  if (!/^-?\d+$/.test(amountMinor)) {
    throw new Error("Invalid minor amount");
  }
  return currencyParts(BigInt(amountMinor), currency, locale)
    .map((part) => part.value)
    .join("");
}
