// Runs before the page draws so the saved colour mode never flashes the wrong way.
try { var t = localStorage.getItem("rd.mode"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
