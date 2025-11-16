// EMOTION RECOGNITION TEST - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const emotions=['angry','happiness','sadness','surprise','disgust','fear','contempt','interest','confusion','pride'];
const game={score:0,lives:3,timer:60,interval:null,currentEmotion:'',lastEmotion:'',bestScore:null};
const els={start:$('#emo-start'),imageArea:$('#emo-image-area'),image:$('#emo-image'),optionsArea:$('#emo-options-area'),scoreDisplay:$('#emo-score'),livesDisplay:$('#emo-lives'),bestDisplay:$('#emo-best'),timerDisplay:$('#emo-timer')};
const colors=['#ef4444','#10b981','#3b82f6','#f59e0b','#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#6b7280'];
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestScore=scores['Emotion Recognition'];if(game.bestScore)els.bestDisplay.text(game.bestScore);};
const updateUI=()=>{els.scoreDisplay.text(game.score);els.livesDisplay.text(game.lives);els.timerDisplay.text(game.timer+'s');};
const showRandomEmotion=()=>{let randomEmotion;do{randomEmotion=emotions[Math.floor(Math.random()*emotions.length)];}while(randomEmotion===game.lastEmotion);game.currentEmotion=randomEmotion;game.lastEmotion=randomEmotion;els.image.attr('src',`../img/benchmark/${randomEmotion}.webp`);};
const checkAnswer=(emotion)=>{if(emotion===game.currentEmotion){game.score++;updateUI();HB.playSound('success');if(game.score%5===0)HB.showToast(`${game.score} correct! 🎯`,1500,'success');showRandomEmotion();}else{game.lives--;updateUI();HB.playSound('fail');if(game.lives<=0)gameOver();else{HB.showToast(`Wrong! ${game.lives} lives left`,1500,'error');showRandomEmotion();}}};
const gameOver=()=>{if(game.interval)clearInterval(game.interval);const isNewRecord=saveScore('Emotion Recognition',game.score);if(isNewRecord)game.bestScore=game.score;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You correctly identified <strong>${game.score}</strong> emotions!${game.score>=20?'<br>🏆 Emotion expert!':''}`,score:`${game.score} correct`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'😊'});};
const reset=()=>{game.score=0;game.lives=3;game.timer=60;if(game.interval)clearInterval(game.interval);game.currentEmotion='';game.lastEmotion='';els.start.show();els.imageArea.addClass('hidden');els.optionsArea.addClass('hidden');updateUI();loadBest();};
const start=()=>{els.start.hide();els.imageArea.removeClass('hidden');els.optionsArea.removeClass('hidden');showRandomEmotion();game.interval=setInterval(()=>{game.timer--;updateUI();if(game.timer<=0)gameOver();},1000);};
emotions.forEach((emotion,i)=>{const btn=$(`<button class="btn-game" style="background:${colors[i%colors.length]};min-width:140px;">${emotion}</button>`);btn.on('click',()=>checkAnswer(emotion));els.optionsArea.append(btn);});
loadBest();updateUI();els.start.on('click',start);
});
