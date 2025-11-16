// STROOP TEST - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const game={score:0,timer:30,interval:null,bestScore:null};
const colors=['red','green','blue','orange','purple','pink'];
const colorMap={red:'#ef4444',green:'#10b981',blue:'#3b82f6',orange:'#f97316',purple:'#a855f7',pink:'#ec4899'};
const els={start:$('#st-start'),wordArea:$('#st-word-area'),buttonsArea:$('#st-buttons-area'),scoreDisplay:$('#st-score'),timerDisplay:$('#st-timer'),bestDisplay:$('#st-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestScore=scores['Stroop Test'];if(game.bestScore)els.bestDisplay.text(game.bestScore);};
const updateUI=()=>{els.scoreDisplay.text(game.score);els.timerDisplay.text(game.timer+'s');};
const generateStroop=()=>{const colorName=colors[Math.floor(Math.random()*colors.length)];const textColor=colors[Math.floor(Math.random()*colors.length)];els.wordArea.text(colorName.toUpperCase()).css('color',colorMap[textColor]).data('color',textColor);};
const handleClick=function(){const chosen=$(this).data('color');const correct=els.wordArea.data('color');if(chosen===correct){game.score++;updateUI();HB.playSound('success');if(game.score%10===0)HB.showToast(`${game.score} correct! 🎉`,1500,'success');generateStroop();}else{gameOver();}};
const gameOver=()=>{if(game.interval)clearInterval(game.interval);const isNewRecord=saveScore('Stroop Test',game.score);if(isNewRecord)game.bestScore=game.score;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You correctly identified <strong>${game.score}</strong> colors!${game.score>=30?'<br>🏆 Incredible focus!':''}`,score:`${game.score} correct`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🌈'});};
const reset=()=>{game.score=0;game.timer=30;if(game.interval)clearInterval(game.interval);els.start.show();els.wordArea.addClass('hidden');els.buttonsArea.addClass('hidden');updateUI();loadBest();};
const start=()=>{els.start.hide();els.wordArea.removeClass('hidden');els.buttonsArea.removeClass('hidden');generateStroop();game.interval=setInterval(()=>{game.timer--;updateUI();if(game.timer<=0)gameOver();},1000);};
els.buttonsArea.empty();colors.forEach(color=>els.buttonsArea.append(`<button class="btn-game" style="background-color:${colorMap[color]};min-width:120px;" data-color="${color}">${color.toUpperCase()}</button>`));
els.buttonsArea.on('click','button',handleClick);
els.start.on('click',start);
loadBest();updateUI();
});
