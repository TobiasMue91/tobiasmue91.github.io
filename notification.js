function loadScript(url, callback) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

function loadStylesheet(url) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
}

function getCurrentScriptPath() {
    const script = Array.from(document.scripts).find(s => s.src.includes('notification.js'));
    return script ? new URL(script.src).pathname.replace(/\/[^/]+$/, '') : null;
}

document.addEventListener('DOMContentLoaded', function() {
    loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css');
    loadStylesheet(getCurrentScriptPath() + '/notification.css');

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.3/jquery.min.js', function() {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js', function() {
            // Configure toastr options
            toastr.options = {
                closeButton: true,
                debug: false,
                newestOnTop: false,
                progressBar: true,
                positionClass: 'toast-custom-bottom-center',
                preventDuplicates: false,
                onclick: null,
                showDuration: '300',
                hideDuration: '10000',
                timeOut: '20000',
                extendedTimeOut: '2000',
                showEasing: 'swing',
                hideEasing: 'linear',
                showMethod: 'fadeIn',
                hideMethod: 'fadeOut',
            };

            // Display the notification
            toastr.warning('Due to hitting the rate limit for the OpenAI API, our AI powered tools are temporarily unavailable. We are working on a solution. We apologize for any inconvenience.');
        });
    });
});