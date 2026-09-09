import { useId, type ComponentType } from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "../lib/utils"
import { Button } from "./button"

export type ErrorStateVariant =
  | "generic"
  | "load-error"
  | "book-required"
  | "amount-limit"
  | "transfer-accounts-required"
  | "accounts-required"
  | "categories-required"

export type ErrorStateProps = {
  variant?: ErrorStateVariant
  title?: string
  description?: string
  className?: string
} & (
  | { actionLabel: string; onAction: () => void; actionHref?: never }
  | { actionLabel: string; actionHref: string; onAction?: never }
  | { actionLabel?: never; onAction?: never; actionHref?: never }
)

type IllustrationProps = { reducedMotion: boolean }

function Illustration({
  reducedMotion,
  outline,
  detail,
  destructive = false,
}: IllustrationProps & {
  outline: string
  detail: string
  destructive?: boolean
}) {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <motion.path
        d={outline}
        className={
          destructive
            ? "fill-destructive/10 stroke-destructive/40"
            : "fill-primary/10 stroke-primary/40"
        }
        strokeWidth="1.5"
        strokeLinejoin="round"
        initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.8, ease: "easeOut" }}
      />
      <motion.path
        d={detail}
        className="stroke-muted-foreground/50"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          delay: reducedMotion ? 0 : 0.4,
          duration: reducedMotion ? 0 : 0.5,
        }}
      />
      <motion.g
        initial={false}
        animate={{ y: reducedMotion ? 0 : [0, -3, 0] }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <circle cx="61" cy="59" r="11" className="fill-background" />
        <circle
          cx="61"
          cy="59"
          r="10"
          className={
            destructive
              ? "fill-destructive/10 stroke-destructive/50"
              : "fill-primary/10 stroke-primary/50"
          }
        />
        <path
          d="M61 54V60M61 64V64.1"
          className={destructive ? "stroke-destructive" : "stroke-primary"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  )
}

function GenericIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      destructive
      outline="M36 15Q40 8 44 15L69 58Q73 65 65 65H15Q7 65 11 58Z"
      detail="M40 28V43M40 51V52"
    />
  )
}

function LoadIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      destructive
      outline="M22 10H48L61 23V63Q61 69 55 69H22Q16 69 16 63V16Q16 10 22 10ZM48 10V23H61"
      detail="M25 31H48M25 39H43M28 48L40 60M40 48L28 60"
    />
  )
}

function BookIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      outline="M10 18Q25 12 40 20Q55 12 70 18V61Q55 55 40 63Q25 55 10 61ZM40 20V63"
      detail="M18 28Q25 25 32 29M18 37Q25 34 32 38M48 29Q55 25 62 28M48 38Q55 34 62 37"
    />
  )
}

function AmountIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      destructive
      outline="M40 12A26 26 0 1 1 39.9 12Z"
      detail="M48 28H36Q29 28 29 35Q29 42 39 42Q49 42 49 49Q49 56 41 56H30M39 22V61M57 14L66 23M66 14L57 23"
    />
  )
}

function AccountsIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      outline="M16 24H63Q69 24 69 30V59Q69 65 63 65H16Q10 65 10 59V25L55 14V24M69 37H51V51H69"
      detail="M58 43V45M20 34H37"
    />
  )
}

function TransferIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      outline="M10 14H34Q38 14 38 18V34Q38 38 34 38H10Q6 38 6 34V18Q6 14 10 14ZM47 42H71Q75 42 75 46V62Q75 66 71 66H47Q43 66 43 62V46Q43 42 47 42Z"
      detail="M28 24H38M65 52H75M46 23H59V33M54 28L59 33L64 28M30 55H17V45M12 50L17 45L22 50"
    />
  )
}

function CategoryIllustration(props: IllustrationProps) {
  return (
    <Illustration
      {...props}
      outline="M14 15H39L67 43Q71 47 67 51L47 71Q43 75 39 71L11 43V19Q11 15 14 15Z"
      detail="M24 23A4 4 0 1 1 23.9 23ZM33 41L46 54M39 35L52 48"
    />
  )
}

const variants: Record<
  ErrorStateVariant,
  {
    illustration: ComponentType<IllustrationProps>
    title: string
    description: string
  }
> = {
  generic: {
    illustration: GenericIllustration,
    title: "Não foi possível continuar",
    description: "Ocorreu um problema. Tente novamente em instantes.",
  },
  "load-error": {
    illustration: LoadIllustration,
    title: "Não foi possível carregar os dados",
    description:
      "Tente novamente para atualizar os dados necessários para continuar.",
  },
  "book-required": {
    illustration: BookIllustration,
    title: "Selecione um livro antes de continuar",
    description:
      "É necessário um livro com moeda-base definida para continuar.",
  },
  "amount-limit": {
    illustration: AmountIllustration,
    title: "Valor acima do limite seguro do formulário",
    description: "O valor excede o limite suportado por este formulário.",
  },
  "transfer-accounts-required": {
    illustration: TransferIllustration,
    title: "Crie pelo menos duas contas para transferir",
    description:
      "Você precisa de uma conta de origem e outra de destino disponíveis na moeda do livro.",
  },
  "accounts-required": {
    illustration: AccountsIllustration,
    title: "Crie uma conta antes de continuar",
    description:
      "Adicione uma conta na moeda do livro para registrar suas transações.",
  },
  "categories-required": {
    illustration: CategoryIllustration,
    title: "Crie uma categoria antes de continuar",
    description:
      "Adicione uma categoria para organizar este tipo de transação.",
  },
}

export function ErrorState({
  variant = "generic",
  title,
  description,
  className,
  actionLabel,
  onAction,
  actionHref,
}: ErrorStateProps) {
  const id = useId()
  const reducedMotion = useReducedMotion() === true
  const config = variants[variant]
  const StateIllustration = config.illustration
  const textInitial = reducedMotion ? false : { opacity: 0, y: 4 }

  return (
    <motion.div
      data-slot="error-state"
      role="alert"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: "easeOut" }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 py-16 text-center",
        className
      )}
    >
      <motion.div
        initial={reducedMotion ? false : { scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{
          duration: reducedMotion ? 0 : 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <StateIllustration reducedMotion={reducedMotion} />
      </motion.div>
      <div className="flex max-w-xs flex-col gap-1.5">
        <motion.h3
          id={`${id}-title`}
          className="text-sm font-semibold"
          initial={textInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reducedMotion ? 0 : 0.2,
            duration: reducedMotion ? 0 : 0.3,
          }}
        >
          {title ?? config.title}
        </motion.h3>
        <motion.p
          id={`${id}-description`}
          className="text-xs leading-relaxed text-muted-foreground"
          initial={textInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reducedMotion ? 0 : 0.3,
            duration: reducedMotion ? 0 : 0.3,
          }}
        >
          {description ?? config.description}
        </motion.p>
      </div>
      {actionLabel && (
        <motion.div
          initial={textInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reducedMotion ? 0 : 0.4,
            duration: reducedMotion ? 0 : 0.3,
          }}
        >
          {actionHref !== undefined ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              render={<a href={actionHref} />}
              nativeButton={false}
              role="link"
            >
              {actionLabel}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              type="button"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
