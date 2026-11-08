import { BACKUP_TABLES, parseBackup } from './backup';
import { EXERCISES } from './catalogue';
import { exportAllData, newId } from './db';
import { createFolderSharing } from './folderSharingCore';
export type { SharedFolder } from './folderSharingCore';
export const { parseSharedFolder, makeSharedFolder, importSharedFolder } = createFolderSharing({BACKUP_TABLES,parseBackup,EXERCISES,exportAllData,newId});
