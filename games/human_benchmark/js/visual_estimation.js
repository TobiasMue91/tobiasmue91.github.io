// VISUAL ESTIMATION - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const allEmojis=['😀','😎','🚀','🌈','🍕','🎸','🌺','🦄','🍔','🎈','🐶','🐱','🐼','🦁','🐘','🦋','🌻','🍎','🍌','🍊','🍓','🥑','🍉','🍇','🥕','🏀','⚽️','🎾','🏈','🎃','🌙','⭐️','🌞'];
const game={score:0,timer:60,interval:null,targetEmoji:'',currentCount:0,bestScore:null};
const els={start:$('#ve-start'),display:$('#ve-emoji-display'),guessArea:$('#ve-guess-area'),guess:$('#ve-guess'),submit:$('#ve-submit'),targetEmoji:$('#ve-target-emoji'),scoreDisplay:$('#ve-score'),timerDisplay:$('#ve-timer'),bestDisplay:$('#ve-best'),instructionArea:$('#ve-instruction-area')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestScore=scores['Visual Estimation'];if(game.bestScore)els.bestDisplay.text(game.bestScore);};
const updateUI=()=>{els.scoreDisplay.text(game.score);els.timerDisplay.text(game.timer+'s');};
const showEmojis=()=>{els.display.empty().show();const w=els.display.width(),h=els.display.height();const emojis=allEmojis.sort(()=>.5-Math.random()).slice(0,3);game.targetEmoji=emojis[Math.floor(Math.random()*3)];els.targetEmoji.text(game.targetEmoji);game.currentCount=Math.floor(Math.random()*16)+5;let placed=0,attempts=0;while(placed<game.currentCount&&attempts<100){const size=Math.random()*20+20,left=Math.random()*(w-size),top=Math.random()*(h-size);let overlap=false;els.display.find('span').each(function(){const $e=$(this),eL=parseFloat($e.css('left')),eT=parseFloat($e.css('top')),eS=parseFloat($e.css('font-size'));if(left<eL+eS&&left+size>eL&&top<eT+eS&&top+size>eT){overlap=true;return false;}});if(!overlap){$('<span>').text(game.targetEmoji).css({position:'absolute',fontSize:`${size}px`,left:`${left}px`,top:`${top}px`}).appendTo(els.display);placed++;}attempts++;}
while(attempts<150){const emoji=emojis.find(e=>e!==game.targetEmoji),size=Math.random()*20+20,left=Math.random()*(w-size),top=Math.random()*(h-size);let overlap=false;els.display.find('span').each(function(){const $e=$(this),eL=parseFloat($e.css('left')),eT=parseFloat($e.css('top')),eS=parseFloat($e.css('font-size'));if(left<eL+eS&&left+size>eL&&top<eT+eS&&top+size>eT){overlap=true;return false;}});if(!overlap){$('<span>').text(emoji).css({position:'absolute',fontSize:`${size}px`,left:`${left}px`,top:`${top}px`}).appendTo(els.display);}attempts++;}
els.guessArea.show();els.guess.val('').focus();};
const submitGuess=()=>{const userGuess=parseInt(els.guess.val());if(isNaN(userGuess))return;if(userGuess===game.currentCount){game.score++;updateUI();HB.playSound('success');HB.showToast('Correct! ✅',1000,'success');}else{HB.playSound('fail');HB.showToast(`Wrong! It was ${game.currentCount}`,1500,'error');}if(game.timer>0)showEmojis();};
const gameOver=()=>{if(game.interval)clearInterval(game.interval);const isNewRecord=saveScore('Visual Estimation',game.score);if(isNewRecord)game.bestScore=game.score;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Time\'s Up!',message:`You correctly counted <strong>${game.score}</strong> times!${game.score>=10?'<br>🏆 Estimation expert!':''}`,score:`${game.score} correct`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'👁️'});};
const reset=()=>{game.score=0;game.timer=60;if(game.interval)clearInterval(game.interval);els.start.show();els.display.addClass('hidden');els.guessArea.addClass('hidden');els.instructionArea.hide();updateUI();loadBest();};
const start=()=>{els.start.hide();els.instructionArea.show();showEmojis();game.interval=setInterval(()=>{game.timer--;updateUI();if(game.timer<=0)gameOver();},1000);};
els.submit.on('click',submitGuess);
els.guess.on('keypress',e=>{if(e.key==='Enter'){e.preventDefault();submitGuess();}});
els.start.on('click',start);
els.instructionArea.hide();
loadBest();updateUI();
});
