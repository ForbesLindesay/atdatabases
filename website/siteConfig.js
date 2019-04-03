/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// See https://docusaurus.io/docs/site-config for all the possible
// site configuration options.

// List of projects/orgs using your project for the users page.
const users = [
  {
    caption: 'Canoe Slalom Entries',
    image: 'https://www.canoeslalomentries.co.uk/favicon.ico',
    infoLink: 'https://www.canoeslalomentries.co.uk',
    pinned: true,
  },
  {
    caption: 'Save Willpower',
    image: '/img/users/savewillpower.svg',
    infoLink: 'https://savewillpower.com/',
    pinned: true,
  },
  {
    caption: 'Threads',
    image: '/img/users/threads.jpg',
    infoLink: 'https://www.threadsstyling.com/careers',
    pinned: true,
  },
  {
    caption: 'Jepso',
    image: '/img/users/jepso.svg',
    infoLink: 'https://www.jepso.com/',
    pinned: true,
  },
];

const siteConfig = {
  title: '@Databases', // Title for your website.
  tagline: 'Database libraries for Node.js that protect you from SQL Injection',
  url: 'https://www.atdatabases.org', // Your website URL
  baseUrl: '/', // Base URL for your project */
  // For github.io type URLs, you would set the url and baseUrl like:
  //   url: 'https://facebook.github.io',
  //   baseUrl: '/test-site/',

  // Used for publishing and more
  projectName: 'atdatabases',
  organizationName: 'ForbesLindesay',
  // For top-level user or org sites, the organization is still the same.
  // e.g., for the https://JoelMarcey.github.io site, it would be set like...
  //   organizationName: 'JoelMarcey'

  // For no header links in the top nav bar -> headerLinks: [],
  headerLinks: [
    {doc: 'sql', label: 'Documentation'},
    // {page: 'help', label: 'Help'},
    // {blog: true, label: 'Blog'},
  ],

  // If you have users set above, you add it here:
  users,

  /* path to images for header/footer */
  headerIcon: 'img/word-mark.svg',
  footerIcon: 'img/logo-white.svg',
  favicon: 'img/favicon.png',

  /* Colors for website */
  colors: {
    primaryColor: '#FA2B3A',
    secondaryColor: '#FA2B3A',
  },

  /* Custom fonts for website */
  /*
  fonts: {
    myFont: [
      "Times New Roman",
      "Serif"
    ],
    myOtherFont: [
      "-apple-system",
      "system-ui"
    ]
  },
  */

  // This copyright info is used in /core/Footer.js and blog RSS/Atom feeds.
  copyright: `Copyright © ${new Date().getFullYear()} ForbesLindesay`,

  highlight: {
    // Highlight.js theme to use for syntax highlighting in code blocks.
    theme: 'default',
  },

  // Add custom scripts here that would be placed in <script> tags.
  scripts: ['https://buttons.github.io/buttons.js'],

  // On page navigation for the current documentation page.
  onPageNav: 'separate',
  // No .html extensions for paths.
  cleanUrl: true,

  // Open Graph and Twitter card images.
  ogImage: 'img/favicon.png',
  twitterImage: 'img/favicon.png',

  // Show documentation's last contributor's name.
  // enableUpdateBy: true,

  // Show documentation's last update time.
  // enableUpdateTime: true,

  // You may provide arbitrary config keys to be used as needed by your
  // template. For example, if you need your repo's URL...
  repoUrl: 'https://github.com/ForbesLindesay/atdatabases',

  gaTrackingId: 'UA-31798041-12',
};

module.exports = siteConfig;
