import { useId, useRef, useState, type ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Code } from "@workspace/ui/components/code"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { MyFinProviders } from "../providers/index.js"
import { useBootstrap, type UseBootstrapOptions } from "./use-bootstrap.js"
import type { BootstrapError } from "../bootstrap/create-runtime.js"
import { Toaster } from "@workspace/ui/components/toast"

export type BootstrapRootProps = {
  readonly children: ReactNode
  readonly bootstrapOptions?: UseBootstrapOptions
}

export function BootstrapRoot({
  children,
  bootstrapOptions,
}: BootstrapRootProps) {
  const { state, retry } = useBootstrap(bootstrapOptions)

  if (state.status === "STARTING") {
    return <BootstrapStartingScreen attempt={state.attempt} />
  }

  if (state.status === "FAILED") {
    return <BootstrapFailureScreen error={state.error} onRetry={retry} />
  }

  return (
    <>
      <MyFinProviders services={state.runtime.services}>
        {children}
      </MyFinProviders>
      <Toaster />
    </>
  )
}

export function BootstrapStartingScreen({
  attempt,
}: {
  readonly attempt: number
}) {
  return (
    <BootstrapFrame
      eyebrow="My Fin / preparação local"
      title="Preparando seu cofre…"
      description="Estamos verificando o espaço local e preparando o livro financeiro. Seus dados permanecem neste dispositivo."
      labelledBy="bootstrap-starting-title"
    >
      <div
        className="motion-feedback flex items-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-label="Estado da preparação"
        aria-live="polite"
        aria-busy="true"
      >
        <Spinner aria-hidden="true" />
        <span>Verificação em andamento · tentativa {attempt}</span>
      </div>
    </BootstrapFrame>
  )
}

export function BootstrapFailureScreen({
  error,
  onRetry,
}: {
  readonly error: BootstrapError
  readonly onRetry: () => void
}) {
  const [retrying, setRetrying] = useState(false)
  const retryingRef = useRef(false)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  )
  const pageTitleId = useId()
  const alertTitleId = useId()
  const descriptionId = useId()
  const diagnosticId = useId()
  const copyStatusId = useId()

  const handleRetry = () => {
    if (retryingRef.current) {
      return
    }
    retryingRef.current = true
    setRetrying(true)
    onRetry()
  }

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable")
      }
      await navigator.clipboard.writeText(error.diagnosticId)
      setCopyStatus("copied")
    } catch {
      setCopyStatus("failed")
    }
  }

  return (
    <BootstrapFrame
      eyebrow="My Fin / recuperação"
      title="Seu cofre precisa de atenção"
      description="O My Fin não conseguiu preparar o espaço local. Você pode tentar novamente sem apagar o arquivo do cofre."
      labelledBy={pageTitleId}
    >
      <Alert
        variant="destructive"
        aria-labelledby={alertTitleId}
        aria-describedby={descriptionId}
      >
        <AlertTitle id={alertTitleId}>
          Não foi possível preparar o cofre
        </AlertTitle>
        <AlertDescription id={descriptionId}>
          Feche outras instâncias do My Fin, se houver, e tente novamente. Se o
          problema continuar, informe o código diagnóstico ao suporte.
        </AlertDescription>
      </Alert>

      <div className="motion-feedback bg-surface flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Código diagnóstico
          </span>
          <Code
            id={diagnosticId}
            className="block max-w-full break-all"
            aria-label="Código diagnóstico"
          >
            {error.diagnosticId}
          </Code>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="touch-target w-full sm:w-auto"
            onClick={handleCopy}
            variant="outline"
            aria-label="Copiar código diagnóstico"
            aria-describedby={copyStatusId}
          >
            Copiar código
          </Button>
          <Button
            type="button"
            className="touch-target w-full sm:w-auto"
            onClick={handleRetry}
            disabled={retrying}
            aria-busy={retrying}
          >
            {retrying ? <Spinner aria-hidden="true" /> : null}
            {retrying ? "Tentando novamente…" : "Tentar preparar novamente"}
          </Button>
        </div>
        <p
          id={copyStatusId}
          className="min-h-5 text-sm text-muted-foreground"
          role="status"
          aria-label="Resultado da cópia"
          aria-live="polite"
          aria-atomic="true"
        >
          {copyStatus === "copied"
            ? "Código copiado."
            : copyStatus === "failed"
              ? "Não foi possível copiar. Selecione o código manualmente."
              : ""}
        </p>
      </div>
    </BootstrapFrame>
  )
}

function BootstrapFrame({
  eyebrow,
  title,
  description,
  labelledBy,
  children,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly labelledBy: string
  readonly children: ReactNode
}) {
  return (
    <main
      className="safe-area-bottom min-h-dvh overflow-x-clip bg-background text-foreground"
      aria-labelledby={labelledBy}
    >
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 lg:grid-cols-[minmax(14rem,0.4fr)_minmax(0,1fr)]">
        <aside className="bg-surface/60 hidden border-r border-border p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3 text-sm font-medium tracking-[0.08em] uppercase">
            <span
              className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              ◌
            </span>
            My Fin
          </div>
          <div className="max-w-48">
            <p className="font-display text-3xl leading-tight text-primary">
              Clareza para cada lançamento.
            </p>
            <Separator className="my-5" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Um livro local, uma trilha confiável, nenhum ruído entre você e o
              saldo.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            LOCAL / LEDGER
          </p>
        </aside>
        <section className="motion-reveal flex min-h-dvh min-w-0 items-center px-6 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-xl min-w-0">
            <p className="mb-5 text-xs font-medium tracking-[0.16em] text-primary uppercase">
              {eyebrow}
            </p>
            <h1
              id={labelledBy}
              className="font-display max-w-lg text-5xl leading-[0.98] tracking-[-0.03em] text-balance sm:text-6xl"
            >
              {title}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {description}
            </p>
            <div className="mt-10">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
