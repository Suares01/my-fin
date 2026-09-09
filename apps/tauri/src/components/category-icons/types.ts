import type { ReactElement, SVGProps } from "react"

export type CategoryIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number | string
  color?: string
}

export type CategoryIconComponent = (props: CategoryIconProps) => ReactElement
