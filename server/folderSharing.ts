// Adaptateur ESM Node : la logique reste partagée avec le navigateur.
import { BACKUP_TABLES, parseBackup } from '../src/backup.js';
import { EXERCISES } from '../src/catalogue.js';
import { exportAllData, newId } from '../src/db.js';
import { createFolderSharing } from '../src/folderSharingCore.js';
export const { parseSharedFolder } = createFolderSharing({BACKUP_TABLES,parseBackup,EXERCISES,exportAllData,newId});
