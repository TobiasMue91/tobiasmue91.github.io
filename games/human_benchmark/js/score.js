// ENHANCED SCORE SYSTEM
const ScoreSystem={
toNumber(score){return Number(String(score).replace(/\D+/g,''));},
saveScore(gameId,score,lowerIsBetter=false){
let scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};
let history=JSON.parse(localStorage.getItem('humanBenchmarkHistory'))||{};
if(!history[gameId])history[gameId]=[];
const currentScore=scores[gameId];
const scoreNum=this.toNumber(score);
const isBetter=!currentScore||(lowerIsBetter?scoreNum<this.toNumber(currentScore):scoreNum>this.toNumber(currentScore));
history[gameId].push({score,scoreNum,timestamp:Date.now(),isBest:isBetter});
if(history[gameId].length>50)history[gameId].shift();
if(isBetter){
scores[gameId]=score;
localStorage.setItem('humanBenchmarkScores',JSON.stringify(scores));
}
localStorage.setItem('humanBenchmarkHistory',JSON.stringify(history));
return isBetter;
},
getStats(gameId){
const history=JSON.parse(localStorage.getItem('humanBenchmarkHistory'))||{};
const gameHistory=history[gameId]||[];
if(gameHistory.length===0)return null;
const scores=gameHistory.map(h=>h.scoreNum);
const avg=(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2);
const best=Math.max(...scores);
const worst=Math.min(...scores);
const recent=gameHistory.slice(-5);
return {avg,best,worst,recent,total:gameHistory.length};
},
getPercentile(gameId,score){
const allScores=this.getAllScoresForGame(gameId);
if(allScores.length<5)return null;
const scoreNum=this.toNumber(score);
const better=allScores.filter(s=>s<scoreNum).length;
return Math.round((better/allScores.length)*100);
},
getAllScoresForGame(gameId){
const history=JSON.parse(localStorage.getItem('humanBenchmarkHistory'))||{};
return(history[gameId]||[]).map(h=>h.scoreNum);
}
};
function toNumber(score){return ScoreSystem.toNumber(score);}
function saveScore(gameId,score,lowerIsBetter=false){return ScoreSystem.saveScore(gameId,score,lowerIsBetter);}

function closeScoresModal(){document.getElementById('scoresModal').classList.add('hidden');}
document.getElementById('closeScoresModal').addEventListener('click',closeScoresModal);
document.getElementById('scoresModalBackdrop').addEventListener('click',closeScoresModal);
document.getElementById('showScoresButton').addEventListener('click',showScores);
function showScores(e){
e.preventDefault();
let scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};
let history=JSON.parse(localStorage.getItem('humanBenchmarkHistory'))||{};
if(Object.keys(scores).length===0){
document.getElementById('scoresContent').innerHTML='<p class="text-gray-400 py-8">No scores yet. Play some games to see your statistics!</p>';
document.getElementById('scoresModal').classList.remove('hidden');
return;
}
let html='<div class="space-y-4">';
for(let[gameId,score]of Object.entries(scores)){
const stats=ScoreSystem.getStats(gameId);
const gameHistory=history[gameId]||[];
const trend=gameHistory.length>=2?(gameHistory[gameHistory.length-1].scoreNum>gameHistory[gameHistory.length-2].scoreNum?'📈':'📉'):'';
html+=`<div class="stat-card"><div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-lg text-white">${gameId}</h4><p class="text-2xl font-bold text-blue-400 mt-1">${score}</p></div><div class="text-right text-sm"><div class="text-gray-400">Played: ${stats?stats.total:1}x</div>${trend?`<div class="text-xl mt-1">${trend}</div>`:''}</div></div>`;
if(stats&&stats.total>1){
html+=`<div class="grid grid-cols-3 gap-2 mt-3 text-sm"><div class="bg-gray-700 p-2 rounded"><div class="text-gray-400">Best</div><div class="font-semibold text-green-400">${stats.best}</div></div><div class="bg-gray-700 p-2 rounded"><div class="text-gray-400">Average</div><div class="font-semibold text-yellow-400">${stats.avg}</div></div><div class="bg-gray-700 p-2 rounded"><div class="text-gray-400">Worst</div><div class="font-semibold text-red-400">${stats.worst}</div></div></div>`;
}
html+='</div>';
}
html+='</div>';
document.getElementById('scoresContent').innerHTML=html;
document.getElementById('scoresModal').classList.remove('hidden');
}
document.getElementById('resetScoresButton').addEventListener('click',resetScores);
document.getElementById('copyScoresButton').addEventListener('click',copyScores);
function resetScores(){
if(confirm('Are you sure you want to reset all scores and history? This cannot be undone!')){
localStorage.removeItem('humanBenchmarkScores');
localStorage.removeItem('humanBenchmarkHistory');
if(window.HB&&HB.showToast)HB.showToast('All scores reset!',2000,'success');
showScores({preventDefault:()=>{}});
}
}
function copyScores(){
let scores=JSON.parse(localStorage.getItem('humanBenchmarkScores'))||{};
let scoreText='🧠 Human Benchmark Scores\n\n';
for(let[gameId,score]of Object.entries(scores)){
const stats=ScoreSystem.getStats(gameId);
scoreText+=`${gameId}: ${score}`;
if(stats&&stats.total>1)scoreText+=` (avg: ${stats.avg}, played: ${stats.total}x)`;
scoreText+='\n';
}
if(Object.keys(scores).length>0){
navigator.clipboard.writeText(scoreText.trim()).then(()=>{
if(window.HB&&HB.showToast)HB.showToast('Scores copied to clipboard!',2000,'success');else alert('Scores copied!');
}).catch(err=>{
console.error('Failed to copy:',err);
if(window.HB&&HB.showToast)HB.showToast('Failed to copy scores',2000,'error');else alert('Failed to copy scores');
});
}else{
if(window.HB&&HB.showToast)HB.showToast('No scores to copy',2000,'info');else alert('No scores to copy');
}
}