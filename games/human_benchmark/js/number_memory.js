// NUMBER MEMORY - ENHANCED
$(function(){
const game={level:1,answer:'',timer:null,bestLevel:null};
const els={start:$('#nm-start'),area:$('#nm-number-area'),input:$('#nm-input'),submit:$('#nm-submit'),levelDisplay:$('#nm-level'),bestDisplay:$('#nm-best'),progressContainer:$('#nm-progress-container'),progress:$('#nm-progress')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestLevel=scores['Number Memory'];if(game.bestLevel)els.bestDisplay.text(game.bestLevel);};
const updateUI=()=>{els.levelDisplay.text(game.level);};
const generateNumber=()=>{els.input.hide().val('');els.submit.hide();els.progressContainer.addClass('hidden');els.area.text('Get Ready...').removeClass('text-blue-400').addClass('text-gray-400');setTimeout(()=>{const numbers=Array(game.level).fill().map(()=>Math.floor(Math.random()*10));game.answer=numbers.join('');els.area.html(numbers.map(n=>`<span class="inline-block mx-1 animate-pulse">${n}</span>`).join('')).removeClass('text-gray-400').addClass('text-blue-400');HB.playSound('click');const duration=Math.min(3000+(game.level*400),8000);els.progressContainer.removeClass('hidden');els.progress.css({'transition':'none','width':'100%'});setTimeout(()=>els.progress.css({'transition':`width ${duration}ms linear`,'width':'0%'}),50);game.timer=setTimeout(()=>{els.area.text('Enter the number').removeClass('text-blue-400').addClass('text-gray-400');els.input.show().focus();els.submit.show();els.progressContainer.addClass('hidden');HB.playSound('success');},duration);},1000);};
const checkAnswer=()=>{if(game.timer)clearTimeout(game.timer);const userAnswer=els.input.val().trim();if(userAnswer===game.answer){HB.playSound('success');game.level++;updateUI();if(game.level%3===0)HB.showToast(`Level ${game.level}! 🎉`,1500,'success');els.area.text('✓ Correct!').removeClass('text-gray-400').addClass('text-green-400');setTimeout(generateNumber,1000);}else{gameOver();}};
const gameOver=()=>{const finalLevel=game.level-1;const isNewRecord=saveScore('Number Memory',finalLevel);if(isNewRecord)game.bestLevel=finalLevel;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You remembered numbers up to <strong>level ${finalLevel}</strong>!${finalLevel>=10?'<br>🏆 Exceptional memory!':''}`,score:`Level ${finalLevel}`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🔢'});};
const reset=()=>{game.level=1;game.answer='';if(game.timer)clearTimeout(game.timer);els.area.text('');els.input.hide().val('');els.submit.hide();els.start.show();els.progressContainer.addClass('hidden');updateUI();loadBest();};
els.start.on('click',()=>{els.start.hide();generateNumber();});
els.submit.on('click',checkAnswer);
els.input.on('keypress',e=>{if(e.key==='Enter'){e.preventDefault();els.submit.click();}});
loadBest();updateUI();
});
