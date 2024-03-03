document.addEventListener('DOMContentLoaded', function() {
    const DARK_MODE_CLASS = 'auto-dark-mode';
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    function applyDarkModeTransformations() {
        const bodyStyles = document.body.style;

        document.documentElement.classList.add(DARK_MODE_CLASS);

        bodyStyles.filter = 'invert(0.90) hue-rotate(180deg)';
        bodyStyles.backgroundColor = '#121212';

        const mediaElements = document.querySelectorAll('img, video, iframe');
        mediaElements.forEach(el => {
            el.style.filter = 'invert(0.95) hue-rotate(180deg)';
        });
    }

    function removeDarkModeTransformations() {
        document.documentElement.classList.remove(DARK_MODE_CLASS);
        document.body.style.filter = '';
        document.body.style.backgroundColor = '';
        document.querySelectorAll('img, video, iframe').forEach(el => {
            el.style.filter = '';
        });
    }

    if (prefersDarkMode) {
        applyDarkModeTransformations();
    } else {
        removeDarkModeTransformations();
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            applyDarkModeTransformations();
        } else {
            removeDarkModeTransformations();
        }
    });
});
