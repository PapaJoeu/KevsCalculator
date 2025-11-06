let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
}

const warningsTab = {
  key: 'warnings',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default warningsTab;
