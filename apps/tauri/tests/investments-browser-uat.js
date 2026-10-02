;async (page) => {
  const actionName = "Ações da posição CDB A — Reserva 2028"
  const action = () => page.getByRole("button", { name: actionName })
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.reload()
    await action().waitFor()

    const before = await page.evaluate(() => {
      const table = document.querySelector('[data-slot="table-container"]')
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        tableWidth: table?.clientWidth,
        tableScrollWidth: table?.scrollWidth,
      }
    })
    assert(before.documentWidth <= width, `${width}px: page overflows`)
    assert(before.bodyWidth <= width, `${width}px: body overflows`)
    assert(
      before.tableScrollWidth > before.tableWidth,
      `${width}px: table cannot scroll internally`
    )

    await action().click()
    await page.getByRole("menu", { name: actionName }).waitFor()
    const afterScroll = await page.evaluate(() => {
      const table = document.querySelector('[data-slot="table-container"]')
      const button = document.querySelector('[aria-label^="Ações da posição"]')
      return {
        tableScrollLeft: table?.scrollLeft,
        actionRight: button?.getBoundingClientRect().right,
        documentWidth: document.documentElement.scrollWidth,
      }
    })
    assert(
      afterScroll.tableScrollLeft > 0,
      `${width}px: action was not reached by table scrolling`
    )
    assert(
      afterScroll.actionRight <= width,
      `${width}px: position action remains offscreen`
    )
    assert(
      afterScroll.documentWidth <= width,
      `${width}px: menu causes page overflow`
    )

    await page.keyboard.press("Escape")
    await page
      .getByRole("menu", { name: actionName })
      .waitFor({ state: "hidden" })
    await page.waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector('[aria-label^="Ações da posição"]')
    )
    await page.keyboard.press("Enter")
    await page.keyboard.press("End")
    assert(
      await page
        .getByRole("menuitem", { name: "Configurar posição" })
        .evaluate((item) => item === document.activeElement),
      `${width}px: keyboard cannot reach the last action`
    )
    await page.keyboard.press("Enter")
    await page.getByRole("dialog", { name: "Editar rótulo" }).waitFor()
    const label = page.getByRole("textbox", { name: "Rótulo da posição" })
    await label.fill("Rótulo conferido")
    assert(
      (await label.inputValue()) === "Rótulo conferido",
      `${width}px: controlled form did not retain input`
    )
    await page.keyboard.press("Escape")
    await page
      .getByRole("dialog", { name: "Editar rótulo" })
      .waitFor({ state: "hidden" })
    await page.waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector('[aria-label^="Ações da posição"]')
    )

    const create = page.getByRole("button", { name: "Novo investimento" })
    await create.click()
    await page.getByRole("dialog", { name: "Novo investimento" }).waitFor()
    await page.keyboard.press("Escape")
    await page
      .getByRole("dialog", { name: "Novo investimento" })
      .waitFor({ state: "hidden" })
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Novo investimento"
    )

    console.log(
      JSON.stringify({
        width,
        ...before,
        ...afterScroll,
        keyboardAndFocus: "PASS",
      })
    )
  }
}
