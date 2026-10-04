import { describe, expect, it } from "vitest";

import { CATEGORY_ICON_KEYS } from "@/lib/domain/categoryIcons";
import {
  HOME_COPY,
  ICON_LABELS,
  PROFILE_COPY,
  announceDragCancel,
  announceDragEnd,
  announceDragOver,
  announceDragStart,
  archiveCategoryConfirmTitle,
  archiveMemberConfirmTitle,
  balanceLabel,
  cardSpentLine,
} from "@/lib/copy/es";

describe("home copy functions", () => {
  it("builds the balance label with a lower-case month name", () => {
    expect(balanceLabel("Octubre")).toBe("Balance de octubre");
  });

  it("builds the card spent line", () => {
    expect(cardSpentLine("$800", "$1.000")).toBe("gastado $800 de $1.000");
  });

  it("announces drag start with the position", () => {
    expect(announceDragStart("Comida", 2, 5)).toBe("Se tomó Comida. Posición 2 de 5.");
  });

  it("announces drag over with and without a target", () => {
    expect(announceDragOver("Comida", 3, 5)).toBe("Comida está sobre la posición 3 de 5.");
    expect(announceDragOver("Comida", null, 5)).toBe("Comida no está sobre ninguna posición.");
  });

  it("announces drag end with and without a target", () => {
    expect(announceDragEnd("Comida", 1, 5)).toBe("Se soltó Comida en la posición 1 de 5.");
    expect(announceDragEnd("Comida", null, 5)).toBe("Se soltó Comida sin cambios.");
  });

  it("announces drag cancel with the original position", () => {
    expect(announceDragCancel("Comida", 4, 5)).toBe(
      "Se canceló el movimiento. Comida volvió a la posición 4 de 5.",
    );
  });

  it("exposes the fixed strings", () => {
    expect(HOME_COPY.cardRoleDescription).toBe("categoría reordenable");
    expect(HOME_COPY.greeting).toBe("¡Buenas!");
  });
});

describe("profile copy", () => {
  it("builds the archive confirmation titles", () => {
    expect(archiveMemberConfirmTitle("Ana")).toBe("¿Archivar a Ana?");
    expect(archiveCategoryConfirmTitle("Comida")).toBe("¿Archivar la categoría Comida?");
  });

  it("exposes the section titles", () => {
    expect(PROFILE_COPY.title).toBe("Perfil");
    expect(PROFILE_COPY.themeSection).toBe("Tema");
  });
});

describe("ICON_LABELS", () => {
  it("has a non-empty label for each of the 21 icon keys and nothing else", () => {
    expect(Object.keys(ICON_LABELS).sort()).toEqual([...CATEGORY_ICON_KEYS].sort());
    for (const key of CATEGORY_ICON_KEYS) {
      expect(ICON_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
