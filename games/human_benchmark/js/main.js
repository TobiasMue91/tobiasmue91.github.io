$(document).ready(function () {
    const testContainer = $('#game-container');
    const screenCache = {};

    function loadTestScreen(screenName) {
        const htmlFileName = `html/${screenName}.html`;
        const jsFileName = `js/${screenName}.js`;

        testContainer.html('<div class="loading">Loading...</div>');

        const loadContent = () => {
            testContainer.html(screenCache[screenName].html);
            window.location.hash = screenName;
            $('#landing-tab').addClass('hidden');
            $('#game-container').removeClass('hidden');
            $('#game-container .test-screen').removeClass('hidden');
            return $.getScript(jsFileName);
        };

        if (screenCache[screenName]) {
            return loadContent();
        }

        return $.get(htmlFileName)
            .then(html => {
                screenCache[screenName] = {html};
                history.pushState({screenName}, '', `#${screenName}`);
                return loadContent();
            })
            .catch(error => {
                console.error('Error loading test screen:', error);
                testContainer.empty();
            });
    }

    $('.homeButton').click(() => {
        $('#landing-tab').removeClass('hidden');
        $('#game-container .test-screen').addClass('hidden');
    });

    $('.game-card a').click(function (e) {
        e.preventDefault();
        const screenName = $(this).attr('href').substring(1);
        loadTestScreen(screenName);
    });

    function handlePopState(event) {
        const screenName = event.state ? event.state.screenName : '';
        if (screenName) {
            loadTestScreen(screenName);
        } else {
            $('#landing-tab').removeClass('hidden');
            $('#game-container .test-screen').addClass('hidden');
        }
    }

    window.addEventListener('popstate', handlePopState);

    const initialHash = window.location.hash.substring(1);
    if (initialHash) {
        history.replaceState({screenName: initialHash}, '', `#${initialHash}`);
        handlePopState({state: {screenName: initialHash}});
    } else {
        history.replaceState({}, '', '#');
    }
});

