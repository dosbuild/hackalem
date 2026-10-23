import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditAnchorFrames,authoredAnnotationFocuses,authoredProgramSites} from './anchor-oracle.mjs';
import {placements as khanate} from '../../src/world/khanate/geography.js';
const out=process.env.RELEASE_OUTPUT||'artifacts/fullscreen';
const focusSourcePaths=['src/world/placements.json','src/world/khanate/site-views.json','src/world/khanate/geography.js','src/world/astana-programs.json','src/world/khanate/program-sites.json'];
const focusSourceBytes=await Promise.all(focusSourcePaths.map(path=>readFile(path)));
const [samples,metadata]=await Promise.all([
 readFile(`${out}/camera-frames.json`,'utf8').then(JSON.parse),
 readFile(`${out}/camera-frames.meta.json`,'utf8').then(JSON.parse),
]);
const astana=JSON.parse(focusSourceBytes[0]),khanateViews=JSON.parse(focusSourceBytes[1]);
const originalPlacements={astana:astana.records,khanate};
const programsByMode={astana:JSON.parse(focusSourceBytes[3]).records,khanate:Object.fromEntries(JSON.parse(focusSourceBytes[4]).programs.map(program=>[program.key,program]))};
const placementsByMode=authoredProgramSites(originalPlacements,programsByMode);
const annotationFocusesByMode=authoredAnnotationFocuses(originalPlacements,khanateViews,programsByMode);
const result=auditAnchorFrames(samples,{placementsByMode,annotationFocusesByMode,world:metadata.world});
result.annotationFocusSources=Object.fromEntries(focusSourcePaths.map((path,i)=>[path,createHash('sha256').update(focusSourceBytes[i]).digest('hex')]));
result.artifact=metadata;
const reportPath=`${out}/${process.env.ANCHOR_REPORT_FILE||'report.json'}`;
const report=JSON.parse(await readFile(reportPath,'utf8'));report.camera??={};report.camera.maxAnchorError=result.maxErrorPixels;report.camera.anchorObservations=result.anchorObservations;report.camera.lenses=result.lenses;
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
await writeFile(`${out}/anchor-audit.json`,JSON.stringify(result,null,2)+'\n');console.log(result);
