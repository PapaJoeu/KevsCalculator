let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
}

const finishingTab = {
  key: 'finishing',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default finishingTab;
