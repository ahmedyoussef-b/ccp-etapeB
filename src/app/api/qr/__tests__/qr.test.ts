import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchPairs, createPair, deletePair, getAllPairs } from "@/lib/qr/server-store";
import { computeWordScore, rankResults } from "@/lib/qr/scoring";

// Use vi.hoisted so mock refs are available inside vi.mock factory
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isFile: () => true })),
}));

const mockPrisma = vi.hoisted(() => ({
  qAPair: {
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  qARegistry: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("fs", () => ({
  ...mockFs,
  default: { ...mockFs },
}));

vi.mock("path", () => ({
  join: (...args: string[]) => args.join("/"),
  default: { join: (...args: string[]) => args.join("/") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("os", () => ({
  default: { tmpdir: () => "/tmp" },
  tmpdir: () => "/tmp",
}));

const PAIRS_FILE = ".local-db/qr/pairs.json";
const ITEMS_DIR = ".data/registry/items";

describe("Q/R server-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prisma always fails in tests → file-based fallback is used
    mockPrisma.qAPair.findMany.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qAPair.create.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qAPair.delete.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qAPair.findUnique.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qAPair.update.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qARegistry.findFirst.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qARegistry.create.mockRejectedValue(new Error("DB not available"));
    mockPrisma.qARegistry.findMany.mockRejectedValue(new Error("DB not available"));

    // File-based mock setup
    mockFs.existsSync.mockImplementation((p: string) => p === PAIRS_FILE || p === ITEMS_DIR);
    mockFs.readFileSync.mockReturnValue("[]");
  });

  it("getAllPairs returns empty array when no file exists", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = await getAllPairs();
    expect(result).toEqual([]);
  });

  it("createPair persists and returns the pair", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("[]");

    const result = await createPair({
      question: "Quel est le niveau du condenseur?",
      answer: "600 mm",
    });

    expect(result.question).toBe("Quel est le niveau du condenseur?");
    expect(result.answer).toBe("600 mm");
    expect(result.id).toBeDefined();
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });

  it("searchPairs returns ranked results", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify([
        {
          id: 1,
          question: "Quel est le niveau du condenseur",
          answer: "600 mm",
          registryTitle: "test",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    );

    const results = await searchPairs("niveau du condenseur");
    expect(results).toHaveLength(1);
    expect(results[0].question).toContain("condenseur");
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  it("deletePair returns false for non-existent id", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify([
        {
          id: 1,
          question: "Test",
          answer: "Answer",
          registryTitle: "test",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    );

    const result = await deletePair(99999);
    expect(result).toBe(false);
  });
});

describe("scoring", () => {
  it("computeWordScore matches exact", () => {
    expect(computeWordScore("pompe eau", "pompe eau")).toBe(1.0);
  });

  it("computeWordScore returns 0 for empty", () => {
    expect(computeWordScore("", "")).toBe(0);
  });

  it("rankResults sorts by descending score", () => {
    const results = rankResults("pompe", [
      { question: "pomme", answer: "a", score: 0 },
      { question: "pompe eau", answer: "b", score: 0 },
    ]);
    expect(results[0].question).toBe("pompe eau");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});
