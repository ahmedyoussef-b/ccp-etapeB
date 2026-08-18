export interface ApiFolderNode {
  id: string;
  name: string;
  type: 'folder';
  order: number;
  children: ApiNode[];
}

export interface ApiFileNode {
  id: string;
  name: string;
  type: 'file';
  order: number;
  size: number;
  content?: string | null;
  metadata?: string | null;
}

export type ApiNode = ApiFolderNode | ApiFileNode;

export interface SyncApiResponse {
  tree: ApiNode[];
  lastSyncTimestamp: string;
}

export const sampleSyncResponse: SyncApiResponse = {
  tree: [
    {
      id: 'folder-1',
      name: 'Documents',
      type: 'folder',
      order: 0,
      children: [
        {
          id: 'folder-2',
          name: 'Reports',
          type: 'folder',
          order: 0,
          children: [
            {
              id: 'file-1',
              name: 'annual_report.pdf',
              type: 'file',
              order: 0,
              size: 2048576,
              content: null,
            },
            {
              id: 'file-2',
              name: 'budget.xlsx',
              type: 'file',
              order: 1,
              size: 524288,
              content: null,
            },
          ],
        },
        {
          id: 'file-3',
          name: 'notes.txt',
          type: 'file',
          order: 1,
          size: 1024,
          content: null,
        },
      ],
    },
    {
      id: 'file-4',
      name: 'readme.md',
      type: 'file',
      order: 1,
      size: 512,
      content: null,
    },
  ],
  lastSyncTimestamp: '2024-01-15T10:30:00Z',
};
