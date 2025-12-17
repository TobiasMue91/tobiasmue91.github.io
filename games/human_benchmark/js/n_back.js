// N-BACK TEST - Working Memory
$(function(){
const LETTERS='CDFGHJKLNPQRSTVWXZ';
const TRIALS_PER_LEVEL=10;
const MAX_LIVES=3;
const BASE_DURATION=1500;
const game={level:1,lives:MAX_LIVES,trial:0,sequence:[],current:0,streak:0,maxLevel:1,responded:false,running:false,bestLevel:null,timer:null};
const els={start:$('#start-n-back-test'),gameArea:$('#nb-game-area'),instructions:$('#nb-instructions'),letter:$('#nb-letter'),letterDisplay:$('#nb-letter-display'),matchBtn:$('#nb-match-btn'),feedback:$('#nb-feedback'),levelDisplay:$('#nb-level'),livesDisplay:$('#nb-lives'),bestDisplay:$('#nb-best'),progressBar:$('#nb-progress-bar'),roundDisplay:$('#nb-round'),streakDisplay:$('#nb-streak')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestLevel=scores['N-Back'];if(game.bestLevel)els.bestDisplay.text(game.bestLevel);};
const updateUI=()=>{els.levelDisplay.text(game.level);els.livesDisplay.html('❤️'.repeat(game.lives)+'🖤'.repeat(MAX_LIVES-game.lives));els.roundDisplay.text(game.trial);els.streakDisplay.text(game.streak>2?`🔥${game.streak}`:'');};
const getDuration=()=>Math.max(800,BASE_DURATION-game.level*100);
const generateNext=()=>{const shouldMatch=game.current>=game.level&&Math.random()<0.33;if(shouldMatch){return game.sequence[game.current-game.level];}let letter;do{letter=LETTERS[Math.floor(Math.random()*LETTERS.length)];}while(game.current>=game.level&&letter===game.sequence[game.current-game.level]);return letter;};
const isMatch=()=>game.current>=game.level&&game.sequence[game.current]===game.sequence[game.current-game.level];
const showFeedback=(text,type)=>{els.feedback.text(text).removeClass('text-green-400 text-red-400 text-yellow-400').addClass(type==='success'?'text-green-400':type==='error'?'text-red-400':'text-yellow-400');};
const loseLife=()=>{game.lives--;game.streak=0;updateUI();HB.playSound('fail');if(game.lives<=0){gameOver();}};
const handleResponse=()=>{if(!game.running||game.responded)return;game.responded=true;els.matchBtn.prop('disabled',true);clearTimeout(game.timer);if(isMatch()){game.streak++;showFeedback('✓ Correct!','success');HB.playSound('success');els.letterDisplay.removeClass('border-blue-500').addClass('border-green-500');setTimeout(nextTrial,400);}else{showFeedback('✗ Wrong!','error');els.letterDisplay.removeClass('border-blue-500').addClass('border-red-500');loseLife();if(game.lives>0)setTimeout(nextTrial,600);}};
const handleTimeout=()=>{if(game.responded)return;game.responded=true;els.matchBtn.prop('disabled',true);if(isMatch()){showFeedback('✗ Missed!','error');els.letterDisplay.removeClass('border-blue-500').addClass('border-red-500');loseLife();if(game.lives>0)setTimeout(nextTrial,600);}else{game.streak++;els.letterDisplay.removeClass('border-blue-500').addClass('border-gray-600');setTimeout(nextTrial,250);}};
const nextTrial=()=>{if(game.lives<=0)return;game.trial++;if(game.trial>TRIALS_PER_LEVEL){levelUp();return;}game.current++;const letter=generateNext();game.sequence.push(letter);game.responded=false;els.feedback.text('');els.letter.text(letter);els.letterDisplay.removeClass('border-green-500 border-red-500 border-gray-600').addClass('border-blue-500');els.matchBtn.prop('disabled',game.current<game.level);els.progressBar.css('width',(game.trial/TRIALS_PER_LEVEL*100)+'%');updateUI();game.timer=setTimeout(handleTimeout,getDuration());};
const levelUp=()=>{game.level++;if(game.level>game.maxLevel)game.maxLevel=game.level;game.trial=0;game.current=-1;game.sequence=[];els.progressBar.css('width','0%');updateUI();HB.showToast(`Level Up! ${game.level}-Back 🎉`,1500,'success');setTimeout(nextTrial,1800);};
const gameOver=()=>{game.running=false;clearTimeout(game.timer);els.matchBtn.prop('disabled',true);const finalLevel=game.maxLevel;const isNewRecord=saveScore('N-Back',finalLevel);if(isNewRecord)game.bestLevel=finalLevel;HB.showModal({title:isNewRecord?'🎉 New Record!':'Game Over',message:`You reached <strong>${finalLevel}-Back</strong>!${finalLevel>=3?'<br>Great working memory!':''}`,score:`Level ${finalLevel}`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🧠'});};
const reset=()=>{clearTimeout(game.timer);game.level=1;game.lives=MAX_LIVES;game.trial=0;game.current=-1;game.sequence=[];game.streak=0;game.maxLevel=1;game.running=false;els.start.show();els.gameArea.addClass('hidden');els.instructions.show();els.letter.text('?');els.feedback.text('');els.progressBar.css('width','0%');els.letterDisplay.removeClass('border-blue-500 border-green-500 border-red-500').addClass('border-gray-600');loadBest();updateUI();};
els.matchBtn.on('click',handleResponse);
$(document).on('keydown',function(e){if(e.code==='Space'&&game.running&&!game.responded&&game.current>=game.level){e.preventDefault();handleResponse();}});
els.start.on('click',()=>{els.start.hide();els.instructions.hide();els.gameArea.removeClass('hidden');game.running=true;game.trial=0;game.current=-1;game.sequence=[];updateUI();HB.showToast(`${game.level}-Back: Match = same as previous`,1500,'info');setTimeout(nextTrial,1800);});
loadBest();updateUI();
});
