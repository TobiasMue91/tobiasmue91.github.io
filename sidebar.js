window.onload = function (event) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/sidebar.html", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var sidebar = document.createElement("div");
      sidebar.innerHTML = xhr.responseText;
      document.body.appendChild(sidebar);
      addSidebarButton();
    }
  };
  xhr.send();
};

function addSidebarButton() {
  var toggleButton = document.createElement("button");
  toggleButton.innerHTML = "Toggle Sidebar";
  toggleButton.style.display = "block";
  toggleButton.style.position = "fixed";
  toggleButton.style.right = "10px";
  toggleButton.style.top = "10px";

  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", toggleSidebar);
}

function toggleSidebar() {
  var sidebar = document.querySelector(".sidebar");
  sidebar.style.display = (sidebar.style.display === "block") ? "none" : "block";
}