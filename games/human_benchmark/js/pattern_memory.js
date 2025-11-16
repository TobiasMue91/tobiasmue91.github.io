// PATTERN MEMORY - ENHANCED
$(function(){
if(!window.HB){console.error('HB utilities not loaded');return;}
const game={level:1,lives:3,gridSize:3,patternLength:3,grid:[],pattern:[],clicks:0,displayTime:3000,bestLevel:null};
const els={start:$('#pm-start'),gridEl:$('.pattern-grid'),levelDisplay:$('#pm-level'),livesDisplay:$('#pm-lives'),bestDisplay:$('#pm-best')};
const loadBest=()=>{const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};game.bestLevel=scores['Pattern Memory'];if(game.bestLevel)els.bestDisplay.text(game.bestLevel);};
const updateUI=()=>{els.levelDisplay.text(game.level);els.livesDisplay.text(game.lives);if(game.lives<=1)els.livesDisplay.parent().addClass('animate-pulse');else els.livesDisplay.parent().removeClass('animate-pulse');};
const generateGrid=()=>{game.grid=[];game.pattern=[];game.clicks=0;for(let i=0;i<game.gridSize;i++){game.grid.push(Array(game.gridSize).fill(0));}
for(let i=0;i<game.patternLength;i++){const x=Math.floor(Math.random()*game.gridSize);const y=Math.floor(Math.random()*game.gridSize);if(game.grid[y][x]===0){game.grid[y][x]=1;game.pattern.push({x,y});}else{i--;}}
displayGrid();};
const displayGrid=()=>{els.gridEl.empty().css('grid-template-columns',`repeat(${game.gridSize}, minmax(0, 1fr))`);const cellSize=Math.max(50,Math.min(100,400/game.gridSize));for(let i=0;i<game.gridSize;i++){for(let j=0;j<game.gridSize;j++){const isPattern=game.grid[i][j]===1;const cell=$(`<div class="pattern-cell border-2 rounded-xl cursor-pointer transition-all duration-200 ${isPattern?'bg-blue-500 border-blue-400':'bg-gray-700 border-gray-600'}" data-x="${j}" data-y="${i}"></div>`);cell.css({width:`${cellSize}px`,height:`${cellSize}px`});els.gridEl.append(cell);}}
setTimeout(()=>{$('.pattern-cell').removeClass('bg-blue-500 border-blue-400').addClass('bg-gray-700 border-gray-600').on('click',checkPattern);HB.playSound('click');},game.displayTime);};
const checkPattern=function(){const x=$(this).data('x');const y=$(this).data('y');if(game.grid[y][x]===1){$(this).removeClass('bg-gray-700 border-gray-600').addClass('bg-green-500 border-green-400');game.grid[y][x]=2;game.clicks++;HB.playSound('success');if(game.clicks===game.pattern.length){levelUp();}}else{$(this).removeClass('bg-gray-700').addClass('bg-red-500');game.lives--;updateUI();HB.playSound('fail');if(game.lives<=0){gameOver();}else{HB.showToast(`Wrong! ${game.lives} ${game.lives===1?'life':'lives'} left`,2000,'error');}}};
const levelUp=()=>{game.level++;game.patternLength++;if(game.level%2===0){game.gridSize++;game.displayTime=Math.max(1500,game.displayTime-100);}
updateUI();if(game.level%5===0)HB.showToast(`Level ${game.level}! 🎉`,1500,'success');setTimeout(generateGrid,500);};
const gameOver=()=>{const isNewRecord=saveScore('Pattern Memory',game.level);if(isNewRecord)game.bestLevel=game.level;HB.showModal({title:isNewRecord?'🎉 New Personal Best!':'Game Over',message:`You reached level <strong>${game.level}</strong>!${game.level>=15?'<br>🏆 Amazing pattern recognition!':''}`,score:`Level ${game.level}`,isNewRecord,onRetry:reset,onHome:HB.goHome,icon:'🧩'});};
const reset=()=>{game.level=1;game.lives=3;game.gridSize=3;game.patternLength=3;game.displayTime=3000;els.gridEl.empty();els.start.show();updateUI();loadBest();};
els.start.on('click',()=>{els.start.hide();generateGrid();});
loadBest();updateUI();
});
