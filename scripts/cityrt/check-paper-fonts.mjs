/** Audit the actual local webfont, without installing font tools or running a browser.
 * WOFF2 directory: https://www.w3.org/TR/WOFF2/#table_dir_format
 * OpenType cmap: https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
 * The source scan is a superset of rendered authored Latin/Cyrillic and numbers:
 * UI, names, stories, scenario labels and Kazakh originals. Escapes are decoded.
 */
import {readFile,readdir} from 'node:fs/promises';
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import postcss from 'postcss';

const root=fileURLToPath(new URL('../../',import.meta.url));
const option=name=>process.argv.find(argument=>argument.startsWith(`--${name}=`))?.slice(name.length+3);
const fontPath=resolve(root,option('font')??'src/design/assets/shantell-sans-ui-variable.woff2');
const sourcePath=resolve(root,'src/design/assets/shantell-sans-variable.woff2');
const provenancePath=resolve(root,'src/design/assets/shantell-sans-ui-variable.provenance.json');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const expectedSourceSHA='1473f076cf7ab16865ba2337841776cd67db4744f7bac3b4c36508a0a083dfa7';
const expectedUiSHA='3f8ec5de47e2434963564d87ffe873e3e2620707409ad11253894d098f4f7bfc';
async function inspectFont(path){
const font=await readFile(path);
if(font.toString('ascii',0,4)!=='wOF2'||font.readUInt32BE(4)===0x74746366)throw Error('Expected a single WOFF2 font');
const tags='cmap head hhea hmtx maxp name OS/2 post cvt_ fpgm glyf loca prep CFF_ VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG_ sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'.split(' ').map(tag=>tag.replaceAll('_',' '));
let cursor=48,streamLength=0;
function base128(){
 let value=0;
 for(let i=0;i<5;i++){
  const byte=font[cursor++];
  if(byte===undefined||(i===0&&byte===0x80)||value>0x1ffffff)throw Error('Invalid WOFF2 length');
  value=value*128+(byte&127);
  if(!(byte&128))return value;
 }
 throw Error('Invalid WOFF2 length');
}
const directory=new Map();
for(let i=0;i<font.readUInt16BE(12);i++){
 const flags=font[cursor++],index=flags&63,version=flags>>6;
 const tag=index===63?font.toString('ascii',cursor,cursor+=4):tags[index];
 const originalLength=base128(),transformed=['glyf','loca'].includes(tag)?version!==3:version!==0;
 const length=transformed?base128():originalLength;
 directory.set(tag,{offset:streamLength,length,transformed});streamLength+=length;
}
const stream=brotliDecompressSync(font.subarray(cursor,cursor+font.readUInt32BE(20)));
if(stream.length!==streamLength)throw Error('WOFF2 stream length mismatch');
const table=tag=>{
 const entry=directory.get(tag);
 if(!entry||entry.transformed)throw Error(`Missing or transformed ${tag} table`);
 return stream.subarray(entry.offset,entry.offset+entry.length);
};
const cmap=table('cmap'),glyphs=new Set();
for(let i=0;i<cmap.readUInt16BE(2);i++){
 const record=4+i*8,platform=cmap.readUInt16BE(record),encoding=cmap.readUInt16BE(record+2);
 if(platform!==0&&!(platform===3&&[1,10].includes(encoding)))continue;
 const offset=cmap.readUInt32BE(record+4),format=cmap.readUInt16BE(offset);
 if(format===4){
  const count=cmap.readUInt16BE(offset+6)/2,end=offset+14,start=end+count*2+2,delta=start+count*2,range=delta+count*2;
  for(let s=0;s<count;s++)for(let cp=cmap.readUInt16BE(start+s*2);cp<=cmap.readUInt16BE(end+s*2);cp++){
   const adjustment=cmap.readInt16BE(delta+s*2),distance=cmap.readUInt16BE(range+s*2);
   const raw=distance?cmap.readUInt16BE(range+s*2+distance+2*(cp-cmap.readUInt16BE(start+s*2))):cp;
   const glyph=distance&&!raw?0:(raw+adjustment)&0xffff;
   if(glyph)glyphs.add(cp);
  }
 }else if(format===12){
  for(let group=0;group<cmap.readUInt32BE(offset+12);group++){
   const entry=offset+16+group*12,start=cmap.readUInt32BE(entry),end=cmap.readUInt32BE(entry+4),glyph=cmap.readUInt32BE(entry+8);
   for(let cp=start;cp<=end;cp++)if(glyph+cp-start)glyphs.add(cp);
  }
 }else if(format!==14)throw Error(`Unsupported Unicode cmap format ${format}`);
}
const fvar=table('fvar'),axes={};
for(let i=0;i<fvar.readUInt16BE(8);i++){
 const offset=fvar.readUInt16BE(4)+i*fvar.readUInt16BE(10);
 axes[fvar.toString('ascii',offset,offset+4)]={min:fvar.readInt32BE(offset+4)/65536,default:fvar.readInt32BE(offset+8)/65536,max:fvar.readInt32BE(offset+12)/65536};
}
return {glyphs,axes,bytes:font.length,sha256:sha256(font),cmapSha256:sha256(cmap),glyphCount:table('maxp').readUInt16BE(4)};
}
const shantell=await inspectFont(fontPath);
const original=await inspectFont(sourcePath);
const provenance=JSON.parse(await readFile(provenancePath,'utf8'));
const originalAxes={wght:{min:300,default:300,max:800},ital:{min:0,default:0,max:1},INFM:{min:0,default:0,max:100},BNCE:{min:-100,default:0,max:100},SPAC:{min:0,default:0,max:100}};
const uiAxes={wght:originalAxes.wght,INFM:originalAxes.INFM};
assert.equal(original.sha256,expectedSourceSHA,'Official original Shantell checksum');
assert.equal(original.bytes,726944,'Official original Shantell bytes');
assert.deepEqual(original.axes,originalAxes,'Official original retains all five axes');
assert.equal(shantell.sha256,expectedUiSHA,'Exact UI Shantell checksum');
assert.equal(shantell.bytes,355796,'Exact UI Shantell bytes');
assert.deepEqual(shantell.axes,uiAxes,'UI font retains weight 300–800 and INFM 0–100');
assert.equal(shantell.cmapSha256,original.cmapSha256,'Entire original cmap is preserved');
assert.equal(original.glyphCount,1728,'Official glyph count');
assert.equal(shantell.glyphCount,original.glyphCount,'UI font preserves every glyph');
assert.equal(provenance.schema,1,'Font provenance schema');
assert.deepEqual(provenance.source,{file:'shantell-sans-variable.woff2',url:'https://raw.githubusercontent.com/arrowtype/shantell-sans/1.011/fonts/Shantell%20Sans/Web/ShantellSans%5BBNCE%2CINFM%2CSPAC%2Cital%2Cwght%5D.woff2',version:'1.011',bytes:original.bytes,sha256:original.sha256,axes:originalAxes},'Exact original provenance');
assert.deepEqual(provenance.ui,{file:'shantell-sans-ui-variable.woff2',bytes:shantell.bytes,sha256:shantell.sha256,axes:uiAxes},'Exact UI provenance');
assert.deepEqual(provenance.generator,{file:'scripts/cityrt/prepare-paper-font.py',sha256:sha256(await readFile(resolve(root,'scripts/cityrt/prepare-paper-font.py'))),fontTools:'4.66.1',Brotli:'1.2.0'},'Current pinned regeneration script');
assert.deepEqual(provenance.transformation,{pinnedAxes:{ital:0,BNCE:0,SPAC:0},characterSubset:false,removedZeroSupportTuples:21195,retainedExactSparseTuples:4758},'Approved exact axis projection');
assert.deepEqual(provenance.verification,{glyphCount:1728,unicodeCodepoints:837,cmapAndGlyphOrderIdentical:true,baseGlyfBytesIdentical:true,retainedGvarAndAvarIdentical:true,unitsPerEmIdentical:true,requiredKazakh:'ӘәҒғҚқҢңӨөҰұҮүҺһІі',instances:[300,500,550,650,800].flatMap(weight=>[0,8].map(INFM=>({weight,INFM,glyphs:1728,outlineDifferenceFontUnits:0,metricsHintsAndLayoutIdentical:true})))},'Exact native glyph/metrics/hints/layout verification record');
const characters=new Set(),files=[];
async function scan(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=resolve(directory,entry.name);
  if(entry.isDirectory())await scan(path);
  else if(/\.(?:tsx?|jsx?|json)$/.test(entry.name)){
   files.push(relative(root,path));
   const source=(await readFile(path,'utf8')).replace(/\\u([a-f\d]{4})/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).normalize('NFC');
   for(const character of source)if(/[\p{Script=Cyrillic}\p{Script=Latin}\p{Decimal_Number}]/u.test(character))characters.add(character);
  }
 }
}
await scan(resolve(root,'src'));
// These letters remain a contract even if an authored story temporarily omits one.
const kazakh='ӘәҒғҚқҢңӨөҰұҮүҺһІі';
for(const character of kazakh)characters.add(character);
const used=[...characters].sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
const fontsCss=postcss.parse(await readFile(resolve(root,'src/design/fonts.css'),'utf8'));
const notoGlyphs=new Set(),notoFiles=[];
let shantellFace=false;
for(const rule of fontsCss.nodes.filter(node=>node.type==='atrule'&&node.name==='font-face')){
 const declarations=Object.fromEntries(rule.nodes.filter(node=>node.type==='decl').map(node=>[node.prop,node.value]));
 if(/https?:/.test(declarations.src))throw Error('Font face must be supplied locally');
 if(declarations['font-family']==="'Shantell Sans Variable'"){
  shantellFace=declarations.src==="url('./assets/shantell-sans-ui-variable.woff2') format('woff2')"&&declarations['font-weight']==='300 800'&&declarations['font-style']==='normal';
 }
 if(declarations['font-family']==="'Noto Sans Variable'"){
  const source=declarations.src.match(/url\(([^)]+)\)/)?.[1];
  if(!source)throw Error('Noto Sans source missing');
  const path=resolve(root,'node_modules',source),face=await inspectFont(path);
  const ranges=declarations['unicode-range'].split(',').map(range=>range.trim().slice(2).split('-').map(value=>parseInt(value,16)));
  for(const cp of face.glyphs)if(ranges.some(([start,end=start])=>cp>=start&&cp<=end))notoGlyphs.add(cp);
  notoFiles.push({font:relative(root,path),bytes:face.bytes,sha256:face.sha256});
 }
}
if(!shantellFace||notoFiles.length!==3)throw Error('Local handwritten and body font faces must remain wired');
const licenses=['src/design/assets/SHANTELL-OFL.txt','node_modules/@fontsource-variable/noto-sans/LICENSE'];
for(const path of licenses)if(!/SIL OPEN FONT LICENSE|SIL Open Font License/.test(await readFile(resolve(root,path),'utf8')))throw Error(`OFL license missing: ${path}`);
assert.equal(sha256(await readFile(resolve(root,'src/design/assets/SHANTELL-OFL.txt'))),'ebfce7d104d597c385b71e9fbf8f0e2034e73320f857086105dc265b82c05caa','Official OFL remains unchanged');
const attribution=await readFile(resolve(root,'src/design/assets/SHANTELL-ATTRIBUTION.md'),'utf8');
for(const value of [expectedSourceSHA,expectedUiSHA,'prepare-paper-font.py','fontTools 4.66.1','Brotli 1.2.0'])if(!attribution.includes(value))throw Error(`UI font attribution missing ${value}`);
const release=await readFile(resolve(root,'scripts/release/build.mjs'),'utf8');
if(!release.includes("copy('src/design/assets/SHANTELL-OFL.txt'")||!release.includes("copy('src/design/assets/SHANTELL-ATTRIBUTION.md'"))throw Error('Both release paths must retain the local font license and credit');
const paper=postcss.parse(await readFile(resolve(root,option('paper-css')??'src/design/paper.css'),'utf8'));
let grain=false;
paper.walkAtRules('keyframes',()=>{throw Error('Shared paper texture must remain static');});
paper.walkDecls(declaration=>{
 if(declaration.prop==='--paper-grain')grain=declaration.value.includes('paper-grain.svg');
 if(/^animation(?:-name)?$/.test(declaration.prop)&&declaration.value!=='none')throw Error('Shared paper must not animate its grain');
 if(/^transition(?:-property)?$/.test(declaration.prop)&&/(background|filter|all)/.test(declaration.value))throw Error('Shared paper grain must not move during transitions');
});
const grainSvg=await readFile(resolve(root,'src/design/assets/paper-grain.svg'),'utf8');
if(!grain||/<(?:animate|animateTransform|set|feTurbulence)\b/.test(grainSvg))throw Error('Paper grain must be a fixed local pattern');
const missing=used.filter(character=>!shantell.glyphs.has(character.codePointAt(0)));
const bodyMissing=used.filter(character=>!notoGlyphs.has(character.codePointAt(0)));
const cyrillic=used.filter(character=>/\p{Script=Cyrillic}/u.test(character));
const report={font:relative(root,fontPath),bytes:shantell.bytes,sha256:shantell.sha256,axes:shantell.axes,original:{font:relative(root,sourcePath),bytes:original.bytes,sha256:original.sha256,axes:original.axes},provenance:relative(root,provenancePath),glyphCount:shantell.glyphCount,fullCmapIdentical:true,savingsBytes:original.bytes-shantell.bytes,sourceFiles:files.length,characters:used.join(''),characterCount:used.length,cyrillicAndKazakhCharacters:cyrillic.join(''),cyrillicAndKazakhCount:cyrillic.length,requiredKazakh:kazakh,missing,bodyFont:{files:notoFiles,missing:bodyMissing},licenses,staticGrain:true,status:missing.length||bodyMissing.length?'FAIL':'PASS'};
console.log(JSON.stringify(report,null,2));
if(missing.length||bodyMissing.length)process.exitCode=1;
