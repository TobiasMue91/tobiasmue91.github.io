// VISUAL ESTIMATION
$(function () {
    const allEmojis = ['😀', '😎', '🚀', '🌈', '🍕', '🎸', '🌺', '🦄', '🍔', '🎈', '🐶', '🐱', '🐼', '🦁', '🐘', '🦋', '🌻', '🍎', '🍌', '🍊', '🍓', '🥑', '🍉', '🍇', '🥕', '🏀', '⚽️', '🎾', '🏈', '🎃', '🌙', '⭐️', '🌞'];
    let currentEmojis, targetEmoji, currentCount, score, timer, timeLeft;

    $("#start-estimation").click(startGame);

    $("#submit-guess").click(submitGuess);

    $("#user-guess").keypress(function(e) {
        if(e.which == 13) { // Enter key
            submitGuess();
        }
    });

    function startGame() {
        $("#start-estimation").hide();
        $("#instructions").removeClass('hidden');
        score = 0;
        timeLeft = 60;
        $("#score").text(`Score: ${score}`);
        timer = setInterval(updateTimer, 1000);
        showEmojis();
    }

    function submitGuess() {
        const userGuess = parseInt($("#user-guess").val());

        if (isNaN(userGuess)) {
            $("#result").text("Please enter a valid number").removeClass("text-green-500").addClass("text-red-500");
            return;
        }

        if (userGuess === currentCount) {
            score++;
            $("#result").text("Correct! +1 point").removeClass("text-red-500").addClass("text-green-500");
        } else {
            $("#result").text(`Incorrect. Actual count: ${currentCount}`).removeClass("text-green-500").addClass("text-red-500");
        }

        $("#score").text(`Score: ${score}`);
        $("#user-guess").val('');

        if (timeLeft > 0) {
            showEmojis();
        }
    }

    function showEmojis() {
        const $display = $("#emoji-display").empty().show();
        const displayWidth = $display.width();
        const displayHeight = $display.height();

        currentEmojis = getRandomEmojis(allEmojis, 3);
        targetEmoji = currentEmojis[Math.floor(Math.random() * 3)];
        $("#target-emoji").text(targetEmoji);

        currentCount = Math.floor(Math.random() * 16) + 5;  // Random count between 5 and 20
        let placedCount = 0;
        let attempts = 0;
        const maxAttempts = 100;  // Prevent infinite loop

        while (placedCount < currentCount && attempts < maxAttempts) {
            const emoji = currentEmojis[Math.floor(Math.random() * 3)];
            const size = Math.random() * 20 + 20;  // Random size between 20px and 40px
            const left = Math.random() * (displayWidth - size);
            const top = Math.random() * (displayHeight - size);

            // Check for overlap
            let overlapping = false;
            $("#emoji-display span").each(function() {
                const $existing = $(this);
                const existingLeft = parseFloat($existing.css('left'));
                const existingTop = parseFloat($existing.css('top'));
                const existingSize = parseFloat($existing.css('font-size'));

                if (left < existingLeft + existingSize &&
                    left + size > existingLeft &&
                    top < existingTop + existingSize &&
                    top + size > existingTop) {
                    overlapping = true;
                    return false;  // Break the loop
                }
            });

            if (!overlapping) {
                $('<span>').text(emoji).css({
                    position: 'absolute',
                    fontSize: `${size}px`,
                    left: `${left}px`,
                    top: `${top}px`
                }).appendTo($display);

                if (emoji === targetEmoji) {
                    placedCount++;
                }
            }

            attempts++;
        }

        // Fill remaining space with non-target emojis
        while (attempts < maxAttempts) {
            const emoji = currentEmojis.find(e => e !== targetEmoji);
            const size = Math.random() * 20 + 20;
            const left = Math.random() * (displayWidth - size);
            const top = Math.random() * (displayHeight - size);

            let overlapping = false;
            $("#emoji-display span").each(function() {
                const $existing = $(this);
                const existingLeft = parseFloat($existing.css('left'));
                const existingTop = parseFloat($existing.css('top'));
                const existingSize = parseFloat($existing.css('font-size'));

                if (left < existingLeft + existingSize &&
                    left + size > existingLeft &&
                    top < existingTop + existingSize &&
                    top + size > existingTop) {
                    overlapping = true;
                    return false;
                }
            });

            if (!overlapping) {
                $('<span>').text(emoji).css({
                    position: 'absolute',
                    fontSize: `${size}px`,
                    left: `${left}px`,
                    top: `${top}px`
                }).appendTo($display);
            }

            attempts++;
        }

        $("#guess-input").show();
        $("#user-guess").focus();
    }

    function getRandomEmojis(emojiList, count) {
        return emojiList.sort(() => 0.5 - Math.random()).slice(0, count);
    }

    function updateTimer() {
        timeLeft--;
        $("#timer").text(`Time left: ${timeLeft}s`);
        if (timeLeft <= 0) {
            clearInterval(timer);
            endGame();
        }
    }

    function endGame() {
        $("#emoji-display, #guess-input").hide();
        $("#result").text(`Game over! Final score: ${score}`).removeClass("text-red-500 text-green-500");
        $("#start-estimation").show();
        saveScore('Visual Estimation', score);
    }
});