import type {
  InvestmentPositionMetadataDto,
  UpdateInvestmentPositionMetadataCommand,
} from "@workspace/application"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { ControlledInput } from "../../../components/forms/controlled-input"
import { useActiveBook, useMyFin } from "../../../providers"
import { investmentKeys } from "../hooks"
import {
  investmentPositionMetadataSchema,
  positionMetadataErrorMessage,
} from "./investment-position-metadata-form-model"

type PositionMetadataInput = z.input<typeof investmentPositionMetadataSchema>
type PositionMetadataOutput = z.output<typeof investmentPositionMetadataSchema>

type PositionTerm = { readonly label: string; readonly value: string }

type InvestmentPositionMetadataFormProps = {
  readonly position: InvestmentPositionMetadataDto
  readonly terms?: readonly PositionTerm[]
  readonly onSuccess?: (position: InvestmentPositionMetadataDto) => void
  readonly onCancel?: () => void
}

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export function InvestmentPositionMetadataForm({
  position,
  terms = [],
  onSuccess,
  onCancel,
}: InvestmentPositionMetadataFormProps) {
  const services = useMyFin()
  const queryClient = useQueryClient()
  const { session } = useActiveBook()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : null
  const form = useForm<PositionMetadataInput, unknown, PositionMetadataOutput>({
    resolver: zodResolver(investmentPositionMetadataSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { label: position.label ?? "" },
  })
  const update = useMutation({
    mutationFn: async (command: UpdateInvestmentPositionMetadataCommand) => {
      const result =
        await services.investments.positions.updateMetadata.execute(command)
      if (!result.ok) throw result.error
      return result.value
    },
    retry: false,
    onSuccess: async (metadata, command) => {
      await queryClient.invalidateQueries({
        queryKey: investmentKeys.all(command.bookId),
        exact: false,
      })
      onSuccess?.(metadata)
    },
  })
  const pending = form.formState.isSubmitting || update.isPending
  const submit = form.handleSubmit(async (values) => {
    if (activeBookId === null) return
    try {
      await update.mutateAsync({
        bookId: activeBookId,
        positionId: position.id,
        expectedVersion: position.version,
        ...(optionalValue(values.label) === undefined
          ? {}
          : { label: optionalValue(values.label) }),
      })
    } catch (error) {
      toast.add({
        type: "error",
        title: "Não foi possível salvar o rótulo",
        description: positionMetadataErrorMessage(error),
      })
    }
  })

  if (activeBookId === null)
    return (
      <Alert>
        <AlertTitle>Selecione um livro antes de editar a posição</AlertTitle>
        <AlertDescription>
          O formulário será liberado quando houver um livro ativo.
        </AlertDescription>
      </Alert>
    )

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={submit}>
      <FieldGroup>
        <ControlledInput
          control={form.control}
          name="label"
          label="Rótulo da posição"
          description="Opcional; não altera quantidade, custo ou alocação."
          disabled={pending}
          autoComplete="off"
          maxLength={120}
        />
      </FieldGroup>
      <section
        aria-label="Termos da posição"
        className="rounded-2xl border border-border p-4"
      >
        <h3 className="text-sm font-medium">Termos da posição</h3>
        {terms.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum termo adicional foi informado.
          </p>
        ) : (
          <dl className="mt-3 grid gap-2 text-sm">
            {terms.map((term) => (
              <div key={term.label} className="grid gap-1 sm:grid-cols-2">
                <dt className="text-muted-foreground">{term.label}</dt>
                <dd>{term.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Quantidade, custo e revisão de alocação são termos imutáveis neste
          formulário.
        </p>
      </section>
      <div className="flex flex-wrap justify-end gap-3">
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
          {pending ? "Salvando rótulo" : "Salvar rótulo"}
        </Button>
      </div>
    </form>
  )
}
