import Dexie, { Table } from 'dexie';

export interface Folder {
  id?: number;
  remoteId: string;
  name: string;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface File {
  id?: number;
  remoteId: string;
  name: string;
  folderId: number | null;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalTreeNode {
  id?: number;
  remoteId: string;
  name: string;
  type: 'folder' | 'file' | 'meta';
  parentId: number | null;
  path: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class NexaFlowDB extends Dexie {
  folders!: Table<Folder, number>;
  files!: Table<File, number>;
  localTree!: Table<LocalTreeNode, number>;

  constructor() {
    super('nexaflow-db');

    this.version(1).stores({
      folders: 'remoteId, parentId, updatedAt',
      files: 'remoteId, [folderId+name], updatedAt',
    });

    this.version(2).stores({
      localTree: 'remoteId, parentId, type, path',
    });
  }
}

export const db = new NexaFlowDB();
