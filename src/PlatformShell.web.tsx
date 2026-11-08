import React from 'react';
import { WebSessionProvider } from './web/session';
import { CloudSettings, useCloudActivity } from './web/CloudPanel';
import { AlertHost } from './alerts.web';
import { AccessProvider } from './web/Access';
export function PlatformShell({ children }: { children: React.ReactNode }) { return <WebSessionProvider><AccessProvider>{children}<AlertHost /></AccessProvider></WebSessionProvider>; }
export { ProfileRequestBadge } from './web/Access';
export const PlatformTools = CloudSettings;
export { FolderShareButton } from './web/FolderSharing';
export { useCloudActivity };
