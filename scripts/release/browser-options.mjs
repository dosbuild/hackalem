import {existsSync} from 'node:fs';
const brave='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
export const executablePath=process.env.BROWSER_PATH||(existsSync(brave)?brave:undefined);
export const browserArgs=['--disable-background-networking','--use-gl=angle',...(process.platform==='darwin'?['--use-angle=metal']:process.platform==='linux'?['--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']:[])];
