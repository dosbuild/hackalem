/** CPU evidence: regrouping may reorder records, but no source-owned byte changes. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';

const root=new URL('../../',import.meta.url),file=p=>new URL(p,root),hash=data=>createHash('sha256').update(data).digest('hex');
const output=resolve(process.env.RELEASE_OUTPUT||'artifacts/city-synthesis');
const baseline=process.env.FACADE_BASELINE;assert(baseline,'FACADE_BASELINE must name the saved pre-regroup report');
const before=JSON.parse(await readFile(baseline,'utf8')),meta=JSON.parse(await readFile(file('public/alem/geometry-low.json'),'utf8'));
const ownership=JSON.parse(await readFile(file('public/alem/architecture-source.json'),'utf8'));
const binary=await readFile(file('public/'+meta.architecture.asset.url)),association=new Map(ownership.sourceAssociations.map(g=>[g.id,g.sources])),bySource=new Map();
for(const g of meta.architecture.groups)for(let i=0;i<g.count;i++){
 const id=association.get(g.id)[i];if(!bySource.has(id))bySource.set(id,[]);
 bySource.get(id).push(g.family+'/'+g.part+'/'+g.columns+':'+binary.subarray(g.offset+i*32,g.offset+(i+1)*32).toString('base64'));
}
const digest=createHash('sha256');
for(const id of [...bySource.keys()].sort()){digest.update(id+'\n');for(const record of bySource.get(id).sort())digest.update(record+'\n');}
const sourceTransformDigest=digest.digest('hex'),citySha=hash(await readFile(file('public/alem/city.bin'))),buildingCoverageSha=hash(await readFile(file('public/alem/coverage-source.json'))),placementSha=hash(await readFile(file('src/world/placements.json')));
assert.equal(sourceTransformDigest,before.sourceTransformDigest);assert.equal(citySha,before.citySha);assert.equal(buildingCoverageSha,before.buildingCoverageSha);assert.equal(placementSha,before.placementSha);assert.equal(meta.architecture.instances,before.instances);assert.equal(meta.architecture.windows,before.windows);
const metadataSizes={};for(const p of ['public/alem/geometry-low.json','public/alem/geometry.json','src/world/bootstrap.json']){const bytes=await readFile(file(p));metadataSizes[p]={raw:bytes.length,gzip:gzipSync(bytes,{level:9}).length};}
const groupBytes=JSON.stringify(meta.architecture.groups),report={passed:true,cellSize:meta.architecture.cellSize,asset:meta.architecture.asset,groups:meta.architecture.groups.length,templates:Object.keys(meta.architecture.templateVertices).length,instances:meta.architecture.instances,windows:meta.architecture.windows,sourceTransformDigest,citySha,buildingCoverageSha,placementSha,groupsJsonBytes:Buffer.byteLength(groupBytes),groupsGzipBytes:gzipSync(groupBytes,{level:9}).length,metadataSizes,checks:['Every per-source 32-byte transform and template identity unchanged despite group reorder','Source coverage, placement JSON and complete packed city are byte-identical','Every instance and physical window retained']};
await mkdir(output,{recursive:true});await writeFile(resolve(output,'facade-regroup.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
