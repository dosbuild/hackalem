// Screen-space ink reads physical depth and normals, never triangle edges.
// Scene attachments and the edge-mask composite are resized in place and released with the world.
const vertex=`#version 300 es
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 outputColor;
uniform sampler2D sceneColor;uniform sampler2D sceneNormal;uniform sampler2D sceneDepth;
uniform vec2 pixel;uniform float pixelRatio;uniform float zoom;uniform float aspect;uniform float perspective;uniform float strength;
vec3 point(vec2 p,float depth){float d=(.5-depth)*8.,z=d/(1.+perspective*d),w=1.-perspective*z;return vec3((p*2.-1.)*vec2(aspect,1.)/(.83*zoom)*w,z);}
void main(){
 vec3 color=texture(sceneColor,uv).rgb;
 // Directional antialiasing resolves thin diagonal ink and model details without
 // accumulating temporal history or moving the surface's authored texture.
 vec3 weights=vec3(.299,.587,.114);
 float nw=dot(texture(sceneColor,uv+pixel*vec2(-1.,1.)).rgb,weights),ne=dot(texture(sceneColor,uv+pixel).rgb,weights);
 float sw=dot(texture(sceneColor,uv-pixel).rgb,weights),se=dot(texture(sceneColor,uv+pixel*vec2(1.,-1.)).rgb,weights),middle=dot(color,weights);
 vec2 direction=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
 float reduction=max((nw+ne+sw+se)*.0078125,.0078125);
 direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+reduction),vec2(-4.),vec2(4.))*pixel;
 vec3 aa=.5*(texture(sceneColor,uv-direction/6.).rgb+texture(sceneColor,uv+direction/6.).rgb);
 vec3 bb=aa*.5+.25*(texture(sceneColor,uv-direction*.5).rgb+texture(sceneColor,uv+direction*.5).rgb);
 float brightness=dot(bb,weights);color=brightness<min(middle,min(min(nw,ne),min(sw,se)))||brightness>max(middle,max(max(nw,ne),max(sw,se)))?aa:bb;
 vec4 a=texture(sceneNormal,uv);vec3 n=normalize(a.xyz*2.-1.);
 float depth=texture(sceneDepth,uv).r;vec3 p=point(uv,depth);
 float worldPixel=2.*pixel.y*pixelRatio/(.83*zoom)*max(.015,1.-perspective*p.z);
 float edge=0.;
 for(int i=0;i<8;i++){
  float angle=float(i)*.7853981634;vec2 at=uv+vec2(cos(angle),sin(angle))*pixel*pixelRatio*.7;
  vec4 b=texture(sceneNormal,at);float d=texture(sceneDepth,at).r;
  float silhouette=abs(a.a-b.a);
  float crease=smoothstep(.24,.48,1.-dot(n,normalize(b.xyz*2.-1.)))*a.a*b.a;
  // A slanted planar face has zero plane residual. This excludes coplanar
  // seams and internal triangulation while retaining real overlapping volumes.
  float residual=abs(dot(point(at,d)-p,n));
  float separation=smoothstep(worldPixel*1.3+.000006,worldPixel*2.8+.000012,residual)*a.a*b.a;
  edge=max(edge,max(silhouette*.78,max(crease*.46,separation*.68)));
 }
 // The resolve mask follows the same continuous ink appearance at overview scale.
 outputColor=vec4(mix(color,vec3(.157,.235,.251),edge*strength),edge*strength);
}`;

// Resolve only geometry ink edges; unmarked facade interiors keep their detail.
const resolveFragment=`#version 300 es
precision highp float;
in vec2 uv;out vec4 outputColor;uniform sampler2D image;uniform vec2 pixel;
void main(){
 float mask=max(texture(image,uv).a,max(max(texture(image,uv+pixel*vec2(-1.,1.)).a,texture(image,uv+pixel).a),max(texture(image,uv-pixel).a,texture(image,uv+pixel*vec2(1.,-1.)).a)));
 vec3 color=texture(image,uv).rgb;if(mask==0.){outputColor=vec4(color,1.);return;}vec3 weights=vec3(.299,.587,.114);
 float nw=dot(texture(image,uv+pixel*vec2(-1.,1.)).rgb,weights),ne=dot(texture(image,uv+pixel).rgb,weights);
 float sw=dot(texture(image,uv-pixel).rgb,weights),se=dot(texture(image,uv+pixel*vec2(1.,-1.)).rgb,weights),middle=dot(color,weights);
 vec2 direction=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
 float reduction=max((nw+ne+sw+se)*.0078125,.0078125);
 direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+reduction),vec2(-4.),vec2(4.))*pixel;
 vec3 aa=.5*(texture(image,uv-direction/6.).rgb+texture(image,uv+direction/6.).rgb);
 vec3 bb=aa*.5+.25*(texture(image,uv-direction*.5).rgb+texture(image,uv+direction*.5).rgb);
 float brightness=dot(bb,weights);color=brightness<min(middle,min(min(nw,ne),min(sw,se)))||brightness>max(middle,max(max(nw,ne),max(sw,se)))?aa:bb;
 outputColor=vec4(mix(texture(image,uv).rgb,color,smoothstep(0.,.25,mask)),1.);
}`;

