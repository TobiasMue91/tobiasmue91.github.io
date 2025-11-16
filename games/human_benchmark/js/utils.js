// SHARED UTILITIES FOR HUMAN BENCHMARK GAMES
const HB = {
showModal(config) {
try{
const {title='Game Over',message='',score=null,isNewRecord=false,onRetry=null,onHome=null,showRetry=true,showHome=true,showClose=true,customButtons=[],icon=null,className=''}=config;
const existingModal=document.querySelector('.hb-modal-overlay');
if(existingModal)existingModal.remove();
const iconHtml=icon?`<div class="text-6xl mb-4">${icon}</div>`:'';
const scoreHtml=score!==null?`<div class="mt-4 mb-6"><div class="text-5xl font-bold text-blue-400 mb-2">${score}</div>${isNewRecord?'<div class="text-sm font-semibold text-yellow-400 animate-pulse">🎉 New Personal Best! 🎉</div>':''}</div>`:'';
const buttonsHtml=`<div class="flex gap-3 justify-center flex-wrap">${showRetry&&onRetry?`<button class="hb-modal-btn hb-btn-primary" data-action="retry">Try Again</button>`:''}${showHome&&onHome?`<button class="hb-modal-btn hb-btn-secondary" data-action="home">Home</button>`:''}${showClose?`<button class="hb-modal-btn hb-btn-ghost" data-action="close">Close</button>`:''}${customButtons.map((btn,i)=>`<button class="hb-modal-btn ${btn.className||'hb-btn-secondary'}" data-action="custom-${i}">${btn.text}</button>`).join('')}</div>`;
const overlay=document.createElement('div');
overlay.className='hb-modal-overlay';
overlay.innerHTML=`<div class="hb-modal ${className}"><div class="hb-modal-content">${iconHtml}<h2 class="text-3xl font-bold mb-3">${title}</h2>${message?`<p class="text-gray-300 mb-4">${message}</p>`:''}${scoreHtml}${buttonsHtml}</div></div>`;
document.body.appendChild(overlay);
setTimeout(()=>overlay.classList.add('active'),10);
if(isNewRecord){this.confetti();}
overlay.querySelectorAll('.hb-modal-btn').forEach((btn,i)=>{btn.addEventListener('click',()=>{const action=btn.dataset.action;if(action==='retry'&&onRetry)onRetry();else if(action==='home'&&onHome)onHome();else if(action.startsWith('custom-')){const idx=parseInt(action.split('-')[1]);if(customButtons[idx]&&customButtons[idx].onClick)customButtons[idx].onClick();}
this.closeModal(overlay);});});
overlay.addEventListener('click',e=>{if(e.target===overlay&&showClose)this.closeModal(overlay);});
return overlay;
}catch(e){console.error('Modal error:',e);alert(config.title+'\n'+config.message+'\nScore: '+config.score);}
},
closeModal(modalOrNull=null){
const modal=modalOrNull||document.querySelector('.hb-modal-overlay');
if(!modal)return;
modal.classList.remove('active');
setTimeout(()=>modal.remove(),300);
},
confetti(){
try{
const colors=['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffa500','#ff69b4'];
const particleCount=50;
for(let i=0;i<particleCount;i++){
const particle=document.createElement('div');
particle.className='confetti-particle';
particle.style.left=Math.random()*100+'%';
particle.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
particle.style.animationDelay=Math.random()*0.5+'s';
particle.style.animationDuration=(Math.random()*2+2)+'s';
document.body.appendChild(particle);
setTimeout(()=>particle.remove(),4000);
}
}catch(e){console.warn('Confetti failed:',e);}
},
showToast(message,duration=2000,type='info'){
const toast=document.createElement('div');
toast.className=`hb-toast hb-toast-${type}`;
toast.textContent=message;
document.body.appendChild(toast);
setTimeout(()=>toast.classList.add('active'),10);
setTimeout(()=>{
toast.classList.remove('active');
setTimeout(()=>toast.remove(),300);
},duration);
},
shuffleArray(array){
const arr=[...array];
for(let i=arr.length-1;i>0;i--){
const j=Math.floor(Math.random()*(i+1));
[arr[i],arr[j]]=[arr[j],arr[i]];
}
return arr;
},
formatTime(ms){
if(ms<1000)return `${ms}ms`;
const seconds=(ms/1000).toFixed(2);
return `${seconds}s`;
},
formatNumber(num){
return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
},
playSound(type='click'){
try{
const sounds={click:440,success:523.25,fail:329.63,perfect:659.25};
if(!this.soundEnabled)return;
if(!window.AudioContext&&!window.webkitAudioContext)return;
const audioContext=new(window.AudioContext||window.webkitAudioContext)();
const oscillator=audioContext.createOscillator();
const gainNode=audioContext.createGain();
oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);
oscillator.frequency.value=sounds[type]||440;
oscillator.type='sine';
gainNode.gain.setValueAtTime(0.1,audioContext.currentTime);
gainNode.gain.exponentialRampToValueAtTime(0.01,audioContext.currentTime+0.1);
oscillator.start(audioContext.currentTime);
oscillator.stop(audioContext.currentTime+0.1);
}catch(e){console.warn('Sound playback failed:',e);}
},
soundEnabled:localStorage.getItem('hb_sound_enabled')!=='false',
toggleSound(){
this.soundEnabled=!this.soundEnabled;
localStorage.setItem('hb_sound_enabled',this.soundEnabled);
return this.soundEnabled;
},
animateValue(element,start,end,duration=1000){
const range=end-start;
const increment=range/(duration/16);
let current=start;
const timer=setInterval(()=>{
current+=increment;
if((increment>0&&current>=end)||(increment<0&&current<=end)){
current=end;
clearInterval(timer);
}
if(element)element.textContent=Math.round(current);
},16);
},
createProgressBar(duration,onComplete){
const bar=document.createElement('div');
bar.className='hb-progress-bar';
bar.innerHTML='<div class="hb-progress-fill"></div>';
const fill=bar.querySelector('.hb-progress-fill');
fill.style.transition=`width ${duration}ms linear`;
setTimeout(()=>fill.style.width='0%',10);
setTimeout(()=>{if(onComplete)onComplete();},duration);
return bar;
},
debounce(func,wait){
let timeout;
return function executedFunction(...args){
const later=()=>{clearTimeout(timeout);func(...args);};
clearTimeout(timeout);
timeout=setTimeout(later,wait);
};
},
isMobile(){
return window.matchMedia('(max-width: 768px)').matches;
},
goHome(){
$('#landing-tab').removeClass('hidden');
$('#game-container').addClass('hidden');
window.location.hash='';
}
};
window.HB=HB;
