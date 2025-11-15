// SEQUENCE MEMORY TEST - ENHANCED
$(function(){
const game={sequence:[],round:0,level:0,playerTurn:false,bestLevel:null};
const els={start:$('#start-sequence-memory-test'),squares:$('.square'),levelDisplay:$('#seq-level'),bestDisplay:$('#seq-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestLevel=scores['Sequence Memory'];if(game.bestLevel)els.bestDisplay.text(game.bestLevel);};
const updateUI=()=>{els.levelDisplay.text(game.level);};
const flashSquare=(square,color,duration=300)=>{$(square).addClass(color);HB.playSound('click');setTimeout(()=>$(square).removeClass(color),duration);};
const nextRound=()=>{game.round=0;game.playerTurn=false;game.sequence.push(Math.floor(Math.random()*9));game.level=game.sequence.length;updateUI();if(game.level%5===0&&game.level>0)HB.showToast(`Level ${game.level}! 🎉`,1500,'success');playSequence();};
const playSequence=()=>{let delay=0;game.sequence.forEach((idx,i)=>{setTimeout(()=>flashSquare(els.squares[idx],'bg-blue-500'),delay);delay+=600;});setTimeout(()=>game.playerTurn=true,delay+200);};
const checkClick=function(){if(!game.playerTurn)return;const idx=parseInt($(this).data('index'));if(idx===game.sequence[game.round]){game.round++;flashSquare(this,'bg-green-500');if(game.round===game.sequence.length){game.playerTurn=false;HB.playSound('success');setTimeout(nextRound,1000);}}else{flashSquare(this,'bg-red-500');gameOver();}};
const gameOver=()=>{game.playerTurn=false;HB.playSound('fail');const isNewRecord=saveScore('Sequence Memory',game.level);if(isNewRecord)game.bestLevel=game.level;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You reached level <strong>${game.level}</strong>!${game.level>=15?'<br>🏆 Incredible memory!':''}`,score:`Level ${game.level}`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🔗'});};
const reset=()=>{game.sequence=[];game.round=0;game.level=0;game.playerTurn=false;els.start.show();updateUI();loadBest();};
els.squares.on('click',checkClick);
els.start.on('click',()=>{els.start.hide();nextRound();});
loadBest();updateUI();
});
