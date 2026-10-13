export type ControlIconKind =
  | 'overview' | 'orbit' | 'stop' | 'zoom-in' | 'zoom-out'
  | 'rotate-left' | 'rotate-right' | 'tilt-more' | 'tilt-less'
  | 'settings' | 'replay' | 'play' | 'place' | 'residents' | 'book'
  | 'arrow-right' | 'arrow-up' | 'arrow-back' | 'close' | 'build' | 'wallet' | 'help' | 'chevron-down' | 'check' | 'sun' | 'download';

/** Small, authored ink drawings. The surrounding control owns its accessible name. */
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
    orbit:'M9 15V9l3-2.5L15 9v6M11 15v-3h2v3M18.5 8.5c2.2 1 3.5 2.5 3 4.3-.8 3.2-7.5 5.2-13.1 4.1-4-.8-6.5-2.5-5.9-4.8.3-1.2 1.2-2.1 2.8-2.9M18 5.5l.5 3-3.1.7',
    stop:'M7 7h10v10H7z',
    'zoom-in':'M15.4 15.4 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0M7 10.5h7M10.5 7v7',
    'zoom-out':'M15.4 15.4 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0M7 10.5h7',
    'rotate-left':'M5 8.5h13V18H5zM9 8.5l1-2h4l1 2M14.5 13.2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 4.5c4-3 10.8-2.1 14 1.5M5 1.5v3.2l3.1.6',
    'rotate-right':'M6 8.5h13V18H6zM10 8.5l1-2h4l1 2M15.5 13.2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M19 4.5c-4-3-10.8-2.1-14 1.5M19 1.5v3.2l-3.1.6',
    'tilt-more':'M3 19.5h18M4 7.5l12 3.2-2.4 8-12-3.2zM6.5 8l1.2-1.8 3 .8.2 2.2M10.6 13.3a2.5 2.5 0 1 1-4.8-1.3 2.5 2.5 0 0 1 4.8 1.3M19.5 4v9m-2.2-2.2 2.2 2.2 2.2-2.2',
    'tilt-less':'M3 19.5h18M2.5 10.7l12-3.2 2.4 8-12 3.2zM6 9.8l.2-2.2 3-.8 1.2 1.8M11.4 12a2.5 2.5 0 1 1-4.8 1.3 2.5 2.5 0 0 1 4.8-1.3M19.5 13V4m-2.2 2.2L19.5 4l2.2 2.2',
    settings:'M5 3v7m0 5v6M3 10h4v5H3zM12 3v11m0 5v2m-2-7h4v5h-4zM19 3v3m0 5v10m-2-15h4v5h-4z',
    replay:'M4.2 8a8.5 8.5 0 1 1-.3 7M4 4v4.2h4.2M12 7v5l3 2',
    play:'M8 4l12 8-12 8z',
    place:'M18.5 9c0 4.5-6.5 11.5-6.5 11.5S5.5 13.5 5.5 9a6.5 6.5 0 1 1 13 0M14.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
    residents:'M9.5 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M19.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M1.5 21v-2a5 5 0 0 1 10 0v2M13 21v-2a4 4 0 0 1 8 0v2',
    book:'M12 6c-3-2.5-8-2.5-10-1v15c3-1.5 7-1 10 1 3-2 7-2.5 10-1V5c-2-1.5-7-1.5-10 1M12 6v15M5 9l4 .5m-4 3.5 4 .5m6-4 4-.5m-4 4.5 4-.5',
  };
  return <svg className={`control-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d={paths[kind]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
