const byId=id=>document.getElementById(id);
const start=byId('start'),info=byId('status'),hud=byId('hud'),hint=byId('hint');
const image=document.querySelector('.diorama img');
let session;
function program(gl){
 const vs='attribute vec2 p; varying vec2 uv; uniform mat4 proj,view; uniform vec3 center,axisX,axisY; void main(){uv=p;gl_Position=proj*view*vec4(center+axisX*(p.x-.5)+axisY*p.y,1.);}';
 const fs='precision mediump float; varying vec2 uv; uniform sampler2D art; uniform bool ring; void main(){if(ring){float r=length(uv-.5);if(r>.49||r<.38)discard;gl_FragColor=vec4(.22,1.,.82,1.);}else{vec4 c=texture2D(art,vec2(uv.x,1.-uv.y));if(c.a<.05)discard;gl_FragColor=c;}}';
 const id=gl.createProgram();
 for(const [type,src] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
   const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
   if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('Shader');
   gl.attachShader(id,sh);gl.deleteShader(sh);
 }
 gl.linkProgram(id);if(!gl.getProgramParameter(id,gl.LINK_STATUS))throw Error('Program');
 gl.useProgram(id);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
 const p=gl.getAttribLocation(id,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 for(const [key,val] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,val);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 return Object.fromEntries(['proj','view','center','axisX','axisY','ring'].map(n=>[n,gl.getUniformLocation(id,n)]));
}
const scale=(v,n)=>v.map(x=>x*n);
const column=(m,i)=>[m[i],m[i+1],m[i+2]];
async function run(){
 start.disabled=true;
 let s;
 try{
   s=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['anchors','dom-overlay'],domOverlay:{root:hud}});
   session=s;
   let source,anchor,base,place=false,revision=0,ended=false;
   const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,xrCompatible:true});
   s.addEventListener('end',()=>{ended=true;revision++;source?.cancel();anchor?.delete();gl?.getExtension('WEBGL_lose_context')?.loseContext();hud.hidden=true;session=null;start.disabled=false;info.textContent='Đã đóng camera AR.'},{once:true});
   await image.decode();await gl.makeXRCompatible();if(ended)return;
   const layer=new XRWebGLLayer(s,gl);s.updateRenderState({baseLayer:layer});
   const space=await s.requestReferenceSpace('local');
   source=await s.requestHitTestSource({space:await s.requestReferenceSpace('viewer')});
   const uniforms=program(gl);
   hud.hidden=false;info.textContent='Đang quét…';
   s.addEventListener('select',()=>{place=true});
   space.addEventListener('reset',()=>{if(!anchor){base=null;revision++}});
   function quad(pos,x,y,ring){
     gl.uniform3fv(uniforms.center,pos);gl.uniform3fv(uniforms.axisX,x);gl.uniform3fv(uniforms.axisY,y);
     gl.uniform1i(uniforms.ring,ring);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   }
   function frame(_,f){
     if(ended)return;s.requestAnimationFrame(frame);
     const viewer=f.getViewerPose(space);
     gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
     if(!viewer)return;
     const hit=f.getHitTestResults(source)[0],hitMatrix=hit?.getPose(space)?.transform.matrix;
     if(place&&hitMatrix){
       anchor?.delete();anchor=null;base=new Float32Array(hitMatrix);const stamp=++revision;
       if(hit.createAnchor)try{hit.createAnchor().then(a=>{if(ended||stamp!==revision)a.delete();else anchor=a}).catch(()=>{})}catch{}
     }
     place=false;
     const placed=anchor?f.getPose(anchor.anchorSpace,space)?.transform.matrix:base;
     hint.textContent=hitMatrix?(base?'Chạm để đổi vị trí':'Chạm để đặt Miku'):'Di chuyển chậm để tìm bề mặt';
     for(const v of viewer.views){
       const vp=layer.getViewport(v);gl.viewport(vp.x,vp.y,vp.width,vp.height);
       gl.uniformMatrix4fv(uniforms.proj,false,v.projectionMatrix);gl.uniformMatrix4fv(uniforms.view,false,v.transform.inverse.matrix);
       if(hitMatrix){
         const z=scale(column(hitMatrix,8),.085);
         quad(column(hitMatrix,12).map((n,i)=>n-z[i]/2),scale(column(hitMatrix,0),.085),z,true);
       }
       if(placed){
         const pos=column(placed,12),eye=v.transform.position;
         const dx=eye.x-pos[0],dz=eye.z-pos[2],len=Math.hypot(dx,dz);
         let right=len>.03?[dz/len,0,-dx/len]:column(v.transform.matrix,0);
         quad(pos,scale(right,.16*image.naturalWidth/image.naturalHeight),[0,.16,0],false);
       }
     }
   }
   s.requestAnimationFrame(frame);
 }catch(error){
   if(s&&session===s)await s.end().catch(()=>{});
   info.textContent=error.name==='NotAllowedError'?'Hãy cho phép dùng camera và AR rồi thử lại.':'Chưa mở được chế độ dò bề mặt. Hãy mở link trực tiếp bằng Chrome trên điện thoại hỗ trợ ARCore.';
   start.disabled=false;
 }
}
byId('exit').addEventListener('beforexrselect',e=>e.preventDefault());
byId('exit').onclick=()=>session?.end();
start.onclick=run;
async function check(){
 const available=await navigator.xr?.isSessionSupported('immersive-ar').catch(()=>false);
 start.disabled=!available;
 info.textContent=available?'Sẵn sàng dùng camera sau.':'Để dùng camera thường, chọn “Đặt Miku bằng webcam laptop/PC” ở trên.';
}
check();
