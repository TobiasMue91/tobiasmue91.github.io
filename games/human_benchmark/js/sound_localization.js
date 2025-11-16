// SOUND LOCALIZATION TEST - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
let audioCtx,buffer;
try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();fetch('audio/ping.mp3').then(r=>r.arrayBuffer()).then(ab=>audioCtx.decodeAudioData(ab)).then(db=>{buffer=db;}).catch(e=>console.error('Audio load failed:',e));}catch(e){console.error('AudioContext creation failed:',e);}
const TOTAL=5;
const game={round:0,currentPos:0,errors:[],bestScore:null};
const els={start:$('#sl-start'),testArea:$('#sl-test-area'),slider:$('#sl-slider'),position:$('#sl-position'),confirm:$('#sl-confirm'),feedback:$('#sl-feedback'),roundDisplay:$('#sl-round'),bestDisplay:$('#sl-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};const best=scores['Sound Localization'];if(best){game.bestScore=parseFloat(best);els.bestDisplay.text(best.toFixed(2));}};
const updateUI=()=>{els.roundDisplay.text(game.round);};
const playSound=(pos)=>{if(!buffer||!audioCtx)return;try{const src=audioCtx.createBufferSource();src.buffer=buffer;const panner=audioCtx.createStereoPanner();panner.pan.value=pos;src.connect(panner);panner.connect(audioCtx.destination);src.start();src.stop(audioCtx.currentTime+1);}catch(e){console.error('Sound playback failed:',e);}};
const posToStr=(pos)=>{const pct=Math.abs(pos*100).toFixed(1);const dir=pos<0?'left':pos>0?'right':'center';return pct==='0.0'?'CENTER':`${pct}% ${dir}`;};
const updateSlider=()=>{const val=els.slider.val();const pos=(val/1000)*2-1;els.position.text(posToStr(pos));};
const nextTest=()=>{game.currentPos=Math.round((Math.random()*2-1)*1000)/1000;playSound(game.currentPos);els.slider.val(500);updateSlider();els.feedback.text('');};
const confirm=()=>{const userPos=(els.slider.val()/1000)*2-1;const error=Math.abs(game.currentPos-userPos);game.errors.push(error);game.round++;updateUI();const errorPct=(error*100).toFixed(2);const color=error<=0.1?'#10b981':error<=0.2?'#84cc16':error<=0.3?'#fbbf24':error<=0.4?'#fb923c':'#ef4444';els.feedback.html(`<div><span style="color:${color};">Error: ${errorPct}%</span><br>Actual: ${posToStr(game.currentPos)} | Your guess: ${posToStr(userPos)}</div>`);if(error<=0.1)HB.playSound('perfect');else if(error<=0.3)HB.playSound('success');else HB.playSound('fail');if(game.round<TOTAL){setTimeout(nextTest,2000);}else{const avg=game.errors.reduce((a,b)=>a+b,0)/game.errors.length;const avgPct=(avg*100).toFixed(2);const isNewRecord=!game.bestScore||parseFloat(avgPct)<game.bestScore;if(saveScore('Sound Localization',avgPct)&&isNewRecord){game.bestScore=parseFloat(avgPct);els.bestDisplay.text(avgPct);}HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Test Complete',message:`Average error: <strong>${avgPct}%</strong>${parseFloat(avgPct)<=10?'<br>🏆 Perfect pitch!':''}`,score:`${avgPct}% error`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🔊'});}};
const reset=()=>{game.round=0;game.currentPos=0;game.errors=[];els.start.show();els.testArea.addClass('hidden');updateUI();loadBest();};
const start=()=>{els.start.hide();els.testArea.removeClass('hidden');nextTest();};
els.slider.on('input',updateSlider);
els.slider.on('mouseup touchend',()=>playSound((els.slider.val()/1000)*2-1));
els.confirm.on('click',confirm);
els.start.on('click',start);
loadBest();updateUI();
});
