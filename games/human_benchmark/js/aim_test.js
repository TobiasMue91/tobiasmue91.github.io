// AIM TEST - ENHANCED
$(function(){
const game={startTime:0,hitTimes:[],targetCount:0,bestTime:null};
const els={start:$('#start-aim-test'),area:$('#aim-area'),target:$('#target'),remaining:$('#aim-remaining'),best:$('#aim-best'),result:$('#aim-result'),avgTime:$('#average-time')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestTime=scores['Aim'];if(game.bestTime)els.best.text(game.bestTime);};
const updateUI=()=>{els.remaining.text(30-game.targetCount);};
const showNextTarget=()=>{const maxW=els.area.width()-80;const maxH=els.area.height()-80;const x=Math.random()*maxW;const y=Math.random()*maxH;const size=Math.max(40,80-game.targetCount*1.5);els.target.css({top:`${y}px`,left:`${x}px`,width:`${size}px`,height:`${size}px`}).show();game.startTime=Date.now();HB.playSound('click');};
const handleHit=()=>{const hitTime=Date.now()-game.startTime;game.hitTimes.push(hitTime);game.targetCount++;updateUI();HB.playSound('success');if(game.targetCount<30){showNextTarget();}else{finishGame();}};
const finishGame=()=>{els.target.hide();els.area.addClass('hidden');els.start.show();els.remaining.text('30');const totalTime=game.hitTimes.reduce((a,b)=>a+b,0);const avgTime=totalTime/game.hitTimes.length;const best=Math.min(...game.hitTimes);const worst=Math.max(...game.hitTimes);const avgStr=`${avgTime.toFixed(0)}ms`;const isNewRecord=saveScore('Aim',avgStr,true);if(isNewRecord)game.bestTime=avgStr;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Test Complete',message:`Average Time: <strong>${avgStr}</strong><br>Best: ${best}ms | Worst: ${worst}ms`,score:avgStr,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🎯'});};
const reset=()=>{game.targetCount=0;game.hitTimes=[];updateUI();loadBest();};
const start=()=>{els.start.hide();els.area.removeClass('hidden');game.targetCount=0;game.hitTimes=[];updateUI();showNextTarget();};
els.start.on('click',start);
els.target.on('click',handleHit);
loadBest();updateUI();
});
