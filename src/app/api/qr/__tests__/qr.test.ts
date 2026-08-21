import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchPairs, createPair, deletePair, getAllPairs } from "@/lib/qr/client-store";

const mockPairs: Array<{ id: number; question: string; answer: string; registryId: number; registryTitle: string; createdAt: string; updatedAt: string }> = [];
let nextId = 1;

vi.mock("@/lib/client-engine", () => {
  return {
    clientEngine: {
      init: vi.fn().mockResolvedValue({ sqlite: true, vectorStore: true, jsonStore: true }),
      getAllQAPairs: vi.fn().mockImplementation(() => {
        return Promise.resolve(
          mockPairs.map((p) => ({
            id: p.id,
            question: p.question,
            answer: p.answer,
            registryId: p.registryId,
            registryTitle: p.registryTitle,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }))
        );
      }),
      getQAPairById: vi.fn().mockImplementation((id: number) => {
        return Promise.resolve(mockPairs.find((p) => p.id === id) ?? null);
      }),
      createQAPair: vi.fn().mockImplementation((pair: { question: string; answer: string; registryTitle?: string }) => {
        const title = pair.registryTitle || pair.question.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().substring(0, 60) || "Général";
        const newPair = {
          id: nextId++,
          question: pair.question,
          answer: pair.answer,
          registryId: 0,
          registryTitle: title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockPairs.push(newPair);
        return Promise.resolve(newPair);
      }),
      updateQAPair: vi.fn().mockImplementation((id: number, updates: { question?: string; answer?: string }) => {
        const idx = mockPairs.findIndex((p) => p.id === id);
        if (idx === -1) return Promise.resolve(null);
        if (updates.question) mockPairs[idx].question = updates.question;
        if (updates.answer) mockPairs[idx].answer = updates.answer;
        mockPairs[idx].updatedAt = new Date().toISOString();
        return Promise.resolve({ ...mockPairs[idx] });
      }),
      deleteQAPair: vi.fn().mockImplementation((id: number) => {
        const idx = mockPairs.findIndex((p) => p.id === id);
        if (idx === -1) return Promise.resolve(false);
        mockPairs.splice(idx, 1);
        return Promise.resolve(true);
      }),
      searchPairs: vi.fn().mockImplementation((query: string, limit = 10) => {
        if (!query.trim() || mockPairs.length === 0) return Promise.resolve([]);
        const queryTerms = query.toLowerCase().split(/[\s,.;:!?()[\]{}]+/).filter(Boolean);
        const results = mockPairs.map((p) => {
          const textLower = p.question.toLowerCase();
          let matches = 0;
          for (const term of queryTerms) {
            if (textLower.includes(term)) matches++;
          }
          return { question: p.question, answer: p.answer, score: queryTerms.length > 0 ? matches / queryTerms.length : 0 };
        });
        return Promise.resolve(results.sort((a, b) => b.score - a.score).slice(0, limit));
      }),
      addVectorDocument: vi.fn(),
      searchVector: vi.fn(),
      getAllVectorDocuments: vi.fn().mockResolvedValue([]),
      deleteVectorDocument: vi.fn(),
      factoryReset: vi.fn(),
      getStats: vi.fn(),
      exportPairAsJson: vi.fn(),
      exportPairsAsJson: vi.fn(),
      exportAll: vi.fn().mockResolvedValue({ qaPairs: [], chatSessions: [], localTree: [], vectorDocuments: [], jsonStore: {} }),
    },
  };
});

describe("Q/R client-store", () => {
  beforeEach(() => {
    mockPairs.length = 0;
    nextId = 1;
  });

  it("getAllPairs returns empty array when no data", async () => {
    const result = await getAllPairs();
    expect(result).toEqual([]);
  });

  it("createPair persists and returns the pair", async () => {
    const result = await createPair({
      question: "Quel est le niveau du condenseur?",
      answer: "600 mm",
    });

    expect(result.question).toBe("Quel est le niveau du condenseur?");
    expect(result.answer).toBe("600 mm");
    expect(result.id).toBeDefined();
    expect(mockPairs).toHaveLength(1);
  });

  it("searchPairs returns ranked results", async () => {
    mockPairs.push({
      id: 1,
      question: "Quel est le niveau du condenseur",
      answer: "600 mm",
      registryId: 0,
      registryTitle: "test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const results = await searchPairs("niveau du condenseur");
    expect(results).toHaveLength(1);
    expect(results[0].question).toContain("condenseur");
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  it("deletePair returns false for non-existent id", async () => {
    const result = await deletePair(99999);
    expect(result).toBe(false);
  });
});