function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(error);}return shader;}
function link(gl,source){
 const program=gl.createProgram();let v,f;
 try{v=compile(gl,gl.VERTEX_SHADER,vertex);f=compile(gl,gl.FRAGMENT_SHADER,source);gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));return program;}
 catch(error){gl.deleteProgram(program);throw error;}
 finally{if(v)gl.deleteShader(v);if(f)gl.deleteShader(f);}
}
export function createInkPass(gl){
 const program=link(gl,fragment);let resolveProgram;
 try{resolveProgram=link(gl,resolveFragment);}catch(error){gl.deleteProgram(program);throw error;}
 const resolveImage=gl.getUniformLocation(resolveProgram,'image'),resolvePixel=gl.getUniformLocation(resolveProgram,'pixel'),compositeFramebuffer=gl.createFramebuffer(),compositeTexture=gl.createTexture();
 const framebuffer=gl.createFramebuffer(),textures=Array.from({length:3},()=>gl.createTexture()),locations=new Map();let width=0,height=0,enabled=true;
 for(const [i,texture]of [...textures,compositeTexture].entries()){gl.bindTexture(gl.TEXTURE_2D,texture);for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,i===2?gl.NEAREST:gl.LINEAR);for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);}
 const location=name=>{if(!locations.has(name))locations.set(name,gl.getUniformLocation(program,name));return locations.get(name);};
 return {
  begin(w,h){
   if(!enabled){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return false;}
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
   if(width!==w||height!==h){
    width=w;height=h;
    for(let i=0;i<3;i++){
     gl.bindTexture(gl.TEXTURE_2D,textures[i]);
     gl.texImage2D(gl.TEXTURE_2D,0,i===2?gl.DEPTH_COMPONENT24:gl.RGBA8,w,h,0,i===2?gl.DEPTH_COMPONENT:gl.RGBA,i===2?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,null);
     gl.framebufferTexture2D(gl.FRAMEBUFFER,i===2?gl.DEPTH_ATTACHMENT:gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,textures[i],0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,compositeFramebuffer);gl.bindTexture(gl.TEXTURE_2D,compositeTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,compositeTexture,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    enabled=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    if(!enabled){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return false;}
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
    enabled=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    if(!enabled){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return false;}
   }
   gl.clearBufferfv(gl.COLOR,1,new Float32Array([.5,.5,1,0]));
   return true;
  },
  finish({zoom,aspect,perspective,pixelRatio,strength}){
   if(!enabled)return;
   gl.bindFramebuffer(gl.FRAMEBUFFER,compositeFramebuffer);gl.disable(gl.DEPTH_TEST);gl.useProgram(program);gl.bindVertexArray(null);
   for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE0+3+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.uniform1i(location(['sceneColor','sceneNormal','sceneDepth'][i]),3+i);}
   gl.uniform2f(location('pixel'),1/width,1/height);
   for(const [name,value]of Object.entries({zoom,aspect,perspective,pixelRatio,strength}))gl.uniform1f(location(name),value);
   gl.drawArrays(gl.TRIANGLES,0,3);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(resolveProgram);gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,compositeTexture);
   gl.uniform1i(resolveImage,6);gl.uniform2f(resolvePixel,1/width,1/height);gl.drawArrays(gl.TRIANGLES,0,3);
  },
  diagnostics:()=>({inkEnabled:enabled,gpuInkBytes:width*height*16,inkWidth:width,inkHeight:height}),
  destroy(){gl.deleteTexture(compositeTexture);gl.deleteFramebuffer(compositeFramebuffer);gl.deleteProgram(resolveProgram);textures.forEach(t=>gl.deleteTexture(t));gl.deleteFramebuffer(framebuffer);gl.deleteProgram(program);},
 };
}
