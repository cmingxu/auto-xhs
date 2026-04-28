window.XHS = window.XHS || {};

window.XHS.state = {
  stopRequested: false,
  stats: { viewedPosts: 0, scrolledComments: 0, followedAuthors: 0, commentsPosted: 0 },
  currentStep: 'idle',
  currentKeyword: '',
  config: null,

  resetForKeyword(keyword, config) {
    this.stopRequested = false;
    this.stats = { viewedPosts: 0, scrolledComments: 0, followedAuthors: 0, commentsPosted: 0 };
    this.currentKeyword = keyword;
    this.currentStep = 'searching';
    this.config = config;
  }
};
