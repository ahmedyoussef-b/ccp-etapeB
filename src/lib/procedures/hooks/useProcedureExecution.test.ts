import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProcedureExecution } from "@/lib/procedures/hooks/useProcedureExecution";
import type { TProcedure } from "@/lib/procedures/services/validator.service";

const mockProcedure: TProcedure = {
  metadata: {
    title: "Test Procedure",
    code: "TEST-001",
    category: "production",
    priority: "moyenne",
    estimatedTimeMinutes: 30,
    requiredRoles: ["admin"],
    globalSafetyInstructions: ["Safety first"],
  },
  steps: [
    {
      id: "step_1",
      title: "Step 1",
      instructions: "Do step 1",
      type: "consigne_simple",
      isMandatory: false,
      dependencies: [],
      mediaRequirements: [],
      alarms: [],
      attachments: [],
      order: 0,
      timerEnabled: false,
      timerSeconds: 0,
    },
    {
      id: "step_2",
      title: "Step 2",
      instructions: "Do step 2",
      type: "consigne_simple",
      isMandatory: false,
      dependencies: [],
      mediaRequirements: [],
      alarms: [],
      attachments: [],
      order: 1,
      timerEnabled: true,
      timerSeconds: 60,
    },
  ],
};

describe("useProcedureExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with briefing phase", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    expect(result.current.phase).toBe("briefing");
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.completedSteps.size).toBe(0);
  });

  it("should transition from briefing to prerequisites", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("prerequisites");
    });

    expect(result.current.phase).toBe("prerequisites");
  });

  it("should transition from prerequisites to executing", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("prerequisites");
    });

    act(() => {
      result.current.actions.setPhase("executing");
    });

    expect(result.current.phase).toBe("executing");
    expect(result.current.currentStepIndex).toBe(0);
  });

  it("should navigate to next step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.nextStep();
    });

    expect(result.current.currentStepIndex).toBe(1);
  });

  it("should navigate to previous step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.nextStep();
    });

    act(() => {
      result.current.actions.previousStep();
    });

    expect(result.current.currentStepIndex).toBe(0);
  });

  it("should not go below first step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.previousStep();
    });

    expect(result.current.currentStepIndex).toBe(0);
  });

  it("should complete step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.completeStep("step_1");
    });

    expect(result.current.completedSteps.has("step_1")).toBe(true);
  });

  it("should toggle step completion", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.completeStep("step_1");
    });
    expect(result.current.completedSteps.has("step_1")).toBe(true);

    act(() => {
      result.current.actions.completeStep("step_1");
    });
    expect(result.current.completedSteps.has("step_1")).toBe(false);
  });

  it("should go to completed phase on last step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.nextStep();
    });

    act(() => {
      result.current.actions.nextStep();
    });

    expect(result.current.phase).toBe("completed");
  });

  it("should abort execution", () => {
    const onAbort = vi.fn();
    const { result } = renderHook(() =>
      useProcedureExecution({
        procedure: mockProcedure,
        onAbort,
      })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.abort("User stopped");
    });

    expect(result.current.phase).toBe("aborted");
    expect(onAbort).toHaveBeenCalled();
  });

  it("should reset execution state", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.nextStep();
    });

    act(() => {
      result.current.actions.reset();
    });

    expect(result.current.phase).toBe("briefing");
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.completedSteps.size).toBe(0);
  });

  it("should start and stop timer", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    expect(result.current.timer.isRunning).toBe(false);

    act(() => {
      result.current.timer.start();
    });

    expect(result.current.timer.isRunning).toBe(true);

    act(() => {
      result.current.timer.stop();
    });

    expect(result.current.timer.isRunning).toBe(false);
  });

  it("should return current step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    expect(result.current.currentStep?.id).toBe("step_1");
    expect(result.current.currentStep?.title).toBe("Step 1");
  });

  it("should track global elapsed time", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.timer.start();
    });

    act(() => {
      result.current.timer.stop();
    });

    expect(result.current.timer.globalElapsed).toBeGreaterThanOrEqual(0);
  });

  it("should navigate to specific step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.goToStep(1);
    });

    expect(result.current.currentStepIndex).toBe(1);
  });

  it("should not navigate to invalid step", () => {
    const { result } = renderHook(() =>
      useProcedureExecution({ procedure: mockProcedure })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.goToStep(99);
    });

    expect(result.current.currentStepIndex).toBe(0);
  });

  it("should call onComplete when procedure finishes", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useProcedureExecution({
        procedure: mockProcedure,
        onComplete,
      })
    );

    act(() => {
      result.current.actions.setPhase("executing");
    });

    act(() => {
      result.current.actions.nextStep();
    });

    act(() => {
      result.current.actions.nextStep();
    });

    expect(onComplete).toHaveBeenCalled();
  });
});
