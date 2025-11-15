// CHIMP TEST - ENHANCED
$(function(){
const game={level:1,grid:[],expected:1,columns:HB.isMobile()?5:8,strikes:3,bestLevel:null};
const els={start:$('#start-chimp-test'),container:$('.chimp-button-container'),gridEl:$('.chimp-grid'),levelDisplay:$('#chimp-level'),bestDisplay:$('#chimp-best'),strikesDisplay:$('#chimp-strikes'),strikesContainer:$('#chimp-strikes-container')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestLevel=scores['Chimp Test'];if(game.bestLevel)els.bestDisplay.text(game.bestLevel);};
const updateUI=()=>{els.levelDisplay.text(game.level);els.strikesDisplay.text(game.strikes);if(game.strikes<=1)els.strikesContainer.addClass('animate-pulse');else els.strikesContainer.removeClass('animate-pulse');};
const generateGrid=()=>{const numbers=HB.shuffleArray([...Array(game.level+3)].map((_,i)=>i+1));game.grid=Array(5).fill().map(()=>Array(game.columns).fill(0));for(let num of numbers){let placed=false;while(!placed){const row=Math.floor(Math.random()*5);const col=Math.floor(Math.random()*game.columns);if(game.grid[row][col]===0){game.grid[row][col]=num;placed=true;}}}
displayGrid();};
const displayGrid=()=>{els.gridEl.empty();for(let i=0;i<5;i++){for(let j=0;j<game.columns;j++){const value=game.grid[i][j];const btn=$(`<div class="chimp-button ${value>0?'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl cursor-pointer transform transition-all hover:scale-105':'empty'}">${value>0?value:''}</div>`);if(value>0)btn.on('click',()=>checkButton(value,btn));els.gridEl.append(btn);}}};
const hideNumbers=()=>{$('.chimp-grid .chimp-button:not(.empty)').addClass('covered');};
const checkButton=(value,btn)=>{btn.html('').removeClass('bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl cursor-pointer covered').addClass('empty bg-green-500');if(value!==game.expected){HB.playSound('fail');btn.removeClass('bg-green-500').addClass('bg-red-500');game.strikes--;updateUI();$('.chimp-button.covered').removeClass('covered');setTimeout(()=>{if(game.strikes<=0){gameOver();}else{HB.showToast(`Wrong number! ${game.strikes} ${game.strikes===1?'life':'lives'} left`,2000,'error');game.expected=1;generateGrid();}},800);return;}
HB.playSound('click');game.expected++;if(value===game.level+3){game.level++;game.expected=1;updateUI();if(game.level%5===0)HB.showToast(`Level ${game.level}! 🎉`,1500,'success');setTimeout(generateGrid,300);}else if(value===1&&game.level>1){hideNumbers();}};
const gameOver=()=>{const isNewRecord=saveScore('Chimp Test',game.level);if(isNewRecord)game.bestLevel=game.level;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You reached level <strong>${game.level}</strong>!<br>Great job! ${game.level>=10?'🏆 Amazing!':''}`,score:`Level ${game.level}`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🐵'});};
const reset=()=>{game.level=1;game.expected=1;game.strikes=3;els.gridEl.empty();els.start.show();els.container.show();updateUI();loadBest();};
els.start.on('click',()=>{els.start.hide();els.container.hide();generateGrid();});
loadBest();updateUI();
});