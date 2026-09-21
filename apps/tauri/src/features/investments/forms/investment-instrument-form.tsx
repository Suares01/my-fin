import type {
  CreateInvestmentInstrumentCommand,
  InvestmentInstrumentDto,
  SetInvestmentInstrumentStatusCommand,
  UpdateInvestmentInstrumentCommand,
} from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useFieldArray, useForm } from "react-hook-form"
import type { z } from "zod"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { ControlledSelect } from "../../../components/forms/controlled-select"
import { ControlledToggleGroup } from "../../../components/forms/controlled-toggle-group"
import { useActiveBook, useMyFin } from "../../../providers"
import { useBookDetail } from "../../books/hooks"
import { investmentKeys } from "../hooks"
import {
  instrumentErrorMessage,
  investmentInstrumentSchema,
} from "./investment-instrument-form-model"

type InstrumentFormInput = z.input<typeof investmentInstrumentSchema>
type InstrumentFormOutput = z.output<typeof investmentInstrumentSchema>

type InvestmentInstrumentFormProps = {
  readonly mode?: "create" | "edit"
  readonly initialInstrument?: InvestmentInstrumentDto
  readonly onSuccess?: (instrument: InvestmentInstrumentDto) => void
  readonly onCancel?: () => void
}

const instrumentTypes = [
  ["CDB", "CDB"],
  ["RDB", "RDB"],
  ["LCI", "LCI"],
  ["LCA", "LCA"],
  ["LC", "LC"],
  ["CRI", "CRI"],
  ["CRA", "CRA"],
  ["DEBENTURE", "Debênture"],
  ["LF", "Letra financeira"],
  ["LIG", "LIG"],
  ["TREASURY", "Tesouro"],
  ["STOCK", "Ação"],
  ["BDR", "BDR"],
  ["ETF", "ETF"],
  ["REAL_ESTATE_FUND", "Fundo imobiliário"],
  ["MUTUAL_FUND", "Fundo"],
  ["PGBL", "PGBL"],
  ["VGBL", "VGBL"],
  ["COE", "COE"],
  ["CRYPTO_ASSET", "Criptoativo"],
  ["OTHER", "Outro"],
] as const

const identifierSchemes = [
  { value: "TICKER", label: "Ticker" },
  { value: "ISIN", label: "ISIN" },
  { value: "REGISTRATION_NUMBER", label: "Registro" },
  { value: "OTHER", label: "Outro" },
] as const

