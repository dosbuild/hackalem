export const executablePath=process.env.BROWSER_PATH||undefined;
export const browserArgs=['--disable-background-networking','--use-gl=angle',...(process.platform==='darwin'?['--use-angle=metal']:process.platform==='linux'?['--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']:[])];
