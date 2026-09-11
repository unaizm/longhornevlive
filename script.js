const tabs = document.querySelectorAll(".tab");
const panelTabs = document.querySelectorAll("[data-tab]");
const panels = document.querySelectorAll(".panel");

function showPanel(id) {
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === id);
  });

  tabs.forEach((tab) => {
    const group = (tab.dataset.tabGroup || "").split(" ").filter(Boolean);
    tab.classList.toggle("active", tab.dataset.tab === id || group.includes(id));
  });
}

panelTabs.forEach((tab) => {
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    const id = tab.dataset.tab;
    showPanel(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  });
});

const initialPanel = location.hash.replace("#", "");

if (initialPanel && document.getElementById(initialPanel)) {
  showPanel(initialPanel);
}
