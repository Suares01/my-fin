async function investmentsBrowserUat(page) {
  const actionName = "Ações da posição CDB A — Reserva 2028"
  const action = () => page.getByRole("button", { name: actionName })
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  for (const width of [360, 800, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.reload()
    await action().waitFor()

    const before = await page.evaluate(() => {
      const table = document.querySelector('[data-slot="table-container"]')
      const responsiveList = document.querySelector(
        '[data-layout="responsive"]'
      )
      const button = document.querySelector('[aria-label^="Ações da posição"]')
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        tableWidth: table?.clientWidth,
        tableScrollWidth: table?.scrollWidth,
        responsiveList: responsiveList !== null,
        actionRight: button?.getBoundingClientRect().right,
      }
    })
    assert(before.documentWidth <= width, `${width}px: page overflows`)
    assert(before.bodyWidth <= width, `${width}px: body overflows`)
    assert(before.responsiveList, `${width}px: responsive list is missing`)
    assert(
      before.tableScrollWidth <= before.tableWidth + 1,
      `${width}px: position list still requires horizontal scrolling`
    )
    assert(
      before.actionRight <= width,
      `${width}px: position action is outside the viewport`
    )

    const management = page.getByRole("button", { name: "Gerenciar" })
    await management.click()
    await page
      .getByRole("heading", { name: "Carteiras e instrumentos" })
      .waitFor()
    await management.click()
    await page
      .getByRole("heading", { name: "Carteiras e instrumentos" })
      .waitFor({ state: "hidden" })

    await action().click()
    await page.getByRole("menu", { name: actionName }).waitFor()
    const afterAction = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      activeActionVisible:
        document
          .querySelector('[aria-label^="Ações da posição"]')
          ?.getBoundingClientRect().right ?? Infinity,
    }))
    assert(
      afterAction.activeActionVisible <= width,
      `${width}px: position action remains offscreen`
    )
    assert(
      afterAction.documentWidth <= width,
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
    const createDialog = page.getByRole("dialog", {
      name: "Novo investimento",
    })
    await createDialog.waitFor()
    assert(
      (await createDialog.getByLabel("Valor atual estimado").count()) === 0,
      `${width}px: valuation field is still exposed`
    )

    const instrumentSearch = createDialog.getByRole("textbox", {
      name: "Instrumento",
    })
    await instrumentSearch.fill("CDB")
    await createDialog.getByRole("option", { name: /CDB A/ }).click()
    await createDialog.getByRole("combobox", { name: "Carteira" }).click()
    await page.getByRole("option", { name: "Corretora A" }).click()
    await createDialog.getByRole("button", { name: "Continuar" }).click()

    const cost = createDialog.getByRole("textbox", {
      name: "Custo contábil",
    })
    await cost.fill("100,00")
    await createDialog.getByLabel("Data da abertura").fill("2026-10-02")
    await createDialog
      .getByRole("button", { name: "Detalhes avançados" })
      .click()
    const positionLabel = createDialog.getByRole("textbox", {
      name: "Rótulo da posição",
    })
    await positionLabel.fill("Reserva progressiva")
    await createDialog.getByRole("button", { name: "Continuar" }).click()
    await createDialog.getByRole("button", { name: "Continuar" }).click()

    await createDialog
      .getByRole("heading", { name: "Revise antes de confirmar" })
      .waitFor()
    await createDialog.getByText("Custo alocado").waitFor()
    assert(
      await createDialog
        .getByRole("button", { name: "Confirmar investimento" })
        .isEnabled(),
      `${width}px: confirmation is not enabled after a valid preview`
    )

    await createDialog.getByRole("button", { name: "Voltar" }).click()
    await createDialog.getByRole("button", { name: "Voltar" }).click()
    await createDialog
      .getByRole("button", { name: "Detalhes avançados" })
      .click()
    assert(
      (await cost.inputValue()) === "100,00" &&
        (await createDialog
          .getByRole("textbox", { name: "Rótulo da posição" })
          .inputValue()) === "Reserva progressiva",
      `${width}px: progressive form did not retain the draft`
    )
    await createDialog.getByRole("button", { name: "Continuar" }).click()
    await createDialog.getByRole("button", { name: "Continuar" }).click()
    await createDialog
      .getByRole("button", { name: "Confirmar investimento" })
      .click()
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
        ...afterAction,
        managementProgressiveDisclosure: "PASS",
        progressiveRegistration: "PASS",
        draftRetention: "PASS",
        accountingReview: "PASS",
        keyboardAndFocus: "PASS",
      })
    )
  }
}
