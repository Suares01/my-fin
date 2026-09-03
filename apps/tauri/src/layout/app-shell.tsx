"use client"

import {
  ArrowLeftRight,
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  LayoutDashboard,
  Landmark,
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
    title: string
    description: string
  }
  // Main navigation groups (all sidebars)
  navGroups: NavGroup[]
}

// Shared sidebar data - works with all sidebar variations
const sidebarData = {
  logo: {
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
        {
          label: "Transações",
          icon: ArrowLeftRight,
          href: "/transactions",
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
        <SidebarMenuButton
          size="lg"
          tooltip="Ir para o dashboard"
          render={<Link to="/dashboard" />}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-primary">
            <Landmark
              className="size-4 text-primary-foreground"
              aria-hidden="true"
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
        <SidebarMenuButton
          render={<Link to={item.href} />}
          isActive={isActive}
          tooltip={item.label}
        >
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
                isActive={location.pathname === child.href}
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
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarLogo logo={sidebarData.logo} />
      </SidebarHeader>
      <SidebarContent>
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
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink render={<Link to="/dashboard" />}>
            {group.title}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`
          const isLast = index === pathnames.length - 1
          const label = index === 0 ? item.label : value

          return (
            <React.Fragment key={to}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link to={to} />}>
                    {label}
                  </BreadcrumbLink>
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
    <SidebarProvider className={cn("my-fin-shell", className)}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/80">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 h-4 data-[orientation=vertical]:h-4"
            />
            <AutoBreadcrumb />
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 sm:p-6">
          <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
