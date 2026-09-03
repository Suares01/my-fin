import { useForm } from "react-hook-form"
import { useRef, type FormEvent } from "react"
import { bookErrorMessage, useCreateBook } from "../hooks"
import { BookPageBackButton } from "./book-page-back-button.js"
import { useBookPageNavigation } from "../hooks/use-book-page-navigation.js"
import { useBookRouteNavigation } from "../hooks/use-book-route-navigation"
import { CreateFinancialBookCommand } from "@workspace/application"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  createBookSchema,
  detectedTimezone,
  type CreateBookFormValues,
} from "./create-book-model"

function fieldMessage(
  field: "name" | "baseCurrency" | "timezone",
  value: string
): true | string {
  const schema = createBookSchema.shape[field]
  const result = schema.safeParse(value)
  return result.success
    ? true
    : (result.error.issues[0]?.message ?? "Valor inválido.")
}

export function CreateBookPage() {
  const mutation = useCreateBook()
  const { activateAndOpenDashboard } = useBookRouteNavigation()
  const { canGoBack, goBack } = useBookPageNavigation()
  const submitGuardRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookFormValues>({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      baseCurrency: "BRL",
      timezone: detectedTimezone(),
    },
  })

  const pending = isSubmitting || mutation.isPending
  const currencyField = register("baseCurrency", {
    validate: (value) => fieldMessage("baseCurrency", value),
  })
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(async (values) => {
      if (submitGuardRef.current) return
      submitGuardRef.current = true
      const parsed = createBookSchema.safeParse(values)
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0]
          if (
            field === "name" ||
            field === "baseCurrency" ||
            field === "timezone"
          ) {
            setError(field, { type: "schema", message: issue.message })
          }
        }
        submitGuardRef.current = false
        return
      }

      const command: CreateFinancialBookCommand = {
        ...parsed.data,
        baseCurrency: parsed.data.baseCurrency.toUpperCase(),
      }

      try {
        const book = await mutation.mutateAsync(command)
        activateAndOpenDashboard(book.id)
      } catch {
        // The mutation state renders a safe, actionable message and keeps the form open.
      } finally {
        submitGuardRef.current = false
      }
    })(event)
  }

  return (
    <section className="motion-reveal flex min-h-screen w-full flex-col justify-center gap-8 p-8">
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível criar o livro</AlertTitle>
          <AlertDescription>
            {bookErrorMessage(mutation.error)}
          </AlertDescription>
        </Alert>
      )}

      <form className="w-full" onSubmit={onSubmit} aria-busy={pending}>
        <div className="mx-auto mt-4 w-full border-none shadow-none md:max-w-3xl">
          {canGoBack && (
            <div className="my-4">
              <BookPageBackButton onClick={goBack} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Seu primeiro contexto
            </p>
            <h1 className="font-display text-4xl font-normal tracking-tight text-balance sm:text-5xl">
              Dê um nome ao seu dinheiro.
            </h1>
            <p className="max-w-xl text-base leading-relaxed">
              O livro mantém suas contas organizadas em um contexto local, claro
              e separado.
            </p>
          </div>

          <FieldGroup className="mt-8">
            <Field data-invalid={errors.name ? "true" : undefined}>
              <FieldLabel htmlFor="book-name">Nome do livro</FieldLabel>
              <Input
                id="book-name"
                autoComplete="organization"
                placeholder="Casa, trabalho ou família"
                className="touch-target"
                aria-invalid={errors.name ? "true" : "false"}
                aria-describedby="book-name-description book-name-error"
                disabled={pending}
                {...register("name", {
                  validate: (value) => fieldMessage("name", value),
                })}
              />
              <FieldDescription id="book-name-description">
                Use um nome curto que ajude a reconhecer este contexto.
              </FieldDescription>
              <FieldError id="book-name-error">
                {errors.name?.message}
              </FieldError>
            </Field>

            <Field data-invalid={errors.baseCurrency ? "true" : undefined}>
              <FieldLabel htmlFor="book-currency">Moeda-base</FieldLabel>
              <Input
                id="book-currency"
                inputMode="text"
                autoComplete="off"
                maxLength={3}
                className="touch-target uppercase"
                aria-invalid={errors.baseCurrency ? "true" : "false"}
                aria-describedby="book-currency-description book-currency-error"
                disabled={pending}
                {...currencyField}
                onChange={(event) => {
                  event.target.value = event.target.value.toUpperCase()
                  void currencyField.onChange(event)
                }}
              />
              <FieldDescription id="book-currency-description">
                Código ISO de três letras. O padrão local é BRL.
              </FieldDescription>
              <FieldError id="book-currency-error">
                {errors.baseCurrency?.message}
              </FieldError>
            </Field>

            <Field data-invalid={errors.timezone ? "true" : undefined}>
              <FieldLabel htmlFor="book-timezone">Timezone</FieldLabel>
              <Input
                id="book-timezone"
                autoComplete="off"
                className="touch-target"
                aria-invalid={errors.timezone ? "true" : "false"}
                aria-describedby="book-timezone-description book-timezone-error"
                disabled={pending}
                {...register("timezone", {
                  validate: (value) => fieldMessage("timezone", value),
                })}
              />
              <FieldDescription id="book-timezone-description">
                Detectado pelo dispositivo; você pode editar para outro timezone
                IANA.
              </FieldDescription>
              <FieldError id="book-timezone-error">
                {errors.timezone?.message}
              </FieldError>
            </Field>
          </FieldGroup>

          <div className="mt-4 flex justify-end">
            <Button
              className="touch-target w-full sm:w-fit"
              type="submit"
              disabled={pending}
            >
              {pending && (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              )}
              {pending ? "Criando livro" : "Criar livro"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  )
}
