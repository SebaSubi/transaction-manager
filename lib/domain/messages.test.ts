import { describe, expect, it } from "vitest";

import { VALIDATION_MESSAGES } from "@/lib/domain/messages";
import { NAME_MAX_LENGTH } from "@/lib/domain/validation";

describe("VALIDATION_MESSAGES", () => {
  it("keeps the name length literal in sync with the constant", () => {
    expect(VALIDATION_MESSAGES.nameTooLong).toContain(String(NAME_MAX_LENGTH));
  });

  it("defines the household settings messages", () => {
    expect(VALIDATION_MESSAGES.nameRequired).toBe("El nombre es obligatorio.");
    expect(VALIDATION_MESSAGES.lastActiveMember).toBe(
      "No se puede archivar a la última persona activa.",
    );
    expect(VALIDATION_MESSAGES.cardOrderSaveFailed).toBe("No se pudo guardar el orden.");
  });
});
