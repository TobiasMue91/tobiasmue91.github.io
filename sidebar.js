window.addEventListener('load', function (event) {
  var xhr = new XMLHttpRequest();
  const getCurrentScriptPath = (function() {
    const script = Array.from(document.scripts).find(s => s.src.includes('sidebar.js'));
    return script ? new URL(script.src).pathname.replace(/\/[^/]+$/, '') : null;
  })();

  const sidebarPath = getCurrentScriptPath + "/sidebar.html";
  xhr.open("GET", sidebarPath, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var sidebar = document.createElement("div");
      sidebar.innerHTML = xhr.responseText;
      document.body.appendChild(sidebar);
      initSidebarSearch();
      addSidebarButton();
    }
  };
  xhr.send();
});

let currentScript = document.currentScript;

function initSidebarSearch() {
  const searchInput = document.getElementById('search-input');
  const gamesList = document.getElementById('games-list');
  const toolsList = document.getElementById('tools-list');

  searchInput.addEventListener('keyup', (event) => {
    const searchTerm = event.target.value.toLowerCase();
    filterList(gamesList, searchTerm);
    filterList(toolsList, searchTerm);
  });

  function filterList(list, searchTerm) {
    const items = list.getElementsByTagName('li');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = item.textContent.toLowerCase();
      if (text.includes(searchTerm) || !searchTerm) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    }
  }
}

function addSidebarButton() {
  let position = currentScript.getAttribute('data-position') || 'top-left';

  var toggleButton = document.createElement("button");
  toggleButton.id = "sidebar-toggle";
  toggleButton.classList.add(position);
  toggleButton.innerHTML = '☰';
  toggleButton.style.display = "inline-block";
  toggleButton.style.position = "fixed";
  if (position === 'top-left') {
    toggleButton.style.left = "10px";
    toggleButton.style.top = "10px";
  } else if (position === 'top-right') {
    toggleButton.style.right = "10px";
    toggleButton.style.top = "10px";
  } else if (position === 'bottom-right') {
    toggleButton.style.right = "10px";
    toggleButton.style.bottom = "10px";
  }
  toggleButton.style.border = 'none';
  toggleButton.style.color = 'white';
  toggleButton.style.padding = '7px 12px';
  toggleButton.style.textAlign = 'center';
  toggleButton.style.textDecoration = 'none';
  toggleButton.style.fontSize = '14px';
  toggleButton.style.margin = '4px 2px';
  toggleButton.style.width = '37px';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.borderRadius = '3px';
  toggleButton.style.background = '#2b592c';

  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", toggleSidebar);
}

function toggleSidebar() {
  var sidebar = document.querySelector(".sidebar");
  sidebar.style.display = (sidebar.style.display === "block") ? "none" : "block";
  document.getElementById('search-input').focus();
}