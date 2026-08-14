export interface ApiFolderNode {
  id: string;
  name: string;
  type: 'folder';
  children: ApiNode[];
}

export interface ApiFileNode {
  id: string;
  name: string;
  type: 'file';
  size: number;
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
      children: [
        {
          id: 'folder-2',
          name: 'Reports',
          type: 'folder',
          children: [
            {
              id: 'file-1',
              name: 'annual_report.pdf',
              type: 'file',
              size: 2048576,
            },
            {
              id: 'file-2',
              name: 'budget.xlsx',
              type: 'file',
              size: 524288,
            },
          ],
        },
        {
          id: 'file-3',
          name: 'notes.txt',
          type: 'file',
          size: 1024,
        },
      ],
    },
    {
      id: 'file-4',
      name: 'readme.md',
      type: 'file',
      size: 512,
    },
  ],
  lastSyncTimestamp: '2024-01-15T10:30:00Z',
};
