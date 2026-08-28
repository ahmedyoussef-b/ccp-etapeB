export class MediaFallbackService {
  static async loadFromIndexedDB(id: string): Promise<string | null> {
    try {
      const { getDocument } = await import('@/lib/client-engine/vector-store');
      const doc = await getDocument(`media-${id}`);
      if (doc?.chunks?.length) {
        return doc.chunks[0].content;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  static async loadFromSQLite(id: string): Promise<string | null> {
    try {
      const { queryOne } = await import('@/lib/client-engine/sqlite');
      const row = await queryOne<{ data_url: string }>(
        `SELECT data_url FROM media_items WHERE id = ? LIMIT 1`,
        [id]
      );
      return row?.data_url ?? null;
    } catch {
      return null;
    }
  }

  static loadPlaceholder(type: 'image' | 'video' | 'document' = 'image'): string {
    if (type === 'video') {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><polygon points="35,25 35,75 80,50" fill="%23999"/></svg>';
    }
    if (type === 'document') {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">📄</text></svg>';
    }
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">?</text></svg>';
  }
}
