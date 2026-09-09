/* @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ColorPicker,
  useColorPicker,
} from "@workspace/ui/components/color-picker"

function ColorStateProbe() {
  const { alpha, hue, lightness, saturation, setHue } = useColorPicker()

  return (
    <>
      <output data-testid="hue">{hue}</output>
      <output data-testid="saturation">{saturation}</output>
      <output data-testid="lightness">{lightness}</output>
      <output data-testid="alpha">{alpha}</output>
      <button type="button" onClick={() => setHue(hue + 1)}>
        Change hue
      </button>
    </>
  )
}

function renderColorPicker(
  value: string,
  onChange: (value: unknown) => void = vi.fn()
) {
  return render(
    <ColorPicker value={value} onChange={onChange}>
      <ColorStateProbe />
    </ColorPicker>
  )
}

describe("ColorPicker", () => {
  afterEach(() => cleanup())

  it("reconstructs HSL channels and alpha from the controlled value", () => {
    const onChange = vi.fn()

    renderColorPicker("rgba(0, 255, 0, 0.4)", onChange)

    expect(screen.getByTestId("hue").textContent).toBe("120")
    expect(screen.getByTestId("saturation").textContent).toBe("100")
    expect(screen.getByTestId("lightness").textContent).toBe("50")
    expect(screen.getByTestId("alpha").textContent).toBe("40")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("updates HSL channels when an external value changes", () => {
    const onChange = vi.fn()
    const view = renderColorPicker("#336699", onChange)

    expect(screen.getByTestId("hue").textContent).toBe("210")
    expect(Number(screen.getByTestId("saturation").textContent)).toBeCloseTo(50)
    expect(screen.getByTestId("lightness").textContent).toBe("40")

    act(() => {
      view.rerender(
        <ColorPicker value="#000000" onChange={onChange}>
          <ColorStateProbe />
        </ColorPicker>
      )
    })

    expect(screen.getByTestId("hue").textContent).toBe("0")
    expect(screen.getByTestId("saturation").textContent).toBe("0")
    expect(screen.getByTestId("lightness").textContent).toBe("0")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not echo a controlled reset as a divergent change", () => {
    const onChange = vi.fn()
    const view = renderColorPicker("#123456", onChange)

    fireEvent.click(screen.getByRole("button", { name: "Change hue" }))
    return waitFor(() => expect(onChange).toHaveBeenCalledOnce()).then(() => {
      onChange.mockClear()

      act(() => {
        view.rerender(
          <ColorPicker value="#336699" onChange={onChange}>
            <ColorStateProbe />
          </ColorPicker>
        )
      })

      expect(screen.getByTestId("hue").textContent).toBe("210")
      expect(Number(screen.getByTestId("saturation").textContent)).toBeCloseTo(
        50
      )
      expect(screen.getByTestId("lightness").textContent).toBe("40")
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it("emits only the changed RGB value after user interaction", async () => {
    const onChange = vi.fn()

    renderColorPicker("#336699", onChange)
    fireEvent.click(screen.getByRole("button", { name: "Change hue" }))

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    const [red, green, blue, emittedAlpha] = onChange.mock
      .calls[0][0] as number[]
    expect(red).toBeCloseTo(51)
    expect(green).toBeCloseTo(100.3)
    expect(blue).toBeCloseTo(153)
    expect(emittedAlpha).toBe(1)
  })
})
