(() => {
  if (new URLSearchParams(location.search).get('studioTest') !== '1') return;

  try {
    const draft = JSON.parse(localStorage.getItem('mini3d-studio-gui-v1') || 'null');
    if (typeof draft?.generatedCss !== 'string' || !draft.generatedCss.trim()) return;

    const style = document.createElement('style');
    style.id = 'mini3d-studio-gui-test';
    style.textContent = draft.generatedCss;
    document.head.appendChild(style);
    document.documentElement.dataset.studioGuiTest = '1';
  } catch (error) {
    console.warn('Studio GUI test draft unavailable', error);
  }
})();
