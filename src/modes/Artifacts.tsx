import type {InitiativeId} from '../domain/types';
const shapes:Record<InitiativeId,string>={
 M1:'M5 34h38M10 26h23l5-13M12 15v11m7-13v13m7-13v13M11 32a4 4 0 1 0 8 0m10 0a4 4 0 1 0 8 0',
 M2:'M13 41V10l14 4-14 6M26 35l6-7 7 7M25 41h15M8 31l-3 5m13-5 3 5',
 M3:'M5 39Q24 30 20 5M13 43Q32 31 28 5M30 20l7-7 7 7v10H30zM35 30v-8h4v8',
 M4:'M8 32h18v10H8zM12 30V18h11v12M17 18V9M9 12h17M31 40V23M24 23q-5-10 5-12 7-6 12 3 4 8-10 9',
 M5:'M10 39V23q14-15 27 0v16H10M17 38v-9q6-10 12 0v9M30 17V5h7v18M15 18l9-9',
 M6:'M10 42V29m14 13V21m14 21V31M3 30l7-17 7 17H3M14 23L24 4l10 19H14M31 32l7-17 7 17H31',
 M7:'M5 26Q9 14 24 10q15 4 19 16v14H5V26M5 26h38M14 24l10-14 10 14M20 40V29h8v11M19 8h10',
 M8:'M5 27q6-13 19-17 13 4 19 17v13H5V27M5 27h38M24 19v15m-6-7h12M15 9l-3-5m21 5 3-5',
 M9:'M4 39h40M8 31l8-14 8 14M16 17V7l8 3-8 4M29 31a7 7 0 1 0 14 0a7 7 0 1 0-14 0',
 M10:'M15 41h18M19 34h10l4-18H15l4 18M17 15l7-8 7 8M24 7V3M24 22v7M10 19l-5-2m33 2 5-2',
 M11:'M4 34h40M4 17h40M12 10v31m24-31v31M19 19v13m10-13v13M19 8l5 5 5-5',
 M12:'M6 10q9-4 18 2 9-6 18-2v28q-9-4-18 2-9-6-18-2V10M24 12v28M12 18h7m-7 7h7m11-7h7m-7 7h7',
 M13:'M7 34h19v9H7zM11 32V17h12v15M9 17l8-8 8 8M29 37V23l8-7 8 7v14H29M34 36v-8h6v8',
 M14:'M9 42V10l12 5-12 5M28 41V21l11-6v26M26 20h16M31 11l3-5 3 5M6 42h36M16 28l8 8m-8 0 8-8',
};
export function KhanateGlyph({id}:{id:InitiativeId}){return <svg className="project-glyph" viewBox="0 0 48 48" aria-hidden="true"><path d={shapes[id]} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
export function TreasuryChest(){return <svg className="treasury-artifact" viewBox="0 0 48 40" aria-hidden="true"><path d="M5 16Q5 5 15 5h18q10 0 10 11v19H5Z" fill="#bd9a62"/><path d="M5 17h38M13 7v27M35 7v27" fill="none" stroke="#785e3c" strokeWidth="2"/><rect x="20" y="14" width="8" height="12" rx="2" fill="#e3cb8a"/><path d="M24 17v5M17 30q7-7 14 0" fill="none" stroke="#7d603b" strokeWidth="1.5"/></svg>;}
export function KhanSeal(){return <svg className="khan-seal" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="1"/><path d="M13 24h22M24 13v22M16 16l16 16m0-16L16 32M12 6l2 3m20-3-2 3M6 34l3-2m30 0 3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;}
