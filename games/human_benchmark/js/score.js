// SCORE DASHBOARD
function toNumber(score) {
    return Number(String(score).replace(/\D+/g, ''));
}

function saveScore(gameId, score, lowerIsBetter = false) {
    let scores = JSON.parse(localStorage.getItem('humanBenchmarkScores')) || {};
    const currentScore = scores[gameId];
    const isBetter = lowerIsBetter ? toNumber(score) < toNumber(currentScore) : toNumber(score) > toNumber(currentScore);

    if (!currentScore || isBetter) {
        scores[gameId] = score;
        localStorage.setItem('humanBenchmarkScores', JSON.stringify(scores));
    }
}

function closeScoresModal() {
    document.getElementById('scoresModal').classList.add('hidden');
}

document.getElementById('closeScoresModal').addEventListener('click', closeScoresModal);
document.getElementById('scoresModalBackdrop').addEventListener('click', closeScoresModal);
document.getElementById('showScoresButton').addEventListener('click', showScores);

function showScores(e) {
    e.preventDefault();
    let scores = JSON.parse(localStorage.getItem('humanBenchmarkScores')) || {};
    let tableHTML = `
<table class="min-w-full bg-white border border-gray-200 mt-4">
    <thead>
        <tr class="bg-gray-800 text-white">
            <th class="py-2 px-4 border-b border-gray-300 text-left">Test Name</th>
            <th class="py-2 px-4 border-b border-gray-300 text-left">Score</th>
        </tr>
    </thead>
    <tbody>
`;

    let index = 0;
    for (let [gameId, score] of Object.entries(scores)) {
        tableHTML += `
        <tr class="text-gray-700 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
            <td class="py-2 px-4 border-b border-gray-300">${gameId}</td>
            <td class="py-2 px-4 border-b border-gray-300">${score}</td>
        </tr>
    `;
        index++;
    }

    tableHTML += '</tbody></table>';

    document.getElementById('scoresContent').innerHTML = tableHTML;
    document.getElementById('scoresModal').classList.remove('hidden');
}

document.getElementById('resetScoresButton').addEventListener('click', resetScores);
document.getElementById('copyScoresButton').addEventListener('click', copyScores);

function resetScores() {
    if (confirm('Are you sure you want to reset all scores?')) {
        localStorage.removeItem('humanBenchmarkScores');
        showScores({
            preventDefault: () => {
            }
        });
    }
}

function copyScores() {
    let scores = JSON.parse(localStorage.getItem('humanBenchmarkScores')) || {};
    let scoreText = '';

    for (let [gameId, score] of Object.entries(scores)) {
        scoreText += `${gameId}: ${score}\n`;
    }

    if (scoreText) {
        navigator.clipboard.writeText(scoreText.trim())
            .then(() => {
                alert('Scores copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy scores: ', err);
                alert('Failed to copy scores. Please try again.');
            });
    } else {
        alert('No scores to copy.');
    }
}