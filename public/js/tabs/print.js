let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
}

const printTab = {
  key: 'print',
  init,
  onActivate() {
    init();
  },
  onRegister() {
    init();
  },
};

export default printTab;
