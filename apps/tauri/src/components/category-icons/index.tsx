import { Aeroplane } from "./aeroplane"
import { BadgeDecagramPercent } from "./badge-decagram-percent"
import { BarChartDollar } from "./bar-chart-dollar"
import { BasketShopping } from "./basket-shopping"
import { Bike } from "./bike"
import { Book } from "./book"
import { BoxGift } from "./box-gift"
import { BriefcasePlus } from "./briefcase-plus"
import { Briefcase } from "./briefcase"
import { BurgerDrink } from "./burger-drink"
import { Bus } from "./bus"
import { BusketBall } from "./busket-ball"
import { Cake } from "./cake"
import { CalendarDays } from "./calendar-days"
import { Capsule } from "./capsule"
import { Car } from "./car"
import { Cart } from "./cart"
import { CertificateBadge } from "./certificate-badge"
import { Cloud } from "./cloud"
import { CreditCardMultiple } from "./credit-card-multiple"
import { DollarCircle } from "./dollar-circle"
import { RefreshCircle } from "./refresh-circle"
import { LinkAngularRight } from "./link-angular-right"
import { Dollar } from "./dollar"
import { Dumbbell } from "./dumbbell"
import { Ellipsis } from "./ellipsis"
import { GamePad } from "./game-pad"
import { GraduationCap } from "./graduation-cap"
import { HandTakingDollar } from "./hand-taking-dollar"
import { Home } from "./home"
import { Hospital } from "./hospital"
import { Island } from "./island"
import { KnifeFork } from "./knife-fork"
import { LabelDollar } from "./label-dollar"
import { MapMarker } from "./map-marker"
import { Monitor } from "./monitor"
import { Pencil } from "./pencil"
import { Notebook } from "./notebook"
import { PawPrint } from "./paw-print"
import { RefreshDollar } from "./refresh-dollar"
import { Stopwatch } from "./stopwatch"
import { Pix } from "./pix"
import { Shirt } from "./shirt"
import { Surfboard } from "./surfboard"
import { Tickets } from "./tickets"
import { Train } from "./train"
import { Trophy } from "./trophy"
import { Wallet } from "./wallet"
import { WheelbarrowEmpty } from "./wheelbarrow-empty"

import type { CategoryIconComponent } from "./types"

export type { CategoryIconComponent, CategoryIconProps } from "./types"

export const categoryIconNames = [
  "aeroplane",
  "badge-decagram-percent",
  "bar-chart-dollar",
  "basket-shopping",
  "bike",
  "book",
  "box-gift",
  "briefcase-plus",
  "briefcase",
  "burger-drink",
  "bus",
  "busket-ball",
  "cake",
  "calendar-days",
  "capsule",
  "car",
  "cart",
  "certificate-badge",
  "cloud",
  "credit-card-multiple",
  "dollar-circle",
  "refresh-circle",
  "link-angular-right",
  "dollar",
  "dumbbell",
  "ellipsis",
  "game-pad",
  "graduation-cap",
  "hand-taking-dollar",
  "home",
  "hospital",
  "island",
  "knife-fork",
  "label-dollar",
  "map-marker",
  "monitor",
  "pencil",
  "notebook",
  "paw-print",
  "refresh-dollar",
  "stopwatch",
  "pix",
  "shirt",
  "surfboard",
  "tickets",
  "train",
  "trophy",
  "wallet",
  "wheelbarrow-empty",
] as const

export type CategoryIconName = (typeof categoryIconNames)[number]

export type CategoryIconEntry = {
  name: CategoryIconName
  Icon: CategoryIconComponent
}

export const categoryIconsLibrary = {
  aeroplane: Aeroplane,
  "badge-decagram-percent": BadgeDecagramPercent,
  "bar-chart-dollar": BarChartDollar,
  "basket-shopping": BasketShopping,
  bike: Bike,
  book: Book,
  "box-gift": BoxGift,
  "briefcase-plus": BriefcasePlus,
  briefcase: Briefcase,
  "burger-drink": BurgerDrink,
  bus: Bus,
  "busket-ball": BusketBall,
  cake: Cake,
  "calendar-days": CalendarDays,
  capsule: Capsule,
  car: Car,
  cart: Cart,
  "certificate-badge": CertificateBadge,
  cloud: Cloud,
  "credit-card-multiple": CreditCardMultiple,
  "dollar-circle": DollarCircle,
  "refresh-circle": RefreshCircle,
  "link-angular-right": LinkAngularRight,
  dollar: Dollar,
  dumbbell: Dumbbell,
  ellipsis: Ellipsis,
  "game-pad": GamePad,
  "graduation-cap": GraduationCap,
  "hand-taking-dollar": HandTakingDollar,
  home: Home,
  hospital: Hospital,
  island: Island,
  "knife-fork": KnifeFork,
  "label-dollar": LabelDollar,
  "map-marker": MapMarker,
  monitor: Monitor,
  pencil: Pencil,
  notebook: Notebook,
  "paw-print": PawPrint,
  "refresh-dollar": RefreshDollar,
  stopwatch: Stopwatch,
  pix: Pix,
  shirt: Shirt,
  surfboard: Surfboard,
  tickets: Tickets,
  train: Train,
  trophy: Trophy,
  wallet: Wallet,
  "wheelbarrow-empty": WheelbarrowEmpty,
} satisfies Record<CategoryIconName, CategoryIconComponent>

const categoryIconLookup: Readonly<
  Record<string, CategoryIconComponent | undefined>
> = categoryIconsLibrary

const categoryIconEntries: CategoryIconEntry[] = categoryIconNames.map(
  (name) => ({
    name,
    Icon: categoryIconsLibrary[name],
  })
)

export function isCategoryIconName(
  name: string | null | undefined
): name is CategoryIconName {
  return Boolean(name && categoryIconLookup[name])
}

export function getCategoryIcon(
  name: string | null | undefined
): CategoryIconComponent | undefined {
  if (!name) return undefined

  return categoryIconLookup[name]
}

export function getCategoryIconOrFallback(
  name: string | null | undefined,
  fallback: CategoryIconName = "label-dollar"
): CategoryIconComponent {
  return getCategoryIcon(name) ?? categoryIconsLibrary[fallback]
}

export function getCategoryIconEntries(): CategoryIconEntry[] {
  return [...categoryIconEntries]
}
