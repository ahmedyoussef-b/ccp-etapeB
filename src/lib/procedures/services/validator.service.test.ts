import { describe, it, expect } from "vitest";
import {
  ProcedureSchema,
  MetadataSchema,
  StepSchema,
  MediaRequirementSchema,
  AlarmConfigSchema,
  validateProcedure,
  validateStep,
  hasCircularDependencies,
  getCompleteness,
  type TProcedure,
  type TStep,
} from "@/lib/procedures/services/validator.service";

const validMetadata = {
  title: "Test Procedure",
  code: "TEST-001",
  category: "production",
  priority: "moyenne" as const,
  estimatedTimeMinutes: 30,
  requiredRoles: ["admin"],
  globalSafetyInstructions: ["Wear PPE"],
};

const validStep: TStep = {
  id: "step_1",
  title: "First Step",
  instructions: "Do something",
  type: "consigne_simple",
  isMandatory: false,
  dependencies: [],
  mediaRequirements: [],
  alarms: [],
  attachments: [],
  order: 0,
  timerEnabled: false,
  timerSeconds: 0,
};

describe("Validator Service", () => {
  describe("MetadataSchema", () => {
    it("should validate correct metadata", () => {
      expect(() => MetadataSchema.parse(validMetadata)).not.toThrow();
    });

    it("should reject missing title", () => {
      expect(() =>
        MetadataSchema.parse({ ...validMetadata, title: "" })
      ).toThrow();
    });

    it("should reject missing code", () => {
      expect(() =>
        MetadataSchema.parse({ ...validMetadata, code: "" })
      ).toThrow();
    });

    it("should reject missing category", () => {
      expect(() =>
        MetadataSchema.parse({ ...validMetadata, category: "" })
      ).toThrow();
    });

    it("should reject invalid priority", () => {
      expect(() =>
        MetadataSchema.parse({ ...validMetadata, priority: "invalid" })
      ).toThrow();
    });

    it("should reject estimatedTimeMinutes <= 0", () => {
      expect(() =>
        MetadataSchema.parse({ ...validMetadata, estimatedTimeMinutes: 0 })
      ).toThrow();
    });
  });

  describe("MediaRequirementSchema", () => {
    it("should validate correct media requirement", () => {
      expect(() =>
        MediaRequirementSchema.parse({
          type: "photo",
          mandatory: true,
          options: { geolocation: true, timestamp: false },
        })
      ).not.toThrow();
    });

    it("should reject invalid media type", () => {
      expect(() =>
        MediaRequirementSchema.parse({ type: "invalid" })
      ).toThrow();
    });
  });

  describe("AlarmConfigSchema", () => {
    it("should validate correct alarm config", () => {
      expect(() =>
        AlarmConfigSchema.parse({
          condition: "temperature > 80",
          threshold: "80",
          type: "DANGER",
          message: "High temperature",
        })
      ).not.toThrow();
    });

    it("should reject empty condition", () => {
      expect(() =>
        AlarmConfigSchema.parse({ condition: "", type: "DANGER", message: "Alert" })
      ).toThrow();
    });

    it("should reject empty message", () => {
      expect(() =>
        AlarmConfigSchema.parse({ condition: "x > 1", type: "DANGER", message: "" })
      ).toThrow();
    });
  });

  describe("StepSchema", () => {
    it("should validate correct step", () => {
      expect(() => StepSchema.parse(validStep)).not.toThrow();
    });

    it("should reject missing title", () => {
      expect(() =>
        StepSchema.parse({ ...validStep, title: "" })
      ).toThrow();
    });

    it("should reject missing instructions", () => {
      expect(() =>
        StepSchema.parse({ ...validStep, instructions: "" })
      ).toThrow();
    });

    it("should reject invalid type", () => {
      expect(() =>
        StepSchema.parse({ ...validStep, type: "invalid" })
      ).toThrow();
    });

    it("should reject negative order", () => {
      expect(() =>
        StepSchema.parse({ ...validStep, order: -1 })
      ).toThrow();
    });

    it("should reject negative timerSeconds", () => {
      expect(() =>
        StepSchema.parse({ ...validStep, timerSeconds: -1 })
      ).toThrow();
    });
  });

  describe("ProcedureSchema", () => {
    it("should validate correct procedure", () => {
      const procedure: TProcedure = {
        metadata: validMetadata,
        steps: [validStep],
      };
      expect(() => ProcedureSchema.parse(procedure)).not.toThrow();
    });

    it("should reject procedure with no steps", () => {
      const procedure: TProcedure = {
        metadata: validMetadata,
        steps: [],
      };
      expect(() => ProcedureSchema.parse(procedure)).toThrow();
    });
  });

  describe("validateProcedure", () => {
    it("should return validated procedure", () => {
      const procedure: TProcedure = {
        metadata: validMetadata,
        steps: [validStep],
      };
      const result = validateProcedure(procedure);
      expect(result.metadata.code).toBe("TEST-001");
      expect(result.steps).toHaveLength(1);
    });

    it("should throw on invalid data", () => {
      expect(() => validateProcedure({ metadata: validMetadata, steps: [] })).toThrow();
    });
  });

  describe("validateStep", () => {
    it("should return validated step", () => {
      const result = validateStep(validStep);
      expect(result.title).toBe("First Step");
    });

    it("should throw on invalid step", () => {
      expect(() => validateStep({ ...validStep, title: "" })).toThrow();
    });
  });

  describe("hasCircularDependencies", () => {
    it("should return false for no dependencies", () => {
      const steps: TStep[] = [
        { ...validStep, id: "a", dependencies: [] },
        { ...validStep, id: "b", dependencies: [] },
      ];
      expect(hasCircularDependencies(steps)).toBe(false);
    });

    it("should return false for linear dependencies", () => {
      const steps: TStep[] = [
        { ...validStep, id: "a", dependencies: [] },
        { ...validStep, id: "b", dependencies: ["a"] },
        { ...validStep, id: "c", dependencies: ["b"] },
      ];
      expect(hasCircularDependencies(steps)).toBe(false);
    });

    it("should return true for circular dependency", () => {
      const steps: TStep[] = [
        { ...validStep, id: "a", dependencies: ["c"] },
        { ...validStep, id: "b", dependencies: ["a"] },
        { ...validStep, id: "c", dependencies: ["b"] },
      ];
      expect(hasCircularDependencies(steps)).toBe(true);
    });

    it("should return true for self-dependency", () => {
      const steps: TStep[] = [
        { ...validStep, id: "a", dependencies: ["a"] },
      ];
      expect(hasCircularDependencies(steps)).toBe(true);
    });

    it("should return false for empty array", () => {
      expect(hasCircularDependencies([])).toBe(false);
    });
  });

  describe("getCompleteness", () => {
    it("should return 0 for empty array", () => {
      expect(getCompleteness([])).toBe(0);
    });

    it("should return 100 for fully filled steps", () => {
      const steps: TStep[] = [
        { ...validStep, title: "Title", instructions: "Instructions", type: "consigne_simple" },
      ];
      expect(getCompleteness(steps)).toBe(100);
    });

    it("should return 0 for completely empty steps", () => {
      const steps: TStep[] = [
        { ...validStep, title: "", instructions: "", type: "consigne_simple" },
      ];
      expect(getCompleteness(steps)).toBe(0);
    });

  it("should return 50 for half-filled steps", () => {
    const steps: TStep[] = [
      { ...validStep, title: "Title", instructions: "Instructions", type: "consigne_simple" },
      { ...validStep, title: "", instructions: "", type: "consigne_simple" },
    ];
    expect(getCompleteness(steps)).toBe(50);
  });
  });
});
