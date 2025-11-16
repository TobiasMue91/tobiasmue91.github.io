// VERBAL MEMORY - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const game={score:0,lives:3,wordRotation:[],shownWords:[],lastWordIndex:-1,currentWord:'',bestScore:null};
const els={start:$('#vm-start'),wordArea:$('#vm-word-area'),buttonsArea:$('#vm-buttons-area'),seenBtn:$('#vm-seen-btn'),newBtn:$('#vm-new-btn'),scoreDisplay:$('#vm-score'),livesDisplay:$('#vm-lives'),bestDisplay:$('#vm-best')};
const wordList=["apple","banana","car","dog","elephant","fish","guitar","house","ice cream","jacket","kangaroo","lemon","moon","nose","orange","pizza","queen","rainbow","sun","tree","umbrella","violin","water","xylophone","yellow","zebra","book","cat","desk","egg","fire","goose","hat","island","jungle","kite","lion","mango","nest","ocean","pencil","quilt","river","snake","table","unicorn","volcano","window","yacht","zeppelin","atom","butterfly","cloud","diamond","feather","giraffe","helicopter","internet","jellyfish","kayak","leopard","mushroom","nutmeg","ostrich","peacock","quicksilver","rhinoceros","sandwich","telephone","vampire","waterfall","yogurt","zealous","anchor","bridge","castle","dragon","eagle","forest","garden","honey","igloo","journey","kingdom","ladder","mountain","network","oasis","palace","question","rocket","shadow","treasure","universe","village","wizard","crystal","engine","fabric","galaxy","harbor","maple","nebula","opera","puzzle","ruby","sapphire","thunder","valley","whisper"];
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestScore=scores['Verbal Memory'];if(game.bestScore)els.bestDisplay.text(game.bestScore);};
const updateUI=()=>{els.scoreDisplay.text(game.score);els.livesDisplay.text(game.lives);if(game.lives<=1)els.livesDisplay.parent().addClass('animate-pulse');else els.livesDisplay.parent().removeClass('animate-pulse');};
const addWordToRotation=()=>{const availableWords=wordList.filter(w=>!game.wordRotation.includes(w));if(availableWords.length>0){const randomIndex=Math.floor(Math.random()*availableWords.length);game.wordRotation.push(availableWords[randomIndex]);}};
const displayWord=()=>{let randomIndex=Math.floor(Math.random()*game.wordRotation.length);let attempts=0;while(randomIndex===game.lastWordIndex&&attempts<10){randomIndex=Math.floor(Math.random()*game.wordRotation.length);attempts++;}
game.currentWord=game.wordRotation[randomIndex];game.lastWordIndex=randomIndex;els.wordArea.text(game.currentWord).removeClass('text-red-400 text-green-400').addClass('text-blue-400');};
const handleCorrect=()=>{game.score++;updateUI();if(game.score%5===0){addWordToRotation();HB.showToast(`${game.score} words! 🎉`,1500,'success');}
els.wordArea.removeClass('text-blue-400').addClass('text-green-400');HB.playSound('success');setTimeout(displayWord,300);};
const handleWrong=()=>{game.lives--;updateUI();els.wordArea.removeClass('text-blue-400').addClass('text-red-400');HB.playSound('fail');if(game.lives<=0){gameOver();}else{HB.showToast(`Wrong! ${game.lives} ${game.lives===1?'life':'lives'} left`,2000,'error');setTimeout(displayWord,1000);}};
const gameOver=()=>{const isNewRecord=saveScore('Verbal Memory',game.score);if(isNewRecord)game.bestScore=game.score;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You correctly identified <strong>${game.score}</strong> words!${game.score>=50?'<br>🏆 Exceptional verbal memory!':''}`,score:`${game.score} words`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'📚'});};
const reset=()=>{game.score=0;game.lives=3;game.wordRotation=[];game.shownWords=[];game.lastWordIndex=-1;for(let i=0;i<5;i++)addWordToRotation();els.buttonsArea.addClass('hidden');els.start.show();els.wordArea.text('');updateUI();loadBest();};
const start=()=>{els.start.hide();els.buttonsArea.removeClass('hidden');displayWord();};
const handleSeen=()=>{if(!game.shownWords.includes(game.currentWord)){handleWrong();}else{handleCorrect();}};
const handleNew=()=>{if(game.shownWords.includes(game.currentWord)){handleWrong();}else{game.shownWords.push(game.currentWord);handleCorrect();}};
els.start.on('click',start);
els.seenBtn.on('click',handleSeen);
els.newBtn.on('click',handleNew);
loadBest();updateUI();
});
