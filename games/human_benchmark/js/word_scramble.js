// WORD SCRAMBLE - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const words=['apple','banana','cherry','grape','mango','orange','peach','pear','plum','lemon','melon','berry','fig','kiwi','lime','olive','papaya','guava','coconut','avocado','apricot','nectarine','tangerine','grapefruit','watermelon','strawberry','blueberry','raspberry','blackberry','cranberry','pineapple','pomegranate','persimmon','dragonfruit','passionfruit'];
const game={score:0,timer:60,interval:null,currentWord:'',lastWord:'',bestScore:null};
const els={start:$('#ws-start'),gameArea:$('#ws-game-area'),scrambled:$('#ws-scrambled'),input:$('#ws-input'),scoreDisplay:$('#ws-score'),timerDisplay:$('#ws-timer'),bestDisplay:$('#ws-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestScore=scores['Word Scramble'];if(game.bestScore)els.bestDisplay.text(game.bestScore);};
const updateUI=()=>{els.scoreDisplay.text(game.score);els.timerDisplay.text(game.timer+'s');};
const scramble=(word)=>{let arr=word.split('');for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr.join('');};
const nextWord=()=>{let word;do{word=words[Math.floor(Math.random()*words.length)];}while(word===game.lastWord);game.currentWord=word;game.lastWord=word;els.scrambled.text(scramble(word));els.input.val('').focus();};
const checkAnswer=()=>{const answer=els.input.val().toLowerCase().trim();if(answer===game.currentWord){game.score++;updateUI();HB.playSound('success');if(game.score%5===0)HB.showToast(`${game.score} words! 📚`,1500,'success');nextWord();}};
const gameOver=()=>{if(game.interval)clearInterval(game.interval);const isNewRecord=saveScore('Word Scramble',game.score);if(isNewRecord)game.bestScore=game.score;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Time\'s Up!',message:`You unscrambled <strong>${game.score}</strong> words!${game.score>=15?'<br>🏆 Word wizard!':''}`,score:`${game.score} words`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'📝'});};
const reset=()=>{game.score=0;game.timer=60;if(game.interval)clearInterval(game.interval);els.start.show();els.gameArea.addClass('hidden');updateUI();loadBest();};
const start=()=>{els.start.hide();els.gameArea.removeClass('hidden');nextWord();game.interval=setInterval(()=>{game.timer--;updateUI();if(game.timer<=0)gameOver();},1000);};
els.input.on('input',checkAnswer);
els.start.on('click',start);
loadBest();updateUI();
});
