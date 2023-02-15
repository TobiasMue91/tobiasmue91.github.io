window.addEventListener('load', function (event) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/gptgames/sidebar.html", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var sidebar = document.createElement("div");
      sidebar.innerHTML = xhr.responseText;
      document.body.appendChild(sidebar);
      addSidebarButton();
    }
  };
  xhr.send();
});

let currentScript = document.currentScript;

function addSidebarButton() {
  let position = currentScript.getAttribute('data-position') || 'top-left';

  var toggleButton = document.createElement("button");
  toggleButton.id = "sidebar-toggle";
  toggleButton.classList.add(position);
  toggleButton.innerHTML = "Toggle Sidebar";
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
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.borderRadius = '3px';
  toggleButton.style.background = '#4CAF50';

  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", toggleSidebar);
}

function toggleSidebar() {
  var sidebar = document.querySelector(".sidebar");
  sidebar.style.display = (sidebar.style.display === "block") ? "none" : "block";
}