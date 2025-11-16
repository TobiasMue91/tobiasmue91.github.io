// TYPING SPEED TEST - ENHANCED
$(function(){
const game={text:'',index:0,correct:0,incorrect:0,wordCount:0,charCount:0,startTime:null,timerId:null,bestWPM:null};
const els={textEl:$('#text'),timerEl:$('#timer'),statsEl:$('#stats'),wpmDisplay:$('#wpm-display'),accDisplay:$('#acc-display'),restartBtn:$('#restart-button')};
const words="tell many say point run should can line world now program make nation while stand there hand feel under must work go show general new great small large long short big little best better high low far near hard easy fast slow happy calm friendly brave awake healthy good right true smart clean full free safe able above after air all along also always another answer any ask away back before begin below between book both boy came change children city close come country day did".split(' ');
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestWPM=scores['Typing Speed Test'];};
const updateText=()=>{game.text=Array.from({length:12},()=>words.sort(()=>.5-Math.random()).slice(0,15).join(' ')).join(' ~');els.textEl.html(game.text.split('').map((char,i)=>`<span class="letter" data-index="${i}">${char===' '?'&nbsp;':char}</span>`).join('').replace(/<span class="letter" data-index="\d+">~<\/span>/g,'<br>'));updateCursor();};
const updateCursor=()=>{$('.letter.cursor').removeClass('cursor');$(`.letter[data-index="${game.index}"]`).addClass('cursor');};
const getWPM=()=>game.startTime?(game.wordCount/((Date.now()-game.startTime)/1000)*60)|0:0;
const getAccuracy=()=>game.correct+game.incorrect>0?((game.correct/(game.correct+game.incorrect)*100)|0):100;
const updateLiveStats=()=>{els.wpmDisplay.text(getWPM());els.accDisplay.text(getAccuracy()+'%');};
const resetGame=()=>{game.index=0;game.correct=0;game.incorrect=0;game.wordCount=0;game.charCount=0;game.startTime=null;if(game.timerId)clearInterval(game.timerId);game.timerId=null;els.timerEl.text('30s');els.statsEl.text('');els.wpmDisplay.text('0');els.accDisplay.text('100%');els.restartBtn.addClass('hidden');updateText();els.textEl[0].scrollTop=0;};
const finishTest=()=>{clearInterval(game.timerId);els.timerEl.text('0s');const wpm=getWPM();const acc=getAccuracy();const isNewRecord=saveScore('Typing Speed Test',wpm);if(isNewRecord){game.bestWPM=wpm;HB.playSound('perfect');}
HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Test Complete',message:`<strong>${wpm} WPM</strong><br>Accuracy: ${acc}%<br>Characters: ${game.charCount} (${game.correct} correct, ${game.incorrect} errors)`,score:`${wpm} WPM`,isNewRecord,onRetry:resetGame,onHome:HB.goHome,icon:'⌨️'});els.restartBtn.removeClass('hidden');};
const handleKeyDown=(e)=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(!game.startTime){game.startTime=Date.now();game.timerId=setInterval(()=>{const timeLeft=30-((Date.now()-game.startTime)/1000|0);els.timerEl.text(timeLeft+'s');updateLiveStats();if(timeLeft<=0)finishTest();},100);}
const allChars=$('.letter');const currentChar=allChars.eq(game.index).text();if(e.key==='Backspace'){e.preventDefault();if(game.index>0){game.index--;const lastChar=allChars.eq(game.index);if(lastChar.hasClass('correct'))game.correct--;if(lastChar.hasClass('incorrect'))game.incorrect--;lastChar.removeClass('correct incorrect');if(currentChar===' ')game.wordCount--;updateCursor();}return;}
if(e.key.length>1)return;e.preventDefault();const typed=e.key.toLowerCase();if(!currentChar||game.index>=allChars.length)return;const isCorrect=typed===currentChar;allChars.eq(game.index).addClass(isCorrect?'correct':'incorrect');if(isCorrect){game.correct++;HB.playSound('click');}else{game.incorrect++;HB.playSound('fail');}
if(currentChar===' '){game.wordCount++;if(game.wordCount%15===0)els.textEl[0].scrollTop=game.wordCount/15*25;}else{game.charCount++;}
game.index++;updateCursor();updateLiveStats();};
$(document).on('keydown',handleKeyDown);
els.restartBtn.on('click',resetGame);
loadBest();resetGame();
});
