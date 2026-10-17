import React from 'react';

export interface PicaIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}

function createPicaIcon(displayName: string, children: React.ReactNode) {
  const Component = React.forwardRef<SVGSVGElement, PicaIconProps>(
    ({ size, strokeWidth = 1.75, className = '', style, ...props }, ref) => {
      // If className includes width/height (e.g. h-4 w-4), size is optional
      const width = size ?? (className.includes('w-') ? undefined : 16);
      const height = size ?? (className.includes('h-') ? undefined : 16);

      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width={width}
          height={height}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 select-none ${className}`}
          style={style}
          {...props}
        >
          {children}
        </svg>
      );
    }
  );
  Component.displayName = displayName;
  return Component;
}

/* -------------------------------------------------------------------------- */
/* Canonical Pica Icon Definitions                                            */
/* -------------------------------------------------------------------------- */

export const PicaActivity = createPicaIcon('PicaActivity', (
  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
));

export const PicaAlertCircle = createPicaIcon('PicaAlertCircle', (
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>
));

export const PicaAlertTriangle = createPicaIcon('PicaAlertTriangle', (
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
));

export const PicaArrowLeft = createPicaIcon('PicaArrowLeft', (
  <>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </>
));

export const PicaArrowRight = createPicaIcon('PicaArrowRight', (
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>
));

export const PicaArrowRightLeft = createPicaIcon('PicaArrowRightLeft', (
  <>
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </>
));

export const PicaArrowUpDown = createPicaIcon('PicaArrowUpDown', (
  <>
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
  </>
));

export const PicaBot = createPicaIcon('PicaBot', (
  <>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </>
));

export const PicaBuilding = createPicaIcon('PicaBuilding', (
  <>
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </>
));

export const PicaCalendar = createPicaIcon('PicaCalendar', (
  <>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>
));

export const PicaCheck = createPicaIcon('PicaCheck', (
  <polyline points="20 6 9 17 4 12" />
));

export const PicaCheckCircle = createPicaIcon('PicaCheckCircle', (
  <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>
));

export const PicaCheckCircle2 = createPicaIcon('PicaCheckCircle2', (
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>
));

export const PicaCheckSquare = createPicaIcon('PicaCheckSquare', (
  <>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>
));

export const PicaChevronDown = createPicaIcon('PicaChevronDown', (
  <polyline points="6 9 12 15 18 9" />
));

export const PicaChevronLeft = createPicaIcon('PicaChevronLeft', (
  <polyline points="15 18 9 12 15 6" />
));

export const PicaChevronRight = createPicaIcon('PicaChevronRight', (
  <polyline points="9 18 15 12 9 6" />
));

export const PicaClock = createPicaIcon('PicaClock', (
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>
));

export const PicaColumns3 = createPicaIcon('PicaColumns3', (
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </>
));

export const PicaCompass = createPicaIcon('PicaCompass', (
  <>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </>
));

export const PicaCopy = createPicaIcon('PicaCopy', (
  <>
    <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>
));

export const PicaCreditCard = createPicaIcon('PicaCreditCard', (
  <>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </>
));

export const PicaEdit2 = createPicaIcon('PicaEdit2', (
  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
));

export const PicaExternalLink = createPicaIcon('PicaExternalLink', (
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>
));

export const PicaFileCheck2 = createPicaIcon('PicaFileCheck2', (
  <>
    <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m3 15 2 2 4-4" />
  </>
));

export const PicaFileCode = createPicaIcon('PicaFileCode', (
  <>
    <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v16z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 17 2-2-2-2" />
  </>
));

export const PicaFileText = createPicaIcon('PicaFileText', (
  <>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </>
));

export const PicaFilter = createPicaIcon('PicaFilter', (
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
));

export const PicaFolderGit2 = createPicaIcon('PicaFolderGit2', (
  <>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <circle cx="12" cy="13" r="2" />
    <path d="M14 13h3" />
    <path d="M7 13h3" />
  </>
));

export const PicaFolderKanban = createPicaIcon('PicaFolderKanban', (
  <>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <path d="M8 10v4" />
    <path d="M12 10v2" />
    <path d="M16 10v6" />
  </>
));

export const PicaGift = createPicaIcon('PicaGift', (
  <>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </>
));

export const PicaGitBranch = createPicaIcon('PicaGitBranch', (
  <>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </>
));

export const PicaGitCommit = createPicaIcon('PicaGitCommit', (
  <>
    <circle cx="12" cy="12" r="3" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
  </>
));

export const PicaGitPullRequest = createPicaIcon('PicaGitPullRequest', (
  <>
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </>
));

export const PicaGlobe = createPicaIcon('PicaGlobe', (
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>
));

export const PicaHash = createPicaIcon('PicaHash', (
  <>
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </>
));

export const PicaHelpCircle = createPicaIcon('PicaHelpCircle', (
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
));

export const PicaInfo = createPicaIcon('PicaInfo', (
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </>
));

export const PicaKeyRound = createPicaIcon('PicaKeyRound', (
  <>
    <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
  </>
));

export const PicaLayers = createPicaIcon('PicaLayers', (
  <>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </>
));

export const PicaList = createPicaIcon('PicaList', (
  <>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </>
));

export const PicaLoader2 = createPicaIcon('PicaLoader2', (
  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
));

export const PicaLock = createPicaIcon('PicaLock', (
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
));

export const PicaLogOut = createPicaIcon('PicaLogOut', (
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>
));

export const PicaMail = createPicaIcon('PicaMail', (
  <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>
));

export const PicaMenu = createPicaIcon('PicaMenu', (
  <>
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </>
));

export const PicaMessageSquare = createPicaIcon('PicaMessageSquare', (
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
));

export const PicaPlay = createPicaIcon('PicaPlay', (
  <polygon points="5 3 19 12 5 21 5 3" />
));

export const PicaPlus = createPicaIcon('PicaPlus', (
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
));

export const PicaRefreshCw = createPicaIcon('PicaRefreshCw', (
  <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>
));

export const PicaSearch = createPicaIcon('PicaSearch', (
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>
));

export const PicaSend = createPicaIcon('PicaSend', (
  <>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </>
));

export const PicaSettings = createPicaIcon('PicaSettings', (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
));

export const PicaShieldAlert = createPicaIcon('PicaShieldAlert', (
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>
));

export const PicaShieldCheck = createPicaIcon('PicaShieldCheck', (
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <polyline points="9 12 11 14 15 10" />
  </>
));

export const PicaTag = createPicaIcon('PicaTag', (
  <>
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </>
));

export const PicaTerminal = createPicaIcon('PicaTerminal', (
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </>
));

export const PicaTrash2 = createPicaIcon('PicaTrash2', (
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </>
));

export const PicaTrendingUp = createPicaIcon('PicaTrendingUp', (
  <>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </>
));

export const PicaUser = createPicaIcon('PicaUser', (
  <>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
));

export const PicaUsers = createPicaIcon('PicaUsers', (
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
));

export const PicaX = createPicaIcon('PicaX', (
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
));

export const PicaXCircle = createPicaIcon('PicaXCircle', (
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </>
));

export const PicaZap = createPicaIcon('PicaZap', (
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
));

export const PicaSun = createPicaIcon('PicaSun', (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>
));

export const PicaMoon = createPicaIcon('PicaMoon', (
  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
));

export const PicaGithub = createPicaIcon('PicaGithub', (
  <path
    fill="currentColor"
    stroke="none"
    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
  />
));

export const PicaSlack = createPicaIcon('PicaSlack', (
  <g fill="currentColor" stroke="none">
    <path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5z" />
    <path d="M9 6a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5z" />
    <path d="M18 9a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2V9zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5z" />
    <path d="M15 18a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z" />
  </g>
));

/* -------------------------------------------------------------------------- */
/* Standard Aliases for Transparent Drop-in Replacement                       */
/* -------------------------------------------------------------------------- */

export {
  PicaActivity as Activity,
  PicaAlertCircle as AlertCircle,
  PicaAlertTriangle as AlertTriangle,
  PicaArrowLeft as ArrowLeft,
  PicaArrowRight as ArrowRight,
  PicaArrowRightLeft as ArrowRightLeft,
  PicaArrowUpDown as ArrowUpDown,
  PicaBot as Bot,
  PicaBuilding as Building,
  PicaCalendar as Calendar,
  PicaCheck as Check,
  PicaCheckCircle as CheckCircle,
  PicaCheckCircle2 as CheckCircle2,
  PicaCheckSquare as CheckSquare,
  PicaChevronDown as ChevronDown,
  PicaChevronLeft as ChevronLeft,
  PicaChevronRight as ChevronRight,
  PicaClock as Clock,
  PicaColumns3 as Columns3,
  PicaCompass as Compass,
  PicaCopy as Copy,
  PicaCreditCard as CreditCard,
  PicaEdit2 as Edit2,
  PicaExternalLink as ExternalLink,
  PicaFileCheck2 as FileCheck2,
  PicaFileCode as FileCode,
  PicaFileText as FileText,
  PicaFilter as Filter,
  PicaFolderGit2 as FolderGit2,
  PicaFolderKanban as FolderKanban,
  PicaGift as Gift,
  PicaGitBranch as GitBranch,
  PicaGitCommit as GitCommit,
  PicaGitPullRequest as GitPullRequest,
  PicaGlobe as Globe,
  PicaHash as Hash,
  PicaHelpCircle as HelpCircle,
  PicaInfo as Info,
  PicaKeyRound as KeyRound,
  PicaLayers as Layers,
  PicaList as List,
  PicaLoader2 as Loader2,
  PicaLock as Lock,
  PicaLogOut as LogOut,
  PicaMail as Mail,
  PicaMenu as Menu,
  PicaMessageSquare as MessageSquare,
  PicaPlay as Play,
  PicaPlus as Plus,
  PicaRefreshCw as RefreshCw,
  PicaSearch as Search,
  PicaSend as Send,
  PicaSettings as Settings,
  PicaShieldAlert as ShieldAlert,
  PicaShieldCheck as ShieldCheck,
  PicaTag as Tag,
  PicaTerminal as Terminal,
  PicaTrash2 as Trash2,
  PicaTrendingUp as TrendingUp,
  PicaUser as User,
  PicaUsers as Users,
  PicaX as X,
  PicaXCircle as XCircle,
  PicaZap as Zap,
  PicaSun as Sun,
  PicaMoon as Moon,
  PicaGithub as Github,
  PicaSlack as Slack,
};
