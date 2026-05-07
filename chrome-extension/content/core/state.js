window.XHS = window.XHS || {};

window.XHS.state = {
  stopRequested: false,
  currentStep: 'idle',
  currentKeyword: '',
  config: null,

  resetForKeyword(keyword, config) {
    this.stopRequested = false;
    this.currentKeyword = keyword;
    this.currentStep = 'searching';
    this.config = config;
  }
};
