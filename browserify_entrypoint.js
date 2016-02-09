var riot = require('riot');
var majax = require('marmottajax');

// 3-rd party
require('prismjs');

// app.tag shows the menu and sets up routing for each page
require('./tags/app.tag');

// In this app, a "page" is a simply a riot tag with 
// HTML to display as a page. 
// All "pages" are stored in the ./pages dir and 
// are named "-page.tag". These are arbitrary
// decisions that are not defined by riot.

// These are the "page" tags.
require('./pages/overview-page.tag');
require('./pages/simple-page.tag');
require('./pages/boilerplate-page.tag');
require('./pages/routing-page.tag');
require('./pages/raw-page.tag');
require('./pages/interactive-page.tag');

// These are example tags. View each file for more information.
require('./tags/simple.tag');
require('./tags/boilerplate.tag');
require('./tags/raw.tag');

// these are support tags, built specifically for this app
require('./support-tags/menu.tag');
require('./support-tags/code-display.tag');
require('./support-tags/code-embed.tag');

riot.mount('app');
