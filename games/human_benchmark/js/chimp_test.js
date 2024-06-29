// CHIMP TEST
$(function () {
    var level = 1;
    var grid;
    const columns = (window.matchMedia('(max-width: 600px)').matches) ? 5 : 8;

    $("#start-chimp-test").click(function () {
        $(this).hide();
        $("#chimp-test .chimp-button-container").hide();
        generateGrid();
    });

    function generateGrid() {
        var numbers = [];
        for (var i = 1; i <= level + 3; i++) {
            numbers.push(i);
        }
        numbers = shuffleArray(numbers);
        grid = [];
        for (var i = 0; i < 5; i++) {
            var row = [];
            for (var j = 0; j < columns; j++) {
                row.push(0);
            }
            grid.push(row);
        }

        const numberCount = numbers.length;

        for (var j = 0; j < numberCount; j++) {
            let columnIndex = Math.floor(Math.random() * columns);
            let rowIndex = Math.floor(Math.random() * 5);
            if (grid[rowIndex][columnIndex] === 0) {
                grid[rowIndex][columnIndex] = numbers.pop();
            } else {
                j--;
            }
        }
        displayGrid();
    }

    function displayGrid() {
        $("#chimp-test .chimp-grid").empty();
        for (var i = 0; i < 5; i++) {
            for (var j = 0; j < columns; j++) {
                var value = grid[i][j];
                if (value > 0) {
                    $("#chimp-test .chimp-grid").append(`<div class="chimp-button bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer">${value}</div>`);
                } else {
                    $("#chimp-test .chimp-grid").append(`<div class="chimp-button empty"></div>`);
                }
            }
        }
        $('.chimp-grid').find(".chimp-button:not(.empty)").click(checkButton);
    }

    function hideNumbers() {
        $('.chimp-grid').find('.chimp-button:not(.empty)').each(function () {
            $(this).addClass('covered');
        })
    }

    let expectedClickedValue = 1;

    function checkButton(event) {
        const $clickedButton = $(event.target);
        var clickedValue = parseInt($clickedButton.text());
        $clickedButton.html('');
        $clickedButton.removeClass(['bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-2', 'px-4', 'rounded', 'cursor-pointer', 'covered']);
        $clickedButton.addClass('empty');

        if (clickedValue !== expectedClickedValue) {
            saveScore('Chimp Test', level);
            $("#chimp-test .chimp-button.covered").each((index, button) => button.classList.remove('covered'));
            setTimeout(() => {
                alert(`You lost. You have reached level ${level}`);
                $("#start-chimp-test").show();
                $("#chimp-test .chimp-button-container").show();
                $("#chimp-test .chimp-grid").html('');
                level = 1;
                expectedClickedValue = 1;
            }, 0);
            return;
        } else {
            expectedClickedValue++;
        }

        if (clickedValue === level + 3) {
            level++;
            expectedClickedValue = 1;
            generateGrid();
        } else if (clickedValue === 1 && level > 1) {
            hideNumbers();
        }
    }

    function shuffleArray(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }
});