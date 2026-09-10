"use client"

import { useState } from "react"

import {
  BookUserIcon,
  CheckIcon,
  CreditCardIcon,
  LoaderCircleIcon,
  LockIcon,
} from "lucide-react"

import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@workspace/ui/components/reui/stepper"
import { Badge } from "@workspace/ui/components/reui/badge"
import { Button } from "@workspace/ui/components/button"

const steps = [
  {
    title: "User Details",
    icon: <BookUserIcon className="size-4" />,
  },
  {
    title: "Payment Info",
    icon: <CreditCardIcon className="size-4" />,
  },
  {
    title: "Auth OTP",
    icon: <LockIcon className="size-4" />,
  },
]

export function Pattern() {
  const [currentStep, setCurrentStep] = useState(2)

  return (
    <Stepper
      value={currentStep}
      onValueChange={setCurrentStep}
      indicators={{
        completed: <CheckIcon className="size-3.5" />,
        loading: <LoaderCircleIcon className="size-3.5 animate-spin" />,
      }}
      className="w-full max-w-xl space-y-8"
    >
      <StepperNav className="gap-3">
        {steps.map((step, index) => (
          <StepperItem
            key={index}
            step={index + 1}
            className="relative flex-1 items-start"
          >
            <StepperTrigger className="flex grow flex-col items-start justify-center gap-2.5">
              <StepperIndicator className="size-8 border-2 data-[state=completed]:bg-success data-[state=completed]:text-white data-[state=inactive]:border-border data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">
                {step.icon}
              </StepperIndicator>
              <div className="flex flex-col items-start gap-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Step {index + 1}
                </div>
                <StepperTitle className="text-start text-base font-semibold group-data-[state=inactive]/step:text-muted-foreground">
                  {step.title}
                </StepperTitle>
                <div>
                  <Badge
                    size="sm"
                    variant="primary-light"
                    className="hidden group-data-[state=active]/step:inline-flex"
                  >
                    In Progress
                  </Badge>
                  <Badge
                    variant="success-light"
                    size="sm"
                    className="hidden group-data-[state=completed]/step:inline-flex"
                  >
                    Completed
                  </Badge>
                  <Badge
                    variant="secondary"
                    size="sm"
                    className="hidden text-muted-foreground group-data-[state=inactive]/step:inline-flex"
                  >
                    Pending
                  </Badge>
                </div>
              </div>
            </StepperTrigger>

            {steps.length > index + 1 && (
              <StepperSeparator className="absolute inset-x-0 start-9 top-4 m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none group-data-[state=completed]/step:bg-success" />
            )}
          </StepperItem>
        ))}
      </StepperNav>

      <StepperPanel className="text-sm">
        {steps.map((step, index) => (
          <StepperContent
            key={index}
            value={index + 1}
            className="flex items-center justify-center"
          >
            {step.title} content
          </StepperContent>
        ))}
      </StepperPanel>

      <div className="flex items-center justify-between gap-2.5">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => prev - 1)}
          disabled={currentStep === 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => prev + 1)}
          disabled={currentStep === steps.length}
        >
          Next
        </Button>
      </div>
    </Stepper>
  )
}
