// MATH TEST - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const game={score:0,timer:60,interval:null,correctAnswer:0,bestScore:null};
const els={start:$('#mt-start'),questionArea:$('#mt-question-area'),answerArea:$('#mt-answer-area'),input:$('#mt-input'),submit:$('#mt-submit'),scoreDisplay:$('#mt-score'),timerDisplay:$('#mt-timer'),bestDisplay:$('#mt-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestScore=scores['Math Test'];if(game.bestScore)els.bestDisplay.text(game.bestScore);};
const updateUI=()=>{els.scoreDisplay.text(game.score);els.timerDisplay.text(game.timer+'s');};
const generateQuestion=()=>{const ops=['+','-','*'];const op=ops[Math.floor(Math.random()*ops.length)];let num1,num2;if(op==='*'){num1=Math.floor(Math.random()*12)+1;num2=Math.floor(Math.random()*12)+1;}else{num1=Math.floor(Math.random()*50)+1;num2=Math.floor(Math.random()*50)+1;}
game.correctAnswer=eval(`${num1}${op}${num2}`);els.questionArea.text(`${num1} ${op} ${num2}`);};
const checkAnswer=()=>{const userAnswer=parseInt(els.input.val());if(userAnswer===game.correctAnswer){game.score++;updateUI();HB.playSound('success');if(game.score%5===0)HB.showToast(`${game.score} correct! 🎉`,1500,'success');els.input.val('');generateQuestion();}else{HB.playSound('fail');els.input.val('').focus();}};
const gameOver=()=>{if(game.interval)clearInterval(game.interval);const isNewRecord=saveScore('Math Test',game.score);if(isNewRecord)game.bestScore=game.score;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Time\'s Up!',message:`You solved <strong>${game.score}</strong> problems!${game.score>=30?'<br>🏆 Math wizard!':''}`,score:`${game.score} correct`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'➕'});};
const reset=()=>{game.score=0;game.timer=60;if(game.interval)clearInterval(game.interval);els.start.show();els.questionArea.addClass('hidden');els.answerArea.addClass('hidden');updateUI();loadBest();};
const start=()=>{els.start.hide();els.questionArea.removeClass('hidden');els.answerArea.removeClass('hidden');generateQuestion();els.input.focus();game.interval=setInterval(()=>{game.timer--;updateUI();if(game.timer<=0)gameOver();},1000);};
els.submit.on('click',checkAnswer);
els.input.on('keypress',e=>{if(e.key==='Enter'){e.preventDefault();checkAnswer();}});
els.start.on('click',start);
loadBest();updateUI();
});