function valuesFor(
  mode: "create" | "edit",
  instrument?: InvestmentInstrumentDto
): InstrumentFormInput {
  if (mode === "edit" && instrument !== undefined) {
    return {
      name: instrument.name,
      type: instrument.type,
      issuerName: instrument.issuerName ?? "",
      identifiers: instrument.identifiers.map((identifier) => ({
        scheme: identifier.scheme,
        value: identifier.value,
        market: identifier.market ?? "",
      })),
    }
  }
  return { name: "", type: "CDB", issuerName: "", identifiers: [] }
}

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function InvestmentInstrumentForm({
  mode = "create",
  initialInstrument,
  onSuccess,
  onCancel,
}: InvestmentInstrumentFormProps) {
  const services = useMyFin()
  const queryClient = useQueryClient()
  const { session } = useActiveBook()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const book = useBookDetail(activeBookId ?? undefined)
  const form = useForm<InstrumentFormInput, unknown, InstrumentFormOutput>({
    resolver: zodResolver(investmentInstrumentSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: valuesFor(mode, initialInstrument),
  })
  const identifiers = useFieldArray({
    control: form.control,
    name: "identifiers",
  })
  const invalidate = async (bookId: string) => {
    await queryClient.invalidateQueries({
      queryKey: investmentKeys.all(bookId),
      exact: false,
    })
  }
  const create = useMutation({
    mutationFn: async (command: CreateInvestmentInstrumentCommand) => {
      const result =
        await services.investments.instruments.create.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: (instrument, command) =>
      invalidate(command.bookId).then(() => onSuccess?.(instrument)),
  })
  const update = useMutation({
    mutationFn: async (command: UpdateInvestmentInstrumentCommand) => {
      const result =
        await services.investments.instruments.update.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: (instrument, command) =>
      invalidate(command.bookId).then(() => onSuccess?.(instrument)),
  })
  const setStatus = useMutation({
    mutationFn: async (command: SetInvestmentInstrumentStatusCommand) => {
      const result =
        await services.investments.instruments.setStatus.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: (instrument, command) =>
      invalidate(command.bookId).then(() => onSuccess?.(instrument)),
  })

  const pending =
    form.formState.isSubmitting ||
    create.isPending ||
    update.isPending ||
    setStatus.isPending
  const isEdit = mode === "edit"
  const baseCurrency = book.data?.baseCurrency

  const submit = form.handleSubmit(async (values) => {
    if (activeBookId === null || baseCurrency === undefined) return
    const identifiers = values.identifiers
      .filter((identifier) => identifier.value.length > 0)
      .map((identifier) => ({
        scheme: identifier.scheme,
        value: identifier.value,
        ...(optionalValue(identifier.market) === undefined
          ? {}
          : { market: optionalValue(identifier.market) }),
      }))
    if (identifiers.some((identifier) => identifier.scheme.length === 0)) {
      form.setError("identifiers", {
        message: "Escolha o tipo de cada identificador.",
      })
      return
    }
    try {
      if (isEdit && initialInstrument !== undefined) {
        await update.mutateAsync({
          bookId: activeBookId,
          instrumentId: initialInstrument.id,
          expectedVersion: initialInstrument.version,
          name: values.name,
          type: values.type,
          currency: baseCurrency,
          ...(optionalValue(values.issuerName) === undefined
            ? {}
            : { issuerName: optionalValue(values.issuerName) }),
          identifiers,
        })
      } else {
        await create.mutateAsync({
          bookId: activeBookId,
          name: values.name,
          type: values.type,
          currency: baseCurrency,
          ...(optionalValue(values.issuerName) === undefined
            ? {}
            : { issuerName: optionalValue(values.issuerName) }),
          ...(identifiers.length === 0 ? {} : { identifiers }),
        })
      }
    } catch (error) {
      toast.add({
        type: "error",
        title: "Não foi possível salvar o instrumento",
        description: instrumentErrorMessage(error),
      })
    }
  })

  async function changeStatus(status: "ACTIVE" | "ARCHIVED") {
    if (activeBookId === null || initialInstrument === undefined) return
    try {
      await setStatus.mutateAsync({
        bookId: activeBookId,
        instrumentId: initialInstrument.id,
        expectedVersion: initialInstrument.version,
        status,
      })
    } catch (error) {
      toast.add({
        type: "error",
        title: "Não foi possível alterar o instrumento",
        description: instrumentErrorMessage(error),
      })
    }
  }

  if (activeBookId === null)
    return (
      <Alert>
        <AlertTitle>
          Selecione um livro antes de cadastrar um instrumento
        </AlertTitle>
        <AlertDescription>
          O cadastro será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )
  if (book.isPending)
    return (
      <Alert>
        <AlertTitle>Carregando moeda-base</AlertTitle>
        <AlertDescription>O instrumento usa a moeda do livro.</AlertDescription>
      </Alert>
    )
  if (book.isError || baseCurrency === undefined)
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar a moeda do livro</AlertTitle>
        <AlertDescription>
          Atualize o livro antes de salvar o instrumento.
        </AlertDescription>
      </Alert>
    )

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={submit}>
      <FieldGroup>
        <ControlledInput
          control={form.control}
          name="name"
          label="Nome do instrumento"
          disabled={pending}
          autoComplete="off"
        />
        <ControlledToggleGroup
          control={form.control}
          name="type"
          label="Tipo"
          disabled={pending}
          options={instrumentTypes.map(([value, label]) => ({ value, label }))}
        />
        <ControlledInput
          control={form.control}
          name="issuerName"
          label="Emissor"
          description="Opcional"
          disabled={pending}
          autoComplete="organization"
        />
      </FieldGroup>
      <FieldGroup>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Identificadores</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              identifiers.append({ scheme: "", value: "", market: "" })
            }
          >
            Adicionar identificador
          </Button>
        </div>
        {form.formState.errors.identifiers?.message !== undefined && (
          <Alert variant="destructive">
            <AlertDescription>
              {form.formState.errors.identifiers.message}
            </AlertDescription>
          </Alert>
        )}
        {identifiers.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-2"
          >
            <ControlledSelect
              control={form.control}
              name={`identifiers.${index}.scheme`}
              label="Tipo do identificador"
              disabled={pending}
              options={identifierSchemes}
            />
            <ControlledInput
              control={form.control}
              name={`identifiers.${index}.value`}
              label="Identificador"
              disabled={pending}
              autoComplete="off"
            />
            <ControlledInput
              control={form.control}
              name={`identifiers.${index}.market`}
              label="Mercado"
              description="Obrigatório para ticker"
              disabled={pending}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => identifiers.remove(index)}
            >
              Remover identificador
            </Button>
          </div>
        ))}
      </FieldGroup>
      <Alert>
        <AlertTitle>Moeda-base: {baseCurrency}</AlertTitle>
        <AlertDescription>
          A moeda é definida pelo livro e não é alterada por este formulário.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap justify-end gap-3">
        {isEdit && initialInstrument !== undefined && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Ações
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  void changeStatus(
                    initialInstrument.status === "ACTIVE"
                      ? "ARCHIVED"
                      : "ACTIVE"
                  )
                }
              >
                {initialInstrument.status === "ACTIVE"
                  ? "Arquivar instrumento"
                  : "Reativar instrumento"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner aria-hidden="true" />}{" "}
          {pending
            ? "Salvando instrumento"
            : isEdit
              ? "Salvar instrumento"
              : "Cadastrar instrumento"}
        </Button>
      </div>
    </form>
  )
}
