import type { SyncTableResult } from '@/lib/sync/sync-manager'

export interface DataNode {
  id: string
  name: string
  type: 'root' | 'directory' | 'file'
  path: string
  parentId: string | null
  children?: DataNode[]
  metadata?: Record<string, any>
  content?: string
  size?: number
}

export class DataReferenceService {
  private static instance: DataReferenceService
  private rootPath = '.data'
  private structureCache: DataNode[] | null = null

  static getInstance(): DataReferenceService {
    if (!this.instance) {
      this.instance = new DataReferenceService()
    }
    return this.instance
  }

  async getStructure(): Promise<DataNode[]> {
    if (this.structureCache) {
      return this.structureCache
    }

    try {
      const response = await fetch('/api/tree')
      const data = await response.json()
      this.structureCache = this.normalizeStructure(data.roots || [])
      return this.structureCache
    } catch (e) {
      console.error('[DataReference] Failed to load structure:', e)
      this.structureCache = this.getDefaultStructure()
      return this.structureCache
    }
  }

  private normalizeStructure(nodes: any[]): DataNode[] {
    const result: DataNode[] = []

    const processNode = (node: any, parentId: string | null = null) => {
      const dataNode: DataNode = {
        id: String(node.id || node.uuid || `node_${Date.now()}_${Math.random()}`),
        name: node.name || 'unnamed',
        type: node.type === 'root' ? 'root' : node.type === 'directory' ? 'directory' : 'file',
        path: node.path || node.name || '',
        parentId: parentId,
        metadata: node.metadata || {},
        content: node.content || '',
        size: node.size || 0,
      }

      result.push(dataNode)

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          processNode(child, dataNode.id)
        }
      }
    }

    for (const node of nodes) {
      processNode(node)
    }

    return result
  }

  private getDefaultStructure(): DataNode[] {
    const rootId = 'root_' + Date.now()
    return [
      {
        id: rootId,
        name: '.data',
        type: 'root',
        path: '.data',
        parentId: null,
        metadata: {},
        children: [
          { id: 'dir_1', name: 'procedures', type: 'directory', path: '.data/procedures', parentId: rootId, metadata: {} },
          { id: 'dir_2', name: 'documents', type: 'directory', path: '.data/documents', parentId: rootId, metadata: {} },
          { id: 'dir_3', name: 'images', type: 'directory', path: '.data/images', parentId: rootId, metadata: {} },
          { id: 'dir_4', name: 'media', type: 'directory', path: '.data/media', parentId: rootId, metadata: {} },
        ],
      },
    ]
  }

  async syncToLocal(): Promise<SyncTableResult> {
    const structure = await this.getStructure()
    const { syncManager } = await import('@/lib/sync/sync-manager')
    return await syncManager.resetAndPullTable('tree_nodes')
  }

  async syncToVector(): Promise<{ count: number; errors: string[] }> {
    const structure = await this.getStructure()
    const { vectorStore } = await import('@/lib/client-engine/vector-store')

    const files = structure.filter((n) => n.type === 'file' && n.content)
    let count = 0
    const errors: string[] = []

    for (const file of files) {
      try {
        await vectorStore.addDocument({
          id: file.id,
          name: file.name,
          originalPath: file.path,
          relativePath: file.path,
          chunks: [
            {
              documentId: file.id,
              documentName: file.name,
              chunkIndex: 0,
              content: file.content || '',
              embedding: new Array(384).fill(0),
              metadata: file.metadata || {},
            },
          ],
          metadata: { ...file.metadata, type: 'file' },
        })
        count++
      } catch (e) {
        errors.push(`Failed to vectorize ${file.name}: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    return { count, errors }
  }

  clearCache(): void {
    this.structureCache = null
  }

  async ensurePhysicalDataStructure(): Promise<{ script: string; filename: string }> {
    const structure = await this.getStructure()
    const directories = structure.filter((n) => n.type === 'directory' || n.type === 'root')
    const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
    const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
    const basePath = isWindows ? '.\\' : './'
    const script = isWindows
      ? `@echo off\r\necho 📁 Création de la structure .data...\r\n${directories.map((d) => `mkdir "${basePath}${d.path}" >nul 2>&1`).join('\r\n')}\r\necho ✅ Structure .data créée\r\npause`
      : `#!/bin/bash\r\necho "📁 Création de la structure .data..."\r\n${directories.map((d) => `mkdir -p "${basePath}${d.path}"`).join('\r\n')}\r\necho "✅ Structure .data créée"`
    const filename = `create-data-structure.${isWindows ? 'bat' : 'sh'}`
    return { script, filename }
  }
}

export const dataReference = DataReferenceService.getInstance()
