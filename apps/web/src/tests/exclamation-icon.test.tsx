import { faExclamation } from "@fortawesome/free-solid-svg-icons";
import { describe, expect, it } from "vitest";
import { ExclamationIcon } from "../app/components/icons/ExclamationIcon";
import { render } from "./render";

describe("Font Awesome exclamation glyph", () => {
  it("preserves the official paths, proportions and themed size", async () => {
    const mounted = await render(<ExclamationIcon size={16} color="red" />);
    try {
      const svg = mounted.container.querySelector("svg");
      if (!svg) throw new Error("Missing exclamation glyph");
      expect(svg.getAttribute("viewBox")).toBe(
        `0 0 ${faExclamation.icon[0]} ${faExclamation.icon[1]}`,
      );
      expect(svg.getAttribute("width")).toBe(
        `${faExclamation.icon[0] / faExclamation.icon[1]}em`,
      );
      expect(svg.getAttribute("height")).toBe("1em");
      expect(svg.style.fontSize).toBe("16px");
      expect(svg.style.color).toBe("red");
      expect(svg.querySelector("path")?.getAttribute("d")).toBe(
        faExclamation.icon[4],
      );
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    } finally {
      await mounted.unmount();
    }
  });

  it("exposes a named warning when it is meaningful on its own", async () => {
    const mounted = await render(<ExclamationIcon title="Needs attention" />);
    try {
      const svg = mounted.container.querySelector("svg");
      if (!svg) throw new Error("Missing exclamation glyph");
      expect(svg.getAttribute("role")).toBe("img");
      expect(svg.querySelector("title")?.textContent).toBe("Needs attention");
      expect(svg.hasAttribute("aria-hidden")).toBe(false);
    } finally {
      await mounted.unmount();
    }
  });
});
