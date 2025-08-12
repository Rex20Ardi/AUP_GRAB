// Shared Info Modal Handlers
(function(){
  function openInfo() {
    const m = document.getElementById('infoModal');
    if (m) m.style.display = 'flex';
    document.addEventListener('keydown', escCloseInfo);
  }
  function closeInfo() {
    const m = document.getElementById('infoModal');
    if (m) m.style.display = 'none';
    document.removeEventListener('keydown', escCloseInfo);
  }
  function escCloseInfo(e) { if (e.key === 'Escape') closeInfo(); }
  function overlayClick(e) { if (e.target && e.target.id === 'infoModal') closeInfo(); }

  // expose globally
  window.openInfo = openInfo;
  window.closeInfo = closeInfo;
  window.overlayClick = overlayClick;
})();
