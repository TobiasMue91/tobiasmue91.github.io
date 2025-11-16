// BLIND TIMER CHALLENGE - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const TARGET=10000;
const game={startTime:null,attempts:0,bestDiff:null};
const els={startBtn:$('#btc-start'),stopBtn:$('#btc-stop'),instruction:$('#btc-instruction'),result:$('#btc-result'),attemptsDisplay:$('#btc-attempts'),bestDisplay:$('#btc-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestDiff=scores['Blind Timer Challenge'];if(game.bestDiff)els.bestDisplay.text(game.bestDiff);};
const updateUI=()=>{els.attemptsDisplay.text(game.attempts);};
const start=()=>{game.startTime=Date.now();els.startBtn.prop('disabled',true).addClass('opacity-50 cursor-not-allowed');els.stopBtn.prop('disabled',false).removeClass('opacity-50 cursor-not-allowed');els.instruction.text('Click STOP when you think 10 seconds have passed!');els.result.text('');HB.playSound('click');};
const stop=()=>{const elapsed=Date.now()-game.startTime;const diff=Math.abs(elapsed-TARGET);game.attempts++;updateUI();els.stopBtn.prop('disabled',true).addClass('opacity-50 cursor-not-allowed');els.startBtn.prop('disabled',false).removeClass('opacity-50 cursor-not-allowed');els.instruction.text('Click START and try again!');els.result.html(`<span class="text-blue-400">${(elapsed/1000).toFixed(3)}s</span><br><span class="text-sm">Off by ${diff}ms</span>`);const isNewRecord=!game.bestDiff||diff<game.bestDiff;if(saveScore('Blind Timer Challenge',diff)&&isNewRecord){game.bestDiff=diff;els.bestDisplay.text(diff);HB.playSound('perfect');}else{HB.playSound(diff<500?'success':'fail');}if(diff<100)HB.showToast('Perfect timing! 🎯',2000,'success');};
els.startBtn.on('click',start);
els.stopBtn.on('click',stop);
loadBest();updateUI();
});
