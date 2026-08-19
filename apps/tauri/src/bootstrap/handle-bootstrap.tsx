import { useEffect } from "react"
import { useNavigate } from "react-router"

import reactLogo from "../assets/react.svg"
import { useBooks } from "../features/books/hooks/index.js"

export function HandleBootstrap() {
  const booksQuery = useBooks()
  const navigate = useNavigate()

  useEffect(() => {
    if (!booksQuery.data || booksQuery.data.length < 2) return

    void navigate("/books", { replace: true })
  }, [booksQuery.data, navigate])

  return (
    <main
      className="flex min-h-dvh w-full items-center justify-center"
      aria-label="Preparando a aplicação"
      aria-busy="true"
    >
      <img src={reactLogo} alt="My Fin" className="size-24" />
    </main>
  )
}
