// VERBAL MEMORY
$(function () {
    var wordIndex = 0;
    var score = 0;
    let lastWordIndex = 0;
    let currentWord, wordRotation, wordList, shownWords;

    $("#start-verbal-memory-test").click(function () {
        wordRotation = [];
        score = 0;
        wordList = ["apple", "banana", "car", "dog", "elephant", "fish", "guitar", "house", "ice cream", "jacket", "kangaroo", "lemon", "moon", "nose", "orange", "pizza", "queen", "rainbow", "sun", "tree", "umbrella", "violin", "water", "xylophone", "yellow", "zebra", "book", "cat", "desk", "egg", "fire", "goose", "hat", "island", "jungle", "kite", "lion", "mango", "nest", "ocean", "pencil", "quilt", "river", "snake", "table", "unicorn", "volcano", "window", "yacht", "zeppelin", "atom", "butterfly", "cloud", "diamond", "feather", "giraffe", "helicopter", "internet", "jellyfish", "kayak", "leopard", "mushroom", "nutmeg", "ostrich", "peacock", "quicksilver", "rhinoceros", "sandwich", "telephone", "vampire", "waterfall", "yogurt", "zealous"];
        shownWords = [];
        for (let i = 0; i < 5; i++) {
            addWordToRotation();
        }
        $(this).hide();
        $("#word-area").show();
        $("#buttons-area").show();
        $("#verbal-memory-test #results-area").hide();
        displayWord();
    });

    function displayWord() {
        let randomIndex = Math.floor(Math.random() * wordRotation.length);
        while (randomIndex === lastWordIndex) {
            randomIndex = Math.floor(Math.random() * wordRotation.length);
        }
        currentWord = wordRotation[randomIndex];
        lastWordIndex = randomIndex;
        $("#word-area").text(currentWord);
    }

    function addWordToRotation() {
        const randomIndex = Math.floor(Math.random() * wordList.length);
        wordList.splice(randomIndex, 1);
        wordRotation.push(wordList[randomIndex]);
    }

    function correct() {
        score++;
        wordIndex++;
        if (score % 5 === 0) {
            addWordToRotation();
        }
        displayWord();
        $("#verbal-score").text(score);
    }

    function wrong() {
        $("#verbal-memory-test #buttons-area").hide();
        $("#verbal-memory-test #results-area").show();
        $("#start-verbal-memory-test").show();
        $("#verbal-score").text(score);
        saveScore('Verbal Memory', score);
    }

    $("#new-button").click(function () {
        if (shownWords.includes(currentWord)) {
            wrong();
            return;
        }
        shownWords.push(currentWord);
        correct();
    });

    $("#seen-button").click(function () {
        if (!shownWords.includes(currentWord)) {
            wrong();
            return;
        }
        correct();
    });
});