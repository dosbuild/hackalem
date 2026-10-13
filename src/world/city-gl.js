import {visibleBounds,shadowFrame,frustumPlanes} from './render-policy.js';
import {PALETTE,unitColor} from '../design/palette.js';
import {createInkPass} from './ink-pass.js';
import {indexTriangleVertices} from './mesh-index.js';
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;layout(location=2) in vec3 color;layout(location=3) in float kind;layout(location=4) in float style;layout(location=5) in vec4 instancePlacement;layout(location=6) in vec4 instanceAppearance;uniform float instanced;
uniform mat3 rotation;uniform float zoom;uniform float aspect;uniform float perspective;uniform vec3 center;out vec3 vP;out vec3 vN;out vec3 vColor;out float vKind;out vec3 vView;out float vStyle;out vec3 vDetailNormal;
void main(){vDetailNormal=vec3(0.,-1.,0.);vec3 p=position;vec3 modelNormal=normal;vec3 modelColor=color;if(instanced>.5){float c=cos(instanceAppearance.x),s=sin(instanceAppearance.x);mat3 turn=mat3(c,s,0.,-s,c,0.,0.,0.,1.);p=turn*p*instancePlacement.w+instancePlacement.xyz;modelNormal=turn*normal;vDetailNormal=turn*vDetailNormal;modelColor*=instanceAppearance.yzw;}vP=p;vN=modelNormal;vColor=modelColor;vKind=kind;vStyle=style;vView=rotation*(p-center);float viewW=1.-vView.z*perspective;gl_Position=vec4(vView.x*.83*zoom/aspect,vView.y*.83*zoom,-vView.z/4.,viewW);// Map paint offsets order flat surfaces; they are not physical walls that can hide a person.
// Reproject their depth onto a common ground plane at the SAME screen position.
// Cartographic layers share an overlay pass, but still need depth amongst themselves.
// A single constant depth hid every path, canopy and vehicle behind its own base.
if(kind>13.5&&kind<14.5)gl_Position.z=(-.99-clamp(p.z,0.,.5)*.01)*viewW;}`;
const fragment=`#version 300 es
precision highp float;precision highp sampler2DShadow;
in vec3 vP;in vec3 vN;in vec3 vColor;in float vKind;in vec3 vView;in float vStyle;in vec3 vDetailNormal;layout(location=0) out vec4 outputColor;layout(location=1) out vec4 outputNormal;
uniform vec3 center;uniform vec3 eventOrigin;uniform vec3 eventColor;uniform float eventRadius;uniform float eventPower;uniform vec3 lamps[24];uniform float lampCount;uniform vec3 lampMinimum;uniform vec3 lampMaximum;uniform vec3 cutPath[64];uniform float cutCount;uniform vec3 shadowOrigins[3];uniform vec3 shadowFocus;uniform vec3 sun;uniform mat3 lightBasis;uniform sampler2DShadow shadowMap0;uniform sampler2DShadow shadowMap1;uniform sampler2DShadow shadowMap2;uniform float shadowsEnabled;uniform float shadowSize;uniform vec3 groundBase;uniform float territoryScale;uniform float night;uniform float warmth;uniform mat3 rotation;uniform float zoom;
// Hardware comparison filtering interpolates visibility, not raw depth.
float sampleShadow(sampler2DShadow map,vec3 lp,float extent){
 vec2 uv=lp.xy/(extent*2.)+.5;float texel=extent*2./shadowSize;
 float nd=max(.1,dot(normalize(vN),sun));
 float bias=(.00004+texel*(.6+1.6*sqrt(max(0.,1.-nd*nd))/nd))/5.6;
 float depth=.5-lp.z/5.6-bias,s=0.;
 for(int x=0;x<2;x++)for(int y=0;y<2;y++)s+=texture(map,vec3(uv+(vec2(x,y)-.5)/shadowSize,depth));
 return .66+.34*s*.25;
}
float shadow(){
 if(shadowsEnabled<.5)return 1.;
 vec3 nearP=lightBasis*(vP-shadowOrigins[2]),focusP=lightBasis*(vP-shadowFocus);
 float nearEdge=smoothstep(.60,.84,max(abs(focusP.x),abs(focusP.y))/.0625);
 if(nearEdge==0.)return sampleShadow(shadowMap2,nearP,.0625);
 vec3 midP=lightBasis*(vP-shadowOrigins[1]);
 float midEdge=smoothstep(.60,.84,max(abs(focusP.x),abs(focusP.y))/.5);
 float s=1.;
 if(midEdge>0.)s=sampleShadow(shadowMap0,lightBasis*(vP-shadowOrigins[0]),2.8);
 if(midEdge<1.)s=mix(sampleShadow(shadowMap1,midP,.5),s,midEdge);
 if(nearEdge<1.)s=mix(sampleShadow(shadowMap2,nearP,.0625),s,nearEdge);
 return s;
}
vec3 illuminated(vec3 c){if(eventPower>.001){float fall=max(0.,1.-length(vP-eventOrigin)/max(.0001,eventRadius));c+=eventColor*fall*fall*eventPower;}if(lampCount<.5||any(lessThan(vP,lampMinimum))||any(greaterThan(vP,lampMaximum)))return c;for(int i=0;i<24;i++){if(float(i)>=lampCount)break;vec3 d=lamps[i]-vP;float fall=max(0.,1.-length(d)/.0038);float facing=max(.2,dot(normalize(vN),normalize(d)));c+=vec3(1.,.69,.30)*fall*fall*facing*(.20+night*2.6);}return c;}
// Smooth object-space grain resolves all face orientations and fades below a pixel.
float grainHash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float grainNoise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(grainHash(a),grainHash(a+vec2(1.,0.)),f.x),mix(grainHash(a+vec2(0.,1.)),grainHash(a+1.),f.x),f.y);}
float surfaceGrain(vec3 p,vec3 n){vec3 weights=pow(abs(n),vec3(4.));weights/=max(dot(weights,vec3(1.)),.001);vec3 q=p*3200.;vec3 footprint=fwidth(q);float pixel=dot(weights,vec3(max(footprint.y,footprint.z),max(footprint.x,footprint.z),max(footprint.x,footprint.y)));if(pixel>=1.)return 0.;float noise=dot(weights,vec3(grainNoise(q.yz),grainNoise(q.xz),grainNoise(q.xy)));return (noise-.5)*(1.-smoothstep(.3,1.,pixel));}
// Graphite belongs to physical surfaces and their cast shadows. No screen/time
// coordinates, sampled texture, extra geometry or temporal history enter it.
// A broad pass and a finer crossing pass soften away before becoming subpixel.
float pencilStroke(vec2 q,vec2 direction,float footprint){
 float along=dot(q,direction),across=dot(q,vec2(-direction.y,direction.x));
 float phase=across+sin(along*.47)*.07;
 float resolved=1.-smoothstep(.32,.85,footprint);
 float line=1.-smoothstep(.028,.060+footprint,abs(fract(phase)-.5));
 float pressure=.68+.32*sin(along*.29+across*.61);
 return line*pressure*resolved;
}
vec3 pencilShadow(vec3 color,vec3 normal,float visibility,float diffuse,float strength){
 float shadowWeight=clamp((1.-visibility)/.34,0.,1.);
 float tone=(shadowWeight*.16+(1.-diffuse)*.035)*strength*(1.-night*.85);
 color=mix(color,vec3(.157,.235,.251),tone);
 // Compute analytic footprints before any per-fragment shadow branch. The
 // small wobble's maximum derivative is included without evaluating its sine.
 if(zoom<6.)return color;
 vec2 plane=abs(normal.z)>.72?vP.xy:vec2(dot(vP.xy,normalize(vec2(-normal.y,normal.x))),vP.z);
 float broad=max(fwidth(dot(plane,vec2(-.392,.92)))+fwidth(dot(plane,vec2(.92,.392)))*.033,.000001)*1800.;
 float fine=max(fwidth(dot(plane,vec2(.768,.64)))+fwidth(dot(plane,vec2(.64,-.768)))*.033,.000001)*3900.;
 float inkWeight=(shadowWeight+(1.-diffuse)*.13)*strength*(1.-night*.85);
 // Below this weight even a full stroke changes less than one RGB8 level.
 // Subpixel strokes likewise do no trigonometric work for the visible frame.
 if(inkWeight<.025||(broad>=.85&&fine>=.85))return color;
 float first=broad<.85?pencilStroke(plane*1800.,vec2(.92,.392),broad):0.;
 float crossingStroke=fine<.85&&shadowWeight>.35?pencilStroke(plane*3900.,vec2(.64,-.768),fine)*smoothstep(.35,.95,shadowWeight):0.;
 return mix(color,vec3(.157,.235,.251),(first*.15+crossingStroke*.07)*inkWeight);
}
uniform float surfaceTexture;
float corridorDistance(vec2 p,vec2 a,vec2 b){vec2 d=b-a;float t=clamp(dot(p-a,d)/max(dot(d,d),.00000000001),0.,1.);return length(p-a-t*d);}
uniform float viewportHeight;uniform float perspective;uniform float cssHeight;uniform float detailHeight;uniform float detailFadeStart;uniform float detailFadeEnd;
void main(){
 // Every map-paint triangle evaluates the SAME plane at the SAME pixel.
 // Interpolating coplanar vertex depths made overlapping polygons flicker
 // when scaled, even with the small logical layer offsets in the vertex pass.
 bool ground=vKind<1.5||(vKind>3.5&&vKind<4.5)||(vKind>9.5&&vKind<10.5)||(vKind>17.5&&vKind<18.5)||(vKind>20.5&&vKind<22.5);
 float layer=vKind>21.5?.000008:vKind>20.5?-.000001:vKind>17.5?.000004:vKind>9.5?0.:vKind>3.5?.000006:vKind>.5?.000002:.000001;
 layer-=center.z;
 gl_FragDepth=ground?.5+((gl_FragCoord.y*2./viewportHeight-1.)/(.83*zoom)*rotation[2][1]-layer)/(8.*max(abs(rotation[2][2]-perspective*layer),.001)):gl_FragCoord.z;
 float opacity=1.;
 if(detailHeight>0.){
  float w=max(.015,1.-perspective*vView.z),nextW=max(.015,w-perspective*rotation[2][2]*detailHeight);
  float pixels=abs((vView.y+rotation[2][1]*detailHeight)/nextW-vView.y/w)*.415*zoom*cssHeight;
  opacity=smoothstep(detailFadeStart,detailFadeEnd,pixels);if(opacity<.005)discard;
 }
 outputNormal=vec4(normalize(rotation*(detailHeight>0.?vDetailNormal:vN))*.5+.5,ground||(vKind>12.5&&vKind<14.5)||vKind>25.5?0.:1.);
 outputNormal.a*=opacity;
 if(vKind>13.5&&vKind<14.5){outputColor=vec4(vColor*(.78+.22*max(0.,dot(normalize(vN),normalize(vec3(-.4,-.3,1.))))),1.);return;}if(cutCount>1.&&(vKind<10.5||vKind>17.5)&&abs(vKind-8.)>.1&&vP.z>=-.0001&&vP.z<.001){for(int i=1;i<64;i++){if(float(i)>=cutCount)break;if(corridorDistance(vP.xy,cutPath[i-1].xy,cutPath[i].xy)<.00067)discard;}}vec3 n=normalize(vN);if(vKind>10.5&&vKind<11.5){outputColor=vec4(vColor*(1.1+night*.4),1.);return;}if(vKind>12.5&&vKind<13.5){outputColor=vec4(vColor,1.);return;}if((vKind>9.5&&vKind<10.5)||(vKind>20.5&&vKind<21.5)){
 // Territory is a geographic identity: strong from above, quiet around people.
 // The surrounding apron remains neutral and never inherits a scenario colour.
 float territory=vKind<10.5?mix(.34,.10,smoothstep(3.,22.,zoom)):.08;
 vec3 base=mix(groundBase,vColor,territory*territoryScale);
 float patches=sin(vP.x*67.+sin(vP.y*23.)*2.)*sin(vP.y*81.+sin(vP.x*19.));
 base+=patches*.006;float detail=smoothstep(10.,35.,zoom);
 float grain=grainNoise(vP.xy*2100.);
 base+=(grain-.5)*.013*detail*(1.-smoothstep(.3,1.,max(fwidth(vP.x*2100.),fwidth(vP.y*2100.))));
 outputColor=vec4(illuminated(pencilShadow(base,vec3(0.,0.,1.),shadow(),1.,1.)*(1.-night*.40)),1.);return;
}
// Raised steppe surfaces meet the common plain continuously. Only the real
// slope gains terrain shading; there is no colored disk around each hill.
if(vKind>25.5&&vKind<26.5){
 float patches=sin(vP.x*67.+sin(vP.y*23.)*2.)*sin(vP.y*81.+sin(vP.x*19.));
 vec3 plain=groundBase+patches*.006;
 float h=smoothstep(.00008,.005,vP.z),slope=max(0.,dot(n,sun));
 vec3 rock=vColor*(.71+.29*slope);
 vec3 terrain=pencilShadow(mix(plain,rock,h),n,shadow(),slope,.8);
 outputColor=vec4(illuminated(mix(terrain,terrain*vec3(.58,.67,.76),night*.78)),1.);return;
}float nd=max(0.,dot(n,sun));float sh=shadow();float light=(.70+nd*.30)*(.88+.12*sh);vec3 warm=mix(vec3(1.01,1.,.97),vec3(1.06,.99,.91),warmth);vec3 c=vColor*light*warm;if(surfaceTexture>0.&&zoom>10.)c*=1.+surfaceGrain(vP,n)*.021*smoothstep(10.,35.,zoom)*surfaceTexture;
c=mix(c,c*vec3(.44,.64,.88),night*.76);
float close=smoothstep(5.,24.,zoom);
if(vKind>2.5&&vKind<3.5&&vStyle<16.){
 float along=dot(vP.xy,normalize(vec2(-n.y,n.x)));
 vec2 uv=vec2(along/(.00040+mod(vStyle,3.)*.00006),vP.z/.00070);
 vec2 f=fract(uv),aa=max(fwidth(uv),vec2(.015));
 vec2 pane=smoothstep(vec2(.19)-aa,vec2(.19)+aa,f)*(1.-smoothstep(vec2(.77)-aa,vec2(.77)+aa,f));
 float resolved=1.-smoothstep(.3,1.,max(aa.x,aa.y));
 float win=pane.x*pane.y*smoothstep(.00072,.0011,vP.z)*resolved;
 vec3 glass=mix(vec3(.29,.40,.48),vec3(.43,.54,.61),mod(floor(uv.x)+vStyle,4.)*.19);
 c=mix(c,glass*(.81+.19*nd),win*close*.58*(1.-night));
 float floorline=1.-smoothstep(.055-aa.y,.055+aa.y,f.y);
 c=mix(c,c*.75,floorline*close*.35*resolved);
 float lit=step(.42,fract(sin(dot(floor(uv),vec2(17.1,43.7))+vStyle)*15843.9));
 c+=vec3(1.,.65,.26)*win*lit*night*.85;
 c*=.87+.13*smoothstep(.00045,.00135,vP.z);
}
if(vKind>1.5&&vKind<2.5){
 vec2 uv=vP.xy*1800.;float aa=max(fwidth(uv.x),fwidth(uv.y));float seam=(1.-smoothstep(.025,.06+aa,min(fract(uv.x),fract(uv.y))))*(1.-smoothstep(.25,1.,aa));
 c*=1.-seam*close*.045;
}
if(vKind>17.5&&vKind<18.5){vec2 uv=vP.xy*3200.,a=fwidth(uv);vec2 f=fract(uv);float joint=1.-smoothstep(.03,.03+max(a.x,a.y),min(f.x,f.y));c*=1.-joint*smoothstep(18.,70.,zoom)*.14*(1.-smoothstep(.3,1.,max(a.x,a.y)));}
if(vKind>15.5&&vKind<16.5)c=mix(c,c*vec3(1.04,1.06,.96),.45);
if(vKind>.5&&vKind<1.5){vec3 halfV=normalize(sun+transpose(rotation)*vec3(0.,0.,1.));float spec=pow(max(0.,dot(n,halfV)),24.);c+=vec3(.8,.72,.48)*spec*.08*(1.-night);c+=vec3(.025,.04,.025);}
// Landmark glass is opaque geometry with a broad sky reflection. Its structure
// stays legible in shade, while a restrained sun highlight follows the camera.
if(vKind>22.5&&vKind<24.5){
 vec3 eye=transpose(rotation)*vec3(0.,0.,1.);float facing=abs(dot(n,eye));
 vec3 halfV=normalize(sun+eye);float shine=pow(max(0.,dot(n,halfV)),vKind<23.5?30.:20.);
 float rim=pow(1.-facing,3.);float skyTone=.5+.5*n.z;
 if(vKind<23.5){c=mix(c,vColor*(.91+.18*skyTone),.31);c+=vec3(.25,.43,.46)*rim*.15*(1.-night);c+=vec3(.93,.98,.9)*shine*.14*(1.-night);c+=vColor*night*.14;}
 else {c+=vec3(1.,.81,.43)*(shine*.16+rim*.06)*(1.-night);}
}
if(vKind>24.5&&vKind<25.5)c=mix(c,vColor*(1.08+night*.2),.3+night*.7);
if(vKind>5.5&&vKind<6.5)c+=vColor*night*.08;if(vKind>6.5&&vKind<7.5)c=mix(c,vec3(.83,.68,.38),night*.7);
// Water and living silhouettes remain quiet; large roofs, felt, timber and
// pavement carry the pencil work. Native facade openings keep their own depth.
if(surfaceTexture>.5&&detailHeight==0.&&(vKind<.5||(vKind>1.5&&vKind<4.5)||(vKind>7.5&&vKind<9.5)||(vKind>16.5&&vKind<19.5)))c=pencilShadow(c,n,sh,nd,.8);
outputColor=vec4(illuminated(c),opacity);}`;
const shadowVertex=`#version 300 es
precision highp float;layout(location=0) in vec3 position;layout(location=3) in float kind;layout(location=5) in vec4 instancePlacement;layout(location=6) in vec4 instanceAppearance;uniform float instanced;uniform mat3 lightBasis;uniform vec3 shadowOrigin;uniform float shadowExtent;uniform float zoom;out float shadowKind;void main(){shadowKind=kind;vec3 v=position;if(instanced>.5){float c=cos(instanceAppearance.x),s=sin(instanceAppearance.x);v=mat3(c,s,0.,-s,c,0.,0.,0.,1.)*v*instancePlacement.w+instancePlacement.xyz;}vec3 p=lightBasis*(v-shadowOrigin);gl_Position=vec4(p.xy/shadowExtent,-p.z/2.8,1.);}`;
const shadowFragment=`#version 300 es
precision highp float;in float shadowKind;void main(){if(shadowKind<1.5||(shadowKind>3.5&&shadowKind<7.5)||(shadowKind>9.5&&shadowKind<10.5)||(shadowKind>12.5&&shadowKind<15.5)||(shadowKind>17.5&&shadowKind<18.5)||(shadowKind>19.5&&shadowKind<22.5)||shadowKind>24.5)discard;}`;
const skyVertex=`#version 300 es
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;layout(location=0) out vec4 outputColor;layout(location=1) out vec4 skyNormal;uniform float night;uniform float warmth;uniform float tick;uniform float aspect;uniform float zoom;uniform vec3 skyTop;uniform vec3 skyBottom;uniform vec3 nightTop;uniform vec3 nightBottom;
void main(){skyNormal=vec4(.5,.5,1.,0.);vec3 top=mix(skyTop,nightTop,night);vec3 bottom=mix(skyBottom,nightBottom,night);bottom=mix(bottom,vec3(.82,.64,.46),warmth*(1.-night)*.16);vec3 c=mix(bottom,top,smoothstep(-.1,1.,uv.y));vec2 p=(uv-.5)*vec2(aspect,1.);float field=sin(p.x*3.+p.y*5.)+sin(p.x*1.7-p.y*4.);c+=vec3(.008,.010,.007)*field*(1.-night*.4);float haze=exp(-pow((p.y+.17+sin(p.x*2.)*.1)*5.,2.));c+=vec3(.018,.020,.013)*haze;float shade=exp(-pow(p.x*2.1,2.)-pow((p.y+.15)*4.,2.));c-=shade*.014;float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);c+=(grain-.5)*.006;outputColor=vec4(c,1.);}`;
function program(gl,vs,fs){
 const p=gl.createProgram(),shaders=[];
 try{for(const [type,source]of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 catch(error){gl.deleteProgram(p);throw error;}
 finally{shaders.forEach(s=>gl.deleteShader(s));}
}
export function createRenderer(canvas,data,metadata,options={}) {
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL 2 недоступен');
 const shadowSize=options.shadowSize??(globalThis.navigator?.deviceMemory<4?512:1024),palette={...PALETTE,...options.palette};
 let main,depth,sky,ink;
 try{main=program(gl,vertex,fragment);depth=program(gl,shadowVertex,shadowFragment);sky=program(gl,skyVertex,skyFragment);ink=createInkPass(gl);}
 catch(error){for(const p of [main,depth,sky])if(p)gl.deleteProgram(p);throw error;}
 const meshes=[],tiles=new Map(),instances=new Map(),templates=new Map(),placements=new Map(),instanceCells=new Map(),instanceRegions=new Map();let activeProgram=main,instanceEpoch=0;
 const extendBounds=(target,bounds)=>{for(let i=0;i<6;i++)target[i]=[0,1,4].includes(i)?Math.min(target[i]??0,bounds[i]??0):Math.max(target[i]??0,bounds[i]??0);};
 function upload(data,asset,geometry=null){
  const indexed=asset?.vertexBytes!==undefined,vertexBytes=indexed?asset.vertexBytes:data.byteLength;
  if(vertexBytes%20||(!indexed&&data.byteLength%60)||indexed&&(vertexBytes>data.byteLength||(data.byteLength-vertexBytes)%12))throw Error('Invalid city triangles');
  const vao=geometry?.vao??gl.createVertexArray(),buffer=geometry?.buffer??gl.createBuffer(),index=geometry?.index??(indexed?gl.createBuffer():null);
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(!geometry)gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(data,0,vertexBytes),gl.STATIC_DRAW);
  if(index){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);if(!geometry)gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(data,vertexBytes),gl.STATIC_DRAW);}
  if(gl.getError()!==gl.NO_ERROR){if(!geometry){gl.deleteVertexArray(vao);gl.deleteBuffer(buffer);if(index)gl.deleteBuffer(index);}throw Error('City GPU allocation failed');}
  if(!geometry)for(const [loc,size,type,norm,offset] of [[0,3,gl.FLOAT,false,0],[1,3,gl.BYTE,true,12],[2,3,gl.UNSIGNED_BYTE,true,15],[3,1,gl.UNSIGNED_BYTE,false,18],[4,1,gl.UNSIGNED_BYTE,false,19]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,norm,20,offset);}
  gl.bindVertexArray(null);const mesh={vao,buffer,index,geometry,bytes:data.byteLength,count:indexed?(data.byteLength-vertexBytes)/4:data.byteLength/20};if(geometry)geometry.references++;meshes.push(mesh);return mesh;
 }
 function remove(mesh){if(!mesh.geometry||!--mesh.geometry.references){gl.deleteVertexArray(mesh.vao);gl.deleteBuffer(mesh.buffer);if(mesh.index)gl.deleteBuffer(mesh.index);if(mesh.geometry)templates.delete(mesh.geometry.key);}if(mesh.placement&&!--mesh.placement.references){gl.deleteBuffer(mesh.instanceBuffer);placements.delete(mesh.placement.data);}const index=meshes.indexOf(mesh);if(index!==-1)meshes.splice(index,1);}
 const city=upload(data),cityMetadata=metadata;let projects=null,programs=null,actors=null,transit=null,projectShadows=false,programShadows=false;
 // Keep static city depth separate from changing residents and projects.
 const shadowTargets=[];
 function shadowTarget(){
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,shadowSize,shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
  for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
  for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
  const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  const target={texture,framebuffer,complete:gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE};shadowTargets.push(target);return target;
 }
 const cascades=Array.from({length:3},()=>({city:shadowTarget(),composite:shadowTarget(),cityKey:'',compositeKey:''}));
 const shadowsEnabled=shadowTargets.every(t=>t.complete);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 const locations=new Map();function uniform(p,name,value){const key=(p===main?'m':p===depth?'d':'s')+name;let l=locations.get(key);if(l===undefined){l=gl.getUniformLocation(p,name);locations.set(key,l);}if(Array.isArray(value)||value instanceof Float32Array){if(value.length===9&&!name.endsWith('[0]'))gl.uniformMatrix3fv(l,false,value);else gl.uniform3fv(l,value);}else gl.uniform1f(l,value);}
 let calls=0,visibleVertices=0,visibleBatches=0,visibleBuildings=0,visibleTiles=0,shadowDrawCalls=0,frameDrawCalls=0;
 function drawMesh(m,start=0,count=m.count){gl.bindVertexArray(m.vao);if(m.instanceCount){gl.bindBuffer(gl.ARRAY_BUFFER,m.instanceBuffer);for(const [location,offset]of [[5,0],[6,16]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.FLOAT,false,32,m.instanceOffset+offset);gl.vertexAttribDivisor(location,1);}}uniform(activeProgram,'instanced',m.instanceCount?1:0);
 // Small facade parts carry their own stone/glass colors and physical depth.
 // Triplanar grain cannot describe those pixel-sized frames but shades every
 // overlapping pane/rail fragment, especially during their continuous fade.
 uniform(activeProgram,'surfaceTexture',m===actors||m===transit||m.detailHeight?0:1);uniform(activeProgram,'detailHeight',m.detailHeight??0);uniform(activeProgram,'detailFadeStart',m.fadePixels?.[0]??.8);uniform(activeProgram,'detailFadeEnd',m.fadePixels?.[1]??2.2);if(m.instanceCount){if(m.index)gl.drawElementsInstanced(gl.TRIANGLES,count,gl.UNSIGNED_INT,start*4,m.instanceCount);else gl.drawArraysInstanced(gl.TRIANGLES,start,count,m.instanceCount);}else if(m.index)gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,start*4);else gl.drawArrays(gl.TRIANGLES,start,count);calls++;}
 function drawCity(view){
  drawMesh(city);visibleVertices=city.count;visibleBatches=1;visibleBuildings=0;visibleTiles=0;
  for(const r of cityMetadata.tiles){
   if(!visibleBounds(r.bounds,view))continue;
   const mesh=tiles.get(r.url);if(!mesh)throw Error('City drawn before preparation completed');visibleTiles++;
   if(view.zoom<3){drawMesh(mesh);visibleVertices+=mesh.count;visibleBuildings+=r.buildings;visibleBatches++;}
   else for(const batch of r.batches){if(!visibleBounds(batch.bounds,view))continue;drawMesh(mesh,batch.start,batch.count);visibleVertices+=batch.count;visibleBuildings+=batch.buildings;visibleBatches++;}
  }
 }
 function detailPixels(b,detailHeight,view){
  const x=(b[0]+b[2])/2-view.center[0],y=(b[1]+b[3])/2-view.center[1],height=((b[4]??0)+(b[5]??0))/2-(view.center[2]??0),m=view.rotation;
  const z=m[2]*x+m[5]*y+m[8]*height,dz=Math.abs(m[2])*(b[2]-b[0])/2+Math.abs(m[5])*(b[3]-b[1])/2+Math.abs(m[8])*((b[5]??0)-(b[4]??0))/2;
  const k=view.perspective??0,w=Math.max(.015,1-k*(z+dz)),vertical=Math.abs(m[7])+Math.abs(k*m[8])/(.83*view.zoom);
  return detailHeight*vertical*.415*view.zoom*view.viewportHeight/Math.max(.015,w-Math.abs(k*m[8]*detailHeight));
 }
 function drawInstances(view){
  const depthPass=activeProgram===depth;
  // Source batches already share geographic cells. Their union is only an
  // early rejection; exact child tests and original draw order remain intact.
  const visibleCells=[],epoch=++instanceEpoch;let visibleCount=0;
  // Coarse unions reject distant source cells without visiting thousands of
  // their children. The exact cell/mesh tests and insertion order stay intact.
  for(const region of instanceRegions.values()){
   if(depthPass&&!region.hasDepth||!visibleBounds(region.bounds,view))continue;
   for(const cell of region.cells){
    if((!depthPass||cell.hasDepth)&&visibleBounds(cell.bounds,view)&&(cell.hasDepth||!(detailPixels(cell.bounds,cell.detailHeight,view)<cell.fadeStart))){cell.visibleEpoch=epoch;visibleCells.push(cell);visibleCount+=cell.meshes.length;}
   }
  }
  // A broad view retains the original scan; sparse views visit only admitted
  // cells, sorted by the original insertion order before exact child checks.
  let visibleMeshes=instances.values();
  if(visibleCount<instances.size*.25){
   const sparse=[];for(const cell of visibleCells)for(const mesh of cell.meshes)sparse.push(mesh);
   sparse.sort((a,b)=>a.instanceOrder-b.instanceOrder);visibleMeshes=sparse;
  }
  for(const mesh of visibleMeshes){
  if(mesh.detailHeight&&depthPass||mesh.cell.visibleEpoch!==epoch||!visibleBounds(mesh.bounds,view))continue;
  if(mesh.detailHeight){
   if(detailPixels(mesh.bounds,mesh.detailHeight,view)<(mesh.fadePixels?.[0]??.8))continue;
   // Facade parts are closed stone/glass boxes with outward winding. Their
   // hidden back faces add layers of blend/late-depth work during the fade;
   // retain the full mesh and shade only its physically visible faces.
   gl.enable(gl.CULL_FACE);
   gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }
  drawMesh(mesh);if(mesh.detailHeight){gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);}visibleVertices+=mesh.count*mesh.instanceCount;visibleBuildings+=mesh.buildings;visibleBatches++;
 }}
 function drawWorld(view){drawCity(view);drawInstances(view);if(programs?.count)drawMesh(programs);if(projects?.count)drawMesh(projects);if(actors?.count)drawMesh(actors);if(transit?.count)drawMesh(transit);}
 let cityRevision=0,dynamicRevision=0,lastDrawMs=0,drawCount=0,totalDrawMs=0,statsRevision=-1,staticStats;
 function residentStats(){
  if(statsRevision!==cityRevision){
   staticStats={cityVertices:city.count,gpuBufferBytes:city.bytes,gpuBuffers:1+placements.size,instanceCount:0};
   for(const t of tiles.values()){staticStats.cityVertices+=t.count;staticStats.gpuBufferBytes+=t.bytes;staticStats.gpuBuffers+=1+Number(!!t.index);}
   for(const t of templates.values()){staticStats.gpuBufferBytes+=t.bytes;staticStats.gpuBuffers+=1+Number(!!t.index);}
   for(const p of placements.values())staticStats.gpuBufferBytes+=p.bytes;
   for(const m of instances.values())staticStats.instanceCount+=m.instanceCount;
   statsRevision=cityRevision;
  }
  return staticStats;
 }
 function updateMesh(mesh,data){
  // Leaving a scene must release its dynamic VAO/buffer too. Keeping an empty
  // allocation retained invisible residents/trains after a camera round trip.
  if(!data.byteLength){if(mesh)remove(mesh);return null;}
  if(!mesh)return upload(data);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);mesh.count=data.byteLength/20;mesh.bytes=data.byteLength;return mesh;
 }
 return {addInstances(id,data,transforms,bounds,buildings=0,options={}){
  if(instances.has(id)||transforms.length%8||!transforms.length)throw Error('Invalid instance batch');
  const key=options.templateKey??data,existing=templates.get(key);
  if(existing&&existing.data!==data)throw Error('City instance template key collision');
  // Reuse exact packed vertices only for the static native facade templates.
  // Indices retain the original triangle order and all placement bytes; the
  // other world meshes keep their existing upload and rendering contracts.
  const indexed=!existing&&options.detailHeight?indexTriangleVertices(data):null;
  const mesh=upload(indexed?.data??data,indexed??undefined,existing);
  if(!existing){const geometry={key,data,vao:mesh.vao,buffer:mesh.buffer,index:mesh.index,bytes:mesh.bytes,references:1};mesh.geometry=geometry;templates.set(key,geometry);}
  let placement=placements.get(transforms.buffer);
  if(!placement){placement={data:transforms.buffer,buffer:gl.createBuffer(),bytes:transforms.buffer.byteLength,references:0};gl.bindBuffer(gl.ARRAY_BUFFER,placement.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(transforms.buffer),gl.STATIC_DRAW);placements.set(transforms.buffer,placement);}
  placement.references++;mesh.placement=placement;
  mesh.detailHeight=options.detailHeight??0;mesh.fadePixels=options.fadePixels;mesh.instanceCount=transforms.length/8;mesh.instanceBuffer=placement.buffer;mesh.instanceOffset=transforms.byteOffset;mesh.bounds=bounds;mesh.buildings=buildings;
  const match=String(id).match(/^architecture\/[^/]+\/[^/]+\/[^/]+\/(-?\d+)\/(-?\d+)$/),cellKey=match?match[1]+'/'+match[2]:id;
  let cell=instanceCells.get(cellKey);
  if(!cell){
   const regionKey=Math.floor((bounds[0]+bounds[2])/.24)+'/'+Math.floor((bounds[1]+bounds[3])/.24);let region=instanceRegions.get(regionKey);
   if(!region){region={bounds:[...bounds],hasDepth:false,cells:[]};instanceRegions.set(regionKey,region);}
   cell={bounds:[...bounds],hasDepth:false,detailHeight:0,fadeStart:Infinity,visibleEpoch:0,meshes:[],region};region.cells.push(cell);instanceCells.set(cellKey,cell);
  }else extendBounds(cell.bounds,bounds);
  extendBounds(cell.region.bounds,bounds);cell.region.hasDepth||=!mesh.detailHeight;
  cell.hasDepth||=!mesh.detailHeight;cell.detailHeight=Math.max(cell.detailHeight,mesh.detailHeight);cell.fadeStart=Math.min(cell.fadeStart,mesh.fadePixels?.[0]??.8);mesh.cell=cell;
  mesh.instanceOrder=instances.size;cell.meshes.push(mesh);instances.set(id,mesh);cityRevision++;
 },addTile(id,data,asset){if(tiles.has(id))throw Error('Duplicate resident city batch');tiles.set(id,upload(data,asset));cityRevision++;},replacePrograms(data,shadows=true){if(!programs&&!data.byteLength)return;programs=updateMesh(programs,data);programShadows=shadows&&data.byteLength>0;cityRevision++;},replaceTransit(data){if(!transit&&!data.byteLength)return;transit=updateMesh(transit,data);dynamicRevision++;},replaceActors(data){if(!actors&&!data.byteLength)return;actors=updateMesh(actors,data);dynamicRevision++;},replaceProjects(data,shadowChanged=true){if(!projects&&!data.byteLength)return;projects=updateMesh(projects,data);if(shadowChanged||projectShadows)dynamicRevision++;projectShadows=shadowChanged&&data.byteLength>0;},
 // Only the first complete frame waits for GPU completion, before the map is revealed.
 prepared(){gl.finish();if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('City preparation failed');},
 draw({rotation,zoom,center,time,tick,width,height,perspective=0,focusPoint=[0,0,0],lamps=[],cutPath=[],eventLight=null}){
 const drawView={rotation,zoom,center,perspective,aspect:width/height,viewportHeight:height,clipPlanes:frustumPlanes({rotation,zoom,perspective,aspect:width/height})};calls=0;shadowDrawCalls=0;const started=performance.now(),scale=Math.min(globalThis.devicePixelRatio||1,1.25,Math.sqrt(1_300_000/(width*height))),w=Math.round(width*scale),h=Math.round(height*scale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const {sun,basis,frames}=shadowFrame(time,zoom,focusPoint,shadowSize),night=Math.max(0,Math.min(1,(-sun[2]+.06)*2.6)),warmth=Math.max(0,1-Math.abs(sun[2])*2.7);
 if(shadowsEnabled){
  gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(depth);activeProgram=depth;
  for(let i=0;i<cascades.length;i++){
   const cache=cascades[i],frame=frames[i],key=frame.key+':'+cityRevision,dynamicKey=key+':'+dynamicRevision;
   for(const [n,v] of Object.entries({lightBasis:basis,shadowOrigin:frame.origin,shadowExtent:frame.extent}))uniform(depth,n,v);
   if(cache.cityKey!==key){
    gl.bindFramebuffer(gl.FRAMEBUFFER,cache.city.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);
    const shadowView={rotation:basis,center:frame.origin,zoom:1/(.83*frame.extent),aspect:1};drawCity(shadowView);drawInstances(shadowView);if(programShadows&&programs?.count)drawMesh(programs);cache.cityKey=key;
   }
   cache.active=cache.city;
   if(projects?.count||actors?.count||transit?.count){
    cache.active=cache.composite;
    if(cache.compositeKey!==dynamicKey){
     gl.bindFramebuffer(gl.READ_FRAMEBUFFER,cache.city.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,cache.composite.framebuffer);
     gl.blitFramebuffer(0,0,shadowSize,shadowSize,0,0,shadowSize,shadowSize,gl.DEPTH_BUFFER_BIT,gl.NEAREST);
     gl.bindFramebuffer(gl.FRAMEBUFFER,cache.composite.framebuffer);
     if(projects?.count)drawMesh(projects);if(actors?.count)drawMesh(actors);if(transit?.count)drawMesh(transit);cache.compositeKey=dynamicKey;
    }
   }
  }
  shadowDrawCalls=calls;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 const inkActive=ink.begin(w,h);gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.useProgram(sky);for(const [n,v] of Object.entries({night,warmth,tick,aspect:width/height,zoom,skyTop:unitColor(palette.skyTop),skyBottom:unitColor(palette.skyBottom),nightTop:unitColor(palette.nightTop),nightBottom:unitColor(palette.nightBottom)}))uniform(sky,n,v);gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(main);activeProgram=main;gl.depthFunc(gl.LEQUAL);uniform(main,'viewportHeight',h);uniform(main,'cssHeight',height);uniform(main,'shadowsEnabled',shadowsEnabled?1:0);uniform(main,'shadowSize',shadowSize);uniform(main,'groundBase',unitColor(palette.land));uniform(main,'territoryScale',options.territoryScale??1);for(const [n,v] of Object.entries({rotation,zoom,center,perspective,aspect:width/height,sun,night,warmth,lightBasis:basis,shadowFocus:focusPoint,'shadowOrigins[0]':frames.flatMap(f=>f.origin)}))uniform(main,n,v);for(let i=0;i<cascades.length;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,cascades[i].active?.texture||cascades[i].city.texture);gl.uniform1i(gl.getUniformLocation(main,'shadowMap'+i),i);}uniform(main,'eventOrigin',eventLight?.origin||[0,0,0]);uniform(main,'eventColor',eventLight?.color||[0,0,0]);uniform(main,'eventRadius',eventLight?.radius||1);uniform(main,'eventPower',eventLight?.strength||0);// Outside these world-space bounds every lamp contribution is exactly zero.
 const activeLamps=lamps.slice(0,24);uniform(main,'lampMinimum',[0,1,2].map(i=>activeLamps.length?Math.min(...activeLamps.map(p=>p[i]))-.003801:0));uniform(main,'lampMaximum',[0,1,2].map(i=>activeLamps.length?Math.max(...activeLamps.map(p=>p[i]))+.003801:0));uniform(main,'lampCount',activeLamps.length);uniform(main,'lamps[0]',[...lamps.slice(0,24).flat(),...Array(Math.max(0,72-lamps.length*3)).fill(0)]);uniform(main,'cutCount',Math.min(64,cutPath.length));uniform(main,'cutPath[0]',[...cutPath.slice(0,64).flatMap(p=>[p[0],p[1],0]),...Array(Math.max(0,192-cutPath.length*3)).fill(0)]);drawWorld(drawView);if(inkActive)ink.finish({zoom,aspect:width/height,perspective,pixelRatio:scale,strength:Math.min(1,Math.max(0,(zoom-1.3)/5))* .82});frameDrawCalls=calls+1+Number(inkActive)*2;
 lastDrawMs=performance.now()-started;drawCount++;totalDrawMs+=lastDrawMs;return {night,warmth};},
 diagnostics(){const resident=residentStats();return {...ink.diagnostics(),cityVertices:resident.cityVertices,projectVertices:(projects?.count||0)+(programs?.count||0),programVertices:programs?.count||0,actorVertices:actors?.count||0,transitVertices:transit?.count||0,groundVertices:cityMetadata.groundCount,projection:cityMetadata.projection,drawCount,drawSubmitMs:lastDrawMs,drawSubmitAverageMs:totalDrawMs/Math.max(1,drawCount),baseDrawCalls:visibleBatches,frameDrawCalls,shadowDrawCalls,visibleCityVertices:visibleVertices,renderedBuildings:visibleBuildings,culledBuildings:cityMetadata.buildingFeatures-visibleBuildings,residentBuildings:tiles.size===cityMetadata.tiles.length?cityMetadata.buildingFeatures:0,residentTiles:tiles.size,expectedTiles:cityMetadata.tiles.length,renderedTiles:visibleTiles,culledTiles:tiles.size-visibleTiles,gpuBufferBytes:resident.gpuBufferBytes+(programs?.bytes||0)+(projects?.bytes||0)+(actors?.bytes||0)+(transit?.bytes||0),shadowSize,gpuShadowBytes:shadowTargets.length*shadowSize*shadowSize*4,gpuMeshes:meshes.length,instanceBatches:instances.size,instanceCount:resident.instanceCount,gpuBuffers:resident.gpuBuffers+Number(!!programs)+Number(!!projects)+Number(!!actors)+Number(!!transit),gpuTemplates:templates.size,gpuVertexArrays:1+tiles.size+templates.size+Number(!!programs)+Number(!!projects)+Number(!!actors)+Number(!!transit),gpuPlacementBuffers:placements.size,completeCity:tiles.size===cityMetadata.tiles.length,environment:cityMetadata.environment};},
 destroy(){ink.destroy();for(const m of meshes.splice(0))remove(m);for(const cell of instanceCells.values())cell.meshes.length=0;instanceCells.clear();for(const region of instanceRegions.values())region.cells.length=0;instanceRegions.clear();cityRevision++;for(const t of shadowTargets){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer);}[main,depth,sky].forEach(p=>gl.deleteProgram(p));gl.getExtension('WEBGL_lose_context')?.loseContext();}};
}
