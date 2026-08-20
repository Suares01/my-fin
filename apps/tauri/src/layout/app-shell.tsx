"use client"

import {
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  LayoutDashboard,
  Plus,
  Tags,
  WalletCards,
} from "lucide-react"
import * as React from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import { Link, Outlet, useLocation } from "react-router"
import { useBooks } from "../features/books/hooks"
import { useActiveBook } from "../providers"
import { BOOK_SWITCHER_NAVIGATION_STATE } from "../features/books/hooks/use-book-page-navigation"
import { useBookRouteNavigation } from "../features/books/hooks/use-book-route-navigation"

// Base nav item - used by simple sidebars
type NavItem = {
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  href: string
  isActive?: boolean
  // Optional children for submenus (Sidebar3+)
  children?: NavItem[]
}

// Nav group with optional collapsible state
type NavGroup = {
  title: string
  items: NavItem[]
  // Optional: default collapsed state (Sidebar2+)
  defaultOpen?: boolean
}

// Complete sidebar data structure
type SidebarData = {
  // Logo/branding (all sidebars)
  logo: {
    src: string
    alt: string
    title: string
    description: string
  }
  // Main navigation groups (all sidebars)
  navGroups: NavGroup[]
}

// Shared sidebar data - works with all sidebar variations
const sidebarData = {
  logo: {
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
    alt: "My Fin",
    title: "My Fin",
    description: "Total controle das suas finanças",
  },
  navGroups: [
    {
      title: "Visão Geral",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          href: "/dashboard",
        },
      ],
    },
    {
      title: "Organização",
      items: [
        { label: "Categorias", icon: Tags, href: "/categories" },
        { label: "Contas", icon: WalletCards, href: "/accounts" },
      ],
    },
  ],
}

const SidebarLogo = ({ logo }: { logo: SidebarData["logo"] }) => {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary">
            <img
              src={logo.src}
              alt={logo.alt}
              className="size-6 text-primary-foreground invert dark:invert-0"
            />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-medium">{logo.title}</span>
            <span className="text-xs text-muted-foreground">
              {logo.description}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

const NavMenuItem = ({ item }: { item: NavItem }) => {
  const location = useLocation()

  const Icon = item.icon
  const hasChildren = item.children && item.children.length > 0
  const isActive = location.pathname === item.href

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton render={<Link to={item.href} />} isActive={isActive}>
          <Icon className="size-4" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      render={<SidebarMenuItem />}
      defaultOpen
      className="group/collapsible"
    >
      <CollapsibleTrigger
        render={<SidebarMenuButton isActive={item.isActive} />}
      >
        <Icon className="size-4" />
        <span>{item.label}</span>
        <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.children!.map((child) => (
            <SidebarMenuSubItem key={child.label}>
              <SidebarMenuSubButton
                render={<Link to={child.href} />}
                isActive={child.isActive}
              >
                {child.label}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

export const NavBookSwitcher = () => {
  const booksQuery = useBooks()
  const { session } = useActiveBook()
  const { activateAndOpenDashboard } = useBookRouteNavigation()
  const activeBookId = session.status === "ACTIVE" ? session.bookId : ""
  const activeBook = booksQuery.data?.find((book) => book.id === activeBookId)

  function selectBook(bookId: string): void {
    activateAndOpenDashboard(bookId)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                aria-label="Trocar livro financeiro"
              />
            }
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BookOpen aria-hidden="true" />
            </div>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {activeBook?.name ??
                  (booksQuery.isPending ? "Carregando livros" : "Seus livros")}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {activeBook
                  ? `${activeBook.baseCurrency} · ${activeBook.timezone}`
                  : "Contexto financeiro local"}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64 rounded-lg"
            side="top"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Livros financeiros</DropdownMenuLabel>
              {booksQuery.isPending && (
                <DropdownMenuItem disabled>
                  Carregando seus livros...
                </DropdownMenuItem>
              )}
              {booksQuery.isError && (
                <DropdownMenuItem disabled>
                  Não foi possível carregar seus livros.
                </DropdownMenuItem>
              )}
              {!booksQuery.isPending &&
                !booksQuery.isError &&
                booksQuery.data?.length === 0 && (
                  <DropdownMenuItem disabled>
                    Nenhum livro disponível.
                  </DropdownMenuItem>
                )}
              {!booksQuery.isPending &&
                !booksQuery.isError &&
                booksQuery.data &&
                booksQuery.data.length > 0 && (
                  <DropdownMenuRadioGroup
                    value={activeBookId}
                    onValueChange={selectBook}
                  >
                    {booksQuery.data.map((book) => (
                      <DropdownMenuRadioItem key={book.id} value={book.id}>
                        <BookOpen aria-hidden="true" />
                        <span className="min-w-0 truncate">
                          <span className="block truncate">{book.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {book.baseCurrency} · {book.timezone}
                          </span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              <DropdownMenuSeparator />

              <DropdownMenuItem
                render={
                  <Link
                    to="/books/new"
                    state={BOOK_SWITCHER_NAVIGATION_STATE}
                  />
                }
              >
                <Plus /> Novo Livro
              </DropdownMenuItem>
              {booksQuery.data && booksQuery.data.length > 1 && (
                <DropdownMenuItem
                  render={
                    <Link to="/books" state={BOOK_SWITCHER_NAVIGATION_STATE} />
                  }
                >
                  Ver todos os livros
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarLogo logo={sidebarData.logo} />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          {sidebarData.navGroups.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavMenuItem key={item.label} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavBookSwitcher />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AutoBreadcrumb() {
  const location = useLocation()
  const pathnames = location.pathname.split("/").filter((x) => x)

  const route = sidebarData.navGroups
    .flatMap((group) =>
      group.items.map((item) => ({
        group,
        item,
      }))
    )
    .find(({ item }) => item.href === `/${pathnames[0]}`)

  if (!route) {
    return null
  }

  const { group, item } = route

  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">{group.title}</BreadcrumbLink>
        </BreadcrumbItem>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`
          const isLast = index === pathnames.length - 1
          const label = index === 0 ? item.label : value

          return (
            <React.Fragment key={to}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={to}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

interface ApplicationShellProps {
  className?: string
}

export function ApplicationShell({ className }: ApplicationShellProps) {
  return (
    <SidebarProvider className={cn(className)}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 hidden data-[orientation=vertical]:h-4 md:block"
          />
          <a href="#" className="flex items-center gap-2 md:hidden">
            <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary">
              <img
                src={sidebarData.logo.src}
                alt={sidebarData.logo.alt}
                className="size-6 text-primary-foreground invert dark:invert-0"
              />
            </div>
            <span className="font-semibold">{sidebarData.logo.title}</span>
          </a>
          <AutoBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
