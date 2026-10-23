export type ControlIconKind =
  | 'overview' | 'orbit' | 'stop' | 'zoom-in' | 'zoom-out'
  | 'rotate-left' | 'rotate-right' | 'tilt-more' | 'tilt-less'
  | 'settings' | 'replay' | 'play' | 'place' | 'residents' | 'book'
  | 'arrow-right' | 'arrow-up' | 'arrow-back' | 'close' | 'build' | 'wallet' | 'help' | 'chevron-down' | 'check' | 'sun' | 'download';

/** Authored 24-point interface symbols; the surrounding control owns its accessible name. */
export function ControlIcon({kind,size=22,className=''}:{kind:ControlIconKind;size?:number;className?:string}) {
  const paths:Record<ControlIconKind,string>={
    'arrow-right':'M4 12h16m-6-6 6 6-6 6',
    'arrow-up':'M12 20V4m-6 6 6-6 6 6',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    'arrow-back':'M20 12H4m6-6-6 6 6 6',
    close:'M6 6l12 12M18 6 6 18',
    build:'M3 21h18M6 21V11h12v10M4 11l8-8 8 8M10 21v-6h4v6M18 4v4',
    wallet:'M3 7h17v13H3zM3 7V4h14v3M15 11h7v6h-7zM18 14h.1',
    help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.1',
    'chevron-down':'M6 9l6 6 6-6',
    check:'M4 12l5 5L20 6',
    sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
    overview:'M3 20.5h18M4.5 20V12h5v8m0-13h5v13m0-10h5v10M6.5 15h1m4-5h1m-1 4h1m4-.5h1',
    orbit:'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7M18 5.5c2.5 1.3 4 3.5 4 6 0 4.4-4.5 8-10 8S2 15.9 2 11.5c0-2.5 1.5-4.7 4-6M18 2.5v3.7h-3.7',
    stop:'M7 7h10v10H7z',
    'zoom-in':'M15.4 15.4 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0M7 10.5h7M10.5 7v7',
    'zoom-out':'M15.4 15.4 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0M7 10.5h7',
    'rotate-left':'M4 9a8 8 0 1 1 .7 8M4 4v5h5',
    'rotate-right':'M20 9a8 8 0 1 0-.7 8M20 4v5h-5',
    'tilt-more':'M3 19h18M5 13l7-4 7 4-7 4-7-4M12 3v5m-3-2 3 3 3-3',
    'tilt-less':'M3 19h18M5 13l7-4 7 4-7 4-7-4M12 8V3m-3 3 3-3 3 3',
    settings:'M5 3v7m0 5v6M3 10h4v5H3zM12 3v11m0 5v2m-2-7h4v5h-4zM19 3v3m0 5v10m-2-15h4v5h-4z',
    replay:'M4.2 8a8.5 8.5 0 1 1-.3 7M4 4v4.2h4.2M12 7v5l3 2',
    play:'M8 4l12 8-12 8z',
    place:'M18.5 9c0 4.5-6.5 11.5-6.5 11.5S5.5 13.5 5.5 9a6.5 6.5 0 1 1 13 0M14.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
    residents:'M9.5 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M19.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M1.5 21v-2a5 5 0 0 1 10 0v2M13 21v-2a4 4 0 0 1 8 0v2',
    book:'M12 6c-3-2.5-8-2.5-10-1v15c3-1.5 7-1 10 1 3-2 7-2.5 10-1V5c-2-1.5-7-1.5-10 1M12 6v15M5 9l4 .5m-4 3.5 4 .5m6-4 4-.5m-4 4.5 4-.5',
  };
  return <svg className={`control-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d={paths[kind]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
