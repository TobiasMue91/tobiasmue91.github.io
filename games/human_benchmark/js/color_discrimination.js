// COLOR DISCRIMINATION TEST
$(function(){
const game={level:1,lives:3,bestScore:null,correctTile:null,baseColor:null};
const els={
area:$('#cd-game-area'),
grid:$('#cd-grid'),
startScreen:$('#cd-start-screen'),
startBtn:$('#cd-start-btn'),
feedback:$('#cd-feedback'),
feedbackIcon:$('#cd-feedback-icon'),
feedbackText:$('#cd-feedback-text'),
level:$('#cd-level'),
lives:$('#cd-lives'),
best:$('#cd-best'),
retry:$('#cd-retry'),
home:$('#cd-home')
};

const loadBest=()=>{
const scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};
const levelStr=scores['Color Discrimination'];
if(levelStr){game.bestScore=parseInt(levelStr);els.best.text('Level '+game.bestScore);}
};

const getGridSize=(level)=>{
if(level<=5)return 3;
if(level<=10)return 4;
if(level<=15)return 5;
if(level<=20)return 6;
return 7;
};

const getColorDifference=(level)=>{
// Start with noticeable difference, decrease as level increases
const maxDiff=60;
const minDiff=5;
const diff=Math.max(minDiff,maxDiff-level*2.5);
return Math.round(diff);
};

const generateBaseColor=()=>{
// Generate a random base color with good saturation
const hue=Math.floor(Math.random()*360);
const sat=60+Math.floor(Math.random()*30); // 60-90%
const light=40+Math.floor(Math.random()*20); // 40-60%
return {h:hue,s:sat,l:light};
};

const hslToString=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;

const generateDifferentColor=(base,diff)=>{
// Shift lightness or saturation slightly
const direction=Math.random()>0.5?1:-1;
const shiftType=Math.random();
let newH=base.h,newS=base.s,newL=base.l;
if(shiftType<0.5){
// Shift lightness
newL=Math.max(10,Math.min(90,base.l+direction*diff));
}else{
// Shift both slightly
newL=Math.max(10,Math.min(90,base.l+direction*(diff*0.6)));
newS=Math.max(20,Math.min(100,base.s-direction*(diff*0.4)));
}
return {h:newH,s:newS,l:newL};
};

const createGrid=()=>{
const size=getGridSize(game.level);
const tileCount=size*size;
const diff=getColorDifference(game.level);
game.baseColor=generateBaseColor();
const differentColor=generateDifferentColor(game.baseColor,diff);
game.correctTile=Math.floor(Math.random()*tileCount);

const tileSize=Math.min(60,Math.floor(280/size));
const gap=Math.max(2,Math.floor(8-size));

let html=`<div class="grid gap-[${gap}px]" style="display:grid;grid-template-columns:repeat(${size},${tileSize}px);gap:${gap}px;">`;
for(let i=0;i<tileCount;i++){
const color=i===game.correctTile?differentColor:game.baseColor;
const colorStr=hslToString(color.h,color.s,color.l);
html+=`<div class="cd-tile rounded cursor-pointer transition-transform hover:scale-105" data-index="${i}" style="width:${tileSize}px;height:${tileSize}px;background-color:${colorStr};"></div>`;
}
html+='</div>';
els.grid.html(html);
els.grid.removeClass('hidden');
els.startScreen.addClass('hidden');
els.feedback.addClass('hidden');

$('.cd-tile').on('click',handleTileClick);
};

const handleTileClick=function(){
const index=parseInt($(this).data('index'));
$('.cd-tile').off('click');
if(index===game.correctTile){
handleCorrect($(this));
}else{
handleWrong($(this));
}
};

const handleCorrect=(tile)=>{
tile.addClass('ring-4 ring-green-400');
HB.playSound('success');
game.level++;
els.level.text(game.level);
showFeedback('correct');
setTimeout(()=>{createGrid();},800);
};

const handleWrong=(clickedTile)=>{
clickedTile.addClass('ring-4 ring-red-400');
$(`.cd-tile[data-index="${game.correctTile}"]`).addClass('ring-4 ring-green-400 animate-pulse');
HB.playSound('fail');
game.lives--;
els.lives.text(game.lives);
if(game.lives<=0){
showFeedback('gameover');
setTimeout(()=>{endGame();},1000);
}else{
showFeedback('wrong');
setTimeout(()=>{createGrid();},1200);
}
};

const showFeedback=(type)=>{
els.feedback.removeClass('hidden');
if(type==='correct'){
els.feedbackIcon.text('✓');
els.feedbackText.text('Correct!').removeClass('text-red-400').addClass('text-green-400');
}else if(type==='wrong'){
els.feedbackIcon.text('✗');
els.feedbackText.html(`Wrong! ${game.lives} ${game.lives===1?'life':'lives'} left`).removeClass('text-green-400').addClass('text-red-400');
}else if(type==='gameover'){
els.feedbackIcon.text('💀');
els.feedbackText.text('Game Over!').removeClass('text-green-400').addClass('text-red-400');
}
setTimeout(()=>{els.feedback.addClass('hidden');},700);
};

const endGame=()=>{
els.grid.addClass('hidden');
const finalLevel=game.level-1;
const isNewRecord=saveScore('Color Discrimination','Level '+finalLevel,false);
if(isNewRecord){
game.bestScore=finalLevel;
els.best.text('Level '+finalLevel);
HB.playSound('perfect');
}
els.retry.removeClass('hidden');
els.home.removeClass('hidden');
HB.showModal({
title:isNewRecord?'🎉 New Personal Best!':'Game Over',
message:`You reached level ${finalLevel}!<br>Grid size: ${getGridSize(finalLevel)}x${getGridSize(finalLevel)}`,
score:'Level '+finalLevel,
isNewRecord,
onRetry:reset,
onHome:HB.goHome,
icon:'🎨'
});
};

const reset=()=>{
game.level=1;
game.lives=3;
els.level.text(1);
els.lives.text(3);
els.retry.addClass('hidden');
els.home.addClass('hidden');
els.grid.addClass('hidden');
els.feedback.addClass('hidden');
els.startScreen.removeClass('hidden');
};

const start=()=>{
reset();
els.startScreen.addClass('hidden');
createGrid();
};

els.startBtn.on('click',start);
els.retry.on('click',reset);
els.home.on('click',HB.goHome);
loadBest();
});
