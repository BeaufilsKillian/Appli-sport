import React from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
export function PlatformShell({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function PlatformTools() { return null; }
export function ProfileRequestBadge(){return null;}
export function FolderShareButton(_props:{folderId:string;db:SQLiteDatabase;onOpenChange(value:boolean):void}) { return null; }
export function useCloudActivity(_busy: boolean, _checkpoint?: { blocked: boolean; prepare(): Promise<void> }) {}
