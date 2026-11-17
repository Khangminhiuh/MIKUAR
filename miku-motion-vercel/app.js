const element=id=>document.getElementById(id);
const video=document.querySelector('video'), canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
const version='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304';
const base='https://storage.googleapis.com/mediapipe-models/';
let models,stream,session=0,active=false,frame,lastTime=-1,lastDetect=0,handTracks=[];
function status(message){element('status').textContent=message}
async function load(){
 const {FilesetResolver,FaceLandmarker,HandLandmarker}=await import(version+'/vision_bundle.mjs');
 const files=await FilesetResolver.forVisionTasks(version+'/wasm');
 const options=(path,settings)=>({...settings,baseOptions:{modelAssetPath:base+path},runningMode:'VIDEO'});
 const face=await FaceLandmarker.createFromOptions(files,options('face_landmarker/face_landmarker/float16/1/face_landmarker.task',{numFaces:2}));
 try{return {face,hand:await HandLandmarker.createFromOptions(files,options('hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',{numHands:2,minHandDetectionConfidence:0.45,minHandPresenceConfidence:0.45}))}}
 catch(error){face.close();throw error}
}
function stop(message){
 active=false;session++;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;
 handTracks=[];element('counts').textContent='';lastTime=-1;ctx.clearRect(0,0,canvas.width,canvas.height);element('idle').hidden=false;element('toggle').textContent='Bật camera';status(message);
}
// Hair paths use face-width units, with the origin halfway between the ears.
const ponytail=new Path2D('M .43 -.48 C .49 -.84 .81 -.79 .92 -.44 C 1.05 -.05 .78 .61 .85 .96 Q .91 1.2 1.02 1.23 Q .72 1.23 .67 .94 Q .64 1.15 .73 1.29 C .39 1.1 .53 .49 .61 .08 Q .72 -.43 .43 -.48 Z');
const tailShine=new Path2D('M .61 -.62 Q .95 -.65 .79 .04 Q .64 .64 .71 .88 Q .67 .45 .84 -.16 Q .88 -.47 .61 -.62 Z');
const fringe=new Path2D('M -.54 .03 C -.64 -.48 -.46 -.8 -.08 -.82 C .32 -.9 .6 -.62 .55 -.22 L .5 .10 Q .38 -.1 .34 -.38 Q .3 -.23 .20 -.16 L .21 -.35 Q .13 -.19 -.04 -.11 Q .02 -.26 -.01 -.37 Q -.11 -.25 -.26 -.18 L -.23 -.34 Q -.40 -.23 -.48 .13 Z');
function drawHair(){
 const shade=ctx.createLinearGradient(-.65,-.75,.64,.72);
 shade.addColorStop(0,'#98fff1');shade.addColorStop(.37,'#31d2ce');shade.addColorStop(.78,'#128c99');shade.addColorStop(1,'#075c77');
 ctx.lineWidth=.018;ctx.strokeStyle='#146575';ctx.lineJoin='round';
 for(const side of [-1,1]){
  ctx.save();ctx.scale(side,1);ctx.fillStyle=shade;ctx.fill(ponytail);ctx.stroke(ponytail);
  ctx.fillStyle='#a0fff0';ctx.fill(tailShine);
  ctx.translate(.48,-.53);ctx.rotate(-.28);ctx.fillStyle='#293042';ctx.fillRect(-.056,-.11,.112,.22);
  ctx.fillStyle='#ff71a5';ctx.fillRect(-.043,-.095,.024,.19);ctx.restore();
 }
 ctx.fillStyle=shade;ctx.fill(fringe);ctx.stroke(fringe);
}
function faceEffects(points,w,h,hair,phones){
 const left=points[234],right=points[454],dx=(right.x-left.x)*w,dy=(right.y-left.y)*h;
 const size=Math.hypot(dx,dy);if(size<1)return;
 ctx.save();ctx.translate((left.x+right.x)*w/2,(left.y+right.y)*h/2);ctx.rotate(Math.atan2(dy,dx));ctx.scale(size,size);
 if(hair)drawHair();
 if(!phones){ctx.restore();return}
 ctx.lineWidth=.048;ctx.strokeStyle='#79ffe9';ctx.beginPath();ctx.ellipse(0,-.04,.52,.63,0,Math.PI,2*Math.PI);ctx.stroke();
 for(const side of [-1,1]){ctx.fillStyle='#14323e';ctx.fillRect(side*.53-.08,-.16,.16,.36);ctx.fillStyle='#ff75ae';ctx.fillRect(side*.53-.052,-.12,.104,.07);ctx.fillStyle='#5df4df';ctx.fillRect(side*.53-.052,0,.104,.135)}
 ctx.restore();
}
const tips=[4,8,12,16,20];
const colors=['#ffd575','#ff96c0','#79ffde','#92bcff','#e9a5ff'];
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0))}
function extended(points,tip){
 const thumb=tip===4;
 const base=points[tip-3], joint=points[tip-2], end=points[tip];
 const bend=distance(base,end)/(distance(base,joint)+distance(joint,end)||1);
 if(thumb){
   const palmWidth=distance(points[5],points[17]);
   return bend>0.87 && distance(end,points[17])>palmWidth*1.12 &&
     distance(end,points[5])>0.44*palmWidth;
 }
 return bend>0.87 && distance(points[0],end)>distance(points[0],joint)*1.08;
}
function drawHands(result,w,h,now){
 const previous=handTracks.slice();
 handTracks=[];
 let total=0;
 for(const [index,points] of result.landmarks.entries()){
   const wrist=points[0],side=result.handedness?.[index]?.[0]?.categoryName;
   let nearest=-1,best=0.25;
   previous.forEach((track,i)=>{
     const cost=Math.hypot(wrist.x-track.wrist.x,wrist.y-track.wrist.y)+(side&&track.side&&side!==track.side?0.12:0);
     if(cost<best && now-track.time<300){best=cost;nearest=i}
   });
   const trails=nearest<0?tips.map(()=>[]):previous.splice(nearest,1)[0].trails;
   handTracks.push({wrist,side,time:now,trails});
   const geometry=result.worldLandmarks?.[index]||points.map(p=>({x:p.x*w,y:p.y*h,z:p.z*w}));
   ctx.save();ctx.lineCap='round';
   tips.forEach((tip,f)=>{
     if(!extended(geometry,tip)){trails[f]=[];return}
     total++;
     const x=points[tip].x*w,y=points[tip].y*h;
     const path=trails[f]=trails[f].filter(p=>now-p.time<400);
     path.push({x,y,time:now});
     ctx.strokeStyle=ctx.fillStyle=colors[f];ctx.lineWidth=Math.max(2,w*.005);
     ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
     ctx.beginPath();ctx.arc(x,y,Math.max(3,w*.009),0,Math.PI*2);ctx.fill();
   });
   ctx.restore();
 }
 return total;
}
function draw(now){
 if(!active)return;
 try{
 if(video.readyState>=2 && video.currentTime!==lastTime && now-lastDetect>=50){
 lastDetect=now;lastTime=video.currentTime;const w=video.videoWidth,h=video.videoHeight;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 ctx.clearRect(0,0,w,h);
 const hair=element('hair').checked,phones=element('face').checked;
 if(hair||phones){
   for(const face of models.face.detectForVideo(video,now).faceLandmarks) faceEffects(face,w,h,hair,phones);
 }
 if(element('hand').checked){
   const result=models.hand.detectForVideo(video,now);
   const raised=drawHands(result,w,h,now);
   element('counts').textContent=result.landmarks.length+' bàn tay · '+raised+' ngón đang giơ';
 }else{handTracks=[];element('counts').textContent=''}

 }
 frame=requestAnimationFrame(draw);
 }catch{stop('Hiệu ứng bị gián đoạn. Bấm Bật camera để thử lại.')}
}
element('toggle').onclick=async()=>{
 if(active){stop('Camera đã tắt.');return}
 const ticket=++session;active=true;element('toggle').textContent='Tắt camera';status('Đang mở camera…');
 try{
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Mở trang bằng Chrome hoặc Safari qua HTTPS để dùng camera.');
 const input=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
 if(ticket!==session){input.getTracks().forEach(t=>t.stop());return}
 stream=input;video.srcObject=input;await video.play();if(ticket!==session)return;element('idle').hidden=true;
 status('Đang tải bộ nhận diện tay và khuôn mặt…');
 models??=load();let loaded;try{loaded=await models}catch(error){models=null;throw error}
 if(ticket!==session)return;models=loaded;status('Camera đang bật. Đưa mặt và bàn tay vào khung hình.');frame=requestAnimationFrame(draw);
 }catch(error){if(ticket===session)stop(error.name==='NotAllowedError'?'Hãy cấp quyền camera cho trang rồi thử lại.':error.name==='NotFoundError'?'Thiết bị chưa có camera khả dụng.':error.message?.includes('HTTPS')?error.message:'Chưa mở được camera hoặc tải bộ nhận diện. Kiểm tra kết nối rồi thử lại.')}
};
window.addEventListener('pagehide',()=>stop('Camera đã tắt.'));
