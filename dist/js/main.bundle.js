(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var riot = require('riot');
window.riot = riot;

require('riotgear');
require('./tags/raw.tag');
require('./tags/app.tag');

riot.mount('app');
 
},{"./tags/app.tag":5,"./tags/raw.tag":6,"riot":2,"riotgear":4}],2:[function(require,module,exports){
/* Riot v2.3.13, @license MIT, (c) 2015 Muut Inc. + contributors */

;(function(window, undefined) {
  'use strict';
var riot = { version: 'v2.3.13', settings: {} },
  // be aware, internal usage
  // ATTENTION: prefix the global dynamic variables with `__`

  // counter to give a unique id to all the Tag instances
  __uid = 0,
  // tags instances cache
  __virtualDom = [],
  // tags implementation cache
  __tagImpl = {},

  /**
   * Const
   */
  // riot specific prefixes
  RIOT_PREFIX = 'riot-',
  RIOT_TAG = RIOT_PREFIX + 'tag',

  // for typeof == '' comparisons
  T_STRING = 'string',
  T_OBJECT = 'object',
  T_UNDEF  = 'undefined',
  T_FUNCTION = 'function',
  // special native tags that cannot be treated like the others
  SPECIAL_TAGS_REGEX = /^(?:opt(ion|group)|tbody|col|t[rhd])$/,
  RESERVED_WORDS_BLACKLIST = ['_item', '_id', '_parent', 'update', 'root', 'mount', 'unmount', 'mixin', 'isMounted', 'isLoop', 'tags', 'parent', 'opts', 'trigger', 'on', 'off', 'one'],

  // version# for IE 8-11, 0 for others
  IE_VERSION = (window && window.document || {}).documentMode | 0
/* istanbul ignore next */
riot.observable = function(el) {

  /**
   * Extend the original object or create a new empty one
   * @type { Object }
   */

  el = el || {}

  /**
   * Private variables and methods
   */
  var callbacks = {},
    slice = Array.prototype.slice,
    onEachEvent = function(e, fn) { e.replace(/\S+/g, fn) },
    defineProperty = function (key, value) {
      Object.defineProperty(el, key, {
        value: value,
        enumerable: false,
        writable: false,
        configurable: false
      })
    }

  /**
   * Listen to the given space separated list of `events` and execute the `callback` each time an event is triggered.
   * @param  { String } events - events ids
   * @param  { Function } fn - callback function
   * @returns { Object } el
   */
  defineProperty('on', function(events, fn) {
    if (typeof fn != 'function')  return el

    onEachEvent(events, function(name, pos) {
      (callbacks[name] = callbacks[name] || []).push(fn)
      fn.typed = pos > 0
    })

    return el
  })

  /**
   * Removes the given space separated list of `events` listeners
   * @param   { String } events - events ids
   * @param   { Function } fn - callback function
   * @returns { Object } el
   */
  defineProperty('off', function(events, fn) {
    if (events == '*' && !fn) callbacks = {}
    else {
      onEachEvent(events, function(name) {
        if (fn) {
          var arr = callbacks[name]
          for (var i = 0, cb; cb = arr && arr[i]; ++i) {
            if (cb == fn) arr.splice(i--, 1)
          }
        } else delete callbacks[name]
      })
    }
    return el
  })

  /**
   * Listen to the given space separated list of `events` and execute the `callback` at most once
   * @param   { String } events - events ids
   * @param   { Function } fn - callback function
   * @returns { Object } el
   */
  defineProperty('one', function(events, fn) {
    function on() {
      el.off(events, on)
      fn.apply(el, arguments)
    }
    return el.on(events, on)
  })

  /**
   * Execute all callback functions that listen to the given space separated list of `events`
   * @param   { String } events - events ids
   * @returns { Object } el
   */
  defineProperty('trigger', function(events) {

    // getting the arguments
    // skipping the first one
    var args = slice.call(arguments, 1),
      fns

    onEachEvent(events, function(name) {

      fns = slice.call(callbacks[name] || [], 0)

      for (var i = 0, fn; fn = fns[i]; ++i) {
        if (fn.busy) return
        fn.busy = 1
        fn.apply(el, fn.typed ? [name].concat(args) : args)
        if (fns[i] !== fn) { i-- }
        fn.busy = 0
      }

      if (callbacks['*'] && name != '*')
        el.trigger.apply(el, ['*', name].concat(args))

    })

    return el
  })

  return el

}
/* istanbul ignore next */
;(function(riot) {

/**
 * Simple client-side router
 * @module riot-route
 */


var RE_ORIGIN = /^.+?\/+[^\/]+/,
  EVENT_LISTENER = 'EventListener',
  REMOVE_EVENT_LISTENER = 'remove' + EVENT_LISTENER,
  ADD_EVENT_LISTENER = 'add' + EVENT_LISTENER,
  HAS_ATTRIBUTE = 'hasAttribute',
  REPLACE = 'replace',
  POPSTATE = 'popstate',
  HASHCHANGE = 'hashchange',
  TRIGGER = 'trigger',
  MAX_EMIT_STACK_LEVEL = 3,
  win = typeof window != 'undefined' && window,
  doc = typeof document != 'undefined' && document,
  hist = win && history,
  loc = win && (hist.location || win.location), // see html5-history-api
  prot = Router.prototype, // to minify more
  clickEvent = doc && doc.ontouchstart ? 'touchstart' : 'click',
  started = false,
  central = riot.observable(),
  routeFound = false,
  debouncedEmit,
  base, current, parser, secondParser, emitStack = [], emitStackLevel = 0

/**
 * Default parser. You can replace it via router.parser method.
 * @param {string} path - current path (normalized)
 * @returns {array} array
 */
function DEFAULT_PARSER(path) {
  return path.split(/[/?#]/)
}

/**
 * Default parser (second). You can replace it via router.parser method.
 * @param {string} path - current path (normalized)
 * @param {string} filter - filter string (normalized)
 * @returns {array} array
 */
function DEFAULT_SECOND_PARSER(path, filter) {
  var re = new RegExp('^' + filter[REPLACE](/\*/g, '([^/?#]+?)')[REPLACE](/\.\./, '.*') + '$'),
    args = path.match(re)

  if (args) return args.slice(1)
}

/**
 * Simple/cheap debounce implementation
 * @param   {function} fn - callback
 * @param   {number} delay - delay in seconds
 * @returns {function} debounced function
 */
function debounce(fn, delay) {
  var t
  return function () {
    clearTimeout(t)
    t = setTimeout(fn, delay)
  }
}

/**
 * Set the window listeners to trigger the routes
 * @param {boolean} autoExec - see route.start
 */
function start(autoExec) {
  debouncedEmit = debounce(emit, 1)
  win[ADD_EVENT_LISTENER](POPSTATE, debouncedEmit)
  win[ADD_EVENT_LISTENER](HASHCHANGE, debouncedEmit)
  doc[ADD_EVENT_LISTENER](clickEvent, click)
  if (autoExec) emit(true)
}

/**
 * Router class
 */
function Router() {
  this.$ = []
  riot.observable(this) // make it observable
  central.on('stop', this.s.bind(this))
  central.on('emit', this.e.bind(this))
}

function normalize(path) {
  return path[REPLACE](/^\/|\/$/, '')
}

function isString(str) {
  return typeof str == 'string'
}

/**
 * Get the part after domain name
 * @param {string} href - fullpath
 * @returns {string} path from root
 */
function getPathFromRoot(href) {
  return (href || loc.href || '')[REPLACE](RE_ORIGIN, '')
}

/**
 * Get the part after base
 * @param {string} href - fullpath
 * @returns {string} path from base
 */
function getPathFromBase(href) {
  return base[0] == '#'
    ? (href || loc.href || '').split(base)[1] || ''
    : getPathFromRoot(href)[REPLACE](base, '')
}

function emit(force) {
  // the stack is needed for redirections
  var isRoot = emitStackLevel == 0
  if (MAX_EMIT_STACK_LEVEL <= emitStackLevel) return

  emitStackLevel++
  emitStack.push(function() {
    var path = getPathFromBase()
    if (force || path != current) {
      central[TRIGGER]('emit', path)
      current = path
    }
  })
  if (isRoot) {
    while (emitStack.length) {
      emitStack[0]()
      emitStack.shift()
    }
    emitStackLevel = 0
  }
}

function click(e) {
  if (
    e.which != 1 // not left click
    || e.metaKey || e.ctrlKey || e.shiftKey // or meta keys
    || e.defaultPrevented // or default prevented
  ) return

  var el = e.target
  while (el && el.nodeName != 'A') el = el.parentNode
  if (
    !el || el.nodeName != 'A' // not A tag
    || el[HAS_ATTRIBUTE]('download') // has download attr
    || !el[HAS_ATTRIBUTE]('href') // has no href attr
    || el.target && el.target != '_self' // another window or frame
    || el.href.indexOf(loc.href.match(RE_ORIGIN)[0]) == -1 // cross origin
  ) return

  if (el.href != loc.href) {
    if (
      el.href.split('#')[0] == loc.href.split('#')[0] // internal jump
      || base != '#' && getPathFromRoot(el.href).indexOf(base) !== 0 // outside of base
      || !go(getPathFromBase(el.href), el.title || doc.title) // route not found
    ) return
  }

  e.preventDefault()
}

/**
 * Go to the path
 * @param {string} path - destination path
 * @param {string} title - page title
 * @param {boolean} shouldReplace - use replaceState or pushState
 * @returns {boolean} - route not found flag
 */
function go(path, title, shouldReplace) {
  if (hist) { // if a browser
    path = base + normalize(path)
    title = title || doc.title
    // browsers ignores the second parameter `title`
    shouldReplace
      ? hist.replaceState(null, title, path)
      : hist.pushState(null, title, path)
    // so we need to set it manually
    doc.title = title
    routeFound = false
    emit()
    return routeFound
  }

  // Server-side usage: directly execute handlers for the path
  return central[TRIGGER]('emit', getPathFromBase(path))
}

/**
 * Go to path or set action
 * a single string:                go there
 * two strings:                    go there with setting a title
 * two strings and boolean:        replace history with setting a title
 * a single function:              set an action on the default route
 * a string/RegExp and a function: set an action on the route
 * @param {(string|function)} first - path / action / filter
 * @param {(string|RegExp|function)} second - title / action
 * @param {boolean} third - replace flag
 */
prot.m = function(first, second, third) {
  if (isString(first) && (!second || isString(second))) go(first, second, third || false)
  else if (second) this.r(first, second)
  else this.r('@', first)
}

/**
 * Stop routing
 */
prot.s = function() {
  this.off('*')
  this.$ = []
}

/**
 * Emit
 * @param {string} path - path
 */
prot.e = function(path) {
  this.$.concat('@').some(function(filter) {
    var args = (filter == '@' ? parser : secondParser)(normalize(path), normalize(filter))
    if (typeof args != 'undefined') {
      this[TRIGGER].apply(null, [filter].concat(args))
      return routeFound = true // exit from loop
    }
  }, this)
}

/**
 * Register route
 * @param {string} filter - filter for matching to url
 * @param {function} action - action to register
 */
prot.r = function(filter, action) {
  if (filter != '@') {
    filter = '/' + normalize(filter)
    this.$.push(filter)
  }
  this.on(filter, action)
}

var mainRouter = new Router()
var route = mainRouter.m.bind(mainRouter)

/**
 * Create a sub router
 * @returns {function} the method of a new Router object
 */
route.create = function() {
  var newSubRouter = new Router()
  // stop only this sub-router
  newSubRouter.m.stop = newSubRouter.s.bind(newSubRouter)
  // return sub-router's main method
  return newSubRouter.m.bind(newSubRouter)
}

/**
 * Set the base of url
 * @param {(str|RegExp)} arg - a new base or '#' or '#!'
 */
route.base = function(arg) {
  base = arg || '#'
  current = getPathFromBase() // recalculate current path
}

/** Exec routing right now **/
route.exec = function() {
  emit(true)
}

/**
 * Replace the default router to yours
 * @param {function} fn - your parser function
 * @param {function} fn2 - your secondParser function
 */
route.parser = function(fn, fn2) {
  if (!fn && !fn2) {
    // reset parser for testing...
    parser = DEFAULT_PARSER
    secondParser = DEFAULT_SECOND_PARSER
  }
  if (fn) parser = fn
  if (fn2) secondParser = fn2
}

/**
 * Helper function to get url query as an object
 * @returns {object} parsed query
 */
route.query = function() {
  var q = {}
  var href = loc.href || current
  href[REPLACE](/[?&](.+?)=([^&]*)/g, function(_, k, v) { q[k] = v })
  return q
}

/** Stop routing **/
route.stop = function () {
  if (started) {
    if (win) {
      win[REMOVE_EVENT_LISTENER](POPSTATE, debouncedEmit)
      win[REMOVE_EVENT_LISTENER](HASHCHANGE, debouncedEmit)
      doc[REMOVE_EVENT_LISTENER](clickEvent, click)
    }
    central[TRIGGER]('stop')
    started = false
  }
}

/**
 * Start routing
 * @param {boolean} autoExec - automatically exec after starting if true
 */
route.start = function (autoExec) {
  if (!started) {
    if (win) {
      if (document.readyState == 'complete') start(autoExec)
      // the timeout is needed to solve
      // a weird safari bug https://github.com/riot/route/issues/33
      else win[ADD_EVENT_LISTENER]('load', function() {
        setTimeout(function() { start(autoExec) }, 1)
      })
    }
    started = true
  }
}

/** Prepare the router **/
route.base()
route.parser()

riot.route = route
})(riot)
/* istanbul ignore next */

/**
 * The riot template engine
 * @version v2.3.20
 */

/**
 * @module brackets
 *
 * `brackets         ` Returns a string or regex based on its parameter
 * `brackets.settings` Mirrors the `riot.settings` object (use brackets.set in new code)
 * `brackets.set     ` Change the current riot brackets
 */
/*global riot */

var brackets = (function (UNDEF) {

  var
    REGLOB  = 'g',

    MLCOMMS = /\/\*[^*]*\*+(?:[^*\/][^*]*\*+)*\//g,
    STRINGS = /"[^"\\]*(?:\\[\S\s][^"\\]*)*"|'[^'\\]*(?:\\[\S\s][^'\\]*)*'/g,

    S_QBSRC = STRINGS.source + '|' +
      /(?:\breturn\s+|(?:[$\w\)\]]|\+\+|--)\s*(\/)(?![*\/]))/.source + '|' +
      /\/(?=[^*\/])[^[\/\\]*(?:(?:\[(?:\\.|[^\]\\]*)*\]|\\.)[^[\/\\]*)*?(\/)[gim]*/.source,

    DEFAULT = '{ }',

    FINDBRACES = {
      '(': RegExp('([()])|'   + S_QBSRC, REGLOB),
      '[': RegExp('([[\\]])|' + S_QBSRC, REGLOB),
      '{': RegExp('([{}])|'   + S_QBSRC, REGLOB)
    }

  var
    cachedBrackets = UNDEF,
    _regex,
    _pairs = []

  function _loopback (re) { return re }

  function _rewrite (re, bp) {
    if (!bp) bp = _pairs
    return new RegExp(
      re.source.replace(/{/g, bp[2]).replace(/}/g, bp[3]), re.global ? REGLOB : ''
    )
  }

  function _create (pair) {
    var
      cvt,
      arr = pair.split(' ')

    if (pair === DEFAULT) {
      arr[2] = arr[0]
      arr[3] = arr[1]
      cvt = _loopback
    }
    else {
      if (arr.length !== 2 || /[\x00-\x1F<>a-zA-Z0-9'",;\\]/.test(pair)) {
        throw new Error('Unsupported brackets "' + pair + '"')
      }
      arr = arr.concat(pair.replace(/(?=[[\]()*+?.^$|])/g, '\\').split(' '))
      cvt = _rewrite
    }
    arr[4] = cvt(arr[1].length > 1 ? /{[\S\s]*?}/ : /{[^}]*}/, arr)
    arr[5] = cvt(/\\({|})/g, arr)
    arr[6] = cvt(/(\\?)({)/g, arr)
    arr[7] = RegExp('(\\\\?)(?:([[({])|(' + arr[3] + '))|' + S_QBSRC, REGLOB)
    arr[8] = pair
    return arr
  }

  function _reset (pair) {
    if (!pair) pair = DEFAULT

    if (pair !== _pairs[8]) {
      _pairs = _create(pair)
      _regex = pair === DEFAULT ? _loopback : _rewrite
      _pairs[9] = _regex(/^\s*{\^?\s*([$\w]+)(?:\s*,\s*(\S+))?\s+in\s+(\S.*)\s*}/)
      _pairs[10] = _regex(/(^|[^\\]){=[\S\s]*?}/)
      _brackets._rawOffset = _pairs[0].length
    }
    cachedBrackets = pair
  }

  function _brackets (reOrIdx) {
    return reOrIdx instanceof RegExp ? _regex(reOrIdx) : _pairs[reOrIdx]
  }

  _brackets.split = function split (str, tmpl, _bp) {
    // istanbul ignore next: _bp is for the compiler
    if (!_bp) _bp = _pairs

    var
      parts = [],
      match,
      isexpr,
      start,
      pos,
      re = _bp[6]

    isexpr = start = re.lastIndex = 0

    while (match = re.exec(str)) {

      pos = match.index

      if (isexpr) {

        if (match[2]) {
          re.lastIndex = skipBraces(match[2], re.lastIndex)
          continue
        }

        if (!match[3])
          continue
      }

      if (!match[1]) {
        unescapeStr(str.slice(start, pos))
        start = re.lastIndex
        re = _bp[6 + (isexpr ^= 1)]
        re.lastIndex = start
      }
    }

    if (str && start < str.length) {
      unescapeStr(str.slice(start))
    }

    return parts

    function unescapeStr (str) {
      if (tmpl || isexpr)
        parts.push(str && str.replace(_bp[5], '$1'))
      else
        parts.push(str)
    }

    function skipBraces (ch, pos) {
      var
        match,
        recch = FINDBRACES[ch],
        level = 1
      recch.lastIndex = pos

      while (match = recch.exec(str)) {
        if (match[1] &&
          !(match[1] === ch ? ++level : --level)) break
      }
      return match ? recch.lastIndex : str.length
    }
  }

  _brackets.hasExpr = function hasExpr (str) {
    return _brackets(4).test(str)
  }

  _brackets.loopKeys = function loopKeys (expr) {
    var m = expr.match(_brackets(9))
    return m ?
      { key: m[1], pos: m[2], val: _pairs[0] + m[3].trim() + _pairs[1] } : { val: expr.trim() }
  }

  _brackets.array = function array (pair) {
    return _create(pair || cachedBrackets)
  }

  var _settings
  function _setSettings (o) {
    var b
    o = o || {}
    b = o.brackets
    Object.defineProperty(o, 'brackets', {
      set: _reset,
      get: function () { return cachedBrackets },
      enumerable: true
    })
    _settings = o
    _reset(b)
  }
  Object.defineProperty(_brackets, 'settings', {
    set: _setSettings,
    get: function () { return _settings }
  })

  /* istanbul ignore next: in the node version riot is not in the scope */
  _brackets.settings = typeof riot !== 'undefined' && riot.settings || {}
  _brackets.set = _reset

  _brackets.R_STRINGS = STRINGS
  _brackets.R_MLCOMMS = MLCOMMS
  _brackets.S_QBLOCKS = S_QBSRC

  return _brackets

})()

/**
 * @module tmpl
 *
 * tmpl          - Root function, returns the template value, render with data
 * tmpl.hasExpr  - Test the existence of a expression inside a string
 * tmpl.loopKeys - Get the keys for an 'each' loop (used by `_each`)
 */
/*global riot */

var tmpl = (function () {

  var _cache = {}

  function _tmpl (str, data) {
    if (!str) return str

    return (_cache[str] || (_cache[str] = _create(str))).call(data, _logErr)
  }

  _tmpl.isRaw = function (expr) {
    return expr[brackets._rawOffset] === '='
  }

  _tmpl.haveRaw = function (src) {
    return brackets(10).test(src)
  }

  _tmpl.hasExpr = brackets.hasExpr

  _tmpl.loopKeys = brackets.loopKeys

  _tmpl.errorHandler = null

  function _logErr (err, ctx) {

    if (_tmpl.errorHandler) {

      err.riotData = {
        tagName: ctx && ctx.root && ctx.root.tagName,
        _riot_id: ctx && ctx._riot_id  //eslint-disable-line camelcase
      }
      _tmpl.errorHandler(err)
    }
  }

  function _create (str) {

    var expr = _getTmpl(str)
    if (expr.slice(0, 11) !== 'try{return ') expr = 'return ' + expr

    return new Function('E', expr + ';')
  }

  var
    RE_QBLOCK = RegExp(brackets.S_QBLOCKS, 'g'),
    RE_QBMARK = /\x01(\d+)~/g

  function _getTmpl (str) {
    var
      qstr = [],
      expr,
      parts = brackets.split(str.replace(/\u2057/g, '"'), 1)

    if (parts.length > 2 || parts[0]) {
      var i, j, list = []

      for (i = j = 0; i < parts.length; ++i) {

        expr = parts[i]

        if (expr && (expr = i & 1 ?

              _parseExpr(expr, 1, qstr) :

              '"' + expr
                .replace(/\\/g, '\\\\')
                .replace(/\r\n?|\n/g, '\\n')
                .replace(/"/g, '\\"') +
              '"'

          )) list[j++] = expr

      }

      expr = j < 2 ? list[0] :
             '[' + list.join(',') + '].join("")'
    }
    else {

      expr = _parseExpr(parts[1], 0, qstr)
    }

    if (qstr[0])
      expr = expr.replace(RE_QBMARK, function (_, pos) {
        return qstr[pos]
          .replace(/\r/g, '\\r')
          .replace(/\n/g, '\\n')
      })

    return expr
  }

  var
    CS_IDENT = /^(?:(-?[_A-Za-z\xA0-\xFF][-\w\xA0-\xFF]*)|\x01(\d+)~):/

  function _parseExpr (expr, asText, qstr) {

    if (expr[0] === '=') expr = expr.slice(1)

    expr = expr
          .replace(RE_QBLOCK, function (s, div) {
            return s.length > 2 && !div ? '\x01' + (qstr.push(s) - 1) + '~' : s
          })
          .replace(/\s+/g, ' ').trim()
          .replace(/\ ?([[\({},?\.:])\ ?/g, '$1')

    if (expr) {
      var
        list = [],
        cnt = 0,
        match

      while (expr &&
            (match = expr.match(CS_IDENT)) &&
            !match.index
        ) {
        var
          key,
          jsb,
          re = /,|([[{(])|$/g

        expr = RegExp.rightContext
        key  = match[2] ? qstr[match[2]].slice(1, -1).trim().replace(/\s+/g, ' ') : match[1]

        while (jsb = (match = re.exec(expr))[1]) skipBraces(jsb, re)

        jsb  = expr.slice(0, match.index)
        expr = RegExp.rightContext

        list[cnt++] = _wrapExpr(jsb, 1, key)
      }

      expr = !cnt ? _wrapExpr(expr, asText) :
          cnt > 1 ? '[' + list.join(',') + '].join(" ").trim()' : list[0]
    }
    return expr

    function skipBraces (jsb, re) {
      var
        match,
        lv = 1,
        ir = jsb === '(' ? /[()]/g : jsb === '[' ? /[[\]]/g : /[{}]/g

      ir.lastIndex = re.lastIndex
      while (match = ir.exec(expr)) {
        if (match[0] === jsb) ++lv
        else if (!--lv) break
      }
      re.lastIndex = lv ? expr.length : ir.lastIndex
    }
  }

  // istanbul ignore next: not both
  var
    JS_CONTEXT = '"in this?this:' + (typeof window !== 'object' ? 'global' : 'window') + ').',
    JS_VARNAME = /[,{][$\w]+:|(^ *|[^$\w\.])(?!(?:typeof|true|false|null|undefined|in|instanceof|is(?:Finite|NaN)|void|NaN|new|Date|RegExp|Math)(?![$\w]))([$_A-Za-z][$\w]*)/g,
    JS_NOPROPS = /^(?=(\.[$\w]+))\1(?:[^.[(]|$)/

  function _wrapExpr (expr, asText, key) {
    var tb

    expr = expr.replace(JS_VARNAME, function (match, p, mvar, pos, s) {
      if (mvar) {
        pos = tb ? 0 : pos + match.length

        if (mvar !== 'this' && mvar !== 'global' && mvar !== 'window') {
          match = p + '("' + mvar + JS_CONTEXT + mvar
          if (pos) tb = (s = s[pos]) === '.' || s === '(' || s === '['
        }
        else if (pos) {
          tb = !JS_NOPROPS.test(s.slice(pos))
        }
      }
      return match
    })

    if (tb) {
      expr = 'try{return ' + expr + '}catch(e){E(e,this)}'
    }

    if (key) {

      expr = (tb ?
          'function(){' + expr + '}.call(this)' : '(' + expr + ')'
        ) + '?"' + key + '":""'
    }
    else if (asText) {

      expr = 'function(v){' + (tb ?
          expr.replace('return ', 'v=') : 'v=(' + expr + ')'
        ) + ';return v||v===0?v:""}.call(this)'
    }

    return expr
  }

  // istanbul ignore next: compatibility fix for beta versions
  _tmpl.parse = function (s) { return s }

  return _tmpl

})()

  tmpl.version = brackets.version = 'v2.3.20'


/*
  lib/browser/tag/mkdom.js

  Includes hacks needed for the Internet Explorer version 9 and below

*/
// http://kangax.github.io/compat-table/es5/#ie8
// http://codeplanet.io/dropping-ie8/

var mkdom = (function (checkIE) {

  var rootEls = {
      tr: 'tbody',
      th: 'tr',
      td: 'tr',
      tbody: 'table',
      col: 'colgroup'
    },
    reToSrc = /<yield\s+to=(['"])?@\1\s*>([\S\s]+?)<\/yield\s*>/.source,
    GENERIC = 'div'

  checkIE = checkIE && checkIE < 10

  // creates any dom element in a div, table, or colgroup container
  function _mkdom(templ, html) {

    var match = templ && templ.match(/^\s*<([-\w]+)/),
      tagName = match && match[1].toLowerCase(),
      rootTag = rootEls[tagName] || GENERIC,
      el = mkEl(rootTag)

    el.stub = true

    // replace all the yield tags with the tag inner html
    if (html) templ = replaceYield(templ, html)

    /* istanbul ignore next */
    if (checkIE && tagName && (match = tagName.match(SPECIAL_TAGS_REGEX)))
      ie9elem(el, templ, tagName, !!match[1])
    else
      el.innerHTML = templ

    return el
  }

  // creates tr, th, td, option, optgroup element for IE8-9
  /* istanbul ignore next */
  function ie9elem(el, html, tagName, select) {

    var div = mkEl(GENERIC),
      tag = select ? 'select>' : 'table>',
      child

    div.innerHTML = '<' + tag + html + '</' + tag

    child = $(tagName, div)
    if (child)
      el.appendChild(child)

  }
  // end ie9elem()

  /**
   * Replace the yield tag from any tag template with the innerHTML of the
   * original tag in the page
   * @param   { String } templ - tag implementation template
   * @param   { String } html  - original content of the tag in the DOM
   * @returns { String } tag template updated without the yield tag
   */
  function replaceYield(templ, html) {
    // do nothing if no yield
    if (!/<yield\b/i.test(templ)) return templ

    // be careful with #1343 - string on the source having `$1`
    var n = 0
    templ = templ.replace(/<yield\s+from=['"]([-\w]+)['"]\s*(?:\/>|>\s*<\/yield\s*>)/ig,
      function (str, ref) {
        var m = html.match(RegExp(reToSrc.replace('@', ref), 'i'))
        ++n
        return m && m[2] || ''
      })

    // yield without any "from", replace yield in templ with the innerHTML
    return n ? templ : templ.replace(/<yield\s*(?:\/>|>\s*<\/yield\s*>)/gi, html || '')
  }

  return _mkdom

})(IE_VERSION)

/**
 * Convert the item looped into an object used to extend the child tag properties
 * @param   { Object } expr - object containing the keys used to extend the children tags
 * @param   { * } key - value to assign to the new object returned
 * @param   { * } val - value containing the position of the item in the array
 * @returns { Object } - new object containing the values of the original item
 *
 * The variables 'key' and 'val' are arbitrary.
 * They depend on the collection type looped (Array, Object)
 * and on the expression used on the each tag
 *
 */
function mkitem(expr, key, val) {
  var item = {}
  item[expr.key] = key
  if (expr.pos) item[expr.pos] = val
  return item
}

/**
 * Unmount the redundant tags
 * @param   { Array } items - array containing the current items to loop
 * @param   { Array } tags - array containing all the children tags
 */
function unmountRedundant(items, tags) {

  var i = tags.length,
    j = items.length,
    t

  while (i > j) {
    t = tags[--i]
    tags.splice(i, 1)
    t.unmount()
  }
}

/**
 * Move the nested custom tags in non custom loop tags
 * @param   { Object } child - non custom loop tag
 * @param   { Number } i - current position of the loop tag
 */
function moveNestedTags(child, i) {
  Object.keys(child.tags).forEach(function(tagName) {
    var tag = child.tags[tagName]
    if (isArray(tag))
      each(tag, function (t) {
        moveChildTag(t, tagName, i)
      })
    else
      moveChildTag(tag, tagName, i)
  })
}

/**
 * Adds the elements for a virtual tag
 * @param { Tag } tag - the tag whose root's children will be inserted or appended
 * @param { Node } src - the node that will do the inserting or appending
 * @param { Tag } target - only if inserting, insert before this tag's first child
 */
function addVirtual(tag, src, target) {
  var el = tag._root, sib
  tag._virts = []
  while (el) {
    sib = el.nextSibling
    if (target)
      src.insertBefore(el, target._root)
    else
      src.appendChild(el)

    tag._virts.push(el) // hold for unmounting
    el = sib
  }
}

/**
 * Move virtual tag and all child nodes
 * @param { Tag } tag - first child reference used to start move
 * @param { Node } src  - the node that will do the inserting
 * @param { Tag } target - insert before this tag's first child
 * @param { Number } len - how many child nodes to move
 */
function moveVirtual(tag, src, target, len) {
  var el = tag._root, sib, i = 0
  for (; i < len; i++) {
    sib = el.nextSibling
    src.insertBefore(el, target._root)
    el = sib
  }
}


/**
 * Manage tags having the 'each'
 * @param   { Object } dom - DOM node we need to loop
 * @param   { Tag } parent - parent tag instance where the dom node is contained
 * @param   { String } expr - string contained in the 'each' attribute
 */
function _each(dom, parent, expr) {

  // remove the each property from the original tag
  remAttr(dom, 'each')

  var mustReorder = typeof getAttr(dom, 'no-reorder') !== T_STRING || remAttr(dom, 'no-reorder'),
    tagName = getTagName(dom),
    impl = __tagImpl[tagName] || { tmpl: dom.outerHTML },
    useRoot = SPECIAL_TAGS_REGEX.test(tagName),
    root = dom.parentNode,
    ref = document.createTextNode(''),
    child = getTag(dom),
    isOption = /option/gi.test(tagName), // the option tags must be treated differently
    tags = [],
    oldItems = [],
    hasKeys,
    isVirtual = dom.tagName == 'VIRTUAL'

  // parse the each expression
  expr = tmpl.loopKeys(expr)

  // insert a marked where the loop tags will be injected
  root.insertBefore(ref, dom)

  // clean template code
  parent.one('before-mount', function () {

    // remove the original DOM node
    dom.parentNode.removeChild(dom)
    if (root.stub) root = parent.root

  }).on('update', function () {
    // get the new items collection
    var items = tmpl(expr.val, parent),
      // create a fragment to hold the new DOM nodes to inject in the parent tag
      frag = document.createDocumentFragment()



    // object loop. any changes cause full redraw
    if (!isArray(items)) {
      hasKeys = items || false
      items = hasKeys ?
        Object.keys(items).map(function (key) {
          return mkitem(expr, key, items[key])
        }) : []
    }

    // loop all the new items
    items.forEach(function(item, i) {
      // reorder only if the items are objects
      var _mustReorder = mustReorder && item instanceof Object,
        oldPos = oldItems.indexOf(item),
        pos = ~oldPos && _mustReorder ? oldPos : i,
        // does a tag exist in this position?
        tag = tags[pos]

      item = !hasKeys && expr.key ? mkitem(expr, item, i) : item

      // new tag
      if (
        !_mustReorder && !tag // with no-reorder we just update the old tags
        ||
        _mustReorder && !~oldPos || !tag // by default we always try to reorder the DOM elements
      ) {

        tag = new Tag(impl, {
          parent: parent,
          isLoop: true,
          hasImpl: !!__tagImpl[tagName],
          root: useRoot ? root : dom.cloneNode(),
          item: item
        }, dom.innerHTML)

        tag.mount()
        if (isVirtual) tag._root = tag.root.firstChild // save reference for further moves or inserts
        // this tag must be appended
        if (i == tags.length) {
          if (isVirtual)
            addVirtual(tag, frag)
          else frag.appendChild(tag.root)
        }
        // this tag must be insert
        else {
          if (isVirtual)
            addVirtual(tag, root, tags[i])
          else root.insertBefore(tag.root, tags[i].root)
          oldItems.splice(i, 0, item)
        }

        tags.splice(i, 0, tag)
        pos = i // handled here so no move
      } else tag.update(item)

      // reorder the tag if it's not located in its previous position
      if (pos !== i && _mustReorder) {
        // update the DOM
        if (isVirtual)
          moveVirtual(tag, root, tags[i], dom.childNodes.length)
        else root.insertBefore(tag.root, tags[i].root)
        // update the position attribute if it exists
        if (expr.pos)
          tag[expr.pos] = i
        // move the old tag instance
        tags.splice(i, 0, tags.splice(pos, 1)[0])
        // move the old item
        oldItems.splice(i, 0, oldItems.splice(pos, 1)[0])
        // if the loop tags are not custom
        // we need to move all their custom tags into the right position
        if (!child) moveNestedTags(tag, i)
      }

      // cache the original item to use it in the events bound to this node
      // and its children
      tag._item = item
      // cache the real parent tag internally
      defineProperty(tag, '_parent', parent)

    }, true) // allow null values

    // remove the redundant tags
    unmountRedundant(items, tags)

    // insert the new nodes
    if (isOption) root.appendChild(frag)
    else root.insertBefore(frag, ref)

    // set the 'tags' property of the parent tag
    // if child is 'undefined' it means that we don't need to set this property
    // for example:
    // we don't need store the `myTag.tags['div']` property if we are looping a div tag
    // but we need to track the `myTag.tags['child']` property looping a custom child node named `child`
    if (child) parent.tags[tagName] = tags

    // clone the items array
    oldItems = items.slice()

  })

}
/**
 * Object that will be used to inject and manage the css of every tag instance
 */
var styleManager = (function(_riot) {

  if (!window) return { // skip injection on the server
    add: function () {},
    inject: function () {}
  }

  var styleNode = (function () {
    // create a new style element with the correct type
    var newNode = mkEl('style')
    setAttr(newNode, 'type', 'text/css')

    // replace any user node or insert the new one into the head
    var userNode = $('style[type=riot]')
    if (userNode) {
      if (userNode.id) newNode.id = userNode.id
      userNode.parentNode.replaceChild(newNode, userNode)
    }
    else document.getElementsByTagName('head')[0].appendChild(newNode)

    return newNode
  })()

  // Create cache and shortcut to the correct property
  var cssTextProp = styleNode.styleSheet,
    stylesToInject = ''

  // Expose the style node in a non-modificable property
  Object.defineProperty(_riot, 'styleNode', {
    value: styleNode,
    writable: true
  })

  /**
   * Public api
   */
  return {
    /**
     * Save a tag style to be later injected into DOM
     * @param   { String } css [description]
     */
    add: function(css) {
      stylesToInject += css
    },
    /**
     * Inject all previously saved tag styles into DOM
     * innerHTML seems slow: http://jsperf.com/riot-insert-style
     */
    inject: function() {
      if (stylesToInject) {
        if (cssTextProp) cssTextProp.cssText += stylesToInject
        else styleNode.innerHTML += stylesToInject
        stylesToInject = ''
      }
    }
  }

})(riot)


function parseNamedElements(root, tag, childTags, forceParsingNamed) {

  walk(root, function(dom) {
    if (dom.nodeType == 1) {
      dom.isLoop = dom.isLoop ||
                  (dom.parentNode && dom.parentNode.isLoop || getAttr(dom, 'each'))
                    ? 1 : 0

      // custom child tag
      if (childTags) {
        var child = getTag(dom)

        if (child && !dom.isLoop)
          childTags.push(initChildTag(child, {root: dom, parent: tag}, dom.innerHTML, tag))
      }

      if (!dom.isLoop || forceParsingNamed)
        setNamed(dom, tag, [])
    }

  })

}

function parseExpressions(root, tag, expressions) {

  function addExpr(dom, val, extra) {
    if (tmpl.hasExpr(val)) {
      expressions.push(extend({ dom: dom, expr: val }, extra))
    }
  }

  walk(root, function(dom) {
    var type = dom.nodeType,
      attr

    // text node
    if (type == 3 && dom.parentNode.tagName != 'STYLE') addExpr(dom, dom.nodeValue)
    if (type != 1) return

    /* element */

    // loop
    attr = getAttr(dom, 'each')

    if (attr) { _each(dom, tag, attr); return false }

    // attribute expressions
    each(dom.attributes, function(attr) {
      var name = attr.name,
        bool = name.split('__')[1]

      addExpr(dom, attr.value, { attr: bool || name, bool: bool })
      if (bool) { remAttr(dom, name); return false }

    })

    // skip custom tags
    if (getTag(dom)) return false

  })

}
function Tag(impl, conf, innerHTML) {

  var self = riot.observable(this),
    opts = inherit(conf.opts) || {},
    parent = conf.parent,
    isLoop = conf.isLoop,
    hasImpl = conf.hasImpl,
    item = cleanUpData(conf.item),
    expressions = [],
    childTags = [],
    root = conf.root,
    fn = impl.fn,
    tagName = root.tagName.toLowerCase(),
    attr = {},
    propsInSyncWithParent = [],
    dom

  if (fn && root._tag) root._tag.unmount(true)

  // not yet mounted
  this.isMounted = false
  root.isLoop = isLoop

  // keep a reference to the tag just created
  // so we will be able to mount this tag multiple times
  root._tag = this

  // create a unique id to this tag
  // it could be handy to use it also to improve the virtual dom rendering speed
  defineProperty(this, '_riot_id', ++__uid) // base 1 allows test !t._riot_id

  extend(this, { parent: parent, root: root, opts: opts, tags: {} }, item)

  // grab attributes
  each(root.attributes, function(el) {
    var val = el.value
    // remember attributes with expressions only
    if (tmpl.hasExpr(val)) attr[el.name] = val
  })

  dom = mkdom(impl.tmpl, innerHTML)

  // options
  function updateOpts() {
    var ctx = hasImpl && isLoop ? self : parent || self

    // update opts from current DOM attributes
    each(root.attributes, function(el) {
      var val = el.value
      opts[toCamel(el.name)] = tmpl.hasExpr(val) ? tmpl(val, ctx) : val
    })
    // recover those with expressions
    each(Object.keys(attr), function(name) {
      opts[toCamel(name)] = tmpl(attr[name], ctx)
    })
  }

  function normalizeData(data) {
    for (var key in item) {
      if (typeof self[key] !== T_UNDEF && isWritable(self, key))
        self[key] = data[key]
    }
  }

  function inheritFromParent () {
    if (!self.parent || !isLoop) return
    each(Object.keys(self.parent), function(k) {
      // some properties must be always in sync with the parent tag
      var mustSync = !contains(RESERVED_WORDS_BLACKLIST, k) && contains(propsInSyncWithParent, k)
      if (typeof self[k] === T_UNDEF || mustSync) {
        // track the property to keep in sync
        // so we can keep it updated
        if (!mustSync) propsInSyncWithParent.push(k)
        self[k] = self.parent[k]
      }
    })
  }

  defineProperty(this, 'update', function(data) {

    // make sure the data passed will not override
    // the component core methods
    data = cleanUpData(data)
    // inherit properties from the parent
    inheritFromParent()
    // normalize the tag properties in case an item object was initially passed
    if (data && typeof item === T_OBJECT) {
      normalizeData(data)
      item = data
    }
    extend(self, data)
    updateOpts()
    self.trigger('update', data)
    update(expressions, self)
    // the updated event will be triggered
    // once the DOM will be ready and all the reflows are completed
    // this is useful if you want to get the "real" root properties
    // 4 ex: root.offsetWidth ...
    rAF(function() { self.trigger('updated') })
    return this
  })

  defineProperty(this, 'mixin', function() {
    each(arguments, function(mix) {
      var instance

      mix = typeof mix === T_STRING ? riot.mixin(mix) : mix

      // check if the mixin is a function
      if (isFunction(mix)) {
        // create the new mixin instance
        instance = new mix()
        // save the prototype to loop it afterwards
        mix = mix.prototype
      } else instance = mix

      // loop the keys in the function prototype or the all object keys
      each(Object.getOwnPropertyNames(mix), function(key) {
        // bind methods to self
        if (key != 'init')
          self[key] = isFunction(instance[key]) ?
                        instance[key].bind(self) :
                        instance[key]
      })

      // init method will be called automatically
      if (instance.init) instance.init.bind(self)()
    })
    return this
  })

  defineProperty(this, 'mount', function() {

    updateOpts()

    // initialiation
    if (fn) fn.call(self, opts)

    // parse layout after init. fn may calculate args for nested custom tags
    parseExpressions(dom, self, expressions)

    // mount the child tags
    toggle(true)

    // update the root adding custom attributes coming from the compiler
    // it fixes also #1087
    if (impl.attrs || hasImpl) {
      walkAttributes(impl.attrs, function (k, v) { setAttr(root, k, v) })
      parseExpressions(self.root, self, expressions)
    }

    if (!self.parent || isLoop) self.update(item)

    // internal use only, fixes #403
    self.trigger('before-mount')

    if (isLoop && !hasImpl) {
      // update the root attribute for the looped elements
      self.root = root = dom.firstChild

    } else {
      while (dom.firstChild) root.appendChild(dom.firstChild)
      if (root.stub) self.root = root = parent.root
    }

    // parse the named dom nodes in the looped child
    // adding them to the parent as well
    if (isLoop)
      parseNamedElements(self.root, self.parent, null, true)

    // if it's not a child tag we can trigger its mount event
    if (!self.parent || self.parent.isMounted) {
      self.isMounted = true
      self.trigger('mount')
    }
    // otherwise we need to wait that the parent event gets triggered
    else self.parent.one('mount', function() {
      // avoid to trigger the `mount` event for the tags
      // not visible included in an if statement
      if (!isInStub(self.root)) {
        self.parent.isMounted = self.isMounted = true
        self.trigger('mount')
      }
    })
  })


  defineProperty(this, 'unmount', function(keepRootTag) {
    var el = root,
      p = el.parentNode,
      ptag

    self.trigger('before-unmount')

    // remove this tag instance from the global virtualDom variable
    __virtualDom.splice(__virtualDom.indexOf(self), 1)

    if (this._virts) {
      each(this._virts, function(v) {
        v.parentNode.removeChild(v)
      })
    }

    if (p) {

      if (parent) {
        ptag = getImmediateCustomParentTag(parent)
        // remove this tag from the parent tags object
        // if there are multiple nested tags with same name..
        // remove this element form the array
        if (isArray(ptag.tags[tagName]))
          each(ptag.tags[tagName], function(tag, i) {
            if (tag._riot_id == self._riot_id)
              ptag.tags[tagName].splice(i, 1)
          })
        else
          // otherwise just delete the tag instance
          ptag.tags[tagName] = undefined
      }

      else
        while (el.firstChild) el.removeChild(el.firstChild)

      if (!keepRootTag)
        p.removeChild(el)
      else
        // the riot-tag attribute isn't needed anymore, remove it
        remAttr(p, 'riot-tag')
    }


    self.trigger('unmount')
    toggle()
    self.off('*')
    self.isMounted = false
    delete root._tag

  })

  function toggle(isMount) {

    // mount/unmount children
    each(childTags, function(child) { child[isMount ? 'mount' : 'unmount']() })

    // listen/unlisten parent (events flow one way from parent to children)
    if (!parent) return
    var evt = isMount ? 'on' : 'off'

    // the loop tags will be always in sync with the parent automatically
    if (isLoop)
      parent[evt]('unmount', self.unmount)
    else
      parent[evt]('update', self.update)[evt]('unmount', self.unmount)
  }

  // named elements available for fn
  parseNamedElements(dom, this, childTags)

}
/**
 * Attach an event to a DOM node
 * @param { String } name - event name
 * @param { Function } handler - event callback
 * @param { Object } dom - dom node
 * @param { Tag } tag - tag instance
 */
function setEventHandler(name, handler, dom, tag) {

  dom[name] = function(e) {

    var ptag = tag._parent,
      item = tag._item,
      el

    if (!item)
      while (ptag && !item) {
        item = ptag._item
        ptag = ptag._parent
      }

    // cross browser event fix
    e = e || window.event

    // override the event properties
    if (isWritable(e, 'currentTarget')) e.currentTarget = dom
    if (isWritable(e, 'target')) e.target = e.srcElement
    if (isWritable(e, 'which')) e.which = e.charCode || e.keyCode

    e.item = item

    // prevent default behaviour (by default)
    if (handler.call(tag, e) !== true && !/radio|check/.test(dom.type)) {
      if (e.preventDefault) e.preventDefault()
      e.returnValue = false
    }

    if (!e.preventUpdate) {
      el = item ? getImmediateCustomParentTag(ptag) : tag
      el.update()
    }

  }

}


/**
 * Insert a DOM node replacing another one (used by if- attribute)
 * @param   { Object } root - parent node
 * @param   { Object } node - node replaced
 * @param   { Object } before - node added
 */
function insertTo(root, node, before) {
  if (!root) return
  root.insertBefore(before, node)
  root.removeChild(node)
}

/**
 * Update the expressions in a Tag instance
 * @param   { Array } expressions - expression that must be re evaluated
 * @param   { Tag } tag - tag instance
 */
function update(expressions, tag) {

  each(expressions, function(expr, i) {

    var dom = expr.dom,
      attrName = expr.attr,
      value = tmpl(expr.expr, tag),
      parent = expr.dom.parentNode

    if (expr.bool)
      value = value ? attrName : false
    else if (value == null)
      value = ''

    // leave out riot- prefixes from strings inside textarea
    // fix #815: any value -> string
    if (parent && parent.tagName == 'TEXTAREA') {
      value = ('' + value).replace(/riot-/g, '')
      // change textarea's value
      parent.value = value
    }

    // no change
    if (expr.value === value) return
    expr.value = value

    // text node
    if (!attrName) {
      dom.nodeValue = '' + value    // #815 related
      return
    }

    // remove original attribute
    remAttr(dom, attrName)
    // event handler
    if (isFunction(value)) {
      setEventHandler(attrName, value, dom, tag)

    // if- conditional
    } else if (attrName == 'if') {
      var stub = expr.stub,
        add = function() { insertTo(stub.parentNode, stub, dom) },
        remove = function() { insertTo(dom.parentNode, dom, stub) }

      // add to DOM
      if (value) {
        if (stub) {
          add()
          dom.inStub = false
          // avoid to trigger the mount event if the tags is not visible yet
          // maybe we can optimize this avoiding to mount the tag at all
          if (!isInStub(dom)) {
            walk(dom, function(el) {
              if (el._tag && !el._tag.isMounted)
                el._tag.isMounted = !!el._tag.trigger('mount')
            })
          }
        }
      // remove from DOM
      } else {
        stub = expr.stub = stub || document.createTextNode('')
        // if the parentNode is defined we can easily replace the tag
        if (dom.parentNode)
          remove()
        // otherwise we need to wait the updated event
        else (tag.parent || tag).one('updated', remove)

        dom.inStub = true
      }
    // show / hide
    } else if (/^(show|hide)$/.test(attrName)) {
      if (attrName == 'hide') value = !value
      dom.style.display = value ? '' : 'none'

    // field value
    } else if (attrName == 'value') {
      dom.value = value

    // <img src="{ expr }">
    } else if (startsWith(attrName, RIOT_PREFIX) && attrName != RIOT_TAG) {
      if (value)
        setAttr(dom, attrName.slice(RIOT_PREFIX.length), value)

    } else {
      if (expr.bool) {
        dom[attrName] = value
        if (!value) return
      }

      if (value === 0 || value && typeof value !== T_OBJECT)
        setAttr(dom, attrName, value)

    }

  })

}
/**
 * Loops an array
 * @param   { Array } els - collection of items
 * @param   {Function} fn - callback function
 * @returns { Array } the array looped
 */
function each(els, fn) {
  for (var i = 0, len = (els || []).length, el; i < len; i++) {
    el = els[i]
    // return false -> remove current item during loop
    if (el != null && fn(el, i) === false) i--
  }
  return els
}

/**
 * Detect if the argument passed is a function
 * @param   { * } v - whatever you want to pass to this function
 * @returns { Boolean } -
 */
function isFunction(v) {
  return typeof v === T_FUNCTION || false   // avoid IE problems
}

/**
 * Remove any DOM attribute from a node
 * @param   { Object } dom - DOM node we want to update
 * @param   { String } name - name of the property we want to remove
 */
function remAttr(dom, name) {
  dom.removeAttribute(name)
}

/**
 * Convert a string containing dashes to camel case
 * @param   { String } string - input string
 * @returns { String } my-string -> myString
 */
function toCamel(string) {
  return string.replace(/-(\w)/g, function(_, c) {
    return c.toUpperCase()
  })
}

/**
 * Get the value of any DOM attribute on a node
 * @param   { Object } dom - DOM node we want to parse
 * @param   { String } name - name of the attribute we want to get
 * @returns { String | undefined } name of the node attribute whether it exists
 */
function getAttr(dom, name) {
  return dom.getAttribute(name)
}

/**
 * Set any DOM attribute
 * @param { Object } dom - DOM node we want to update
 * @param { String } name - name of the property we want to set
 * @param { String } val - value of the property we want to set
 */
function setAttr(dom, name, val) {
  dom.setAttribute(name, val)
}

/**
 * Detect the tag implementation by a DOM node
 * @param   { Object } dom - DOM node we need to parse to get its tag implementation
 * @returns { Object } it returns an object containing the implementation of a custom tag (template and boot function)
 */
function getTag(dom) {
  return dom.tagName && __tagImpl[getAttr(dom, RIOT_TAG) || dom.tagName.toLowerCase()]
}
/**
 * Add a child tag to its parent into the `tags` object
 * @param   { Object } tag - child tag instance
 * @param   { String } tagName - key where the new tag will be stored
 * @param   { Object } parent - tag instance where the new child tag will be included
 */
function addChildTag(tag, tagName, parent) {
  var cachedTag = parent.tags[tagName]

  // if there are multiple children tags having the same name
  if (cachedTag) {
    // if the parent tags property is not yet an array
    // create it adding the first cached tag
    if (!isArray(cachedTag))
      // don't add the same tag twice
      if (cachedTag !== tag)
        parent.tags[tagName] = [cachedTag]
    // add the new nested tag to the array
    if (!contains(parent.tags[tagName], tag))
      parent.tags[tagName].push(tag)
  } else {
    parent.tags[tagName] = tag
  }
}

/**
 * Move the position of a custom tag in its parent tag
 * @param   { Object } tag - child tag instance
 * @param   { String } tagName - key where the tag was stored
 * @param   { Number } newPos - index where the new tag will be stored
 */
function moveChildTag(tag, tagName, newPos) {
  var parent = tag.parent,
    tags
  // no parent no move
  if (!parent) return

  tags = parent.tags[tagName]

  if (isArray(tags))
    tags.splice(newPos, 0, tags.splice(tags.indexOf(tag), 1)[0])
  else addChildTag(tag, tagName, parent)
}

/**
 * Create a new child tag including it correctly into its parent
 * @param   { Object } child - child tag implementation
 * @param   { Object } opts - tag options containing the DOM node where the tag will be mounted
 * @param   { String } innerHTML - inner html of the child node
 * @param   { Object } parent - instance of the parent tag including the child custom tag
 * @returns { Object } instance of the new child tag just created
 */
function initChildTag(child, opts, innerHTML, parent) {
  var tag = new Tag(child, opts, innerHTML),
    tagName = getTagName(opts.root),
    ptag = getImmediateCustomParentTag(parent)
  // fix for the parent attribute in the looped elements
  tag.parent = ptag
  // store the real parent tag
  // in some cases this could be different from the custom parent tag
  // for example in nested loops
  tag._parent = parent

  // add this tag to the custom parent tag
  addChildTag(tag, tagName, ptag)
  // and also to the real parent tag
  if (ptag !== parent)
    addChildTag(tag, tagName, parent)
  // empty the child node once we got its template
  // to avoid that its children get compiled multiple times
  opts.root.innerHTML = ''

  return tag
}

/**
 * Loop backward all the parents tree to detect the first custom parent tag
 * @param   { Object } tag - a Tag instance
 * @returns { Object } the instance of the first custom parent tag found
 */
function getImmediateCustomParentTag(tag) {
  var ptag = tag
  while (!getTag(ptag.root)) {
    if (!ptag.parent) break
    ptag = ptag.parent
  }
  return ptag
}

/**
 * Helper function to set an immutable property
 * @param   { Object } el - object where the new property will be set
 * @param   { String } key - object key where the new property will be stored
 * @param   { * } value - value of the new property
* @param   { Object } options - set the propery overriding the default options
 * @returns { Object } - the initial object
 */
function defineProperty(el, key, value, options) {
  Object.defineProperty(el, key, extend({
    value: value,
    enumerable: false,
    writable: false,
    configurable: false
  }, options))
  return el
}

/**
 * Get the tag name of any DOM node
 * @param   { Object } dom - DOM node we want to parse
 * @returns { String } name to identify this dom node in riot
 */
function getTagName(dom) {
  var child = getTag(dom),
    namedTag = getAttr(dom, 'name'),
    tagName = namedTag && !tmpl.hasExpr(namedTag) ?
                namedTag :
              child ? child.name : dom.tagName.toLowerCase()

  return tagName
}

/**
 * Extend any object with other properties
 * @param   { Object } src - source object
 * @returns { Object } the resulting extended object
 *
 * var obj = { foo: 'baz' }
 * extend(obj, {bar: 'bar', foo: 'bar'})
 * console.log(obj) => {bar: 'bar', foo: 'bar'}
 *
 */
function extend(src) {
  var obj, args = arguments
  for (var i = 1; i < args.length; ++i) {
    if (obj = args[i]) {
      for (var key in obj) {
        // check if this property of the source object could be overridden
        if (isWritable(src, key))
          src[key] = obj[key]
      }
    }
  }
  return src
}

/**
 * Check whether an array contains an item
 * @param   { Array } arr - target array
 * @param   { * } item - item to test
 * @returns { Boolean } Does 'arr' contain 'item'?
 */
function contains(arr, item) {
  return ~arr.indexOf(item)
}

/**
 * Check whether an object is a kind of array
 * @param   { * } a - anything
 * @returns {Boolean} is 'a' an array?
 */
function isArray(a) { return Array.isArray(a) || a instanceof Array }

/**
 * Detect whether a property of an object could be overridden
 * @param   { Object }  obj - source object
 * @param   { String }  key - object property
 * @returns { Boolean } is this property writable?
 */
function isWritable(obj, key) {
  var props = Object.getOwnPropertyDescriptor(obj, key)
  return typeof obj[key] === T_UNDEF || props && props.writable
}


/**
 * With this function we avoid that the internal Tag methods get overridden
 * @param   { Object } data - options we want to use to extend the tag instance
 * @returns { Object } clean object without containing the riot internal reserved words
 */
function cleanUpData(data) {
  if (!(data instanceof Tag) && !(data && typeof data.trigger == T_FUNCTION))
    return data

  var o = {}
  for (var key in data) {
    if (!contains(RESERVED_WORDS_BLACKLIST, key))
      o[key] = data[key]
  }
  return o
}

/**
 * Walk down recursively all the children tags starting dom node
 * @param   { Object }   dom - starting node where we will start the recursion
 * @param   { Function } fn - callback to transform the child node just found
 */
function walk(dom, fn) {
  if (dom) {
    // stop the recursion
    if (fn(dom) === false) return
    else {
      dom = dom.firstChild

      while (dom) {
        walk(dom, fn)
        dom = dom.nextSibling
      }
    }
  }
}

/**
 * Minimize risk: only zero or one _space_ between attr & value
 * @param   { String }   html - html string we want to parse
 * @param   { Function } fn - callback function to apply on any attribute found
 */
function walkAttributes(html, fn) {
  var m,
    re = /([-\w]+) ?= ?(?:"([^"]*)|'([^']*)|({[^}]*}))/g

  while (m = re.exec(html)) {
    fn(m[1].toLowerCase(), m[2] || m[3] || m[4])
  }
}

/**
 * Check whether a DOM node is in stub mode, useful for the riot 'if' directive
 * @param   { Object }  dom - DOM node we want to parse
 * @returns { Boolean } -
 */
function isInStub(dom) {
  while (dom) {
    if (dom.inStub) return true
    dom = dom.parentNode
  }
  return false
}

/**
 * Create a generic DOM node
 * @param   { String } name - name of the DOM node we want to create
 * @returns { Object } DOM node just created
 */
function mkEl(name) {
  return document.createElement(name)
}

/**
 * Shorter and fast way to select multiple nodes in the DOM
 * @param   { String } selector - DOM selector
 * @param   { Object } ctx - DOM node where the targets of our search will is located
 * @returns { Object } dom nodes found
 */
function $$(selector, ctx) {
  return (ctx || document).querySelectorAll(selector)
}

/**
 * Shorter and fast way to select a single node in the DOM
 * @param   { String } selector - unique dom selector
 * @param   { Object } ctx - DOM node where the target of our search will is located
 * @returns { Object } dom node found
 */
function $(selector, ctx) {
  return (ctx || document).querySelector(selector)
}

/**
 * Simple object prototypal inheritance
 * @param   { Object } parent - parent object
 * @returns { Object } child instance
 */
function inherit(parent) {
  function Child() {}
  Child.prototype = parent
  return new Child()
}

/**
 * Get the name property needed to identify a DOM node in riot
 * @param   { Object } dom - DOM node we need to parse
 * @returns { String | undefined } give us back a string to identify this dom node
 */
function getNamedKey(dom) {
  return getAttr(dom, 'id') || getAttr(dom, 'name')
}

/**
 * Set the named properties of a tag element
 * @param { Object } dom - DOM node we need to parse
 * @param { Object } parent - tag instance where the named dom element will be eventually added
 * @param { Array } keys - list of all the tag instance properties
 */
function setNamed(dom, parent, keys) {
  // get the key value we want to add to the tag instance
  var key = getNamedKey(dom),
    isArr,
    // add the node detected to a tag instance using the named property
    add = function(value) {
      // avoid to override the tag properties already set
      if (contains(keys, key)) return
      // check whether this value is an array
      isArr = isArray(value)
      // if the key was never set
      if (!value)
        // set it once on the tag instance
        parent[key] = dom
      // if it was an array and not yet set
      else if (!isArr || isArr && !contains(value, dom)) {
        // add the dom node into the array
        if (isArr)
          value.push(dom)
        else
          parent[key] = [value, dom]
      }
    }

  // skip the elements with no named properties
  if (!key) return

  // check whether this key has been already evaluated
  if (tmpl.hasExpr(key))
    // wait the first updated event only once
    parent.one('mount', function() {
      key = getNamedKey(dom)
      add(parent[key])
    })
  else
    add(parent[key])

}

/**
 * Faster String startsWith alternative
 * @param   { String } src - source string
 * @param   { String } str - test string
 * @returns { Boolean } -
 */
function startsWith(src, str) {
  return src.slice(0, str.length) === str
}

/**
 * requestAnimationFrame function
 * Adapted from https://gist.github.com/paulirish/1579671, license MIT
 */
var rAF = (function (w) {
  var raf = w.requestAnimationFrame    ||
            w.mozRequestAnimationFrame || w.webkitRequestAnimationFrame

  if (!raf || /iP(ad|hone|od).*OS 6/.test(w.navigator.userAgent)) {  // buggy iOS6
    var lastTime = 0

    raf = function (cb) {
      var nowtime = Date.now(), timeout = Math.max(16 - (nowtime - lastTime), 0)
      setTimeout(function () { cb(lastTime = nowtime + timeout) }, timeout)
    }
  }
  return raf

})(window || {})

/**
 * Mount a tag creating new Tag instance
 * @param   { Object } root - dom node where the tag will be mounted
 * @param   { String } tagName - name of the riot tag we want to mount
 * @param   { Object } opts - options to pass to the Tag instance
 * @returns { Tag } a new Tag instance
 */
function mountTo(root, tagName, opts) {
  var tag = __tagImpl[tagName],
    // cache the inner HTML to fix #855
    innerHTML = root._innerHTML = root._innerHTML || root.innerHTML

  // clear the inner html
  root.innerHTML = ''

  if (tag && root) tag = new Tag(tag, { root: root, opts: opts }, innerHTML)

  if (tag && tag.mount) {
    tag.mount()
    // add this tag to the virtualDom variable
    if (!contains(__virtualDom, tag)) __virtualDom.push(tag)
  }

  return tag
}
/**
 * Riot public api
 */

// share methods for other riot parts, e.g. compiler
riot.util = { brackets: brackets, tmpl: tmpl }

/**
 * Create a mixin that could be globally shared across all the tags
 */
riot.mixin = (function() {
  var mixins = {}

  /**
   * Create/Return a mixin by its name
   * @param   { String } name - mixin name
   * @param   { Object } mixin - mixin logic
   * @returns { Object } the mixin logic
   */
  return function(name, mixin) {
    if (!mixin) return mixins[name]
    mixins[name] = mixin
  }

})()

/**
 * Create a new riot tag implementation
 * @param   { String }   name - name/id of the new riot tag
 * @param   { String }   html - tag template
 * @param   { String }   css - custom tag css
 * @param   { String }   attrs - root tag attributes
 * @param   { Function } fn - user function
 * @returns { String } name/id of the tag just created
 */
riot.tag = function(name, html, css, attrs, fn) {
  if (isFunction(attrs)) {
    fn = attrs
    if (/^[\w\-]+\s?=/.test(css)) {
      attrs = css
      css = ''
    } else attrs = ''
  }
  if (css) {
    if (isFunction(css)) fn = css
    else styleManager.add(css)
  }
  __tagImpl[name] = { name: name, tmpl: html, attrs: attrs, fn: fn }
  return name
}

/**
 * Create a new riot tag implementation (for use by the compiler)
 * @param   { String }   name - name/id of the new riot tag
 * @param   { String }   html - tag template
 * @param   { String }   css - custom tag css
 * @param   { String }   attrs - root tag attributes
 * @param   { Function } fn - user function
 * @param   { string }  [bpair] - brackets used in the compilation
 * @returns { String } name/id of the tag just created
 */
riot.tag2 = function(name, html, css, attrs, fn, bpair) {
  if (css) styleManager.add(css)
  //if (bpair) riot.settings.brackets = bpair
  __tagImpl[name] = { name: name, tmpl: html, attrs: attrs, fn: fn }
  return name
}

/**
 * Mount a tag using a specific tag implementation
 * @param   { String } selector - tag DOM selector
 * @param   { String } tagName - tag implementation name
 * @param   { Object } opts - tag logic
 * @returns { Array } new tags instances
 */
riot.mount = function(selector, tagName, opts) {

  var els,
    allTags,
    tags = []

  // helper functions

  function addRiotTags(arr) {
    var list = ''
    each(arr, function (e) {
      if (!/[^-\w]/.test(e))
        list += ',*[' + RIOT_TAG + '=' + e.trim() + ']'
    })
    return list
  }

  function selectAllTags() {
    var keys = Object.keys(__tagImpl)
    return keys + addRiotTags(keys)
  }

  function pushTags(root) {
    var last

    if (root.tagName) {
      if (tagName && (!(last = getAttr(root, RIOT_TAG)) || last != tagName))
        setAttr(root, RIOT_TAG, tagName)

      var tag = mountTo(root, tagName || root.getAttribute(RIOT_TAG) || root.tagName.toLowerCase(), opts)

      if (tag) tags.push(tag)
    } else if (root.length)
      each(root, pushTags)   // assume nodeList

  }

  // ----- mount code -----

  // inject styles into DOM
  styleManager.inject()

  if (typeof tagName === T_OBJECT) {
    opts = tagName
    tagName = 0
  }

  // crawl the DOM to find the tag
  if (typeof selector === T_STRING) {
    if (selector === '*')
      // select all the tags registered
      // and also the tags found with the riot-tag attribute set
      selector = allTags = selectAllTags()
    else
      // or just the ones named like the selector
      selector += addRiotTags(selector.split(','))

    // make sure to pass always a selector
    // to the querySelectorAll function
    els = selector ? $$(selector) : []
  }
  else
    // probably you have passed already a tag or a NodeList
    els = selector

  // select all the registered and mount them inside their root elements
  if (tagName === '*') {
    // get all custom tags
    tagName = allTags || selectAllTags()
    // if the root els it's just a single tag
    if (els.tagName)
      els = $$(tagName, els)
    else {
      // select all the children for all the different root elements
      var nodeList = []
      each(els, function (_el) {
        nodeList.push($$(tagName, _el))
      })
      els = nodeList
    }
    // get rid of the tagName
    tagName = 0
  }

  if (els.tagName)
    pushTags(els)
  else
    each(els, pushTags)

  return tags
}

/**
 * Update all the tags instances created
 * @returns { Array } all the tags instances
 */
riot.update = function() {
  return each(__virtualDom, function(tag) {
    tag.update()
  })
}

/**
 * Export the Tag constructor
 */
riot.Tag = Tag
  // support CommonJS, AMD & browser
  /* istanbul ignore next */
  if (typeof exports === T_OBJECT)
    module.exports = riot
  else if (typeof define === T_FUNCTION && typeof define.amd !== T_UNDEF)
    define(function() { return riot })
  else
    window.riot = riot

})(typeof window != 'undefined' ? window : void 0);

},{}],3:[function(require,module,exports){
'use strict';

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

;
(function () {
  if (!window.rg) window.rg = {};
  rg.isUndefined = function (val) {
    return typeof val === 'undefined';
  };
  rg.isDefined = function (val) {
    return typeof val !== 'undefined';
  };
  rg.isBoolean = function (val) {
    return typeof val === 'boolean';
  };
  rg.isObject = function (val) {
    return val !== null && typeof val === 'object';
  };
  rg.isString = function (val) {
    return typeof val === 'string';
  };
  rg.isNumber = function (val) {
    return typeof val === "number" && !isNaN(val);
  };
  rg.isDate = function (val) {
    return toString.call(val) === '[object Date]';
  };
  rg.isArray = Array.isArray;
  rg.isFunction = function (val) {
    return typeof val === 'function';
  };
  rg.isRegExp = function (val) {
    return toString.call(val) === '[object RegExp]';
  };
  rg.isPromise = function (val) {
    return val && isFunction(val.then);
  };
  rg.toBoolean = function (val) {
    return val == 'true' || val == true;
  };
  rg.toNumber = function (val) {
    val = Number(val);
    return rg.isNumber(val) ? val : 0;
  };
  var uid = 0;
  rg.uid = function () {
    return uid++;
  };
  rg.xhr = function (method, src, onload) {
    var req = new XMLHttpRequest();
    req.onload = function () {
      if (rg.isFunction(onload)) onload(req.responseText);
    };
    req.open(method, src, true);
    req.send();
  };
})();
/*
jQuery Credit Card Validator 1.0

Copyright 2012-2015 Pawel Decowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
 */

(function () {
  'use strict';

  function validateCreditCard(input) {
    var __indexOf = [].indexOf || function (item) {
      for (var i = 0, l = this.length; i < l; i++) {
        if (i in this && this[i] === item) return i;
      }return -1;
    };
    var bind, card, card_type, card_types, get_card_type, is_valid_length, is_valid_luhn, normalize, validate, validate_number, _i, _len, _ref;
    card_types = [{
      name: 'amex',
      icon: 'images/amex.png',
      pattern: /^3[47]/,
      valid_length: [15]
    }, {
      name: 'diners_club',
      icon: 'images/diners_club.png',
      pattern: /^30[0-5]/,
      valid_length: [14]
    }, {
      name: 'diners_club',
      icon: 'images/diners_club.png',
      pattern: /^36/,
      valid_length: [14]
    }, {
      name: 'jcb',
      icon: 'images/jcb.png',
      pattern: /^35(2[89]|[3-8][0-9])/,
      valid_length: [16]
    }, {
      name: 'laser',
      pattern: /^(6304|670[69]|6771)/,
      valid_length: [16, 17, 18, 19]
    }, {
      name: 'visa_electron',
      pattern: /^(4026|417500|4508|4844|491(3|7))/,
      valid_length: [16]
    }, {
      name: 'visa',
      icon: 'images/visa.png',
      pattern: /^4/,
      valid_length: [16]
    }, {
      name: 'mastercard',
      icon: 'images/mastercard.png',
      pattern: /^5[1-5]/,
      valid_length: [16]
    }, {
      name: 'maestro',
      pattern: /^(5018|5020|5038|6304|6759|676[1-3])/,
      valid_length: [12, 13, 14, 15, 16, 17, 18, 19]
    }, {
      name: 'discover',
      icon: 'images/discover.png',
      pattern: /^(6011|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5]|64[4-9])|65)/,
      valid_length: [16]
    }];

    var options = {};

    if (options.accept == null) {
      options.accept = (function () {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = card_types.length; _i < _len; _i++) {
          card = card_types[_i];
          _results.push(card.name);
        }
        return _results;
      })();
    }
    _ref = options.accept;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      card_type = _ref[_i];
      if (__indexOf.call((function () {
        var _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = card_types.length; _j < _len1; _j++) {
          card = card_types[_j];
          _results.push(card.name);
        }
        return _results;
      })(), card_type) < 0) {
        throw "Credit card type '" + card_type + "' is not supported";
      }
    }

    get_card_type = function (number) {
      var _j, _len1, _ref1;
      _ref1 = (function () {
        var _k, _len1, _ref1, _results;
        _results = [];
        for (_k = 0, _len1 = card_types.length; _k < _len1; _k++) {
          card = card_types[_k];
          if ((_ref1 = card.name, __indexOf.call(options.accept, _ref1) >= 0)) {
            _results.push(card);
          }
        }
        return _results;
      })();
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        card_type = _ref1[_j];
        if (number.match(card_type.pattern)) {
          return card_type;
        }
      }
      return null;
    };

    is_valid_luhn = function (number) {
      var digit, n, sum, _j, _len1, _ref1;
      sum = 0;
      _ref1 = number.split('').reverse();
      for (n = _j = 0, _len1 = _ref1.length; _j < _len1; n = ++_j) {
        digit = _ref1[n];
        digit = +digit;
        if (n % 2) {
          digit *= 2;
          if (digit < 10) {
            sum += digit;
          } else {
            sum += digit - 9;
          }
        } else {
          sum += digit;
        }
      }
      return sum % 10 === 0;
    };

    is_valid_length = function (number, card_type) {
      var _ref1;
      return _ref1 = number.length, __indexOf.call(card_type.valid_length, _ref1) >= 0;
    };

    validate_number = (function (_this) {
      return function (number) {
        var length_valid, luhn_valid;
        card_type = get_card_type(number);
        luhn_valid = false;
        length_valid = false;
        if (card_type != null) {
          luhn_valid = is_valid_luhn(number);
          length_valid = is_valid_length(number, card_type);
        }
        return {
          card_type: card_type,
          valid: luhn_valid && length_valid,
          luhn_valid: luhn_valid,
          length_valid: length_valid
        };
      };
    })(this);

    normalize = function (number) {
      return number.replace(/[ -]/g, '');
    };

    validate = (function (_this) {
      return function () {
        return validate_number(normalize(input));
      };
    })(this);

    return validate(input);
  };

  riot.mixin('rg.creditcard', {
    creditcard: {
      validate: validateCreditCard
    }
  });

  if (!window.rg) window.rg = {};
  rg.creditcard = {
    validate: validateCreditCard
  };
})();
;
(function () {
  var map = {
    initialize: function initialize() {
      map.trigger('initialize');
    }
  };

  riot.observable(map);

  if (!window.rg) window.rg = {};
  rg.map = map;
})();

var RgTag = (function () {
  function RgTag() {
    _classCallCheck(this, RgTag);

    riot.observable(this);
  }

  _createClass(RgTag, [{
    key: 'update',
    value: function update() {
      this.trigger('update');
    }
  }]);

  return RgTag;
})();

var RgAlerts = (function (_RgTag) {
  _inherits(RgAlerts, _RgTag);

  function RgAlerts(opts) {
    var _this3 = this;

    _classCallCheck(this, RgAlerts);

    _get(Object.getPrototypeOf(RgAlerts.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this.alerts = [];
    if (!rg.isArray(opts.alerts)) return;
    opts.alerts.forEach(function (alert) {
      _this3.add(alert);
    });
  }

  _createClass(RgAlerts, [{
    key: 'add',
    value: function add(alert) {
      var _this4 = this;

      alert.id = rg.uid();
      if (rg.isUndefined(alert.isvisible)) alert.isvisible = true;
      if (alert.timeout) {
        alert.startTimer = function () {
          alert.timer = setTimeout(function () {
            _this4.dismiss(alert);
            _this4.update();
          }, rg.toNumber(alert.timeout));
        };
        alert.startTimer();
      }
      this.alerts.push(alert);
    }
  }, {
    key: 'dismiss',
    value: function dismiss(alert) {
      alert.isvisible = false;
      if (rg.isFunction(alert.onclose)) alert.onclose(alert);
      clearTimeout(alert.timer);
    }
  }, {
    key: 'select',
    value: function select(alert) {
      if (rg.isFunction(alert.onclick)) alert.onclick(alert);
    }
  }]);

  return RgAlerts;
})(RgTag);

var RgBehold = (function (_RgTag2) {
  _inherits(RgBehold, _RgTag2);

  function RgBehold(opts) {
    _classCallCheck(this, RgBehold);

    _get(Object.getPrototypeOf(RgBehold.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._image1 = opts.image1;
    this._image2 = opts.image2;
    this._mode = opts.mode;
  }

  _createClass(RgBehold, [{
    key: 'image1',
    get: function get() {
      return this._image1;
    },
    set: function set(img) {
      this._image1 = img;
    }
  }, {
    key: 'image2',
    get: function get() {
      return this._image2;
    },
    set: function set(img) {
      this._image2 = img;
    }
  }, {
    key: 'mode',
    get: function get() {
      return this._mode || 'swipe';
    },
    set: function set(mode) {
      this._mode = mode;
    }
  }]);

  return RgBehold;
})(RgTag);

var RgBubble = (function (_RgTag3) {
  _inherits(RgBubble, _RgTag3);

  function RgBubble(opts) {
    _classCallCheck(this, RgBubble);

    _get(Object.getPrototypeOf(RgBubble.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._isvisible = opts.isvisible;
    this._content = opts.content;
  }

  _createClass(RgBubble, [{
    key: 'showBubble',
    value: function showBubble() {
      clearTimeout(this._timer);
      this.isvisible = true;
    }
  }, {
    key: 'hideBubble',
    value: function hideBubble() {
      var _this5 = this;

      this._timer = setTimeout(function () {
        _this5.isvisible = false;
        _this5.update();
      }, 1000);
    }
  }, {
    key: 'toggleBubble',
    value: function toggleBubble() {
      this.isvisible = !this.isvisible;
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = isvisible;
    }
  }, {
    key: 'content',
    get: function get() {
      return this._content || '';
    },
    set: function set(content) {
      this._content = content;
    }
  }]);

  return RgBubble;
})(RgTag);

var RgCode = (function (_RgTag4) {
  _inherits(RgCode, _RgTag4);

  function RgCode(opts) {
    _classCallCheck(this, RgCode);

    _get(Object.getPrototypeOf(RgCode.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._url = opts.url;
    this._code = opts.code;
    this._onchange = opts.onchange;
    this._theme = opts.theme;
    this._mode = opts.mode;
    this._tabsize = opts.tabsize;
    this._softtabs = opts.softtabs;
    this._wordwrap = opts.wordwrap;
    this._readonly = opts.readonly;
  }

  _createClass(RgCode, [{
    key: 'url',
    get: function get() {
      return this._url;
    },
    set: function set(url) {
      this._url = url;
    }
  }, {
    key: 'code',
    get: function get() {
      return this._code || '';
    },
    set: function set(code) {
      this._code = code;
    }
  }, {
    key: 'onchange',
    get: function get() {
      if (rg.isFunction(this._onchange)) return this._onchange;
      return null;
    },
    set: function set(onchange) {
      if (rg.isFunction(onchange)) this._onchange = onchange;
    }
  }, {
    key: 'theme',
    get: function get() {
      return this._theme || 'monokai';
    },
    set: function set(theme) {
      this._theme = theme;
    }
  }, {
    key: 'mode',
    get: function get() {
      return this._mode || 'html';
    },
    set: function set(mode) {
      this._mode = mode;
    }
  }, {
    key: 'tabsize',
    get: function get() {
      return rg.toNumber(this._tabsize) || 2;
    },
    set: function set(tabsize) {
      this._tabsize = tabsize;
    }
  }, {
    key: 'softtabs',
    get: function get() {
      return rg.toBoolean(this._softtabs);
    },
    set: function set(softtabs) {
      this._softtabs = softtabs;
    }
  }, {
    key: 'wordwrap',
    get: function get() {
      return rg.toBoolean(this._wordwrap);
    },
    set: function set(wordwrap) {
      this._wordwrap = wordwrap;
    }
  }, {
    key: 'readonly',
    get: function get() {
      return rg.toBoolean(this._readonly);
    },
    set: function set(readonly) {
      this._readonly = readonly;
    }
  }]);

  return RgCode;
})(RgTag);

var RgContextMenu = (function (_RgTag5) {
  _inherits(RgContextMenu, _RgTag5);

  function RgContextMenu(opts) {
    var _this6 = this;

    _classCallCheck(this, RgContextMenu);

    _get(Object.getPrototypeOf(RgContextMenu.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this.name = opts.name;
    this._isvisible = opts.isvisible;
    this._onclose = opts.onclose;
    this._onopen = opts.onopen;
    this._items = [];
    if (!rg.isArray(opts.items)) return;
    opts.items.forEach(function (item) {
      _this6.add(item);
    });
  }

  _createClass(RgContextMenu, [{
    key: 'add',
    value: function add(item) {
      item.id = rg.uid();
      if (rg.isUndefined(item.isvisible)) item.isvisible = true;
      if (rg.isUndefined(item.inactive)) item.inactive = false;
      if (!rg.isFunction(item.onclick)) item.onclick = null;
      this._items.push(item);
    }
  }, {
    key: 'select',
    value: function select(item) {
      if (!item.inactive) {
        if (rg.isFunction(item.onclick)) item.onclick(item);
        this.isvisible = false;
      }
    }
  }, {
    key: 'items',
    get: function get() {
      if (rg.isArray(this._items)) return this._items;
      this._items = [];
      return this._items;
    },
    set: function set(items) {
      this._items = items;
    }
  }, {
    key: 'onopen',
    get: function get() {
      if (rg.isFunction(this._onopen)) return this._onopen;
      return null;
    },
    set: function set(onopen) {
      if (rg.isFunction(onopen)) this._onopen = onopen;
    }
  }, {
    key: 'onclose',
    get: function get() {
      if (rg.isFunction(this._onclose)) return this._onclose;
      return null;
    },
    set: function set(onclose) {
      if (rg.isFunction(onclose)) this._onclose = onclose;
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = rg.toBoolean(isvisible);
    }
  }]);

  return RgContextMenu;
})(RgTag);

var RgCreditCard = (function (_RgTag6) {
  _inherits(RgCreditCard, _RgTag6);

  function RgCreditCard(opts) {
    _classCallCheck(this, RgCreditCard);

    _get(Object.getPrototypeOf(RgCreditCard.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._placeholder = opts.placeholder;
    this._cardnumber = opts.cardnumber;
  }

  _createClass(RgCreditCard, [{
    key: 'validate',
    value: function validate() {
      var res = rg.creditcard.validate(this.cardnumber);
      this.valid = res.valid;
      this.icon = this.valid ? res.card_type.name : '';
    }
  }, {
    key: 'cardnumber',
    get: function get() {
      return (this._cardnumber || '').toString();
    },
    set: function set(num) {
      this._cardnumber = num;
    }
  }, {
    key: 'valid',
    get: function get() {
      return rg.toBoolean(this._valid);
    },
    set: function set(valid) {
      this._valid = rg.toBoolean(valid);
    }
  }, {
    key: 'placeholder',
    get: function get() {
      return this._placeholder || 'Card no.';
    },
    set: function set(text) {
      this._placeholder = text;
    }
  }]);

  return RgCreditCard;
})(RgTag);

var RgDate = (function (_RgTag7) {
  _inherits(RgDate, _RgTag7);

  function RgDate(opts) {
    _classCallCheck(this, RgDate);

    _get(Object.getPrototypeOf(RgDate.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._isvisible = opts.isvisible;
    this._date = opts.date;
    this._showYears = opts.showyears;
    this._showMonths = opts.showmonths;
    this._showToday = opts.showtoday;
    this._format = opts.format;
    this._yearFormat = opts.yearformat;
    this._monthFormat = opts.monthformat;
    this._weekFormat = opts.weekformat;
    this._dayFormat = opts.dayformat;
    this._onclose = opts.onclose;
    this._onselect = opts.onselect;
    this._onopen = opts.onopen;

    var temp = moment();
    this.dayNames = [temp.day(0).format(this.weekFormat), temp.day(1).format(this.weekFormat), temp.day(2).format(this.weekFormat), temp.day(3).format(this.weekFormat), temp.day(4).format(this.weekFormat), temp.day(5).format(this.weekFormat), temp.day(6).format(this.weekFormat)];
  }

  _createClass(RgDate, [{
    key: '_toMoment',
    value: function _toMoment(date) {
      if (!moment.isMoment(date)) date = moment(date);
      if (date.isValid()) return date;
      return moment();
    }
  }, {
    key: 'open',
    value: function open() {
      this._isvisible = true;
      if (rg.isFunction(this._onopen)) this._onopen();
    }
  }, {
    key: 'close',
    value: function close() {
      if (this.isvisible) {
        this._isvisible = false;
        if (rg.isFunction(this._onclose)) this._onclose();
      }
    }
  }, {
    key: 'setToday',
    value: function setToday() {
      this.select(moment());
    }
  }, {
    key: 'prevYear',
    value: function prevYear() {
      this._date = this.date.subtract(1, 'year');
    }
  }, {
    key: 'nextYear',
    value: function nextYear() {
      this._date = this.date.add(1, 'year');
    }
  }, {
    key: 'prevMonth',
    value: function prevMonth() {
      this._date = this.date.subtract(1, 'month');
    }
  }, {
    key: 'nextMonth',
    value: function nextMonth() {
      this._date = this.date.add(1, 'month');
    }
  }, {
    key: 'select',
    value: function select(date) {
      this._date = date;
      if (rg.isFunction(this._onselect)) this._onselect(this.date);
    }
  }, {
    key: 'date',
    get: function get() {
      return this._toMoment(this._date);
    },
    set: function set(date) {
      this._date = date;
      if (rg.isFunction(this._onselect)) this._onselect(this.date);
      this._isvisible = false;
    }
  }, {
    key: 'dateFormatted',
    get: function get() {
      return this.date.format(this.format);
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    }
  }, {
    key: 'year',
    get: function get() {
      return this.date.format(this.yearFormat);
    }
  }, {
    key: 'month',
    get: function get() {
      return this.date.format(this.monthFormat);
    }
  }, {
    key: 'day',
    get: function get() {
      return this.date.format(this.dayFormat);
    }
  }, {
    key: 'showYears',
    get: function get() {
      if (rg.isUndefined(this._showYears)) return true;
      return rg.toBoolean(this._showYears);
    },
    set: function set(show) {
      this._showYears = rg.toBoolean(show);
    }
  }, {
    key: 'showMonths',
    get: function get() {
      if (rg.isUndefined(this._showMonths)) return true;
      return rg.toBoolean(this._showMonths);
    },
    set: function set(show) {
      this._showMonths = rg.toBoolean(show);
    }
  }, {
    key: 'showToday',
    get: function get() {
      if (rg.isUndefined(this._showToday)) return true;
      return rg.toBoolean(this._showToday);
    },
    set: function set(show) {
      this._showToday = rg.toBoolean(show);
    }
  }, {
    key: 'format',
    get: function get() {
      return this._format || 'LL';
    },
    set: function set(format) {
      this._format = format;
    }
  }, {
    key: 'yearFormat',
    get: function get() {
      return this._yearFormat || 'YYYY';
    },
    set: function set(yearFormat) {
      this._yearFormat = yearFormat;
    }
  }, {
    key: 'monthFormat',
    get: function get() {
      return this._monthFormat || 'MMMM';
    },
    set: function set(monthFormat) {
      this._monthFormat = monthFormat;
    }
  }, {
    key: 'weekFormat',
    get: function get() {
      return this._weekFormat || 'ddd';
    },
    set: function set(weekFormat) {
      this._weekFormat = weekFormat;
    }
  }, {
    key: 'dayFormat',
    get: function get() {
      return this._dayFormat || 'DD';
    },
    set: function set(dayFormat) {
      this._dayFormat = dayFormat;
    }
  }]);

  return RgDate;
})(RgTag);

var RgDrawer = (function (_RgTag8) {
  _inherits(RgDrawer, _RgTag8);

  function RgDrawer(opts) {
    _classCallCheck(this, RgDrawer);

    _get(Object.getPrototypeOf(RgDrawer.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._isvisible = opts.isvisible;
    this._header = opts.header;
    this._items = opts.items;
    this._position = opts.position;
    this._onselect = opts.onselect;
    this._onopen = opts.onopen;
    this._onclose = opts.onclose;
  }

  _createClass(RgDrawer, [{
    key: 'open',
    value: function open() {
      if (this.onopen && !this.isvisible) this.onopen();
      this.isvisible = true;
    }
  }, {
    key: 'close',
    value: function close() {
      if (this.onclose && this.isvisible) this.onclose();
      this.isvisible = false;
    }
  }, {
    key: 'toggle',
    value: function toggle() {
      this.isvisible = !this.isvisible;
      if (this.onopen && this.isvisible) this.onopen();else if (this.onclose && !this.isvisible) this.onclose();
    }
  }, {
    key: 'select',
    value: function select(item) {
      this.items.forEach(function (item) {
        return item.active = false;
      });
      item.active = true;
      if (item.action) item.action(item);
      if (this.onselect) this.onselect(item);
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = isvisible;
    }
  }, {
    key: 'header',
    get: function get() {
      return this._header;
    },
    set: function set(header) {
      this._header = header;
    }
  }, {
    key: 'items',
    get: function get() {
      if (rg.isArray(this._items)) return this._items;
      this._items = [];
      return this._items;
    },
    set: function set(items) {
      this._items = items;
    }
  }, {
    key: 'position',
    get: function get() {
      return this._position || 'bottom';
    },
    set: function set(position) {
      this._position = position;
    }
  }, {
    key: 'onopen',
    get: function get() {
      if (rg.isFunction(this._onopen)) return this._onopen;
      return null;
    },
    set: function set(onopen) {
      this._onopen = onopen;
    }
  }, {
    key: 'onclose',
    get: function get() {
      if (rg.isFunction(this._onclose)) return this._onclose;
      return null;
    },
    set: function set(onclose) {
      this._onclose = onclose;
    }
  }, {
    key: 'onselect',
    get: function get() {
      if (rg.isFunction(this._onselect)) return this._onselect;
      return null;
    },
    set: function set(onselect) {
      this._onselect = onselect;
    }
  }]);

  return RgDrawer;
})(RgTag);

var RgInclude = (function (_RgTag9) {
  _inherits(RgInclude, _RgTag9);

  function RgInclude(opts) {
    _classCallCheck(this, RgInclude);

    _get(Object.getPrototypeOf(RgInclude.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._unsafe = opts.unsafe;
    this._url = opts.url;
  }

  _createClass(RgInclude, [{
    key: 'fetch',
    value: function fetch() {
      var _this7 = this;

      rg.xhr('get', this.url, function (resp) {
        _this7.trigger('fetch', resp);
      });
    }
  }, {
    key: 'unsafe',
    get: function get() {
      return rg.toBoolean(this._unsafe);
    },
    set: function set(unsafe) {
      this._unsafe = unsafe;
    }
  }, {
    key: 'url',
    get: function get() {
      return this._url || '';
    },
    set: function set(url) {
      if (this.url != url) {
        this._url = url;
      }
    }
  }]);

  return RgInclude;
})(RgTag);

var RgLoading = (function (_RgTag10) {
  _inherits(RgLoading, _RgTag10);

  function RgLoading(opts) {
    _classCallCheck(this, RgLoading);

    _get(Object.getPrototypeOf(RgLoading.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._isvisible = opts.isvisible;
  }

  _createClass(RgLoading, [{
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = isvisible;
    }
  }]);

  return RgLoading;
})(RgTag);

var RgMap = (function (_RgTag11) {
  _inherits(RgMap, _RgTag11);

  function RgMap(opts) {
    _classCallCheck(this, RgMap);

    _get(Object.getPrototypeOf(RgMap.prototype), 'constructor', this).call(this);
    this._options = opts;
  }

  _createClass(RgMap, [{
    key: 'options',
    get: function get() {
      if (rg.isUndefined(this._options)) {
        this._options = {
          center: {
            lat: 53.806,
            lng: -1.535
          },
          zoom: 7
        };
      }

      return this._options;
    }
  }]);

  return RgMap;
})(RgTag);

var RgMarkdown = (function (_RgTag12) {
  _inherits(RgMarkdown, _RgTag12);

  function RgMarkdown(opts) {
    _classCallCheck(this, RgMarkdown);

    _get(Object.getPrototypeOf(RgMarkdown.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    if (commonmark) {
      this.reader = new commonmark.Parser();
      this.writer = new commonmark.HtmlRenderer();
    }
    this._url = opts.url;
  }

  _createClass(RgMarkdown, [{
    key: 'parse',
    value: function parse(md) {
      var parsed = this.reader.parse(md);
      this.trigger('parse', this.writer.render(parsed));
      return this.writer.render(parsed);
    }
  }, {
    key: 'fetch',
    value: function fetch() {
      var _this8 = this;

      rg.xhr('get', this.url, function (resp) {
        _this8.trigger('fetch', resp);
      });
    }
  }, {
    key: 'url',
    get: function get() {
      return this._url || '';
    },
    set: function set(url) {
      this._url = url;
    }
  }]);

  return RgMarkdown;
})(RgTag);

var RgModal = (function (_RgTag13) {
  _inherits(RgModal, _RgTag13);

  function RgModal(opts) {
    _classCallCheck(this, RgModal);

    _get(Object.getPrototypeOf(RgModal.prototype), 'constructor', this).call(this);
    this._isvisible = opts.isvisible;
    this._dismissable = opts.dismissable;
    this._ghost = opts.ghost;
    this._heading = opts.heading;
    this._buttons = opts.buttons;
    this._onclose = opts.onclose;
    this._onopen = opts.onopen;
  }

  _createClass(RgModal, [{
    key: 'dismissable',
    get: function get() {
      if (rg.isUndefined(this._dismissable)) this._dismissable = true;
      return rg.toBoolean(this._dismissable);
    },
    set: function set(dismissable) {
      this._dismissable = dismissable;
    }
  }, {
    key: 'ghost',
    get: function get() {
      return rg.toBoolean(this._ghost);
    },
    set: function set(ghost) {
      this._ghost = ghost;
    }
  }, {
    key: 'heading',
    get: function get() {
      return this._heading || '';
    },
    set: function set(heading) {
      this._heading = heading;
    }
  }, {
    key: 'buttons',
    get: function get() {
      if (rg.isArray(this._buttons)) return this._buttons;
      return [];
    },
    set: function set(buttons) {
      this._buttons = buttons;
    }
  }, {
    key: 'onopen',
    get: function get() {
      if (rg.isFunction(this._onopen)) return this._onopen;
      return null;
    },
    set: function set(onopen) {
      this._onopen = onopen;
    }
  }, {
    key: 'onclose',
    get: function get() {
      if (rg.isFunction(this._onclose)) return this._onclose;
      return null;
    },
    set: function set(onclose) {
      this._onclose = onclose;
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = isvisible;
      if (this.isvisible && this.onopen) this.onopen();
      if (!this.isvisible && this.onclose) this.onclose();
    }
  }]);

  return RgModal;
})(RgTag);

var RgPhoneSim = (function (_RgTag14) {
  _inherits(RgPhoneSim, _RgTag14);

  function RgPhoneSim(opts) {
    _classCallCheck(this, RgPhoneSim);

    _get(Object.getPrototypeOf(RgPhoneSim.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._url = opts.url;
  }

  _createClass(RgPhoneSim, [{
    key: 'url',
    get: function get() {
      return this._url || '';
    },
    set: function set(url) {
      this._url = url;
    }
  }]);

  return RgPhoneSim;
})(RgTag);

var RgPlaceholdit = (function (_RgTag15) {
  _inherits(RgPlaceholdit, _RgTag15);

  function RgPlaceholdit(opts) {
    _classCallCheck(this, RgPlaceholdit);

    _get(Object.getPrototypeOf(RgPlaceholdit.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._width = opts.width;
    this._height = opts.height;
    this._background = opts.background;
    this._color = opts.color;
    this._text = opts.text;
    this._textsize = opts.textsize;
    this._format = opts.format;
  }

  _createClass(RgPlaceholdit, [{
    key: 'width',
    get: function get() {
      return rg.toNumber(this._width) || 450;
    },
    set: function set(width) {
      this._width = width;
    }
  }, {
    key: 'height',
    get: function get() {
      return rg.toNumber(this._height) || 250;
    },
    set: function set(height) {
      this._height = height;
    }
  }, {
    key: 'background',
    get: function get() {
      return this._background || 'f01e52';
    },
    set: function set(background) {
      this._background = background;
    }
  }, {
    key: 'color',
    get: function get() {
      return this._color || 'fff';
    },
    set: function set(color) {
      this._color = color;
    }
  }, {
    key: 'text',
    get: function get() {
      return this._text || this.width + ' x ' + this.height;
    },
    set: function set(text) {
      this._text = text;
    }
  }, {
    key: 'textsize',
    get: function get() {
      return rg.toNumber(this._textsize) || 30;
    },
    set: function set(textsize) {
      this._textsize = textsize;
    }
  }, {
    key: 'format',
    get: function get() {
      return this._format || 'png';
    },
    set: function set(format) {
      this._format = format;
    }
  }]);

  return RgPlaceholdit;
})(RgTag);

var RgSelect = (function (_RgTag16) {
  _inherits(RgSelect, _RgTag16);

  function RgSelect(opts) {
    _classCallCheck(this, RgSelect);

    _get(Object.getPrototypeOf(RgSelect.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._isvisible = opts.isvisible;
    this._autocomplete = opts.autocomplete;
    this._filteron = opts.filteron;
    this._options = opts.options;
    this._hasfilter = opts.hasfilter;
    this._placeholder = opts.placeholder;
    this._filterplaceholder = opts.filterplaceholder;
    this._filtereditems = opts.filtereditems;
    this._onopen = opts.onopen;
    this._onclose = opts.onclose;
    this._onselect = opts.onselect;
    this._onfilter = opts.onfilter;
  }

  _createClass(RgSelect, [{
    key: 'open',
    value: function open() {
      if (this.onopen && !this.isvisible) this.onopen();
      this.isvisible = true;
    }
  }, {
    key: 'close',
    value: function close() {
      if (this.onclose && this.isvisible) this.onclose();
      this.isvisible = false;
    }
  }, {
    key: 'toggle',
    value: function toggle() {
      this.isvisible = !this.isvisible;
      if (this.onopen && this.isvisible) this.onopen();else if (this.onclose && !this.isvisible) this.onclose();
    }
  }, {
    key: 'filter',
    value: function filter(text) {
      var _this9 = this;

      this.filtereditems = this.options.filter(function (item) {
        item.active = false;
        var f = item[_this9.filteron];
        if (rg.isUndefined(f)) return false;
        if (text.length == 0 || f.toString().toLowerCase().indexOf(text.toString().toLowerCase()) > -1) return true;
      });
      if (this.onfilter) this.onfilter(text);
    }
  }, {
    key: 'select',
    value: function select(item) {
      this.options.forEach(function (i) {
        return i.selected = false;
      });
      item.selected = true;
      if (this.onselect) this.onselect(item);
      this.isvisible = false;
      if (this.autocomplete) this.filter(item[this.filteron]);
      this.trigger('select', item);
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = isvisible;
    }
  }, {
    key: 'autocomplete',
    get: function get() {
      return rg.toBoolean(this._autocomplete);
    },
    set: function set(autocomplete) {
      this._autocomplete = autocomplete;
    }
  }, {
    key: 'filteron',
    get: function get() {
      return this._filteron || 'text';
    },
    set: function set(filteron) {
      this._filteron = filteron;
    }
  }, {
    key: 'placeholder',
    get: function get() {
      return this._placeholder;
    },
    set: function set(placeholder) {
      this._placeholder = placeholder;
    }
  }, {
    key: 'filterplaceholder',
    get: function get() {
      return this._filterplaceholder;
    },
    set: function set(filterplaceholder) {
      this._filterplaceholder = filterplaceholder;
    }
  }, {
    key: 'hasfilter',
    get: function get() {
      return rg.toBoolean(this._hasfilter);
    },
    set: function set(hasfilter) {
      this._hasfilter = hasfilter;
    }
  }, {
    key: 'options',
    get: function get() {
      if (rg.isArray(this._options)) return this._options;
      this._options = [];
      return this._options;
    },
    set: function set(options) {
      var _this10 = this;

      if (!rg.isArray(options)) options = [];
      options.forEach(function (item, i) {
        item.index = i;
        if (item.selected) _this10.select(item);
      });
      this._options = options;
    }
  }, {
    key: 'filtereditems',
    get: function get() {
      if (rg.isArray(this._filtereditems)) return this._filtereditems;
      this._filtereditems = [];
      return this._filtereditems;
    },
    set: function set(filtereditems) {
      this._filtereditems = filtereditems;
    }
  }, {
    key: 'onopen',
    get: function get() {
      if (rg.isFunction(this._onopen)) return this._onopen;
      return null;
    },
    set: function set(onopen) {
      this._onopen = onopen;
    }
  }, {
    key: 'onclose',
    get: function get() {
      if (rg.isFunction(this._onclose)) return this._onclose;
      return null;
    },
    set: function set(onclose) {
      this._onclose = onclose;
    }
  }, {
    key: 'onfilter',
    get: function get() {
      if (rg.isFunction(this._onfilter)) return this._onfilter;
      return null;
    },
    set: function set(onfilter) {
      this._onfilter = onfilter;
    }
  }, {
    key: 'onselect',
    get: function get() {
      if (rg.isFunction(this._onselect)) return this._onselect;
      return null;
    },
    set: function set(onselect) {
      this._onselect = onselect;
    }
  }]);

  return RgSelect;
})(RgTag);

var RgSidemenu = (function (_RgDrawer) {
  _inherits(RgSidemenu, _RgDrawer);

  function RgSidemenu(opts) {
    _classCallCheck(this, RgSidemenu);

    _get(Object.getPrototypeOf(RgSidemenu.prototype), 'constructor', this).call(this, opts);
  }

  return RgSidemenu;
})(RgDrawer);

var RgTabs = (function (_RgTag17) {
  _inherits(RgTabs, _RgTag17);

  function RgTabs(opts) {
    _classCallCheck(this, RgTabs);

    _get(Object.getPrototypeOf(RgTabs.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._tabs = opts.tabs;
    this._onopen = opts.onopen;
  }

  _createClass(RgTabs, [{
    key: 'select',
    value: function select(tab) {
      if (!tab.disabled) {
        this.tabs.forEach(function (tab) {
          tab.active = false;
        });
        if (this.onopen) this.onopen(tab);
        tab.active = true;
      }
    }
  }, {
    key: 'onopen',
    get: function get() {
      if (rg.isFunction(this._onopen)) return this._onopen;
      return null;
    },
    set: function set(onopen) {
      if (rg.isFunction(onopen)) this._onopen = onopen;
    }
  }, {
    key: 'tabs',
    get: function get() {
      var _this11 = this;

      if (rg.isArray(this._tabs)) {
        var _ret = (function () {
          var activeTab = false;
          _this11._tabs.forEach(function (tab, i) {
            tab.index = i;

            if (activeTab) tab.active = false;
            if (tab.active) activeTab = true;
          });
          return {
            v: _this11._tabs
          };
        })();

        if (typeof _ret === 'object') return _ret.v;
      }
      this._tabs = [];
      return this._tabs;
    },
    set: function set(tabs) {
      this._tabs = tabs;
    }
  }]);

  return RgTabs;
})(RgTag);

var RgTags = (function (_RgSelect) {
  _inherits(RgTags, _RgSelect);

  function RgTags(opts) {
    _classCallCheck(this, RgTags);

    _get(Object.getPrototypeOf(RgTags.prototype), 'constructor', this).call(this, opts);
    this._tags = opts.tags;
    this._value = opts.value;
  }

  _createClass(RgTags, [{
    key: 'addTag',
    value: function addTag(tag) {
      tag.index = this.tags.length;
      this.tags.push(tag);
      this.isvisible = false;
    }
  }, {
    key: 'removeTag',
    value: function removeTag(tag) {
      this.tags.splice(this.tags.indexOf(tag), 1);
      this.isvisible = false;
    }
  }, {
    key: 'value',
    get: function get() {
      return this._value || '';
    },
    set: function set(val) {
      this._value = val;
    }
  }, {
    key: 'tags',
    get: function get() {
      if (rg.isArray(this._tags)) return this._tags;
      this._tags = [];
      return this._tags;
    },
    set: function set(tags) {
      if (!rg.isArray(tags)) tags = [];
      tags.forEach(function (item, i) {
        item.index = i;
      });
      this._tags = tags;
    }
  }]);

  return RgTags;
})(RgSelect);

var RgTime = (function (_RgSelect2) {
  _inherits(RgTime, _RgSelect2);

  function RgTime(opts) {
    _classCallCheck(this, RgTime);

    _get(Object.getPrototypeOf(RgTime.prototype), 'constructor', this).call(this, opts);
    this._min = opts.min;
    this._max = opts.max;
    this._time = opts.time;
    this._step = opts.step;
    this._ampm = opts.ampm;
  }

  _createClass(RgTime, [{
    key: 'min',
    get: function get() {
      if (this._min) return this._min.split(':');
      return this._min;
    },
    set: function set(min) {
      this._min = min;
    }
  }, {
    key: 'max',
    get: function get() {
      if (this._max) return this._max.split(':');
      return this._max;
    },
    set: function set(max) {
      this._max = max;
    }
  }, {
    key: 'time',
    get: function get() {
      if (rg.isDate(this._time)) return this._time;
      return new Date();
    },
    set: function set(time) {
      this._time = time;
    }
  }, {
    key: 'step',
    get: function get() {
      return rg.toNumber(this._step) || 1;
    },
    set: function set(step) {
      this._step = step;
    }
  }, {
    key: 'ampm',
    get: function get() {
      return rg.toBoolean(this._ampm);
    },
    set: function set(ampm) {
      this._ampm = ampm;
    }
  }]);

  return RgTime;
})(RgSelect);

var RgToasts = (function (_RgTag18) {
  _inherits(RgToasts, _RgTag18);

  function RgToasts(opts) {
    _classCallCheck(this, RgToasts);

    _get(Object.getPrototypeOf(RgToasts.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._toasts = opts.toasts;
    this._position = opts.position;
    this._isvisible = opts.isvisible;
  }

  _createClass(RgToasts, [{
    key: 'add',
    value: function add(toast) {
      this.toasts.push(toast);
    }
  }, {
    key: 'toasts',
    get: function get() {
      var _this12 = this;

      if (rg.isArray(this._toasts)) {
        this._toasts.forEach(function (toast) {
          if (rg.isUndefined(toast.isvisible)) toast.isvisible = true;
          toast.id = toast.id || rg.uid();
          if (!toast.timer && !toast.sticky) {
            toast.startTimer = function () {
              toast.timer = window.setTimeout(function () {
                toast.isvisible = false;
                if (rg.isFunction(toast.onclose)) toast.onclose();
                _this12.update();
              }, rg.toNumber(toast.timeout) || 6000);
            };
            toast.startTimer();
          }
        });
        this.isvisible = this._toasts.filter(function (toast) {
          return toast.isvisible;
        }).length > 0;
        return this._toasts;
      }
      this._toats = [];
      return this._toasts;
    },
    set: function set(toasts) {
      this._toasts = toasts;
    }
  }, {
    key: 'position',
    get: function get() {
      return this._position || 'topright';
    },
    set: function set(position) {
      this._position = position;
    }
  }, {
    key: 'isvisible',
    get: function get() {
      return rg.toBoolean(this._isvisible);
    },
    set: function set(isvisible) {
      this._isvisible = isvisible;
    }
  }]);

  return RgToasts;
})(RgTag);

var RgToggle = (function (_RgTag19) {
  _inherits(RgToggle, _RgTag19);

  function RgToggle(opts) {
    _classCallCheck(this, RgToggle);

    _get(Object.getPrototypeOf(RgToggle.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._checked = opts.checked;
    this._ontoggle = opts.ontoggle;
  }

  _createClass(RgToggle, [{
    key: 'toggle',
    value: function toggle() {
      this.checked = !this.checked;
      if (this.ontoggle) this.ontoggle(this.checked);
    }
  }, {
    key: 'checked',
    get: function get() {
      return rg.toBoolean(this._checked);
    },
    set: function set(checked) {
      this._checked = checked;
    }
  }, {
    key: 'ontoggle',
    get: function get() {
      if (rg.isFunction(this._ontoggle)) return this._ontoggle;
      return null;
    },
    set: function set(ontoggle) {
      this._ontoggle = ontoggle;
    }
  }]);

  return RgToggle;
})(RgTag);

var RgUnsplash = (function (_RgTag20) {
  _inherits(RgUnsplash, _RgTag20);

  function RgUnsplash(opts) {
    _classCallCheck(this, RgUnsplash);

    _get(Object.getPrototypeOf(RgUnsplash.prototype), 'constructor', this).call(this);
    if (rg.isUndefined(opts)) opts = {};
    this._width = opts.width;
    this._height = opts.height;
    this._greyscale = opts.greyscale || opts.grayscale;
    this._random = opts.random;
    this._blur = opts.blur;
    this._image = opts.image;
    this._gravity = opts.gravity;
  }

  _createClass(RgUnsplash, [{
    key: 'width',
    get: function get() {
      return rg.toNumber(this._width) || 450;
    },
    set: function set(width) {
      this._width = width;
      this.trigger('change');
    }
  }, {
    key: 'height',
    get: function get() {
      return rg.toNumber(this._height) || 250;
    },
    set: function set(height) {
      this._height = height;
      this.trigger('change');
    }
  }, {
    key: 'greyscale',
    get: function get() {
      return rg.toBoolean(this._greyscale);
    },
    set: function set(greyscale) {
      this._greyscale = greyscale;
      this.trigger('change');
    }
  }, {
    key: 'grayscale',
    get: function get() {
      return this.greyscale;
    },
    set: function set(grayscale) {
      this.greyscale = grayscale;
    }
  }, {
    key: 'random',
    get: function get() {
      return rg.toBoolean(this._random);
    },
    set: function set(random) {
      this._random = random;
      this.trigger('change');
    }
  }, {
    key: 'blur',
    get: function get() {
      return rg.toBoolean(this._blur);
    },
    set: function set(blur) {
      this._blur = blur;
      this.trigger('change');
    }
  }, {
    key: 'image',
    get: function get() {
      return rg.toNumber(this._image);
    },
    set: function set(image) {
      this._image = image;
      this.trigger('change');
    }
  }, {
    key: 'gravity',
    get: function get() {
      return this._gravity;
    },
    set: function set(gravity) {
      this._gravity = gravity;
      this.trigger('change');
    }
  }]);

  return RgUnsplash;
})(RgTag);

riot.tag2('rg-alerts', '<div each="{RgAlerts.alerts}" class="alert {type} {isvisible: isvisible}" onclick="{select}"> <a class="close" aria-label="Close" onclick="{parent.dismiss}" if="{dismissable != false}"> <span aria-hidden="true">&times;</span> </a> <rg-raw content="{content}"></rg-raw> </div>', 'rg-alerts,[riot-tag="rg-alerts"] { font-size: 0.9em; position: relative; top: 0; right: 0; left: 0; width: 100%; } rg-alerts .alert,[riot-tag="rg-alerts"] .alert { display: none; position: relative; margin-bottom: 15px; padding: 15px 35px 15px 15px; } rg-alerts .isvisible,[riot-tag="rg-alerts"] .isvisible { display: block; } rg-alerts .close,[riot-tag="rg-alerts"] .close { position: absolute; top: 50%; right: 20px; line-height: 12px; font-size: 1.1em; border: 0; background-color: transparent; color: rgba(0, 0, 0, 0.5); cursor: pointer; outline: none; transform: translate3d(0, -50%, 0); } rg-alerts .danger,[riot-tag="rg-alerts"] .danger { color: #8f1d2e; background-color: #ffced8; } rg-alerts .information,[riot-tag="rg-alerts"] .information { color: #31708f; background-color: #d9edf7; } rg-alerts .success,[riot-tag="rg-alerts"] .success { color: #2d8f40; background-color: #ccf7d4; } rg-alerts .warning,[riot-tag="rg-alerts"] .warning { color: #c06329; background-color: #f7dfd0; }', '', function (opts) {
  var _this2 = this;

  this.on('mount', function () {
    var _this = this;

    this.RgAlerts = opts.alerts || new RgAlerts(opts);
    this.RgAlerts.on('update', function () {
      _this.update();
    });
    this.update();
  });

  this.dismiss = function (e) {
    var alert = e.item;
    _this2.RgAlerts.dismiss(alert);
  };

  this.select = function (e) {
    var alert = e.item;
    _this2.RgAlerts.select(alert);
  };
}, '{ }');

riot.tag2('rg-behold', '<div class="container"> <div class="controls"> <div class="modes"> <a onclick="{swipeMode}" class="mode {active: RgBehold.mode == \'swipe\'}">Swipe</a> <a onclick="{fadeMode}" class="mode {active: RgBehold.mode == \'fade\'}">Fade</a> </div> <input type="range" class="ranger" name="diff" value="0" min="0" max="1" step="0.01" oninput="{updateDiff}" onchange="{updateDiff}"> </div> <div class="images"> <div class="image"> <img class="image-2" riot-src="{RgBehold.image2}"> </div> <div class="image fallback"> <img class="image-1" riot-src="{RgBehold.image1}"> </div> </div> </div>', 'rg-behold .controls,[riot-tag="rg-behold"] .controls { text-align: center; } rg-behold .mode,[riot-tag="rg-behold"] .mode { text-decoration: none; cursor: pointer; padding: 0 10px; } rg-behold a.active,[riot-tag="rg-behold"] a.active { font-weight: bold; } rg-behold .ranger,[riot-tag="rg-behold"] .ranger { width: 90%; max-width: 300px; } rg-behold .images,[riot-tag="rg-behold"] .images { position: relative; } rg-behold .image,[riot-tag="rg-behold"] .image { position: absolute; width: 100%; text-align: center; } rg-behold .image img,[riot-tag="rg-behold"] .image img { max-width: 90%; }', '', function (opts) {
  var _this2 = this;

  var image1 = undefined,
      image2 = undefined,
      fallback = undefined;

  var viewer = function viewer() {
    image1 = _this2.root.querySelector('.image-1');
    image2 = _this2.root.querySelector('.image-2');
    fallback = typeof image1.style.webkitClipPath == 'undefined';

    var img1Loaded = undefined,
        img2Loaded = undefined,
        img1H = undefined,
        img2H = undefined;
    var img1 = new Image();
    var img2 = new Image();
    img1.onload = function () {
      img1Loaded = true;
      img1H = this.height;
      calculateMaxHeight();
    };
    img2.onload = function () {
      img2Loaded = true;
      img2H = this.height;
      calculateMaxHeight();
    };
    img1.src = _this2.RgBehold.image1;
    img2.src = _this2.RgBehold.image2;

    var _this = _this2;

    function calculateMaxHeight() {
      if (img1Loaded && img2Loaded) {
        var controls = _this.root.querySelector('.controls');
        var container = _this.root.querySelector('.container');
        container.style.height = controls.getBoundingClientRect().height + Math.max(img1H, img2H) + 'px';
        _this.updateDiff();
      }
    }
  };

  this.on('mount', function () {
    _this2.RgBehold = opts.behold || new RgBehold(opts);
    _this2.RgBehold.on('update', function () {
      _this2.update();
    });
    _this2.on('update', function () {
      viewer();
    });
    _this2.update();
  });

  this.swipeMode = function () {
    _this2.diff.value = 0;
    _this2.updateDiff();
    _this2.RgBehold.mode = 'swipe';
  };
  this.fadeMode = function () {
    _this2.diff.value = 0;
    _this2.updateDiff();
    _this2.RgBehold.mode = 'fade';
  };

  this.updateDiff = function () {
    if (_this2.RgBehold.mode == 'fade') {
      image1.style.opacity = 1 - _this2.diff.value;
    } else if (_this2.RgBehold.mode == 'swipe') {
      if (!fallback) {
        image1.style.clipPath = image1.style.webkitClipPath = 'inset(0 0 0 ' + (image1.clientWidth * _this2.diff.value - 1) + 'px)';
      } else {
        var fallbackImg = _this2.root.querySelector('.fallback');
        fallbackImg.style.clip = 'rect(auto, auto, auto, ' + fallbackImg.clientWidth * _this2.diff.value + 'px)';
      }
    }
  };
}, '{ }');

riot.tag2('rg-bubble', '<div class="context"> <div class="bubble {isvisible: RgBubble.isvisible}"> <rg-raw content="{RgBubble.content}"></rg-raw> </div> <div class="content" onmouseover="{showBubble}" onmouseout="{hideBubble}" onclick="{toggleBubble}"> <yield></yield> </div> </div>', 'rg-bubble .context,[riot-tag="rg-bubble"] .context,rg-bubble .content,[riot-tag="rg-bubble"] .content { display: inline-block; position: relative; } rg-bubble .bubble,[riot-tag="rg-bubble"] .bubble { position: absolute; top: -50px; left: 50%; transform: translate3d(-50%, 0, 0); padding: 10px 15px; background-color: #000; color: white; text-align: center; font-size: 0.9em; line-height: 1; white-space: nowrap; display: none; } rg-bubble .isvisible,[riot-tag="rg-bubble"] .isvisible { display: block; } rg-bubble .bubble:after,[riot-tag="rg-bubble"] .bubble:after { content: \'\'; position: absolute; display: block; bottom: -20px; left: 50%; transform: translate3d(-50%, 0, 0); width: 0; height: 0; border: 10px solid transparent; border-top-color: #000; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgBubble = opts.bubble || new RgBubble(opts);
    _this.RgBubble.on('update', function () {
      _this.update();
    });
    _this.update();
  });

  this.showBubble = function () {
    _this.RgBubble.showBubble();
  };

  this.hideBubble = function () {
    _this.RgBubble.hideBubble();
  };

  this.toggleBubble = function () {
    _this.RgBubble.toggleBubble();
  };
}, '{ }');

riot.tag2('rg-code', '<div class="editor"></div>', 'rg-code .editor,[riot-tag="rg-code"] .editor { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }', '', function (opts) {
  var _this = this;

  var editor = undefined;

  var setupEditor = function setupEditor() {
    editor.setTheme('ace/theme/' + _this.RgCode.theme);
    editor.getSession().setMode('ace/mode/' + _this.RgCode.mode);
    editor.getSession().setTabSize(_this.RgCode.tabsize);
    editor.getSession().setUseSoftTabs(_this.RgCode.softtabs);
    editor.getSession().setUseWrapMode(_this.RgCode.wordwrap);
    editor.setReadOnly(_this.RgCode.readonly);
  };

  this.on('mount', function () {
    editor = ace.edit(_this.root.querySelector('.editor'));
    editor.$blockScrolling = Infinity;

    _this.RgCode = opts.editor || new RgCode(opts);
    _this.RgCode.on('update', function () {
      _this.update();
    });
    _this.on('update', function () {
      setupEditor();
      if (_this.RgCode.code != editor.getValue()) editor.setValue(_this.RgCode.code, 1);
    });
    if (_this.RgCode.url) {
      rg.xhr('get', _this.RgCode.url, function (resp) {
        _this.RgCode.code = resp;
        _this.update();
      });
    }
    editor.setValue(_this.RgCode.code, 1);
    editor.getSession().on('change', function (e) {
      _this.RgCode.code = editor.getValue();
      if (_this.RgCode.onchange) _this.RgCode.onchange(editor.getValue());
    });
    setupEditor();
    _this.update();
  });
});

riot.tag2('rg-context-menu', '<div class="menu {isvisible: RgContextMenu.isvisible}"> <div class="list"> <div each="{RgContextMenu.items}" class="item {inactive: inactive}" onclick="{selectItem}"> <rg-raw content="{content}"></rg-raw> </div> <yield></yield> </div> </div>', 'rg-context-menu .menu,[riot-tag="rg-context-menu"] .menu { display: none; position: absolute; background-color: white; border: 1px solid #D3D3D3; text-align: left; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; box-sizing: border-box; z-index: 2; } rg-context-menu .menu.isvisible,[riot-tag="rg-context-menu"] .menu.isvisible { display: block; } rg-context-menu .item,[riot-tag="rg-context-menu"] .item { cursor: pointer; padding: 10px; border-top: 1px solid #E8E8E8; background-color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } rg-context-menu .item:first-child,[riot-tag="rg-context-menu"] .item:first-child { border-top: 0; } rg-context-menu .item:hover,[riot-tag="rg-context-menu"] .item:hover { background-color: #f3f3f3; } rg-context-menu .item.inactive,[riot-tag="rg-context-menu"] .item.inactive { color: #8a8a8a; font-style: italic; } rg-context-menu .item.inactive:hover,[riot-tag="rg-context-menu"] .item.inactive:hover { background-color: #fff; }', '', function (opts) {
  var _this = this;

  var handleClickOutside = function handleClickOutside(e) {
    if (!_this.root.contains(e.target)) {
      if (_this.RgContextMenu.onclose && _this.RgContextMenu.isvisible) _this.RgContextMenu.onclose(e);
      _this.RgContextMenu.isvisible = false;
    }
  };

  var openMenu = function openMenu(e) {
    e.preventDefault();
    if (_this.RgContextMenu.onopen) _this.RgContextMenu.onopen(e);
    _this.RgContextMenu.isvisible = true;

    var x = e.pageX;
    var y = e.pageY;
    var dd = _this.root.querySelector('.menu');
    var ddRect = dd.getBoundingClientRect();

    if (x > window.innerWidth + window.scrollX - ddRect.width) x = window.innerWidth + window.scrollX - ddRect.width;

    dd.style.left = x + 'px';

    if (y > window.innerHeight + window.scrollY - ddRect.height) y = window.innerHeight + window.scrollY - ddRect.height;

    dd.style.top = y + 'px';
    _this.update();
  };

  this.on('mount', function () {
    _this.RgContextMenu = opts.menu || new RgContextMenu(opts);
    _this.RgContextMenu.on('update', function () {
      _this.update();
    });
    document.addEventListener('click', handleClickOutside);
    var targets = document.querySelectorAll('[rg-context-menu]');
    for (var i = 0, target; target = targets[i]; i++) {
      if (target.attributes['rg-context-menu'].value == _this.RgContextMenu.name) target.addEventListener('contextmenu', openMenu);else target.addEventListener('contextmenu', _this.closeMenu);
    }
    _this.update();
  });

  this.on('unmount', function () {
    document.removeEventListener('click', handleClickOutside);
    var targets = document.querySelectorAll('[rg-context-menu]');
    for (var i = 0, target; target = targets[i]; i++) {
      if (target.attributes['rg-context-menu'].value == _this.RgContextMenu.name) target.removeEventListener('contextmenu', openMenu);else target.removeEventListener('contextmenu', _this.closeMenu);
    }
  });

  this.closeMenu = function () {
    _this.RgContextMenu.isvisible = false;
  };

  this.selectItem = function (item) {
    item = item.item;
    _this.RgContextMenu.select(item);
  };
}, '{ }');

riot.tag2('rg-credit-card-number', '<input type="text" name="cardnumber" class="field card-no {RgCreditCard.icon} {valid: RgCreditCard.valid}" oninput="{validate}" placeholder="{RgCreditCard.placeholder}">', 'rg-credit-card-number .field,[riot-tag="rg-credit-card-number"] .field { font-size: 1em; padding: 10px; border: 1px solid #D3D3D3; box-sizing: border-box; outline: none; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-credit-card-number .card-no,[riot-tag="rg-credit-card-number"] .card-no { padding-right: 60px; background-repeat: no-repeat; background-position: right center; background-size: 60px; } rg-credit-card-number .amex,[riot-tag="rg-credit-card-number"] .amex { background-image: url(img/amex.png); } rg-credit-card-number .diners_club,[riot-tag="rg-credit-card-number"] .diners_club { background-image: url(img/diners_club.png); } rg-credit-card-number .discover,[riot-tag="rg-credit-card-number"] .discover { background-image: url(img/discover.png); } rg-credit-card-number .jcb,[riot-tag="rg-credit-card-number"] .jcb { background-image: url(img/jcb.png); } rg-credit-card-number .mastercard,[riot-tag="rg-credit-card-number"] .mastercard { background-image: url(img/mastercard.png); } rg-credit-card-number .visa,[riot-tag="rg-credit-card-number"] .visa { background-image: url(img/visa.png); }', '', function (opts) {
  var _this = this;

  var setUI = function setUI() {
    if (_this.cardnumber.value != _this.RgCreditCard.cardnumber) _this.cardnumber.value = _this.RgCreditCard.cardnumber;
    _this.RgCreditCard.validate();
  };

  this.on('mount', function () {
    _this.RgCreditCard = opts.card || new RgCreditCard(opts);
    _this.RgCreditCard.on('update', function () {
      _this.update();
    });
    _this.on('update', function () {
      setUI();
    });
    _this.update();
  });

  this.validate = function () {
    _this.RgCreditCard.cardnumber = _this.cardnumber.value;
    _this.RgCreditCard.validate();
  };
}, '{ }');

riot.tag2('rg-date', '<div class="container {open: RgDate.isvisible}"> <input type="text" class="field" onclick="{open}" value="{RgDate.dateFormatted}" readonly> <div class="calendar" show="{RgDate.isvisible}"> <div class="grid grid-row" if="{RgDate.showYears}"> <div class="selector" onclick="{prevYear}">&lsaquo;</div> <span class="year">{RgDate.year}</span> <div class="selector" onclick="{nextYear}">&rsaquo;</div> </div> <div class="grid grid-row" if="{!RgDate.showYears}"> <span class="year fill">{RgDate.year}</span> </div> <div class="grid grid-row" if="{RgDate.showMonths}"> <div class="selector" onclick="{prevMonth}">&lsaquo;</div> <span class="month">{RgDate.month}</span> <div class="selector" onclick="{nextMonth}">&rsaquo;</div> </div> <div class="grid grid-row" if="{!RgDate.showMonths}"> <span class="month fill">{RgDate.month}</span> </div> <div class="grid grid-row"> <span class="day-name" each="{day in RgDate.dayNames}">{day}</span> </div> <div class="grid grid-wrap"> <div each="{day in startBuffer}" onclick="{select}" class="date {in: day.inMonth, selected: day.selected, today: day.today}"> {day.date.format(this.RgDate.dayFormat)} </div> <div each="{day in days}" onclick="{select}" class="date {in: day.inMonth, selected: day.selected, today: day.today}"> {day.date.format(this.RgDate.dayFormat)} </div> <div each="{day in endBuffer}" onclick="{select}" class="date {in: day.inMonth, selected: day.selected, today: day.today}"> {day.date.format(this.RgDate.dayFormat)} </div> </div> <div if="{RgDate.showToday}" class="grid grid-row"> <a class="shortcut" onclick="{setToday}">Today</a> </div> </div> </div>', 'rg-date .container,[riot-tag="rg-date"] .container { position: relative; display: inline-block; cursor: pointer; } rg-date .field,[riot-tag="rg-date"] .field { font-size: 1em; padding: 10px; border: 1px solid #D3D3D3; cursor: pointer; box-sizing: border-box; outline: none; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-date .calendar,[riot-tag="rg-date"] .calendar { position: absolute; text-align: center; background-color: white; border: 1px solid #D3D3D3; padding: 5px; width: 330px; margin-top: 10px; left: 50%; transform: translate3d(-50%, 0, 0); -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; box-sizing: border-box; z-index: 1; } rg-date .grid,[riot-tag="rg-date"] .grid { display: -webkit-flex; display: -ms-flexbox; display: flex; -webkit-align-items: center; -ms-flex-align: center; align-items: center; } rg-date .grid-wrap,[riot-tag="rg-date"] .grid-wrap { width: 100%; -webkit-flex-wrap: wrap; -ms-flex-wrap: wrap; flex-wrap: wrap; } rg-date .grid-row,[riot-tag="rg-date"] .grid-row { height: 35px; } rg-date .selector,[riot-tag="rg-date"] .selector { font-size: 2em; font-weight: 100; padding: 0; -webkit-flex: 0 0 15%; -ms-flex: 0 0 15%; flex: 0 0 15%; } rg-date .year,[riot-tag="rg-date"] .year,rg-date .month,[riot-tag="rg-date"] .month { text-transform: uppercase; font-weight: normal; -webkit-flex: 0 0 70%; -ms-flex: 0 0 70%; flex: 0 0 70%; } rg-date .fill,[riot-tag="rg-date"] .fill { -webkit-flex: 0 0 100%; -ms-flex: 0 0 100%; flex: 0 0 100%; } rg-date .day-name,[riot-tag="rg-date"] .day-name { font-weight: bold; -webkit-flex: 0 0 14.28%; -ms-flex: 0 0 14.28%; flex: 0 0 14.28%; } rg-date .date,[riot-tag="rg-date"] .date { -webkit-flex: 0 0 14.28%; -ms-flex: 0 0 14.28%; flex: 0 0 14.28%; padding: 12px 10px; box-sizing: border-box; font-size: 0.8em; font-weight: normal; border: 1px solid transparent; color: #cacaca; } rg-date .date:hover,[riot-tag="rg-date"] .date:hover { background-color: #f3f3f3; } rg-date .date.in,[riot-tag="rg-date"] .date.in { color: inherit; } rg-date .today,[riot-tag="rg-date"] .today { border-color: #ededed; } rg-date .selected,[riot-tag="rg-date"] .selected,rg-date .selected:hover,[riot-tag="rg-date"] .selected:hover { background-color: #ededed; border-color: #dedede; } rg-date .shortcut,[riot-tag="rg-date"] .shortcut { -webkit-flex: 0 0 100%; -ms-flex: 0 0 100%; flex: 0 0 100%; color: #6495ed; }', '', function (opts) {
  var _this = this;

  var handleClickOutside = function handleClickOutside(e) {
    if (!_this.root.contains(e.target)) _this.RgDate.close();
    _this.update();
  };

  var dayObj = function dayObj(dayDate) {
    var dateObj = dayDate || moment();

    return {
      date: dateObj,
      selected: _this.RgDate.date.isSame(dayDate, 'day'),
      today: moment().isSame(dayDate, 'day'),
      inMonth: _this.RgDate.date.isSame(dayDate, 'month')
    };
  };

  var buildCalendar = function buildCalendar() {
    var begin = moment(_this.RgDate.date).startOf('month');
    var end = moment(_this.RgDate.date).endOf('month');

    _this.days = [];
    _this.startBuffer = [];
    _this.endBuffer = [];

    for (var i = begin.weekday(); i >= 0; i -= 1) {
      var bufferDate = moment(begin).subtract(i, 'days');
      _this.startBuffer.push(dayObj(bufferDate));
    }

    for (var i = end.date() - 1; i > 0; i -= 1) {
      var current = moment(begin).add(i, 'days');
      _this.days.unshift(dayObj(current));
    }

    for (var i = end.weekday(); i < 6; i += 1) {
      var bufferDate = moment(end).add(i, 'days');
      _this.endBuffer.push(dayObj(bufferDate));
    }
  };

  this.on('mount', function () {
    _this.RgDate = opts.date || new RgDate(opts);
    _this.RgDate.on('update', function () {
      _this.update();
    });
    _this.on('update', function () {
      buildCalendar();
    });
    document.addEventListener('click', handleClickOutside);
    _this.update();
  });

  this.on('unmount', function () {
    document.removeEventListener('click', handleClickOutside);
  });

  this.open = function () {
    _this.RgDate.open();
  };

  this.prevYear = function () {
    _this.RgDate.prevYear();
  };

  this.nextYear = function () {
    _this.RgDate.nextYear();
  };

  this.prevMonth = function () {
    _this.RgDate.prevMonth();
  };

  this.nextMonth = function () {
    _this.RgDate.nextMonth();
  };

  this.setToday = function () {
    _this.RgDate.setToday();
  };

  this.select = function (e) {
    _this.RgDate.select(e.item.day.date);
  };
}, '{ }');

riot.tag2('rg-drawer', '<div class="overlay {visible: RgDrawer.isvisible}" onclick="{close}"></div> <div class="drawer {RgDrawer.position} {visible: RgDrawer.isvisible}"> <h4 class="header">{RgDrawer.header}</h4> <ul class="items"> <li class="item {active: active}" each="{RgDrawer.items}" onclick="{parent.select}"> <rg-raw content="{content}"></rg-raw> </li> </ul> <div class="body"> <yield></yield> </div> </div>', 'rg-drawer .overlay,[riot-tag="rg-drawer"] .overlay { display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); cursor: pointer; z-index: 50; } rg-drawer .overlay.visible,[riot-tag="rg-drawer"] .overlay.visible { display: block; } rg-drawer .drawer,[riot-tag="rg-drawer"] .drawer { position: absolute; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background-color: white; color: black; transition: transform 0.5s ease; z-index: 51; } rg-drawer .drawer.bottom,[riot-tag="rg-drawer"] .drawer.bottom { top: 100%; left: 0; height: auto; width: 80%; margin-left: 10%; transform: translate3d(0, 0, 0); } rg-drawer .drawer.bottom.visible,[riot-tag="rg-drawer"] .drawer.bottom.visible { transform: translate3d(0, -100%, 0); } rg-drawer .drawer.top,[riot-tag="rg-drawer"] .drawer.top { bottom: 100%; left: 0; height: auto; width: 80%; margin-left: 10%; transform: translate3d(0, 0, 0); } rg-drawer .drawer.top.visible,[riot-tag="rg-drawer"] .drawer.top.visible { transform: translate3d(0, 100%, 0); } rg-drawer .drawer.left,[riot-tag="rg-drawer"] .drawer.left { top: 0; left: 0; height: 100%; width: 260px; transform: translate3d(-100%, 0, 0); } rg-drawer .drawer.left.visible,[riot-tag="rg-drawer"] .drawer.left.visible { transform: translate3d(0, 0, 0); } rg-drawer .drawer.right,[riot-tag="rg-drawer"] .drawer.right { top: 0; left: 100%; height: 100%; width: 260px; transform: translate3d(0, 0, 0); } rg-drawer .drawer.right.visible,[riot-tag="rg-drawer"] .drawer.right.visible { transform: translate3d(-100%, 0, 0); } rg-drawer .header,[riot-tag="rg-drawer"] .header { padding: 1.2rem; margin: 0; text-align: center; } rg-drawer .items,[riot-tag="rg-drawer"] .items { padding: 0; margin: 0; list-style: none; } rg-drawer .item,[riot-tag="rg-drawer"] .item { padding: 1rem 0.5rem; box-sizing: border-box; border-top: 1px solid #E8E8E8; } rg-drawer .item:last-child,[riot-tag="rg-drawer"] .item:last-child { border-bottom: 1px solid #E8E8E8; } rg-drawer .item:hover,[riot-tag="rg-drawer"] .item:hover { cursor: pointer; background-color: #E8E8E8; } rg-drawer .item.active,[riot-tag="rg-drawer"] .item.active { cursor: pointer; background-color: #EEE; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgDrawer = opts.drawer || new RgDrawer(opts);
    _this.RgDrawer.on('update', function () {
      _this.update();
    });
    _this.update();
  });

  this.close = function () {
    _this.RgDrawer.close();
  };

  this.select = function (e) {
    _this.RgDrawer.select(e.item);
  };
}, '{ }');

riot.tag2('rg-ga', '', '', '', function (opts) {

  (function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;i[r] = i[r] || function () {
      (i[r].q = i[r].q || []).push(arguments);
    }, i[r].l = 1 * new Date();a = s.createElement(o), m = s.getElementsByTagName(o)[0];a.async = 1;a.src = g;m.parentNode.insertBefore(a, m);
  })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

  ga('create', opts.property, 'auto');
  ga('send', 'pageview');
});

riot.tag2('rg-include', '<div> {responseText} </div>', '', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgInclude = opts.include || new RgInclude(opts);
    _this.RgInclude.on('update', function () {
      _this.RgInclude.fetch();
    });
    _this.RgInclude.on('fetch', function (content) {
      if (_this.RgInclude.unsafe) _this.root.innerHTML = content;else _this.responseText = content;
      _this.update();
    });
    _this.RgInclude.fetch();
  });
}, '{ }');

riot.tag2('rg-loading', '<div class="loading {visible: RgLoading.isvisible}"> <div class="overlay"></div> <div class="content"> <yield></yield> </div> </div>', 'rg-loading .loading,[riot-tag="rg-loading"] .loading { display: none; } rg-loading .visible,[riot-tag="rg-loading"] .visible { display: block; } rg-loading .overlay,[riot-tag="rg-loading"] .overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); z-index: 200; } rg-loading .content,[riot-tag="rg-loading"] .content { position: absolute; width: 95%; max-width: 420px; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background-color: transparent; color: #fff; text-align: center; z-index: 201; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgLoading = opts.loading || new RgLoading(opts);
    _this.RgLoading.on('update', function () {
      _this.update();
    });
    _this.update();
  });
}, '{ }');

riot.tag2('rg-map', '<div class="rg-map"></div>', 'rg-map .rg-map,[riot-tag="rg-map"] .rg-map { margin: 0; padding: 0; width: 100%; height: 100%; } rg-map .rg-map img,[riot-tag="rg-map"] .rg-map img { max-width: inherit; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgMap = opts.map || new RgMap(opts);

    rg.map.on('initialize', function () {
      rg.map.obj = new google.maps.Map(_this.root.querySelector('.rg-map'), _this.RgMap.options);
    });

    if (!document.getElementById('gmap_script')) {
      var script = document.createElement('script');
      script.setAttribute('id', 'gmap_script');
      script.type = 'text/javascript';
      script.src = 'https://maps.googleapis.com/maps/api/js?callback=rg.map.initialize';
      document.body.appendChild(script);
    }
  });
});

riot.tag2('rg-markdown', '<div class="markdown"></div>', '', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgMarkdown = opts.markdown || new RgMarkdown(opts);
    _this.RgMarkdown.on('update', function () {
      _this.RgMarkdown.fetch();
    });
    _this.RgMarkdown.on('fetch', function (md) {
      _this.RgMarkdown.parse(md);
    });
    _this.RgMarkdown.on('parse', function (content) {
      _this.root.innerHTML = content;
      _this.update();
    });
    _this.RgMarkdown.fetch();
  });
});

riot.tag2('rg-modal', '<div class="overlay {visible: RgModal.isvisible, ghost: RgModal.ghost, dismissable: RgModal.dismissable}" onclick="{close}"></div> <div class="modal {visible: RgModal.isvisible, ghost: RgModal.ghost, dismissable: RgModal.dismissable}"> <header class="header"> <button if="{RgModal.dismissable}" type="button" class="close" aria-label="Close" onclick="{close}"> <span aria-hidden="true">&times;</span> </button> <h3 class="heading"><rg-raw content="{RgModal.heading}"></rg-raw></h3> </header> <div class="body"> <yield></yield> </div> <footer class="footer"> <button class="button" each="{RgModal.buttons}" type="button" onclick="{action}" riot-style="{style}"> <rg-raw content="{content}"></rg-raw> </button> <div class="clear"></div> </footer> </div>', 'rg-modal .overlay,[riot-tag="rg-modal"] .overlay { display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); z-index: 100; } rg-modal .overlay.dismissable,[riot-tag="rg-modal"] .overlay.dismissable { cursor: pointer; } rg-modal .modal,[riot-tag="rg-modal"] .modal { display: none; position: absolute; width: 95%; max-width: 500px; font-size: 1.1em; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background-color: white; color: #252519; z-index: 101; } rg-modal .modal.ghost,[riot-tag="rg-modal"] .modal.ghost { background-color: transparent; color: white; } rg-modal .visible,[riot-tag="rg-modal"] .visible { display: block; } rg-modal .header,[riot-tag="rg-modal"] .header { position: relative; text-align: center; } rg-modal .heading,[riot-tag="rg-modal"] .heading { padding: 20px 20px 0 20px; margin: 0; font-size: 1.2em; } rg-modal .modal.ghost .heading,[riot-tag="rg-modal"] .modal.ghost .heading { color: white; } rg-modal .close,[riot-tag="rg-modal"] .close { position: absolute; top: 5px; right: 10px; padding: 0; font-size: 1.2em; border: 0; background-color: transparent; color: #000; cursor: pointer; outline: none; } rg-modal .modal.ghost .close,[riot-tag="rg-modal"] .modal.ghost .close { color: white; } rg-modal .body,[riot-tag="rg-modal"] .body { padding: 20px; } rg-modal .footer,[riot-tag="rg-modal"] .footer { padding: 0 20px 20px 20px; } rg-modal .button,[riot-tag="rg-modal"] .button { float: right; padding: 10px; margin: 0 5px 0 0; border: none; font-size: 0.9em; text-transform: uppercase; cursor: pointer; outline: none; background-color: white; } rg-modal .modal.ghost .button,[riot-tag="rg-modal"] .modal.ghost .button { color: white; background-color: transparent; } rg-modal .clear,[riot-tag="rg-modal"] .clear { clear: both; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgModal = opts.modal || new RgModal(opts);
    _this.RgModal.on('update', function () {
      _this.update();
    });
    _this.update();
  });

  this.close = function () {
    if (_this.RgModal.dismissable) _this.RgModal.isvisible = false;
  };
}, '{ }');

riot.tag2('rg-phone-sim', '<div class="emulator"> <iframe class="screen" riot-src="{RgPhoneSim.url}"></iframe> </div>', 'rg-phone-sim .emulator,[riot-tag="rg-phone-sim"] .emulator { position: relative; width: 365px; height: 792px; background-image: url(\'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAW0AAAMYCAMAAAA3r0ZLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAwBQTFRFMDk6+vr6KTM0lJucMz4/PklKJS8wLTg5Qk1OxsjILzo7gomJ2NvbdH5/ho2O9fb2KzY3ztHRPEdIOkVGZWxtjJSVOEJDkpeYWGRluL2+KTQ1vcHBoaWlPUZHcnp6nKKjOkRF1NfXqa2tp62tZnBxanV2VmFiZ29wVl1eaXJzbXR04uTktbq7QElK1tnZipKTi5CRTlZXpKioo6mqXmlqUVlaOEFCSVFSUFxdISssT1tcTlpbJC4vIiwtTVlaJjAxIy0uTFhZS1dYJzEyKDIzSlZXPUhJOURFO0ZHSVVWKzU2P0pLKjQ1OENEND0+QEtMLDY3SFRVN0JDQ05PLTc4ND9ANUBBQUxNNkFCR1NUMTo7RE9QLjg5N0BBR1JTRlJTLzk6RVFSMjs8RVBRRlFSNj9AMzw9SFNUMj0+IissMTs8MDo7SVRVRFBRMDs8MTw9IiwsMz0+Mjw9SlVWQ09QLjk6NT4/S1ZXND4/JC4uQU1OIy0tQk5PTFdYTVhZQExNTllaJS8vJzIyP0tMLzg5LDc4KDMzNT9AKjU1N0FCNkBBJjAwIywtMDs7Mj09NkFBJjExLjk5LDc3N0JCNUBAKjU2MTw8LDU2Ljc4OUNEKDEyQU1NPEhIPEhJO0dHOkZGND8/Qk5ORFBQQ09PLTY3OUREPkpKPkpLPUlJT1pbP0tLJTAwPUlKJzAxKjM07u/vKTIzsbW2YGprtLm50tXWPkhJo6endn+A3d/f6uvreoOEg4yN2tvc/Pz8n6am8/T0VFtcm6CgJS4v4OLi5ufnYGdncnt8dHp7gYaHJC0uu8DAjJGRQkxNxMfHKzQ1YGtsS1NUaXN0bnh5yMzMyszMy83Oy8/PdoCAKDIy7O3tT1dYuLu70NTUbXd46Onq6erreoCA2dzc8PHx8vPz5OXlnaSkn6Wmqq6ucHZ2t7y8o6eoeoSEkJaWm5+gW2ZnZG5vqa+wOEFB09bWtru7qrCwcXd4t7u83eDgzM7O7/DwNT4+7e7uwMPDwcPEeH5/////70wnUQAAAQB0Uk5T////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AFP3ByUAAA+NSURBVHja7N13nBTlGcDxEQI5AmJQBAkcnqhEDIhoWMt5iogmQbOaYNrqYrJh16gplmTVkILJpYCmF+DSE1JIcjRR7L333ntPYjQxvTl55tnr7N7t7uw+vDP3+/0x3G3hs5+vr++8M7s7eH75Xb5x+rOjN017aeq+tO++U1+atmn0s9M3Xl6BoFfm466ZOPROhIt259CJ19RS++7LdgW133a97O7aaI/a+VE0y+jRnUeF1p6wqfvvaz6+YVjT0jMyJ3rkeSdmzljaNKzh+OZuoE0TQmmvv67zLzrwmMY8wkXLNx5zYCfTdeur1p6wdeegblgKar8tbegc4lv/rirtjTMLT99/UVMKzgFLNS3avwA2c2Pl2n8tPHV1QxLJMks2rC6g/alC7ScvKozrhhyIFZRrKIzvi56sRHt94b/RIsZ1xeN7UYFuffna4/UJB68Er4rGHax648vUfmqkPnxBBrmqyixQv5FPlaP9Dz2eWdIEW9U1LdFjnQsG1n5ETz4dyowdavY+VE9XPTKQ9phddPfICjvk6lt3lruM6V97j132l26BK3S3BJAv79Gf9jN3BY85HKsadHhAedebSmtf+ofgEcOQqknDAsyLLi2pPTq4/0icatSRAefoUto7Bvc2oFSzGgLQHYtr3xTct5DVSA1XJgsD0puKaa99s9wzlwPImh5WzhXTl/5TRHt7uaN5GUI1bVmzqL64ufZfgkF/GD417rCA9e99tf8VzCPHoVPzjhPXaVv10d5bblzCyZE6nDIJ5pKde2u/Egz487Cp1zHlHr20h8otp50ETT2WgaeL7dCe2vcF/uOQqUsrA9z7emgHQ3thdEZLLpeL0kHYwq7BrdqjAv2ofEAnlU0EZaPjvTTgHdWlvXeEhnYu0VkuUoN7707tbW6X35oiciyc6C4yZxmaxPf2bTq0z5VfTo/IC8/20M5GZnAHy5JzO7Tvj85bCKlEzyIzdQdvLNxf0L4wmMQjMgnmemlHZubOBcQXqvb0CO0jk720o3OmIdhPTlft4FTrth5ju55tK8bbq/YG+emUiLzqTC/t6Lz1cYoYbwi0r47QisTz0j2w0xE6ngxWJVeLdrD+WxCZVx3J9ba0QNeAnj9T/twuOi87GcF9pLSdKM8U7Q2rV6+O0jcQMoXJJB2t96tzorzB99Y2NzfPjdQL9zLJZDJynw2YK85rvZ1ku9Cjuq+4xXknb4Js+XxU/WsQ5wnec7LlDcn6d544P+ddLFu+zlT/Vorzxd5k2fIJqfq3TJwney/Lls+RGBwniPPL3g6y5aOWBstWcd7BmypbLjhS/1LiPNWTTTMWBik02mijTWijTWijjTbFVTuZTqSTRW8OUzqJdpGyxT89mU2ELYv25kO4+LvnyUT4kmj3LV38YzjpGmin3dReIm2pF9BlU+LmMDmnrdBbUntQje0trj2o5m2FPlBiTWKQQm9R7cG03nZAexCFNtpoE9poE9poo01oo01oo01oo4021VT7MxIUBik02mijTeG1D5agMEih0UYbbUIbbUIbbbQJbbQJbbQJbbTRplppf1qCwiCFRhtttCm89lwJCoMUGm200Sa00Sa00Uab0Eab0Eab0EY73tqnS1AYpNBoo402hdc+VILCIIVGG220CW20CW200Sa00Sa00aYC9GkSFAYpNNpoo01oR0v7bRIUBik02mijTWijTWijjTahjTah7bL2hyUoDFJotNFGm9BGm0ppv0OCwiCFRhtttAlttAlttNEmtOOhfbwEhUEKjTbaaBPaaBPaLmi/T4LCIIVGG220CW20CW200ab6aS+UoDBIodFGG21CG21C2wXt4yQoDFJotNFGm9BGm9BGe7BpL5KgMEih0UYbbUIbbULbBe0PSFAYpNBoo402oY02oY32YNP+oASFQQqNNtpoE9poE9poDzbtj0hQGKTQaKONNqGNNpXS/qkEhUEKfYwEhUEKjTbaaBPaaBPaaA827Y9LUBik0GijjTahHS3tn0lQGKTQCyQoDFJotNFGm9BGm9BGG22qn/anJCgMUmi00Uabwmv/RILCIIVukKAwSKHRRhttQhttQhtttKl+2p+UoDBIodFGG20Kr/09CQqDFPo9EhQGKTTaaKNNaKNNaKONNtVP+7MSFAYpNNpoo03htY+UoDBIodFGG21CG21CG220Ce14aH9egsIghUYb7bhq/1qCwiCFPlyCwiCFRhtttAlttAlttNEmtNGmSrV/KUFhkEL/QoLCIIUeJkFhkEKjjTbahDbahDbaaBPaaFOl2r+VoDBIoX8lQWGQQh8mQWGQQqONNtqENtqENtpoE9poE9oua/9AgsIghf6+BIVBCr2tBIVBCo022mgT2mgT2mijTWijTWi7rP1DCQqDFPqtEhQGKTTaaKNNaKNNaKONNqGNNqHtsvaPJCgMUujtJCgMUmi00Uab0Eab0EYbbUIbbUIbbSpAv0WCwiCFRhtttAlttAlttNEmtNEmtF3W/rkEhUEKvVKCwiCFfrsEhUEKjTbaaBPaaBPaaKNNaKNNaLusPU6CwiCFfqcEhUEKjTbaaBPaaBPaaKNNaMdD+1sSFAYpNNqW2kslKAxSaLQttd8rQWGQQqONNtqENtqENtpoU/20vyZBYZBCo22pvUyCwiCFRttS+90SFAYpNNpoo01oo01oo4021U/72xIUBik02pbaX5KgMEih0UY7rtrvkqAwSKHRRhttQhttQhtttKl+2j+WoDBIoc+QoDBIodFGG20Kr/0aCQqDFBpttNEmtNEmtNFGm+qnfYoEhUEKjTbaaBPa0dL+kASFQQqNNtpoE9poE9ouaH9VgsIghUbbUvtUCQqDFBpttNEmtKOl/TEJCoMUGm200Sa00aZS2t+VoDBIodG21D5RgsIghUYbbbQJbbSplPZHJSgMUmi00Uab0EabSml/RYLCIIVG21L7JAkKgxQabbTRJrTRplLar5OgMEih0UYbbUIbbULbBe33S1AYpNBoo402oY02oY32YNP+hASFQQqNNtpoE9rR0v6GBIVBCo22pfaxEhQGKTTaaKNNaKNNaKM92LRfK0FhkEKjjTbahDbaVEr7aAkKgxQabbTRJrTRJrTRRpvqp/0FCQqDFBpttOOq/U0JCoMUGm1L7aMkKAxSaLTRRpvQRpvQRhttQjse2q+XoDBIodFGG21CO1ra8yUoDFJotNFGm9BGm9BGG21CG22qVPs7EhQGKTTaltpflqAwSKHRRjuu2kdIUBik0GijjTahjTahjTbahDbaVKn2GyQoDFJotNFGm8JrD5GgMEih0UYbbUIbbUIbbbQJbbQJbbSpAP1FCQqDFBpttNGm8NrzJCgMUmi00Uab0Eab0EYbbUIbbUIbbULbXvtzEhQGKTTaaMdV+xAJCoMUGm200Sa00Sa00Uab0Eab0Eab0EY73tpfl6AwSKHRttQ+SILCIIVGG220CW20CW200Sa00Sa00Sa00UabaqV9tgSFQQqNtqX2byQoDFLo4RIUBik02mijTWijTWijjTahjTahjTZFVTuVymQyqRTa9S6TzGcTnaWz+VwK7TqVyyc2L5tMoV376SOZTpQom4uO9lmS+9b5RH+lo+Ct0FHQTiYGKptCu0a7xj5zSDqdzmbTfSeWZCS0D5AiM7DT+Vyme3rJJLMRGt4K7bp2D9B8psjOs8f9GbRD7h67MUst9TLdD8mhHQq7a3bO9zNP5CIxebuvnS5v1HYvEHNoh56z8wPuAHPuz92ua+crmB+6uFNoV3depKLJuPPRabSr2kNWuOfrfHwe7eon7WTF/y9k0K52HslW/pQ02tUu/ira6SVdXnW7rJ2sav2cdnhwu6ydrnge0aN4hwe3w9q5Knd4eXcHt8Pa2SoXcxl3lyXuaqeqRss7u+Z2VztZ1azdY3C7qn2m5OhEUtUJvbSrU4lCO6kd4gRT3tVVibPamaonknDPHZzayTDj09WJW6HnSK69sHyY92HSjp7mVmgXtbNh9nRZR3eTzmqHGp55R9+gRBvtsDu6pKNLQLTRRjt687aj2kfJppW9ZN1rFeflau6adhzX2606hzTKdgXHknXvWHFu9GbJ9mjOk9S9o8V5lje2MJ84VRzPAS4X57HeaNmucXMJGKvz22vEebQ3RbbzXHtpMXzvZp44T/Huka1zl82N4fuSB4nzPd7jsnXubeAYvud+gDg/7vnjHFxwx+/zJMFye5zv+bvLn/Nde3Gx+6zUfFHeXbQnLV68+AHnXl3cPgf4gChPEu1R8qd7372O22dczxLlUaLt/1l+aHV0cMfl89utYvxvP9B+QX66zbnXF6/vJtwmxrur9vnyk4MX84/V927O1mk70H7mHMm9qSRO3ylrDYifUW3/CvlxjefqXBKH70uuEeEr/IL2pJaWFhe/DVLVd4Gd/P7eASI8qUP76YT8stzBF1nF99ydvKzAcvFNPN2h7d8sv7l44bRUxddwcPPLe8PF92a/U3uM/NayymnuKF+fZFXAO6ZL23/C0cEdj2vvBEP7Cb9be2KLozN3HK4rFczaLRN7aPuvOros8WJwzbRgQfKq31N7ROC/xs1Xu/n1ALNRuh7gkID23l7a/p5y05xjPfeHd9Sudblijsi+6PfWvjApNzr7z3pG+DquB4nrjG36aPu/d3gu8aJ7jeI1Aetefl9t/wVXF91dy+piAzzt9vW3dan9N39z7cdODdYlrS6/9shdW741WI+c+lgRbf/5FlePcfpMKtH5dxOC45qW5/1i2v7I4L42j2pVWwA60i+u7Y8N7l2HUo1aF3CO9Utpb7VbcP8QnGp3WLPbViW1/Uv2gbum2Ptc4pfW9v/ZGDxmHlahmxdANt7r96ft/0+521vhCrf0a1fs//r9a/u3zjhZumoFYmFOjlwVIM641R9I239ldvDIxcsxq7rliwPC2a/4A2v7D14bPPbkNmaTKmeRNvW79kG/HG3fn6wPP5PhXdXAPlP1JheDLartX6lPOPlsZu+KZ+z2At2Vfvna/pjdTtCYTiqcRApsV6z3K9H2/fGF553Txvgue1y3nVNAG18KtaS2P2Ja4akntDN/lzVft3d4vXGEX7m27+81q+P5N7atQrPfVrXd2GE1a69+RPvTlr3lHft11NJ+BFNKiQnkiPaWTqY7/tivZ//avn/+7P26ahl+yJD5q1a0sufUPWLrilXzhxwyvKUbaPb5A2gOpC3z956N+9HANe05YkDLgbWlh0fOQLPfZox8uBzIsrSlC6Zcj3gJ6eunXFCmYrnaQWtHTLph7EONresQlta1Nj409oZJI9ZWIPh/AQYA2whzWlA9R/cAAAAASUVORK5CYII=\'); background-repeat: no-repeat; background-position: center; background-size: cover; } rg-phone-sim .screen,[riot-tag="rg-phone-sim"] .screen { position: absolute; top: 105px; left: 22px; background-color: white; width: 320px; height: 568px; border: 0; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgPhoneSim = opts.phonesim || new RgPhoneSim(opts);
    _this.RgPhoneSim.on('update', function () {
      _this.update();
    });
    _this.update();
  });
}, '{ }');

riot.tag2('rg-placeholdit', '<img riot-src="https://placeholdit.imgix.net/~text?bg={RgPlaceholdit.background}&txtclr={RgPlaceholdit.color}&txt={RgPlaceholdit.text}&txtsize={RgPlaceholdit.textsize}&w={RgPlaceholdit.width}&h={RgPlaceholdit.height}&fm={RgPlaceholdit.format}">', '', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgPlaceholdit = opts.placeholdit || new RgPlaceholdit(opts);
    _this.RgPlaceholdit.on('update', function () {
      _this.update();
    });
    _this.update();
  });
}, '{ }');

riot.tag2('rg-raw', '<span></span>', '', '', function (opts) {
  this.on('mount update', function () {
    this.root.innerHTML = opts.content || '';
  });
});

riot.tag2('rg-select', '<div class="container {visible: RgSelect.isvisible}" riot-style="width: {width}"> <input if="{!RgSelect.autocomplete}" type="text" name="selectfield" class="field {visible: RgSelect.isvisible}" value="{fieldText}" placeholder="{RgSelect.placeholder}" onkeydown="{handleKeys}" onclick="{toggle}" readonly> <input if="{RgSelect.autocomplete}" type="text" name="autocompletefield" class="field {visible: RgSelect.isvisible}" value="{fieldText}" placeholder="{RgSelect.placeholder}" onkeydown="{handleKeys}" onclick="{toggle}" oninput="{filter}"> <div class="dropdown {isvisible: RgSelect.isvisible} {empty: RgSelect.filtereditems.length == 0}"> <div class="filter" if="{RgSelect.hasfilter && !RgSelect.autocomplete}"> <input type="text" name="filterfield" class="filter-box" placeholder="{RgSelect.filterplaceholder || \'Filter\'}" onkeydown="{handleKeys}" oninput="{filter}"> </div> <ul class="list {empty: RgSelect.filtereditems.length == 0}"> <li each="{RgSelect.filtereditems}" onclick="{parent.select}" class="item {selected: selected, disabled: disabled, active: active}"> {text} </li> </ul> </div> </div>', 'rg-select .container,[riot-tag="rg-select"] .container { position: relative; display: inline-block; cursor: pointer; } rg-select .field,[riot-tag="rg-select"] .field { width: 100%; padding: 10px; border: 1px solid #D3D3D3; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1em; line-height: normal; outline: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-select .dropdown,[riot-tag="rg-select"] .dropdown { display: none; position: absolute; width: 100%; background-color: white; border-bottom: 1px solid #D3D3D3; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; max-height: 280px; z-index: 10; } rg-select .dropdown.isvisible,[riot-tag="rg-select"] .dropdown.isvisible { display: block; } rg-select .dropdown.empty,[riot-tag="rg-select"] .dropdown.empty { border-bottom: 0; } rg-select .filter-box,[riot-tag="rg-select"] .filter-box { width: 100%; padding: 10px; font-size: 0.9em; border: 0; border-left: 1px solid #D3D3D3; border-right: 1px solid #D3D3D3; border-bottom: 1px solid #E8E8E8; outline: none; color: #555; box-sizing: border-box; } rg-select .list,[riot-tag="rg-select"] .list,rg-select .item,[riot-tag="rg-select"] .item { list-style: none; padding: 0; margin: 0; } rg-select .list.empty,[riot-tag="rg-select"] .list.empty { display: none; } rg-select .item,[riot-tag="rg-select"] .item { padding: 10px; border-left: 1px solid #D3D3D3; border-right: 1px solid #D3D3D3; border-top: 1px solid #E8E8E8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } rg-select .item:first-child,[riot-tag="rg-select"] .item:first-child { border-top: 0; } rg-select .selected,[riot-tag="rg-select"] .selected { font-weight: bold; background-color: #f8f8f8; } rg-select .item:hover,[riot-tag="rg-select"] .item:hover { background-color: #f3f3f3; } rg-select .item.active,[riot-tag="rg-select"] .item.active,rg-select .item:hover.active,[riot-tag="rg-select"] .item:hover.active { background-color: #ededed; }', '', function (opts) {
  var _this = this;

  var handleClickOutside = function handleClickOutside(e) {
    if (!_this.root.contains(e.target)) {
      _this.RgSelect.close();
      _this.update();
    }
  };

  this.handleKeys = function (e) {
    if ([13, 38, 40].indexOf(e.keyCode) > -1 && !_this.RgSelect.isvisible) {
      e.preventDefault();
      _this.toggle();
      return true;
    }
    if (_this.RgSelect.autocomplete && !_this.RgSelect.isvisible) _this.toggle();
    var length = _this.RgSelect.filtereditems.length;
    if (length > 0 && [13, 38, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault();

      var activeIndex = null;
      for (var i = 0; i < length; i++) {
        var item = _this.RgSelect.filtereditems[i];
        if (item.active) {
          activeIndex = i;
          break;
        }
      }

      if (activeIndex != null) _this.RgSelect.filtereditems[activeIndex].active = false;

      if (e.keyCode == 38) {
        if (activeIndex == null || activeIndex == 0) _this.RgSelect.filtereditems[length - 1].active = true;else _this.RgSelect.filtereditems[activeIndex - 1].active = true;
      } else if (e.keyCode == 40) {
        if (activeIndex == null || activeIndex == length - 1) _this.RgSelect.filtereditems[0].active = true;else _this.RgSelect.filtereditems[activeIndex + 1].active = true;
      } else if (e.keyCode == 13 && activeIndex != null) {
        _this.select({ item: _this.RgSelect.filtereditems[activeIndex] });
      }
    }
    return true;
  };

  this.toggle = function () {
    _this.RgSelect.toggle();
  };

  this.filter = function () {
    var text = _this.filterfield.value;
    if (_this.RgSelect.autocomplete) text = _this.autocompletefield.value;
    _this.RgSelect.filter(text);
  };

  this.select = function (item) {
    item = item.item;
    _this.RgSelect.select(item);
  };

  this.on('mount', function () {
    _this.RgSelect = opts.select || new RgSelect(opts);
    _this.RgSelect.on('update', function () {
      if (_this.RgSelect.isvisible) _this.filter();
      _this.update();
    });
    _this.RgSelect.on('select', function (item) {
      _this.selectfield.value = item[_this.RgSelect.filteron];
      _this.autocompletefield.value = item[_this.RgSelect.filteron];
      _this.update();
    });
    document.addEventListener('click', handleClickOutside);

    _this.filter();
    _this.update();
  });

  this.on('unmount', function () {
    document.removeEventListener('click', handleClickOutside);
  });
}, '{ }');

riot.tag2('rg-sidemenu', '<rg-drawer drawer="{RgSidemenu}">', 'rg-sidemenu .overlay,[riot-tag="rg-sidemenu"] .overlay { background-color: rgba(0, 0, 0, 0.8); } rg-sidemenu .overlay.visible,[riot-tag="rg-sidemenu"] .overlay.visible { display: block; } rg-sidemenu .drawer,[riot-tag="rg-sidemenu"] .drawer { background-color: black; color: white; } rg-sidemenu .header,[riot-tag="rg-sidemenu"] .header { color: white; } rg-sidemenu .item,[riot-tag="rg-sidemenu"] .item { border-top: 1px solid #1a1a1a; color: white; } rg-sidemenu .item:last-child,[riot-tag="rg-sidemenu"] .item:last-child { border-bottom: 1px solid #1a1a1a; } rg-sidemenu .item:hover,[riot-tag="rg-sidemenu"] .item:hover { background-color: #2a2a2a; } rg-sidemenu .item.active,[riot-tag="rg-sidemenu"] .item.active { background-color: #444; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgSidemenu = opts.sidemenu || new RgSidemenu(opts);
    _this.RgSidemenu.position = 'left';
    _this.RgSidemenu.on('update', function () {
      _this.update();
    });
    _this.update();
  });
}, '{ }');

riot.tag2('rg-tabs', '<div class="headers"> <div each="{RgTabs.tabs}" class="header {active: active, disabled: disabled}" onclick="{parent.select}"> <div class="heading" if="{heading}"> <rg-raw content="{heading}"></rg-raw> </div> </div> </div> <div each="{RgTabs.tabs}" class="tab {active: active}"> <div if="{rg.isDefined(content)}"> {content} </div> <div if="{rg.isDefined(include)}"> <rg-include include="{include}"></rg-include> </div> </div>', 'rg-tabs .headers,[riot-tag="rg-tabs"] .headers { display: -webkit-flex; display: -ms-flexbox; display: flex; } rg-tabs .header,[riot-tag="rg-tabs"] .header { -webkit-flex: 1; -ms-flex: 1; flex: 1; box-sizing: border-box; text-align: center; cursor: pointer; box-shadow: 0 -1px 0 0 #000 inset; } rg-tabs .heading,[riot-tag="rg-tabs"] .heading { padding: 10px; margin: 0; } rg-tabs .header.active,[riot-tag="rg-tabs"] .header.active { background-color: #000; } rg-tabs .header.active .heading,[riot-tag="rg-tabs"] .header.active .heading { color: white; } rg-tabs .header.disabled .heading,[riot-tag="rg-tabs"] .header.disabled .heading { color: #888; } rg-tabs .tab,[riot-tag="rg-tabs"] .tab { display: none; padding: 10px; } rg-tabs .tab.active,[riot-tag="rg-tabs"] .tab.active { display: block; }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgTabs = opts.tabs || new RgTabs(opts);
    _this.RgTabs.on('update', function () {
      _this.update();
    });
    _this.update();
  });

  this.select = function (e) {
    _this.RgTabs.select(e.item);
  };
}, '{ }');

riot.tag2('rg-tags', '<div class="container"> <span class="tags"> <span class="tag" each="{RgTags.tags}" onclick="{parent.removeTag}"> {text} <span class="close">&times;</span> </span> </span> <div class="field-container {isvisible: RgTags.isvisible}"> <input type="text" class="field" name="filterfield" placeholder="{RgTags.placeholder}" onkeydown="{handleKeys}" oninput="{filter}" onfocus="{toggle}"> <div class="dropdown {isvisible: RgTags.isvisible}"> <ul class="list"> <li each="{RgTags.filtereditems}" onclick="{parent.addTag}" class="item {disabled: disabled, active: active}"> {text} </li> </ul> </div> </div> </div>', 'rg-tags .container,[riot-tag="rg-tags"] .container { position: relative; width: 100%; border: 1px solid #D3D3D3; background-color: white; text-align: left; padding: 0; box-sizing: border-box; } rg-tags .field-container,[riot-tag="rg-tags"] .field-container { position: absolute; display: inline-block; cursor: pointer; } rg-tags .field,[riot-tag="rg-tags"] .field { width: 100%; padding: 10px; border: 0; box-sizing: border-box; background-color: transparent; white-space: nowrap; font-size: 1em; line-height: normal; outline: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-tags .dropdown,[riot-tag="rg-tags"] .dropdown { display: none; position: absolute; width: 100%; background-color: white; border-bottom: 1px solid #D3D3D3; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; max-height: 280px; margin: -1px 0 0 -1px; } rg-tags .dropdown.isvisible,[riot-tag="rg-tags"] .dropdown.isvisible { display: block; } rg-tags .list,[riot-tag="rg-tags"] .list,rg-tags .item,[riot-tag="rg-tags"] .item { list-style: none; padding: 0; margin: 0; } rg-tags .list.empty,[riot-tag="rg-tags"] .list.empty { display: none; } rg-tags .item,[riot-tag="rg-tags"] .item { padding: 10px; border-left: 1px solid #D3D3D3; border-right: 1px solid #D3D3D3; border-top: 1px solid #E8E8E8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } rg-tags .item:first-child,[riot-tag="rg-tags"] .item:first-child { border-top: 0; } rg-tags .item:hover,[riot-tag="rg-tags"] .item:hover { background-color: #f3f3f3; } rg-tags .item.active,[riot-tag="rg-tags"] .item.active,rg-tags .item:hover.active,[riot-tag="rg-tags"] .item:hover.active { background-color: #ededed; } rg-tags .tags,[riot-tag="rg-tags"] .tags { display: inline-block; max-width: 70%; white-space: nowrap; overflow-y: hidden; overflow-x: auto; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; } rg-tags .tag,[riot-tag="rg-tags"] .tag { position: relative; display: inline-block; padding: 8px 20px 8px 5px; margin: 1px; background-color: #000; color: #fff; font-size: 1em; line-height: normal; cursor: pointer; } rg-tags .tag:hover,[riot-tag="rg-tags"] .tag:hover,rg-tags .tag:active,[riot-tag="rg-tags"] .tag:active { background-color: #666; } rg-tags .close,[riot-tag="rg-tags"] .close { position: absolute; right: 5px; top: 7px; color: rgba(255, 255, 255, 0.7); }', '', function (opts) {
  var _this = this;

  var handleClickOutside = function handleClickOutside(e) {
    if (!_this.root.contains(e.target)) {
      _this.RgTags.close();
    }
  };

  this.handleKeys = function (e) {
    if ([13, 38, 40].indexOf(e.keyCode) > -1 && !_this.RgTags.isvisible) {
      e.preventDefault();
      _this.toggle();
      return true;
    }
    if (!_this.RgTags.isvisible) _this.toggle();
    var length = _this.RgTags.filtereditems.length;
    if (length > 0 && [13, 38, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault();

      var activeIndex = null;
      for (var i = 0; i < length; i++) {
        var item = _this.RgTags.filtereditems[i];
        if (item.active) {
          activeIndex = i;
          break;
        }
      }

      if (activeIndex != null) _this.RgTags.filtereditems[activeIndex].active = false;

      if (e.keyCode == 38) {
        if (activeIndex == null || activeIndex == 0) _this.RgTags.filtereditems[length - 1].active = true;else _this.RgTags.filtereditems[activeIndex - 1].active = true;
      } else if (e.keyCode == 40) {
        if (activeIndex == null || activeIndex == length - 1) _this.RgTags.filtereditems[0].active = true;else _this.RgTags.filtereditems[activeIndex + 1].active = true;
      } else if (e.keyCode == 13 && activeIndex != null) {
        _this.addTag({
          item: _this.RgTags.filtereditems[activeIndex]
        });
      }
    }
    if (e.keyCode == 13) {
      _this.addTag();
    } else if (e.keyCode == 8 && _this.filterfield.value == '' && _this.RgTags.tags.length > 0) {
      var tag = _this.RgTags.tags.pop();
      _this.filterfield.value = tag.text;
    }
    return true;
  };

  this.toggle = function () {
    _this.filter();
    _this.RgTags.toggle();
  };

  this.filter = function () {
    _this.RgTags.filter(_this.filterfield.value);
  };

  this.addTag = function (e) {
    var tag = {
      text: _this.filterfield.value
    };
    if (e) tag = e.item;
    if (tag.text.length > 0) _this.RgTags.addTag(tag);
    _this.filterfield.value = '';
  };

  this.removeTag = function (e) {
    _this.RgTags.removeTag(e.item);
  };

  this.on('mount', function () {
    _this.RgTags = opts.tags || new RgTags(opts);
    _this.RgTags.on('update', function () {
      if (_this.RgTags.isvisible) _this.filter();
      _this.update();
    });
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('focus', handleClickOutside, true);
    _this.filterfield.value = _this.RgTags.value;
    _this.update();
  });

  this.on('unmount', function () {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('focus', handleClickOutside, true);
  });

  this.on('update', function () {
    if (_this.isMounted) {
      var container = _this.root.querySelector('.container');
      var containerWidth = container.getBoundingClientRect().width;
      var tagList = _this.root.querySelector('.tags');
      var tagListWidth = tagList.getBoundingClientRect().width;
      tagList.scrollLeft = Number.MAX_VALUE;

      var fieldContainer = _this.root.querySelector('.field-container');
      fieldContainer.style.width = containerWidth - tagListWidth + 'px';
      _this.root.querySelector('.container').style.height = fieldContainer.getBoundingClientRect().height + 'px';
    }
  });
}, '{ }');

riot.tag2('rg-time', '<rg-select select="{RgTime}"></rg-select>', '', '', function (opts) {
  var _this = this;

  var build = function build() {
    _this.RgTime.options = [];

    for (var i = 0; i < 1440; i++) {
      if (i % _this.RgTime.step == 0) {
        var d = new Date(0);
        d.setHours(_this.RgTime.time.getHours());
        d.setMinutes(_this.RgTime.time.getMinutes());
        d = new Date(d.getTime() + i * 60000);

        if (_this.RgTime.min) {
          if (d.getHours() < _this.RgTime.min[0]) continue;
          if (d.getHours() == _this.RgTime.min[0] && d.getMinutes() < _this.RgTime.min[1]) continue;
        }

        if (_this.RgTime.max) {
          if (d.getHours() > _this.RgTime.max[0]) continue;
          if (d.getHours() == _this.RgTime.max[0] && d.getMinutes() > _this.RgTime.max[1]) continue;
        }
        var t = {
          hours: d.getHours(),
          minutes: d.getMinutes()
        };
        var m = t.minutes;
        if (m < 10) m = '0' + m;
        if (_this.RgTime.ampm) {
          var ampm = 'am';
          var h = t.hours;
          if (h >= 12) {
            ampm = 'pm';
            h = h - 12;
          }
          if (h == 0) h = 12;
          t.text = h + ':' + m + ' ' + ampm;
          t.period = ampm;
        } else {
          var h = t.hours;
          if (h < 10) h = '0' + h;
          t.text = h + ':' + m;
        }
        _this.RgTime.options.push(t);
      }
    }
  };

  this.on('mount', function () {
    _this.RgTime = opts.time || new RgTime(opts);
    _this.RgTime.on('update', function () {
      build();
      _this.update();
    });
    build();
    _this.update();
  });
}, '{ }');

riot.tag2('rg-toasts', '<div class="toasts {RgToasts.position} {isvisible: RgToasts.isvisible}"> <div each="{RgToasts.toasts}" class="toast {isvisible: isvisible}" onclick="{parent.toastClicked}"> <rg-raw content="{content}"></rg-raw> </div> </div>', 'rg-toasts .toasts,[riot-tag="rg-toasts"] .toasts { display: none; position: fixed; width: 250px; max-height: 100%; overflow-y: auto; background-color: transparent; z-index: 101; } rg-toasts .toasts.isvisible,[riot-tag="rg-toasts"] .toasts.isvisible { display: block; } rg-toasts .toasts.topleft,[riot-tag="rg-toasts"] .toasts.topleft { top: 0; left: 0; } rg-toasts .toasts.topright,[riot-tag="rg-toasts"] .toasts.topright { top: 0; right: 0; } rg-toasts .toasts.bottomleft,[riot-tag="rg-toasts"] .toasts.bottomleft { bottom: 0; left: 0; } rg-toasts .toasts.bottomright,[riot-tag="rg-toasts"] .toasts.bottomright { bottom: 0; right: 0; } rg-toasts .toast,[riot-tag="rg-toasts"] .toast { display: none; padding: 20px; margin: 20px; background-color: #000; color: white; font-size: 0.9em; cursor: pointer; } rg-toasts .toast.isvisible,[riot-tag="rg-toasts"] .toast.isvisible { display: block; }', '', function (opts) {
  var _this = this;

  this.toastClicked = function (e) {
    var toast = e.item;
    if (rg.isFunction(toast.onclick)) toast.onclick();
    if (rg.isFunction(toast.onclose)) toast.onclose();
    window.clearTimeout(toast.timer);
    toast.isvisible = false;
  };

  this.on('mount', function () {
    _this.RgToasts = opts.toasts || new RgToasts(opts);
    _this.RgToasts.on('update', function () {
      _this.update();
    });
    _this.update();
  });
}, '{ }');

riot.tag2('rg-toggle', '<div class="wrapper"> <label class="toggle"> <input type="checkbox" __checked="{RgToggle.checked}" onclick="{toggle}"> <div class="track"> <div class="handle"></div> </div> </label> </div>', 'rg-toggle .wrapper,[riot-tag="rg-toggle"] .wrapper { width: 60px; height: 20px; margin: 0; display: inline-block; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; } rg-toggle .toggle,[riot-tag="rg-toggle"] .toggle { position: absolute; cursor: pointer; } rg-toggle input[type=checkbox],[riot-tag="rg-toggle"] input[type=checkbox] { display: none; } rg-toggle .track,[riot-tag="rg-toggle"] .track { position: absolute; top: 0; bottom: 0; left: 0; right: 0; width: 60px; height: 20px; padding: 2px; background-color: #b6c0c7; transition: background-color 0.1s linear; box-sizing: border-box; } rg-toggle input[type=checkbox]:checked + .track,[riot-tag="rg-toggle"] input[type=checkbox]:checked + .track { background-color: #000; } rg-toggle .handle,[riot-tag="rg-toggle"] .handle { position: relative; left: 0; width: 50%; height: 100%; background-color: white; transition: transform 0.1s linear; } rg-toggle input[type=checkbox]:checked + .track .handle,[riot-tag="rg-toggle"] input[type=checkbox]:checked + .track .handle { transform: translate3d(100%, 0, 0); }', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgToggle = opts.toggle || new RgToggle();
    _this.RgToggle.on('update', function () {
      _this.update();
    });
    _this.update();
  });

  this.toggle = function () {
    _this.RgToggle.toggle();
  };
}, '{ }');

riot.tag2('rg-unsplash', '<img riot-src="https://unsplash.it/{greyscale}{RgUnsplash.width}/{RgUnsplash.height}/?{options}">', '', '', function (opts) {
  var _this = this;

  this.on('mount', function () {
    _this.RgUnsplash = opts.unsplash || new RgUnsplash();
    _this.RgUnsplash.on('update', function () {
      _this.update();
    });
    _this.on('update', function () {
      _this.options = '';
      if (_this.RgUnsplash.greyscale) _this.greyscale = 'g/';
      if (_this.RgUnsplash.random) _this.options += 'random&';
      if (_this.RgUnsplash.blur) _this.options += 'blur&';
      if (_this.RgUnsplash.image) _this.options += 'image=' + _this.RgUnsplash.image + '&';
      if (rg.isDefined(_this.RgUnsplash.gravity)) _this.options += 'gravity=' + _this.RgUnsplash.gravity;
    });
    _this.update();
  });
}, '{ }');

},{}],4:[function(require,module,exports){
"use strict";var _get=function t(e,i,o){var n=true;t:while(n){var r=e,s=i,a=o;n=false;if(r===null)r=Function.prototype;var l=Object.getOwnPropertyDescriptor(r,s);if(l===undefined){var g=Object.getPrototypeOf(r);if(g===null){return undefined}else{e=g;i=s;o=a;n=true;l=g=undefined;continue t}}else if("value"in l){return l.value}else{var c=l.get;if(c===undefined){return undefined}return c.call(a)}}};var _createClass=function(){function t(t,e){for(var i=0;i<e.length;i++){var o=e[i];o.enumerable=o.enumerable||false;o.configurable=true;if("value"in o)o.writable=true;Object.defineProperty(t,o.key,o)}}return function(e,i,o){if(i)t(e.prototype,i);if(o)t(e,o);return e}}();function _inherits(t,e){if(typeof e!=="function"&&e!==null){throw new TypeError("Super expression must either be null or a function, not "+typeof e)}t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:false,writable:true,configurable:true}});if(e)Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e}function _classCallCheck(t,e){if(!(t instanceof e)){throw new TypeError("Cannot call a class as a function")}}(function(){if(!window.rg)window.rg={};rg.isUndefined=function(t){return typeof t==="undefined"};rg.isDefined=function(t){return typeof t!=="undefined"};rg.isBoolean=function(t){return typeof t==="boolean"};rg.isObject=function(t){return t!==null&&typeof t==="object"};rg.isString=function(t){return typeof t==="string"};rg.isNumber=function(t){return typeof t==="number"&&!isNaN(t)};rg.isDate=function(t){return toString.call(t)==="[object Date]"};rg.isArray=Array.isArray;rg.isFunction=function(t){return typeof t==="function"};rg.isRegExp=function(t){return toString.call(t)==="[object RegExp]"};rg.isPromise=function(t){return t&&isFunction(t.then)};rg.toBoolean=function(t){return t=="true"||t==true};rg.toNumber=function(t){t=Number(t);return rg.isNumber(t)?t:0};var t=0;rg.uid=function(){return t++};rg.xhr=function(t,e,i){var o=new XMLHttpRequest;o.onload=function(){if(rg.isFunction(i))i(o.responseText)};o.open(t,e,true);o.send()}})();(function(){"use strict";function t(t){var e=[].indexOf||function(t){for(var e=0,i=this.length;e<i;e++){if(e in this&&this[e]===t)return e}return-1};var i,o,n,r,s,a,l,g,c,d,u,h,f;r=[{name:"amex",icon:"images/amex.png",pattern:/^3[47]/,valid_length:[15]},{name:"diners_club",icon:"images/diners_club.png",pattern:/^30[0-5]/,valid_length:[14]},{name:"diners_club",icon:"images/diners_club.png",pattern:/^36/,valid_length:[14]},{name:"jcb",icon:"images/jcb.png",pattern:/^35(2[89]|[3-8][0-9])/,valid_length:[16]},{name:"laser",pattern:/^(6304|670[69]|6771)/,valid_length:[16,17,18,19]},{name:"visa_electron",pattern:/^(4026|417500|4508|4844|491(3|7))/,valid_length:[16]},{name:"visa",icon:"images/visa.png",pattern:/^4/,valid_length:[16]},{name:"mastercard",icon:"images/mastercard.png",pattern:/^5[1-5]/,valid_length:[16]},{name:"maestro",pattern:/^(5018|5020|5038|6304|6759|676[1-3])/,valid_length:[12,13,14,15,16,17,18,19]},{name:"discover",icon:"images/discover.png",pattern:/^(6011|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5]|64[4-9])|65)/,valid_length:[16]}];var p={};if(p.accept==null){p.accept=function(){var t,e,i;i=[];for(t=0,e=r.length;t<e;t++){o=r[t];i.push(o.name)}return i}()}f=p.accept;for(u=0,h=f.length;u<h;u++){n=f[u];if(e.call(function(){var t,e,i;i=[];for(t=0,e=r.length;t<e;t++){o=r[t];i.push(o.name)}return i}(),n)<0){throw"Credit card type '"+n+"' is not supported"}}s=function(t){var i,s,a;a=function(){var t,i,n,s;s=[];for(t=0,i=r.length;t<i;t++){o=r[t];if(n=o.name,e.call(p.accept,n)>=0){s.push(o)}}return s}();for(i=0,s=a.length;i<s;i++){n=a[i];if(t.match(n.pattern)){return n}}return null};l=function(t){var e,i,o,n,r,s;o=0;s=t.split("").reverse();for(i=n=0,r=s.length;n<r;i=++n){e=s[i];e=+e;if(i%2){e*=2;if(e<10){o+=e}else{o+=e-9}}else{o+=e}}return o%10===0};a=function(t,i){var o;return o=t.length,e.call(i.valid_length,o)>=0};d=function(t){return function(t){var e,i;n=s(t);i=false;e=false;if(n!=null){i=l(t);e=a(t,n)}return{card_type:n,valid:i&&e,luhn_valid:i,length_valid:e}}}(this);g=function(t){return t.replace(/[ -]/g,"")};c=function(e){return function(){return d(g(t))}}(this);return c(t)}riot.mixin("rg.creditcard",{creditcard:{validate:t}});if(!window.rg)window.rg={};rg.creditcard={validate:t}})();(function(){var t={initialize:function e(){t.trigger("initialize")}};riot.observable(t);if(!window.rg)window.rg={};rg.map=t})();var RgTag=function(){function t(){_classCallCheck(this,t);riot.observable(this)}_createClass(t,[{key:"update",value:function e(){this.trigger("update")}}]);return t}();var RgAlerts=function(t){_inherits(e,t);function e(t){var i=this;_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this.alerts=[];if(!rg.isArray(t.alerts))return;t.alerts.forEach(function(t){i.add(t)})}_createClass(e,[{key:"add",value:function i(t){var e=this;t.id=rg.uid();if(rg.isUndefined(t.isvisible))t.isvisible=true;if(t.timeout){t.startTimer=function(){t.timer=setTimeout(function(){e.dismiss(t);e.update()},rg.toNumber(t.timeout))};t.startTimer()}this.alerts.push(t)}},{key:"dismiss",value:function o(t){t.isvisible=false;if(rg.isFunction(t.onclose))t.onclose(t);clearTimeout(t.timer)}},{key:"select",value:function n(t){if(rg.isFunction(t.onclick))t.onclick(t)}}]);return e}(RgTag);var RgBehold=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._image1=t.image1;this._image2=t.image2;this._mode=t.mode}_createClass(e,[{key:"image1",get:function i(){return this._image1},set:function o(t){this._image1=t}},{key:"image2",get:function n(){return this._image2},set:function r(t){this._image2=t}},{key:"mode",get:function s(){return this._mode||"swipe"},set:function a(t){this._mode=t}}]);return e}(RgTag);var RgBubble=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._isvisible=t.isvisible;this._content=t.content}_createClass(e,[{key:"showBubble",value:function i(){clearTimeout(this._timer);this.isvisible=true}},{key:"hideBubble",value:function o(){var t=this;this._timer=setTimeout(function(){t.isvisible=false;t.update()},1e3)}},{key:"toggleBubble",value:function n(){this.isvisible=!this.isvisible}},{key:"isvisible",get:function r(){return rg.toBoolean(this._isvisible)},set:function s(t){this._isvisible=t}},{key:"content",get:function a(){return this._content||""},set:function l(t){this._content=t}}]);return e}(RgTag);var RgCode=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._url=t.url;this._code=t.code;this._onchange=t.onchange;this._theme=t.theme;this._mode=t.mode;this._tabsize=t.tabsize;this._softtabs=t.softtabs;this._wordwrap=t.wordwrap;this._readonly=t.readonly}_createClass(e,[{key:"url",get:function i(){return this._url},set:function o(t){this._url=t}},{key:"code",get:function n(){return this._code||""},set:function r(t){this._code=t}},{key:"onchange",get:function s(){if(rg.isFunction(this._onchange))return this._onchange;return null},set:function a(t){if(rg.isFunction(t))this._onchange=t}},{key:"theme",get:function l(){return this._theme||"monokai"},set:function g(t){this._theme=t}},{key:"mode",get:function c(){return this._mode||"html"},set:function d(t){this._mode=t}},{key:"tabsize",get:function u(){return rg.toNumber(this._tabsize)||2},set:function h(t){this._tabsize=t}},{key:"softtabs",get:function f(){return rg.toBoolean(this._softtabs)},set:function p(t){this._softtabs=t}},{key:"wordwrap",get:function m(){return rg.toBoolean(this._wordwrap)},set:function b(t){this._wordwrap=t}},{key:"readonly",get:function v(){return rg.toBoolean(this._readonly)},set:function y(t){this._readonly=t}}]);return e}(RgTag);var RgContextMenu=function(t){_inherits(e,t);function e(t){var i=this;_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this.name=t.name;this._isvisible=t.isvisible;this._onclose=t.onclose;this._onopen=t.onopen;this._items=[];if(!rg.isArray(t.items))return;t.items.forEach(function(t){i.add(t)})}_createClass(e,[{key:"add",value:function i(t){t.id=rg.uid();if(rg.isUndefined(t.isvisible))t.isvisible=true;if(rg.isUndefined(t.inactive))t.inactive=false;if(!rg.isFunction(t.onclick))t.onclick=null;this._items.push(t)}},{key:"select",value:function o(t){if(!t.inactive){if(rg.isFunction(t.onclick))t.onclick(t);this.isvisible=false}}},{key:"items",get:function n(){if(rg.isArray(this._items))return this._items;this._items=[];return this._items},set:function r(t){this._items=t}},{key:"onopen",get:function s(){if(rg.isFunction(this._onopen))return this._onopen;return null},set:function a(t){if(rg.isFunction(t))this._onopen=t}},{key:"onclose",get:function l(){if(rg.isFunction(this._onclose))return this._onclose;return null},set:function g(t){if(rg.isFunction(t))this._onclose=t}},{key:"isvisible",get:function c(){return rg.toBoolean(this._isvisible)},set:function d(t){this._isvisible=rg.toBoolean(t)}}]);return e}(RgTag);var RgCreditCard=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._placeholder=t.placeholder;this._cardnumber=t.cardnumber}_createClass(e,[{key:"validate",value:function i(){var t=rg.creditcard.validate(this.cardnumber);this.valid=t.valid;this.icon=this.valid?t.card_type.name:""}},{key:"cardnumber",get:function o(){return(this._cardnumber||"").toString()},set:function n(t){this._cardnumber=t}},{key:"valid",get:function r(){return rg.toBoolean(this._valid)},set:function s(t){this._valid=rg.toBoolean(t)}},{key:"placeholder",get:function a(){return this._placeholder||"Card no."},set:function l(t){this._placeholder=t}}]);return e}(RgTag);var RgDate=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._isvisible=t.isvisible;this._date=t.date;this._showYears=t.showyears;this._showMonths=t.showmonths;this._showToday=t.showtoday;this._format=t.format;this._yearFormat=t.yearformat;this._monthFormat=t.monthformat;this._weekFormat=t.weekformat;this._dayFormat=t.dayformat;this._onclose=t.onclose;this._onselect=t.onselect;this._onopen=t.onopen;var i=moment();this.dayNames=[i.day(0).format(this.weekFormat),i.day(1).format(this.weekFormat),i.day(2).format(this.weekFormat),i.day(3).format(this.weekFormat),i.day(4).format(this.weekFormat),i.day(5).format(this.weekFormat),i.day(6).format(this.weekFormat)]}_createClass(e,[{key:"_toMoment",value:function i(t){if(!moment.isMoment(t))t=moment(t);if(t.isValid())return t;return moment()}},{key:"open",value:function o(){this._isvisible=true;if(rg.isFunction(this._onopen))this._onopen()}},{key:"close",value:function n(){if(this.isvisible){this._isvisible=false;if(rg.isFunction(this._onclose))this._onclose()}}},{key:"setToday",value:function r(){this.select(moment())}},{key:"prevYear",value:function s(){this._date=this.date.subtract(1,"year")}},{key:"nextYear",value:function a(){this._date=this.date.add(1,"year")}},{key:"prevMonth",value:function l(){this._date=this.date.subtract(1,"month")}},{key:"nextMonth",value:function g(){this._date=this.date.add(1,"month")}},{key:"select",value:function c(t){this._date=t;if(rg.isFunction(this._onselect))this._onselect(this.date)}},{key:"date",get:function d(){return this._toMoment(this._date)},set:function u(t){this._date=t;if(rg.isFunction(this._onselect))this._onselect(this.date);this._isvisible=false}},{key:"dateFormatted",get:function h(){return this.date.format(this.format)}},{key:"isvisible",get:function f(){return rg.toBoolean(this._isvisible)}},{key:"year",get:function p(){return this.date.format(this.yearFormat)}},{key:"month",get:function m(){return this.date.format(this.monthFormat)}},{key:"day",get:function b(){return this.date.format(this.dayFormat)}},{key:"showYears",get:function v(){if(rg.isUndefined(this._showYears))return true;return rg.toBoolean(this._showYears)},set:function y(t){this._showYears=rg.toBoolean(t)}},{key:"showMonths",get:function w(){if(rg.isUndefined(this._showMonths))return true;return rg.toBoolean(this._showMonths)},set:function k(t){this._showMonths=rg.toBoolean(t)}},{key:"showToday",get:function _(){if(rg.isUndefined(this._showToday))return true;return rg.toBoolean(this._showToday)},set:function R(t){this._showToday=rg.toBoolean(t)}},{key:"format",get:function x(){return this._format||"LL"},set:function T(t){this._format=t}},{key:"yearFormat",get:function C(){return this._yearFormat||"YYYY"},set:function D(t){this._yearFormat=t}},{key:"monthFormat",get:function B(){return this._monthFormat||"MMMM"},set:function F(t){this._monthFormat=t}},{key:"weekFormat",get:function S(){return this._weekFormat||"ddd"},set:function N(t){this._weekFormat=t}},{key:"dayFormat",get:function U(){return this._dayFormat||"DD"},set:function z(t){this._dayFormat=t}}]);return e}(RgTag);var RgDrawer=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._isvisible=t.isvisible;this._header=t.header;this._items=t.items;this._position=t.position;this._onselect=t.onselect;this._onopen=t.onopen;this._onclose=t.onclose}_createClass(e,[{key:"open",value:function i(){if(this.onopen&&!this.isvisible)this.onopen();this.isvisible=true}},{key:"close",value:function o(){if(this.onclose&&this.isvisible)this.onclose();this.isvisible=false}},{key:"toggle",value:function n(){this.isvisible=!this.isvisible;if(this.onopen&&this.isvisible)this.onopen();else if(this.onclose&&!this.isvisible)this.onclose()}},{key:"select",value:function r(t){this.items.forEach(function(t){return t.active=false});t.active=true;if(t.action)t.action(t);if(this.onselect)this.onselect(t)}},{key:"isvisible",get:function s(){return rg.toBoolean(this._isvisible)},set:function a(t){this._isvisible=t}},{key:"header",get:function l(){return this._header},set:function g(t){this._header=t}},{key:"items",get:function c(){if(rg.isArray(this._items))return this._items;this._items=[];return this._items},set:function d(t){this._items=t}},{key:"position",get:function u(){return this._position||"bottom"},set:function h(t){this._position=t}},{key:"onopen",get:function f(){if(rg.isFunction(this._onopen))return this._onopen;return null},set:function p(t){this._onopen=t}},{key:"onclose",get:function m(){if(rg.isFunction(this._onclose))return this._onclose;return null},set:function b(t){this._onclose=t}},{key:"onselect",get:function v(){if(rg.isFunction(this._onselect))return this._onselect;return null},set:function y(t){this._onselect=t}}]);return e}(RgTag);var RgInclude=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._unsafe=t.unsafe;this._url=t.url}_createClass(e,[{key:"fetch",value:function i(){var t=this;rg.xhr("get",this.url,function(e){t.trigger("fetch",e)})}},{key:"unsafe",get:function o(){return rg.toBoolean(this._unsafe)},set:function n(t){this._unsafe=t}},{key:"url",get:function r(){return this._url||""},set:function s(t){if(this.url!=t){this._url=t}}}]);return e}(RgTag);var RgLoading=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._isvisible=t.isvisible}_createClass(e,[{key:"isvisible",get:function i(){return rg.toBoolean(this._isvisible)},set:function o(t){this._isvisible=t}}]);return e}(RgTag);var RgMap=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);this._options=t}_createClass(e,[{key:"options",get:function i(){if(rg.isUndefined(this._options)){this._options={center:{lat:53.806,lng:-1.535},zoom:7}}return this._options}}]);return e}(RgTag);var RgMarkdown=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};if(commonmark){this.reader=new commonmark.Parser;this.writer=new commonmark.HtmlRenderer}this._url=t.url}_createClass(e,[{key:"parse",value:function i(t){var e=this.reader.parse(t);this.trigger("parse",this.writer.render(e));return this.writer.render(e)}},{key:"fetch",value:function o(){var t=this;rg.xhr("get",this.url,function(e){t.trigger("fetch",e)})}},{key:"url",get:function n(){return this._url||""},set:function r(t){this._url=t}}]);return e}(RgTag);var RgModal=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);this._isvisible=t.isvisible;this._dismissable=t.dismissable;this._ghost=t.ghost;this._heading=t.heading;this._buttons=t.buttons;this._onclose=t.onclose;this._onopen=t.onopen}_createClass(e,[{key:"dismissable",get:function i(){if(rg.isUndefined(this._dismissable))this._dismissable=true;return rg.toBoolean(this._dismissable)},set:function o(t){this._dismissable=t}},{key:"ghost",get:function n(){return rg.toBoolean(this._ghost)},set:function r(t){this._ghost=t}},{key:"heading",get:function s(){return this._heading||""},set:function a(t){this._heading=t}},{key:"buttons",get:function l(){if(rg.isArray(this._buttons))return this._buttons;return[]},set:function g(t){this._buttons=t}},{key:"onopen",get:function c(){if(rg.isFunction(this._onopen))return this._onopen;return null},set:function d(t){this._onopen=t}},{key:"onclose",get:function u(){if(rg.isFunction(this._onclose))return this._onclose;return null},set:function h(t){this._onclose=t}},{key:"isvisible",get:function f(){return rg.toBoolean(this._isvisible)},set:function p(t){this._isvisible=t;if(this.isvisible&&this.onopen)this.onopen();if(!this.isvisible&&this.onclose)this.onclose()}}]);return e}(RgTag);var RgPhoneSim=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._url=t.url}_createClass(e,[{key:"url",get:function i(){return this._url||""},set:function o(t){this._url=t}}]);return e}(RgTag);var RgPlaceholdit=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._width=t.width;this._height=t.height;this._background=t.background;this._color=t.color;this._text=t.text;this._textsize=t.textsize;this._format=t.format}_createClass(e,[{key:"width",get:function i(){return rg.toNumber(this._width)||450},set:function o(t){this._width=t}},{key:"height",get:function n(){return rg.toNumber(this._height)||250},set:function r(t){this._height=t}},{key:"background",get:function s(){return this._background||"f01e52"},set:function a(t){this._background=t}},{key:"color",get:function l(){return this._color||"fff"},set:function g(t){this._color=t}},{key:"text",get:function c(){return this._text||this.width+" x "+this.height},set:function d(t){this._text=t}},{key:"textsize",get:function u(){return rg.toNumber(this._textsize)||30},set:function h(t){this._textsize=t}},{key:"format",get:function f(){return this._format||"png"},set:function p(t){this._format=t}}]);return e}(RgTag);var RgSelect=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._isvisible=t.isvisible;this._autocomplete=t.autocomplete;this._filteron=t.filteron;this._options=t.options;this._hasfilter=t.hasfilter;this._placeholder=t.placeholder;this._filterplaceholder=t.filterplaceholder;this._filtereditems=t.filtereditems;this._onopen=t.onopen;this._onclose=t.onclose;this._onselect=t.onselect;this._onfilter=t.onfilter}_createClass(e,[{key:"open",value:function i(){if(this.onopen&&!this.isvisible)this.onopen();this.isvisible=true}},{key:"close",value:function o(){if(this.onclose&&this.isvisible)this.onclose();this.isvisible=false}},{key:"toggle",value:function n(){this.isvisible=!this.isvisible;if(this.onopen&&this.isvisible)this.onopen();else if(this.onclose&&!this.isvisible)this.onclose()}},{key:"filter",value:function r(t){var e=this;this.filtereditems=this.options.filter(function(i){i.active=false;var o=i[e.filteron];if(rg.isUndefined(o))return false;if(t.length==0||o.toString().toLowerCase().indexOf(t.toString().toLowerCase())>-1)return true});if(this.onfilter)this.onfilter(t)}},{key:"select",value:function s(t){this.options.forEach(function(t){return t.selected=false});t.selected=true;if(this.onselect)this.onselect(t);this.isvisible=false;if(this.autocomplete)this.filter(t[this.filteron]);this.trigger("select",t)}},{key:"isvisible",get:function a(){return rg.toBoolean(this._isvisible)},set:function l(t){this._isvisible=t}},{key:"autocomplete",get:function g(){return rg.toBoolean(this._autocomplete)},set:function c(t){this._autocomplete=t}},{key:"filteron",get:function d(){return this._filteron||"text"},set:function u(t){this._filteron=t}},{key:"placeholder",get:function h(){return this._placeholder},set:function f(t){this._placeholder=t}},{key:"filterplaceholder",get:function p(){return this._filterplaceholder},set:function m(t){this._filterplaceholder=t}},{key:"hasfilter",get:function b(){return rg.toBoolean(this._hasfilter)},set:function v(t){this._hasfilter=t}},{key:"options",get:function y(){if(rg.isArray(this._options))return this._options;this._options=[];return this._options},set:function w(t){var e=this;if(!rg.isArray(t))t=[];t.forEach(function(t,i){t.index=i;if(t.selected)e.select(t)});this._options=t}},{key:"filtereditems",get:function k(){if(rg.isArray(this._filtereditems))return this._filtereditems;this._filtereditems=[];return this._filtereditems},set:function _(t){this._filtereditems=t}},{key:"onopen",get:function R(){if(rg.isFunction(this._onopen))return this._onopen;return null},set:function x(t){this._onopen=t}},{key:"onclose",get:function T(){if(rg.isFunction(this._onclose))return this._onclose;return null},set:function C(t){this._onclose=t}},{key:"onfilter",get:function D(){if(rg.isFunction(this._onfilter))return this._onfilter;return null},set:function B(t){this._onfilter=t}},{key:"onselect",get:function F(){if(rg.isFunction(this._onselect))return this._onselect;return null},set:function S(t){this._onselect=t}}]);return e}(RgTag);var RgSidemenu=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this,t)}return e}(RgDrawer);var RgTabs=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._tabs=t.tabs;this._onopen=t.onopen}_createClass(e,[{key:"select",value:function i(t){if(!t.disabled){this.tabs.forEach(function(t){t.active=false});if(this.onopen)this.onopen(t);t.active=true}}},{key:"onopen",get:function o(){if(rg.isFunction(this._onopen))return this._onopen;return null},set:function n(t){if(rg.isFunction(t))this._onopen=t}},{key:"tabs",get:function r(){var t=this;if(rg.isArray(this._tabs)){var e=function(){var e=false;t._tabs.forEach(function(t,i){t.index=i;if(e)t.active=false;if(t.active)e=true});return{v:t._tabs}}();if(typeof e==="object")return e.v}this._tabs=[];return this._tabs},set:function s(t){this._tabs=t}}]);return e}(RgTag);var RgTags=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this,t);this._tags=t.tags;this._value=t.value}_createClass(e,[{key:"addTag",value:function i(t){t.index=this.tags.length;this.tags.push(t);this.isvisible=false}},{key:"removeTag",value:function o(t){this.tags.splice(this.tags.indexOf(t),1);this.isvisible=false}},{key:"value",get:function n(){return this._value||""},set:function r(t){this._value=t}},{key:"tags",get:function s(){if(rg.isArray(this._tags))return this._tags;this._tags=[];return this._tags},set:function a(t){if(!rg.isArray(t))t=[];t.forEach(function(t,e){t.index=e});this._tags=t}}]);return e}(RgSelect);var RgTime=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this,t);this._min=t.min;this._max=t.max;this._time=t.time;this._step=t.step;this._ampm=t.ampm}_createClass(e,[{key:"min",get:function i(){if(this._min)return this._min.split(":");return this._min},set:function o(t){this._min=t}},{key:"max",get:function n(){if(this._max)return this._max.split(":");return this._max},set:function r(t){this._max=t}},{key:"time",get:function s(){if(rg.isDate(this._time))return this._time;return new Date},set:function a(t){this._time=t}},{key:"step",get:function l(){return rg.toNumber(this._step)||1},set:function g(t){this._step=t}},{key:"ampm",get:function c(){return rg.toBoolean(this._ampm)},set:function d(t){this._ampm=t}}]);return e}(RgSelect);var RgToasts=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._toasts=t.toasts;this._position=t.position;this._isvisible=t.isvisible}_createClass(e,[{key:"add",value:function i(t){this.toasts.push(t)}},{key:"toasts",get:function o(){var t=this;if(rg.isArray(this._toasts)){this._toasts.forEach(function(e){if(rg.isUndefined(e.isvisible))e.isvisible=true;e.id=e.id||rg.uid();if(!e.timer&&!e.sticky){e.startTimer=function(){e.timer=window.setTimeout(function(){e.isvisible=false;if(rg.isFunction(e.onclose))e.onclose();t.update()},rg.toNumber(e.timeout)||6e3)};e.startTimer()}});this.isvisible=this._toasts.filter(function(t){return t.isvisible}).length>0;return this._toasts}this._toats=[];return this._toasts},set:function n(t){this._toasts=t}},{key:"position",get:function r(){return this._position||"topright"},set:function s(t){this._position=t}},{key:"isvisible",get:function a(){return rg.toBoolean(this._isvisible)},set:function l(t){this._isvisible=t}}]);return e}(RgTag);var RgToggle=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._checked=t.checked;this._ontoggle=t.ontoggle}_createClass(e,[{key:"toggle",value:function i(){this.checked=!this.checked;if(this.ontoggle)this.ontoggle(this.checked)}},{key:"checked",get:function o(){return rg.toBoolean(this._checked)},set:function n(t){this._checked=t}},{key:"ontoggle",get:function r(){if(rg.isFunction(this._ontoggle))return this._ontoggle;return null},set:function s(t){this._ontoggle=t}}]);return e}(RgTag);var RgUnsplash=function(t){_inherits(e,t);function e(t){_classCallCheck(this,e);_get(Object.getPrototypeOf(e.prototype),"constructor",this).call(this);if(rg.isUndefined(t))t={};this._width=t.width;this._height=t.height;this._greyscale=t.greyscale||t.grayscale;this._random=t.random;this._blur=t.blur;this._image=t.image;this._gravity=t.gravity}_createClass(e,[{key:"width",get:function i(){return rg.toNumber(this._width)||450},set:function o(t){this._width=t;this.trigger("change")}},{key:"height",get:function n(){return rg.toNumber(this._height)||250},set:function r(t){this._height=t;this.trigger("change")}},{key:"greyscale",get:function s(){return rg.toBoolean(this._greyscale)},set:function a(t){this._greyscale=t;this.trigger("change")}},{key:"grayscale",get:function l(){return this.greyscale},set:function g(t){this.greyscale=t}},{key:"random",get:function c(){return rg.toBoolean(this._random)},set:function d(t){this._random=t;this.trigger("change")}},{key:"blur",get:function u(){return rg.toBoolean(this._blur)},set:function h(t){this._blur=t;this.trigger("change")}},{key:"image",get:function f(){return rg.toNumber(this._image)},set:function p(t){this._image=t;this.trigger("change")}},{key:"gravity",get:function m(){return this._gravity},set:function b(t){this._gravity=t;this.trigger("change")}}]);return e}(RgTag);riot.tag2("rg-alerts",'<div each="{RgAlerts.alerts}" class="alert {type} {isvisible: isvisible}" onclick="{select}"> <a class="close" aria-label="Close" onclick="{parent.dismiss}" if="{dismissable != false}"> <span aria-hidden="true">&times;</span> </a> <rg-raw content="{content}"></rg-raw> </div>','rg-alerts,[riot-tag="rg-alerts"] { font-size: 0.9em; position: relative; top: 0; right: 0; left: 0; width: 100%; } rg-alerts .alert,[riot-tag="rg-alerts"] .alert { display: none; position: relative; margin-bottom: 15px; padding: 15px 35px 15px 15px; } rg-alerts .isvisible,[riot-tag="rg-alerts"] .isvisible { display: block; } rg-alerts .close,[riot-tag="rg-alerts"] .close { position: absolute; top: 50%; right: 20px; line-height: 12px; font-size: 1.1em; border: 0; background-color: transparent; color: rgba(0, 0, 0, 0.5); cursor: pointer; outline: none; transform: translate3d(0, -50%, 0); } rg-alerts .danger,[riot-tag="rg-alerts"] .danger { color: #8f1d2e; background-color: #ffced8; } rg-alerts .information,[riot-tag="rg-alerts"] .information { color: #31708f; background-color: #d9edf7; } rg-alerts .success,[riot-tag="rg-alerts"] .success { color: #2d8f40; background-color: #ccf7d4; } rg-alerts .warning,[riot-tag="rg-alerts"] .warning { color: #c06329; background-color: #f7dfd0; }',"",function(t){var e=this;this.on("mount",function(){var e=this;this.RgAlerts=t.alerts||new RgAlerts(t);this.RgAlerts.on("update",function(){e.update()});this.update()});this.dismiss=function(t){var i=t.item;e.RgAlerts.dismiss(i)};this.select=function(t){var i=t.item;e.RgAlerts.select(i)}},"{ }");riot.tag2("rg-behold",'<div class="container"> <div class="controls"> <div class="modes"> <a onclick="{swipeMode}" class="mode {active: RgBehold.mode == \'swipe\'}">Swipe</a> <a onclick="{fadeMode}" class="mode {active: RgBehold.mode == \'fade\'}">Fade</a> </div> <input type="range" class="ranger" name="diff" value="0" min="0" max="1" step="0.01" oninput="{updateDiff}" onchange="{updateDiff}"> </div> <div class="images"> <div class="image"> <img class="image-2" riot-src="{RgBehold.image2}"> </div> <div class="image fallback"> <img class="image-1" riot-src="{RgBehold.image1}"> </div> </div> </div>','rg-behold .controls,[riot-tag="rg-behold"] .controls { text-align: center; } rg-behold .mode,[riot-tag="rg-behold"] .mode { text-decoration: none; cursor: pointer; padding: 0 10px; } rg-behold a.active,[riot-tag="rg-behold"] a.active { font-weight: bold; } rg-behold .ranger,[riot-tag="rg-behold"] .ranger { width: 90%; max-width: 300px; } rg-behold .images,[riot-tag="rg-behold"] .images { position: relative; } rg-behold .image,[riot-tag="rg-behold"] .image { position: absolute; width: 100%; text-align: center; } rg-behold .image img,[riot-tag="rg-behold"] .image img { max-width: 90%; }',"",function(t){var e=this;var i=undefined,o=undefined,n=undefined;var r=function s(){i=e.root.querySelector(".image-1");o=e.root.querySelector(".image-2");n=typeof i.style.webkitClipPath=="undefined";var t=undefined,r=undefined,s=undefined,a=undefined;var l=new Image;var g=new Image;l.onload=function(){t=true;s=this.height;d()};g.onload=function(){r=true;a=this.height;d()};l.src=e.RgBehold.image1;g.src=e.RgBehold.image2;var c=e;function d(){if(t&&r){var e=c.root.querySelector(".controls");var i=c.root.querySelector(".container");i.style.height=e.getBoundingClientRect().height+Math.max(s,a)+"px";c.updateDiff()}}};this.on("mount",function(){e.RgBehold=t.behold||new RgBehold(t);e.RgBehold.on("update",function(){e.update()});e.on("update",function(){r()});e.update()});this.swipeMode=function(){e.diff.value=0;e.updateDiff();e.RgBehold.mode="swipe"};this.fadeMode=function(){e.diff.value=0;e.updateDiff();e.RgBehold.mode="fade";
};this.updateDiff=function(){if(e.RgBehold.mode=="fade"){i.style.opacity=1-e.diff.value}else if(e.RgBehold.mode=="swipe"){if(!n){i.style.clipPath=i.style.webkitClipPath="inset(0 0 0 "+(i.clientWidth*e.diff.value-1)+"px)"}else{var t=e.root.querySelector(".fallback");t.style.clip="rect(auto, auto, auto, "+t.clientWidth*e.diff.value+"px)"}}}},"{ }");riot.tag2("rg-bubble",'<div class="context"> <div class="bubble {isvisible: RgBubble.isvisible}"> <rg-raw content="{RgBubble.content}"></rg-raw> </div> <div class="content" onmouseover="{showBubble}" onmouseout="{hideBubble}" onclick="{toggleBubble}"> <yield></yield> </div> </div>','rg-bubble .context,[riot-tag="rg-bubble"] .context,rg-bubble .content,[riot-tag="rg-bubble"] .content { display: inline-block; position: relative; } rg-bubble .bubble,[riot-tag="rg-bubble"] .bubble { position: absolute; top: -50px; left: 50%; transform: translate3d(-50%, 0, 0); padding: 10px 15px; background-color: #000; color: white; text-align: center; font-size: 0.9em; line-height: 1; white-space: nowrap; display: none; } rg-bubble .isvisible,[riot-tag="rg-bubble"] .isvisible { display: block; } rg-bubble .bubble:after,[riot-tag="rg-bubble"] .bubble:after { content: \'\'; position: absolute; display: block; bottom: -20px; left: 50%; transform: translate3d(-50%, 0, 0); width: 0; height: 0; border: 10px solid transparent; border-top-color: #000; }',"",function(t){var e=this;this.on("mount",function(){e.RgBubble=t.bubble||new RgBubble(t);e.RgBubble.on("update",function(){e.update()});e.update()});this.showBubble=function(){e.RgBubble.showBubble()};this.hideBubble=function(){e.RgBubble.hideBubble()};this.toggleBubble=function(){e.RgBubble.toggleBubble()}},"{ }");riot.tag2("rg-code",'<div class="editor"></div>','rg-code .editor,[riot-tag="rg-code"] .editor { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }',"",function(t){var e=this;var i=undefined;var o=function n(){i.setTheme("ace/theme/"+e.RgCode.theme);i.getSession().setMode("ace/mode/"+e.RgCode.mode);i.getSession().setTabSize(e.RgCode.tabsize);i.getSession().setUseSoftTabs(e.RgCode.softtabs);i.getSession().setUseWrapMode(e.RgCode.wordwrap);i.setReadOnly(e.RgCode.readonly)};this.on("mount",function(){i=ace.edit(e.root.querySelector(".editor"));i.$blockScrolling=Infinity;e.RgCode=t.editor||new RgCode(t);e.RgCode.on("update",function(){e.update()});e.on("update",function(){o();if(e.RgCode.code!=i.getValue())i.setValue(e.RgCode.code,1)});if(e.RgCode.url){rg.xhr("get",e.RgCode.url,function(t){e.RgCode.code=t;e.update()})}i.setValue(e.RgCode.code,1);i.getSession().on("change",function(t){e.RgCode.code=i.getValue();if(e.RgCode.onchange)e.RgCode.onchange(i.getValue())});o();e.update()})});riot.tag2("rg-context-menu",'<div class="menu {isvisible: RgContextMenu.isvisible}"> <div class="list"> <div each="{RgContextMenu.items}" class="item {inactive: inactive}" onclick="{selectItem}"> <rg-raw content="{content}"></rg-raw> </div> <yield></yield> </div> </div>','rg-context-menu .menu,[riot-tag="rg-context-menu"] .menu { display: none; position: absolute; background-color: white; border: 1px solid #D3D3D3; text-align: left; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; box-sizing: border-box; z-index: 2; } rg-context-menu .menu.isvisible,[riot-tag="rg-context-menu"] .menu.isvisible { display: block; } rg-context-menu .item,[riot-tag="rg-context-menu"] .item { cursor: pointer; padding: 10px; border-top: 1px solid #E8E8E8; background-color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } rg-context-menu .item:first-child,[riot-tag="rg-context-menu"] .item:first-child { border-top: 0; } rg-context-menu .item:hover,[riot-tag="rg-context-menu"] .item:hover { background-color: #f3f3f3; } rg-context-menu .item.inactive,[riot-tag="rg-context-menu"] .item.inactive { color: #8a8a8a; font-style: italic; } rg-context-menu .item.inactive:hover,[riot-tag="rg-context-menu"] .item.inactive:hover { background-color: #fff; }',"",function(t){var e=this;var i=function n(t){if(!e.root.contains(t.target)){if(e.RgContextMenu.onclose&&e.RgContextMenu.isvisible)e.RgContextMenu.onclose(t);e.RgContextMenu.isvisible=false}};var o=function r(t){t.preventDefault();if(e.RgContextMenu.onopen)e.RgContextMenu.onopen(t);e.RgContextMenu.isvisible=true;var i=t.pageX;var o=t.pageY;var n=e.root.querySelector(".menu");var r=n.getBoundingClientRect();if(i>window.innerWidth+window.scrollX-r.width)i=window.innerWidth+window.scrollX-r.width;n.style.left=i+"px";if(o>window.innerHeight+window.scrollY-r.height)o=window.innerHeight+window.scrollY-r.height;n.style.top=o+"px";e.update()};this.on("mount",function(){e.RgContextMenu=t.menu||new RgContextMenu(t);e.RgContextMenu.on("update",function(){e.update()});document.addEventListener("click",i);var n=document.querySelectorAll("[rg-context-menu]");for(var r=0,s;s=n[r];r++){if(s.attributes["rg-context-menu"].value==e.RgContextMenu.name)s.addEventListener("contextmenu",o);else s.addEventListener("contextmenu",e.closeMenu)}e.update()});this.on("unmount",function(){document.removeEventListener("click",i);var t=document.querySelectorAll("[rg-context-menu]");for(var n=0,r;r=t[n];n++){if(r.attributes["rg-context-menu"].value==e.RgContextMenu.name)r.removeEventListener("contextmenu",o);else r.removeEventListener("contextmenu",e.closeMenu)}});this.closeMenu=function(){e.RgContextMenu.isvisible=false};this.selectItem=function(t){t=t.item;e.RgContextMenu.select(t)}},"{ }");riot.tag2("rg-credit-card-number",'<input type="text" name="cardnumber" class="field card-no {RgCreditCard.icon} {valid: RgCreditCard.valid}" oninput="{validate}" placeholder="{RgCreditCard.placeholder}">','rg-credit-card-number .field,[riot-tag="rg-credit-card-number"] .field { font-size: 1em; padding: 10px; border: 1px solid #D3D3D3; box-sizing: border-box; outline: none; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-credit-card-number .card-no,[riot-tag="rg-credit-card-number"] .card-no { padding-right: 60px; background-repeat: no-repeat; background-position: right center; background-size: 60px; } rg-credit-card-number .amex,[riot-tag="rg-credit-card-number"] .amex { background-image: url(img/amex.png); } rg-credit-card-number .diners_club,[riot-tag="rg-credit-card-number"] .diners_club { background-image: url(img/diners_club.png); } rg-credit-card-number .discover,[riot-tag="rg-credit-card-number"] .discover { background-image: url(img/discover.png); } rg-credit-card-number .jcb,[riot-tag="rg-credit-card-number"] .jcb { background-image: url(img/jcb.png); } rg-credit-card-number .mastercard,[riot-tag="rg-credit-card-number"] .mastercard { background-image: url(img/mastercard.png); } rg-credit-card-number .visa,[riot-tag="rg-credit-card-number"] .visa { background-image: url(img/visa.png); }',"",function(t){var e=this;var i=function o(){if(e.cardnumber.value!=e.RgCreditCard.cardnumber)e.cardnumber.value=e.RgCreditCard.cardnumber;e.RgCreditCard.validate()};this.on("mount",function(){e.RgCreditCard=t.card||new RgCreditCard(t);e.RgCreditCard.on("update",function(){e.update()});e.on("update",function(){i()});e.update()});this.validate=function(){e.RgCreditCard.cardnumber=e.cardnumber.value;e.RgCreditCard.validate()}},"{ }");riot.tag2("rg-date",'<div class="container {open: RgDate.isvisible}"> <input type="text" class="field" onclick="{open}" value="{RgDate.dateFormatted}" readonly> <div class="calendar" show="{RgDate.isvisible}"> <div class="grid grid-row" if="{RgDate.showYears}"> <div class="selector" onclick="{prevYear}">&lsaquo;</div> <span class="year">{RgDate.year}</span> <div class="selector" onclick="{nextYear}">&rsaquo;</div> </div> <div class="grid grid-row" if="{!RgDate.showYears}"> <span class="year fill">{RgDate.year}</span> </div> <div class="grid grid-row" if="{RgDate.showMonths}"> <div class="selector" onclick="{prevMonth}">&lsaquo;</div> <span class="month">{RgDate.month}</span> <div class="selector" onclick="{nextMonth}">&rsaquo;</div> </div> <div class="grid grid-row" if="{!RgDate.showMonths}"> <span class="month fill">{RgDate.month}</span> </div> <div class="grid grid-row"> <span class="day-name" each="{day in RgDate.dayNames}">{day}</span> </div> <div class="grid grid-wrap"> <div each="{day in startBuffer}" onclick="{select}" class="date {in: day.inMonth, selected: day.selected, today: day.today}"> {day.date.format(this.RgDate.dayFormat)} </div> <div each="{day in days}" onclick="{select}" class="date {in: day.inMonth, selected: day.selected, today: day.today}"> {day.date.format(this.RgDate.dayFormat)} </div> <div each="{day in endBuffer}" onclick="{select}" class="date {in: day.inMonth, selected: day.selected, today: day.today}"> {day.date.format(this.RgDate.dayFormat)} </div> </div> <div if="{RgDate.showToday}" class="grid grid-row"> <a class="shortcut" onclick="{setToday}">Today</a> </div> </div> </div>','rg-date .container,[riot-tag="rg-date"] .container { position: relative; display: inline-block; cursor: pointer; } rg-date .field,[riot-tag="rg-date"] .field { font-size: 1em; padding: 10px; border: 1px solid #D3D3D3; cursor: pointer; box-sizing: border-box; outline: none; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-date .calendar,[riot-tag="rg-date"] .calendar { position: absolute; text-align: center; background-color: white; border: 1px solid #D3D3D3; padding: 5px; width: 330px; margin-top: 10px; left: 50%; transform: translate3d(-50%, 0, 0); -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; box-sizing: border-box; z-index: 1; } rg-date .grid,[riot-tag="rg-date"] .grid { display: -webkit-flex; display: -ms-flexbox; display: flex; -webkit-align-items: center; -ms-flex-align: center; align-items: center; } rg-date .grid-wrap,[riot-tag="rg-date"] .grid-wrap { width: 100%; -webkit-flex-wrap: wrap; -ms-flex-wrap: wrap; flex-wrap: wrap; } rg-date .grid-row,[riot-tag="rg-date"] .grid-row { height: 35px; } rg-date .selector,[riot-tag="rg-date"] .selector { font-size: 2em; font-weight: 100; padding: 0; -webkit-flex: 0 0 15%; -ms-flex: 0 0 15%; flex: 0 0 15%; } rg-date .year,[riot-tag="rg-date"] .year,rg-date .month,[riot-tag="rg-date"] .month { text-transform: uppercase; font-weight: normal; -webkit-flex: 0 0 70%; -ms-flex: 0 0 70%; flex: 0 0 70%; } rg-date .fill,[riot-tag="rg-date"] .fill { -webkit-flex: 0 0 100%; -ms-flex: 0 0 100%; flex: 0 0 100%; } rg-date .day-name,[riot-tag="rg-date"] .day-name { font-weight: bold; -webkit-flex: 0 0 14.28%; -ms-flex: 0 0 14.28%; flex: 0 0 14.28%; } rg-date .date,[riot-tag="rg-date"] .date { -webkit-flex: 0 0 14.28%; -ms-flex: 0 0 14.28%; flex: 0 0 14.28%; padding: 12px 10px; box-sizing: border-box; font-size: 0.8em; font-weight: normal; border: 1px solid transparent; color: #cacaca; } rg-date .date:hover,[riot-tag="rg-date"] .date:hover { background-color: #f3f3f3; } rg-date .date.in,[riot-tag="rg-date"] .date.in { color: inherit; } rg-date .today,[riot-tag="rg-date"] .today { border-color: #ededed; } rg-date .selected,[riot-tag="rg-date"] .selected,rg-date .selected:hover,[riot-tag="rg-date"] .selected:hover { background-color: #ededed; border-color: #dedede; } rg-date .shortcut,[riot-tag="rg-date"] .shortcut { -webkit-flex: 0 0 100%; -ms-flex: 0 0 100%; flex: 0 0 100%; color: #6495ed; }',"",function(t){var e=this;var i=function r(t){if(!e.root.contains(t.target))e.RgDate.close();e.update()};var o=function s(t){var i=t||moment();return{date:i,selected:e.RgDate.date.isSame(t,"day"),today:moment().isSame(t,"day"),inMonth:e.RgDate.date.isSame(t,"month")}};var n=function a(){var t=moment(e.RgDate.date).startOf("month");var i=moment(e.RgDate.date).endOf("month");e.days=[];e.startBuffer=[];e.endBuffer=[];for(var n=t.weekday();n>=0;n-=1){var r=moment(t).subtract(n,"days");e.startBuffer.push(o(r))}for(var n=i.date()-1;n>0;n-=1){var s=moment(t).add(n,"days");e.days.unshift(o(s))}for(var n=i.weekday();n<6;n+=1){var r=moment(i).add(n,"days");e.endBuffer.push(o(r))}};this.on("mount",function(){e.RgDate=t.date||new RgDate(t);e.RgDate.on("update",function(){e.update()});e.on("update",function(){n()});document.addEventListener("click",i);e.update()});this.on("unmount",function(){document.removeEventListener("click",i)});this.open=function(){e.RgDate.open()};this.prevYear=function(){e.RgDate.prevYear()};this.nextYear=function(){e.RgDate.nextYear()};this.prevMonth=function(){e.RgDate.prevMonth()};this.nextMonth=function(){e.RgDate.nextMonth()};this.setToday=function(){e.RgDate.setToday()};this.select=function(t){e.RgDate.select(t.item.day.date)}},"{ }");riot.tag2("rg-drawer",'<div class="overlay {visible: RgDrawer.isvisible}" onclick="{close}"></div> <div class="drawer {RgDrawer.position} {visible: RgDrawer.isvisible}"> <h4 class="header">{RgDrawer.header}</h4> <ul class="items"> <li class="item {active: active}" each="{RgDrawer.items}" onclick="{parent.select}"> <rg-raw content="{content}"></rg-raw> </li> </ul> <div class="body"> <yield></yield> </div> </div>','rg-drawer .overlay,[riot-tag="rg-drawer"] .overlay { display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); cursor: pointer; z-index: 50; } rg-drawer .overlay.visible,[riot-tag="rg-drawer"] .overlay.visible { display: block; } rg-drawer .drawer,[riot-tag="rg-drawer"] .drawer { position: absolute; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background-color: white; color: black; transition: transform 0.5s ease; z-index: 51; } rg-drawer .drawer.bottom,[riot-tag="rg-drawer"] .drawer.bottom { top: 100%; left: 0; height: auto; width: 80%; margin-left: 10%; transform: translate3d(0, 0, 0); } rg-drawer .drawer.bottom.visible,[riot-tag="rg-drawer"] .drawer.bottom.visible { transform: translate3d(0, -100%, 0); } rg-drawer .drawer.top,[riot-tag="rg-drawer"] .drawer.top { bottom: 100%; left: 0; height: auto; width: 80%; margin-left: 10%; transform: translate3d(0, 0, 0); } rg-drawer .drawer.top.visible,[riot-tag="rg-drawer"] .drawer.top.visible { transform: translate3d(0, 100%, 0); } rg-drawer .drawer.left,[riot-tag="rg-drawer"] .drawer.left { top: 0; left: 0; height: 100%; width: 260px; transform: translate3d(-100%, 0, 0); } rg-drawer .drawer.left.visible,[riot-tag="rg-drawer"] .drawer.left.visible { transform: translate3d(0, 0, 0); } rg-drawer .drawer.right,[riot-tag="rg-drawer"] .drawer.right { top: 0; left: 100%; height: 100%; width: 260px; transform: translate3d(0, 0, 0); } rg-drawer .drawer.right.visible,[riot-tag="rg-drawer"] .drawer.right.visible { transform: translate3d(-100%, 0, 0); } rg-drawer .header,[riot-tag="rg-drawer"] .header { padding: 1.2rem; margin: 0; text-align: center; } rg-drawer .items,[riot-tag="rg-drawer"] .items { padding: 0; margin: 0; list-style: none; } rg-drawer .item,[riot-tag="rg-drawer"] .item { padding: 1rem 0.5rem; box-sizing: border-box; border-top: 1px solid #E8E8E8; } rg-drawer .item:last-child,[riot-tag="rg-drawer"] .item:last-child { border-bottom: 1px solid #E8E8E8; } rg-drawer .item:hover,[riot-tag="rg-drawer"] .item:hover { cursor: pointer; background-color: #E8E8E8; } rg-drawer .item.active,[riot-tag="rg-drawer"] .item.active { cursor: pointer; background-color: #EEE; }',"",function(t){var e=this;this.on("mount",function(){e.RgDrawer=t.drawer||new RgDrawer(t);e.RgDrawer.on("update",function(){e.update()});e.update()});this.close=function(){e.RgDrawer.close()};this.select=function(t){e.RgDrawer.select(t.item)}},"{ }");riot.tag2("rg-ga","","","",function(t){(function(t,e,i,o,n,r,s){t["GoogleAnalyticsObject"]=n;t[n]=t[n]||function(){(t[n].q=t[n].q||[]).push(arguments)},t[n].l=1*new Date;r=e.createElement(i),s=e.getElementsByTagName(i)[0];r.async=1;r.src=o;s.parentNode.insertBefore(r,s)})(window,document,"script","//www.google-analytics.com/analytics.js","ga");ga("create",t.property,"auto");ga("send","pageview")});riot.tag2("rg-include","<div> {responseText} </div>","","",function(t){var e=this;this.on("mount",function(){e.RgInclude=t.include||new RgInclude(t);e.RgInclude.on("update",function(){e.RgInclude.fetch()});e.RgInclude.on("fetch",function(t){if(e.RgInclude.unsafe)e.root.innerHTML=t;else e.responseText=t;e.update()});e.RgInclude.fetch()})},"{ }");riot.tag2("rg-loading",'<div class="loading {visible: RgLoading.isvisible}"> <div class="overlay"></div> <div class="content"> <yield></yield> </div> </div>','rg-loading .loading,[riot-tag="rg-loading"] .loading { display: none; } rg-loading .visible,[riot-tag="rg-loading"] .visible { display: block; } rg-loading .overlay,[riot-tag="rg-loading"] .overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); z-index: 200; } rg-loading .content,[riot-tag="rg-loading"] .content { position: absolute; width: 95%; max-width: 420px; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background-color: transparent; color: #fff; text-align: center; z-index: 201; }',"",function(t){var e=this;this.on("mount",function(){e.RgLoading=t.loading||new RgLoading(t);e.RgLoading.on("update",function(){e.update()});e.update()})},"{ }");riot.tag2("rg-map",'<div class="rg-map"></div>','rg-map .rg-map,[riot-tag="rg-map"] .rg-map { margin: 0; padding: 0; width: 100%; height: 100%; } rg-map .rg-map img,[riot-tag="rg-map"] .rg-map img { max-width: inherit; }',"",function(t){var e=this;this.on("mount",function(){e.RgMap=t.map||new RgMap(t);rg.map.on("initialize",function(){rg.map.obj=new google.maps.Map(e.root.querySelector(".rg-map"),e.RgMap.options)});if(!document.getElementById("gmap_script")){var i=document.createElement("script");i.setAttribute("id","gmap_script");i.type="text/javascript";i.src="https://maps.googleapis.com/maps/api/js?callback=rg.map.initialize";document.body.appendChild(i)}})});riot.tag2("rg-markdown",'<div class="markdown"></div>',"","",function(t){var e=this;this.on("mount",function(){e.RgMarkdown=t.markdown||new RgMarkdown(t);e.RgMarkdown.on("update",function(){e.RgMarkdown.fetch()});e.RgMarkdown.on("fetch",function(t){e.RgMarkdown.parse(t)});e.RgMarkdown.on("parse",function(t){e.root.innerHTML=t;e.update()});e.RgMarkdown.fetch()})});riot.tag2("rg-modal",'<div class="overlay {visible: RgModal.isvisible, ghost: RgModal.ghost, dismissable: RgModal.dismissable}" onclick="{close}"></div> <div class="modal {visible: RgModal.isvisible, ghost: RgModal.ghost, dismissable: RgModal.dismissable}"> <header class="header"> <button if="{RgModal.dismissable}" type="button" class="close" aria-label="Close" onclick="{close}"> <span aria-hidden="true">&times;</span> </button> <h3 class="heading"><rg-raw content="{RgModal.heading}"></rg-raw></h3> </header> <div class="body"> <yield></yield> </div> <footer class="footer"> <button class="button" each="{RgModal.buttons}" type="button" onclick="{action}" riot-style="{style}"> <rg-raw content="{content}"></rg-raw> </button> <div class="clear"></div> </footer> </div>','rg-modal .overlay,[riot-tag="rg-modal"] .overlay { display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); z-index: 100; } rg-modal .overlay.dismissable,[riot-tag="rg-modal"] .overlay.dismissable { cursor: pointer; } rg-modal .modal,[riot-tag="rg-modal"] .modal { display: none; position: absolute; width: 95%; max-width: 500px; font-size: 1.1em; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background-color: white; color: #252519; z-index: 101; } rg-modal .modal.ghost,[riot-tag="rg-modal"] .modal.ghost { background-color: transparent; color: white; } rg-modal .visible,[riot-tag="rg-modal"] .visible { display: block; } rg-modal .header,[riot-tag="rg-modal"] .header { position: relative; text-align: center; } rg-modal .heading,[riot-tag="rg-modal"] .heading { padding: 20px 20px 0 20px; margin: 0; font-size: 1.2em; } rg-modal .modal.ghost .heading,[riot-tag="rg-modal"] .modal.ghost .heading { color: white; } rg-modal .close,[riot-tag="rg-modal"] .close { position: absolute; top: 5px; right: 10px; padding: 0; font-size: 1.2em; border: 0; background-color: transparent; color: #000; cursor: pointer; outline: none; } rg-modal .modal.ghost .close,[riot-tag="rg-modal"] .modal.ghost .close { color: white; } rg-modal .body,[riot-tag="rg-modal"] .body { padding: 20px; } rg-modal .footer,[riot-tag="rg-modal"] .footer { padding: 0 20px 20px 20px; } rg-modal .button,[riot-tag="rg-modal"] .button { float: right; padding: 10px; margin: 0 5px 0 0; border: none; font-size: 0.9em; text-transform: uppercase; cursor: pointer; outline: none; background-color: white; } rg-modal .modal.ghost .button,[riot-tag="rg-modal"] .modal.ghost .button { color: white; background-color: transparent; } rg-modal .clear,[riot-tag="rg-modal"] .clear { clear: both; }',"",function(t){var e=this;this.on("mount",function(){e.RgModal=t.modal||new RgModal(t);e.RgModal.on("update",function(){e.update()});e.update()});this.close=function(){if(e.RgModal.dismissable)e.RgModal.isvisible=false}},"{ }");riot.tag2("rg-phone-sim",'<div class="emulator"> <iframe class="screen" riot-src="{RgPhoneSim.url}"></iframe> </div>','rg-phone-sim .emulator,[riot-tag="rg-phone-sim"] .emulator { position: relative; width: 365px; height: 792px; background-image: url(\'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAW0AAAMYCAMAAAA3r0ZLAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAwBQTFRFMDk6+vr6KTM0lJucMz4/PklKJS8wLTg5Qk1OxsjILzo7gomJ2NvbdH5/ho2O9fb2KzY3ztHRPEdIOkVGZWxtjJSVOEJDkpeYWGRluL2+KTQ1vcHBoaWlPUZHcnp6nKKjOkRF1NfXqa2tp62tZnBxanV2VmFiZ29wVl1eaXJzbXR04uTktbq7QElK1tnZipKTi5CRTlZXpKioo6mqXmlqUVlaOEFCSVFSUFxdISssT1tcTlpbJC4vIiwtTVlaJjAxIy0uTFhZS1dYJzEyKDIzSlZXPUhJOURFO0ZHSVVWKzU2P0pLKjQ1OENEND0+QEtMLDY3SFRVN0JDQ05PLTc4ND9ANUBBQUxNNkFCR1NUMTo7RE9QLjg5N0BBR1JTRlJTLzk6RVFSMjs8RVBRRlFSNj9AMzw9SFNUMj0+IissMTs8MDo7SVRVRFBRMDs8MTw9IiwsMz0+Mjw9SlVWQ09QLjk6NT4/S1ZXND4/JC4uQU1OIy0tQk5PTFdYTVhZQExNTllaJS8vJzIyP0tMLzg5LDc4KDMzNT9AKjU1N0FCNkBBJjAwIywtMDs7Mj09NkFBJjExLjk5LDc3N0JCNUBAKjU2MTw8LDU2Ljc4OUNEKDEyQU1NPEhIPEhJO0dHOkZGND8/Qk5ORFBQQ09PLTY3OUREPkpKPkpLPUlJT1pbP0tLJTAwPUlKJzAxKjM07u/vKTIzsbW2YGprtLm50tXWPkhJo6endn+A3d/f6uvreoOEg4yN2tvc/Pz8n6am8/T0VFtcm6CgJS4v4OLi5ufnYGdncnt8dHp7gYaHJC0uu8DAjJGRQkxNxMfHKzQ1YGtsS1NUaXN0bnh5yMzMyszMy83Oy8/PdoCAKDIy7O3tT1dYuLu70NTUbXd46Onq6erreoCA2dzc8PHx8vPz5OXlnaSkn6Wmqq6ucHZ2t7y8o6eoeoSEkJaWm5+gW2ZnZG5vqa+wOEFB09bWtru7qrCwcXd4t7u83eDgzM7O7/DwNT4+7e7uwMPDwcPEeH5/////70wnUQAAAQB0Uk5T////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AFP3ByUAAA+NSURBVHja7N13nBTlGcDxEQI5AmJQBAkcnqhEDIhoWMt5iogmQbOaYNrqYrJh16gplmTVkILJpYCmF+DSE1JIcjRR7L333ntPYjQxvTl55tnr7N7t7uw+vDP3+/0x3G3hs5+vr++8M7s7eH75Xb5x+rOjN017aeq+tO++U1+atmn0s9M3Xl6BoFfm466ZOPROhIt259CJ19RS++7LdgW133a97O7aaI/a+VE0y+jRnUeF1p6wqfvvaz6+YVjT0jMyJ3rkeSdmzljaNKzh+OZuoE0TQmmvv67zLzrwmMY8wkXLNx5zYCfTdeur1p6wdeegblgKar8tbegc4lv/rirtjTMLT99/UVMKzgFLNS3avwA2c2Pl2n8tPHV1QxLJMks2rC6g/alC7ScvKozrhhyIFZRrKIzvi56sRHt94b/RIsZ1xeN7UYFuffna4/UJB68Er4rGHax648vUfmqkPnxBBrmqyixQv5FPlaP9Dz2eWdIEW9U1LdFjnQsG1n5ETz4dyowdavY+VE9XPTKQ9phddPfICjvk6lt3lruM6V97j132l26BK3S3BJAv79Gf9jN3BY85HKsadHhAedebSmtf+ofgEcOQqknDAsyLLi2pPTq4/0icatSRAefoUto7Bvc2oFSzGgLQHYtr3xTct5DVSA1XJgsD0puKaa99s9wzlwPImh5WzhXTl/5TRHt7uaN5GUI1bVmzqL64ufZfgkF/GD417rCA9e99tf8VzCPHoVPzjhPXaVv10d5bblzCyZE6nDIJ5pKde2u/Egz487Cp1zHlHr20h8otp50ETT2WgaeL7dCe2vcF/uOQqUsrA9z7emgHQ3thdEZLLpeL0kHYwq7BrdqjAv2ofEAnlU0EZaPjvTTgHdWlvXeEhnYu0VkuUoN7707tbW6X35oiciyc6C4yZxmaxPf2bTq0z5VfTo/IC8/20M5GZnAHy5JzO7Tvj85bCKlEzyIzdQdvLNxf0L4wmMQjMgnmemlHZubOBcQXqvb0CO0jk720o3OmIdhPTlft4FTrth5ju55tK8bbq/YG+emUiLzqTC/t6Lz1cYoYbwi0r47QisTz0j2w0xE6ngxWJVeLdrD+WxCZVx3J9ba0QNeAnj9T/twuOi87GcF9pLSdKM8U7Q2rV6+O0jcQMoXJJB2t96tzorzB99Y2NzfPjdQL9zLJZDJynw2YK85rvZ1ku9Cjuq+4xXknb4Js+XxU/WsQ5wnec7LlDcn6d544P+ddLFu+zlT/Vorzxd5k2fIJqfq3TJwney/Lls+RGBwniPPL3g6y5aOWBstWcd7BmypbLjhS/1LiPNWTTTMWBik02mijTWijTWijjTbFVTuZTqSTRW8OUzqJdpGyxT89mU2ELYv25kO4+LvnyUT4kmj3LV38YzjpGmin3dReIm2pF9BlU+LmMDmnrdBbUntQje0trj2o5m2FPlBiTWKQQm9R7cG03nZAexCFNtpoE9poE9poo01oo01oo01oo4021VT7MxIUBik02mijTeG1D5agMEih0UYbbUIbbUIbbbQJbbQJbbQJbbTRplppf1qCwiCFRhtttCm89lwJCoMUGm200Sa00Sa00Uab0Eab0Eab0EY73tqnS1AYpNBoo402hdc+VILCIIVGG220CW20CW200Sa00Sa00aYC9GkSFAYpNNpoo01oR0v7bRIUBik02mijTWijTWijjTahjTah7bL2hyUoDFJotNFGm9BGm0ppv0OCwiCFRhtttAlttAlttNEmtOOhfbwEhUEKjTbaaBPaaBPaLmi/T4LCIIVGG220CW20CW200ab6aS+UoDBIodFGG21CG21C2wXt4yQoDFJotNFGm9BGm9BGe7BpL5KgMEih0UYbbUIbbULbBe0PSFAYpNBoo402oY02oY32YNP+oASFQQqNNtpoE9poE9poDzbtj0hQGKTQaKONNqGNNpXS/qkEhUEKfYwEhUEKjTbaaBPaaBPaaA827Y9LUBik0GijjTahHS3tn0lQGKTQCyQoDFJotNFGm9BGm9BGG22qn/anJCgMUmi00Uabwmv/RILCIIVukKAwSKHRRhttQhttQhtttKl+2p+UoDBIodFGG20Kr/09CQqDFPo9EhQGKTTaaKNNaKNNaKONNtVP+7MSFAYpNNpoo03htY+UoDBIodFGG21CG21CG220Ce14aH9egsIghUYb7bhq/1qCwiCFPlyCwiCFRhtttAlttAlttNEmtNGmSrV/KUFhkEL/QoLCIIUeJkFhkEKjjTbahDbahDbaaBPaaFOl2r+VoDBIoX8lQWGQQh8mQWGQQqONNtqENtqENtpoE9poE9oua/9AgsIghf6+BIVBCr2tBIVBCo022mgT2mgT2mijTWijTWi7rP1DCQqDFPqtEhQGKTTaaKNNaKNNaKONNqGNNqHtsvaPJCgMUujtJCgMUmi00Uab0Eab0EYbbUIbbUIbbSpAv0WCwiCFRhtttAlttAlttNEmtNEmtF3W/rkEhUEKvVKCwiCFfrsEhUEKjTbaaBPaaBPaaKNNaKNNaLusPU6CwiCFfqcEhUEKjTbaaBPaaBPaaKNNaMdD+1sSFAYpNNqW2kslKAxSaLQttd8rQWGQQqONNtqENtqENtpoU/20vyZBYZBCo22pvUyCwiCFRttS+90SFAYpNNpoo01oo01oo4021U/72xIUBik02pbaX5KgMEih0UY7rtrvkqAwSKHRRhttQhttQhtttKl+2j+WoDBIoc+QoDBIodFGG20Kr/0aCQqDFBpttNEmtNEmtNFGm+qnfYoEhUEKjTbaaBPa0dL+kASFQQqNNtpoE9poE9ouaH9VgsIghUbbUvtUCQqDFBpttNEmtKOl/TEJCoMUGm200Sa00aZS2t+VoDBIodG21D5RgsIghUYbbbQJbbSplPZHJSgMUmi00Uab0EabSml/RYLCIIVG21L7JAkKgxQabbTRJrTRplLar5OgMEih0UYbbUIbbULbBe33S1AYpNBoo402oY02oY32YNP+hASFQQqNNtpoE9rR0v6GBIVBCo22pfaxEhQGKTTaaKNNaKNNaKM92LRfK0FhkEKjjTbahDbaVEr7aAkKgxQabbTRJrTRJrTRRpvqp/0FCQqDFBpttOOq/U0JCoMUGm1L7aMkKAxSaLTRRpvQRpvQRhttQjse2q+XoDBIodFGG21CO1ra8yUoDFJotNFGm9BGm9BGG21CG22qVPs7EhQGKTTaltpflqAwSKHRRjuu2kdIUBik0GijjTahjTahjTbahDbaVKn2GyQoDFJotNFGm8JrD5GgMEih0UYbbUIbbUIbbbQJbbQJbbSpAP1FCQqDFBpttNGm8NrzJCgMUmi00Uab0Eab0EYbbUIbbUIbbULbXvtzEhQGKTTaaMdV+xAJCoMUGm200Sa00Sa00Uab0Eab0Eab0EY73tpfl6AwSKHRttQ+SILCIIVGG220CW20CW200Sa00Sa00Sa00UabaqV9tgSFQQqNtqX2byQoDFLo4RIUBik02mijTWijTWijjTahjTahjTZFVTuVymQyqRTa9S6TzGcTnaWz+VwK7TqVyyc2L5tMoV376SOZTpQom4uO9lmS+9b5RH+lo+Ct0FHQTiYGKptCu0a7xj5zSDqdzmbTfSeWZCS0D5AiM7DT+Vyme3rJJLMRGt4K7bp2D9B8psjOs8f9GbRD7h67MUst9TLdD8mhHQq7a3bO9zNP5CIxebuvnS5v1HYvEHNoh56z8wPuAHPuz92ua+crmB+6uFNoV3depKLJuPPRabSr2kNWuOfrfHwe7eon7WTF/y9k0K52HslW/pQ02tUu/ira6SVdXnW7rJ2sav2cdnhwu6ydrnge0aN4hwe3w9q5Knd4eXcHt8Pa2SoXcxl3lyXuaqeqRss7u+Z2VztZ1azdY3C7qn2m5OhEUtUJvbSrU4lCO6kd4gRT3tVVibPamaonknDPHZzayTDj09WJW6HnSK69sHyY92HSjp7mVmgXtbNh9nRZR3eTzmqHGp55R9+gRBvtsDu6pKNLQLTRRjt687aj2kfJppW9ZN1rFeflau6adhzX2606hzTKdgXHknXvWHFu9GbJ9mjOk9S9o8V5lje2MJ84VRzPAS4X57HeaNmucXMJGKvz22vEebQ3RbbzXHtpMXzvZp44T/Huka1zl82N4fuSB4nzPd7jsnXubeAYvud+gDg/7vnjHFxwx+/zJMFye5zv+bvLn/Nde3Gx+6zUfFHeXbQnLV68+AHnXl3cPgf4gChPEu1R8qd7372O22dczxLlUaLt/1l+aHV0cMfl89utYvxvP9B+QX66zbnXF6/vJtwmxrur9vnyk4MX84/V927O1mk70H7mHMm9qSRO3ylrDYifUW3/CvlxjefqXBKH70uuEeEr/IL2pJaWFhe/DVLVd4Gd/P7eASI8qUP76YT8stzBF1nF99ydvKzAcvFNPN2h7d8sv7l44bRUxddwcPPLe8PF92a/U3uM/NayymnuKF+fZFXAO6ZL23/C0cEdj2vvBEP7Cb9be2KLozN3HK4rFczaLRN7aPuvOros8WJwzbRgQfKq31N7ROC/xs1Xu/n1ALNRuh7gkID23l7a/p5y05xjPfeHd9Sudblijsi+6PfWvjApNzr7z3pG+DquB4nrjG36aPu/d3gu8aJ7jeI1Aetefl9t/wVXF91dy+piAzzt9vW3dan9N39z7cdODdYlrS6/9shdW741WI+c+lgRbf/5FlePcfpMKtH5dxOC45qW5/1i2v7I4L42j2pVWwA60i+u7Y8N7l2HUo1aF3CO9Utpb7VbcP8QnGp3WLPbViW1/Uv2gbum2Ptc4pfW9v/ZGDxmHlahmxdANt7r96ft/0+521vhCrf0a1fs//r9a/u3zjhZumoFYmFOjlwVIM641R9I239ldvDIxcsxq7rliwPC2a/4A2v7D14bPPbkNmaTKmeRNvW79kG/HG3fn6wPP5PhXdXAPlP1JheDLartX6lPOPlsZu+KZ+z2At2Vfvna/pjdTtCYTiqcRApsV6z3K9H2/fGF553Txvgue1y3nVNAG18KtaS2P2Ja4akntDN/lzVft3d4vXGEX7m27+81q+P5N7atQrPfVrXd2GE1a69+RPvTlr3lHft11NJ+BFNKiQnkiPaWTqY7/tivZ//avn/+7P26ahl+yJD5q1a0sufUPWLrilXzhxwyvKUbaPb5A2gOpC3z956N+9HANe05YkDLgbWlh0fOQLPfZox8uBzIsrSlC6Zcj3gJ6eunXFCmYrnaQWtHTLph7EONresQlta1Nj409oZJI9ZWIPh/AQYA2whzWlA9R/cAAAAASUVORK5CYII=\'); background-repeat: no-repeat; background-position: center; background-size: cover; } rg-phone-sim .screen,[riot-tag="rg-phone-sim"] .screen { position: absolute; top: 105px; left: 22px; background-color: white; width: 320px; height: 568px; border: 0; }',"",function(t){var e=this;this.on("mount",function(){e.RgPhoneSim=t.phonesim||new RgPhoneSim(t);e.RgPhoneSim.on("update",function(){e.update()});e.update()})},"{ }");riot.tag2("rg-placeholdit",'<img riot-src="https://placeholdit.imgix.net/~text?bg={RgPlaceholdit.background}&txtclr={RgPlaceholdit.color}&txt={RgPlaceholdit.text}&txtsize={RgPlaceholdit.textsize}&w={RgPlaceholdit.width}&h={RgPlaceholdit.height}&fm={RgPlaceholdit.format}">',"","",function(t){var e=this;this.on("mount",function(){e.RgPlaceholdit=t.placeholdit||new RgPlaceholdit(t);e.RgPlaceholdit.on("update",function(){e.update()});e.update()})},"{ }");riot.tag2("rg-raw","<span></span>","","",function(t){this.on("mount update",function(){this.root.innerHTML=t.content||""})});riot.tag2("rg-select",'<div class="container {visible: RgSelect.isvisible}" riot-style="width: {width}"> <input if="{!RgSelect.autocomplete}" type="text" name="selectfield" class="field {visible: RgSelect.isvisible}" value="{fieldText}" placeholder="{RgSelect.placeholder}" onkeydown="{handleKeys}" onclick="{toggle}" readonly> <input if="{RgSelect.autocomplete}" type="text" name="autocompletefield" class="field {visible: RgSelect.isvisible}" value="{fieldText}" placeholder="{RgSelect.placeholder}" onkeydown="{handleKeys}" onclick="{toggle}" oninput="{filter}"> <div class="dropdown {isvisible: RgSelect.isvisible} {empty: RgSelect.filtereditems.length == 0}"> <div class="filter" if="{RgSelect.hasfilter && !RgSelect.autocomplete}"> <input type="text" name="filterfield" class="filter-box" placeholder="{RgSelect.filterplaceholder || \'Filter\'}" onkeydown="{handleKeys}" oninput="{filter}"> </div> <ul class="list {empty: RgSelect.filtereditems.length == 0}"> <li each="{RgSelect.filtereditems}" onclick="{parent.select}" class="item {selected: selected, disabled: disabled, active: active}"> {text} </li> </ul> </div> </div>','rg-select .container,[riot-tag="rg-select"] .container { position: relative; display: inline-block; cursor: pointer; } rg-select .field,[riot-tag="rg-select"] .field { width: 100%; padding: 10px; border: 1px solid #D3D3D3; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1em; line-height: normal; outline: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-select .dropdown,[riot-tag="rg-select"] .dropdown { display: none; position: absolute; width: 100%; background-color: white; border-bottom: 1px solid #D3D3D3; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; max-height: 280px; z-index: 10; } rg-select .dropdown.isvisible,[riot-tag="rg-select"] .dropdown.isvisible { display: block; } rg-select .dropdown.empty,[riot-tag="rg-select"] .dropdown.empty { border-bottom: 0; } rg-select .filter-box,[riot-tag="rg-select"] .filter-box { width: 100%; padding: 10px; font-size: 0.9em; border: 0; border-left: 1px solid #D3D3D3; border-right: 1px solid #D3D3D3; border-bottom: 1px solid #E8E8E8; outline: none; color: #555; box-sizing: border-box; } rg-select .list,[riot-tag="rg-select"] .list,rg-select .item,[riot-tag="rg-select"] .item { list-style: none; padding: 0; margin: 0; } rg-select .list.empty,[riot-tag="rg-select"] .list.empty { display: none; } rg-select .item,[riot-tag="rg-select"] .item { padding: 10px; border-left: 1px solid #D3D3D3; border-right: 1px solid #D3D3D3; border-top: 1px solid #E8E8E8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } rg-select .item:first-child,[riot-tag="rg-select"] .item:first-child { border-top: 0; } rg-select .selected,[riot-tag="rg-select"] .selected { font-weight: bold; background-color: #f8f8f8; } rg-select .item:hover,[riot-tag="rg-select"] .item:hover { background-color: #f3f3f3; } rg-select .item.active,[riot-tag="rg-select"] .item.active,rg-select .item:hover.active,[riot-tag="rg-select"] .item:hover.active { background-color: #ededed; }',"",function(t){
var e=this;var i=function o(t){if(!e.root.contains(t.target)){e.RgSelect.close();e.update()}};this.handleKeys=function(t){if([13,38,40].indexOf(t.keyCode)>-1&&!e.RgSelect.isvisible){t.preventDefault();e.toggle();return true}if(e.RgSelect.autocomplete&&!e.RgSelect.isvisible)e.toggle();var i=e.RgSelect.filtereditems.length;if(i>0&&[13,38,40].indexOf(t.keyCode)>-1){t.preventDefault();var o=null;for(var n=0;n<i;n++){var r=e.RgSelect.filtereditems[n];if(r.active){o=n;break}}if(o!=null)e.RgSelect.filtereditems[o].active=false;if(t.keyCode==38){if(o==null||o==0)e.RgSelect.filtereditems[i-1].active=true;else e.RgSelect.filtereditems[o-1].active=true}else if(t.keyCode==40){if(o==null||o==i-1)e.RgSelect.filtereditems[0].active=true;else e.RgSelect.filtereditems[o+1].active=true}else if(t.keyCode==13&&o!=null){e.select({item:e.RgSelect.filtereditems[o]})}}return true};this.toggle=function(){e.RgSelect.toggle()};this.filter=function(){var t=e.filterfield.value;if(e.RgSelect.autocomplete)t=e.autocompletefield.value;e.RgSelect.filter(t)};this.select=function(t){t=t.item;e.RgSelect.select(t)};this.on("mount",function(){e.RgSelect=t.select||new RgSelect(t);e.RgSelect.on("update",function(){if(e.RgSelect.isvisible)e.filter();e.update()});e.RgSelect.on("select",function(t){e.selectfield.value=t[e.RgSelect.filteron];e.autocompletefield.value=t[e.RgSelect.filteron];e.update()});document.addEventListener("click",i);e.filter();e.update()});this.on("unmount",function(){document.removeEventListener("click",i)})},"{ }");riot.tag2("rg-sidemenu",'<rg-drawer drawer="{RgSidemenu}">','rg-sidemenu .overlay,[riot-tag="rg-sidemenu"] .overlay { background-color: rgba(0, 0, 0, 0.8); } rg-sidemenu .overlay.visible,[riot-tag="rg-sidemenu"] .overlay.visible { display: block; } rg-sidemenu .drawer,[riot-tag="rg-sidemenu"] .drawer { background-color: black; color: white; } rg-sidemenu .header,[riot-tag="rg-sidemenu"] .header { color: white; } rg-sidemenu .item,[riot-tag="rg-sidemenu"] .item { border-top: 1px solid #1a1a1a; color: white; } rg-sidemenu .item:last-child,[riot-tag="rg-sidemenu"] .item:last-child { border-bottom: 1px solid #1a1a1a; } rg-sidemenu .item:hover,[riot-tag="rg-sidemenu"] .item:hover { background-color: #2a2a2a; } rg-sidemenu .item.active,[riot-tag="rg-sidemenu"] .item.active { background-color: #444; }',"",function(t){var e=this;this.on("mount",function(){e.RgSidemenu=t.sidemenu||new RgSidemenu(t);e.RgSidemenu.position="left";e.RgSidemenu.on("update",function(){e.update()});e.update()})},"{ }");riot.tag2("rg-tabs",'<div class="headers"> <div each="{RgTabs.tabs}" class="header {active: active, disabled: disabled}" onclick="{parent.select}"> <div class="heading" if="{heading}"> <rg-raw content="{heading}"></rg-raw> </div> </div> </div> <div each="{RgTabs.tabs}" class="tab {active: active}"> <div if="{rg.isDefined(content)}"> {content} </div> <div if="{rg.isDefined(include)}"> <rg-include include="{include}"></rg-include> </div> </div>','rg-tabs .headers,[riot-tag="rg-tabs"] .headers { display: -webkit-flex; display: -ms-flexbox; display: flex; } rg-tabs .header,[riot-tag="rg-tabs"] .header { -webkit-flex: 1; -ms-flex: 1; flex: 1; box-sizing: border-box; text-align: center; cursor: pointer; box-shadow: 0 -1px 0 0 #000 inset; } rg-tabs .heading,[riot-tag="rg-tabs"] .heading { padding: 10px; margin: 0; } rg-tabs .header.active,[riot-tag="rg-tabs"] .header.active { background-color: #000; } rg-tabs .header.active .heading,[riot-tag="rg-tabs"] .header.active .heading { color: white; } rg-tabs .header.disabled .heading,[riot-tag="rg-tabs"] .header.disabled .heading { color: #888; } rg-tabs .tab,[riot-tag="rg-tabs"] .tab { display: none; padding: 10px; } rg-tabs .tab.active,[riot-tag="rg-tabs"] .tab.active { display: block; }',"",function(t){var e=this;this.on("mount",function(){e.RgTabs=t.tabs||new RgTabs(t);e.RgTabs.on("update",function(){e.update()});e.update()});this.select=function(t){e.RgTabs.select(t.item)}},"{ }");riot.tag2("rg-tags",'<div class="container"> <span class="tags"> <span class="tag" each="{RgTags.tags}" onclick="{parent.removeTag}"> {text} <span class="close">&times;</span> </span> </span> <div class="field-container {isvisible: RgTags.isvisible}"> <input type="text" class="field" name="filterfield" placeholder="{RgTags.placeholder}" onkeydown="{handleKeys}" oninput="{filter}" onfocus="{toggle}"> <div class="dropdown {isvisible: RgTags.isvisible}"> <ul class="list"> <li each="{RgTags.filtereditems}" onclick="{parent.addTag}" class="item {disabled: disabled, active: active}"> {text} </li> </ul> </div> </div> </div>','rg-tags .container,[riot-tag="rg-tags"] .container { position: relative; width: 100%; border: 1px solid #D3D3D3; background-color: white; text-align: left; padding: 0; box-sizing: border-box; } rg-tags .field-container,[riot-tag="rg-tags"] .field-container { position: absolute; display: inline-block; cursor: pointer; } rg-tags .field,[riot-tag="rg-tags"] .field { width: 100%; padding: 10px; border: 0; box-sizing: border-box; background-color: transparent; white-space: nowrap; font-size: 1em; line-height: normal; outline: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; } rg-tags .dropdown,[riot-tag="rg-tags"] .dropdown { display: none; position: absolute; width: 100%; background-color: white; border-bottom: 1px solid #D3D3D3; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; max-height: 280px; margin: -1px 0 0 -1px; } rg-tags .dropdown.isvisible,[riot-tag="rg-tags"] .dropdown.isvisible { display: block; } rg-tags .list,[riot-tag="rg-tags"] .list,rg-tags .item,[riot-tag="rg-tags"] .item { list-style: none; padding: 0; margin: 0; } rg-tags .list.empty,[riot-tag="rg-tags"] .list.empty { display: none; } rg-tags .item,[riot-tag="rg-tags"] .item { padding: 10px; border-left: 1px solid #D3D3D3; border-right: 1px solid #D3D3D3; border-top: 1px solid #E8E8E8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } rg-tags .item:first-child,[riot-tag="rg-tags"] .item:first-child { border-top: 0; } rg-tags .item:hover,[riot-tag="rg-tags"] .item:hover { background-color: #f3f3f3; } rg-tags .item.active,[riot-tag="rg-tags"] .item.active,rg-tags .item:hover.active,[riot-tag="rg-tags"] .item:hover.active { background-color: #ededed; } rg-tags .tags,[riot-tag="rg-tags"] .tags { display: inline-block; max-width: 70%; white-space: nowrap; overflow-y: hidden; overflow-x: auto; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; } rg-tags .tag,[riot-tag="rg-tags"] .tag { position: relative; display: inline-block; padding: 8px 20px 8px 5px; margin: 1px; background-color: #000; color: #fff; font-size: 1em; line-height: normal; cursor: pointer; } rg-tags .tag:hover,[riot-tag="rg-tags"] .tag:hover,rg-tags .tag:active,[riot-tag="rg-tags"] .tag:active { background-color: #666; } rg-tags .close,[riot-tag="rg-tags"] .close { position: absolute; right: 5px; top: 7px; color: rgba(255, 255, 255, 0.7); }',"",function(t){var e=this;var i=function o(t){if(!e.root.contains(t.target)){e.RgTags.close()}};this.handleKeys=function(t){if([13,38,40].indexOf(t.keyCode)>-1&&!e.RgTags.isvisible){t.preventDefault();e.toggle();return true}if(!e.RgTags.isvisible)e.toggle();var i=e.RgTags.filtereditems.length;if(i>0&&[13,38,40].indexOf(t.keyCode)>-1){t.preventDefault();var o=null;for(var n=0;n<i;n++){var r=e.RgTags.filtereditems[n];if(r.active){o=n;break}}if(o!=null)e.RgTags.filtereditems[o].active=false;if(t.keyCode==38){if(o==null||o==0)e.RgTags.filtereditems[i-1].active=true;else e.RgTags.filtereditems[o-1].active=true}else if(t.keyCode==40){if(o==null||o==i-1)e.RgTags.filtereditems[0].active=true;else e.RgTags.filtereditems[o+1].active=true}else if(t.keyCode==13&&o!=null){e.addTag({item:e.RgTags.filtereditems[o]})}}if(t.keyCode==13){e.addTag()}else if(t.keyCode==8&&e.filterfield.value==""&&e.RgTags.tags.length>0){var s=e.RgTags.tags.pop();e.filterfield.value=s.text}return true};this.toggle=function(){e.filter();e.RgTags.toggle()};this.filter=function(){e.RgTags.filter(e.filterfield.value)};this.addTag=function(t){var i={text:e.filterfield.value};if(t)i=t.item;if(i.text.length>0)e.RgTags.addTag(i);e.filterfield.value=""};this.removeTag=function(t){e.RgTags.removeTag(t.item)};this.on("mount",function(){e.RgTags=t.tags||new RgTags(t);e.RgTags.on("update",function(){if(e.RgTags.isvisible)e.filter();e.update()});document.addEventListener("click",i);document.addEventListener("focus",i,true);e.filterfield.value=e.RgTags.value;e.update()});this.on("unmount",function(){document.removeEventListener("click",i);document.removeEventListener("focus",i,true)});this.on("update",function(){if(e.isMounted){var t=e.root.querySelector(".container");var i=t.getBoundingClientRect().width;var o=e.root.querySelector(".tags");var n=o.getBoundingClientRect().width;o.scrollLeft=Number.MAX_VALUE;var r=e.root.querySelector(".field-container");r.style.width=i-n+"px";e.root.querySelector(".container").style.height=r.getBoundingClientRect().height+"px"}})},"{ }");riot.tag2("rg-time",'<rg-select select="{RgTime}"></rg-select>',"","",function(t){var e=this;var i=function o(){e.RgTime.options=[];for(var t=0;t<1440;t++){if(t%e.RgTime.step==0){var i=new Date(0);i.setHours(e.RgTime.time.getHours());i.setMinutes(e.RgTime.time.getMinutes());i=new Date(i.getTime()+t*6e4);if(e.RgTime.min){if(i.getHours()<e.RgTime.min[0])continue;if(i.getHours()==e.RgTime.min[0]&&i.getMinutes()<e.RgTime.min[1])continue}if(e.RgTime.max){if(i.getHours()>e.RgTime.max[0])continue;if(i.getHours()==e.RgTime.max[0]&&i.getMinutes()>e.RgTime.max[1])continue}var o={hours:i.getHours(),minutes:i.getMinutes()};var n=o.minutes;if(n<10)n="0"+n;if(e.RgTime.ampm){var r="am";var s=o.hours;if(s>=12){r="pm";s=s-12}if(s==0)s=12;o.text=s+":"+n+" "+r;o.period=r}else{var s=o.hours;if(s<10)s="0"+s;o.text=s+":"+n}e.RgTime.options.push(o)}}};this.on("mount",function(){e.RgTime=t.time||new RgTime(t);e.RgTime.on("update",function(){i();e.update()});i();e.update()})},"{ }");riot.tag2("rg-toasts",'<div class="toasts {RgToasts.position} {isvisible: RgToasts.isvisible}"> <div each="{RgToasts.toasts}" class="toast {isvisible: isvisible}" onclick="{parent.toastClicked}"> <rg-raw content="{content}"></rg-raw> </div> </div>','rg-toasts .toasts,[riot-tag="rg-toasts"] .toasts { display: none; position: fixed; width: 250px; max-height: 100%; overflow-y: auto; background-color: transparent; z-index: 101; } rg-toasts .toasts.isvisible,[riot-tag="rg-toasts"] .toasts.isvisible { display: block; } rg-toasts .toasts.topleft,[riot-tag="rg-toasts"] .toasts.topleft { top: 0; left: 0; } rg-toasts .toasts.topright,[riot-tag="rg-toasts"] .toasts.topright { top: 0; right: 0; } rg-toasts .toasts.bottomleft,[riot-tag="rg-toasts"] .toasts.bottomleft { bottom: 0; left: 0; } rg-toasts .toasts.bottomright,[riot-tag="rg-toasts"] .toasts.bottomright { bottom: 0; right: 0; } rg-toasts .toast,[riot-tag="rg-toasts"] .toast { display: none; padding: 20px; margin: 20px; background-color: #000; color: white; font-size: 0.9em; cursor: pointer; } rg-toasts .toast.isvisible,[riot-tag="rg-toasts"] .toast.isvisible { display: block; }',"",function(t){var e=this;this.toastClicked=function(t){var e=t.item;if(rg.isFunction(e.onclick))e.onclick();if(rg.isFunction(e.onclose))e.onclose();window.clearTimeout(e.timer);e.isvisible=false};this.on("mount",function(){e.RgToasts=t.toasts||new RgToasts(t);e.RgToasts.on("update",function(){e.update()});e.update()})},"{ }");riot.tag2("rg-toggle",'<div class="wrapper"> <label class="toggle"> <input type="checkbox" __checked="{RgToggle.checked}" onclick="{toggle}"> <div class="track"> <div class="handle"></div> </div> </label> </div>','rg-toggle .wrapper,[riot-tag="rg-toggle"] .wrapper { width: 60px; height: 20px; margin: 0; display: inline-block; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; } rg-toggle .toggle,[riot-tag="rg-toggle"] .toggle { position: absolute; cursor: pointer; } rg-toggle input[type=checkbox],[riot-tag="rg-toggle"] input[type=checkbox] { display: none; } rg-toggle .track,[riot-tag="rg-toggle"] .track { position: absolute; top: 0; bottom: 0; left: 0; right: 0; width: 60px; height: 20px; padding: 2px; background-color: #b6c0c7; transition: background-color 0.1s linear; box-sizing: border-box; } rg-toggle input[type=checkbox]:checked + .track,[riot-tag="rg-toggle"] input[type=checkbox]:checked + .track { background-color: #000; } rg-toggle .handle,[riot-tag="rg-toggle"] .handle { position: relative; left: 0; width: 50%; height: 100%; background-color: white; transition: transform 0.1s linear; } rg-toggle input[type=checkbox]:checked + .track .handle,[riot-tag="rg-toggle"] input[type=checkbox]:checked + .track .handle { transform: translate3d(100%, 0, 0); }',"",function(t){var e=this;this.on("mount",function(){e.RgToggle=t.toggle||new RgToggle;e.RgToggle.on("update",function(){e.update()});e.update()});this.toggle=function(){e.RgToggle.toggle()}},"{ }");riot.tag2("rg-unsplash",'<img riot-src="https://unsplash.it/{greyscale}{RgUnsplash.width}/{RgUnsplash.height}/?{options}">',"","",function(t){var e=this;this.on("mount",function(){e.RgUnsplash=t.unsplash||new RgUnsplash;e.RgUnsplash.on("update",function(){e.update()});e.on("update",function(){e.options="";if(e.RgUnsplash.greyscale)e.greyscale="g/";if(e.RgUnsplash.random)e.options+="random&";if(e.RgUnsplash.blur)e.options+="blur&";if(e.RgUnsplash.image)e.options+="image="+e.RgUnsplash.image+"&";if(rg.isDefined(e.RgUnsplash.gravity))e.options+="gravity="+e.RgUnsplash.gravity});e.update()})},"{ }");
},{}],5:[function(require,module,exports){
var riot = require('riot');
module.exports = riot.tag2('app', '<div> <p>This is the app tag</p> <p>Raw content:<raw content="this is inside the raw tag"></raw> <rg-loading loading="{loading}"> Please wait... </rg-loading> </div>', '', '', function(opts) {
	var rg = require('../node_modules/riotgear/dist/rg.js')();
	debugger;

	this.loading = new RgLoading({
	  isvisible: true
	});

	this.on('mount', function() {
	});
}, '{ }');
},{"../node_modules/riotgear/dist/rg.js":3,"riot":2}],6:[function(require,module,exports){
var riot = require('riot');
module.exports = riot.tag2('raw', '<span></span>', '', '', function(opts) {
    this.root.innerHTML = opts.content
});
},{"riot":2}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJicm93c2VyaWZ5X2VudHJ5cG9pbnQuanMiLCJub2RlX21vZHVsZXMvcmlvdC9yaW90LmpzIiwibm9kZV9tb2R1bGVzL3Jpb3RnZWFyL2Rpc3QvcmcuanMiLCJub2RlX21vZHVsZXMvcmlvdGdlYXIvZGlzdC9yZy5taW4uanMiLCJ0YWdzL2FwcC50YWciLCJ0YWdzL3Jhdy50YWciXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeDNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2bkZBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIHJpb3QgPSByZXF1aXJlKCdyaW90Jyk7XG53aW5kb3cucmlvdCA9IHJpb3Q7XG5cbnJlcXVpcmUoJ3Jpb3RnZWFyJyk7XG5yZXF1aXJlKCcuL3RhZ3MvcmF3LnRhZycpO1xucmVxdWlyZSgnLi90YWdzL2FwcC50YWcnKTtcblxucmlvdC5tb3VudCgnYXBwJyk7XG4gIiwiLyogUmlvdCB2Mi4zLjEzLCBAbGljZW5zZSBNSVQsIChjKSAyMDE1IE11dXQgSW5jLiArIGNvbnRyaWJ1dG9ycyAqL1xuXG47KGZ1bmN0aW9uKHdpbmRvdywgdW5kZWZpbmVkKSB7XG4gICd1c2Ugc3RyaWN0JztcbnZhciByaW90ID0geyB2ZXJzaW9uOiAndjIuMy4xMycsIHNldHRpbmdzOiB7fSB9LFxuICAvLyBiZSBhd2FyZSwgaW50ZXJuYWwgdXNhZ2VcbiAgLy8gQVRURU5USU9OOiBwcmVmaXggdGhlIGdsb2JhbCBkeW5hbWljIHZhcmlhYmxlcyB3aXRoIGBfX2BcblxuICAvLyBjb3VudGVyIHRvIGdpdmUgYSB1bmlxdWUgaWQgdG8gYWxsIHRoZSBUYWcgaW5zdGFuY2VzXG4gIF9fdWlkID0gMCxcbiAgLy8gdGFncyBpbnN0YW5jZXMgY2FjaGVcbiAgX192aXJ0dWFsRG9tID0gW10sXG4gIC8vIHRhZ3MgaW1wbGVtZW50YXRpb24gY2FjaGVcbiAgX190YWdJbXBsID0ge30sXG5cbiAgLyoqXG4gICAqIENvbnN0XG4gICAqL1xuICAvLyByaW90IHNwZWNpZmljIHByZWZpeGVzXG4gIFJJT1RfUFJFRklYID0gJ3Jpb3QtJyxcbiAgUklPVF9UQUcgPSBSSU9UX1BSRUZJWCArICd0YWcnLFxuXG4gIC8vIGZvciB0eXBlb2YgPT0gJycgY29tcGFyaXNvbnNcbiAgVF9TVFJJTkcgPSAnc3RyaW5nJyxcbiAgVF9PQkpFQ1QgPSAnb2JqZWN0JyxcbiAgVF9VTkRFRiAgPSAndW5kZWZpbmVkJyxcbiAgVF9GVU5DVElPTiA9ICdmdW5jdGlvbicsXG4gIC8vIHNwZWNpYWwgbmF0aXZlIHRhZ3MgdGhhdCBjYW5ub3QgYmUgdHJlYXRlZCBsaWtlIHRoZSBvdGhlcnNcbiAgU1BFQ0lBTF9UQUdTX1JFR0VYID0gL14oPzpvcHQoaW9ufGdyb3VwKXx0Ym9keXxjb2x8dFtyaGRdKSQvLFxuICBSRVNFUlZFRF9XT1JEU19CTEFDS0xJU1QgPSBbJ19pdGVtJywgJ19pZCcsICdfcGFyZW50JywgJ3VwZGF0ZScsICdyb290JywgJ21vdW50JywgJ3VubW91bnQnLCAnbWl4aW4nLCAnaXNNb3VudGVkJywgJ2lzTG9vcCcsICd0YWdzJywgJ3BhcmVudCcsICdvcHRzJywgJ3RyaWdnZXInLCAnb24nLCAnb2ZmJywgJ29uZSddLFxuXG4gIC8vIHZlcnNpb24jIGZvciBJRSA4LTExLCAwIGZvciBvdGhlcnNcbiAgSUVfVkVSU0lPTiA9ICh3aW5kb3cgJiYgd2luZG93LmRvY3VtZW50IHx8IHt9KS5kb2N1bWVudE1vZGUgfCAwXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xucmlvdC5vYnNlcnZhYmxlID0gZnVuY3Rpb24oZWwpIHtcblxuICAvKipcbiAgICogRXh0ZW5kIHRoZSBvcmlnaW5hbCBvYmplY3Qgb3IgY3JlYXRlIGEgbmV3IGVtcHR5IG9uZVxuICAgKiBAdHlwZSB7IE9iamVjdCB9XG4gICAqL1xuXG4gIGVsID0gZWwgfHwge31cblxuICAvKipcbiAgICogUHJpdmF0ZSB2YXJpYWJsZXMgYW5kIG1ldGhvZHNcbiAgICovXG4gIHZhciBjYWxsYmFja3MgPSB7fSxcbiAgICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZSxcbiAgICBvbkVhY2hFdmVudCA9IGZ1bmN0aW9uKGUsIGZuKSB7IGUucmVwbGFjZSgvXFxTKy9nLCBmbikgfSxcbiAgICBkZWZpbmVQcm9wZXJ0eSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWwsIGtleSwge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICAgIH0pXG4gICAgfVxuXG4gIC8qKlxuICAgKiBMaXN0ZW4gdG8gdGhlIGdpdmVuIHNwYWNlIHNlcGFyYXRlZCBsaXN0IG9mIGBldmVudHNgIGFuZCBleGVjdXRlIHRoZSBgY2FsbGJhY2tgIGVhY2ggdGltZSBhbiBldmVudCBpcyB0cmlnZ2VyZWQuXG4gICAqIEBwYXJhbSAgeyBTdHJpbmcgfSBldmVudHMgLSBldmVudHMgaWRzXG4gICAqIEBwYXJhbSAgeyBGdW5jdGlvbiB9IGZuIC0gY2FsbGJhY2sgZnVuY3Rpb25cbiAgICogQHJldHVybnMgeyBPYmplY3QgfSBlbFxuICAgKi9cbiAgZGVmaW5lUHJvcGVydHkoJ29uJywgZnVuY3Rpb24oZXZlbnRzLCBmbikge1xuICAgIGlmICh0eXBlb2YgZm4gIT0gJ2Z1bmN0aW9uJykgIHJldHVybiBlbFxuXG4gICAgb25FYWNoRXZlbnQoZXZlbnRzLCBmdW5jdGlvbihuYW1lLCBwb3MpIHtcbiAgICAgIChjYWxsYmFja3NbbmFtZV0gPSBjYWxsYmFja3NbbmFtZV0gfHwgW10pLnB1c2goZm4pXG4gICAgICBmbi50eXBlZCA9IHBvcyA+IDBcbiAgICB9KVxuXG4gICAgcmV0dXJuIGVsXG4gIH0pXG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgdGhlIGdpdmVuIHNwYWNlIHNlcGFyYXRlZCBsaXN0IG9mIGBldmVudHNgIGxpc3RlbmVyc1xuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGV2ZW50cyAtIGV2ZW50cyBpZHNcbiAgICogQHBhcmFtICAgeyBGdW5jdGlvbiB9IGZuIC0gY2FsbGJhY2sgZnVuY3Rpb25cbiAgICogQHJldHVybnMgeyBPYmplY3QgfSBlbFxuICAgKi9cbiAgZGVmaW5lUHJvcGVydHkoJ29mZicsIGZ1bmN0aW9uKGV2ZW50cywgZm4pIHtcbiAgICBpZiAoZXZlbnRzID09ICcqJyAmJiAhZm4pIGNhbGxiYWNrcyA9IHt9XG4gICAgZWxzZSB7XG4gICAgICBvbkVhY2hFdmVudChldmVudHMsIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgdmFyIGFyciA9IGNhbGxiYWNrc1tuYW1lXVxuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBjYjsgY2IgPSBhcnIgJiYgYXJyW2ldOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChjYiA9PSBmbikgYXJyLnNwbGljZShpLS0sIDEpXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgZGVsZXRlIGNhbGxiYWNrc1tuYW1lXVxuICAgICAgfSlcbiAgICB9XG4gICAgcmV0dXJuIGVsXG4gIH0pXG5cbiAgLyoqXG4gICAqIExpc3RlbiB0byB0aGUgZ2l2ZW4gc3BhY2Ugc2VwYXJhdGVkIGxpc3Qgb2YgYGV2ZW50c2AgYW5kIGV4ZWN1dGUgdGhlIGBjYWxsYmFja2AgYXQgbW9zdCBvbmNlXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gZXZlbnRzIC0gZXZlbnRzIGlkc1xuICAgKiBAcGFyYW0gICB7IEZ1bmN0aW9uIH0gZm4gLSBjYWxsYmFjayBmdW5jdGlvblxuICAgKiBAcmV0dXJucyB7IE9iamVjdCB9IGVsXG4gICAqL1xuICBkZWZpbmVQcm9wZXJ0eSgnb25lJywgZnVuY3Rpb24oZXZlbnRzLCBmbikge1xuICAgIGZ1bmN0aW9uIG9uKCkge1xuICAgICAgZWwub2ZmKGV2ZW50cywgb24pXG4gICAgICBmbi5hcHBseShlbCwgYXJndW1lbnRzKVxuICAgIH1cbiAgICByZXR1cm4gZWwub24oZXZlbnRzLCBvbilcbiAgfSlcblxuICAvKipcbiAgICogRXhlY3V0ZSBhbGwgY2FsbGJhY2sgZnVuY3Rpb25zIHRoYXQgbGlzdGVuIHRvIHRoZSBnaXZlbiBzcGFjZSBzZXBhcmF0ZWQgbGlzdCBvZiBgZXZlbnRzYFxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGV2ZW50cyAtIGV2ZW50cyBpZHNcbiAgICogQHJldHVybnMgeyBPYmplY3QgfSBlbFxuICAgKi9cbiAgZGVmaW5lUHJvcGVydHkoJ3RyaWdnZXInLCBmdW5jdGlvbihldmVudHMpIHtcblxuICAgIC8vIGdldHRpbmcgdGhlIGFyZ3VtZW50c1xuICAgIC8vIHNraXBwaW5nIHRoZSBmaXJzdCBvbmVcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgIGZuc1xuXG4gICAgb25FYWNoRXZlbnQoZXZlbnRzLCBmdW5jdGlvbihuYW1lKSB7XG5cbiAgICAgIGZucyA9IHNsaWNlLmNhbGwoY2FsbGJhY2tzW25hbWVdIHx8IFtdLCAwKVxuXG4gICAgICBmb3IgKHZhciBpID0gMCwgZm47IGZuID0gZm5zW2ldOyArK2kpIHtcbiAgICAgICAgaWYgKGZuLmJ1c3kpIHJldHVyblxuICAgICAgICBmbi5idXN5ID0gMVxuICAgICAgICBmbi5hcHBseShlbCwgZm4udHlwZWQgPyBbbmFtZV0uY29uY2F0KGFyZ3MpIDogYXJncylcbiAgICAgICAgaWYgKGZuc1tpXSAhPT0gZm4pIHsgaS0tIH1cbiAgICAgICAgZm4uYnVzeSA9IDBcbiAgICAgIH1cblxuICAgICAgaWYgKGNhbGxiYWNrc1snKiddICYmIG5hbWUgIT0gJyonKVxuICAgICAgICBlbC50cmlnZ2VyLmFwcGx5KGVsLCBbJyonLCBuYW1lXS5jb25jYXQoYXJncykpXG5cbiAgICB9KVxuXG4gICAgcmV0dXJuIGVsXG4gIH0pXG5cbiAgcmV0dXJuIGVsXG5cbn1cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG47KGZ1bmN0aW9uKHJpb3QpIHtcblxuLyoqXG4gKiBTaW1wbGUgY2xpZW50LXNpZGUgcm91dGVyXG4gKiBAbW9kdWxlIHJpb3Qtcm91dGVcbiAqL1xuXG5cbnZhciBSRV9PUklHSU4gPSAvXi4rP1xcLytbXlxcL10rLyxcbiAgRVZFTlRfTElTVEVORVIgPSAnRXZlbnRMaXN0ZW5lcicsXG4gIFJFTU9WRV9FVkVOVF9MSVNURU5FUiA9ICdyZW1vdmUnICsgRVZFTlRfTElTVEVORVIsXG4gIEFERF9FVkVOVF9MSVNURU5FUiA9ICdhZGQnICsgRVZFTlRfTElTVEVORVIsXG4gIEhBU19BVFRSSUJVVEUgPSAnaGFzQXR0cmlidXRlJyxcbiAgUkVQTEFDRSA9ICdyZXBsYWNlJyxcbiAgUE9QU1RBVEUgPSAncG9wc3RhdGUnLFxuICBIQVNIQ0hBTkdFID0gJ2hhc2hjaGFuZ2UnLFxuICBUUklHR0VSID0gJ3RyaWdnZXInLFxuICBNQVhfRU1JVF9TVEFDS19MRVZFTCA9IDMsXG4gIHdpbiA9IHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LFxuICBkb2MgPSB0eXBlb2YgZG9jdW1lbnQgIT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQsXG4gIGhpc3QgPSB3aW4gJiYgaGlzdG9yeSxcbiAgbG9jID0gd2luICYmIChoaXN0LmxvY2F0aW9uIHx8IHdpbi5sb2NhdGlvbiksIC8vIHNlZSBodG1sNS1oaXN0b3J5LWFwaVxuICBwcm90ID0gUm91dGVyLnByb3RvdHlwZSwgLy8gdG8gbWluaWZ5IG1vcmVcbiAgY2xpY2tFdmVudCA9IGRvYyAmJiBkb2Mub250b3VjaHN0YXJ0ID8gJ3RvdWNoc3RhcnQnIDogJ2NsaWNrJyxcbiAgc3RhcnRlZCA9IGZhbHNlLFxuICBjZW50cmFsID0gcmlvdC5vYnNlcnZhYmxlKCksXG4gIHJvdXRlRm91bmQgPSBmYWxzZSxcbiAgZGVib3VuY2VkRW1pdCxcbiAgYmFzZSwgY3VycmVudCwgcGFyc2VyLCBzZWNvbmRQYXJzZXIsIGVtaXRTdGFjayA9IFtdLCBlbWl0U3RhY2tMZXZlbCA9IDBcblxuLyoqXG4gKiBEZWZhdWx0IHBhcnNlci4gWW91IGNhbiByZXBsYWNlIGl0IHZpYSByb3V0ZXIucGFyc2VyIG1ldGhvZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gY3VycmVudCBwYXRoIChub3JtYWxpemVkKVxuICogQHJldHVybnMge2FycmF5fSBhcnJheVxuICovXG5mdW5jdGlvbiBERUZBVUxUX1BBUlNFUihwYXRoKSB7XG4gIHJldHVybiBwYXRoLnNwbGl0KC9bLz8jXS8pXG59XG5cbi8qKlxuICogRGVmYXVsdCBwYXJzZXIgKHNlY29uZCkuIFlvdSBjYW4gcmVwbGFjZSBpdCB2aWEgcm91dGVyLnBhcnNlciBtZXRob2QuXG4gKiBAcGFyYW0ge3N0cmluZ30gcGF0aCAtIGN1cnJlbnQgcGF0aCAobm9ybWFsaXplZClcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWx0ZXIgLSBmaWx0ZXIgc3RyaW5nIChub3JtYWxpemVkKVxuICogQHJldHVybnMge2FycmF5fSBhcnJheVxuICovXG5mdW5jdGlvbiBERUZBVUxUX1NFQ09ORF9QQVJTRVIocGF0aCwgZmlsdGVyKSB7XG4gIHZhciByZSA9IG5ldyBSZWdFeHAoJ14nICsgZmlsdGVyW1JFUExBQ0VdKC9cXCovZywgJyhbXi8/I10rPyknKVtSRVBMQUNFXSgvXFwuXFwuLywgJy4qJykgKyAnJCcpLFxuICAgIGFyZ3MgPSBwYXRoLm1hdGNoKHJlKVxuXG4gIGlmIChhcmdzKSByZXR1cm4gYXJncy5zbGljZSgxKVxufVxuXG4vKipcbiAqIFNpbXBsZS9jaGVhcCBkZWJvdW5jZSBpbXBsZW1lbnRhdGlvblxuICogQHBhcmFtICAge2Z1bmN0aW9ufSBmbiAtIGNhbGxiYWNrXG4gKiBAcGFyYW0gICB7bnVtYmVyfSBkZWxheSAtIGRlbGF5IGluIHNlY29uZHNcbiAqIEByZXR1cm5zIHtmdW5jdGlvbn0gZGVib3VuY2VkIGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGRlYm91bmNlKGZuLCBkZWxheSkge1xuICB2YXIgdFxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGNsZWFyVGltZW91dCh0KVxuICAgIHQgPSBzZXRUaW1lb3V0KGZuLCBkZWxheSlcbiAgfVxufVxuXG4vKipcbiAqIFNldCB0aGUgd2luZG93IGxpc3RlbmVycyB0byB0cmlnZ2VyIHRoZSByb3V0ZXNcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gYXV0b0V4ZWMgLSBzZWUgcm91dGUuc3RhcnRcbiAqL1xuZnVuY3Rpb24gc3RhcnQoYXV0b0V4ZWMpIHtcbiAgZGVib3VuY2VkRW1pdCA9IGRlYm91bmNlKGVtaXQsIDEpXG4gIHdpbltBRERfRVZFTlRfTElTVEVORVJdKFBPUFNUQVRFLCBkZWJvdW5jZWRFbWl0KVxuICB3aW5bQUREX0VWRU5UX0xJU1RFTkVSXShIQVNIQ0hBTkdFLCBkZWJvdW5jZWRFbWl0KVxuICBkb2NbQUREX0VWRU5UX0xJU1RFTkVSXShjbGlja0V2ZW50LCBjbGljaylcbiAgaWYgKGF1dG9FeGVjKSBlbWl0KHRydWUpXG59XG5cbi8qKlxuICogUm91dGVyIGNsYXNzXG4gKi9cbmZ1bmN0aW9uIFJvdXRlcigpIHtcbiAgdGhpcy4kID0gW11cbiAgcmlvdC5vYnNlcnZhYmxlKHRoaXMpIC8vIG1ha2UgaXQgb2JzZXJ2YWJsZVxuICBjZW50cmFsLm9uKCdzdG9wJywgdGhpcy5zLmJpbmQodGhpcykpXG4gIGNlbnRyYWwub24oJ2VtaXQnLCB0aGlzLmUuYmluZCh0aGlzKSlcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGhbUkVQTEFDRV0oL15cXC98XFwvJC8sICcnKVxufVxuXG5mdW5jdGlvbiBpc1N0cmluZyhzdHIpIHtcbiAgcmV0dXJuIHR5cGVvZiBzdHIgPT0gJ3N0cmluZydcbn1cblxuLyoqXG4gKiBHZXQgdGhlIHBhcnQgYWZ0ZXIgZG9tYWluIG5hbWVcbiAqIEBwYXJhbSB7c3RyaW5nfSBocmVmIC0gZnVsbHBhdGhcbiAqIEByZXR1cm5zIHtzdHJpbmd9IHBhdGggZnJvbSByb290XG4gKi9cbmZ1bmN0aW9uIGdldFBhdGhGcm9tUm9vdChocmVmKSB7XG4gIHJldHVybiAoaHJlZiB8fCBsb2MuaHJlZiB8fCAnJylbUkVQTEFDRV0oUkVfT1JJR0lOLCAnJylcbn1cblxuLyoqXG4gKiBHZXQgdGhlIHBhcnQgYWZ0ZXIgYmFzZVxuICogQHBhcmFtIHtzdHJpbmd9IGhyZWYgLSBmdWxscGF0aFxuICogQHJldHVybnMge3N0cmluZ30gcGF0aCBmcm9tIGJhc2VcbiAqL1xuZnVuY3Rpb24gZ2V0UGF0aEZyb21CYXNlKGhyZWYpIHtcbiAgcmV0dXJuIGJhc2VbMF0gPT0gJyMnXG4gICAgPyAoaHJlZiB8fCBsb2MuaHJlZiB8fCAnJykuc3BsaXQoYmFzZSlbMV0gfHwgJydcbiAgICA6IGdldFBhdGhGcm9tUm9vdChocmVmKVtSRVBMQUNFXShiYXNlLCAnJylcbn1cblxuZnVuY3Rpb24gZW1pdChmb3JjZSkge1xuICAvLyB0aGUgc3RhY2sgaXMgbmVlZGVkIGZvciByZWRpcmVjdGlvbnNcbiAgdmFyIGlzUm9vdCA9IGVtaXRTdGFja0xldmVsID09IDBcbiAgaWYgKE1BWF9FTUlUX1NUQUNLX0xFVkVMIDw9IGVtaXRTdGFja0xldmVsKSByZXR1cm5cblxuICBlbWl0U3RhY2tMZXZlbCsrXG4gIGVtaXRTdGFjay5wdXNoKGZ1bmN0aW9uKCkge1xuICAgIHZhciBwYXRoID0gZ2V0UGF0aEZyb21CYXNlKClcbiAgICBpZiAoZm9yY2UgfHwgcGF0aCAhPSBjdXJyZW50KSB7XG4gICAgICBjZW50cmFsW1RSSUdHRVJdKCdlbWl0JywgcGF0aClcbiAgICAgIGN1cnJlbnQgPSBwYXRoXG4gICAgfVxuICB9KVxuICBpZiAoaXNSb290KSB7XG4gICAgd2hpbGUgKGVtaXRTdGFjay5sZW5ndGgpIHtcbiAgICAgIGVtaXRTdGFja1swXSgpXG4gICAgICBlbWl0U3RhY2suc2hpZnQoKVxuICAgIH1cbiAgICBlbWl0U3RhY2tMZXZlbCA9IDBcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGljayhlKSB7XG4gIGlmIChcbiAgICBlLndoaWNoICE9IDEgLy8gbm90IGxlZnQgY2xpY2tcbiAgICB8fCBlLm1ldGFLZXkgfHwgZS5jdHJsS2V5IHx8IGUuc2hpZnRLZXkgLy8gb3IgbWV0YSBrZXlzXG4gICAgfHwgZS5kZWZhdWx0UHJldmVudGVkIC8vIG9yIGRlZmF1bHQgcHJldmVudGVkXG4gICkgcmV0dXJuXG5cbiAgdmFyIGVsID0gZS50YXJnZXRcbiAgd2hpbGUgKGVsICYmIGVsLm5vZGVOYW1lICE9ICdBJykgZWwgPSBlbC5wYXJlbnROb2RlXG4gIGlmIChcbiAgICAhZWwgfHwgZWwubm9kZU5hbWUgIT0gJ0EnIC8vIG5vdCBBIHRhZ1xuICAgIHx8IGVsW0hBU19BVFRSSUJVVEVdKCdkb3dubG9hZCcpIC8vIGhhcyBkb3dubG9hZCBhdHRyXG4gICAgfHwgIWVsW0hBU19BVFRSSUJVVEVdKCdocmVmJykgLy8gaGFzIG5vIGhyZWYgYXR0clxuICAgIHx8IGVsLnRhcmdldCAmJiBlbC50YXJnZXQgIT0gJ19zZWxmJyAvLyBhbm90aGVyIHdpbmRvdyBvciBmcmFtZVxuICAgIHx8IGVsLmhyZWYuaW5kZXhPZihsb2MuaHJlZi5tYXRjaChSRV9PUklHSU4pWzBdKSA9PSAtMSAvLyBjcm9zcyBvcmlnaW5cbiAgKSByZXR1cm5cblxuICBpZiAoZWwuaHJlZiAhPSBsb2MuaHJlZikge1xuICAgIGlmIChcbiAgICAgIGVsLmhyZWYuc3BsaXQoJyMnKVswXSA9PSBsb2MuaHJlZi5zcGxpdCgnIycpWzBdIC8vIGludGVybmFsIGp1bXBcbiAgICAgIHx8IGJhc2UgIT0gJyMnICYmIGdldFBhdGhGcm9tUm9vdChlbC5ocmVmKS5pbmRleE9mKGJhc2UpICE9PSAwIC8vIG91dHNpZGUgb2YgYmFzZVxuICAgICAgfHwgIWdvKGdldFBhdGhGcm9tQmFzZShlbC5ocmVmKSwgZWwudGl0bGUgfHwgZG9jLnRpdGxlKSAvLyByb3V0ZSBub3QgZm91bmRcbiAgICApIHJldHVyblxuICB9XG5cbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG59XG5cbi8qKlxuICogR28gdG8gdGhlIHBhdGhcbiAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gZGVzdGluYXRpb24gcGF0aFxuICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIC0gcGFnZSB0aXRsZVxuICogQHBhcmFtIHtib29sZWFufSBzaG91bGRSZXBsYWNlIC0gdXNlIHJlcGxhY2VTdGF0ZSBvciBwdXNoU3RhdGVcbiAqIEByZXR1cm5zIHtib29sZWFufSAtIHJvdXRlIG5vdCBmb3VuZCBmbGFnXG4gKi9cbmZ1bmN0aW9uIGdvKHBhdGgsIHRpdGxlLCBzaG91bGRSZXBsYWNlKSB7XG4gIGlmIChoaXN0KSB7IC8vIGlmIGEgYnJvd3NlclxuICAgIHBhdGggPSBiYXNlICsgbm9ybWFsaXplKHBhdGgpXG4gICAgdGl0bGUgPSB0aXRsZSB8fCBkb2MudGl0bGVcbiAgICAvLyBicm93c2VycyBpZ25vcmVzIHRoZSBzZWNvbmQgcGFyYW1ldGVyIGB0aXRsZWBcbiAgICBzaG91bGRSZXBsYWNlXG4gICAgICA/IGhpc3QucmVwbGFjZVN0YXRlKG51bGwsIHRpdGxlLCBwYXRoKVxuICAgICAgOiBoaXN0LnB1c2hTdGF0ZShudWxsLCB0aXRsZSwgcGF0aClcbiAgICAvLyBzbyB3ZSBuZWVkIHRvIHNldCBpdCBtYW51YWxseVxuICAgIGRvYy50aXRsZSA9IHRpdGxlXG4gICAgcm91dGVGb3VuZCA9IGZhbHNlXG4gICAgZW1pdCgpXG4gICAgcmV0dXJuIHJvdXRlRm91bmRcbiAgfVxuXG4gIC8vIFNlcnZlci1zaWRlIHVzYWdlOiBkaXJlY3RseSBleGVjdXRlIGhhbmRsZXJzIGZvciB0aGUgcGF0aFxuICByZXR1cm4gY2VudHJhbFtUUklHR0VSXSgnZW1pdCcsIGdldFBhdGhGcm9tQmFzZShwYXRoKSlcbn1cblxuLyoqXG4gKiBHbyB0byBwYXRoIG9yIHNldCBhY3Rpb25cbiAqIGEgc2luZ2xlIHN0cmluZzogICAgICAgICAgICAgICAgZ28gdGhlcmVcbiAqIHR3byBzdHJpbmdzOiAgICAgICAgICAgICAgICAgICAgZ28gdGhlcmUgd2l0aCBzZXR0aW5nIGEgdGl0bGVcbiAqIHR3byBzdHJpbmdzIGFuZCBib29sZWFuOiAgICAgICAgcmVwbGFjZSBoaXN0b3J5IHdpdGggc2V0dGluZyBhIHRpdGxlXG4gKiBhIHNpbmdsZSBmdW5jdGlvbjogICAgICAgICAgICAgIHNldCBhbiBhY3Rpb24gb24gdGhlIGRlZmF1bHQgcm91dGVcbiAqIGEgc3RyaW5nL1JlZ0V4cCBhbmQgYSBmdW5jdGlvbjogc2V0IGFuIGFjdGlvbiBvbiB0aGUgcm91dGVcbiAqIEBwYXJhbSB7KHN0cmluZ3xmdW5jdGlvbil9IGZpcnN0IC0gcGF0aCAvIGFjdGlvbiAvIGZpbHRlclxuICogQHBhcmFtIHsoc3RyaW5nfFJlZ0V4cHxmdW5jdGlvbil9IHNlY29uZCAtIHRpdGxlIC8gYWN0aW9uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHRoaXJkIC0gcmVwbGFjZSBmbGFnXG4gKi9cbnByb3QubSA9IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQsIHRoaXJkKSB7XG4gIGlmIChpc1N0cmluZyhmaXJzdCkgJiYgKCFzZWNvbmQgfHwgaXNTdHJpbmcoc2Vjb25kKSkpIGdvKGZpcnN0LCBzZWNvbmQsIHRoaXJkIHx8IGZhbHNlKVxuICBlbHNlIGlmIChzZWNvbmQpIHRoaXMucihmaXJzdCwgc2Vjb25kKVxuICBlbHNlIHRoaXMucignQCcsIGZpcnN0KVxufVxuXG4vKipcbiAqIFN0b3Agcm91dGluZ1xuICovXG5wcm90LnMgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5vZmYoJyonKVxuICB0aGlzLiQgPSBbXVxufVxuXG4vKipcbiAqIEVtaXRcbiAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gcGF0aFxuICovXG5wcm90LmUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHRoaXMuJC5jb25jYXQoJ0AnKS5zb21lKGZ1bmN0aW9uKGZpbHRlcikge1xuICAgIHZhciBhcmdzID0gKGZpbHRlciA9PSAnQCcgPyBwYXJzZXIgOiBzZWNvbmRQYXJzZXIpKG5vcm1hbGl6ZShwYXRoKSwgbm9ybWFsaXplKGZpbHRlcikpXG4gICAgaWYgKHR5cGVvZiBhcmdzICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzW1RSSUdHRVJdLmFwcGx5KG51bGwsIFtmaWx0ZXJdLmNvbmNhdChhcmdzKSlcbiAgICAgIHJldHVybiByb3V0ZUZvdW5kID0gdHJ1ZSAvLyBleGl0IGZyb20gbG9vcFxuICAgIH1cbiAgfSwgdGhpcylcbn1cblxuLyoqXG4gKiBSZWdpc3RlciByb3V0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGZpbHRlciAtIGZpbHRlciBmb3IgbWF0Y2hpbmcgdG8gdXJsXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBhY3Rpb24gLSBhY3Rpb24gdG8gcmVnaXN0ZXJcbiAqL1xucHJvdC5yID0gZnVuY3Rpb24oZmlsdGVyLCBhY3Rpb24pIHtcbiAgaWYgKGZpbHRlciAhPSAnQCcpIHtcbiAgICBmaWx0ZXIgPSAnLycgKyBub3JtYWxpemUoZmlsdGVyKVxuICAgIHRoaXMuJC5wdXNoKGZpbHRlcilcbiAgfVxuICB0aGlzLm9uKGZpbHRlciwgYWN0aW9uKVxufVxuXG52YXIgbWFpblJvdXRlciA9IG5ldyBSb3V0ZXIoKVxudmFyIHJvdXRlID0gbWFpblJvdXRlci5tLmJpbmQobWFpblJvdXRlcilcblxuLyoqXG4gKiBDcmVhdGUgYSBzdWIgcm91dGVyXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IHRoZSBtZXRob2Qgb2YgYSBuZXcgUm91dGVyIG9iamVjdFxuICovXG5yb3V0ZS5jcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5ld1N1YlJvdXRlciA9IG5ldyBSb3V0ZXIoKVxuICAvLyBzdG9wIG9ubHkgdGhpcyBzdWItcm91dGVyXG4gIG5ld1N1YlJvdXRlci5tLnN0b3AgPSBuZXdTdWJSb3V0ZXIucy5iaW5kKG5ld1N1YlJvdXRlcilcbiAgLy8gcmV0dXJuIHN1Yi1yb3V0ZXIncyBtYWluIG1ldGhvZFxuICByZXR1cm4gbmV3U3ViUm91dGVyLm0uYmluZChuZXdTdWJSb3V0ZXIpXG59XG5cbi8qKlxuICogU2V0IHRoZSBiYXNlIG9mIHVybFxuICogQHBhcmFtIHsoc3RyfFJlZ0V4cCl9IGFyZyAtIGEgbmV3IGJhc2Ugb3IgJyMnIG9yICcjISdcbiAqL1xucm91dGUuYmFzZSA9IGZ1bmN0aW9uKGFyZykge1xuICBiYXNlID0gYXJnIHx8ICcjJ1xuICBjdXJyZW50ID0gZ2V0UGF0aEZyb21CYXNlKCkgLy8gcmVjYWxjdWxhdGUgY3VycmVudCBwYXRoXG59XG5cbi8qKiBFeGVjIHJvdXRpbmcgcmlnaHQgbm93ICoqL1xucm91dGUuZXhlYyA9IGZ1bmN0aW9uKCkge1xuICBlbWl0KHRydWUpXG59XG5cbi8qKlxuICogUmVwbGFjZSB0aGUgZGVmYXVsdCByb3V0ZXIgdG8geW91cnNcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGZuIC0geW91ciBwYXJzZXIgZnVuY3Rpb25cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGZuMiAtIHlvdXIgc2Vjb25kUGFyc2VyIGZ1bmN0aW9uXG4gKi9cbnJvdXRlLnBhcnNlciA9IGZ1bmN0aW9uKGZuLCBmbjIpIHtcbiAgaWYgKCFmbiAmJiAhZm4yKSB7XG4gICAgLy8gcmVzZXQgcGFyc2VyIGZvciB0ZXN0aW5nLi4uXG4gICAgcGFyc2VyID0gREVGQVVMVF9QQVJTRVJcbiAgICBzZWNvbmRQYXJzZXIgPSBERUZBVUxUX1NFQ09ORF9QQVJTRVJcbiAgfVxuICBpZiAoZm4pIHBhcnNlciA9IGZuXG4gIGlmIChmbjIpIHNlY29uZFBhcnNlciA9IGZuMlxufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBnZXQgdXJsIHF1ZXJ5IGFzIGFuIG9iamVjdFxuICogQHJldHVybnMge29iamVjdH0gcGFyc2VkIHF1ZXJ5XG4gKi9cbnJvdXRlLnF1ZXJ5ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBxID0ge31cbiAgdmFyIGhyZWYgPSBsb2MuaHJlZiB8fCBjdXJyZW50XG4gIGhyZWZbUkVQTEFDRV0oL1s/Jl0oLis/KT0oW14mXSopL2csIGZ1bmN0aW9uKF8sIGssIHYpIHsgcVtrXSA9IHYgfSlcbiAgcmV0dXJuIHFcbn1cblxuLyoqIFN0b3Agcm91dGluZyAqKi9cbnJvdXRlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gIGlmIChzdGFydGVkKSB7XG4gICAgaWYgKHdpbikge1xuICAgICAgd2luW1JFTU9WRV9FVkVOVF9MSVNURU5FUl0oUE9QU1RBVEUsIGRlYm91bmNlZEVtaXQpXG4gICAgICB3aW5bUkVNT1ZFX0VWRU5UX0xJU1RFTkVSXShIQVNIQ0hBTkdFLCBkZWJvdW5jZWRFbWl0KVxuICAgICAgZG9jW1JFTU9WRV9FVkVOVF9MSVNURU5FUl0oY2xpY2tFdmVudCwgY2xpY2spXG4gICAgfVxuICAgIGNlbnRyYWxbVFJJR0dFUl0oJ3N0b3AnKVxuICAgIHN0YXJ0ZWQgPSBmYWxzZVxuICB9XG59XG5cbi8qKlxuICogU3RhcnQgcm91dGluZ1xuICogQHBhcmFtIHtib29sZWFufSBhdXRvRXhlYyAtIGF1dG9tYXRpY2FsbHkgZXhlYyBhZnRlciBzdGFydGluZyBpZiB0cnVlXG4gKi9cbnJvdXRlLnN0YXJ0ID0gZnVuY3Rpb24gKGF1dG9FeGVjKSB7XG4gIGlmICghc3RhcnRlZCkge1xuICAgIGlmICh3aW4pIHtcbiAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpIHN0YXJ0KGF1dG9FeGVjKVxuICAgICAgLy8gdGhlIHRpbWVvdXQgaXMgbmVlZGVkIHRvIHNvbHZlXG4gICAgICAvLyBhIHdlaXJkIHNhZmFyaSBidWcgaHR0cHM6Ly9naXRodWIuY29tL3Jpb3Qvcm91dGUvaXNzdWVzLzMzXG4gICAgICBlbHNlIHdpbltBRERfRVZFTlRfTElTVEVORVJdKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IHN0YXJ0KGF1dG9FeGVjKSB9LCAxKVxuICAgICAgfSlcbiAgICB9XG4gICAgc3RhcnRlZCA9IHRydWVcbiAgfVxufVxuXG4vKiogUHJlcGFyZSB0aGUgcm91dGVyICoqL1xucm91dGUuYmFzZSgpXG5yb3V0ZS5wYXJzZXIoKVxuXG5yaW90LnJvdXRlID0gcm91dGVcbn0pKHJpb3QpXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4vKipcbiAqIFRoZSByaW90IHRlbXBsYXRlIGVuZ2luZVxuICogQHZlcnNpb24gdjIuMy4yMFxuICovXG5cbi8qKlxuICogQG1vZHVsZSBicmFja2V0c1xuICpcbiAqIGBicmFja2V0cyAgICAgICAgIGAgUmV0dXJucyBhIHN0cmluZyBvciByZWdleCBiYXNlZCBvbiBpdHMgcGFyYW1ldGVyXG4gKiBgYnJhY2tldHMuc2V0dGluZ3NgIE1pcnJvcnMgdGhlIGByaW90LnNldHRpbmdzYCBvYmplY3QgKHVzZSBicmFja2V0cy5zZXQgaW4gbmV3IGNvZGUpXG4gKiBgYnJhY2tldHMuc2V0ICAgICBgIENoYW5nZSB0aGUgY3VycmVudCByaW90IGJyYWNrZXRzXG4gKi9cbi8qZ2xvYmFsIHJpb3QgKi9cblxudmFyIGJyYWNrZXRzID0gKGZ1bmN0aW9uIChVTkRFRikge1xuXG4gIHZhclxuICAgIFJFR0xPQiAgPSAnZycsXG5cbiAgICBNTENPTU1TID0gL1xcL1xcKlteKl0qXFwqKyg/OlteKlxcL11bXipdKlxcKispKlxcLy9nLFxuICAgIFNUUklOR1MgPSAvXCJbXlwiXFxcXF0qKD86XFxcXFtcXFNcXHNdW15cIlxcXFxdKikqXCJ8J1teJ1xcXFxdKig/OlxcXFxbXFxTXFxzXVteJ1xcXFxdKikqJy9nLFxuXG4gICAgU19RQlNSQyA9IFNUUklOR1Muc291cmNlICsgJ3wnICtcbiAgICAgIC8oPzpcXGJyZXR1cm5cXHMrfCg/OlskXFx3XFwpXFxdXXxcXCtcXCt8LS0pXFxzKihcXC8pKD8hWypcXC9dKSkvLnNvdXJjZSArICd8JyArXG4gICAgICAvXFwvKD89W14qXFwvXSlbXltcXC9cXFxcXSooPzooPzpcXFsoPzpcXFxcLnxbXlxcXVxcXFxdKikqXFxdfFxcXFwuKVteW1xcL1xcXFxdKikqPyhcXC8pW2dpbV0qLy5zb3VyY2UsXG5cbiAgICBERUZBVUxUID0gJ3sgfScsXG5cbiAgICBGSU5EQlJBQ0VTID0ge1xuICAgICAgJygnOiBSZWdFeHAoJyhbKCldKXwnICAgKyBTX1FCU1JDLCBSRUdMT0IpLFxuICAgICAgJ1snOiBSZWdFeHAoJyhbW1xcXFxdXSl8JyArIFNfUUJTUkMsIFJFR0xPQiksXG4gICAgICAneyc6IFJlZ0V4cCgnKFt7fV0pfCcgICArIFNfUUJTUkMsIFJFR0xPQilcbiAgICB9XG5cbiAgdmFyXG4gICAgY2FjaGVkQnJhY2tldHMgPSBVTkRFRixcbiAgICBfcmVnZXgsXG4gICAgX3BhaXJzID0gW11cblxuICBmdW5jdGlvbiBfbG9vcGJhY2sgKHJlKSB7IHJldHVybiByZSB9XG5cbiAgZnVuY3Rpb24gX3Jld3JpdGUgKHJlLCBicCkge1xuICAgIGlmICghYnApIGJwID0gX3BhaXJzXG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoXG4gICAgICByZS5zb3VyY2UucmVwbGFjZSgvey9nLCBicFsyXSkucmVwbGFjZSgvfS9nLCBicFszXSksIHJlLmdsb2JhbCA/IFJFR0xPQiA6ICcnXG4gICAgKVxuICB9XG5cbiAgZnVuY3Rpb24gX2NyZWF0ZSAocGFpcikge1xuICAgIHZhclxuICAgICAgY3Z0LFxuICAgICAgYXJyID0gcGFpci5zcGxpdCgnICcpXG5cbiAgICBpZiAocGFpciA9PT0gREVGQVVMVCkge1xuICAgICAgYXJyWzJdID0gYXJyWzBdXG4gICAgICBhcnJbM10gPSBhcnJbMV1cbiAgICAgIGN2dCA9IF9sb29wYmFja1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoICE9PSAyIHx8IC9bXFx4MDAtXFx4MUY8PmEtekEtWjAtOSdcIiw7XFxcXF0vLnRlc3QocGFpcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBicmFja2V0cyBcIicgKyBwYWlyICsgJ1wiJylcbiAgICAgIH1cbiAgICAgIGFyciA9IGFyci5jb25jYXQocGFpci5yZXBsYWNlKC8oPz1bW1xcXSgpKis/Ll4kfF0pL2csICdcXFxcJykuc3BsaXQoJyAnKSlcbiAgICAgIGN2dCA9IF9yZXdyaXRlXG4gICAgfVxuICAgIGFycls0XSA9IGN2dChhcnJbMV0ubGVuZ3RoID4gMSA/IC97W1xcU1xcc10qP30vIDogL3tbXn1dKn0vLCBhcnIpXG4gICAgYXJyWzVdID0gY3Z0KC9cXFxcKHt8fSkvZywgYXJyKVxuICAgIGFycls2XSA9IGN2dCgvKFxcXFw/KSh7KS9nLCBhcnIpXG4gICAgYXJyWzddID0gUmVnRXhwKCcoXFxcXFxcXFw/KSg/OihbWyh7XSl8KCcgKyBhcnJbM10gKyAnKSl8JyArIFNfUUJTUkMsIFJFR0xPQilcbiAgICBhcnJbOF0gPSBwYWlyXG4gICAgcmV0dXJuIGFyclxuICB9XG5cbiAgZnVuY3Rpb24gX3Jlc2V0IChwYWlyKSB7XG4gICAgaWYgKCFwYWlyKSBwYWlyID0gREVGQVVMVFxuXG4gICAgaWYgKHBhaXIgIT09IF9wYWlyc1s4XSkge1xuICAgICAgX3BhaXJzID0gX2NyZWF0ZShwYWlyKVxuICAgICAgX3JlZ2V4ID0gcGFpciA9PT0gREVGQVVMVCA/IF9sb29wYmFjayA6IF9yZXdyaXRlXG4gICAgICBfcGFpcnNbOV0gPSBfcmVnZXgoL15cXHMqe1xcXj9cXHMqKFskXFx3XSspKD86XFxzKixcXHMqKFxcUyspKT9cXHMraW5cXHMrKFxcUy4qKVxccyp9LylcbiAgICAgIF9wYWlyc1sxMF0gPSBfcmVnZXgoLyhefFteXFxcXF0pez1bXFxTXFxzXSo/fS8pXG4gICAgICBfYnJhY2tldHMuX3Jhd09mZnNldCA9IF9wYWlyc1swXS5sZW5ndGhcbiAgICB9XG4gICAgY2FjaGVkQnJhY2tldHMgPSBwYWlyXG4gIH1cblxuICBmdW5jdGlvbiBfYnJhY2tldHMgKHJlT3JJZHgpIHtcbiAgICByZXR1cm4gcmVPcklkeCBpbnN0YW5jZW9mIFJlZ0V4cCA/IF9yZWdleChyZU9ySWR4KSA6IF9wYWlyc1tyZU9ySWR4XVxuICB9XG5cbiAgX2JyYWNrZXRzLnNwbGl0ID0gZnVuY3Rpb24gc3BsaXQgKHN0ciwgdG1wbCwgX2JwKSB7XG4gICAgLy8gaXN0YW5idWwgaWdub3JlIG5leHQ6IF9icCBpcyBmb3IgdGhlIGNvbXBpbGVyXG4gICAgaWYgKCFfYnApIF9icCA9IF9wYWlyc1xuXG4gICAgdmFyXG4gICAgICBwYXJ0cyA9IFtdLFxuICAgICAgbWF0Y2gsXG4gICAgICBpc2V4cHIsXG4gICAgICBzdGFydCxcbiAgICAgIHBvcyxcbiAgICAgIHJlID0gX2JwWzZdXG5cbiAgICBpc2V4cHIgPSBzdGFydCA9IHJlLmxhc3RJbmRleCA9IDBcblxuICAgIHdoaWxlIChtYXRjaCA9IHJlLmV4ZWMoc3RyKSkge1xuXG4gICAgICBwb3MgPSBtYXRjaC5pbmRleFxuXG4gICAgICBpZiAoaXNleHByKSB7XG5cbiAgICAgICAgaWYgKG1hdGNoWzJdKSB7XG4gICAgICAgICAgcmUubGFzdEluZGV4ID0gc2tpcEJyYWNlcyhtYXRjaFsyXSwgcmUubGFzdEluZGV4KVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW1hdGNoWzNdKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghbWF0Y2hbMV0pIHtcbiAgICAgICAgdW5lc2NhcGVTdHIoc3RyLnNsaWNlKHN0YXJ0LCBwb3MpKVxuICAgICAgICBzdGFydCA9IHJlLmxhc3RJbmRleFxuICAgICAgICByZSA9IF9icFs2ICsgKGlzZXhwciBePSAxKV1cbiAgICAgICAgcmUubGFzdEluZGV4ID0gc3RhcnRcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RyICYmIHN0YXJ0IDwgc3RyLmxlbmd0aCkge1xuICAgICAgdW5lc2NhcGVTdHIoc3RyLnNsaWNlKHN0YXJ0KSlcbiAgICB9XG5cbiAgICByZXR1cm4gcGFydHNcblxuICAgIGZ1bmN0aW9uIHVuZXNjYXBlU3RyIChzdHIpIHtcbiAgICAgIGlmICh0bXBsIHx8IGlzZXhwcilcbiAgICAgICAgcGFydHMucHVzaChzdHIgJiYgc3RyLnJlcGxhY2UoX2JwWzVdLCAnJDEnKSlcbiAgICAgIGVsc2VcbiAgICAgICAgcGFydHMucHVzaChzdHIpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2tpcEJyYWNlcyAoY2gsIHBvcykge1xuICAgICAgdmFyXG4gICAgICAgIG1hdGNoLFxuICAgICAgICByZWNjaCA9IEZJTkRCUkFDRVNbY2hdLFxuICAgICAgICBsZXZlbCA9IDFcbiAgICAgIHJlY2NoLmxhc3RJbmRleCA9IHBvc1xuXG4gICAgICB3aGlsZSAobWF0Y2ggPSByZWNjaC5leGVjKHN0cikpIHtcbiAgICAgICAgaWYgKG1hdGNoWzFdICYmXG4gICAgICAgICAgIShtYXRjaFsxXSA9PT0gY2ggPyArK2xldmVsIDogLS1sZXZlbCkpIGJyZWFrXG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2ggPyByZWNjaC5sYXN0SW5kZXggOiBzdHIubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgX2JyYWNrZXRzLmhhc0V4cHIgPSBmdW5jdGlvbiBoYXNFeHByIChzdHIpIHtcbiAgICByZXR1cm4gX2JyYWNrZXRzKDQpLnRlc3Qoc3RyKVxuICB9XG5cbiAgX2JyYWNrZXRzLmxvb3BLZXlzID0gZnVuY3Rpb24gbG9vcEtleXMgKGV4cHIpIHtcbiAgICB2YXIgbSA9IGV4cHIubWF0Y2goX2JyYWNrZXRzKDkpKVxuICAgIHJldHVybiBtID9cbiAgICAgIHsga2V5OiBtWzFdLCBwb3M6IG1bMl0sIHZhbDogX3BhaXJzWzBdICsgbVszXS50cmltKCkgKyBfcGFpcnNbMV0gfSA6IHsgdmFsOiBleHByLnRyaW0oKSB9XG4gIH1cblxuICBfYnJhY2tldHMuYXJyYXkgPSBmdW5jdGlvbiBhcnJheSAocGFpcikge1xuICAgIHJldHVybiBfY3JlYXRlKHBhaXIgfHwgY2FjaGVkQnJhY2tldHMpXG4gIH1cblxuICB2YXIgX3NldHRpbmdzXG4gIGZ1bmN0aW9uIF9zZXRTZXR0aW5ncyAobykge1xuICAgIHZhciBiXG4gICAgbyA9IG8gfHwge31cbiAgICBiID0gby5icmFja2V0c1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCAnYnJhY2tldHMnLCB7XG4gICAgICBzZXQ6IF9yZXNldCxcbiAgICAgIGdldDogZnVuY3Rpb24gKCkgeyByZXR1cm4gY2FjaGVkQnJhY2tldHMgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KVxuICAgIF9zZXR0aW5ncyA9IG9cbiAgICBfcmVzZXQoYilcbiAgfVxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX2JyYWNrZXRzLCAnc2V0dGluZ3MnLCB7XG4gICAgc2V0OiBfc2V0U2V0dGluZ3MsXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBfc2V0dGluZ3MgfVxuICB9KVxuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0OiBpbiB0aGUgbm9kZSB2ZXJzaW9uIHJpb3QgaXMgbm90IGluIHRoZSBzY29wZSAqL1xuICBfYnJhY2tldHMuc2V0dGluZ3MgPSB0eXBlb2YgcmlvdCAhPT0gJ3VuZGVmaW5lZCcgJiYgcmlvdC5zZXR0aW5ncyB8fCB7fVxuICBfYnJhY2tldHMuc2V0ID0gX3Jlc2V0XG5cbiAgX2JyYWNrZXRzLlJfU1RSSU5HUyA9IFNUUklOR1NcbiAgX2JyYWNrZXRzLlJfTUxDT01NUyA9IE1MQ09NTVNcbiAgX2JyYWNrZXRzLlNfUUJMT0NLUyA9IFNfUUJTUkNcblxuICByZXR1cm4gX2JyYWNrZXRzXG5cbn0pKClcblxuLyoqXG4gKiBAbW9kdWxlIHRtcGxcbiAqXG4gKiB0bXBsICAgICAgICAgIC0gUm9vdCBmdW5jdGlvbiwgcmV0dXJucyB0aGUgdGVtcGxhdGUgdmFsdWUsIHJlbmRlciB3aXRoIGRhdGFcbiAqIHRtcGwuaGFzRXhwciAgLSBUZXN0IHRoZSBleGlzdGVuY2Ugb2YgYSBleHByZXNzaW9uIGluc2lkZSBhIHN0cmluZ1xuICogdG1wbC5sb29wS2V5cyAtIEdldCB0aGUga2V5cyBmb3IgYW4gJ2VhY2gnIGxvb3AgKHVzZWQgYnkgYF9lYWNoYClcbiAqL1xuLypnbG9iYWwgcmlvdCAqL1xuXG52YXIgdG1wbCA9IChmdW5jdGlvbiAoKSB7XG5cbiAgdmFyIF9jYWNoZSA9IHt9XG5cbiAgZnVuY3Rpb24gX3RtcGwgKHN0ciwgZGF0YSkge1xuICAgIGlmICghc3RyKSByZXR1cm4gc3RyXG5cbiAgICByZXR1cm4gKF9jYWNoZVtzdHJdIHx8IChfY2FjaGVbc3RyXSA9IF9jcmVhdGUoc3RyKSkpLmNhbGwoZGF0YSwgX2xvZ0VycilcbiAgfVxuXG4gIF90bXBsLmlzUmF3ID0gZnVuY3Rpb24gKGV4cHIpIHtcbiAgICByZXR1cm4gZXhwclticmFja2V0cy5fcmF3T2Zmc2V0XSA9PT0gJz0nXG4gIH1cblxuICBfdG1wbC5oYXZlUmF3ID0gZnVuY3Rpb24gKHNyYykge1xuICAgIHJldHVybiBicmFja2V0cygxMCkudGVzdChzcmMpXG4gIH1cblxuICBfdG1wbC5oYXNFeHByID0gYnJhY2tldHMuaGFzRXhwclxuXG4gIF90bXBsLmxvb3BLZXlzID0gYnJhY2tldHMubG9vcEtleXNcblxuICBfdG1wbC5lcnJvckhhbmRsZXIgPSBudWxsXG5cbiAgZnVuY3Rpb24gX2xvZ0VyciAoZXJyLCBjdHgpIHtcblxuICAgIGlmIChfdG1wbC5lcnJvckhhbmRsZXIpIHtcblxuICAgICAgZXJyLnJpb3REYXRhID0ge1xuICAgICAgICB0YWdOYW1lOiBjdHggJiYgY3R4LnJvb3QgJiYgY3R4LnJvb3QudGFnTmFtZSxcbiAgICAgICAgX3Jpb3RfaWQ6IGN0eCAmJiBjdHguX3Jpb3RfaWQgIC8vZXNsaW50LWRpc2FibGUtbGluZSBjYW1lbGNhc2VcbiAgICAgIH1cbiAgICAgIF90bXBsLmVycm9ySGFuZGxlcihlcnIpXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gX2NyZWF0ZSAoc3RyKSB7XG5cbiAgICB2YXIgZXhwciA9IF9nZXRUbXBsKHN0cilcbiAgICBpZiAoZXhwci5zbGljZSgwLCAxMSkgIT09ICd0cnl7cmV0dXJuICcpIGV4cHIgPSAncmV0dXJuICcgKyBleHByXG5cbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdFJywgZXhwciArICc7JylcbiAgfVxuXG4gIHZhclxuICAgIFJFX1FCTE9DSyA9IFJlZ0V4cChicmFja2V0cy5TX1FCTE9DS1MsICdnJyksXG4gICAgUkVfUUJNQVJLID0gL1xceDAxKFxcZCspfi9nXG5cbiAgZnVuY3Rpb24gX2dldFRtcGwgKHN0cikge1xuICAgIHZhclxuICAgICAgcXN0ciA9IFtdLFxuICAgICAgZXhwcixcbiAgICAgIHBhcnRzID0gYnJhY2tldHMuc3BsaXQoc3RyLnJlcGxhY2UoL1xcdTIwNTcvZywgJ1wiJyksIDEpXG5cbiAgICBpZiAocGFydHMubGVuZ3RoID4gMiB8fCBwYXJ0c1swXSkge1xuICAgICAgdmFyIGksIGosIGxpc3QgPSBbXVxuXG4gICAgICBmb3IgKGkgPSBqID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgZXhwciA9IHBhcnRzW2ldXG5cbiAgICAgICAgaWYgKGV4cHIgJiYgKGV4cHIgPSBpICYgMSA/XG5cbiAgICAgICAgICAgICAgX3BhcnNlRXhwcihleHByLCAxLCBxc3RyKSA6XG5cbiAgICAgICAgICAgICAgJ1wiJyArIGV4cHJcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXHJcXG4/fFxcbi9nLCAnXFxcXG4nKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgK1xuICAgICAgICAgICAgICAnXCInXG5cbiAgICAgICAgICApKSBsaXN0W2orK10gPSBleHByXG5cbiAgICAgIH1cblxuICAgICAgZXhwciA9IGogPCAyID8gbGlzdFswXSA6XG4gICAgICAgICAgICAgJ1snICsgbGlzdC5qb2luKCcsJykgKyAnXS5qb2luKFwiXCIpJ1xuICAgIH1cbiAgICBlbHNlIHtcblxuICAgICAgZXhwciA9IF9wYXJzZUV4cHIocGFydHNbMV0sIDAsIHFzdHIpXG4gICAgfVxuXG4gICAgaWYgKHFzdHJbMF0pXG4gICAgICBleHByID0gZXhwci5yZXBsYWNlKFJFX1FCTUFSSywgZnVuY3Rpb24gKF8sIHBvcykge1xuICAgICAgICByZXR1cm4gcXN0cltwb3NdXG4gICAgICAgICAgLnJlcGxhY2UoL1xcci9nLCAnXFxcXHInKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcbiAgICAgIH0pXG5cbiAgICByZXR1cm4gZXhwclxuICB9XG5cbiAgdmFyXG4gICAgQ1NfSURFTlQgPSAvXig/OigtP1tfQS1aYS16XFx4QTAtXFx4RkZdWy1cXHdcXHhBMC1cXHhGRl0qKXxcXHgwMShcXGQrKX4pOi9cblxuICBmdW5jdGlvbiBfcGFyc2VFeHByIChleHByLCBhc1RleHQsIHFzdHIpIHtcblxuICAgIGlmIChleHByWzBdID09PSAnPScpIGV4cHIgPSBleHByLnNsaWNlKDEpXG5cbiAgICBleHByID0gZXhwclxuICAgICAgICAgIC5yZXBsYWNlKFJFX1FCTE9DSywgZnVuY3Rpb24gKHMsIGRpdikge1xuICAgICAgICAgICAgcmV0dXJuIHMubGVuZ3RoID4gMiAmJiAhZGl2ID8gJ1xceDAxJyArIChxc3RyLnB1c2gocykgLSAxKSArICd+JyA6IHNcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcID8oW1tcXCh7fSw/XFwuOl0pXFwgPy9nLCAnJDEnKVxuXG4gICAgaWYgKGV4cHIpIHtcbiAgICAgIHZhclxuICAgICAgICBsaXN0ID0gW10sXG4gICAgICAgIGNudCA9IDAsXG4gICAgICAgIG1hdGNoXG5cbiAgICAgIHdoaWxlIChleHByICYmXG4gICAgICAgICAgICAobWF0Y2ggPSBleHByLm1hdGNoKENTX0lERU5UKSkgJiZcbiAgICAgICAgICAgICFtYXRjaC5pbmRleFxuICAgICAgICApIHtcbiAgICAgICAgdmFyXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIGpzYixcbiAgICAgICAgICByZSA9IC8sfChbW3soXSl8JC9nXG5cbiAgICAgICAgZXhwciA9IFJlZ0V4cC5yaWdodENvbnRleHRcbiAgICAgICAga2V5ICA9IG1hdGNoWzJdID8gcXN0clttYXRjaFsyXV0uc2xpY2UoMSwgLTEpLnRyaW0oKS5yZXBsYWNlKC9cXHMrL2csICcgJykgOiBtYXRjaFsxXVxuXG4gICAgICAgIHdoaWxlIChqc2IgPSAobWF0Y2ggPSByZS5leGVjKGV4cHIpKVsxXSkgc2tpcEJyYWNlcyhqc2IsIHJlKVxuXG4gICAgICAgIGpzYiAgPSBleHByLnNsaWNlKDAsIG1hdGNoLmluZGV4KVxuICAgICAgICBleHByID0gUmVnRXhwLnJpZ2h0Q29udGV4dFxuXG4gICAgICAgIGxpc3RbY250KytdID0gX3dyYXBFeHByKGpzYiwgMSwga2V5KVxuICAgICAgfVxuXG4gICAgICBleHByID0gIWNudCA/IF93cmFwRXhwcihleHByLCBhc1RleHQpIDpcbiAgICAgICAgICBjbnQgPiAxID8gJ1snICsgbGlzdC5qb2luKCcsJykgKyAnXS5qb2luKFwiIFwiKS50cmltKCknIDogbGlzdFswXVxuICAgIH1cbiAgICByZXR1cm4gZXhwclxuXG4gICAgZnVuY3Rpb24gc2tpcEJyYWNlcyAoanNiLCByZSkge1xuICAgICAgdmFyXG4gICAgICAgIG1hdGNoLFxuICAgICAgICBsdiA9IDEsXG4gICAgICAgIGlyID0ganNiID09PSAnKCcgPyAvWygpXS9nIDoganNiID09PSAnWycgPyAvW1tcXF1dL2cgOiAvW3t9XS9nXG5cbiAgICAgIGlyLmxhc3RJbmRleCA9IHJlLmxhc3RJbmRleFxuICAgICAgd2hpbGUgKG1hdGNoID0gaXIuZXhlYyhleHByKSkge1xuICAgICAgICBpZiAobWF0Y2hbMF0gPT09IGpzYikgKytsdlxuICAgICAgICBlbHNlIGlmICghLS1sdikgYnJlYWtcbiAgICAgIH1cbiAgICAgIHJlLmxhc3RJbmRleCA9IGx2ID8gZXhwci5sZW5ndGggOiBpci5sYXN0SW5kZXhcbiAgICB9XG4gIH1cblxuICAvLyBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogbm90IGJvdGhcbiAgdmFyXG4gICAgSlNfQ09OVEVYVCA9ICdcImluIHRoaXM/dGhpczonICsgKHR5cGVvZiB3aW5kb3cgIT09ICdvYmplY3QnID8gJ2dsb2JhbCcgOiAnd2luZG93JykgKyAnKS4nLFxuICAgIEpTX1ZBUk5BTUUgPSAvWyx7XVskXFx3XSs6fCheICp8W14kXFx3XFwuXSkoPyEoPzp0eXBlb2Z8dHJ1ZXxmYWxzZXxudWxsfHVuZGVmaW5lZHxpbnxpbnN0YW5jZW9mfGlzKD86RmluaXRlfE5hTil8dm9pZHxOYU58bmV3fERhdGV8UmVnRXhwfE1hdGgpKD8hWyRcXHddKSkoWyRfQS1aYS16XVskXFx3XSopL2csXG4gICAgSlNfTk9QUk9QUyA9IC9eKD89KFxcLlskXFx3XSspKVxcMSg/OlteLlsoXXwkKS9cblxuICBmdW5jdGlvbiBfd3JhcEV4cHIgKGV4cHIsIGFzVGV4dCwga2V5KSB7XG4gICAgdmFyIHRiXG5cbiAgICBleHByID0gZXhwci5yZXBsYWNlKEpTX1ZBUk5BTUUsIGZ1bmN0aW9uIChtYXRjaCwgcCwgbXZhciwgcG9zLCBzKSB7XG4gICAgICBpZiAobXZhcikge1xuICAgICAgICBwb3MgPSB0YiA/IDAgOiBwb3MgKyBtYXRjaC5sZW5ndGhcblxuICAgICAgICBpZiAobXZhciAhPT0gJ3RoaXMnICYmIG12YXIgIT09ICdnbG9iYWwnICYmIG12YXIgIT09ICd3aW5kb3cnKSB7XG4gICAgICAgICAgbWF0Y2ggPSBwICsgJyhcIicgKyBtdmFyICsgSlNfQ09OVEVYVCArIG12YXJcbiAgICAgICAgICBpZiAocG9zKSB0YiA9IChzID0gc1twb3NdKSA9PT0gJy4nIHx8IHMgPT09ICcoJyB8fCBzID09PSAnWydcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChwb3MpIHtcbiAgICAgICAgICB0YiA9ICFKU19OT1BST1BTLnRlc3Qocy5zbGljZShwb3MpKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbWF0Y2hcbiAgICB9KVxuXG4gICAgaWYgKHRiKSB7XG4gICAgICBleHByID0gJ3RyeXtyZXR1cm4gJyArIGV4cHIgKyAnfWNhdGNoKGUpe0UoZSx0aGlzKX0nXG4gICAgfVxuXG4gICAgaWYgKGtleSkge1xuXG4gICAgICBleHByID0gKHRiID9cbiAgICAgICAgICAnZnVuY3Rpb24oKXsnICsgZXhwciArICd9LmNhbGwodGhpcyknIDogJygnICsgZXhwciArICcpJ1xuICAgICAgICApICsgJz9cIicgKyBrZXkgKyAnXCI6XCJcIidcbiAgICB9XG4gICAgZWxzZSBpZiAoYXNUZXh0KSB7XG5cbiAgICAgIGV4cHIgPSAnZnVuY3Rpb24odil7JyArICh0YiA/XG4gICAgICAgICAgZXhwci5yZXBsYWNlKCdyZXR1cm4gJywgJ3Y9JykgOiAndj0oJyArIGV4cHIgKyAnKSdcbiAgICAgICAgKSArICc7cmV0dXJuIHZ8fHY9PT0wP3Y6XCJcIn0uY2FsbCh0aGlzKSdcbiAgICB9XG5cbiAgICByZXR1cm4gZXhwclxuICB9XG5cbiAgLy8gaXN0YW5idWwgaWdub3JlIG5leHQ6IGNvbXBhdGliaWxpdHkgZml4IGZvciBiZXRhIHZlcnNpb25zXG4gIF90bXBsLnBhcnNlID0gZnVuY3Rpb24gKHMpIHsgcmV0dXJuIHMgfVxuXG4gIHJldHVybiBfdG1wbFxuXG59KSgpXG5cbiAgdG1wbC52ZXJzaW9uID0gYnJhY2tldHMudmVyc2lvbiA9ICd2Mi4zLjIwJ1xuXG5cbi8qXG4gIGxpYi9icm93c2VyL3RhZy9ta2RvbS5qc1xuXG4gIEluY2x1ZGVzIGhhY2tzIG5lZWRlZCBmb3IgdGhlIEludGVybmV0IEV4cGxvcmVyIHZlcnNpb24gOSBhbmQgYmVsb3dcblxuKi9cbi8vIGh0dHA6Ly9rYW5nYXguZ2l0aHViLmlvL2NvbXBhdC10YWJsZS9lczUvI2llOFxuLy8gaHR0cDovL2NvZGVwbGFuZXQuaW8vZHJvcHBpbmctaWU4L1xuXG52YXIgbWtkb20gPSAoZnVuY3Rpb24gKGNoZWNrSUUpIHtcblxuICB2YXIgcm9vdEVscyA9IHtcbiAgICAgIHRyOiAndGJvZHknLFxuICAgICAgdGg6ICd0cicsXG4gICAgICB0ZDogJ3RyJyxcbiAgICAgIHRib2R5OiAndGFibGUnLFxuICAgICAgY29sOiAnY29sZ3JvdXAnXG4gICAgfSxcbiAgICByZVRvU3JjID0gLzx5aWVsZFxccyt0bz0oWydcIl0pP0BcXDFcXHMqPihbXFxTXFxzXSs/KTxcXC95aWVsZFxccyo+Ly5zb3VyY2UsXG4gICAgR0VORVJJQyA9ICdkaXYnXG5cbiAgY2hlY2tJRSA9IGNoZWNrSUUgJiYgY2hlY2tJRSA8IDEwXG5cbiAgLy8gY3JlYXRlcyBhbnkgZG9tIGVsZW1lbnQgaW4gYSBkaXYsIHRhYmxlLCBvciBjb2xncm91cCBjb250YWluZXJcbiAgZnVuY3Rpb24gX21rZG9tKHRlbXBsLCBodG1sKSB7XG5cbiAgICB2YXIgbWF0Y2ggPSB0ZW1wbCAmJiB0ZW1wbC5tYXRjaCgvXlxccyo8KFstXFx3XSspLyksXG4gICAgICB0YWdOYW1lID0gbWF0Y2ggJiYgbWF0Y2hbMV0udG9Mb3dlckNhc2UoKSxcbiAgICAgIHJvb3RUYWcgPSByb290RWxzW3RhZ05hbWVdIHx8IEdFTkVSSUMsXG4gICAgICBlbCA9IG1rRWwocm9vdFRhZylcblxuICAgIGVsLnN0dWIgPSB0cnVlXG5cbiAgICAvLyByZXBsYWNlIGFsbCB0aGUgeWllbGQgdGFncyB3aXRoIHRoZSB0YWcgaW5uZXIgaHRtbFxuICAgIGlmIChodG1sKSB0ZW1wbCA9IHJlcGxhY2VZaWVsZCh0ZW1wbCwgaHRtbClcblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgaWYgKGNoZWNrSUUgJiYgdGFnTmFtZSAmJiAobWF0Y2ggPSB0YWdOYW1lLm1hdGNoKFNQRUNJQUxfVEFHU19SRUdFWCkpKVxuICAgICAgaWU5ZWxlbShlbCwgdGVtcGwsIHRhZ05hbWUsICEhbWF0Y2hbMV0pXG4gICAgZWxzZVxuICAgICAgZWwuaW5uZXJIVE1MID0gdGVtcGxcblxuICAgIHJldHVybiBlbFxuICB9XG5cbiAgLy8gY3JlYXRlcyB0ciwgdGgsIHRkLCBvcHRpb24sIG9wdGdyb3VwIGVsZW1lbnQgZm9yIElFOC05XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIGZ1bmN0aW9uIGllOWVsZW0oZWwsIGh0bWwsIHRhZ05hbWUsIHNlbGVjdCkge1xuXG4gICAgdmFyIGRpdiA9IG1rRWwoR0VORVJJQyksXG4gICAgICB0YWcgPSBzZWxlY3QgPyAnc2VsZWN0PicgOiAndGFibGU+JyxcbiAgICAgIGNoaWxkXG5cbiAgICBkaXYuaW5uZXJIVE1MID0gJzwnICsgdGFnICsgaHRtbCArICc8LycgKyB0YWdcblxuICAgIGNoaWxkID0gJCh0YWdOYW1lLCBkaXYpXG4gICAgaWYgKGNoaWxkKVxuICAgICAgZWwuYXBwZW5kQ2hpbGQoY2hpbGQpXG5cbiAgfVxuICAvLyBlbmQgaWU5ZWxlbSgpXG5cbiAgLyoqXG4gICAqIFJlcGxhY2UgdGhlIHlpZWxkIHRhZyBmcm9tIGFueSB0YWcgdGVtcGxhdGUgd2l0aCB0aGUgaW5uZXJIVE1MIG9mIHRoZVxuICAgKiBvcmlnaW5hbCB0YWcgaW4gdGhlIHBhZ2VcbiAgICogQHBhcmFtICAgeyBTdHJpbmcgfSB0ZW1wbCAtIHRhZyBpbXBsZW1lbnRhdGlvbiB0ZW1wbGF0ZVxuICAgKiBAcGFyYW0gICB7IFN0cmluZyB9IGh0bWwgIC0gb3JpZ2luYWwgY29udGVudCBvZiB0aGUgdGFnIGluIHRoZSBET01cbiAgICogQHJldHVybnMgeyBTdHJpbmcgfSB0YWcgdGVtcGxhdGUgdXBkYXRlZCB3aXRob3V0IHRoZSB5aWVsZCB0YWdcbiAgICovXG4gIGZ1bmN0aW9uIHJlcGxhY2VZaWVsZCh0ZW1wbCwgaHRtbCkge1xuICAgIC8vIGRvIG5vdGhpbmcgaWYgbm8geWllbGRcbiAgICBpZiAoIS88eWllbGRcXGIvaS50ZXN0KHRlbXBsKSkgcmV0dXJuIHRlbXBsXG5cbiAgICAvLyBiZSBjYXJlZnVsIHdpdGggIzEzNDMgLSBzdHJpbmcgb24gdGhlIHNvdXJjZSBoYXZpbmcgYCQxYFxuICAgIHZhciBuID0gMFxuICAgIHRlbXBsID0gdGVtcGwucmVwbGFjZSgvPHlpZWxkXFxzK2Zyb209WydcIl0oWy1cXHddKylbJ1wiXVxccyooPzpcXC8+fD5cXHMqPFxcL3lpZWxkXFxzKj4pL2lnLFxuICAgICAgZnVuY3Rpb24gKHN0ciwgcmVmKSB7XG4gICAgICAgIHZhciBtID0gaHRtbC5tYXRjaChSZWdFeHAocmVUb1NyYy5yZXBsYWNlKCdAJywgcmVmKSwgJ2knKSlcbiAgICAgICAgKytuXG4gICAgICAgIHJldHVybiBtICYmIG1bMl0gfHwgJydcbiAgICAgIH0pXG5cbiAgICAvLyB5aWVsZCB3aXRob3V0IGFueSBcImZyb21cIiwgcmVwbGFjZSB5aWVsZCBpbiB0ZW1wbCB3aXRoIHRoZSBpbm5lckhUTUxcbiAgICByZXR1cm4gbiA/IHRlbXBsIDogdGVtcGwucmVwbGFjZSgvPHlpZWxkXFxzKig/OlxcLz58Plxccyo8XFwveWllbGRcXHMqPikvZ2ksIGh0bWwgfHwgJycpXG4gIH1cblxuICByZXR1cm4gX21rZG9tXG5cbn0pKElFX1ZFUlNJT04pXG5cbi8qKlxuICogQ29udmVydCB0aGUgaXRlbSBsb29wZWQgaW50byBhbiBvYmplY3QgdXNlZCB0byBleHRlbmQgdGhlIGNoaWxkIHRhZyBwcm9wZXJ0aWVzXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IGV4cHIgLSBvYmplY3QgY29udGFpbmluZyB0aGUga2V5cyB1c2VkIHRvIGV4dGVuZCB0aGUgY2hpbGRyZW4gdGFnc1xuICogQHBhcmFtICAgeyAqIH0ga2V5IC0gdmFsdWUgdG8gYXNzaWduIHRvIHRoZSBuZXcgb2JqZWN0IHJldHVybmVkXG4gKiBAcGFyYW0gICB7ICogfSB2YWwgLSB2YWx1ZSBjb250YWluaW5nIHRoZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSBpbiB0aGUgYXJyYXlcbiAqIEByZXR1cm5zIHsgT2JqZWN0IH0gLSBuZXcgb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHZhbHVlcyBvZiB0aGUgb3JpZ2luYWwgaXRlbVxuICpcbiAqIFRoZSB2YXJpYWJsZXMgJ2tleScgYW5kICd2YWwnIGFyZSBhcmJpdHJhcnkuXG4gKiBUaGV5IGRlcGVuZCBvbiB0aGUgY29sbGVjdGlvbiB0eXBlIGxvb3BlZCAoQXJyYXksIE9iamVjdClcbiAqIGFuZCBvbiB0aGUgZXhwcmVzc2lvbiB1c2VkIG9uIHRoZSBlYWNoIHRhZ1xuICpcbiAqL1xuZnVuY3Rpb24gbWtpdGVtKGV4cHIsIGtleSwgdmFsKSB7XG4gIHZhciBpdGVtID0ge31cbiAgaXRlbVtleHByLmtleV0gPSBrZXlcbiAgaWYgKGV4cHIucG9zKSBpdGVtW2V4cHIucG9zXSA9IHZhbFxuICByZXR1cm4gaXRlbVxufVxuXG4vKipcbiAqIFVubW91bnQgdGhlIHJlZHVuZGFudCB0YWdzXG4gKiBAcGFyYW0gICB7IEFycmF5IH0gaXRlbXMgLSBhcnJheSBjb250YWluaW5nIHRoZSBjdXJyZW50IGl0ZW1zIHRvIGxvb3BcbiAqIEBwYXJhbSAgIHsgQXJyYXkgfSB0YWdzIC0gYXJyYXkgY29udGFpbmluZyBhbGwgdGhlIGNoaWxkcmVuIHRhZ3NcbiAqL1xuZnVuY3Rpb24gdW5tb3VudFJlZHVuZGFudChpdGVtcywgdGFncykge1xuXG4gIHZhciBpID0gdGFncy5sZW5ndGgsXG4gICAgaiA9IGl0ZW1zLmxlbmd0aCxcbiAgICB0XG5cbiAgd2hpbGUgKGkgPiBqKSB7XG4gICAgdCA9IHRhZ3NbLS1pXVxuICAgIHRhZ3Muc3BsaWNlKGksIDEpXG4gICAgdC51bm1vdW50KClcbiAgfVxufVxuXG4vKipcbiAqIE1vdmUgdGhlIG5lc3RlZCBjdXN0b20gdGFncyBpbiBub24gY3VzdG9tIGxvb3AgdGFnc1xuICogQHBhcmFtICAgeyBPYmplY3QgfSBjaGlsZCAtIG5vbiBjdXN0b20gbG9vcCB0YWdcbiAqIEBwYXJhbSAgIHsgTnVtYmVyIH0gaSAtIGN1cnJlbnQgcG9zaXRpb24gb2YgdGhlIGxvb3AgdGFnXG4gKi9cbmZ1bmN0aW9uIG1vdmVOZXN0ZWRUYWdzKGNoaWxkLCBpKSB7XG4gIE9iamVjdC5rZXlzKGNoaWxkLnRhZ3MpLmZvckVhY2goZnVuY3Rpb24odGFnTmFtZSkge1xuICAgIHZhciB0YWcgPSBjaGlsZC50YWdzW3RhZ05hbWVdXG4gICAgaWYgKGlzQXJyYXkodGFnKSlcbiAgICAgIGVhY2godGFnLCBmdW5jdGlvbiAodCkge1xuICAgICAgICBtb3ZlQ2hpbGRUYWcodCwgdGFnTmFtZSwgaSlcbiAgICAgIH0pXG4gICAgZWxzZVxuICAgICAgbW92ZUNoaWxkVGFnKHRhZywgdGFnTmFtZSwgaSlcbiAgfSlcbn1cblxuLyoqXG4gKiBBZGRzIHRoZSBlbGVtZW50cyBmb3IgYSB2aXJ0dWFsIHRhZ1xuICogQHBhcmFtIHsgVGFnIH0gdGFnIC0gdGhlIHRhZyB3aG9zZSByb290J3MgY2hpbGRyZW4gd2lsbCBiZSBpbnNlcnRlZCBvciBhcHBlbmRlZFxuICogQHBhcmFtIHsgTm9kZSB9IHNyYyAtIHRoZSBub2RlIHRoYXQgd2lsbCBkbyB0aGUgaW5zZXJ0aW5nIG9yIGFwcGVuZGluZ1xuICogQHBhcmFtIHsgVGFnIH0gdGFyZ2V0IC0gb25seSBpZiBpbnNlcnRpbmcsIGluc2VydCBiZWZvcmUgdGhpcyB0YWcncyBmaXJzdCBjaGlsZFxuICovXG5mdW5jdGlvbiBhZGRWaXJ0dWFsKHRhZywgc3JjLCB0YXJnZXQpIHtcbiAgdmFyIGVsID0gdGFnLl9yb290LCBzaWJcbiAgdGFnLl92aXJ0cyA9IFtdXG4gIHdoaWxlIChlbCkge1xuICAgIHNpYiA9IGVsLm5leHRTaWJsaW5nXG4gICAgaWYgKHRhcmdldClcbiAgICAgIHNyYy5pbnNlcnRCZWZvcmUoZWwsIHRhcmdldC5fcm9vdClcbiAgICBlbHNlXG4gICAgICBzcmMuYXBwZW5kQ2hpbGQoZWwpXG5cbiAgICB0YWcuX3ZpcnRzLnB1c2goZWwpIC8vIGhvbGQgZm9yIHVubW91bnRpbmdcbiAgICBlbCA9IHNpYlxuICB9XG59XG5cbi8qKlxuICogTW92ZSB2aXJ0dWFsIHRhZyBhbmQgYWxsIGNoaWxkIG5vZGVzXG4gKiBAcGFyYW0geyBUYWcgfSB0YWcgLSBmaXJzdCBjaGlsZCByZWZlcmVuY2UgdXNlZCB0byBzdGFydCBtb3ZlXG4gKiBAcGFyYW0geyBOb2RlIH0gc3JjICAtIHRoZSBub2RlIHRoYXQgd2lsbCBkbyB0aGUgaW5zZXJ0aW5nXG4gKiBAcGFyYW0geyBUYWcgfSB0YXJnZXQgLSBpbnNlcnQgYmVmb3JlIHRoaXMgdGFnJ3MgZmlyc3QgY2hpbGRcbiAqIEBwYXJhbSB7IE51bWJlciB9IGxlbiAtIGhvdyBtYW55IGNoaWxkIG5vZGVzIHRvIG1vdmVcbiAqL1xuZnVuY3Rpb24gbW92ZVZpcnR1YWwodGFnLCBzcmMsIHRhcmdldCwgbGVuKSB7XG4gIHZhciBlbCA9IHRhZy5fcm9vdCwgc2liLCBpID0gMFxuICBmb3IgKDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgc2liID0gZWwubmV4dFNpYmxpbmdcbiAgICBzcmMuaW5zZXJ0QmVmb3JlKGVsLCB0YXJnZXQuX3Jvb3QpXG4gICAgZWwgPSBzaWJcbiAgfVxufVxuXG5cbi8qKlxuICogTWFuYWdlIHRhZ3MgaGF2aW5nIHRoZSAnZWFjaCdcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2UgbmVlZCB0byBsb29wXG4gKiBAcGFyYW0gICB7IFRhZyB9IHBhcmVudCAtIHBhcmVudCB0YWcgaW5zdGFuY2Ugd2hlcmUgdGhlIGRvbSBub2RlIGlzIGNvbnRhaW5lZFxuICogQHBhcmFtICAgeyBTdHJpbmcgfSBleHByIC0gc3RyaW5nIGNvbnRhaW5lZCBpbiB0aGUgJ2VhY2gnIGF0dHJpYnV0ZVxuICovXG5mdW5jdGlvbiBfZWFjaChkb20sIHBhcmVudCwgZXhwcikge1xuXG4gIC8vIHJlbW92ZSB0aGUgZWFjaCBwcm9wZXJ0eSBmcm9tIHRoZSBvcmlnaW5hbCB0YWdcbiAgcmVtQXR0cihkb20sICdlYWNoJylcblxuICB2YXIgbXVzdFJlb3JkZXIgPSB0eXBlb2YgZ2V0QXR0cihkb20sICduby1yZW9yZGVyJykgIT09IFRfU1RSSU5HIHx8IHJlbUF0dHIoZG9tLCAnbm8tcmVvcmRlcicpLFxuICAgIHRhZ05hbWUgPSBnZXRUYWdOYW1lKGRvbSksXG4gICAgaW1wbCA9IF9fdGFnSW1wbFt0YWdOYW1lXSB8fCB7IHRtcGw6IGRvbS5vdXRlckhUTUwgfSxcbiAgICB1c2VSb290ID0gU1BFQ0lBTF9UQUdTX1JFR0VYLnRlc3QodGFnTmFtZSksXG4gICAgcm9vdCA9IGRvbS5wYXJlbnROb2RlLFxuICAgIHJlZiA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKSxcbiAgICBjaGlsZCA9IGdldFRhZyhkb20pLFxuICAgIGlzT3B0aW9uID0gL29wdGlvbi9naS50ZXN0KHRhZ05hbWUpLCAvLyB0aGUgb3B0aW9uIHRhZ3MgbXVzdCBiZSB0cmVhdGVkIGRpZmZlcmVudGx5XG4gICAgdGFncyA9IFtdLFxuICAgIG9sZEl0ZW1zID0gW10sXG4gICAgaGFzS2V5cyxcbiAgICBpc1ZpcnR1YWwgPSBkb20udGFnTmFtZSA9PSAnVklSVFVBTCdcblxuICAvLyBwYXJzZSB0aGUgZWFjaCBleHByZXNzaW9uXG4gIGV4cHIgPSB0bXBsLmxvb3BLZXlzKGV4cHIpXG5cbiAgLy8gaW5zZXJ0IGEgbWFya2VkIHdoZXJlIHRoZSBsb29wIHRhZ3Mgd2lsbCBiZSBpbmplY3RlZFxuICByb290Lmluc2VydEJlZm9yZShyZWYsIGRvbSlcblxuICAvLyBjbGVhbiB0ZW1wbGF0ZSBjb2RlXG4gIHBhcmVudC5vbmUoJ2JlZm9yZS1tb3VudCcsIGZ1bmN0aW9uICgpIHtcblxuICAgIC8vIHJlbW92ZSB0aGUgb3JpZ2luYWwgRE9NIG5vZGVcbiAgICBkb20ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb20pXG4gICAgaWYgKHJvb3Quc3R1Yikgcm9vdCA9IHBhcmVudC5yb290XG5cbiAgfSkub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAvLyBnZXQgdGhlIG5ldyBpdGVtcyBjb2xsZWN0aW9uXG4gICAgdmFyIGl0ZW1zID0gdG1wbChleHByLnZhbCwgcGFyZW50KSxcbiAgICAgIC8vIGNyZWF0ZSBhIGZyYWdtZW50IHRvIGhvbGQgdGhlIG5ldyBET00gbm9kZXMgdG8gaW5qZWN0IGluIHRoZSBwYXJlbnQgdGFnXG4gICAgICBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG5cblxuXG4gICAgLy8gb2JqZWN0IGxvb3AuIGFueSBjaGFuZ2VzIGNhdXNlIGZ1bGwgcmVkcmF3XG4gICAgaWYgKCFpc0FycmF5KGl0ZW1zKSkge1xuICAgICAgaGFzS2V5cyA9IGl0ZW1zIHx8IGZhbHNlXG4gICAgICBpdGVtcyA9IGhhc0tleXMgP1xuICAgICAgICBPYmplY3Qua2V5cyhpdGVtcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm4gbWtpdGVtKGV4cHIsIGtleSwgaXRlbXNba2V5XSlcbiAgICAgICAgfSkgOiBbXVxuICAgIH1cblxuICAgIC8vIGxvb3AgYWxsIHRoZSBuZXcgaXRlbXNcbiAgICBpdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGkpIHtcbiAgICAgIC8vIHJlb3JkZXIgb25seSBpZiB0aGUgaXRlbXMgYXJlIG9iamVjdHNcbiAgICAgIHZhciBfbXVzdFJlb3JkZXIgPSBtdXN0UmVvcmRlciAmJiBpdGVtIGluc3RhbmNlb2YgT2JqZWN0LFxuICAgICAgICBvbGRQb3MgPSBvbGRJdGVtcy5pbmRleE9mKGl0ZW0pLFxuICAgICAgICBwb3MgPSB+b2xkUG9zICYmIF9tdXN0UmVvcmRlciA/IG9sZFBvcyA6IGksXG4gICAgICAgIC8vIGRvZXMgYSB0YWcgZXhpc3QgaW4gdGhpcyBwb3NpdGlvbj9cbiAgICAgICAgdGFnID0gdGFnc1twb3NdXG5cbiAgICAgIGl0ZW0gPSAhaGFzS2V5cyAmJiBleHByLmtleSA/IG1raXRlbShleHByLCBpdGVtLCBpKSA6IGl0ZW1cblxuICAgICAgLy8gbmV3IHRhZ1xuICAgICAgaWYgKFxuICAgICAgICAhX211c3RSZW9yZGVyICYmICF0YWcgLy8gd2l0aCBuby1yZW9yZGVyIHdlIGp1c3QgdXBkYXRlIHRoZSBvbGQgdGFnc1xuICAgICAgICB8fFxuICAgICAgICBfbXVzdFJlb3JkZXIgJiYgIX5vbGRQb3MgfHwgIXRhZyAvLyBieSBkZWZhdWx0IHdlIGFsd2F5cyB0cnkgdG8gcmVvcmRlciB0aGUgRE9NIGVsZW1lbnRzXG4gICAgICApIHtcblxuICAgICAgICB0YWcgPSBuZXcgVGFnKGltcGwsIHtcbiAgICAgICAgICBwYXJlbnQ6IHBhcmVudCxcbiAgICAgICAgICBpc0xvb3A6IHRydWUsXG4gICAgICAgICAgaGFzSW1wbDogISFfX3RhZ0ltcGxbdGFnTmFtZV0sXG4gICAgICAgICAgcm9vdDogdXNlUm9vdCA/IHJvb3QgOiBkb20uY2xvbmVOb2RlKCksXG4gICAgICAgICAgaXRlbTogaXRlbVxuICAgICAgICB9LCBkb20uaW5uZXJIVE1MKVxuXG4gICAgICAgIHRhZy5tb3VudCgpXG4gICAgICAgIGlmIChpc1ZpcnR1YWwpIHRhZy5fcm9vdCA9IHRhZy5yb290LmZpcnN0Q2hpbGQgLy8gc2F2ZSByZWZlcmVuY2UgZm9yIGZ1cnRoZXIgbW92ZXMgb3IgaW5zZXJ0c1xuICAgICAgICAvLyB0aGlzIHRhZyBtdXN0IGJlIGFwcGVuZGVkXG4gICAgICAgIGlmIChpID09IHRhZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKGlzVmlydHVhbClcbiAgICAgICAgICAgIGFkZFZpcnR1YWwodGFnLCBmcmFnKVxuICAgICAgICAgIGVsc2UgZnJhZy5hcHBlbmRDaGlsZCh0YWcucm9vdClcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIHRhZyBtdXN0IGJlIGluc2VydFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoaXNWaXJ0dWFsKVxuICAgICAgICAgICAgYWRkVmlydHVhbCh0YWcsIHJvb3QsIHRhZ3NbaV0pXG4gICAgICAgICAgZWxzZSByb290Lmluc2VydEJlZm9yZSh0YWcucm9vdCwgdGFnc1tpXS5yb290KVxuICAgICAgICAgIG9sZEl0ZW1zLnNwbGljZShpLCAwLCBpdGVtKVxuICAgICAgICB9XG5cbiAgICAgICAgdGFncy5zcGxpY2UoaSwgMCwgdGFnKVxuICAgICAgICBwb3MgPSBpIC8vIGhhbmRsZWQgaGVyZSBzbyBubyBtb3ZlXG4gICAgICB9IGVsc2UgdGFnLnVwZGF0ZShpdGVtKVxuXG4gICAgICAvLyByZW9yZGVyIHRoZSB0YWcgaWYgaXQncyBub3QgbG9jYXRlZCBpbiBpdHMgcHJldmlvdXMgcG9zaXRpb25cbiAgICAgIGlmIChwb3MgIT09IGkgJiYgX211c3RSZW9yZGVyKSB7XG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgRE9NXG4gICAgICAgIGlmIChpc1ZpcnR1YWwpXG4gICAgICAgICAgbW92ZVZpcnR1YWwodGFnLCByb290LCB0YWdzW2ldLCBkb20uY2hpbGROb2Rlcy5sZW5ndGgpXG4gICAgICAgIGVsc2Ugcm9vdC5pbnNlcnRCZWZvcmUodGFnLnJvb3QsIHRhZ3NbaV0ucm9vdClcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBwb3NpdGlvbiBhdHRyaWJ1dGUgaWYgaXQgZXhpc3RzXG4gICAgICAgIGlmIChleHByLnBvcylcbiAgICAgICAgICB0YWdbZXhwci5wb3NdID0gaVxuICAgICAgICAvLyBtb3ZlIHRoZSBvbGQgdGFnIGluc3RhbmNlXG4gICAgICAgIHRhZ3Muc3BsaWNlKGksIDAsIHRhZ3Muc3BsaWNlKHBvcywgMSlbMF0pXG4gICAgICAgIC8vIG1vdmUgdGhlIG9sZCBpdGVtXG4gICAgICAgIG9sZEl0ZW1zLnNwbGljZShpLCAwLCBvbGRJdGVtcy5zcGxpY2UocG9zLCAxKVswXSlcbiAgICAgICAgLy8gaWYgdGhlIGxvb3AgdGFncyBhcmUgbm90IGN1c3RvbVxuICAgICAgICAvLyB3ZSBuZWVkIHRvIG1vdmUgYWxsIHRoZWlyIGN1c3RvbSB0YWdzIGludG8gdGhlIHJpZ2h0IHBvc2l0aW9uXG4gICAgICAgIGlmICghY2hpbGQpIG1vdmVOZXN0ZWRUYWdzKHRhZywgaSlcbiAgICAgIH1cblxuICAgICAgLy8gY2FjaGUgdGhlIG9yaWdpbmFsIGl0ZW0gdG8gdXNlIGl0IGluIHRoZSBldmVudHMgYm91bmQgdG8gdGhpcyBub2RlXG4gICAgICAvLyBhbmQgaXRzIGNoaWxkcmVuXG4gICAgICB0YWcuX2l0ZW0gPSBpdGVtXG4gICAgICAvLyBjYWNoZSB0aGUgcmVhbCBwYXJlbnQgdGFnIGludGVybmFsbHlcbiAgICAgIGRlZmluZVByb3BlcnR5KHRhZywgJ19wYXJlbnQnLCBwYXJlbnQpXG5cbiAgICB9LCB0cnVlKSAvLyBhbGxvdyBudWxsIHZhbHVlc1xuXG4gICAgLy8gcmVtb3ZlIHRoZSByZWR1bmRhbnQgdGFnc1xuICAgIHVubW91bnRSZWR1bmRhbnQoaXRlbXMsIHRhZ3MpXG5cbiAgICAvLyBpbnNlcnQgdGhlIG5ldyBub2Rlc1xuICAgIGlmIChpc09wdGlvbikgcm9vdC5hcHBlbmRDaGlsZChmcmFnKVxuICAgIGVsc2Ugcm9vdC5pbnNlcnRCZWZvcmUoZnJhZywgcmVmKVxuXG4gICAgLy8gc2V0IHRoZSAndGFncycgcHJvcGVydHkgb2YgdGhlIHBhcmVudCB0YWdcbiAgICAvLyBpZiBjaGlsZCBpcyAndW5kZWZpbmVkJyBpdCBtZWFucyB0aGF0IHdlIGRvbid0IG5lZWQgdG8gc2V0IHRoaXMgcHJvcGVydHlcbiAgICAvLyBmb3IgZXhhbXBsZTpcbiAgICAvLyB3ZSBkb24ndCBuZWVkIHN0b3JlIHRoZSBgbXlUYWcudGFnc1snZGl2J11gIHByb3BlcnR5IGlmIHdlIGFyZSBsb29waW5nIGEgZGl2IHRhZ1xuICAgIC8vIGJ1dCB3ZSBuZWVkIHRvIHRyYWNrIHRoZSBgbXlUYWcudGFnc1snY2hpbGQnXWAgcHJvcGVydHkgbG9vcGluZyBhIGN1c3RvbSBjaGlsZCBub2RlIG5hbWVkIGBjaGlsZGBcbiAgICBpZiAoY2hpbGQpIHBhcmVudC50YWdzW3RhZ05hbWVdID0gdGFnc1xuXG4gICAgLy8gY2xvbmUgdGhlIGl0ZW1zIGFycmF5XG4gICAgb2xkSXRlbXMgPSBpdGVtcy5zbGljZSgpXG5cbiAgfSlcblxufVxuLyoqXG4gKiBPYmplY3QgdGhhdCB3aWxsIGJlIHVzZWQgdG8gaW5qZWN0IGFuZCBtYW5hZ2UgdGhlIGNzcyBvZiBldmVyeSB0YWcgaW5zdGFuY2VcbiAqL1xudmFyIHN0eWxlTWFuYWdlciA9IChmdW5jdGlvbihfcmlvdCkge1xuXG4gIGlmICghd2luZG93KSByZXR1cm4geyAvLyBza2lwIGluamVjdGlvbiBvbiB0aGUgc2VydmVyXG4gICAgYWRkOiBmdW5jdGlvbiAoKSB7fSxcbiAgICBpbmplY3Q6IGZ1bmN0aW9uICgpIHt9XG4gIH1cblxuICB2YXIgc3R5bGVOb2RlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBjcmVhdGUgYSBuZXcgc3R5bGUgZWxlbWVudCB3aXRoIHRoZSBjb3JyZWN0IHR5cGVcbiAgICB2YXIgbmV3Tm9kZSA9IG1rRWwoJ3N0eWxlJylcbiAgICBzZXRBdHRyKG5ld05vZGUsICd0eXBlJywgJ3RleHQvY3NzJylcblxuICAgIC8vIHJlcGxhY2UgYW55IHVzZXIgbm9kZSBvciBpbnNlcnQgdGhlIG5ldyBvbmUgaW50byB0aGUgaGVhZFxuICAgIHZhciB1c2VyTm9kZSA9ICQoJ3N0eWxlW3R5cGU9cmlvdF0nKVxuICAgIGlmICh1c2VyTm9kZSkge1xuICAgICAgaWYgKHVzZXJOb2RlLmlkKSBuZXdOb2RlLmlkID0gdXNlck5vZGUuaWRcbiAgICAgIHVzZXJOb2RlLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIHVzZXJOb2RlKVxuICAgIH1cbiAgICBlbHNlIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0uYXBwZW5kQ2hpbGQobmV3Tm9kZSlcblxuICAgIHJldHVybiBuZXdOb2RlXG4gIH0pKClcblxuICAvLyBDcmVhdGUgY2FjaGUgYW5kIHNob3J0Y3V0IHRvIHRoZSBjb3JyZWN0IHByb3BlcnR5XG4gIHZhciBjc3NUZXh0UHJvcCA9IHN0eWxlTm9kZS5zdHlsZVNoZWV0LFxuICAgIHN0eWxlc1RvSW5qZWN0ID0gJydcblxuICAvLyBFeHBvc2UgdGhlIHN0eWxlIG5vZGUgaW4gYSBub24tbW9kaWZpY2FibGUgcHJvcGVydHlcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KF9yaW90LCAnc3R5bGVOb2RlJywge1xuICAgIHZhbHVlOiBzdHlsZU5vZGUsXG4gICAgd3JpdGFibGU6IHRydWVcbiAgfSlcblxuICAvKipcbiAgICogUHVibGljIGFwaVxuICAgKi9cbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBTYXZlIGEgdGFnIHN0eWxlIHRvIGJlIGxhdGVyIGluamVjdGVkIGludG8gRE9NXG4gICAgICogQHBhcmFtICAgeyBTdHJpbmcgfSBjc3MgW2Rlc2NyaXB0aW9uXVxuICAgICAqL1xuICAgIGFkZDogZnVuY3Rpb24oY3NzKSB7XG4gICAgICBzdHlsZXNUb0luamVjdCArPSBjc3NcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEluamVjdCBhbGwgcHJldmlvdXNseSBzYXZlZCB0YWcgc3R5bGVzIGludG8gRE9NXG4gICAgICogaW5uZXJIVE1MIHNlZW1zIHNsb3c6IGh0dHA6Ly9qc3BlcmYuY29tL3Jpb3QtaW5zZXJ0LXN0eWxlXG4gICAgICovXG4gICAgaW5qZWN0OiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChzdHlsZXNUb0luamVjdCkge1xuICAgICAgICBpZiAoY3NzVGV4dFByb3ApIGNzc1RleHRQcm9wLmNzc1RleHQgKz0gc3R5bGVzVG9JbmplY3RcbiAgICAgICAgZWxzZSBzdHlsZU5vZGUuaW5uZXJIVE1MICs9IHN0eWxlc1RvSW5qZWN0XG4gICAgICAgIHN0eWxlc1RvSW5qZWN0ID0gJydcbiAgICAgIH1cbiAgICB9XG4gIH1cblxufSkocmlvdClcblxuXG5mdW5jdGlvbiBwYXJzZU5hbWVkRWxlbWVudHMocm9vdCwgdGFnLCBjaGlsZFRhZ3MsIGZvcmNlUGFyc2luZ05hbWVkKSB7XG5cbiAgd2Fsayhyb290LCBmdW5jdGlvbihkb20pIHtcbiAgICBpZiAoZG9tLm5vZGVUeXBlID09IDEpIHtcbiAgICAgIGRvbS5pc0xvb3AgPSBkb20uaXNMb29wIHx8XG4gICAgICAgICAgICAgICAgICAoZG9tLnBhcmVudE5vZGUgJiYgZG9tLnBhcmVudE5vZGUuaXNMb29wIHx8IGdldEF0dHIoZG9tLCAnZWFjaCcpKVxuICAgICAgICAgICAgICAgICAgICA/IDEgOiAwXG5cbiAgICAgIC8vIGN1c3RvbSBjaGlsZCB0YWdcbiAgICAgIGlmIChjaGlsZFRhZ3MpIHtcbiAgICAgICAgdmFyIGNoaWxkID0gZ2V0VGFnKGRvbSlcblxuICAgICAgICBpZiAoY2hpbGQgJiYgIWRvbS5pc0xvb3ApXG4gICAgICAgICAgY2hpbGRUYWdzLnB1c2goaW5pdENoaWxkVGFnKGNoaWxkLCB7cm9vdDogZG9tLCBwYXJlbnQ6IHRhZ30sIGRvbS5pbm5lckhUTUwsIHRhZykpXG4gICAgICB9XG5cbiAgICAgIGlmICghZG9tLmlzTG9vcCB8fCBmb3JjZVBhcnNpbmdOYW1lZClcbiAgICAgICAgc2V0TmFtZWQoZG9tLCB0YWcsIFtdKVxuICAgIH1cblxuICB9KVxuXG59XG5cbmZ1bmN0aW9uIHBhcnNlRXhwcmVzc2lvbnMocm9vdCwgdGFnLCBleHByZXNzaW9ucykge1xuXG4gIGZ1bmN0aW9uIGFkZEV4cHIoZG9tLCB2YWwsIGV4dHJhKSB7XG4gICAgaWYgKHRtcGwuaGFzRXhwcih2YWwpKSB7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGV4dGVuZCh7IGRvbTogZG9tLCBleHByOiB2YWwgfSwgZXh0cmEpKVxuICAgIH1cbiAgfVxuXG4gIHdhbGsocm9vdCwgZnVuY3Rpb24oZG9tKSB7XG4gICAgdmFyIHR5cGUgPSBkb20ubm9kZVR5cGUsXG4gICAgICBhdHRyXG5cbiAgICAvLyB0ZXh0IG5vZGVcbiAgICBpZiAodHlwZSA9PSAzICYmIGRvbS5wYXJlbnROb2RlLnRhZ05hbWUgIT0gJ1NUWUxFJykgYWRkRXhwcihkb20sIGRvbS5ub2RlVmFsdWUpXG4gICAgaWYgKHR5cGUgIT0gMSkgcmV0dXJuXG5cbiAgICAvKiBlbGVtZW50ICovXG5cbiAgICAvLyBsb29wXG4gICAgYXR0ciA9IGdldEF0dHIoZG9tLCAnZWFjaCcpXG5cbiAgICBpZiAoYXR0cikgeyBfZWFjaChkb20sIHRhZywgYXR0cik7IHJldHVybiBmYWxzZSB9XG5cbiAgICAvLyBhdHRyaWJ1dGUgZXhwcmVzc2lvbnNcbiAgICBlYWNoKGRvbS5hdHRyaWJ1dGVzLCBmdW5jdGlvbihhdHRyKSB7XG4gICAgICB2YXIgbmFtZSA9IGF0dHIubmFtZSxcbiAgICAgICAgYm9vbCA9IG5hbWUuc3BsaXQoJ19fJylbMV1cblxuICAgICAgYWRkRXhwcihkb20sIGF0dHIudmFsdWUsIHsgYXR0cjogYm9vbCB8fCBuYW1lLCBib29sOiBib29sIH0pXG4gICAgICBpZiAoYm9vbCkgeyByZW1BdHRyKGRvbSwgbmFtZSk7IHJldHVybiBmYWxzZSB9XG5cbiAgICB9KVxuXG4gICAgLy8gc2tpcCBjdXN0b20gdGFnc1xuICAgIGlmIChnZXRUYWcoZG9tKSkgcmV0dXJuIGZhbHNlXG5cbiAgfSlcblxufVxuZnVuY3Rpb24gVGFnKGltcGwsIGNvbmYsIGlubmVySFRNTCkge1xuXG4gIHZhciBzZWxmID0gcmlvdC5vYnNlcnZhYmxlKHRoaXMpLFxuICAgIG9wdHMgPSBpbmhlcml0KGNvbmYub3B0cykgfHwge30sXG4gICAgcGFyZW50ID0gY29uZi5wYXJlbnQsXG4gICAgaXNMb29wID0gY29uZi5pc0xvb3AsXG4gICAgaGFzSW1wbCA9IGNvbmYuaGFzSW1wbCxcbiAgICBpdGVtID0gY2xlYW5VcERhdGEoY29uZi5pdGVtKSxcbiAgICBleHByZXNzaW9ucyA9IFtdLFxuICAgIGNoaWxkVGFncyA9IFtdLFxuICAgIHJvb3QgPSBjb25mLnJvb3QsXG4gICAgZm4gPSBpbXBsLmZuLFxuICAgIHRhZ05hbWUgPSByb290LnRhZ05hbWUudG9Mb3dlckNhc2UoKSxcbiAgICBhdHRyID0ge30sXG4gICAgcHJvcHNJblN5bmNXaXRoUGFyZW50ID0gW10sXG4gICAgZG9tXG5cbiAgaWYgKGZuICYmIHJvb3QuX3RhZykgcm9vdC5fdGFnLnVubW91bnQodHJ1ZSlcblxuICAvLyBub3QgeWV0IG1vdW50ZWRcbiAgdGhpcy5pc01vdW50ZWQgPSBmYWxzZVxuICByb290LmlzTG9vcCA9IGlzTG9vcFxuXG4gIC8vIGtlZXAgYSByZWZlcmVuY2UgdG8gdGhlIHRhZyBqdXN0IGNyZWF0ZWRcbiAgLy8gc28gd2Ugd2lsbCBiZSBhYmxlIHRvIG1vdW50IHRoaXMgdGFnIG11bHRpcGxlIHRpbWVzXG4gIHJvb3QuX3RhZyA9IHRoaXNcblxuICAvLyBjcmVhdGUgYSB1bmlxdWUgaWQgdG8gdGhpcyB0YWdcbiAgLy8gaXQgY291bGQgYmUgaGFuZHkgdG8gdXNlIGl0IGFsc28gdG8gaW1wcm92ZSB0aGUgdmlydHVhbCBkb20gcmVuZGVyaW5nIHNwZWVkXG4gIGRlZmluZVByb3BlcnR5KHRoaXMsICdfcmlvdF9pZCcsICsrX191aWQpIC8vIGJhc2UgMSBhbGxvd3MgdGVzdCAhdC5fcmlvdF9pZFxuXG4gIGV4dGVuZCh0aGlzLCB7IHBhcmVudDogcGFyZW50LCByb290OiByb290LCBvcHRzOiBvcHRzLCB0YWdzOiB7fSB9LCBpdGVtKVxuXG4gIC8vIGdyYWIgYXR0cmlidXRlc1xuICBlYWNoKHJvb3QuYXR0cmlidXRlcywgZnVuY3Rpb24oZWwpIHtcbiAgICB2YXIgdmFsID0gZWwudmFsdWVcbiAgICAvLyByZW1lbWJlciBhdHRyaWJ1dGVzIHdpdGggZXhwcmVzc2lvbnMgb25seVxuICAgIGlmICh0bXBsLmhhc0V4cHIodmFsKSkgYXR0cltlbC5uYW1lXSA9IHZhbFxuICB9KVxuXG4gIGRvbSA9IG1rZG9tKGltcGwudG1wbCwgaW5uZXJIVE1MKVxuXG4gIC8vIG9wdGlvbnNcbiAgZnVuY3Rpb24gdXBkYXRlT3B0cygpIHtcbiAgICB2YXIgY3R4ID0gaGFzSW1wbCAmJiBpc0xvb3AgPyBzZWxmIDogcGFyZW50IHx8IHNlbGZcblxuICAgIC8vIHVwZGF0ZSBvcHRzIGZyb20gY3VycmVudCBET00gYXR0cmlidXRlc1xuICAgIGVhY2gocm9vdC5hdHRyaWJ1dGVzLCBmdW5jdGlvbihlbCkge1xuICAgICAgdmFyIHZhbCA9IGVsLnZhbHVlXG4gICAgICBvcHRzW3RvQ2FtZWwoZWwubmFtZSldID0gdG1wbC5oYXNFeHByKHZhbCkgPyB0bXBsKHZhbCwgY3R4KSA6IHZhbFxuICAgIH0pXG4gICAgLy8gcmVjb3ZlciB0aG9zZSB3aXRoIGV4cHJlc3Npb25zXG4gICAgZWFjaChPYmplY3Qua2V5cyhhdHRyKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgb3B0c1t0b0NhbWVsKG5hbWUpXSA9IHRtcGwoYXR0cltuYW1lXSwgY3R4KVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVEYXRhKGRhdGEpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gaXRlbSkge1xuICAgICAgaWYgKHR5cGVvZiBzZWxmW2tleV0gIT09IFRfVU5ERUYgJiYgaXNXcml0YWJsZShzZWxmLCBrZXkpKVxuICAgICAgICBzZWxmW2tleV0gPSBkYXRhW2tleV1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBpbmhlcml0RnJvbVBhcmVudCAoKSB7XG4gICAgaWYgKCFzZWxmLnBhcmVudCB8fCAhaXNMb29wKSByZXR1cm5cbiAgICBlYWNoKE9iamVjdC5rZXlzKHNlbGYucGFyZW50KSwgZnVuY3Rpb24oaykge1xuICAgICAgLy8gc29tZSBwcm9wZXJ0aWVzIG11c3QgYmUgYWx3YXlzIGluIHN5bmMgd2l0aCB0aGUgcGFyZW50IHRhZ1xuICAgICAgdmFyIG11c3RTeW5jID0gIWNvbnRhaW5zKFJFU0VSVkVEX1dPUkRTX0JMQUNLTElTVCwgaykgJiYgY29udGFpbnMocHJvcHNJblN5bmNXaXRoUGFyZW50LCBrKVxuICAgICAgaWYgKHR5cGVvZiBzZWxmW2tdID09PSBUX1VOREVGIHx8IG11c3RTeW5jKSB7XG4gICAgICAgIC8vIHRyYWNrIHRoZSBwcm9wZXJ0eSB0byBrZWVwIGluIHN5bmNcbiAgICAgICAgLy8gc28gd2UgY2FuIGtlZXAgaXQgdXBkYXRlZFxuICAgICAgICBpZiAoIW11c3RTeW5jKSBwcm9wc0luU3luY1dpdGhQYXJlbnQucHVzaChrKVxuICAgICAgICBzZWxmW2tdID0gc2VsZi5wYXJlbnRba11cbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgZGVmaW5lUHJvcGVydHkodGhpcywgJ3VwZGF0ZScsIGZ1bmN0aW9uKGRhdGEpIHtcblxuICAgIC8vIG1ha2Ugc3VyZSB0aGUgZGF0YSBwYXNzZWQgd2lsbCBub3Qgb3ZlcnJpZGVcbiAgICAvLyB0aGUgY29tcG9uZW50IGNvcmUgbWV0aG9kc1xuICAgIGRhdGEgPSBjbGVhblVwRGF0YShkYXRhKVxuICAgIC8vIGluaGVyaXQgcHJvcGVydGllcyBmcm9tIHRoZSBwYXJlbnRcbiAgICBpbmhlcml0RnJvbVBhcmVudCgpXG4gICAgLy8gbm9ybWFsaXplIHRoZSB0YWcgcHJvcGVydGllcyBpbiBjYXNlIGFuIGl0ZW0gb2JqZWN0IHdhcyBpbml0aWFsbHkgcGFzc2VkXG4gICAgaWYgKGRhdGEgJiYgdHlwZW9mIGl0ZW0gPT09IFRfT0JKRUNUKSB7XG4gICAgICBub3JtYWxpemVEYXRhKGRhdGEpXG4gICAgICBpdGVtID0gZGF0YVxuICAgIH1cbiAgICBleHRlbmQoc2VsZiwgZGF0YSlcbiAgICB1cGRhdGVPcHRzKClcbiAgICBzZWxmLnRyaWdnZXIoJ3VwZGF0ZScsIGRhdGEpXG4gICAgdXBkYXRlKGV4cHJlc3Npb25zLCBzZWxmKVxuICAgIC8vIHRoZSB1cGRhdGVkIGV2ZW50IHdpbGwgYmUgdHJpZ2dlcmVkXG4gICAgLy8gb25jZSB0aGUgRE9NIHdpbGwgYmUgcmVhZHkgYW5kIGFsbCB0aGUgcmVmbG93cyBhcmUgY29tcGxldGVkXG4gICAgLy8gdGhpcyBpcyB1c2VmdWwgaWYgeW91IHdhbnQgdG8gZ2V0IHRoZSBcInJlYWxcIiByb290IHByb3BlcnRpZXNcbiAgICAvLyA0IGV4OiByb290Lm9mZnNldFdpZHRoIC4uLlxuICAgIHJBRihmdW5jdGlvbigpIHsgc2VsZi50cmlnZ2VyKCd1cGRhdGVkJykgfSlcbiAgICByZXR1cm4gdGhpc1xuICB9KVxuXG4gIGRlZmluZVByb3BlcnR5KHRoaXMsICdtaXhpbicsIGZ1bmN0aW9uKCkge1xuICAgIGVhY2goYXJndW1lbnRzLCBmdW5jdGlvbihtaXgpIHtcbiAgICAgIHZhciBpbnN0YW5jZVxuXG4gICAgICBtaXggPSB0eXBlb2YgbWl4ID09PSBUX1NUUklORyA/IHJpb3QubWl4aW4obWl4KSA6IG1peFxuXG4gICAgICAvLyBjaGVjayBpZiB0aGUgbWl4aW4gaXMgYSBmdW5jdGlvblxuICAgICAgaWYgKGlzRnVuY3Rpb24obWl4KSkge1xuICAgICAgICAvLyBjcmVhdGUgdGhlIG5ldyBtaXhpbiBpbnN0YW5jZVxuICAgICAgICBpbnN0YW5jZSA9IG5ldyBtaXgoKVxuICAgICAgICAvLyBzYXZlIHRoZSBwcm90b3R5cGUgdG8gbG9vcCBpdCBhZnRlcndhcmRzXG4gICAgICAgIG1peCA9IG1peC5wcm90b3R5cGVcbiAgICAgIH0gZWxzZSBpbnN0YW5jZSA9IG1peFxuXG4gICAgICAvLyBsb29wIHRoZSBrZXlzIGluIHRoZSBmdW5jdGlvbiBwcm90b3R5cGUgb3IgdGhlIGFsbCBvYmplY3Qga2V5c1xuICAgICAgZWFjaChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtaXgpLCBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgLy8gYmluZCBtZXRob2RzIHRvIHNlbGZcbiAgICAgICAgaWYgKGtleSAhPSAnaW5pdCcpXG4gICAgICAgICAgc2VsZltrZXldID0gaXNGdW5jdGlvbihpbnN0YW5jZVtrZXldKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZVtrZXldLmJpbmQoc2VsZikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2Vba2V5XVxuICAgICAgfSlcblxuICAgICAgLy8gaW5pdCBtZXRob2Qgd2lsbCBiZSBjYWxsZWQgYXV0b21hdGljYWxseVxuICAgICAgaWYgKGluc3RhbmNlLmluaXQpIGluc3RhbmNlLmluaXQuYmluZChzZWxmKSgpXG4gICAgfSlcbiAgICByZXR1cm4gdGhpc1xuICB9KVxuXG4gIGRlZmluZVByb3BlcnR5KHRoaXMsICdtb3VudCcsIGZ1bmN0aW9uKCkge1xuXG4gICAgdXBkYXRlT3B0cygpXG5cbiAgICAvLyBpbml0aWFsaWF0aW9uXG4gICAgaWYgKGZuKSBmbi5jYWxsKHNlbGYsIG9wdHMpXG5cbiAgICAvLyBwYXJzZSBsYXlvdXQgYWZ0ZXIgaW5pdC4gZm4gbWF5IGNhbGN1bGF0ZSBhcmdzIGZvciBuZXN0ZWQgY3VzdG9tIHRhZ3NcbiAgICBwYXJzZUV4cHJlc3Npb25zKGRvbSwgc2VsZiwgZXhwcmVzc2lvbnMpXG5cbiAgICAvLyBtb3VudCB0aGUgY2hpbGQgdGFnc1xuICAgIHRvZ2dsZSh0cnVlKVxuXG4gICAgLy8gdXBkYXRlIHRoZSByb290IGFkZGluZyBjdXN0b20gYXR0cmlidXRlcyBjb21pbmcgZnJvbSB0aGUgY29tcGlsZXJcbiAgICAvLyBpdCBmaXhlcyBhbHNvICMxMDg3XG4gICAgaWYgKGltcGwuYXR0cnMgfHwgaGFzSW1wbCkge1xuICAgICAgd2Fsa0F0dHJpYnV0ZXMoaW1wbC5hdHRycywgZnVuY3Rpb24gKGssIHYpIHsgc2V0QXR0cihyb290LCBrLCB2KSB9KVxuICAgICAgcGFyc2VFeHByZXNzaW9ucyhzZWxmLnJvb3QsIHNlbGYsIGV4cHJlc3Npb25zKVxuICAgIH1cblxuICAgIGlmICghc2VsZi5wYXJlbnQgfHwgaXNMb29wKSBzZWxmLnVwZGF0ZShpdGVtKVxuXG4gICAgLy8gaW50ZXJuYWwgdXNlIG9ubHksIGZpeGVzICM0MDNcbiAgICBzZWxmLnRyaWdnZXIoJ2JlZm9yZS1tb3VudCcpXG5cbiAgICBpZiAoaXNMb29wICYmICFoYXNJbXBsKSB7XG4gICAgICAvLyB1cGRhdGUgdGhlIHJvb3QgYXR0cmlidXRlIGZvciB0aGUgbG9vcGVkIGVsZW1lbnRzXG4gICAgICBzZWxmLnJvb3QgPSByb290ID0gZG9tLmZpcnN0Q2hpbGRcblxuICAgIH0gZWxzZSB7XG4gICAgICB3aGlsZSAoZG9tLmZpcnN0Q2hpbGQpIHJvb3QuYXBwZW5kQ2hpbGQoZG9tLmZpcnN0Q2hpbGQpXG4gICAgICBpZiAocm9vdC5zdHViKSBzZWxmLnJvb3QgPSByb290ID0gcGFyZW50LnJvb3RcbiAgICB9XG5cbiAgICAvLyBwYXJzZSB0aGUgbmFtZWQgZG9tIG5vZGVzIGluIHRoZSBsb29wZWQgY2hpbGRcbiAgICAvLyBhZGRpbmcgdGhlbSB0byB0aGUgcGFyZW50IGFzIHdlbGxcbiAgICBpZiAoaXNMb29wKVxuICAgICAgcGFyc2VOYW1lZEVsZW1lbnRzKHNlbGYucm9vdCwgc2VsZi5wYXJlbnQsIG51bGwsIHRydWUpXG5cbiAgICAvLyBpZiBpdCdzIG5vdCBhIGNoaWxkIHRhZyB3ZSBjYW4gdHJpZ2dlciBpdHMgbW91bnQgZXZlbnRcbiAgICBpZiAoIXNlbGYucGFyZW50IHx8IHNlbGYucGFyZW50LmlzTW91bnRlZCkge1xuICAgICAgc2VsZi5pc01vdW50ZWQgPSB0cnVlXG4gICAgICBzZWxmLnRyaWdnZXIoJ21vdW50JylcbiAgICB9XG4gICAgLy8gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gd2FpdCB0aGF0IHRoZSBwYXJlbnQgZXZlbnQgZ2V0cyB0cmlnZ2VyZWRcbiAgICBlbHNlIHNlbGYucGFyZW50Lm9uZSgnbW91bnQnLCBmdW5jdGlvbigpIHtcbiAgICAgIC8vIGF2b2lkIHRvIHRyaWdnZXIgdGhlIGBtb3VudGAgZXZlbnQgZm9yIHRoZSB0YWdzXG4gICAgICAvLyBub3QgdmlzaWJsZSBpbmNsdWRlZCBpbiBhbiBpZiBzdGF0ZW1lbnRcbiAgICAgIGlmICghaXNJblN0dWIoc2VsZi5yb290KSkge1xuICAgICAgICBzZWxmLnBhcmVudC5pc01vdW50ZWQgPSBzZWxmLmlzTW91bnRlZCA9IHRydWVcbiAgICAgICAgc2VsZi50cmlnZ2VyKCdtb3VudCcpXG4gICAgICB9XG4gICAgfSlcbiAgfSlcblxuXG4gIGRlZmluZVByb3BlcnR5KHRoaXMsICd1bm1vdW50JywgZnVuY3Rpb24oa2VlcFJvb3RUYWcpIHtcbiAgICB2YXIgZWwgPSByb290LFxuICAgICAgcCA9IGVsLnBhcmVudE5vZGUsXG4gICAgICBwdGFnXG5cbiAgICBzZWxmLnRyaWdnZXIoJ2JlZm9yZS11bm1vdW50JylcblxuICAgIC8vIHJlbW92ZSB0aGlzIHRhZyBpbnN0YW5jZSBmcm9tIHRoZSBnbG9iYWwgdmlydHVhbERvbSB2YXJpYWJsZVxuICAgIF9fdmlydHVhbERvbS5zcGxpY2UoX192aXJ0dWFsRG9tLmluZGV4T2Yoc2VsZiksIDEpXG5cbiAgICBpZiAodGhpcy5fdmlydHMpIHtcbiAgICAgIGVhY2godGhpcy5fdmlydHMsIGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgdi5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHYpXG4gICAgICB9KVxuICAgIH1cblxuICAgIGlmIChwKSB7XG5cbiAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgcHRhZyA9IGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudFRhZyhwYXJlbnQpXG4gICAgICAgIC8vIHJlbW92ZSB0aGlzIHRhZyBmcm9tIHRoZSBwYXJlbnQgdGFncyBvYmplY3RcbiAgICAgICAgLy8gaWYgdGhlcmUgYXJlIG11bHRpcGxlIG5lc3RlZCB0YWdzIHdpdGggc2FtZSBuYW1lLi5cbiAgICAgICAgLy8gcmVtb3ZlIHRoaXMgZWxlbWVudCBmb3JtIHRoZSBhcnJheVxuICAgICAgICBpZiAoaXNBcnJheShwdGFnLnRhZ3NbdGFnTmFtZV0pKVxuICAgICAgICAgIGVhY2gocHRhZy50YWdzW3RhZ05hbWVdLCBmdW5jdGlvbih0YWcsIGkpIHtcbiAgICAgICAgICAgIGlmICh0YWcuX3Jpb3RfaWQgPT0gc2VsZi5fcmlvdF9pZClcbiAgICAgICAgICAgICAgcHRhZy50YWdzW3RhZ05hbWVdLnNwbGljZShpLCAxKVxuICAgICAgICAgIH0pXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAvLyBvdGhlcndpc2UganVzdCBkZWxldGUgdGhlIHRhZyBpbnN0YW5jZVxuICAgICAgICAgIHB0YWcudGFnc1t0YWdOYW1lXSA9IHVuZGVmaW5lZFxuICAgICAgfVxuXG4gICAgICBlbHNlXG4gICAgICAgIHdoaWxlIChlbC5maXJzdENoaWxkKSBlbC5yZW1vdmVDaGlsZChlbC5maXJzdENoaWxkKVxuXG4gICAgICBpZiAoIWtlZXBSb290VGFnKVxuICAgICAgICBwLnJlbW92ZUNoaWxkKGVsKVxuICAgICAgZWxzZVxuICAgICAgICAvLyB0aGUgcmlvdC10YWcgYXR0cmlidXRlIGlzbid0IG5lZWRlZCBhbnltb3JlLCByZW1vdmUgaXRcbiAgICAgICAgcmVtQXR0cihwLCAncmlvdC10YWcnKVxuICAgIH1cblxuXG4gICAgc2VsZi50cmlnZ2VyKCd1bm1vdW50JylcbiAgICB0b2dnbGUoKVxuICAgIHNlbGYub2ZmKCcqJylcbiAgICBzZWxmLmlzTW91bnRlZCA9IGZhbHNlXG4gICAgZGVsZXRlIHJvb3QuX3RhZ1xuXG4gIH0pXG5cbiAgZnVuY3Rpb24gdG9nZ2xlKGlzTW91bnQpIHtcblxuICAgIC8vIG1vdW50L3VubW91bnQgY2hpbGRyZW5cbiAgICBlYWNoKGNoaWxkVGFncywgZnVuY3Rpb24oY2hpbGQpIHsgY2hpbGRbaXNNb3VudCA/ICdtb3VudCcgOiAndW5tb3VudCddKCkgfSlcblxuICAgIC8vIGxpc3Rlbi91bmxpc3RlbiBwYXJlbnQgKGV2ZW50cyBmbG93IG9uZSB3YXkgZnJvbSBwYXJlbnQgdG8gY2hpbGRyZW4pXG4gICAgaWYgKCFwYXJlbnQpIHJldHVyblxuICAgIHZhciBldnQgPSBpc01vdW50ID8gJ29uJyA6ICdvZmYnXG5cbiAgICAvLyB0aGUgbG9vcCB0YWdzIHdpbGwgYmUgYWx3YXlzIGluIHN5bmMgd2l0aCB0aGUgcGFyZW50IGF1dG9tYXRpY2FsbHlcbiAgICBpZiAoaXNMb29wKVxuICAgICAgcGFyZW50W2V2dF0oJ3VubW91bnQnLCBzZWxmLnVubW91bnQpXG4gICAgZWxzZVxuICAgICAgcGFyZW50W2V2dF0oJ3VwZGF0ZScsIHNlbGYudXBkYXRlKVtldnRdKCd1bm1vdW50Jywgc2VsZi51bm1vdW50KVxuICB9XG5cbiAgLy8gbmFtZWQgZWxlbWVudHMgYXZhaWxhYmxlIGZvciBmblxuICBwYXJzZU5hbWVkRWxlbWVudHMoZG9tLCB0aGlzLCBjaGlsZFRhZ3MpXG5cbn1cbi8qKlxuICogQXR0YWNoIGFuIGV2ZW50IHRvIGEgRE9NIG5vZGVcbiAqIEBwYXJhbSB7IFN0cmluZyB9IG5hbWUgLSBldmVudCBuYW1lXG4gKiBAcGFyYW0geyBGdW5jdGlvbiB9IGhhbmRsZXIgLSBldmVudCBjYWxsYmFja1xuICogQHBhcmFtIHsgT2JqZWN0IH0gZG9tIC0gZG9tIG5vZGVcbiAqIEBwYXJhbSB7IFRhZyB9IHRhZyAtIHRhZyBpbnN0YW5jZVxuICovXG5mdW5jdGlvbiBzZXRFdmVudEhhbmRsZXIobmFtZSwgaGFuZGxlciwgZG9tLCB0YWcpIHtcblxuICBkb21bbmFtZV0gPSBmdW5jdGlvbihlKSB7XG5cbiAgICB2YXIgcHRhZyA9IHRhZy5fcGFyZW50LFxuICAgICAgaXRlbSA9IHRhZy5faXRlbSxcbiAgICAgIGVsXG5cbiAgICBpZiAoIWl0ZW0pXG4gICAgICB3aGlsZSAocHRhZyAmJiAhaXRlbSkge1xuICAgICAgICBpdGVtID0gcHRhZy5faXRlbVxuICAgICAgICBwdGFnID0gcHRhZy5fcGFyZW50XG4gICAgICB9XG5cbiAgICAvLyBjcm9zcyBicm93c2VyIGV2ZW50IGZpeFxuICAgIGUgPSBlIHx8IHdpbmRvdy5ldmVudFxuXG4gICAgLy8gb3ZlcnJpZGUgdGhlIGV2ZW50IHByb3BlcnRpZXNcbiAgICBpZiAoaXNXcml0YWJsZShlLCAnY3VycmVudFRhcmdldCcpKSBlLmN1cnJlbnRUYXJnZXQgPSBkb21cbiAgICBpZiAoaXNXcml0YWJsZShlLCAndGFyZ2V0JykpIGUudGFyZ2V0ID0gZS5zcmNFbGVtZW50XG4gICAgaWYgKGlzV3JpdGFibGUoZSwgJ3doaWNoJykpIGUud2hpY2ggPSBlLmNoYXJDb2RlIHx8IGUua2V5Q29kZVxuXG4gICAgZS5pdGVtID0gaXRlbVxuXG4gICAgLy8gcHJldmVudCBkZWZhdWx0IGJlaGF2aW91ciAoYnkgZGVmYXVsdClcbiAgICBpZiAoaGFuZGxlci5jYWxsKHRhZywgZSkgIT09IHRydWUgJiYgIS9yYWRpb3xjaGVjay8udGVzdChkb20udHlwZSkpIHtcbiAgICAgIGlmIChlLnByZXZlbnREZWZhdWx0KSBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGUucmV0dXJuVmFsdWUgPSBmYWxzZVxuICAgIH1cblxuICAgIGlmICghZS5wcmV2ZW50VXBkYXRlKSB7XG4gICAgICBlbCA9IGl0ZW0gPyBnZXRJbW1lZGlhdGVDdXN0b21QYXJlbnRUYWcocHRhZykgOiB0YWdcbiAgICAgIGVsLnVwZGF0ZSgpXG4gICAgfVxuXG4gIH1cblxufVxuXG5cbi8qKlxuICogSW5zZXJ0IGEgRE9NIG5vZGUgcmVwbGFjaW5nIGFub3RoZXIgb25lICh1c2VkIGJ5IGlmLSBhdHRyaWJ1dGUpXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IHJvb3QgLSBwYXJlbnQgbm9kZVxuICogQHBhcmFtICAgeyBPYmplY3QgfSBub2RlIC0gbm9kZSByZXBsYWNlZFxuICogQHBhcmFtICAgeyBPYmplY3QgfSBiZWZvcmUgLSBub2RlIGFkZGVkXG4gKi9cbmZ1bmN0aW9uIGluc2VydFRvKHJvb3QsIG5vZGUsIGJlZm9yZSkge1xuICBpZiAoIXJvb3QpIHJldHVyblxuICByb290Lmluc2VydEJlZm9yZShiZWZvcmUsIG5vZGUpXG4gIHJvb3QucmVtb3ZlQ2hpbGQobm9kZSlcbn1cblxuLyoqXG4gKiBVcGRhdGUgdGhlIGV4cHJlc3Npb25zIGluIGEgVGFnIGluc3RhbmNlXG4gKiBAcGFyYW0gICB7IEFycmF5IH0gZXhwcmVzc2lvbnMgLSBleHByZXNzaW9uIHRoYXQgbXVzdCBiZSByZSBldmFsdWF0ZWRcbiAqIEBwYXJhbSAgIHsgVGFnIH0gdGFnIC0gdGFnIGluc3RhbmNlXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZShleHByZXNzaW9ucywgdGFnKSB7XG5cbiAgZWFjaChleHByZXNzaW9ucywgZnVuY3Rpb24oZXhwciwgaSkge1xuXG4gICAgdmFyIGRvbSA9IGV4cHIuZG9tLFxuICAgICAgYXR0ck5hbWUgPSBleHByLmF0dHIsXG4gICAgICB2YWx1ZSA9IHRtcGwoZXhwci5leHByLCB0YWcpLFxuICAgICAgcGFyZW50ID0gZXhwci5kb20ucGFyZW50Tm9kZVxuXG4gICAgaWYgKGV4cHIuYm9vbClcbiAgICAgIHZhbHVlID0gdmFsdWUgPyBhdHRyTmFtZSA6IGZhbHNlXG4gICAgZWxzZSBpZiAodmFsdWUgPT0gbnVsbClcbiAgICAgIHZhbHVlID0gJydcblxuICAgIC8vIGxlYXZlIG91dCByaW90LSBwcmVmaXhlcyBmcm9tIHN0cmluZ3MgaW5zaWRlIHRleHRhcmVhXG4gICAgLy8gZml4ICM4MTU6IGFueSB2YWx1ZSAtPiBzdHJpbmdcbiAgICBpZiAocGFyZW50ICYmIHBhcmVudC50YWdOYW1lID09ICdURVhUQVJFQScpIHtcbiAgICAgIHZhbHVlID0gKCcnICsgdmFsdWUpLnJlcGxhY2UoL3Jpb3QtL2csICcnKVxuICAgICAgLy8gY2hhbmdlIHRleHRhcmVhJ3MgdmFsdWVcbiAgICAgIHBhcmVudC52YWx1ZSA9IHZhbHVlXG4gICAgfVxuXG4gICAgLy8gbm8gY2hhbmdlXG4gICAgaWYgKGV4cHIudmFsdWUgPT09IHZhbHVlKSByZXR1cm5cbiAgICBleHByLnZhbHVlID0gdmFsdWVcblxuICAgIC8vIHRleHQgbm9kZVxuICAgIGlmICghYXR0ck5hbWUpIHtcbiAgICAgIGRvbS5ub2RlVmFsdWUgPSAnJyArIHZhbHVlICAgIC8vICM4MTUgcmVsYXRlZFxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIG9yaWdpbmFsIGF0dHJpYnV0ZVxuICAgIHJlbUF0dHIoZG9tLCBhdHRyTmFtZSlcbiAgICAvLyBldmVudCBoYW5kbGVyXG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICBzZXRFdmVudEhhbmRsZXIoYXR0ck5hbWUsIHZhbHVlLCBkb20sIHRhZylcblxuICAgIC8vIGlmLSBjb25kaXRpb25hbFxuICAgIH0gZWxzZSBpZiAoYXR0ck5hbWUgPT0gJ2lmJykge1xuICAgICAgdmFyIHN0dWIgPSBleHByLnN0dWIsXG4gICAgICAgIGFkZCA9IGZ1bmN0aW9uKCkgeyBpbnNlcnRUbyhzdHViLnBhcmVudE5vZGUsIHN0dWIsIGRvbSkgfSxcbiAgICAgICAgcmVtb3ZlID0gZnVuY3Rpb24oKSB7IGluc2VydFRvKGRvbS5wYXJlbnROb2RlLCBkb20sIHN0dWIpIH1cblxuICAgICAgLy8gYWRkIHRvIERPTVxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGlmIChzdHViKSB7XG4gICAgICAgICAgYWRkKClcbiAgICAgICAgICBkb20uaW5TdHViID0gZmFsc2VcbiAgICAgICAgICAvLyBhdm9pZCB0byB0cmlnZ2VyIHRoZSBtb3VudCBldmVudCBpZiB0aGUgdGFncyBpcyBub3QgdmlzaWJsZSB5ZXRcbiAgICAgICAgICAvLyBtYXliZSB3ZSBjYW4gb3B0aW1pemUgdGhpcyBhdm9pZGluZyB0byBtb3VudCB0aGUgdGFnIGF0IGFsbFxuICAgICAgICAgIGlmICghaXNJblN0dWIoZG9tKSkge1xuICAgICAgICAgICAgd2Fsayhkb20sIGZ1bmN0aW9uKGVsKSB7XG4gICAgICAgICAgICAgIGlmIChlbC5fdGFnICYmICFlbC5fdGFnLmlzTW91bnRlZClcbiAgICAgICAgICAgICAgICBlbC5fdGFnLmlzTW91bnRlZCA9ICEhZWwuX3RhZy50cmlnZ2VyKCdtb3VudCcpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgLy8gcmVtb3ZlIGZyb20gRE9NXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHViID0gZXhwci5zdHViID0gc3R1YiB8fCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJylcbiAgICAgICAgLy8gaWYgdGhlIHBhcmVudE5vZGUgaXMgZGVmaW5lZCB3ZSBjYW4gZWFzaWx5IHJlcGxhY2UgdGhlIHRhZ1xuICAgICAgICBpZiAoZG9tLnBhcmVudE5vZGUpXG4gICAgICAgICAgcmVtb3ZlKClcbiAgICAgICAgLy8gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gd2FpdCB0aGUgdXBkYXRlZCBldmVudFxuICAgICAgICBlbHNlICh0YWcucGFyZW50IHx8IHRhZykub25lKCd1cGRhdGVkJywgcmVtb3ZlKVxuXG4gICAgICAgIGRvbS5pblN0dWIgPSB0cnVlXG4gICAgICB9XG4gICAgLy8gc2hvdyAvIGhpZGVcbiAgICB9IGVsc2UgaWYgKC9eKHNob3d8aGlkZSkkLy50ZXN0KGF0dHJOYW1lKSkge1xuICAgICAgaWYgKGF0dHJOYW1lID09ICdoaWRlJykgdmFsdWUgPSAhdmFsdWVcbiAgICAgIGRvbS5zdHlsZS5kaXNwbGF5ID0gdmFsdWUgPyAnJyA6ICdub25lJ1xuXG4gICAgLy8gZmllbGQgdmFsdWVcbiAgICB9IGVsc2UgaWYgKGF0dHJOYW1lID09ICd2YWx1ZScpIHtcbiAgICAgIGRvbS52YWx1ZSA9IHZhbHVlXG5cbiAgICAvLyA8aW1nIHNyYz1cInsgZXhwciB9XCI+XG4gICAgfSBlbHNlIGlmIChzdGFydHNXaXRoKGF0dHJOYW1lLCBSSU9UX1BSRUZJWCkgJiYgYXR0ck5hbWUgIT0gUklPVF9UQUcpIHtcbiAgICAgIGlmICh2YWx1ZSlcbiAgICAgICAgc2V0QXR0cihkb20sIGF0dHJOYW1lLnNsaWNlKFJJT1RfUFJFRklYLmxlbmd0aCksIHZhbHVlKVxuXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChleHByLmJvb2wpIHtcbiAgICAgICAgZG9tW2F0dHJOYW1lXSA9IHZhbHVlXG4gICAgICAgIGlmICghdmFsdWUpIHJldHVyblxuICAgICAgfVxuXG4gICAgICBpZiAodmFsdWUgPT09IDAgfHwgdmFsdWUgJiYgdHlwZW9mIHZhbHVlICE9PSBUX09CSkVDVClcbiAgICAgICAgc2V0QXR0cihkb20sIGF0dHJOYW1lLCB2YWx1ZSlcblxuICAgIH1cblxuICB9KVxuXG59XG4vKipcbiAqIExvb3BzIGFuIGFycmF5XG4gKiBAcGFyYW0gICB7IEFycmF5IH0gZWxzIC0gY29sbGVjdGlvbiBvZiBpdGVtc1xuICogQHBhcmFtICAge0Z1bmN0aW9ufSBmbiAtIGNhbGxiYWNrIGZ1bmN0aW9uXG4gKiBAcmV0dXJucyB7IEFycmF5IH0gdGhlIGFycmF5IGxvb3BlZFxuICovXG5mdW5jdGlvbiBlYWNoKGVscywgZm4pIHtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IChlbHMgfHwgW10pLmxlbmd0aCwgZWw7IGkgPCBsZW47IGkrKykge1xuICAgIGVsID0gZWxzW2ldXG4gICAgLy8gcmV0dXJuIGZhbHNlIC0+IHJlbW92ZSBjdXJyZW50IGl0ZW0gZHVyaW5nIGxvb3BcbiAgICBpZiAoZWwgIT0gbnVsbCAmJiBmbihlbCwgaSkgPT09IGZhbHNlKSBpLS1cbiAgfVxuICByZXR1cm4gZWxzXG59XG5cbi8qKlxuICogRGV0ZWN0IGlmIHRoZSBhcmd1bWVudCBwYXNzZWQgaXMgYSBmdW5jdGlvblxuICogQHBhcmFtICAgeyAqIH0gdiAtIHdoYXRldmVyIHlvdSB3YW50IHRvIHBhc3MgdG8gdGhpcyBmdW5jdGlvblxuICogQHJldHVybnMgeyBCb29sZWFuIH0gLVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIHR5cGVvZiB2ID09PSBUX0ZVTkNUSU9OIHx8IGZhbHNlICAgLy8gYXZvaWQgSUUgcHJvYmxlbXNcbn1cblxuLyoqXG4gKiBSZW1vdmUgYW55IERPTSBhdHRyaWJ1dGUgZnJvbSBhIG5vZGVcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2Ugd2FudCB0byB1cGRhdGVcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gbmFtZSAtIG5hbWUgb2YgdGhlIHByb3BlcnR5IHdlIHdhbnQgdG8gcmVtb3ZlXG4gKi9cbmZ1bmN0aW9uIHJlbUF0dHIoZG9tLCBuYW1lKSB7XG4gIGRvbS5yZW1vdmVBdHRyaWJ1dGUobmFtZSlcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgc3RyaW5nIGNvbnRhaW5pbmcgZGFzaGVzIHRvIGNhbWVsIGNhc2VcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gc3RyaW5nIC0gaW5wdXQgc3RyaW5nXG4gKiBAcmV0dXJucyB7IFN0cmluZyB9IG15LXN0cmluZyAtPiBteVN0cmluZ1xuICovXG5mdW5jdGlvbiB0b0NhbWVsKHN0cmluZykge1xuICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLy0oXFx3KS9nLCBmdW5jdGlvbihfLCBjKSB7XG4gICAgcmV0dXJuIGMudG9VcHBlckNhc2UoKVxuICB9KVxufVxuXG4vKipcbiAqIEdldCB0aGUgdmFsdWUgb2YgYW55IERPTSBhdHRyaWJ1dGUgb24gYSBub2RlXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IGRvbSAtIERPTSBub2RlIHdlIHdhbnQgdG8gcGFyc2VcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gbmFtZSAtIG5hbWUgb2YgdGhlIGF0dHJpYnV0ZSB3ZSB3YW50IHRvIGdldFxuICogQHJldHVybnMgeyBTdHJpbmcgfCB1bmRlZmluZWQgfSBuYW1lIG9mIHRoZSBub2RlIGF0dHJpYnV0ZSB3aGV0aGVyIGl0IGV4aXN0c1xuICovXG5mdW5jdGlvbiBnZXRBdHRyKGRvbSwgbmFtZSkge1xuICByZXR1cm4gZG9tLmdldEF0dHJpYnV0ZShuYW1lKVxufVxuXG4vKipcbiAqIFNldCBhbnkgRE9NIGF0dHJpYnV0ZVxuICogQHBhcmFtIHsgT2JqZWN0IH0gZG9tIC0gRE9NIG5vZGUgd2Ugd2FudCB0byB1cGRhdGVcbiAqIEBwYXJhbSB7IFN0cmluZyB9IG5hbWUgLSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB3ZSB3YW50IHRvIHNldFxuICogQHBhcmFtIHsgU3RyaW5nIH0gdmFsIC0gdmFsdWUgb2YgdGhlIHByb3BlcnR5IHdlIHdhbnQgdG8gc2V0XG4gKi9cbmZ1bmN0aW9uIHNldEF0dHIoZG9tLCBuYW1lLCB2YWwpIHtcbiAgZG9tLnNldEF0dHJpYnV0ZShuYW1lLCB2YWwpXG59XG5cbi8qKlxuICogRGV0ZWN0IHRoZSB0YWcgaW1wbGVtZW50YXRpb24gYnkgYSBET00gbm9kZVxuICogQHBhcmFtICAgeyBPYmplY3QgfSBkb20gLSBET00gbm9kZSB3ZSBuZWVkIHRvIHBhcnNlIHRvIGdldCBpdHMgdGFnIGltcGxlbWVudGF0aW9uXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IGl0IHJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGltcGxlbWVudGF0aW9uIG9mIGEgY3VzdG9tIHRhZyAodGVtcGxhdGUgYW5kIGJvb3QgZnVuY3Rpb24pXG4gKi9cbmZ1bmN0aW9uIGdldFRhZyhkb20pIHtcbiAgcmV0dXJuIGRvbS50YWdOYW1lICYmIF9fdGFnSW1wbFtnZXRBdHRyKGRvbSwgUklPVF9UQUcpIHx8IGRvbS50YWdOYW1lLnRvTG93ZXJDYXNlKCldXG59XG4vKipcbiAqIEFkZCBhIGNoaWxkIHRhZyB0byBpdHMgcGFyZW50IGludG8gdGhlIGB0YWdzYCBvYmplY3RcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gdGFnIC0gY2hpbGQgdGFnIGluc3RhbmNlXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9IHRhZ05hbWUgLSBrZXkgd2hlcmUgdGhlIG5ldyB0YWcgd2lsbCBiZSBzdG9yZWRcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gcGFyZW50IC0gdGFnIGluc3RhbmNlIHdoZXJlIHRoZSBuZXcgY2hpbGQgdGFnIHdpbGwgYmUgaW5jbHVkZWRcbiAqL1xuZnVuY3Rpb24gYWRkQ2hpbGRUYWcodGFnLCB0YWdOYW1lLCBwYXJlbnQpIHtcbiAgdmFyIGNhY2hlZFRhZyA9IHBhcmVudC50YWdzW3RhZ05hbWVdXG5cbiAgLy8gaWYgdGhlcmUgYXJlIG11bHRpcGxlIGNoaWxkcmVuIHRhZ3MgaGF2aW5nIHRoZSBzYW1lIG5hbWVcbiAgaWYgKGNhY2hlZFRhZykge1xuICAgIC8vIGlmIHRoZSBwYXJlbnQgdGFncyBwcm9wZXJ0eSBpcyBub3QgeWV0IGFuIGFycmF5XG4gICAgLy8gY3JlYXRlIGl0IGFkZGluZyB0aGUgZmlyc3QgY2FjaGVkIHRhZ1xuICAgIGlmICghaXNBcnJheShjYWNoZWRUYWcpKVxuICAgICAgLy8gZG9uJ3QgYWRkIHRoZSBzYW1lIHRhZyB0d2ljZVxuICAgICAgaWYgKGNhY2hlZFRhZyAhPT0gdGFnKVxuICAgICAgICBwYXJlbnQudGFnc1t0YWdOYW1lXSA9IFtjYWNoZWRUYWddXG4gICAgLy8gYWRkIHRoZSBuZXcgbmVzdGVkIHRhZyB0byB0aGUgYXJyYXlcbiAgICBpZiAoIWNvbnRhaW5zKHBhcmVudC50YWdzW3RhZ05hbWVdLCB0YWcpKVxuICAgICAgcGFyZW50LnRhZ3NbdGFnTmFtZV0ucHVzaCh0YWcpXG4gIH0gZWxzZSB7XG4gICAgcGFyZW50LnRhZ3NbdGFnTmFtZV0gPSB0YWdcbiAgfVxufVxuXG4vKipcbiAqIE1vdmUgdGhlIHBvc2l0aW9uIG9mIGEgY3VzdG9tIHRhZyBpbiBpdHMgcGFyZW50IHRhZ1xuICogQHBhcmFtICAgeyBPYmplY3QgfSB0YWcgLSBjaGlsZCB0YWcgaW5zdGFuY2VcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdGFnTmFtZSAtIGtleSB3aGVyZSB0aGUgdGFnIHdhcyBzdG9yZWRcbiAqIEBwYXJhbSAgIHsgTnVtYmVyIH0gbmV3UG9zIC0gaW5kZXggd2hlcmUgdGhlIG5ldyB0YWcgd2lsbCBiZSBzdG9yZWRcbiAqL1xuZnVuY3Rpb24gbW92ZUNoaWxkVGFnKHRhZywgdGFnTmFtZSwgbmV3UG9zKSB7XG4gIHZhciBwYXJlbnQgPSB0YWcucGFyZW50LFxuICAgIHRhZ3NcbiAgLy8gbm8gcGFyZW50IG5vIG1vdmVcbiAgaWYgKCFwYXJlbnQpIHJldHVyblxuXG4gIHRhZ3MgPSBwYXJlbnQudGFnc1t0YWdOYW1lXVxuXG4gIGlmIChpc0FycmF5KHRhZ3MpKVxuICAgIHRhZ3Muc3BsaWNlKG5ld1BvcywgMCwgdGFncy5zcGxpY2UodGFncy5pbmRleE9mKHRhZyksIDEpWzBdKVxuICBlbHNlIGFkZENoaWxkVGFnKHRhZywgdGFnTmFtZSwgcGFyZW50KVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBjaGlsZCB0YWcgaW5jbHVkaW5nIGl0IGNvcnJlY3RseSBpbnRvIGl0cyBwYXJlbnRcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gY2hpbGQgLSBjaGlsZCB0YWcgaW1wbGVtZW50YXRpb25cbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gb3B0cyAtIHRhZyBvcHRpb25zIGNvbnRhaW5pbmcgdGhlIERPTSBub2RlIHdoZXJlIHRoZSB0YWcgd2lsbCBiZSBtb3VudGVkXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9IGlubmVySFRNTCAtIGlubmVyIGh0bWwgb2YgdGhlIGNoaWxkIG5vZGVcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gcGFyZW50IC0gaW5zdGFuY2Ugb2YgdGhlIHBhcmVudCB0YWcgaW5jbHVkaW5nIHRoZSBjaGlsZCBjdXN0b20gdGFnXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IGluc3RhbmNlIG9mIHRoZSBuZXcgY2hpbGQgdGFnIGp1c3QgY3JlYXRlZFxuICovXG5mdW5jdGlvbiBpbml0Q2hpbGRUYWcoY2hpbGQsIG9wdHMsIGlubmVySFRNTCwgcGFyZW50KSB7XG4gIHZhciB0YWcgPSBuZXcgVGFnKGNoaWxkLCBvcHRzLCBpbm5lckhUTUwpLFxuICAgIHRhZ05hbWUgPSBnZXRUYWdOYW1lKG9wdHMucm9vdCksXG4gICAgcHRhZyA9IGdldEltbWVkaWF0ZUN1c3RvbVBhcmVudFRhZyhwYXJlbnQpXG4gIC8vIGZpeCBmb3IgdGhlIHBhcmVudCBhdHRyaWJ1dGUgaW4gdGhlIGxvb3BlZCBlbGVtZW50c1xuICB0YWcucGFyZW50ID0gcHRhZ1xuICAvLyBzdG9yZSB0aGUgcmVhbCBwYXJlbnQgdGFnXG4gIC8vIGluIHNvbWUgY2FzZXMgdGhpcyBjb3VsZCBiZSBkaWZmZXJlbnQgZnJvbSB0aGUgY3VzdG9tIHBhcmVudCB0YWdcbiAgLy8gZm9yIGV4YW1wbGUgaW4gbmVzdGVkIGxvb3BzXG4gIHRhZy5fcGFyZW50ID0gcGFyZW50XG5cbiAgLy8gYWRkIHRoaXMgdGFnIHRvIHRoZSBjdXN0b20gcGFyZW50IHRhZ1xuICBhZGRDaGlsZFRhZyh0YWcsIHRhZ05hbWUsIHB0YWcpXG4gIC8vIGFuZCBhbHNvIHRvIHRoZSByZWFsIHBhcmVudCB0YWdcbiAgaWYgKHB0YWcgIT09IHBhcmVudClcbiAgICBhZGRDaGlsZFRhZyh0YWcsIHRhZ05hbWUsIHBhcmVudClcbiAgLy8gZW1wdHkgdGhlIGNoaWxkIG5vZGUgb25jZSB3ZSBnb3QgaXRzIHRlbXBsYXRlXG4gIC8vIHRvIGF2b2lkIHRoYXQgaXRzIGNoaWxkcmVuIGdldCBjb21waWxlZCBtdWx0aXBsZSB0aW1lc1xuICBvcHRzLnJvb3QuaW5uZXJIVE1MID0gJydcblxuICByZXR1cm4gdGFnXG59XG5cbi8qKlxuICogTG9vcCBiYWNrd2FyZCBhbGwgdGhlIHBhcmVudHMgdHJlZSB0byBkZXRlY3QgdGhlIGZpcnN0IGN1c3RvbSBwYXJlbnQgdGFnXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IHRhZyAtIGEgVGFnIGluc3RhbmNlXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IHRoZSBpbnN0YW5jZSBvZiB0aGUgZmlyc3QgY3VzdG9tIHBhcmVudCB0YWcgZm91bmRcbiAqL1xuZnVuY3Rpb24gZ2V0SW1tZWRpYXRlQ3VzdG9tUGFyZW50VGFnKHRhZykge1xuICB2YXIgcHRhZyA9IHRhZ1xuICB3aGlsZSAoIWdldFRhZyhwdGFnLnJvb3QpKSB7XG4gICAgaWYgKCFwdGFnLnBhcmVudCkgYnJlYWtcbiAgICBwdGFnID0gcHRhZy5wYXJlbnRcbiAgfVxuICByZXR1cm4gcHRhZ1xufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBzZXQgYW4gaW1tdXRhYmxlIHByb3BlcnR5XG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IGVsIC0gb2JqZWN0IHdoZXJlIHRoZSBuZXcgcHJvcGVydHkgd2lsbCBiZSBzZXRcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0ga2V5IC0gb2JqZWN0IGtleSB3aGVyZSB0aGUgbmV3IHByb3BlcnR5IHdpbGwgYmUgc3RvcmVkXG4gKiBAcGFyYW0gICB7ICogfSB2YWx1ZSAtIHZhbHVlIG9mIHRoZSBuZXcgcHJvcGVydHlcbiogQHBhcmFtICAgeyBPYmplY3QgfSBvcHRpb25zIC0gc2V0IHRoZSBwcm9wZXJ5IG92ZXJyaWRpbmcgdGhlIGRlZmF1bHQgb3B0aW9uc1xuICogQHJldHVybnMgeyBPYmplY3QgfSAtIHRoZSBpbml0aWFsIG9iamVjdFxuICovXG5mdW5jdGlvbiBkZWZpbmVQcm9wZXJ0eShlbCwga2V5LCB2YWx1ZSwgb3B0aW9ucykge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWwsIGtleSwgZXh0ZW5kKHtcbiAgICB2YWx1ZTogdmFsdWUsXG4gICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgd3JpdGFibGU6IGZhbHNlLFxuICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgfSwgb3B0aW9ucykpXG4gIHJldHVybiBlbFxufVxuXG4vKipcbiAqIEdldCB0aGUgdGFnIG5hbWUgb2YgYW55IERPTSBub2RlXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IGRvbSAtIERPTSBub2RlIHdlIHdhbnQgdG8gcGFyc2VcbiAqIEByZXR1cm5zIHsgU3RyaW5nIH0gbmFtZSB0byBpZGVudGlmeSB0aGlzIGRvbSBub2RlIGluIHJpb3RcbiAqL1xuZnVuY3Rpb24gZ2V0VGFnTmFtZShkb20pIHtcbiAgdmFyIGNoaWxkID0gZ2V0VGFnKGRvbSksXG4gICAgbmFtZWRUYWcgPSBnZXRBdHRyKGRvbSwgJ25hbWUnKSxcbiAgICB0YWdOYW1lID0gbmFtZWRUYWcgJiYgIXRtcGwuaGFzRXhwcihuYW1lZFRhZykgP1xuICAgICAgICAgICAgICAgIG5hbWVkVGFnIDpcbiAgICAgICAgICAgICAgY2hpbGQgPyBjaGlsZC5uYW1lIDogZG9tLnRhZ05hbWUudG9Mb3dlckNhc2UoKVxuXG4gIHJldHVybiB0YWdOYW1lXG59XG5cbi8qKlxuICogRXh0ZW5kIGFueSBvYmplY3Qgd2l0aCBvdGhlciBwcm9wZXJ0aWVzXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IHNyYyAtIHNvdXJjZSBvYmplY3RcbiAqIEByZXR1cm5zIHsgT2JqZWN0IH0gdGhlIHJlc3VsdGluZyBleHRlbmRlZCBvYmplY3RcbiAqXG4gKiB2YXIgb2JqID0geyBmb286ICdiYXonIH1cbiAqIGV4dGVuZChvYmosIHtiYXI6ICdiYXInLCBmb286ICdiYXInfSlcbiAqIGNvbnNvbGUubG9nKG9iaikgPT4ge2JhcjogJ2JhcicsIGZvbzogJ2Jhcid9XG4gKlxuICovXG5mdW5jdGlvbiBleHRlbmQoc3JjKSB7XG4gIHZhciBvYmosIGFyZ3MgPSBhcmd1bWVudHNcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmdzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKG9iaiA9IGFyZ3NbaV0pIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgdGhpcyBwcm9wZXJ0eSBvZiB0aGUgc291cmNlIG9iamVjdCBjb3VsZCBiZSBvdmVycmlkZGVuXG4gICAgICAgIGlmIChpc1dyaXRhYmxlKHNyYywga2V5KSlcbiAgICAgICAgICBzcmNba2V5XSA9IG9ialtrZXldXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBzcmNcbn1cblxuLyoqXG4gKiBDaGVjayB3aGV0aGVyIGFuIGFycmF5IGNvbnRhaW5zIGFuIGl0ZW1cbiAqIEBwYXJhbSAgIHsgQXJyYXkgfSBhcnIgLSB0YXJnZXQgYXJyYXlcbiAqIEBwYXJhbSAgIHsgKiB9IGl0ZW0gLSBpdGVtIHRvIHRlc3RcbiAqIEByZXR1cm5zIHsgQm9vbGVhbiB9IERvZXMgJ2FycicgY29udGFpbiAnaXRlbSc/XG4gKi9cbmZ1bmN0aW9uIGNvbnRhaW5zKGFyciwgaXRlbSkge1xuICByZXR1cm4gfmFyci5pbmRleE9mKGl0ZW0pXG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciBhbiBvYmplY3QgaXMgYSBraW5kIG9mIGFycmF5XG4gKiBAcGFyYW0gICB7ICogfSBhIC0gYW55dGhpbmdcbiAqIEByZXR1cm5zIHtCb29sZWFufSBpcyAnYScgYW4gYXJyYXk/XG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXkoYSkgeyByZXR1cm4gQXJyYXkuaXNBcnJheShhKSB8fCBhIGluc3RhbmNlb2YgQXJyYXkgfVxuXG4vKipcbiAqIERldGVjdCB3aGV0aGVyIGEgcHJvcGVydHkgb2YgYW4gb2JqZWN0IGNvdWxkIGJlIG92ZXJyaWRkZW5cbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gIG9iaiAtIHNvdXJjZSBvYmplY3RcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gIGtleSAtIG9iamVjdCBwcm9wZXJ0eVxuICogQHJldHVybnMgeyBCb29sZWFuIH0gaXMgdGhpcyBwcm9wZXJ0eSB3cml0YWJsZT9cbiAqL1xuZnVuY3Rpb24gaXNXcml0YWJsZShvYmosIGtleSkge1xuICB2YXIgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwga2V5KVxuICByZXR1cm4gdHlwZW9mIG9ialtrZXldID09PSBUX1VOREVGIHx8IHByb3BzICYmIHByb3BzLndyaXRhYmxlXG59XG5cblxuLyoqXG4gKiBXaXRoIHRoaXMgZnVuY3Rpb24gd2UgYXZvaWQgdGhhdCB0aGUgaW50ZXJuYWwgVGFnIG1ldGhvZHMgZ2V0IG92ZXJyaWRkZW5cbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gZGF0YSAtIG9wdGlvbnMgd2Ugd2FudCB0byB1c2UgdG8gZXh0ZW5kIHRoZSB0YWcgaW5zdGFuY2VcbiAqIEByZXR1cm5zIHsgT2JqZWN0IH0gY2xlYW4gb2JqZWN0IHdpdGhvdXQgY29udGFpbmluZyB0aGUgcmlvdCBpbnRlcm5hbCByZXNlcnZlZCB3b3Jkc1xuICovXG5mdW5jdGlvbiBjbGVhblVwRGF0YShkYXRhKSB7XG4gIGlmICghKGRhdGEgaW5zdGFuY2VvZiBUYWcpICYmICEoZGF0YSAmJiB0eXBlb2YgZGF0YS50cmlnZ2VyID09IFRfRlVOQ1RJT04pKVxuICAgIHJldHVybiBkYXRhXG5cbiAgdmFyIG8gPSB7fVxuICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xuICAgIGlmICghY29udGFpbnMoUkVTRVJWRURfV09SRFNfQkxBQ0tMSVNULCBrZXkpKVxuICAgICAgb1trZXldID0gZGF0YVtrZXldXG4gIH1cbiAgcmV0dXJuIG9cbn1cblxuLyoqXG4gKiBXYWxrIGRvd24gcmVjdXJzaXZlbHkgYWxsIHRoZSBjaGlsZHJlbiB0YWdzIHN0YXJ0aW5nIGRvbSBub2RlXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9ICAgZG9tIC0gc3RhcnRpbmcgbm9kZSB3aGVyZSB3ZSB3aWxsIHN0YXJ0IHRoZSByZWN1cnNpb25cbiAqIEBwYXJhbSAgIHsgRnVuY3Rpb24gfSBmbiAtIGNhbGxiYWNrIHRvIHRyYW5zZm9ybSB0aGUgY2hpbGQgbm9kZSBqdXN0IGZvdW5kXG4gKi9cbmZ1bmN0aW9uIHdhbGsoZG9tLCBmbikge1xuICBpZiAoZG9tKSB7XG4gICAgLy8gc3RvcCB0aGUgcmVjdXJzaW9uXG4gICAgaWYgKGZuKGRvbSkgPT09IGZhbHNlKSByZXR1cm5cbiAgICBlbHNlIHtcbiAgICAgIGRvbSA9IGRvbS5maXJzdENoaWxkXG5cbiAgICAgIHdoaWxlIChkb20pIHtcbiAgICAgICAgd2Fsayhkb20sIGZuKVxuICAgICAgICBkb20gPSBkb20ubmV4dFNpYmxpbmdcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBNaW5pbWl6ZSByaXNrOiBvbmx5IHplcm8gb3Igb25lIF9zcGFjZV8gYmV0d2VlbiBhdHRyICYgdmFsdWVcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gICBodG1sIC0gaHRtbCBzdHJpbmcgd2Ugd2FudCB0byBwYXJzZVxuICogQHBhcmFtICAgeyBGdW5jdGlvbiB9IGZuIC0gY2FsbGJhY2sgZnVuY3Rpb24gdG8gYXBwbHkgb24gYW55IGF0dHJpYnV0ZSBmb3VuZFxuICovXG5mdW5jdGlvbiB3YWxrQXR0cmlidXRlcyhodG1sLCBmbikge1xuICB2YXIgbSxcbiAgICByZSA9IC8oWy1cXHddKykgPz0gPyg/OlwiKFteXCJdKil8JyhbXiddKil8KHtbXn1dKn0pKS9nXG5cbiAgd2hpbGUgKG0gPSByZS5leGVjKGh0bWwpKSB7XG4gICAgZm4obVsxXS50b0xvd2VyQ2FzZSgpLCBtWzJdIHx8IG1bM10gfHwgbVs0XSlcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgYSBET00gbm9kZSBpcyBpbiBzdHViIG1vZGUsIHVzZWZ1bCBmb3IgdGhlIHJpb3QgJ2lmJyBkaXJlY3RpdmVcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gIGRvbSAtIERPTSBub2RlIHdlIHdhbnQgdG8gcGFyc2VcbiAqIEByZXR1cm5zIHsgQm9vbGVhbiB9IC1cbiAqL1xuZnVuY3Rpb24gaXNJblN0dWIoZG9tKSB7XG4gIHdoaWxlIChkb20pIHtcbiAgICBpZiAoZG9tLmluU3R1YikgcmV0dXJuIHRydWVcbiAgICBkb20gPSBkb20ucGFyZW50Tm9kZVxuICB9XG4gIHJldHVybiBmYWxzZVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIGdlbmVyaWMgRE9NIG5vZGVcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gbmFtZSAtIG5hbWUgb2YgdGhlIERPTSBub2RlIHdlIHdhbnQgdG8gY3JlYXRlXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IERPTSBub2RlIGp1c3QgY3JlYXRlZFxuICovXG5mdW5jdGlvbiBta0VsKG5hbWUpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSlcbn1cblxuLyoqXG4gKiBTaG9ydGVyIGFuZCBmYXN0IHdheSB0byBzZWxlY3QgbXVsdGlwbGUgbm9kZXMgaW4gdGhlIERPTVxuICogQHBhcmFtICAgeyBTdHJpbmcgfSBzZWxlY3RvciAtIERPTSBzZWxlY3RvclxuICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBET00gbm9kZSB3aGVyZSB0aGUgdGFyZ2V0cyBvZiBvdXIgc2VhcmNoIHdpbGwgaXMgbG9jYXRlZFxuICogQHJldHVybnMgeyBPYmplY3QgfSBkb20gbm9kZXMgZm91bmRcbiAqL1xuZnVuY3Rpb24gJCQoc2VsZWN0b3IsIGN0eCkge1xuICByZXR1cm4gKGN0eCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcilcbn1cblxuLyoqXG4gKiBTaG9ydGVyIGFuZCBmYXN0IHdheSB0byBzZWxlY3QgYSBzaW5nbGUgbm9kZSBpbiB0aGUgRE9NXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9IHNlbGVjdG9yIC0gdW5pcXVlIGRvbSBzZWxlY3RvclxuICogQHBhcmFtICAgeyBPYmplY3QgfSBjdHggLSBET00gbm9kZSB3aGVyZSB0aGUgdGFyZ2V0IG9mIG91ciBzZWFyY2ggd2lsbCBpcyBsb2NhdGVkXG4gKiBAcmV0dXJucyB7IE9iamVjdCB9IGRvbSBub2RlIGZvdW5kXG4gKi9cbmZ1bmN0aW9uICQoc2VsZWN0b3IsIGN0eCkge1xuICByZXR1cm4gKGN0eCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvcihzZWxlY3Rvcilcbn1cblxuLyoqXG4gKiBTaW1wbGUgb2JqZWN0IHByb3RvdHlwYWwgaW5oZXJpdGFuY2VcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gcGFyZW50IC0gcGFyZW50IG9iamVjdFxuICogQHJldHVybnMgeyBPYmplY3QgfSBjaGlsZCBpbnN0YW5jZVxuICovXG5mdW5jdGlvbiBpbmhlcml0KHBhcmVudCkge1xuICBmdW5jdGlvbiBDaGlsZCgpIHt9XG4gIENoaWxkLnByb3RvdHlwZSA9IHBhcmVudFxuICByZXR1cm4gbmV3IENoaWxkKClcbn1cblxuLyoqXG4gKiBHZXQgdGhlIG5hbWUgcHJvcGVydHkgbmVlZGVkIHRvIGlkZW50aWZ5IGEgRE9NIG5vZGUgaW4gcmlvdFxuICogQHBhcmFtICAgeyBPYmplY3QgfSBkb20gLSBET00gbm9kZSB3ZSBuZWVkIHRvIHBhcnNlXG4gKiBAcmV0dXJucyB7IFN0cmluZyB8IHVuZGVmaW5lZCB9IGdpdmUgdXMgYmFjayBhIHN0cmluZyB0byBpZGVudGlmeSB0aGlzIGRvbSBub2RlXG4gKi9cbmZ1bmN0aW9uIGdldE5hbWVkS2V5KGRvbSkge1xuICByZXR1cm4gZ2V0QXR0cihkb20sICdpZCcpIHx8IGdldEF0dHIoZG9tLCAnbmFtZScpXG59XG5cbi8qKlxuICogU2V0IHRoZSBuYW1lZCBwcm9wZXJ0aWVzIG9mIGEgdGFnIGVsZW1lbnRcbiAqIEBwYXJhbSB7IE9iamVjdCB9IGRvbSAtIERPTSBub2RlIHdlIG5lZWQgdG8gcGFyc2VcbiAqIEBwYXJhbSB7IE9iamVjdCB9IHBhcmVudCAtIHRhZyBpbnN0YW5jZSB3aGVyZSB0aGUgbmFtZWQgZG9tIGVsZW1lbnQgd2lsbCBiZSBldmVudHVhbGx5IGFkZGVkXG4gKiBAcGFyYW0geyBBcnJheSB9IGtleXMgLSBsaXN0IG9mIGFsbCB0aGUgdGFnIGluc3RhbmNlIHByb3BlcnRpZXNcbiAqL1xuZnVuY3Rpb24gc2V0TmFtZWQoZG9tLCBwYXJlbnQsIGtleXMpIHtcbiAgLy8gZ2V0IHRoZSBrZXkgdmFsdWUgd2Ugd2FudCB0byBhZGQgdG8gdGhlIHRhZyBpbnN0YW5jZVxuICB2YXIga2V5ID0gZ2V0TmFtZWRLZXkoZG9tKSxcbiAgICBpc0FycixcbiAgICAvLyBhZGQgdGhlIG5vZGUgZGV0ZWN0ZWQgdG8gYSB0YWcgaW5zdGFuY2UgdXNpbmcgdGhlIG5hbWVkIHByb3BlcnR5XG4gICAgYWRkID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIC8vIGF2b2lkIHRvIG92ZXJyaWRlIHRoZSB0YWcgcHJvcGVydGllcyBhbHJlYWR5IHNldFxuICAgICAgaWYgKGNvbnRhaW5zKGtleXMsIGtleSkpIHJldHVyblxuICAgICAgLy8gY2hlY2sgd2hldGhlciB0aGlzIHZhbHVlIGlzIGFuIGFycmF5XG4gICAgICBpc0FyciA9IGlzQXJyYXkodmFsdWUpXG4gICAgICAvLyBpZiB0aGUga2V5IHdhcyBuZXZlciBzZXRcbiAgICAgIGlmICghdmFsdWUpXG4gICAgICAgIC8vIHNldCBpdCBvbmNlIG9uIHRoZSB0YWcgaW5zdGFuY2VcbiAgICAgICAgcGFyZW50W2tleV0gPSBkb21cbiAgICAgIC8vIGlmIGl0IHdhcyBhbiBhcnJheSBhbmQgbm90IHlldCBzZXRcbiAgICAgIGVsc2UgaWYgKCFpc0FyciB8fCBpc0FyciAmJiAhY29udGFpbnModmFsdWUsIGRvbSkpIHtcbiAgICAgICAgLy8gYWRkIHRoZSBkb20gbm9kZSBpbnRvIHRoZSBhcnJheVxuICAgICAgICBpZiAoaXNBcnIpXG4gICAgICAgICAgdmFsdWUucHVzaChkb20pXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBwYXJlbnRba2V5XSA9IFt2YWx1ZSwgZG9tXVxuICAgICAgfVxuICAgIH1cblxuICAvLyBza2lwIHRoZSBlbGVtZW50cyB3aXRoIG5vIG5hbWVkIHByb3BlcnRpZXNcbiAgaWYgKCFrZXkpIHJldHVyblxuXG4gIC8vIGNoZWNrIHdoZXRoZXIgdGhpcyBrZXkgaGFzIGJlZW4gYWxyZWFkeSBldmFsdWF0ZWRcbiAgaWYgKHRtcGwuaGFzRXhwcihrZXkpKVxuICAgIC8vIHdhaXQgdGhlIGZpcnN0IHVwZGF0ZWQgZXZlbnQgb25seSBvbmNlXG4gICAgcGFyZW50Lm9uZSgnbW91bnQnLCBmdW5jdGlvbigpIHtcbiAgICAgIGtleSA9IGdldE5hbWVkS2V5KGRvbSlcbiAgICAgIGFkZChwYXJlbnRba2V5XSlcbiAgICB9KVxuICBlbHNlXG4gICAgYWRkKHBhcmVudFtrZXldKVxuXG59XG5cbi8qKlxuICogRmFzdGVyIFN0cmluZyBzdGFydHNXaXRoIGFsdGVybmF0aXZlXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9IHNyYyAtIHNvdXJjZSBzdHJpbmdcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gc3RyIC0gdGVzdCBzdHJpbmdcbiAqIEByZXR1cm5zIHsgQm9vbGVhbiB9IC1cbiAqL1xuZnVuY3Rpb24gc3RhcnRzV2l0aChzcmMsIHN0cikge1xuICByZXR1cm4gc3JjLnNsaWNlKDAsIHN0ci5sZW5ndGgpID09PSBzdHJcbn1cblxuLyoqXG4gKiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgZnVuY3Rpb25cbiAqIEFkYXB0ZWQgZnJvbSBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvMTU3OTY3MSwgbGljZW5zZSBNSVRcbiAqL1xudmFyIHJBRiA9IChmdW5jdGlvbiAodykge1xuICB2YXIgcmFmID0gdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgICAgfHxcbiAgICAgICAgICAgIHcubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IHcud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lXG5cbiAgaWYgKCFyYWYgfHwgL2lQKGFkfGhvbmV8b2QpLipPUyA2Ly50ZXN0KHcubmF2aWdhdG9yLnVzZXJBZ2VudCkpIHsgIC8vIGJ1Z2d5IGlPUzZcbiAgICB2YXIgbGFzdFRpbWUgPSAwXG5cbiAgICByYWYgPSBmdW5jdGlvbiAoY2IpIHtcbiAgICAgIHZhciBub3d0aW1lID0gRGF0ZS5ub3coKSwgdGltZW91dCA9IE1hdGgubWF4KDE2IC0gKG5vd3RpbWUgLSBsYXN0VGltZSksIDApXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgY2IobGFzdFRpbWUgPSBub3d0aW1lICsgdGltZW91dCkgfSwgdGltZW91dClcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJhZlxuXG59KSh3aW5kb3cgfHwge30pXG5cbi8qKlxuICogTW91bnQgYSB0YWcgY3JlYXRpbmcgbmV3IFRhZyBpbnN0YW5jZVxuICogQHBhcmFtICAgeyBPYmplY3QgfSByb290IC0gZG9tIG5vZGUgd2hlcmUgdGhlIHRhZyB3aWxsIGJlIG1vdW50ZWRcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdGFnTmFtZSAtIG5hbWUgb2YgdGhlIHJpb3QgdGFnIHdlIHdhbnQgdG8gbW91bnRcbiAqIEBwYXJhbSAgIHsgT2JqZWN0IH0gb3B0cyAtIG9wdGlvbnMgdG8gcGFzcyB0byB0aGUgVGFnIGluc3RhbmNlXG4gKiBAcmV0dXJucyB7IFRhZyB9IGEgbmV3IFRhZyBpbnN0YW5jZVxuICovXG5mdW5jdGlvbiBtb3VudFRvKHJvb3QsIHRhZ05hbWUsIG9wdHMpIHtcbiAgdmFyIHRhZyA9IF9fdGFnSW1wbFt0YWdOYW1lXSxcbiAgICAvLyBjYWNoZSB0aGUgaW5uZXIgSFRNTCB0byBmaXggIzg1NVxuICAgIGlubmVySFRNTCA9IHJvb3QuX2lubmVySFRNTCA9IHJvb3QuX2lubmVySFRNTCB8fCByb290LmlubmVySFRNTFxuXG4gIC8vIGNsZWFyIHRoZSBpbm5lciBodG1sXG4gIHJvb3QuaW5uZXJIVE1MID0gJydcblxuICBpZiAodGFnICYmIHJvb3QpIHRhZyA9IG5ldyBUYWcodGFnLCB7IHJvb3Q6IHJvb3QsIG9wdHM6IG9wdHMgfSwgaW5uZXJIVE1MKVxuXG4gIGlmICh0YWcgJiYgdGFnLm1vdW50KSB7XG4gICAgdGFnLm1vdW50KClcbiAgICAvLyBhZGQgdGhpcyB0YWcgdG8gdGhlIHZpcnR1YWxEb20gdmFyaWFibGVcbiAgICBpZiAoIWNvbnRhaW5zKF9fdmlydHVhbERvbSwgdGFnKSkgX192aXJ0dWFsRG9tLnB1c2godGFnKVxuICB9XG5cbiAgcmV0dXJuIHRhZ1xufVxuLyoqXG4gKiBSaW90IHB1YmxpYyBhcGlcbiAqL1xuXG4vLyBzaGFyZSBtZXRob2RzIGZvciBvdGhlciByaW90IHBhcnRzLCBlLmcuIGNvbXBpbGVyXG5yaW90LnV0aWwgPSB7IGJyYWNrZXRzOiBicmFja2V0cywgdG1wbDogdG1wbCB9XG5cbi8qKlxuICogQ3JlYXRlIGEgbWl4aW4gdGhhdCBjb3VsZCBiZSBnbG9iYWxseSBzaGFyZWQgYWNyb3NzIGFsbCB0aGUgdGFnc1xuICovXG5yaW90Lm1peGluID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgbWl4aW5zID0ge31cblxuICAvKipcbiAgICogQ3JlYXRlL1JldHVybiBhIG1peGluIGJ5IGl0cyBuYW1lXG4gICAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gbmFtZSAtIG1peGluIG5hbWVcbiAgICogQHBhcmFtICAgeyBPYmplY3QgfSBtaXhpbiAtIG1peGluIGxvZ2ljXG4gICAqIEByZXR1cm5zIHsgT2JqZWN0IH0gdGhlIG1peGluIGxvZ2ljXG4gICAqL1xuICByZXR1cm4gZnVuY3Rpb24obmFtZSwgbWl4aW4pIHtcbiAgICBpZiAoIW1peGluKSByZXR1cm4gbWl4aW5zW25hbWVdXG4gICAgbWl4aW5zW25hbWVdID0gbWl4aW5cbiAgfVxuXG59KSgpXG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IHJpb3QgdGFnIGltcGxlbWVudGF0aW9uXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9ICAgbmFtZSAtIG5hbWUvaWQgb2YgdGhlIG5ldyByaW90IHRhZ1xuICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIGh0bWwgLSB0YWcgdGVtcGxhdGVcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gICBjc3MgLSBjdXN0b20gdGFnIGNzc1xuICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIGF0dHJzIC0gcm9vdCB0YWcgYXR0cmlidXRlc1xuICogQHBhcmFtICAgeyBGdW5jdGlvbiB9IGZuIC0gdXNlciBmdW5jdGlvblxuICogQHJldHVybnMgeyBTdHJpbmcgfSBuYW1lL2lkIG9mIHRoZSB0YWcganVzdCBjcmVhdGVkXG4gKi9cbnJpb3QudGFnID0gZnVuY3Rpb24obmFtZSwgaHRtbCwgY3NzLCBhdHRycywgZm4pIHtcbiAgaWYgKGlzRnVuY3Rpb24oYXR0cnMpKSB7XG4gICAgZm4gPSBhdHRyc1xuICAgIGlmICgvXltcXHdcXC1dK1xccz89Ly50ZXN0KGNzcykpIHtcbiAgICAgIGF0dHJzID0gY3NzXG4gICAgICBjc3MgPSAnJ1xuICAgIH0gZWxzZSBhdHRycyA9ICcnXG4gIH1cbiAgaWYgKGNzcykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNzcykpIGZuID0gY3NzXG4gICAgZWxzZSBzdHlsZU1hbmFnZXIuYWRkKGNzcylcbiAgfVxuICBfX3RhZ0ltcGxbbmFtZV0gPSB7IG5hbWU6IG5hbWUsIHRtcGw6IGh0bWwsIGF0dHJzOiBhdHRycywgZm46IGZuIH1cbiAgcmV0dXJuIG5hbWVcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgcmlvdCB0YWcgaW1wbGVtZW50YXRpb24gKGZvciB1c2UgYnkgdGhlIGNvbXBpbGVyKVxuICogQHBhcmFtICAgeyBTdHJpbmcgfSAgIG5hbWUgLSBuYW1lL2lkIG9mIHRoZSBuZXcgcmlvdCB0YWdcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gICBodG1sIC0gdGFnIHRlbXBsYXRlXG4gKiBAcGFyYW0gICB7IFN0cmluZyB9ICAgY3NzIC0gY3VzdG9tIHRhZyBjc3NcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gICBhdHRycyAtIHJvb3QgdGFnIGF0dHJpYnV0ZXNcbiAqIEBwYXJhbSAgIHsgRnVuY3Rpb24gfSBmbiAtIHVzZXIgZnVuY3Rpb25cbiAqIEBwYXJhbSAgIHsgc3RyaW5nIH0gIFticGFpcl0gLSBicmFja2V0cyB1c2VkIGluIHRoZSBjb21waWxhdGlvblxuICogQHJldHVybnMgeyBTdHJpbmcgfSBuYW1lL2lkIG9mIHRoZSB0YWcganVzdCBjcmVhdGVkXG4gKi9cbnJpb3QudGFnMiA9IGZ1bmN0aW9uKG5hbWUsIGh0bWwsIGNzcywgYXR0cnMsIGZuLCBicGFpcikge1xuICBpZiAoY3NzKSBzdHlsZU1hbmFnZXIuYWRkKGNzcylcbiAgLy9pZiAoYnBhaXIpIHJpb3Quc2V0dGluZ3MuYnJhY2tldHMgPSBicGFpclxuICBfX3RhZ0ltcGxbbmFtZV0gPSB7IG5hbWU6IG5hbWUsIHRtcGw6IGh0bWwsIGF0dHJzOiBhdHRycywgZm46IGZuIH1cbiAgcmV0dXJuIG5hbWVcbn1cblxuLyoqXG4gKiBNb3VudCBhIHRhZyB1c2luZyBhIHNwZWNpZmljIHRhZyBpbXBsZW1lbnRhdGlvblxuICogQHBhcmFtICAgeyBTdHJpbmcgfSBzZWxlY3RvciAtIHRhZyBET00gc2VsZWN0b3JcbiAqIEBwYXJhbSAgIHsgU3RyaW5nIH0gdGFnTmFtZSAtIHRhZyBpbXBsZW1lbnRhdGlvbiBuYW1lXG4gKiBAcGFyYW0gICB7IE9iamVjdCB9IG9wdHMgLSB0YWcgbG9naWNcbiAqIEByZXR1cm5zIHsgQXJyYXkgfSBuZXcgdGFncyBpbnN0YW5jZXNcbiAqL1xucmlvdC5tb3VudCA9IGZ1bmN0aW9uKHNlbGVjdG9yLCB0YWdOYW1lLCBvcHRzKSB7XG5cbiAgdmFyIGVscyxcbiAgICBhbGxUYWdzLFxuICAgIHRhZ3MgPSBbXVxuXG4gIC8vIGhlbHBlciBmdW5jdGlvbnNcblxuICBmdW5jdGlvbiBhZGRSaW90VGFncyhhcnIpIHtcbiAgICB2YXIgbGlzdCA9ICcnXG4gICAgZWFjaChhcnIsIGZ1bmN0aW9uIChlKSB7XG4gICAgICBpZiAoIS9bXi1cXHddLy50ZXN0KGUpKVxuICAgICAgICBsaXN0ICs9ICcsKlsnICsgUklPVF9UQUcgKyAnPScgKyBlLnRyaW0oKSArICddJ1xuICAgIH0pXG4gICAgcmV0dXJuIGxpc3RcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGVjdEFsbFRhZ3MoKSB7XG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhfX3RhZ0ltcGwpXG4gICAgcmV0dXJuIGtleXMgKyBhZGRSaW90VGFncyhrZXlzKVxuICB9XG5cbiAgZnVuY3Rpb24gcHVzaFRhZ3Mocm9vdCkge1xuICAgIHZhciBsYXN0XG5cbiAgICBpZiAocm9vdC50YWdOYW1lKSB7XG4gICAgICBpZiAodGFnTmFtZSAmJiAoIShsYXN0ID0gZ2V0QXR0cihyb290LCBSSU9UX1RBRykpIHx8IGxhc3QgIT0gdGFnTmFtZSkpXG4gICAgICAgIHNldEF0dHIocm9vdCwgUklPVF9UQUcsIHRhZ05hbWUpXG5cbiAgICAgIHZhciB0YWcgPSBtb3VudFRvKHJvb3QsIHRhZ05hbWUgfHwgcm9vdC5nZXRBdHRyaWJ1dGUoUklPVF9UQUcpIHx8IHJvb3QudGFnTmFtZS50b0xvd2VyQ2FzZSgpLCBvcHRzKVxuXG4gICAgICBpZiAodGFnKSB0YWdzLnB1c2godGFnKVxuICAgIH0gZWxzZSBpZiAocm9vdC5sZW5ndGgpXG4gICAgICBlYWNoKHJvb3QsIHB1c2hUYWdzKSAgIC8vIGFzc3VtZSBub2RlTGlzdFxuXG4gIH1cblxuICAvLyAtLS0tLSBtb3VudCBjb2RlIC0tLS0tXG5cbiAgLy8gaW5qZWN0IHN0eWxlcyBpbnRvIERPTVxuICBzdHlsZU1hbmFnZXIuaW5qZWN0KClcblxuICBpZiAodHlwZW9mIHRhZ05hbWUgPT09IFRfT0JKRUNUKSB7XG4gICAgb3B0cyA9IHRhZ05hbWVcbiAgICB0YWdOYW1lID0gMFxuICB9XG5cbiAgLy8gY3Jhd2wgdGhlIERPTSB0byBmaW5kIHRoZSB0YWdcbiAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gVF9TVFJJTkcpIHtcbiAgICBpZiAoc2VsZWN0b3IgPT09ICcqJylcbiAgICAgIC8vIHNlbGVjdCBhbGwgdGhlIHRhZ3MgcmVnaXN0ZXJlZFxuICAgICAgLy8gYW5kIGFsc28gdGhlIHRhZ3MgZm91bmQgd2l0aCB0aGUgcmlvdC10YWcgYXR0cmlidXRlIHNldFxuICAgICAgc2VsZWN0b3IgPSBhbGxUYWdzID0gc2VsZWN0QWxsVGFncygpXG4gICAgZWxzZVxuICAgICAgLy8gb3IganVzdCB0aGUgb25lcyBuYW1lZCBsaWtlIHRoZSBzZWxlY3RvclxuICAgICAgc2VsZWN0b3IgKz0gYWRkUmlvdFRhZ3Moc2VsZWN0b3Iuc3BsaXQoJywnKSlcblxuICAgIC8vIG1ha2Ugc3VyZSB0byBwYXNzIGFsd2F5cyBhIHNlbGVjdG9yXG4gICAgLy8gdG8gdGhlIHF1ZXJ5U2VsZWN0b3JBbGwgZnVuY3Rpb25cbiAgICBlbHMgPSBzZWxlY3RvciA/ICQkKHNlbGVjdG9yKSA6IFtdXG4gIH1cbiAgZWxzZVxuICAgIC8vIHByb2JhYmx5IHlvdSBoYXZlIHBhc3NlZCBhbHJlYWR5IGEgdGFnIG9yIGEgTm9kZUxpc3RcbiAgICBlbHMgPSBzZWxlY3RvclxuXG4gIC8vIHNlbGVjdCBhbGwgdGhlIHJlZ2lzdGVyZWQgYW5kIG1vdW50IHRoZW0gaW5zaWRlIHRoZWlyIHJvb3QgZWxlbWVudHNcbiAgaWYgKHRhZ05hbWUgPT09ICcqJykge1xuICAgIC8vIGdldCBhbGwgY3VzdG9tIHRhZ3NcbiAgICB0YWdOYW1lID0gYWxsVGFncyB8fCBzZWxlY3RBbGxUYWdzKClcbiAgICAvLyBpZiB0aGUgcm9vdCBlbHMgaXQncyBqdXN0IGEgc2luZ2xlIHRhZ1xuICAgIGlmIChlbHMudGFnTmFtZSlcbiAgICAgIGVscyA9ICQkKHRhZ05hbWUsIGVscylcbiAgICBlbHNlIHtcbiAgICAgIC8vIHNlbGVjdCBhbGwgdGhlIGNoaWxkcmVuIGZvciBhbGwgdGhlIGRpZmZlcmVudCByb290IGVsZW1lbnRzXG4gICAgICB2YXIgbm9kZUxpc3QgPSBbXVxuICAgICAgZWFjaChlbHMsIGZ1bmN0aW9uIChfZWwpIHtcbiAgICAgICAgbm9kZUxpc3QucHVzaCgkJCh0YWdOYW1lLCBfZWwpKVxuICAgICAgfSlcbiAgICAgIGVscyA9IG5vZGVMaXN0XG4gICAgfVxuICAgIC8vIGdldCByaWQgb2YgdGhlIHRhZ05hbWVcbiAgICB0YWdOYW1lID0gMFxuICB9XG5cbiAgaWYgKGVscy50YWdOYW1lKVxuICAgIHB1c2hUYWdzKGVscylcbiAgZWxzZVxuICAgIGVhY2goZWxzLCBwdXNoVGFncylcblxuICByZXR1cm4gdGFnc1xufVxuXG4vKipcbiAqIFVwZGF0ZSBhbGwgdGhlIHRhZ3MgaW5zdGFuY2VzIGNyZWF0ZWRcbiAqIEByZXR1cm5zIHsgQXJyYXkgfSBhbGwgdGhlIHRhZ3MgaW5zdGFuY2VzXG4gKi9cbnJpb3QudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBlYWNoKF9fdmlydHVhbERvbSwgZnVuY3Rpb24odGFnKSB7XG4gICAgdGFnLnVwZGF0ZSgpXG4gIH0pXG59XG5cbi8qKlxuICogRXhwb3J0IHRoZSBUYWcgY29uc3RydWN0b3JcbiAqL1xucmlvdC5UYWcgPSBUYWdcbiAgLy8gc3VwcG9ydCBDb21tb25KUywgQU1EICYgYnJvd3NlclxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFRfT0JKRUNUKVxuICAgIG1vZHVsZS5leHBvcnRzID0gcmlvdFxuICBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBUX0ZVTkNUSU9OICYmIHR5cGVvZiBkZWZpbmUuYW1kICE9PSBUX1VOREVGKVxuICAgIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIHJpb3QgfSlcbiAgZWxzZVxuICAgIHdpbmRvdy5yaW90ID0gcmlvdFxuXG59KSh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnID8gd2luZG93IDogdm9pZCAwKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF9nZXQgPSBmdW5jdGlvbiBnZXQoX3gsIF94MiwgX3gzKSB7IHZhciBfYWdhaW4gPSB0cnVlOyBfZnVuY3Rpb246IHdoaWxlIChfYWdhaW4pIHsgdmFyIG9iamVjdCA9IF94LCBwcm9wZXJ0eSA9IF94MiwgcmVjZWl2ZXIgPSBfeDM7IF9hZ2FpbiA9IGZhbHNlOyBpZiAob2JqZWN0ID09PSBudWxsKSBvYmplY3QgPSBGdW5jdGlvbi5wcm90b3R5cGU7IHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIHByb3BlcnR5KTsgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgeyB2YXIgcGFyZW50ID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iamVjdCk7IGlmIChwYXJlbnQgPT09IG51bGwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSBlbHNlIHsgX3ggPSBwYXJlbnQ7IF94MiA9IHByb3BlcnR5OyBfeDMgPSByZWNlaXZlcjsgX2FnYWluID0gdHJ1ZTsgZGVzYyA9IHBhcmVudCA9IHVuZGVmaW5lZDsgY29udGludWUgX2Z1bmN0aW9uOyB9IH0gZWxzZSBpZiAoJ3ZhbHVlJyBpbiBkZXNjKSB7IHJldHVybiBkZXNjLnZhbHVlOyB9IGVsc2UgeyB2YXIgZ2V0dGVyID0gZGVzYy5nZXQ7IGlmIChnZXR0ZXIgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IHJldHVybiBnZXR0ZXIuY2FsbChyZWNlaXZlcik7IH0gfSB9O1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG5mdW5jdGlvbiBfaW5oZXJpdHMoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHsgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSAnZnVuY3Rpb24nICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCAnICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzczsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuO1xuKGZ1bmN0aW9uICgpIHtcbiAgaWYgKCF3aW5kb3cucmcpIHdpbmRvdy5yZyA9IHt9O1xuICByZy5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCc7XG4gIH07XG4gIHJnLmlzRGVmaW5lZCA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCAhPT0gJ3VuZGVmaW5lZCc7XG4gIH07XG4gIHJnLmlzQm9vbGVhbiA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ2Jvb2xlYW4nO1xuICB9O1xuICByZy5pc09iamVjdCA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdmFsICE9PSBudWxsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnO1xuICB9O1xuICByZy5pc1N0cmluZyA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZyc7XG4gIH07XG4gIHJnLmlzTnVtYmVyID0gZnVuY3Rpb24gKHZhbCkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSBcIm51bWJlclwiICYmICFpc05hTih2YWwpO1xuICB9O1xuICByZy5pc0RhdGUgPSBmdW5jdGlvbiAodmFsKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xuICB9O1xuICByZy5pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbiAgcmcuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJztcbiAgfTtcbiAgcmcuaXNSZWdFeHAgPSBmdW5jdGlvbiAodmFsKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG4gIH07XG4gIHJnLmlzUHJvbWlzZSA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdmFsICYmIGlzRnVuY3Rpb24odmFsLnRoZW4pO1xuICB9O1xuICByZy50b0Jvb2xlYW4gPSBmdW5jdGlvbiAodmFsKSB7XG4gICAgcmV0dXJuIHZhbCA9PSAndHJ1ZScgfHwgdmFsID09IHRydWU7XG4gIH07XG4gIHJnLnRvTnVtYmVyID0gZnVuY3Rpb24gKHZhbCkge1xuICAgIHZhbCA9IE51bWJlcih2YWwpO1xuICAgIHJldHVybiByZy5pc051bWJlcih2YWwpID8gdmFsIDogMDtcbiAgfTtcbiAgdmFyIHVpZCA9IDA7XG4gIHJnLnVpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdWlkKys7XG4gIH07XG4gIHJnLnhociA9IGZ1bmN0aW9uIChtZXRob2QsIHNyYywgb25sb2FkKSB7XG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcS5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbihvbmxvYWQpKSBvbmxvYWQocmVxLnJlc3BvbnNlVGV4dCk7XG4gICAgfTtcbiAgICByZXEub3BlbihtZXRob2QsIHNyYywgdHJ1ZSk7XG4gICAgcmVxLnNlbmQoKTtcbiAgfTtcbn0pKCk7XG4vKlxualF1ZXJ5IENyZWRpdCBDYXJkIFZhbGlkYXRvciAxLjBcblxuQ29weXJpZ2h0IDIwMTItMjAxNSBQYXdlbCBEZWNvd3NraVxuXG5QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG5vZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG5pbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG50byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG5jb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmVcbmlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG5UaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG5PUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcbkZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMXG5USEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUlxuTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcbk9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1NcbklOIFRIRSBTT0ZUV0FSRS5cbiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVDcmVkaXRDYXJkKGlucHV0KSB7XG4gICAgdmFyIF9faW5kZXhPZiA9IFtdLmluZGV4T2YgfHwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgaWYgKGkgaW4gdGhpcyAmJiB0aGlzW2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICAgIH1yZXR1cm4gLTE7XG4gICAgfTtcbiAgICB2YXIgYmluZCwgY2FyZCwgY2FyZF90eXBlLCBjYXJkX3R5cGVzLCBnZXRfY2FyZF90eXBlLCBpc192YWxpZF9sZW5ndGgsIGlzX3ZhbGlkX2x1aG4sIG5vcm1hbGl6ZSwgdmFsaWRhdGUsIHZhbGlkYXRlX251bWJlciwgX2ksIF9sZW4sIF9yZWY7XG4gICAgY2FyZF90eXBlcyA9IFt7XG4gICAgICBuYW1lOiAnYW1leCcsXG4gICAgICBpY29uOiAnaW1hZ2VzL2FtZXgucG5nJyxcbiAgICAgIHBhdHRlcm46IC9eM1s0N10vLFxuICAgICAgdmFsaWRfbGVuZ3RoOiBbMTVdXG4gICAgfSwge1xuICAgICAgbmFtZTogJ2RpbmVyc19jbHViJyxcbiAgICAgIGljb246ICdpbWFnZXMvZGluZXJzX2NsdWIucG5nJyxcbiAgICAgIHBhdHRlcm46IC9eMzBbMC01XS8sXG4gICAgICB2YWxpZF9sZW5ndGg6IFsxNF1cbiAgICB9LCB7XG4gICAgICBuYW1lOiAnZGluZXJzX2NsdWInLFxuICAgICAgaWNvbjogJ2ltYWdlcy9kaW5lcnNfY2x1Yi5wbmcnLFxuICAgICAgcGF0dGVybjogL14zNi8sXG4gICAgICB2YWxpZF9sZW5ndGg6IFsxNF1cbiAgICB9LCB7XG4gICAgICBuYW1lOiAnamNiJyxcbiAgICAgIGljb246ICdpbWFnZXMvamNiLnBuZycsXG4gICAgICBwYXR0ZXJuOiAvXjM1KDJbODldfFszLThdWzAtOV0pLyxcbiAgICAgIHZhbGlkX2xlbmd0aDogWzE2XVxuICAgIH0sIHtcbiAgICAgIG5hbWU6ICdsYXNlcicsXG4gICAgICBwYXR0ZXJuOiAvXig2MzA0fDY3MFs2OV18Njc3MSkvLFxuICAgICAgdmFsaWRfbGVuZ3RoOiBbMTYsIDE3LCAxOCwgMTldXG4gICAgfSwge1xuICAgICAgbmFtZTogJ3Zpc2FfZWxlY3Ryb24nLFxuICAgICAgcGF0dGVybjogL14oNDAyNnw0MTc1MDB8NDUwOHw0ODQ0fDQ5MSgzfDcpKS8sXG4gICAgICB2YWxpZF9sZW5ndGg6IFsxNl1cbiAgICB9LCB7XG4gICAgICBuYW1lOiAndmlzYScsXG4gICAgICBpY29uOiAnaW1hZ2VzL3Zpc2EucG5nJyxcbiAgICAgIHBhdHRlcm46IC9eNC8sXG4gICAgICB2YWxpZF9sZW5ndGg6IFsxNl1cbiAgICB9LCB7XG4gICAgICBuYW1lOiAnbWFzdGVyY2FyZCcsXG4gICAgICBpY29uOiAnaW1hZ2VzL21hc3RlcmNhcmQucG5nJyxcbiAgICAgIHBhdHRlcm46IC9eNVsxLTVdLyxcbiAgICAgIHZhbGlkX2xlbmd0aDogWzE2XVxuICAgIH0sIHtcbiAgICAgIG5hbWU6ICdtYWVzdHJvJyxcbiAgICAgIHBhdHRlcm46IC9eKDUwMTh8NTAyMHw1MDM4fDYzMDR8Njc1OXw2NzZbMS0zXSkvLFxuICAgICAgdmFsaWRfbGVuZ3RoOiBbMTIsIDEzLCAxNCwgMTUsIDE2LCAxNywgMTgsIDE5XVxuICAgIH0sIHtcbiAgICAgIG5hbWU6ICdkaXNjb3ZlcicsXG4gICAgICBpY29uOiAnaW1hZ2VzL2Rpc2NvdmVyLnBuZycsXG4gICAgICBwYXR0ZXJuOiAvXig2MDExfDYyMigxMls2LTldfDFbMy05XVswLTldfFsyLThdWzAtOV17Mn18OVswLTFdWzAtOV18OTJbMC01XXw2NFs0LTldKXw2NSkvLFxuICAgICAgdmFsaWRfbGVuZ3RoOiBbMTZdXG4gICAgfV07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHt9O1xuXG4gICAgaWYgKG9wdGlvbnMuYWNjZXB0ID09IG51bGwpIHtcbiAgICAgIG9wdGlvbnMuYWNjZXB0ID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF9pLCBfbGVuLCBfcmVzdWx0cztcbiAgICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yIChfaSA9IDAsIF9sZW4gPSBjYXJkX3R5cGVzLmxlbmd0aDsgX2kgPCBfbGVuOyBfaSsrKSB7XG4gICAgICAgICAgY2FyZCA9IGNhcmRfdHlwZXNbX2ldO1xuICAgICAgICAgIF9yZXN1bHRzLnB1c2goY2FyZC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgICB9KSgpO1xuICAgIH1cbiAgICBfcmVmID0gb3B0aW9ucy5hY2NlcHQ7XG4gICAgZm9yIChfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBfaSsrKSB7XG4gICAgICBjYXJkX3R5cGUgPSBfcmVmW19pXTtcbiAgICAgIGlmIChfX2luZGV4T2YuY2FsbCgoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX2osIF9sZW4xLCBfcmVzdWx0cztcbiAgICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yIChfaiA9IDAsIF9sZW4xID0gY2FyZF90eXBlcy5sZW5ndGg7IF9qIDwgX2xlbjE7IF9qKyspIHtcbiAgICAgICAgICBjYXJkID0gY2FyZF90eXBlc1tfal07XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaChjYXJkLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICAgIH0pKCksIGNhcmRfdHlwZSkgPCAwKSB7XG4gICAgICAgIHRocm93IFwiQ3JlZGl0IGNhcmQgdHlwZSAnXCIgKyBjYXJkX3R5cGUgKyBcIicgaXMgbm90IHN1cHBvcnRlZFwiO1xuICAgICAgfVxuICAgIH1cblxuICAgIGdldF9jYXJkX3R5cGUgPSBmdW5jdGlvbiAobnVtYmVyKSB7XG4gICAgICB2YXIgX2osIF9sZW4xLCBfcmVmMTtcbiAgICAgIF9yZWYxID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF9rLCBfbGVuMSwgX3JlZjEsIF9yZXN1bHRzO1xuICAgICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgICBmb3IgKF9rID0gMCwgX2xlbjEgPSBjYXJkX3R5cGVzLmxlbmd0aDsgX2sgPCBfbGVuMTsgX2srKykge1xuICAgICAgICAgIGNhcmQgPSBjYXJkX3R5cGVzW19rXTtcbiAgICAgICAgICBpZiAoKF9yZWYxID0gY2FyZC5uYW1lLCBfX2luZGV4T2YuY2FsbChvcHRpb25zLmFjY2VwdCwgX3JlZjEpID49IDApKSB7XG4gICAgICAgICAgICBfcmVzdWx0cy5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgICB9KSgpO1xuICAgICAgZm9yIChfaiA9IDAsIF9sZW4xID0gX3JlZjEubGVuZ3RoOyBfaiA8IF9sZW4xOyBfaisrKSB7XG4gICAgICAgIGNhcmRfdHlwZSA9IF9yZWYxW19qXTtcbiAgICAgICAgaWYgKG51bWJlci5tYXRjaChjYXJkX3R5cGUucGF0dGVybikpIHtcbiAgICAgICAgICByZXR1cm4gY2FyZF90eXBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgaXNfdmFsaWRfbHVobiA9IGZ1bmN0aW9uIChudW1iZXIpIHtcbiAgICAgIHZhciBkaWdpdCwgbiwgc3VtLCBfaiwgX2xlbjEsIF9yZWYxO1xuICAgICAgc3VtID0gMDtcbiAgICAgIF9yZWYxID0gbnVtYmVyLnNwbGl0KCcnKS5yZXZlcnNlKCk7XG4gICAgICBmb3IgKG4gPSBfaiA9IDAsIF9sZW4xID0gX3JlZjEubGVuZ3RoOyBfaiA8IF9sZW4xOyBuID0gKytfaikge1xuICAgICAgICBkaWdpdCA9IF9yZWYxW25dO1xuICAgICAgICBkaWdpdCA9ICtkaWdpdDtcbiAgICAgICAgaWYgKG4gJSAyKSB7XG4gICAgICAgICAgZGlnaXQgKj0gMjtcbiAgICAgICAgICBpZiAoZGlnaXQgPCAxMCkge1xuICAgICAgICAgICAgc3VtICs9IGRpZ2l0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdW0gKz0gZGlnaXQgLSA5O1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdW0gKz0gZGlnaXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBzdW0gJSAxMCA9PT0gMDtcbiAgICB9O1xuXG4gICAgaXNfdmFsaWRfbGVuZ3RoID0gZnVuY3Rpb24gKG51bWJlciwgY2FyZF90eXBlKSB7XG4gICAgICB2YXIgX3JlZjE7XG4gICAgICByZXR1cm4gX3JlZjEgPSBudW1iZXIubGVuZ3RoLCBfX2luZGV4T2YuY2FsbChjYXJkX3R5cGUudmFsaWRfbGVuZ3RoLCBfcmVmMSkgPj0gMDtcbiAgICB9O1xuXG4gICAgdmFsaWRhdGVfbnVtYmVyID0gKGZ1bmN0aW9uIChfdGhpcykge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChudW1iZXIpIHtcbiAgICAgICAgdmFyIGxlbmd0aF92YWxpZCwgbHVobl92YWxpZDtcbiAgICAgICAgY2FyZF90eXBlID0gZ2V0X2NhcmRfdHlwZShudW1iZXIpO1xuICAgICAgICBsdWhuX3ZhbGlkID0gZmFsc2U7XG4gICAgICAgIGxlbmd0aF92YWxpZCA9IGZhbHNlO1xuICAgICAgICBpZiAoY2FyZF90eXBlICE9IG51bGwpIHtcbiAgICAgICAgICBsdWhuX3ZhbGlkID0gaXNfdmFsaWRfbHVobihudW1iZXIpO1xuICAgICAgICAgIGxlbmd0aF92YWxpZCA9IGlzX3ZhbGlkX2xlbmd0aChudW1iZXIsIGNhcmRfdHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjYXJkX3R5cGU6IGNhcmRfdHlwZSxcbiAgICAgICAgICB2YWxpZDogbHVobl92YWxpZCAmJiBsZW5ndGhfdmFsaWQsXG4gICAgICAgICAgbHVobl92YWxpZDogbHVobl92YWxpZCxcbiAgICAgICAgICBsZW5ndGhfdmFsaWQ6IGxlbmd0aF92YWxpZFxuICAgICAgICB9O1xuICAgICAgfTtcbiAgICB9KSh0aGlzKTtcblxuICAgIG5vcm1hbGl6ZSA9IGZ1bmN0aW9uIChudW1iZXIpIHtcbiAgICAgIHJldHVybiBudW1iZXIucmVwbGFjZSgvWyAtXS9nLCAnJyk7XG4gICAgfTtcblxuICAgIHZhbGlkYXRlID0gKGZ1bmN0aW9uIChfdGhpcykge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHZhbGlkYXRlX251bWJlcihub3JtYWxpemUoaW5wdXQpKTtcbiAgICAgIH07XG4gICAgfSkodGhpcyk7XG5cbiAgICByZXR1cm4gdmFsaWRhdGUoaW5wdXQpO1xuICB9O1xuXG4gIHJpb3QubWl4aW4oJ3JnLmNyZWRpdGNhcmQnLCB7XG4gICAgY3JlZGl0Y2FyZDoge1xuICAgICAgdmFsaWRhdGU6IHZhbGlkYXRlQ3JlZGl0Q2FyZFxuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCF3aW5kb3cucmcpIHdpbmRvdy5yZyA9IHt9O1xuICByZy5jcmVkaXRjYXJkID0ge1xuICAgIHZhbGlkYXRlOiB2YWxpZGF0ZUNyZWRpdENhcmRcbiAgfTtcbn0pKCk7XG47XG4oZnVuY3Rpb24gKCkge1xuICB2YXIgbWFwID0ge1xuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG4gICAgICBtYXAudHJpZ2dlcignaW5pdGlhbGl6ZScpO1xuICAgIH1cbiAgfTtcblxuICByaW90Lm9ic2VydmFibGUobWFwKTtcblxuICBpZiAoIXdpbmRvdy5yZykgd2luZG93LnJnID0ge307XG4gIHJnLm1hcCA9IG1hcDtcbn0pKCk7XG5cbnZhciBSZ1RhZyA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIFJnVGFnKCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1RhZyk7XG5cbiAgICByaW90Lm9ic2VydmFibGUodGhpcyk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoUmdUYWcsIFt7XG4gICAga2V5OiAndXBkYXRlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gdXBkYXRlKCkge1xuICAgICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdUYWc7XG59KSgpO1xuXG52YXIgUmdBbGVydHMgPSAoZnVuY3Rpb24gKF9SZ1RhZykge1xuICBfaW5oZXJpdHMoUmdBbGVydHMsIF9SZ1RhZyk7XG5cbiAgZnVuY3Rpb24gUmdBbGVydHMob3B0cykge1xuICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnQWxlcnRzKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnQWxlcnRzLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5hbGVydHMgPSBbXTtcbiAgICBpZiAoIXJnLmlzQXJyYXkob3B0cy5hbGVydHMpKSByZXR1cm47XG4gICAgb3B0cy5hbGVydHMuZm9yRWFjaChmdW5jdGlvbiAoYWxlcnQpIHtcbiAgICAgIF90aGlzMy5hZGQoYWxlcnQpO1xuICAgIH0pO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnQWxlcnRzLCBbe1xuICAgIGtleTogJ2FkZCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGFkZChhbGVydCkge1xuICAgICAgdmFyIF90aGlzNCA9IHRoaXM7XG5cbiAgICAgIGFsZXJ0LmlkID0gcmcudWlkKCk7XG4gICAgICBpZiAocmcuaXNVbmRlZmluZWQoYWxlcnQuaXN2aXNpYmxlKSkgYWxlcnQuaXN2aXNpYmxlID0gdHJ1ZTtcbiAgICAgIGlmIChhbGVydC50aW1lb3V0KSB7XG4gICAgICAgIGFsZXJ0LnN0YXJ0VGltZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgYWxlcnQudGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIF90aGlzNC5kaXNtaXNzKGFsZXJ0KTtcbiAgICAgICAgICAgIF90aGlzNC51cGRhdGUoKTtcbiAgICAgICAgICB9LCByZy50b051bWJlcihhbGVydC50aW1lb3V0KSk7XG4gICAgICAgIH07XG4gICAgICAgIGFsZXJ0LnN0YXJ0VGltZXIoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWxlcnRzLnB1c2goYWxlcnQpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Rpc21pc3MnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNtaXNzKGFsZXJ0KSB7XG4gICAgICBhbGVydC5pc3Zpc2libGUgPSBmYWxzZTtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKGFsZXJ0Lm9uY2xvc2UpKSBhbGVydC5vbmNsb3NlKGFsZXJ0KTtcbiAgICAgIGNsZWFyVGltZW91dChhbGVydC50aW1lcik7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2VsZWN0JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VsZWN0KGFsZXJ0KSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbihhbGVydC5vbmNsaWNrKSkgYWxlcnQub25jbGljayhhbGVydCk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnQWxlcnRzO1xufSkoUmdUYWcpO1xuXG52YXIgUmdCZWhvbGQgPSAoZnVuY3Rpb24gKF9SZ1RhZzIpIHtcbiAgX2luaGVyaXRzKFJnQmVob2xkLCBfUmdUYWcyKTtcblxuICBmdW5jdGlvbiBSZ0JlaG9sZChvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnQmVob2xkKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnQmVob2xkLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5faW1hZ2UxID0gb3B0cy5pbWFnZTE7XG4gICAgdGhpcy5faW1hZ2UyID0gb3B0cy5pbWFnZTI7XG4gICAgdGhpcy5fbW9kZSA9IG9wdHMubW9kZTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0JlaG9sZCwgW3tcbiAgICBrZXk6ICdpbWFnZTEnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlMTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGltZykge1xuICAgICAgdGhpcy5faW1hZ2UxID0gaW1nO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2ltYWdlMicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1hZ2UyO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaW1nKSB7XG4gICAgICB0aGlzLl9pbWFnZTIgPSBpbWc7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnbW9kZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbW9kZSB8fCAnc3dpcGUnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQobW9kZSkge1xuICAgICAgdGhpcy5fbW9kZSA9IG1vZGU7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnQmVob2xkO1xufSkoUmdUYWcpO1xuXG52YXIgUmdCdWJibGUgPSAoZnVuY3Rpb24gKF9SZ1RhZzMpIHtcbiAgX2luaGVyaXRzKFJnQnViYmxlLCBfUmdUYWczKTtcblxuICBmdW5jdGlvbiBSZ0J1YmJsZShvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnQnViYmxlKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnQnViYmxlLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5faXN2aXNpYmxlID0gb3B0cy5pc3Zpc2libGU7XG4gICAgdGhpcy5fY29udGVudCA9IG9wdHMuY29udGVudDtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0J1YmJsZSwgW3tcbiAgICBrZXk6ICdzaG93QnViYmxlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2hvd0J1YmJsZSgpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lcik7XG4gICAgICB0aGlzLmlzdmlzaWJsZSA9IHRydWU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnaGlkZUJ1YmJsZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGhpZGVCdWJibGUoKSB7XG4gICAgICB2YXIgX3RoaXM1ID0gdGhpcztcblxuICAgICAgdGhpcy5fdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXM1LmlzdmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICBfdGhpczUudXBkYXRlKCk7XG4gICAgICB9LCAxMDAwKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd0b2dnbGVCdWJibGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0b2dnbGVCdWJibGUoKSB7XG4gICAgICB0aGlzLmlzdmlzaWJsZSA9ICF0aGlzLmlzdmlzaWJsZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpc3Zpc2libGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaXN2aXNpYmxlKSB7XG4gICAgICB0aGlzLl9pc3Zpc2libGUgPSBpc3Zpc2libGU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnY29udGVudCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY29udGVudCB8fCAnJztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGNvbnRlbnQpIHtcbiAgICAgIHRoaXMuX2NvbnRlbnQgPSBjb250ZW50O1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ0J1YmJsZTtcbn0pKFJnVGFnKTtcblxudmFyIFJnQ29kZSA9IChmdW5jdGlvbiAoX1JnVGFnNCkge1xuICBfaW5oZXJpdHMoUmdDb2RlLCBfUmdUYWc0KTtcblxuICBmdW5jdGlvbiBSZ0NvZGUob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ0NvZGUpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdDb2RlLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5fdXJsID0gb3B0cy51cmw7XG4gICAgdGhpcy5fY29kZSA9IG9wdHMuY29kZTtcbiAgICB0aGlzLl9vbmNoYW5nZSA9IG9wdHMub25jaGFuZ2U7XG4gICAgdGhpcy5fdGhlbWUgPSBvcHRzLnRoZW1lO1xuICAgIHRoaXMuX21vZGUgPSBvcHRzLm1vZGU7XG4gICAgdGhpcy5fdGFic2l6ZSA9IG9wdHMudGFic2l6ZTtcbiAgICB0aGlzLl9zb2Z0dGFicyA9IG9wdHMuc29mdHRhYnM7XG4gICAgdGhpcy5fd29yZHdyYXAgPSBvcHRzLndvcmR3cmFwO1xuICAgIHRoaXMuX3JlYWRvbmx5ID0gb3B0cy5yZWFkb25seTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0NvZGUsIFt7XG4gICAga2V5OiAndXJsJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl91cmw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh1cmwpIHtcbiAgICAgIHRoaXMuX3VybCA9IHVybDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdjb2RlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jb2RlIHx8ICcnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoY29kZSkge1xuICAgICAgdGhpcy5fY29kZSA9IGNvZGU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25jaGFuZ2UnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24odGhpcy5fb25jaGFuZ2UpKSByZXR1cm4gdGhpcy5fb25jaGFuZ2U7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9uY2hhbmdlKSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbihvbmNoYW5nZSkpIHRoaXMuX29uY2hhbmdlID0gb25jaGFuZ2U7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndGhlbWUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3RoZW1lIHx8ICdtb25va2FpJztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHRoZW1lKSB7XG4gICAgICB0aGlzLl90aGVtZSA9IHRoZW1lO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ21vZGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX21vZGUgfHwgJ2h0bWwnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQobW9kZSkge1xuICAgICAgdGhpcy5fbW9kZSA9IG1vZGU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndGFic2l6ZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9OdW1iZXIodGhpcy5fdGFic2l6ZSkgfHwgMjtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHRhYnNpemUpIHtcbiAgICAgIHRoaXMuX3RhYnNpemUgPSB0YWJzaXplO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3NvZnR0YWJzJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5fc29mdHRhYnMpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoc29mdHRhYnMpIHtcbiAgICAgIHRoaXMuX3NvZnR0YWJzID0gc29mdHRhYnM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnd29yZHdyYXAnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl93b3Jkd3JhcCk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh3b3Jkd3JhcCkge1xuICAgICAgdGhpcy5fd29yZHdyYXAgPSB3b3Jkd3JhcDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkb25seScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3JlYWRvbmx5KTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHJlYWRvbmx5KSB7XG4gICAgICB0aGlzLl9yZWFkb25seSA9IHJlYWRvbmx5O1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ0NvZGU7XG59KShSZ1RhZyk7XG5cbnZhciBSZ0NvbnRleHRNZW51ID0gKGZ1bmN0aW9uIChfUmdUYWc1KSB7XG4gIF9pbmhlcml0cyhSZ0NvbnRleHRNZW51LCBfUmdUYWc1KTtcblxuICBmdW5jdGlvbiBSZ0NvbnRleHRNZW51KG9wdHMpIHtcbiAgICB2YXIgX3RoaXM2ID0gdGhpcztcblxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ0NvbnRleHRNZW51KTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnQ29udGV4dE1lbnUucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLm5hbWUgPSBvcHRzLm5hbWU7XG4gICAgdGhpcy5faXN2aXNpYmxlID0gb3B0cy5pc3Zpc2libGU7XG4gICAgdGhpcy5fb25jbG9zZSA9IG9wdHMub25jbG9zZTtcbiAgICB0aGlzLl9vbm9wZW4gPSBvcHRzLm9ub3BlbjtcbiAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgIGlmICghcmcuaXNBcnJheShvcHRzLml0ZW1zKSkgcmV0dXJuO1xuICAgIG9wdHMuaXRlbXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgX3RoaXM2LmFkZChpdGVtKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0NvbnRleHRNZW51LCBbe1xuICAgIGtleTogJ2FkZCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGFkZChpdGVtKSB7XG4gICAgICBpdGVtLmlkID0gcmcudWlkKCk7XG4gICAgICBpZiAocmcuaXNVbmRlZmluZWQoaXRlbS5pc3Zpc2libGUpKSBpdGVtLmlzdmlzaWJsZSA9IHRydWU7XG4gICAgICBpZiAocmcuaXNVbmRlZmluZWQoaXRlbS5pbmFjdGl2ZSkpIGl0ZW0uaW5hY3RpdmUgPSBmYWxzZTtcbiAgICAgIGlmICghcmcuaXNGdW5jdGlvbihpdGVtLm9uY2xpY2spKSBpdGVtLm9uY2xpY2sgPSBudWxsO1xuICAgICAgdGhpcy5faXRlbXMucHVzaChpdGVtKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdzZWxlY3QnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZWxlY3QoaXRlbSkge1xuICAgICAgaWYgKCFpdGVtLmluYWN0aXZlKSB7XG4gICAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKGl0ZW0ub25jbGljaykpIGl0ZW0ub25jbGljayhpdGVtKTtcbiAgICAgICAgdGhpcy5pc3Zpc2libGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpdGVtcycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNBcnJheSh0aGlzLl9pdGVtcykpIHJldHVybiB0aGlzLl9pdGVtcztcbiAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICByZXR1cm4gdGhpcy5faXRlbXM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChpdGVtcykge1xuICAgICAgdGhpcy5faXRlbXMgPSBpdGVtcztcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdvbm9wZW4nLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24odGhpcy5fb25vcGVuKSkgcmV0dXJuIHRoaXMuX29ub3BlbjtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQob25vcGVuKSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbihvbm9wZW4pKSB0aGlzLl9vbm9wZW4gPSBvbm9wZW47XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25jbG9zZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbih0aGlzLl9vbmNsb3NlKSkgcmV0dXJuIHRoaXMuX29uY2xvc2U7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9uY2xvc2UpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKG9uY2xvc2UpKSB0aGlzLl9vbmNsb3NlID0gb25jbG9zZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpc3Zpc2libGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaXN2aXNpYmxlKSB7XG4gICAgICB0aGlzLl9pc3Zpc2libGUgPSByZy50b0Jvb2xlYW4oaXN2aXNpYmxlKTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdDb250ZXh0TWVudTtcbn0pKFJnVGFnKTtcblxudmFyIFJnQ3JlZGl0Q2FyZCA9IChmdW5jdGlvbiAoX1JnVGFnNikge1xuICBfaW5oZXJpdHMoUmdDcmVkaXRDYXJkLCBfUmdUYWc2KTtcblxuICBmdW5jdGlvbiBSZ0NyZWRpdENhcmQob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ0NyZWRpdENhcmQpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdDcmVkaXRDYXJkLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5fcGxhY2Vob2xkZXIgPSBvcHRzLnBsYWNlaG9sZGVyO1xuICAgIHRoaXMuX2NhcmRudW1iZXIgPSBvcHRzLmNhcmRudW1iZXI7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoUmdDcmVkaXRDYXJkLCBbe1xuICAgIGtleTogJ3ZhbGlkYXRlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gdmFsaWRhdGUoKSB7XG4gICAgICB2YXIgcmVzID0gcmcuY3JlZGl0Y2FyZC52YWxpZGF0ZSh0aGlzLmNhcmRudW1iZXIpO1xuICAgICAgdGhpcy52YWxpZCA9IHJlcy52YWxpZDtcbiAgICAgIHRoaXMuaWNvbiA9IHRoaXMudmFsaWQgPyByZXMuY2FyZF90eXBlLm5hbWUgOiAnJztcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdjYXJkbnVtYmVyJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiAodGhpcy5fY2FyZG51bWJlciB8fCAnJykudG9TdHJpbmcoKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG51bSkge1xuICAgICAgdGhpcy5fY2FyZG51bWJlciA9IG51bTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd2YWxpZCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3ZhbGlkKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHZhbGlkKSB7XG4gICAgICB0aGlzLl92YWxpZCA9IHJnLnRvQm9vbGVhbih2YWxpZCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncGxhY2Vob2xkZXInLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BsYWNlaG9sZGVyIHx8ICdDYXJkIG5vLic7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh0ZXh0KSB7XG4gICAgICB0aGlzLl9wbGFjZWhvbGRlciA9IHRleHQ7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnQ3JlZGl0Q2FyZDtcbn0pKFJnVGFnKTtcblxudmFyIFJnRGF0ZSA9IChmdW5jdGlvbiAoX1JnVGFnNykge1xuICBfaW5oZXJpdHMoUmdEYXRlLCBfUmdUYWc3KTtcblxuICBmdW5jdGlvbiBSZ0RhdGUob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ0RhdGUpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdEYXRlLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5faXN2aXNpYmxlID0gb3B0cy5pc3Zpc2libGU7XG4gICAgdGhpcy5fZGF0ZSA9IG9wdHMuZGF0ZTtcbiAgICB0aGlzLl9zaG93WWVhcnMgPSBvcHRzLnNob3d5ZWFycztcbiAgICB0aGlzLl9zaG93TW9udGhzID0gb3B0cy5zaG93bW9udGhzO1xuICAgIHRoaXMuX3Nob3dUb2RheSA9IG9wdHMuc2hvd3RvZGF5O1xuICAgIHRoaXMuX2Zvcm1hdCA9IG9wdHMuZm9ybWF0O1xuICAgIHRoaXMuX3llYXJGb3JtYXQgPSBvcHRzLnllYXJmb3JtYXQ7XG4gICAgdGhpcy5fbW9udGhGb3JtYXQgPSBvcHRzLm1vbnRoZm9ybWF0O1xuICAgIHRoaXMuX3dlZWtGb3JtYXQgPSBvcHRzLndlZWtmb3JtYXQ7XG4gICAgdGhpcy5fZGF5Rm9ybWF0ID0gb3B0cy5kYXlmb3JtYXQ7XG4gICAgdGhpcy5fb25jbG9zZSA9IG9wdHMub25jbG9zZTtcbiAgICB0aGlzLl9vbnNlbGVjdCA9IG9wdHMub25zZWxlY3Q7XG4gICAgdGhpcy5fb25vcGVuID0gb3B0cy5vbm9wZW47XG5cbiAgICB2YXIgdGVtcCA9IG1vbWVudCgpO1xuICAgIHRoaXMuZGF5TmFtZXMgPSBbdGVtcC5kYXkoMCkuZm9ybWF0KHRoaXMud2Vla0Zvcm1hdCksIHRlbXAuZGF5KDEpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLCB0ZW1wLmRheSgyKS5mb3JtYXQodGhpcy53ZWVrRm9ybWF0KSwgdGVtcC5kYXkoMykuZm9ybWF0KHRoaXMud2Vla0Zvcm1hdCksIHRlbXAuZGF5KDQpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLCB0ZW1wLmRheSg1KS5mb3JtYXQodGhpcy53ZWVrRm9ybWF0KSwgdGVtcC5kYXkoNikuZm9ybWF0KHRoaXMud2Vla0Zvcm1hdCldO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnRGF0ZSwgW3tcbiAgICBrZXk6ICdfdG9Nb21lbnQnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfdG9Nb21lbnQoZGF0ZSkge1xuICAgICAgaWYgKCFtb21lbnQuaXNNb21lbnQoZGF0ZSkpIGRhdGUgPSBtb21lbnQoZGF0ZSk7XG4gICAgICBpZiAoZGF0ZS5pc1ZhbGlkKCkpIHJldHVybiBkYXRlO1xuICAgICAgcmV0dXJuIG1vbWVudCgpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29wZW4nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvcGVuKCkge1xuICAgICAgdGhpcy5faXN2aXNpYmxlID0gdHJ1ZTtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29ub3BlbikpIHRoaXMuX29ub3BlbigpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Nsb3NlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2xvc2UoKSB7XG4gICAgICBpZiAodGhpcy5pc3Zpc2libGUpIHtcbiAgICAgICAgdGhpcy5faXN2aXNpYmxlID0gZmFsc2U7XG4gICAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29uY2xvc2UpKSB0aGlzLl9vbmNsb3NlKCk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2V0VG9kYXknLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZXRUb2RheSgpIHtcbiAgICAgIHRoaXMuc2VsZWN0KG1vbWVudCgpKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdwcmV2WWVhcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHByZXZZZWFyKCkge1xuICAgICAgdGhpcy5fZGF0ZSA9IHRoaXMuZGF0ZS5zdWJ0cmFjdCgxLCAneWVhcicpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ25leHRZZWFyJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gbmV4dFllYXIoKSB7XG4gICAgICB0aGlzLl9kYXRlID0gdGhpcy5kYXRlLmFkZCgxLCAneWVhcicpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3ByZXZNb250aCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHByZXZNb250aCgpIHtcbiAgICAgIHRoaXMuX2RhdGUgPSB0aGlzLmRhdGUuc3VidHJhY3QoMSwgJ21vbnRoJyk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnbmV4dE1vbnRoJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gbmV4dE1vbnRoKCkge1xuICAgICAgdGhpcy5fZGF0ZSA9IHRoaXMuZGF0ZS5hZGQoMSwgJ21vbnRoJyk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2VsZWN0JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VsZWN0KGRhdGUpIHtcbiAgICAgIHRoaXMuX2RhdGUgPSBkYXRlO1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24odGhpcy5fb25zZWxlY3QpKSB0aGlzLl9vbnNlbGVjdCh0aGlzLmRhdGUpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2RhdGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3RvTW9tZW50KHRoaXMuX2RhdGUpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoZGF0ZSkge1xuICAgICAgdGhpcy5fZGF0ZSA9IGRhdGU7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbih0aGlzLl9vbnNlbGVjdCkpIHRoaXMuX29uc2VsZWN0KHRoaXMuZGF0ZSk7XG4gICAgICB0aGlzLl9pc3Zpc2libGUgPSBmYWxzZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdkYXRlRm9ybWF0dGVkJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiB0aGlzLmRhdGUuZm9ybWF0KHRoaXMuZm9ybWF0KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpc3Zpc2libGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3llYXInLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuZGF0ZS5mb3JtYXQodGhpcy55ZWFyRm9ybWF0KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdtb250aCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5kYXRlLmZvcm1hdCh0aGlzLm1vbnRoRm9ybWF0KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdkYXknLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuZGF0ZS5mb3JtYXQodGhpcy5kYXlGb3JtYXQpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3Nob3dZZWFycycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNVbmRlZmluZWQodGhpcy5fc2hvd1llYXJzKSkgcmV0dXJuIHRydWU7XG4gICAgICByZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3Nob3dZZWFycyk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChzaG93KSB7XG4gICAgICB0aGlzLl9zaG93WWVhcnMgPSByZy50b0Jvb2xlYW4oc2hvdyk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2hvd01vbnRocycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNVbmRlZmluZWQodGhpcy5fc2hvd01vbnRocykpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9zaG93TW9udGhzKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHNob3cpIHtcbiAgICAgIHRoaXMuX3Nob3dNb250aHMgPSByZy50b0Jvb2xlYW4oc2hvdyk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2hvd1RvZGF5JyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc1VuZGVmaW5lZCh0aGlzLl9zaG93VG9kYXkpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5fc2hvd1RvZGF5KTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHNob3cpIHtcbiAgICAgIHRoaXMuX3Nob3dUb2RheSA9IHJnLnRvQm9vbGVhbihzaG93KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdmb3JtYXQnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2Zvcm1hdCB8fCAnTEwnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoZm9ybWF0KSB7XG4gICAgICB0aGlzLl9mb3JtYXQgPSBmb3JtYXQ7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAneWVhckZvcm1hdCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5feWVhckZvcm1hdCB8fCAnWVlZWSc7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh5ZWFyRm9ybWF0KSB7XG4gICAgICB0aGlzLl95ZWFyRm9ybWF0ID0geWVhckZvcm1hdDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdtb250aEZvcm1hdCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbW9udGhGb3JtYXQgfHwgJ01NTU0nO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQobW9udGhGb3JtYXQpIHtcbiAgICAgIHRoaXMuX21vbnRoRm9ybWF0ID0gbW9udGhGb3JtYXQ7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnd2Vla0Zvcm1hdCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fd2Vla0Zvcm1hdCB8fCAnZGRkJztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHdlZWtGb3JtYXQpIHtcbiAgICAgIHRoaXMuX3dlZWtGb3JtYXQgPSB3ZWVrRm9ybWF0O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2RheUZvcm1hdCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGF5Rm9ybWF0IHx8ICdERCc7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChkYXlGb3JtYXQpIHtcbiAgICAgIHRoaXMuX2RheUZvcm1hdCA9IGRheUZvcm1hdDtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdEYXRlO1xufSkoUmdUYWcpO1xuXG52YXIgUmdEcmF3ZXIgPSAoZnVuY3Rpb24gKF9SZ1RhZzgpIHtcbiAgX2luaGVyaXRzKFJnRHJhd2VyLCBfUmdUYWc4KTtcblxuICBmdW5jdGlvbiBSZ0RyYXdlcihvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnRHJhd2VyKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnRHJhd2VyLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5faXN2aXNpYmxlID0gb3B0cy5pc3Zpc2libGU7XG4gICAgdGhpcy5faGVhZGVyID0gb3B0cy5oZWFkZXI7XG4gICAgdGhpcy5faXRlbXMgPSBvcHRzLml0ZW1zO1xuICAgIHRoaXMuX3Bvc2l0aW9uID0gb3B0cy5wb3NpdGlvbjtcbiAgICB0aGlzLl9vbnNlbGVjdCA9IG9wdHMub25zZWxlY3Q7XG4gICAgdGhpcy5fb25vcGVuID0gb3B0cy5vbm9wZW47XG4gICAgdGhpcy5fb25jbG9zZSA9IG9wdHMub25jbG9zZTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0RyYXdlciwgW3tcbiAgICBrZXk6ICdvcGVuJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gb3BlbigpIHtcbiAgICAgIGlmICh0aGlzLm9ub3BlbiAmJiAhdGhpcy5pc3Zpc2libGUpIHRoaXMub25vcGVuKCk7XG4gICAgICB0aGlzLmlzdmlzaWJsZSA9IHRydWU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnY2xvc2UnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjbG9zZSgpIHtcbiAgICAgIGlmICh0aGlzLm9uY2xvc2UgJiYgdGhpcy5pc3Zpc2libGUpIHRoaXMub25jbG9zZSgpO1xuICAgICAgdGhpcy5pc3Zpc2libGUgPSBmYWxzZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd0b2dnbGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0b2dnbGUoKSB7XG4gICAgICB0aGlzLmlzdmlzaWJsZSA9ICF0aGlzLmlzdmlzaWJsZTtcbiAgICAgIGlmICh0aGlzLm9ub3BlbiAmJiB0aGlzLmlzdmlzaWJsZSkgdGhpcy5vbm9wZW4oKTtlbHNlIGlmICh0aGlzLm9uY2xvc2UgJiYgIXRoaXMuaXN2aXNpYmxlKSB0aGlzLm9uY2xvc2UoKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdzZWxlY3QnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZWxlY3QoaXRlbSkge1xuICAgICAgdGhpcy5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgfSk7XG4gICAgICBpdGVtLmFjdGl2ZSA9IHRydWU7XG4gICAgICBpZiAoaXRlbS5hY3Rpb24pIGl0ZW0uYWN0aW9uKGl0ZW0pO1xuICAgICAgaWYgKHRoaXMub25zZWxlY3QpIHRoaXMub25zZWxlY3QoaXRlbSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnaXN2aXNpYmxlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5faXN2aXNpYmxlKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGlzdmlzaWJsZSkge1xuICAgICAgdGhpcy5faXN2aXNpYmxlID0gaXN2aXNpYmxlO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2hlYWRlcicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5faGVhZGVyO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaGVhZGVyKSB7XG4gICAgICB0aGlzLl9oZWFkZXIgPSBoZWFkZXI7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnaXRlbXMnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzQXJyYXkodGhpcy5faXRlbXMpKSByZXR1cm4gdGhpcy5faXRlbXM7XG4gICAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaXRlbXMpIHtcbiAgICAgIHRoaXMuX2l0ZW1zID0gaXRlbXM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncG9zaXRpb24nLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uIHx8ICdib3R0b20nO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQocG9zaXRpb24pIHtcbiAgICAgIHRoaXMuX3Bvc2l0aW9uID0gcG9zaXRpb247XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25vcGVuJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29ub3BlbikpIHJldHVybiB0aGlzLl9vbm9wZW47XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9ub3Blbikge1xuICAgICAgdGhpcy5fb25vcGVuID0gb25vcGVuO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29uY2xvc2UnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24odGhpcy5fb25jbG9zZSkpIHJldHVybiB0aGlzLl9vbmNsb3NlO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChvbmNsb3NlKSB7XG4gICAgICB0aGlzLl9vbmNsb3NlID0gb25jbG9zZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdvbnNlbGVjdCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbih0aGlzLl9vbnNlbGVjdCkpIHJldHVybiB0aGlzLl9vbnNlbGVjdDtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQob25zZWxlY3QpIHtcbiAgICAgIHRoaXMuX29uc2VsZWN0ID0gb25zZWxlY3Q7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnRHJhd2VyO1xufSkoUmdUYWcpO1xuXG52YXIgUmdJbmNsdWRlID0gKGZ1bmN0aW9uIChfUmdUYWc5KSB7XG4gIF9pbmhlcml0cyhSZ0luY2x1ZGUsIF9SZ1RhZzkpO1xuXG4gIGZ1bmN0aW9uIFJnSW5jbHVkZShvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnSW5jbHVkZSk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihSZ0luY2x1ZGUucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLl91bnNhZmUgPSBvcHRzLnVuc2FmZTtcbiAgICB0aGlzLl91cmwgPSBvcHRzLnVybDtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0luY2x1ZGUsIFt7XG4gICAga2V5OiAnZmV0Y2gnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBmZXRjaCgpIHtcbiAgICAgIHZhciBfdGhpczcgPSB0aGlzO1xuXG4gICAgICByZy54aHIoJ2dldCcsIHRoaXMudXJsLCBmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICBfdGhpczcudHJpZ2dlcignZmV0Y2gnLCByZXNwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3Vuc2FmZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3Vuc2FmZSk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh1bnNhZmUpIHtcbiAgICAgIHRoaXMuX3Vuc2FmZSA9IHVuc2FmZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd1cmwnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3VybCB8fCAnJztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHVybCkge1xuICAgICAgaWYgKHRoaXMudXJsICE9IHVybCkge1xuICAgICAgICB0aGlzLl91cmwgPSB1cmw7XG4gICAgICB9XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnSW5jbHVkZTtcbn0pKFJnVGFnKTtcblxudmFyIFJnTG9hZGluZyA9IChmdW5jdGlvbiAoX1JnVGFnMTApIHtcbiAgX2luaGVyaXRzKFJnTG9hZGluZywgX1JnVGFnMTApO1xuXG4gIGZ1bmN0aW9uIFJnTG9hZGluZyhvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnTG9hZGluZyk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihSZ0xvYWRpbmcucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLl9pc3Zpc2libGUgPSBvcHRzLmlzdmlzaWJsZTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ0xvYWRpbmcsIFt7XG4gICAga2V5OiAnaXN2aXNpYmxlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5faXN2aXNpYmxlKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGlzdmlzaWJsZSkge1xuICAgICAgdGhpcy5faXN2aXNpYmxlID0gaXN2aXNpYmxlO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ0xvYWRpbmc7XG59KShSZ1RhZyk7XG5cbnZhciBSZ01hcCA9IChmdW5jdGlvbiAoX1JnVGFnMTEpIHtcbiAgX2luaGVyaXRzKFJnTWFwLCBfUmdUYWcxMSk7XG5cbiAgZnVuY3Rpb24gUmdNYXAob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ01hcCk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihSZ01hcC5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX29wdGlvbnMgPSBvcHRzO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnTWFwLCBbe1xuICAgIGtleTogJ29wdGlvbnMnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzVW5kZWZpbmVkKHRoaXMuX29wdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSB7XG4gICAgICAgICAgY2VudGVyOiB7XG4gICAgICAgICAgICBsYXQ6IDUzLjgwNixcbiAgICAgICAgICAgIGxuZzogLTEuNTM1XG4gICAgICAgICAgfSxcbiAgICAgICAgICB6b29tOiA3XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9vcHRpb25zO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ01hcDtcbn0pKFJnVGFnKTtcblxudmFyIFJnTWFya2Rvd24gPSAoZnVuY3Rpb24gKF9SZ1RhZzEyKSB7XG4gIF9pbmhlcml0cyhSZ01hcmtkb3duLCBfUmdUYWcxMik7XG5cbiAgZnVuY3Rpb24gUmdNYXJrZG93bihvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnTWFya2Rvd24pO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdNYXJrZG93bi5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIGlmIChyZy5pc1VuZGVmaW5lZChvcHRzKSkgb3B0cyA9IHt9O1xuICAgIGlmIChjb21tb25tYXJrKSB7XG4gICAgICB0aGlzLnJlYWRlciA9IG5ldyBjb21tb25tYXJrLlBhcnNlcigpO1xuICAgICAgdGhpcy53cml0ZXIgPSBuZXcgY29tbW9ubWFyay5IdG1sUmVuZGVyZXIoKTtcbiAgICB9XG4gICAgdGhpcy5fdXJsID0gb3B0cy51cmw7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoUmdNYXJrZG93biwgW3tcbiAgICBrZXk6ICdwYXJzZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHBhcnNlKG1kKSB7XG4gICAgICB2YXIgcGFyc2VkID0gdGhpcy5yZWFkZXIucGFyc2UobWQpO1xuICAgICAgdGhpcy50cmlnZ2VyKCdwYXJzZScsIHRoaXMud3JpdGVyLnJlbmRlcihwYXJzZWQpKTtcbiAgICAgIHJldHVybiB0aGlzLndyaXRlci5yZW5kZXIocGFyc2VkKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdmZXRjaCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGZldGNoKCkge1xuICAgICAgdmFyIF90aGlzOCA9IHRoaXM7XG5cbiAgICAgIHJnLnhocignZ2V0JywgdGhpcy51cmwsIGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgIF90aGlzOC50cmlnZ2VyKCdmZXRjaCcsIHJlc3ApO1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndXJsJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl91cmwgfHwgJyc7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh1cmwpIHtcbiAgICAgIHRoaXMuX3VybCA9IHVybDtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdNYXJrZG93bjtcbn0pKFJnVGFnKTtcblxudmFyIFJnTW9kYWwgPSAoZnVuY3Rpb24gKF9SZ1RhZzEzKSB7XG4gIF9pbmhlcml0cyhSZ01vZGFsLCBfUmdUYWcxMyk7XG5cbiAgZnVuY3Rpb24gUmdNb2RhbChvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnTW9kYWwpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdNb2RhbC5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2lzdmlzaWJsZSA9IG9wdHMuaXN2aXNpYmxlO1xuICAgIHRoaXMuX2Rpc21pc3NhYmxlID0gb3B0cy5kaXNtaXNzYWJsZTtcbiAgICB0aGlzLl9naG9zdCA9IG9wdHMuZ2hvc3Q7XG4gICAgdGhpcy5faGVhZGluZyA9IG9wdHMuaGVhZGluZztcbiAgICB0aGlzLl9idXR0b25zID0gb3B0cy5idXR0b25zO1xuICAgIHRoaXMuX29uY2xvc2UgPSBvcHRzLm9uY2xvc2U7XG4gICAgdGhpcy5fb25vcGVuID0gb3B0cy5vbm9wZW47XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoUmdNb2RhbCwgW3tcbiAgICBrZXk6ICdkaXNtaXNzYWJsZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNVbmRlZmluZWQodGhpcy5fZGlzbWlzc2FibGUpKSB0aGlzLl9kaXNtaXNzYWJsZSA9IHRydWU7XG4gICAgICByZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2Rpc21pc3NhYmxlKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGRpc21pc3NhYmxlKSB7XG4gICAgICB0aGlzLl9kaXNtaXNzYWJsZSA9IGRpc21pc3NhYmxlO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2dob3N0JyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5fZ2hvc3QpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoZ2hvc3QpIHtcbiAgICAgIHRoaXMuX2dob3N0ID0gZ2hvc3Q7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnaGVhZGluZycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5faGVhZGluZyB8fCAnJztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGhlYWRpbmcpIHtcbiAgICAgIHRoaXMuX2hlYWRpbmcgPSBoZWFkaW5nO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2J1dHRvbnMnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzQXJyYXkodGhpcy5fYnV0dG9ucykpIHJldHVybiB0aGlzLl9idXR0b25zO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoYnV0dG9ucykge1xuICAgICAgdGhpcy5fYnV0dG9ucyA9IGJ1dHRvbnM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25vcGVuJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29ub3BlbikpIHJldHVybiB0aGlzLl9vbm9wZW47XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9ub3Blbikge1xuICAgICAgdGhpcy5fb25vcGVuID0gb25vcGVuO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29uY2xvc2UnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24odGhpcy5fb25jbG9zZSkpIHJldHVybiB0aGlzLl9vbmNsb3NlO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChvbmNsb3NlKSB7XG4gICAgICB0aGlzLl9vbmNsb3NlID0gb25jbG9zZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpc3Zpc2libGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaXN2aXNpYmxlKSB7XG4gICAgICB0aGlzLl9pc3Zpc2libGUgPSBpc3Zpc2libGU7XG4gICAgICBpZiAodGhpcy5pc3Zpc2libGUgJiYgdGhpcy5vbm9wZW4pIHRoaXMub25vcGVuKCk7XG4gICAgICBpZiAoIXRoaXMuaXN2aXNpYmxlICYmIHRoaXMub25jbG9zZSkgdGhpcy5vbmNsb3NlKCk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnTW9kYWw7XG59KShSZ1RhZyk7XG5cbnZhciBSZ1Bob25lU2ltID0gKGZ1bmN0aW9uIChfUmdUYWcxNCkge1xuICBfaW5oZXJpdHMoUmdQaG9uZVNpbSwgX1JnVGFnMTQpO1xuXG4gIGZ1bmN0aW9uIFJnUGhvbmVTaW0ob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1Bob25lU2ltKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnUGhvbmVTaW0ucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLl91cmwgPSBvcHRzLnVybDtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ1Bob25lU2ltLCBbe1xuICAgIGtleTogJ3VybCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fdXJsIHx8ICcnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQodXJsKSB7XG4gICAgICB0aGlzLl91cmwgPSB1cmw7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnUGhvbmVTaW07XG59KShSZ1RhZyk7XG5cbnZhciBSZ1BsYWNlaG9sZGl0ID0gKGZ1bmN0aW9uIChfUmdUYWcxNSkge1xuICBfaW5oZXJpdHMoUmdQbGFjZWhvbGRpdCwgX1JnVGFnMTUpO1xuXG4gIGZ1bmN0aW9uIFJnUGxhY2Vob2xkaXQob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1BsYWNlaG9sZGl0KTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnUGxhY2Vob2xkaXQucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLl93aWR0aCA9IG9wdHMud2lkdGg7XG4gICAgdGhpcy5faGVpZ2h0ID0gb3B0cy5oZWlnaHQ7XG4gICAgdGhpcy5fYmFja2dyb3VuZCA9IG9wdHMuYmFja2dyb3VuZDtcbiAgICB0aGlzLl9jb2xvciA9IG9wdHMuY29sb3I7XG4gICAgdGhpcy5fdGV4dCA9IG9wdHMudGV4dDtcbiAgICB0aGlzLl90ZXh0c2l6ZSA9IG9wdHMudGV4dHNpemU7XG4gICAgdGhpcy5fZm9ybWF0ID0gb3B0cy5mb3JtYXQ7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoUmdQbGFjZWhvbGRpdCwgW3tcbiAgICBrZXk6ICd3aWR0aCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9OdW1iZXIodGhpcy5fd2lkdGgpIHx8IDQ1MDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHdpZHRoKSB7XG4gICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2hlaWdodCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9OdW1iZXIodGhpcy5faGVpZ2h0KSB8fCAyNTA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChoZWlnaHQpIHtcbiAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdiYWNrZ3JvdW5kJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9iYWNrZ3JvdW5kIHx8ICdmMDFlNTInO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoYmFja2dyb3VuZCkge1xuICAgICAgdGhpcy5fYmFja2dyb3VuZCA9IGJhY2tncm91bmQ7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnY29sb3InLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yIHx8ICdmZmYnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoY29sb3IpIHtcbiAgICAgIHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndGV4dCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fdGV4dCB8fCB0aGlzLndpZHRoICsgJyB4ICcgKyB0aGlzLmhlaWdodDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHRleHQpIHtcbiAgICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RleHRzaXplJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b051bWJlcih0aGlzLl90ZXh0c2l6ZSkgfHwgMzA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh0ZXh0c2l6ZSkge1xuICAgICAgdGhpcy5fdGV4dHNpemUgPSB0ZXh0c2l6ZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdmb3JtYXQnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2Zvcm1hdCB8fCAncG5nJztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGZvcm1hdCkge1xuICAgICAgdGhpcy5fZm9ybWF0ID0gZm9ybWF0O1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ1BsYWNlaG9sZGl0O1xufSkoUmdUYWcpO1xuXG52YXIgUmdTZWxlY3QgPSAoZnVuY3Rpb24gKF9SZ1RhZzE2KSB7XG4gIF9pbmhlcml0cyhSZ1NlbGVjdCwgX1JnVGFnMTYpO1xuXG4gIGZ1bmN0aW9uIFJnU2VsZWN0KG9wdHMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgUmdTZWxlY3QpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdTZWxlY3QucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLl9pc3Zpc2libGUgPSBvcHRzLmlzdmlzaWJsZTtcbiAgICB0aGlzLl9hdXRvY29tcGxldGUgPSBvcHRzLmF1dG9jb21wbGV0ZTtcbiAgICB0aGlzLl9maWx0ZXJvbiA9IG9wdHMuZmlsdGVyb247XG4gICAgdGhpcy5fb3B0aW9ucyA9IG9wdHMub3B0aW9ucztcbiAgICB0aGlzLl9oYXNmaWx0ZXIgPSBvcHRzLmhhc2ZpbHRlcjtcbiAgICB0aGlzLl9wbGFjZWhvbGRlciA9IG9wdHMucGxhY2Vob2xkZXI7XG4gICAgdGhpcy5fZmlsdGVycGxhY2Vob2xkZXIgPSBvcHRzLmZpbHRlcnBsYWNlaG9sZGVyO1xuICAgIHRoaXMuX2ZpbHRlcmVkaXRlbXMgPSBvcHRzLmZpbHRlcmVkaXRlbXM7XG4gICAgdGhpcy5fb25vcGVuID0gb3B0cy5vbm9wZW47XG4gICAgdGhpcy5fb25jbG9zZSA9IG9wdHMub25jbG9zZTtcbiAgICB0aGlzLl9vbnNlbGVjdCA9IG9wdHMub25zZWxlY3Q7XG4gICAgdGhpcy5fb25maWx0ZXIgPSBvcHRzLm9uZmlsdGVyO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnU2VsZWN0LCBbe1xuICAgIGtleTogJ29wZW4nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvcGVuKCkge1xuICAgICAgaWYgKHRoaXMub25vcGVuICYmICF0aGlzLmlzdmlzaWJsZSkgdGhpcy5vbm9wZW4oKTtcbiAgICAgIHRoaXMuaXN2aXNpYmxlID0gdHJ1ZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdjbG9zZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNsb3NlKCkge1xuICAgICAgaWYgKHRoaXMub25jbG9zZSAmJiB0aGlzLmlzdmlzaWJsZSkgdGhpcy5vbmNsb3NlKCk7XG4gICAgICB0aGlzLmlzdmlzaWJsZSA9IGZhbHNlO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RvZ2dsZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHRvZ2dsZSgpIHtcbiAgICAgIHRoaXMuaXN2aXNpYmxlID0gIXRoaXMuaXN2aXNpYmxlO1xuICAgICAgaWYgKHRoaXMub25vcGVuICYmIHRoaXMuaXN2aXNpYmxlKSB0aGlzLm9ub3BlbigpO2Vsc2UgaWYgKHRoaXMub25jbG9zZSAmJiAhdGhpcy5pc3Zpc2libGUpIHRoaXMub25jbG9zZSgpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2ZpbHRlcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGZpbHRlcih0ZXh0KSB7XG4gICAgICB2YXIgX3RoaXM5ID0gdGhpcztcblxuICAgICAgdGhpcy5maWx0ZXJlZGl0ZW1zID0gdGhpcy5vcHRpb25zLmZpbHRlcihmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICBpdGVtLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB2YXIgZiA9IGl0ZW1bX3RoaXM5LmZpbHRlcm9uXTtcbiAgICAgICAgaWYgKHJnLmlzVW5kZWZpbmVkKGYpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0ZXh0Lmxlbmd0aCA9PSAwIHx8IGYudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2YodGV4dC50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkpID4gLTEpIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5vbmZpbHRlcikgdGhpcy5vbmZpbHRlcih0ZXh0KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdzZWxlY3QnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZWxlY3QoaXRlbSkge1xuICAgICAgdGhpcy5vcHRpb25zLmZvckVhY2goZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgcmV0dXJuIGkuc2VsZWN0ZWQgPSBmYWxzZTtcbiAgICAgIH0pO1xuICAgICAgaXRlbS5zZWxlY3RlZCA9IHRydWU7XG4gICAgICBpZiAodGhpcy5vbnNlbGVjdCkgdGhpcy5vbnNlbGVjdChpdGVtKTtcbiAgICAgIHRoaXMuaXN2aXNpYmxlID0gZmFsc2U7XG4gICAgICBpZiAodGhpcy5hdXRvY29tcGxldGUpIHRoaXMuZmlsdGVyKGl0ZW1bdGhpcy5maWx0ZXJvbl0pO1xuICAgICAgdGhpcy50cmlnZ2VyKCdzZWxlY3QnLCBpdGVtKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpc3Zpc2libGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaXN2aXNpYmxlKSB7XG4gICAgICB0aGlzLl9pc3Zpc2libGUgPSBpc3Zpc2libGU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnYXV0b2NvbXBsZXRlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5fYXV0b2NvbXBsZXRlKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGF1dG9jb21wbGV0ZSkge1xuICAgICAgdGhpcy5fYXV0b2NvbXBsZXRlID0gYXV0b2NvbXBsZXRlO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2ZpbHRlcm9uJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maWx0ZXJvbiB8fCAndGV4dCc7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChmaWx0ZXJvbikge1xuICAgICAgdGhpcy5fZmlsdGVyb24gPSBmaWx0ZXJvbjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdwbGFjZWhvbGRlcicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGxhY2Vob2xkZXI7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChwbGFjZWhvbGRlcikge1xuICAgICAgdGhpcy5fcGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdmaWx0ZXJwbGFjZWhvbGRlcicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlsdGVycGxhY2Vob2xkZXI7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChmaWx0ZXJwbGFjZWhvbGRlcikge1xuICAgICAgdGhpcy5fZmlsdGVycGxhY2Vob2xkZXIgPSBmaWx0ZXJwbGFjZWhvbGRlcjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdoYXNmaWx0ZXInLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9oYXNmaWx0ZXIpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaGFzZmlsdGVyKSB7XG4gICAgICB0aGlzLl9oYXNmaWx0ZXIgPSBoYXNmaWx0ZXI7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb3B0aW9ucycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNBcnJheSh0aGlzLl9vcHRpb25zKSkgcmV0dXJuIHRoaXMuX29wdGlvbnM7XG4gICAgICB0aGlzLl9vcHRpb25zID0gW107XG4gICAgICByZXR1cm4gdGhpcy5fb3B0aW9ucztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9wdGlvbnMpIHtcbiAgICAgIHZhciBfdGhpczEwID0gdGhpcztcblxuICAgICAgaWYgKCFyZy5pc0FycmF5KG9wdGlvbnMpKSBvcHRpb25zID0gW107XG4gICAgICBvcHRpb25zLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICAgICAgaXRlbS5pbmRleCA9IGk7XG4gICAgICAgIGlmIChpdGVtLnNlbGVjdGVkKSBfdGhpczEwLnNlbGVjdChpdGVtKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZmlsdGVyZWRpdGVtcycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNBcnJheSh0aGlzLl9maWx0ZXJlZGl0ZW1zKSkgcmV0dXJuIHRoaXMuX2ZpbHRlcmVkaXRlbXM7XG4gICAgICB0aGlzLl9maWx0ZXJlZGl0ZW1zID0gW107XG4gICAgICByZXR1cm4gdGhpcy5fZmlsdGVyZWRpdGVtcztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGZpbHRlcmVkaXRlbXMpIHtcbiAgICAgIHRoaXMuX2ZpbHRlcmVkaXRlbXMgPSBmaWx0ZXJlZGl0ZW1zO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29ub3BlbicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNGdW5jdGlvbih0aGlzLl9vbm9wZW4pKSByZXR1cm4gdGhpcy5fb25vcGVuO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChvbm9wZW4pIHtcbiAgICAgIHRoaXMuX29ub3BlbiA9IG9ub3BlbjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdvbmNsb3NlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29uY2xvc2UpKSByZXR1cm4gdGhpcy5fb25jbG9zZTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQob25jbG9zZSkge1xuICAgICAgdGhpcy5fb25jbG9zZSA9IG9uY2xvc2U7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25maWx0ZXInLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24odGhpcy5fb25maWx0ZXIpKSByZXR1cm4gdGhpcy5fb25maWx0ZXI7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9uZmlsdGVyKSB7XG4gICAgICB0aGlzLl9vbmZpbHRlciA9IG9uZmlsdGVyO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29uc2VsZWN0JyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29uc2VsZWN0KSkgcmV0dXJuIHRoaXMuX29uc2VsZWN0O1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChvbnNlbGVjdCkge1xuICAgICAgdGhpcy5fb25zZWxlY3QgPSBvbnNlbGVjdDtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdTZWxlY3Q7XG59KShSZ1RhZyk7XG5cbnZhciBSZ1NpZGVtZW51ID0gKGZ1bmN0aW9uIChfUmdEcmF3ZXIpIHtcbiAgX2luaGVyaXRzKFJnU2lkZW1lbnUsIF9SZ0RyYXdlcik7XG5cbiAgZnVuY3Rpb24gUmdTaWRlbWVudShvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFJnU2lkZW1lbnUpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdTaWRlbWVudS5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMsIG9wdHMpO1xuICB9XG5cbiAgcmV0dXJuIFJnU2lkZW1lbnU7XG59KShSZ0RyYXdlcik7XG5cbnZhciBSZ1RhYnMgPSAoZnVuY3Rpb24gKF9SZ1RhZzE3KSB7XG4gIF9pbmhlcml0cyhSZ1RhYnMsIF9SZ1RhZzE3KTtcblxuICBmdW5jdGlvbiBSZ1RhYnMob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1RhYnMpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoUmdUYWJzLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgaWYgKHJnLmlzVW5kZWZpbmVkKG9wdHMpKSBvcHRzID0ge307XG4gICAgdGhpcy5fdGFicyA9IG9wdHMudGFicztcbiAgICB0aGlzLl9vbm9wZW4gPSBvcHRzLm9ub3BlbjtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ1RhYnMsIFt7XG4gICAga2V5OiAnc2VsZWN0JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VsZWN0KHRhYikge1xuICAgICAgaWYgKCF0YWIuZGlzYWJsZWQpIHtcbiAgICAgICAgdGhpcy50YWJzLmZvckVhY2goZnVuY3Rpb24gKHRhYikge1xuICAgICAgICAgIHRhYi5hY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLm9ub3BlbikgdGhpcy5vbm9wZW4odGFiKTtcbiAgICAgICAgdGFiLmFjdGl2ZSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25vcGVuJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29ub3BlbikpIHJldHVybiB0aGlzLl9vbm9wZW47XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG9ub3Blbikge1xuICAgICAgaWYgKHJnLmlzRnVuY3Rpb24ob25vcGVuKSkgdGhpcy5fb25vcGVuID0gb25vcGVuO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RhYnMnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgdmFyIF90aGlzMTEgPSB0aGlzO1xuXG4gICAgICBpZiAocmcuaXNBcnJheSh0aGlzLl90YWJzKSkge1xuICAgICAgICB2YXIgX3JldCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIGFjdGl2ZVRhYiA9IGZhbHNlO1xuICAgICAgICAgIF90aGlzMTEuX3RhYnMuZm9yRWFjaChmdW5jdGlvbiAodGFiLCBpKSB7XG4gICAgICAgICAgICB0YWIuaW5kZXggPSBpO1xuXG4gICAgICAgICAgICBpZiAoYWN0aXZlVGFiKSB0YWIuYWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGFiLmFjdGl2ZSkgYWN0aXZlVGFiID0gdHJ1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdjogX3RoaXMxMS5fdGFic1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKCk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBfcmV0ID09PSAnb2JqZWN0JykgcmV0dXJuIF9yZXQudjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RhYnMgPSBbXTtcbiAgICAgIHJldHVybiB0aGlzLl90YWJzO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQodGFicykge1xuICAgICAgdGhpcy5fdGFicyA9IHRhYnM7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnVGFicztcbn0pKFJnVGFnKTtcblxudmFyIFJnVGFncyA9IChmdW5jdGlvbiAoX1JnU2VsZWN0KSB7XG4gIF9pbmhlcml0cyhSZ1RhZ3MsIF9SZ1NlbGVjdCk7XG5cbiAgZnVuY3Rpb24gUmdUYWdzKG9wdHMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgUmdUYWdzKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnVGFncy5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIHRoaXMuX3RhZ3MgPSBvcHRzLnRhZ3M7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRzLnZhbHVlO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnVGFncywgW3tcbiAgICBrZXk6ICdhZGRUYWcnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBhZGRUYWcodGFnKSB7XG4gICAgICB0YWcuaW5kZXggPSB0aGlzLnRhZ3MubGVuZ3RoO1xuICAgICAgdGhpcy50YWdzLnB1c2godGFnKTtcbiAgICAgIHRoaXMuaXN2aXNpYmxlID0gZmFsc2U7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncmVtb3ZlVGFnJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVtb3ZlVGFnKHRhZykge1xuICAgICAgdGhpcy50YWdzLnNwbGljZSh0aGlzLnRhZ3MuaW5kZXhPZih0YWcpLCAxKTtcbiAgICAgIHRoaXMuaXN2aXNpYmxlID0gZmFsc2U7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndmFsdWUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3ZhbHVlIHx8ICcnO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQodmFsKSB7XG4gICAgICB0aGlzLl92YWx1ZSA9IHZhbDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd0YWdzJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0FycmF5KHRoaXMuX3RhZ3MpKSByZXR1cm4gdGhpcy5fdGFncztcbiAgICAgIHRoaXMuX3RhZ3MgPSBbXTtcbiAgICAgIHJldHVybiB0aGlzLl90YWdzO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQodGFncykge1xuICAgICAgaWYgKCFyZy5pc0FycmF5KHRhZ3MpKSB0YWdzID0gW107XG4gICAgICB0YWdzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICAgICAgaXRlbS5pbmRleCA9IGk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX3RhZ3MgPSB0YWdzO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ1RhZ3M7XG59KShSZ1NlbGVjdCk7XG5cbnZhciBSZ1RpbWUgPSAoZnVuY3Rpb24gKF9SZ1NlbGVjdDIpIHtcbiAgX2luaGVyaXRzKFJnVGltZSwgX1JnU2VsZWN0Mik7XG5cbiAgZnVuY3Rpb24gUmdUaW1lKG9wdHMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgUmdUaW1lKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnVGltZS5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMsIG9wdHMpO1xuICAgIHRoaXMuX21pbiA9IG9wdHMubWluO1xuICAgIHRoaXMuX21heCA9IG9wdHMubWF4O1xuICAgIHRoaXMuX3RpbWUgPSBvcHRzLnRpbWU7XG4gICAgdGhpcy5fc3RlcCA9IG9wdHMuc3RlcDtcbiAgICB0aGlzLl9hbXBtID0gb3B0cy5hbXBtO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnVGltZSwgW3tcbiAgICBrZXk6ICdtaW4nLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgaWYgKHRoaXMuX21pbikgcmV0dXJuIHRoaXMuX21pbi5zcGxpdCgnOicpO1xuICAgICAgcmV0dXJuIHRoaXMuX21pbjtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG1pbikge1xuICAgICAgdGhpcy5fbWluID0gbWluO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ21heCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAodGhpcy5fbWF4KSByZXR1cm4gdGhpcy5fbWF4LnNwbGl0KCc6Jyk7XG4gICAgICByZXR1cm4gdGhpcy5fbWF4O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQobWF4KSB7XG4gICAgICB0aGlzLl9tYXggPSBtYXg7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndGltZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICBpZiAocmcuaXNEYXRlKHRoaXMuX3RpbWUpKSByZXR1cm4gdGhpcy5fdGltZTtcbiAgICAgIHJldHVybiBuZXcgRGF0ZSgpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQodGltZSkge1xuICAgICAgdGhpcy5fdGltZSA9IHRpbWU7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc3RlcCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9OdW1iZXIodGhpcy5fc3RlcCkgfHwgMTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHN0ZXApIHtcbiAgICAgIHRoaXMuX3N0ZXAgPSBzdGVwO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2FtcG0nLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9hbXBtKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGFtcG0pIHtcbiAgICAgIHRoaXMuX2FtcG0gPSBhbXBtO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBSZ1RpbWU7XG59KShSZ1NlbGVjdCk7XG5cbnZhciBSZ1RvYXN0cyA9IChmdW5jdGlvbiAoX1JnVGFnMTgpIHtcbiAgX2luaGVyaXRzKFJnVG9hc3RzLCBfUmdUYWcxOCk7XG5cbiAgZnVuY3Rpb24gUmdUb2FzdHMob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1RvYXN0cyk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihSZ1RvYXN0cy5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIGlmIChyZy5pc1VuZGVmaW5lZChvcHRzKSkgb3B0cyA9IHt9O1xuICAgIHRoaXMuX3RvYXN0cyA9IG9wdHMudG9hc3RzO1xuICAgIHRoaXMuX3Bvc2l0aW9uID0gb3B0cy5wb3NpdGlvbjtcbiAgICB0aGlzLl9pc3Zpc2libGUgPSBvcHRzLmlzdmlzaWJsZTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ1RvYXN0cywgW3tcbiAgICBrZXk6ICdhZGQnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBhZGQodG9hc3QpIHtcbiAgICAgIHRoaXMudG9hc3RzLnB1c2godG9hc3QpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RvYXN0cycsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICB2YXIgX3RoaXMxMiA9IHRoaXM7XG5cbiAgICAgIGlmIChyZy5pc0FycmF5KHRoaXMuX3RvYXN0cykpIHtcbiAgICAgICAgdGhpcy5fdG9hc3RzLmZvckVhY2goZnVuY3Rpb24gKHRvYXN0KSB7XG4gICAgICAgICAgaWYgKHJnLmlzVW5kZWZpbmVkKHRvYXN0LmlzdmlzaWJsZSkpIHRvYXN0LmlzdmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgdG9hc3QuaWQgPSB0b2FzdC5pZCB8fCByZy51aWQoKTtcbiAgICAgICAgICBpZiAoIXRvYXN0LnRpbWVyICYmICF0b2FzdC5zdGlja3kpIHtcbiAgICAgICAgICAgIHRvYXN0LnN0YXJ0VGltZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHRvYXN0LnRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRvYXN0LmlzdmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRvYXN0Lm9uY2xvc2UpKSB0b2FzdC5vbmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgX3RoaXMxMi51cGRhdGUoKTtcbiAgICAgICAgICAgICAgfSwgcmcudG9OdW1iZXIodG9hc3QudGltZW91dCkgfHwgNjAwMCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdG9hc3Quc3RhcnRUaW1lcigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuaXN2aXNpYmxlID0gdGhpcy5fdG9hc3RzLmZpbHRlcihmdW5jdGlvbiAodG9hc3QpIHtcbiAgICAgICAgICByZXR1cm4gdG9hc3QuaXN2aXNpYmxlO1xuICAgICAgICB9KS5sZW5ndGggPiAwO1xuICAgICAgICByZXR1cm4gdGhpcy5fdG9hc3RzO1xuICAgICAgfVxuICAgICAgdGhpcy5fdG9hdHMgPSBbXTtcbiAgICAgIHJldHVybiB0aGlzLl90b2FzdHM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh0b2FzdHMpIHtcbiAgICAgIHRoaXMuX3RvYXN0cyA9IHRvYXN0cztcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdwb3NpdGlvbicsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcG9zaXRpb24gfHwgJ3RvcHJpZ2h0JztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHBvc2l0aW9uKSB7XG4gICAgICB0aGlzLl9wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2lzdmlzaWJsZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2lzdmlzaWJsZSk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChpc3Zpc2libGUpIHtcbiAgICAgIHRoaXMuX2lzdmlzaWJsZSA9IGlzdmlzaWJsZTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdUb2FzdHM7XG59KShSZ1RhZyk7XG5cbnZhciBSZ1RvZ2dsZSA9IChmdW5jdGlvbiAoX1JnVGFnMTkpIHtcbiAgX2luaGVyaXRzKFJnVG9nZ2xlLCBfUmdUYWcxOSk7XG5cbiAgZnVuY3Rpb24gUmdUb2dnbGUob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1RvZ2dsZSk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihSZ1RvZ2dsZS5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIGlmIChyZy5pc1VuZGVmaW5lZChvcHRzKSkgb3B0cyA9IHt9O1xuICAgIHRoaXMuX2NoZWNrZWQgPSBvcHRzLmNoZWNrZWQ7XG4gICAgdGhpcy5fb250b2dnbGUgPSBvcHRzLm9udG9nZ2xlO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFJnVG9nZ2xlLCBbe1xuICAgIGtleTogJ3RvZ2dsZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHRvZ2dsZSgpIHtcbiAgICAgIHRoaXMuY2hlY2tlZCA9ICF0aGlzLmNoZWNrZWQ7XG4gICAgICBpZiAodGhpcy5vbnRvZ2dsZSkgdGhpcy5vbnRvZ2dsZSh0aGlzLmNoZWNrZWQpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2NoZWNrZWQnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9jaGVja2VkKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGNoZWNrZWQpIHtcbiAgICAgIHRoaXMuX2NoZWNrZWQgPSBjaGVja2VkO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29udG9nZ2xlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIGlmIChyZy5pc0Z1bmN0aW9uKHRoaXMuX29udG9nZ2xlKSkgcmV0dXJuIHRoaXMuX29udG9nZ2xlO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChvbnRvZ2dsZSkge1xuICAgICAgdGhpcy5fb250b2dnbGUgPSBvbnRvZ2dsZTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gUmdUb2dnbGU7XG59KShSZ1RhZyk7XG5cbnZhciBSZ1Vuc3BsYXNoID0gKGZ1bmN0aW9uIChfUmdUYWcyMCkge1xuICBfaW5oZXJpdHMoUmdVbnNwbGFzaCwgX1JnVGFnMjApO1xuXG4gIGZ1bmN0aW9uIFJnVW5zcGxhc2gob3B0cykge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBSZ1Vuc3BsYXNoKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFJnVW5zcGxhc2gucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICBpZiAocmcuaXNVbmRlZmluZWQob3B0cykpIG9wdHMgPSB7fTtcbiAgICB0aGlzLl93aWR0aCA9IG9wdHMud2lkdGg7XG4gICAgdGhpcy5faGVpZ2h0ID0gb3B0cy5oZWlnaHQ7XG4gICAgdGhpcy5fZ3JleXNjYWxlID0gb3B0cy5ncmV5c2NhbGUgfHwgb3B0cy5ncmF5c2NhbGU7XG4gICAgdGhpcy5fcmFuZG9tID0gb3B0cy5yYW5kb207XG4gICAgdGhpcy5fYmx1ciA9IG9wdHMuYmx1cjtcbiAgICB0aGlzLl9pbWFnZSA9IG9wdHMuaW1hZ2U7XG4gICAgdGhpcy5fZ3Jhdml0eSA9IG9wdHMuZ3Jhdml0eTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhSZ1Vuc3BsYXNoLCBbe1xuICAgIGtleTogJ3dpZHRoJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b051bWJlcih0aGlzLl93aWR0aCkgfHwgNDUwO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQod2lkdGgpIHtcbiAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2hlaWdodCcsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9OdW1iZXIodGhpcy5faGVpZ2h0KSB8fCAyNTA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChoZWlnaHQpIHtcbiAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZ3JleXNjYWxlJyxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgIHJldHVybiByZy50b0Jvb2xlYW4odGhpcy5fZ3JleXNjYWxlKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGdyZXlzY2FsZSkge1xuICAgICAgdGhpcy5fZ3JleXNjYWxlID0gZ3JleXNjYWxlO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdncmF5c2NhbGUnLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuZ3JleXNjYWxlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoZ3JheXNjYWxlKSB7XG4gICAgICB0aGlzLmdyZXlzY2FsZSA9IGdyYXlzY2FsZTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyYW5kb20nLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9yYW5kb20pO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQocmFuZG9tKSB7XG4gICAgICB0aGlzLl9yYW5kb20gPSByYW5kb207XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2JsdXInLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9ibHVyKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KGJsdXIpIHtcbiAgICAgIHRoaXMuX2JsdXIgPSBibHVyO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdpbWFnZScsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gcmcudG9OdW1iZXIodGhpcy5faW1hZ2UpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiBzZXQoaW1hZ2UpIHtcbiAgICAgIHRoaXMuX2ltYWdlID0gaW1hZ2U7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2dyYXZpdHknLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2dyYXZpdHk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldChncmF2aXR5KSB7XG4gICAgICB0aGlzLl9ncmF2aXR5ID0gZ3Jhdml0eTtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFJnVW5zcGxhc2g7XG59KShSZ1RhZyk7XG5cbnJpb3QudGFnMigncmctYWxlcnRzJywgJzxkaXYgZWFjaD1cIntSZ0FsZXJ0cy5hbGVydHN9XCIgY2xhc3M9XCJhbGVydCB7dHlwZX0ge2lzdmlzaWJsZTogaXN2aXNpYmxlfVwiIG9uY2xpY2s9XCJ7c2VsZWN0fVwiPiA8YSBjbGFzcz1cImNsb3NlXCIgYXJpYS1sYWJlbD1cIkNsb3NlXCIgb25jbGljaz1cIntwYXJlbnQuZGlzbWlzc31cIiBpZj1cIntkaXNtaXNzYWJsZSAhPSBmYWxzZX1cIj4gPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+JnRpbWVzOzwvc3Bhbj4gPC9hPiA8cmctcmF3IGNvbnRlbnQ9XCJ7Y29udGVudH1cIj48L3JnLXJhdz4gPC9kaXY+JywgJ3JnLWFsZXJ0cyxbcmlvdC10YWc9XCJyZy1hbGVydHNcIl0geyBmb250LXNpemU6IDAuOWVtOyBwb3NpdGlvbjogcmVsYXRpdmU7IHRvcDogMDsgcmlnaHQ6IDA7IGxlZnQ6IDA7IHdpZHRoOiAxMDAlOyB9IHJnLWFsZXJ0cyAuYWxlcnQsW3Jpb3QtdGFnPVwicmctYWxlcnRzXCJdIC5hbGVydCB7IGRpc3BsYXk6IG5vbmU7IHBvc2l0aW9uOiByZWxhdGl2ZTsgbWFyZ2luLWJvdHRvbTogMTVweDsgcGFkZGluZzogMTVweCAzNXB4IDE1cHggMTVweDsgfSByZy1hbGVydHMgLmlzdmlzaWJsZSxbcmlvdC10YWc9XCJyZy1hbGVydHNcIl0gLmlzdmlzaWJsZSB7IGRpc3BsYXk6IGJsb2NrOyB9IHJnLWFsZXJ0cyAuY2xvc2UsW3Jpb3QtdGFnPVwicmctYWxlcnRzXCJdIC5jbG9zZSB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiA1MCU7IHJpZ2h0OiAyMHB4OyBsaW5lLWhlaWdodDogMTJweDsgZm9udC1zaXplOiAxLjFlbTsgYm9yZGVyOiAwOyBiYWNrZ3JvdW5kLWNvbG9yOiB0cmFuc3BhcmVudDsgY29sb3I6IHJnYmEoMCwgMCwgMCwgMC41KTsgY3Vyc29yOiBwb2ludGVyOyBvdXRsaW5lOiBub25lOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDAsIC01MCUsIDApOyB9IHJnLWFsZXJ0cyAuZGFuZ2VyLFtyaW90LXRhZz1cInJnLWFsZXJ0c1wiXSAuZGFuZ2VyIHsgY29sb3I6ICM4ZjFkMmU7IGJhY2tncm91bmQtY29sb3I6ICNmZmNlZDg7IH0gcmctYWxlcnRzIC5pbmZvcm1hdGlvbixbcmlvdC10YWc9XCJyZy1hbGVydHNcIl0gLmluZm9ybWF0aW9uIHsgY29sb3I6ICMzMTcwOGY7IGJhY2tncm91bmQtY29sb3I6ICNkOWVkZjc7IH0gcmctYWxlcnRzIC5zdWNjZXNzLFtyaW90LXRhZz1cInJnLWFsZXJ0c1wiXSAuc3VjY2VzcyB7IGNvbG9yOiAjMmQ4ZjQwOyBiYWNrZ3JvdW5kLWNvbG9yOiAjY2NmN2Q0OyB9IHJnLWFsZXJ0cyAud2FybmluZyxbcmlvdC10YWc9XCJyZy1hbGVydHNcIl0gLndhcm5pbmcgeyBjb2xvcjogI2MwNjMyOTsgYmFja2dyb3VuZC1jb2xvcjogI2Y3ZGZkMDsgfScsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMyID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgdGhpcy5SZ0FsZXJ0cyA9IG9wdHMuYWxlcnRzIHx8IG5ldyBSZ0FsZXJ0cyhvcHRzKTtcbiAgICB0aGlzLlJnQWxlcnRzLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICB0aGlzLnVwZGF0ZSgpO1xuICB9KTtcblxuICB0aGlzLmRpc21pc3MgPSBmdW5jdGlvbiAoZSkge1xuICAgIHZhciBhbGVydCA9IGUuaXRlbTtcbiAgICBfdGhpczIuUmdBbGVydHMuZGlzbWlzcyhhbGVydCk7XG4gIH07XG5cbiAgdGhpcy5zZWxlY3QgPSBmdW5jdGlvbiAoZSkge1xuICAgIHZhciBhbGVydCA9IGUuaXRlbTtcbiAgICBfdGhpczIuUmdBbGVydHMuc2VsZWN0KGFsZXJ0KTtcbiAgfTtcbn0sICd7IH0nKTtcblxucmlvdC50YWcyKCdyZy1iZWhvbGQnLCAnPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPiA8ZGl2IGNsYXNzPVwiY29udHJvbHNcIj4gPGRpdiBjbGFzcz1cIm1vZGVzXCI+IDxhIG9uY2xpY2s9XCJ7c3dpcGVNb2RlfVwiIGNsYXNzPVwibW9kZSB7YWN0aXZlOiBSZ0JlaG9sZC5tb2RlID09IFxcJ3N3aXBlXFwnfVwiPlN3aXBlPC9hPiA8YSBvbmNsaWNrPVwie2ZhZGVNb2RlfVwiIGNsYXNzPVwibW9kZSB7YWN0aXZlOiBSZ0JlaG9sZC5tb2RlID09IFxcJ2ZhZGVcXCd9XCI+RmFkZTwvYT4gPC9kaXY+IDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBjbGFzcz1cInJhbmdlclwiIG5hbWU9XCJkaWZmXCIgdmFsdWU9XCIwXCIgbWluPVwiMFwiIG1heD1cIjFcIiBzdGVwPVwiMC4wMVwiIG9uaW5wdXQ9XCJ7dXBkYXRlRGlmZn1cIiBvbmNoYW5nZT1cInt1cGRhdGVEaWZmfVwiPiA8L2Rpdj4gPGRpdiBjbGFzcz1cImltYWdlc1wiPiA8ZGl2IGNsYXNzPVwiaW1hZ2VcIj4gPGltZyBjbGFzcz1cImltYWdlLTJcIiByaW90LXNyYz1cIntSZ0JlaG9sZC5pbWFnZTJ9XCI+IDwvZGl2PiA8ZGl2IGNsYXNzPVwiaW1hZ2UgZmFsbGJhY2tcIj4gPGltZyBjbGFzcz1cImltYWdlLTFcIiByaW90LXNyYz1cIntSZ0JlaG9sZC5pbWFnZTF9XCI+IDwvZGl2PiA8L2Rpdj4gPC9kaXY+JywgJ3JnLWJlaG9sZCAuY29udHJvbHMsW3Jpb3QtdGFnPVwicmctYmVob2xkXCJdIC5jb250cm9scyB7IHRleHQtYWxpZ246IGNlbnRlcjsgfSByZy1iZWhvbGQgLm1vZGUsW3Jpb3QtdGFnPVwicmctYmVob2xkXCJdIC5tb2RlIHsgdGV4dC1kZWNvcmF0aW9uOiBub25lOyBjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDAgMTBweDsgfSByZy1iZWhvbGQgYS5hY3RpdmUsW3Jpb3QtdGFnPVwicmctYmVob2xkXCJdIGEuYWN0aXZlIHsgZm9udC13ZWlnaHQ6IGJvbGQ7IH0gcmctYmVob2xkIC5yYW5nZXIsW3Jpb3QtdGFnPVwicmctYmVob2xkXCJdIC5yYW5nZXIgeyB3aWR0aDogOTAlOyBtYXgtd2lkdGg6IDMwMHB4OyB9IHJnLWJlaG9sZCAuaW1hZ2VzLFtyaW90LXRhZz1cInJnLWJlaG9sZFwiXSAuaW1hZ2VzIHsgcG9zaXRpb246IHJlbGF0aXZlOyB9IHJnLWJlaG9sZCAuaW1hZ2UsW3Jpb3QtdGFnPVwicmctYmVob2xkXCJdIC5pbWFnZSB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgd2lkdGg6IDEwMCU7IHRleHQtYWxpZ246IGNlbnRlcjsgfSByZy1iZWhvbGQgLmltYWdlIGltZyxbcmlvdC10YWc9XCJyZy1iZWhvbGRcIl0gLmltYWdlIGltZyB7IG1heC13aWR0aDogOTAlOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpczIgPSB0aGlzO1xuXG4gIHZhciBpbWFnZTEgPSB1bmRlZmluZWQsXG4gICAgICBpbWFnZTIgPSB1bmRlZmluZWQsXG4gICAgICBmYWxsYmFjayA9IHVuZGVmaW5lZDtcblxuICB2YXIgdmlld2VyID0gZnVuY3Rpb24gdmlld2VyKCkge1xuICAgIGltYWdlMSA9IF90aGlzMi5yb290LnF1ZXJ5U2VsZWN0b3IoJy5pbWFnZS0xJyk7XG4gICAgaW1hZ2UyID0gX3RoaXMyLnJvb3QucXVlcnlTZWxlY3RvcignLmltYWdlLTInKTtcbiAgICBmYWxsYmFjayA9IHR5cGVvZiBpbWFnZTEuc3R5bGUud2Via2l0Q2xpcFBhdGggPT0gJ3VuZGVmaW5lZCc7XG5cbiAgICB2YXIgaW1nMUxvYWRlZCA9IHVuZGVmaW5lZCxcbiAgICAgICAgaW1nMkxvYWRlZCA9IHVuZGVmaW5lZCxcbiAgICAgICAgaW1nMUggPSB1bmRlZmluZWQsXG4gICAgICAgIGltZzJIID0gdW5kZWZpbmVkO1xuICAgIHZhciBpbWcxID0gbmV3IEltYWdlKCk7XG4gICAgdmFyIGltZzIgPSBuZXcgSW1hZ2UoKTtcbiAgICBpbWcxLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGltZzFMb2FkZWQgPSB0cnVlO1xuICAgICAgaW1nMUggPSB0aGlzLmhlaWdodDtcbiAgICAgIGNhbGN1bGF0ZU1heEhlaWdodCgpO1xuICAgIH07XG4gICAgaW1nMi5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpbWcyTG9hZGVkID0gdHJ1ZTtcbiAgICAgIGltZzJIID0gdGhpcy5oZWlnaHQ7XG4gICAgICBjYWxjdWxhdGVNYXhIZWlnaHQoKTtcbiAgICB9O1xuICAgIGltZzEuc3JjID0gX3RoaXMyLlJnQmVob2xkLmltYWdlMTtcbiAgICBpbWcyLnNyYyA9IF90aGlzMi5SZ0JlaG9sZC5pbWFnZTI7XG5cbiAgICB2YXIgX3RoaXMgPSBfdGhpczI7XG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVNYXhIZWlnaHQoKSB7XG4gICAgICBpZiAoaW1nMUxvYWRlZCAmJiBpbWcyTG9hZGVkKSB7XG4gICAgICAgIHZhciBjb250cm9scyA9IF90aGlzLnJvb3QucXVlcnlTZWxlY3RvcignLmNvbnRyb2xzJyk7XG4gICAgICAgIHZhciBjb250YWluZXIgPSBfdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoJy5jb250YWluZXInKTtcbiAgICAgICAgY29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGNvbnRyb2xzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCArIE1hdGgubWF4KGltZzFILCBpbWcySCkgKyAncHgnO1xuICAgICAgICBfdGhpcy51cGRhdGVEaWZmKCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzMi5SZ0JlaG9sZCA9IG9wdHMuYmVob2xkIHx8IG5ldyBSZ0JlaG9sZChvcHRzKTtcbiAgICBfdGhpczIuUmdCZWhvbGQub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIF90aGlzMi51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpczIub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZpZXdlcigpO1xuICAgIH0pO1xuICAgIF90aGlzMi51cGRhdGUoKTtcbiAgfSk7XG5cbiAgdGhpcy5zd2lwZU1vZGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMyLmRpZmYudmFsdWUgPSAwO1xuICAgIF90aGlzMi51cGRhdGVEaWZmKCk7XG4gICAgX3RoaXMyLlJnQmVob2xkLm1vZGUgPSAnc3dpcGUnO1xuICB9O1xuICB0aGlzLmZhZGVNb2RlID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzMi5kaWZmLnZhbHVlID0gMDtcbiAgICBfdGhpczIudXBkYXRlRGlmZigpO1xuICAgIF90aGlzMi5SZ0JlaG9sZC5tb2RlID0gJ2ZhZGUnO1xuICB9O1xuXG4gIHRoaXMudXBkYXRlRGlmZiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoX3RoaXMyLlJnQmVob2xkLm1vZGUgPT0gJ2ZhZGUnKSB7XG4gICAgICBpbWFnZTEuc3R5bGUub3BhY2l0eSA9IDEgLSBfdGhpczIuZGlmZi52YWx1ZTtcbiAgICB9IGVsc2UgaWYgKF90aGlzMi5SZ0JlaG9sZC5tb2RlID09ICdzd2lwZScpIHtcbiAgICAgIGlmICghZmFsbGJhY2spIHtcbiAgICAgICAgaW1hZ2UxLnN0eWxlLmNsaXBQYXRoID0gaW1hZ2UxLnN0eWxlLndlYmtpdENsaXBQYXRoID0gJ2luc2V0KDAgMCAwICcgKyAoaW1hZ2UxLmNsaWVudFdpZHRoICogX3RoaXMyLmRpZmYudmFsdWUgLSAxKSArICdweCknO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGZhbGxiYWNrSW1nID0gX3RoaXMyLnJvb3QucXVlcnlTZWxlY3RvcignLmZhbGxiYWNrJyk7XG4gICAgICAgIGZhbGxiYWNrSW1nLnN0eWxlLmNsaXAgPSAncmVjdChhdXRvLCBhdXRvLCBhdXRvLCAnICsgZmFsbGJhY2tJbWcuY2xpZW50V2lkdGggKiBfdGhpczIuZGlmZi52YWx1ZSArICdweCknO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn0sICd7IH0nKTtcblxucmlvdC50YWcyKCdyZy1idWJibGUnLCAnPGRpdiBjbGFzcz1cImNvbnRleHRcIj4gPGRpdiBjbGFzcz1cImJ1YmJsZSB7aXN2aXNpYmxlOiBSZ0J1YmJsZS5pc3Zpc2libGV9XCI+IDxyZy1yYXcgY29udGVudD1cIntSZ0J1YmJsZS5jb250ZW50fVwiPjwvcmctcmF3PiA8L2Rpdj4gPGRpdiBjbGFzcz1cImNvbnRlbnRcIiBvbm1vdXNlb3Zlcj1cIntzaG93QnViYmxlfVwiIG9ubW91c2VvdXQ9XCJ7aGlkZUJ1YmJsZX1cIiBvbmNsaWNrPVwie3RvZ2dsZUJ1YmJsZX1cIj4gPHlpZWxkPjwveWllbGQ+IDwvZGl2PiA8L2Rpdj4nLCAncmctYnViYmxlIC5jb250ZXh0LFtyaW90LXRhZz1cInJnLWJ1YmJsZVwiXSAuY29udGV4dCxyZy1idWJibGUgLmNvbnRlbnQsW3Jpb3QtdGFnPVwicmctYnViYmxlXCJdIC5jb250ZW50IHsgZGlzcGxheTogaW5saW5lLWJsb2NrOyBwb3NpdGlvbjogcmVsYXRpdmU7IH0gcmctYnViYmxlIC5idWJibGUsW3Jpb3QtdGFnPVwicmctYnViYmxlXCJdIC5idWJibGUgeyBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogLTUwcHg7IGxlZnQ6IDUwJTsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgtNTAlLCAwLCAwKTsgcGFkZGluZzogMTBweCAxNXB4OyBiYWNrZ3JvdW5kLWNvbG9yOiAjMDAwOyBjb2xvcjogd2hpdGU7IHRleHQtYWxpZ246IGNlbnRlcjsgZm9udC1zaXplOiAwLjllbTsgbGluZS1oZWlnaHQ6IDE7IHdoaXRlLXNwYWNlOiBub3dyYXA7IGRpc3BsYXk6IG5vbmU7IH0gcmctYnViYmxlIC5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctYnViYmxlXCJdIC5pc3Zpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy1idWJibGUgLmJ1YmJsZTphZnRlcixbcmlvdC10YWc9XCJyZy1idWJibGVcIl0gLmJ1YmJsZTphZnRlciB7IGNvbnRlbnQ6IFxcJ1xcJzsgcG9zaXRpb246IGFic29sdXRlOyBkaXNwbGF5OiBibG9jazsgYm90dG9tOiAtMjBweDsgbGVmdDogNTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKC01MCUsIDAsIDApOyB3aWR0aDogMDsgaGVpZ2h0OiAwOyBib3JkZXI6IDEwcHggc29saWQgdHJhbnNwYXJlbnQ7IGJvcmRlci10b3AtY29sb3I6ICMwMDA7IH0nLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ0J1YmJsZSA9IG9wdHMuYnViYmxlIHx8IG5ldyBSZ0J1YmJsZShvcHRzKTtcbiAgICBfdGhpcy5SZ0J1YmJsZS5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMuc2hvd0J1YmJsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ0J1YmJsZS5zaG93QnViYmxlKCk7XG4gIH07XG5cbiAgdGhpcy5oaWRlQnViYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnQnViYmxlLmhpZGVCdWJibGUoKTtcbiAgfTtcblxuICB0aGlzLnRvZ2dsZUJ1YmJsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ0J1YmJsZS50b2dnbGVCdWJibGUoKTtcbiAgfTtcbn0sICd7IH0nKTtcblxucmlvdC50YWcyKCdyZy1jb2RlJywgJzxkaXYgY2xhc3M9XCJlZGl0b3JcIj48L2Rpdj4nLCAncmctY29kZSAuZWRpdG9yLFtyaW90LXRhZz1cInJnLWNvZGVcIl0gLmVkaXRvciB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAwOyByaWdodDogMDsgYm90dG9tOiAwOyBsZWZ0OiAwOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdmFyIGVkaXRvciA9IHVuZGVmaW5lZDtcblxuICB2YXIgc2V0dXBFZGl0b3IgPSBmdW5jdGlvbiBzZXR1cEVkaXRvcigpIHtcbiAgICBlZGl0b3Iuc2V0VGhlbWUoJ2FjZS90aGVtZS8nICsgX3RoaXMuUmdDb2RlLnRoZW1lKTtcbiAgICBlZGl0b3IuZ2V0U2Vzc2lvbigpLnNldE1vZGUoJ2FjZS9tb2RlLycgKyBfdGhpcy5SZ0NvZGUubW9kZSk7XG4gICAgZWRpdG9yLmdldFNlc3Npb24oKS5zZXRUYWJTaXplKF90aGlzLlJnQ29kZS50YWJzaXplKTtcbiAgICBlZGl0b3IuZ2V0U2Vzc2lvbigpLnNldFVzZVNvZnRUYWJzKF90aGlzLlJnQ29kZS5zb2Z0dGFicyk7XG4gICAgZWRpdG9yLmdldFNlc3Npb24oKS5zZXRVc2VXcmFwTW9kZShfdGhpcy5SZ0NvZGUud29yZHdyYXApO1xuICAgIGVkaXRvci5zZXRSZWFkT25seShfdGhpcy5SZ0NvZGUucmVhZG9ubHkpO1xuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIGVkaXRvciA9IGFjZS5lZGl0KF90aGlzLnJvb3QucXVlcnlTZWxlY3RvcignLmVkaXRvcicpKTtcbiAgICBlZGl0b3IuJGJsb2NrU2Nyb2xsaW5nID0gSW5maW5pdHk7XG5cbiAgICBfdGhpcy5SZ0NvZGUgPSBvcHRzLmVkaXRvciB8fCBuZXcgUmdDb2RlKG9wdHMpO1xuICAgIF90aGlzLlJnQ29kZS5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNldHVwRWRpdG9yKCk7XG4gICAgICBpZiAoX3RoaXMuUmdDb2RlLmNvZGUgIT0gZWRpdG9yLmdldFZhbHVlKCkpIGVkaXRvci5zZXRWYWx1ZShfdGhpcy5SZ0NvZGUuY29kZSwgMSk7XG4gICAgfSk7XG4gICAgaWYgKF90aGlzLlJnQ29kZS51cmwpIHtcbiAgICAgIHJnLnhocignZ2V0JywgX3RoaXMuUmdDb2RlLnVybCwgZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgX3RoaXMuUmdDb2RlLmNvZGUgPSByZXNwO1xuICAgICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBlZGl0b3Iuc2V0VmFsdWUoX3RoaXMuUmdDb2RlLmNvZGUsIDEpO1xuICAgIGVkaXRvci5nZXRTZXNzaW9uKCkub24oJ2NoYW5nZScsIGZ1bmN0aW9uIChlKSB7XG4gICAgICBfdGhpcy5SZ0NvZGUuY29kZSA9IGVkaXRvci5nZXRWYWx1ZSgpO1xuICAgICAgaWYgKF90aGlzLlJnQ29kZS5vbmNoYW5nZSkgX3RoaXMuUmdDb2RlLm9uY2hhbmdlKGVkaXRvci5nZXRWYWx1ZSgpKTtcbiAgICB9KTtcbiAgICBzZXR1cEVkaXRvcigpO1xuICAgIF90aGlzLnVwZGF0ZSgpO1xuICB9KTtcbn0pO1xuXG5yaW90LnRhZzIoJ3JnLWNvbnRleHQtbWVudScsICc8ZGl2IGNsYXNzPVwibWVudSB7aXN2aXNpYmxlOiBSZ0NvbnRleHRNZW51LmlzdmlzaWJsZX1cIj4gPGRpdiBjbGFzcz1cImxpc3RcIj4gPGRpdiBlYWNoPVwie1JnQ29udGV4dE1lbnUuaXRlbXN9XCIgY2xhc3M9XCJpdGVtIHtpbmFjdGl2ZTogaW5hY3RpdmV9XCIgb25jbGljaz1cIntzZWxlY3RJdGVtfVwiPiA8cmctcmF3IGNvbnRlbnQ9XCJ7Y29udGVudH1cIj48L3JnLXJhdz4gPC9kaXY+IDx5aWVsZD48L3lpZWxkPiA8L2Rpdj4gPC9kaXY+JywgJ3JnLWNvbnRleHQtbWVudSAubWVudSxbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLm1lbnUgeyBkaXNwbGF5OiBub25lOyBwb3NpdGlvbjogYWJzb2x1dGU7IGJhY2tncm91bmQtY29sb3I6IHdoaXRlOyBib3JkZXI6IDFweCBzb2xpZCAjRDNEM0QzOyB0ZXh0LWFsaWduOiBsZWZ0OyAtd2Via2l0LXVzZXItc2VsZWN0OiBub25lOyAtbW96LXVzZXItc2VsZWN0OiBub25lOyAtbXMtdXNlci1zZWxlY3Q6IG5vbmU7IHVzZXItc2VsZWN0OiBub25lOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB6LWluZGV4OiAyOyB9IHJnLWNvbnRleHQtbWVudSAubWVudS5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctY29udGV4dC1tZW51XCJdIC5tZW51LmlzdmlzaWJsZSB7IGRpc3BsYXk6IGJsb2NrOyB9IHJnLWNvbnRleHQtbWVudSAuaXRlbSxbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLml0ZW0geyBjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDEwcHg7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjRThFOEU4OyBiYWNrZ3JvdW5kLWNvbG9yOiAjZmZmOyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpczsgfSByZy1jb250ZXh0LW1lbnUgLml0ZW06Zmlyc3QtY2hpbGQsW3Jpb3QtdGFnPVwicmctY29udGV4dC1tZW51XCJdIC5pdGVtOmZpcnN0LWNoaWxkIHsgYm9yZGVyLXRvcDogMDsgfSByZy1jb250ZXh0LW1lbnUgLml0ZW06aG92ZXIsW3Jpb3QtdGFnPVwicmctY29udGV4dC1tZW51XCJdIC5pdGVtOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogI2YzZjNmMzsgfSByZy1jb250ZXh0LW1lbnUgLml0ZW0uaW5hY3RpdmUsW3Jpb3QtdGFnPVwicmctY29udGV4dC1tZW51XCJdIC5pdGVtLmluYWN0aXZlIHsgY29sb3I6ICM4YThhOGE7IGZvbnQtc3R5bGU6IGl0YWxpYzsgfSByZy1jb250ZXh0LW1lbnUgLml0ZW0uaW5hY3RpdmU6aG92ZXIsW3Jpb3QtdGFnPVwicmctY29udGV4dC1tZW51XCJdIC5pdGVtLmluYWN0aXZlOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogI2ZmZjsgfScsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHZhciBoYW5kbGVDbGlja091dHNpZGUgPSBmdW5jdGlvbiBoYW5kbGVDbGlja091dHNpZGUoZSkge1xuICAgIGlmICghX3RoaXMucm9vdC5jb250YWlucyhlLnRhcmdldCkpIHtcbiAgICAgIGlmIChfdGhpcy5SZ0NvbnRleHRNZW51Lm9uY2xvc2UgJiYgX3RoaXMuUmdDb250ZXh0TWVudS5pc3Zpc2libGUpIF90aGlzLlJnQ29udGV4dE1lbnUub25jbG9zZShlKTtcbiAgICAgIF90aGlzLlJnQ29udGV4dE1lbnUuaXN2aXNpYmxlID0gZmFsc2U7XG4gICAgfVxuICB9O1xuXG4gIHZhciBvcGVuTWVudSA9IGZ1bmN0aW9uIG9wZW5NZW51KGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgaWYgKF90aGlzLlJnQ29udGV4dE1lbnUub25vcGVuKSBfdGhpcy5SZ0NvbnRleHRNZW51Lm9ub3BlbihlKTtcbiAgICBfdGhpcy5SZ0NvbnRleHRNZW51LmlzdmlzaWJsZSA9IHRydWU7XG5cbiAgICB2YXIgeCA9IGUucGFnZVg7XG4gICAgdmFyIHkgPSBlLnBhZ2VZO1xuICAgIHZhciBkZCA9IF90aGlzLnJvb3QucXVlcnlTZWxlY3RvcignLm1lbnUnKTtcbiAgICB2YXIgZGRSZWN0ID0gZGQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICBpZiAoeCA+IHdpbmRvdy5pbm5lcldpZHRoICsgd2luZG93LnNjcm9sbFggLSBkZFJlY3Qud2lkdGgpIHggPSB3aW5kb3cuaW5uZXJXaWR0aCArIHdpbmRvdy5zY3JvbGxYIC0gZGRSZWN0LndpZHRoO1xuXG4gICAgZGQuc3R5bGUubGVmdCA9IHggKyAncHgnO1xuXG4gICAgaWYgKHkgPiB3aW5kb3cuaW5uZXJIZWlnaHQgKyB3aW5kb3cuc2Nyb2xsWSAtIGRkUmVjdC5oZWlnaHQpIHkgPSB3aW5kb3cuaW5uZXJIZWlnaHQgKyB3aW5kb3cuc2Nyb2xsWSAtIGRkUmVjdC5oZWlnaHQ7XG5cbiAgICBkZC5zdHlsZS50b3AgPSB5ICsgJ3B4JztcbiAgICBfdGhpcy51cGRhdGUoKTtcbiAgfTtcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ0NvbnRleHRNZW51ID0gb3B0cy5tZW51IHx8IG5ldyBSZ0NvbnRleHRNZW51KG9wdHMpO1xuICAgIF90aGlzLlJnQ29udGV4dE1lbnUub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH0pO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlQ2xpY2tPdXRzaWRlKTtcbiAgICB2YXIgdGFyZ2V0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tyZy1jb250ZXh0LW1lbnVdJyk7XG4gICAgZm9yICh2YXIgaSA9IDAsIHRhcmdldDsgdGFyZ2V0ID0gdGFyZ2V0c1tpXTsgaSsrKSB7XG4gICAgICBpZiAodGFyZ2V0LmF0dHJpYnV0ZXNbJ3JnLWNvbnRleHQtbWVudSddLnZhbHVlID09IF90aGlzLlJnQ29udGV4dE1lbnUubmFtZSkgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51Jywgb3Blbk1lbnUpO2Vsc2UgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgX3RoaXMuY2xvc2VNZW51KTtcbiAgICB9XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMub24oJ3VubW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDbGlja091dHNpZGUpO1xuICAgIHZhciB0YXJnZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW3JnLWNvbnRleHQtbWVudV0nKTtcbiAgICBmb3IgKHZhciBpID0gMCwgdGFyZ2V0OyB0YXJnZXQgPSB0YXJnZXRzW2ldOyBpKyspIHtcbiAgICAgIGlmICh0YXJnZXQuYXR0cmlidXRlc1sncmctY29udGV4dC1tZW51J10udmFsdWUgPT0gX3RoaXMuUmdDb250ZXh0TWVudS5uYW1lKSB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBvcGVuTWVudSk7ZWxzZSB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBfdGhpcy5jbG9zZU1lbnUpO1xuICAgIH1cbiAgfSk7XG5cbiAgdGhpcy5jbG9zZU1lbnUgPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdDb250ZXh0TWVudS5pc3Zpc2libGUgPSBmYWxzZTtcbiAgfTtcblxuICB0aGlzLnNlbGVjdEl0ZW0gPSBmdW5jdGlvbiAoaXRlbSkge1xuICAgIGl0ZW0gPSBpdGVtLml0ZW07XG4gICAgX3RoaXMuUmdDb250ZXh0TWVudS5zZWxlY3QoaXRlbSk7XG4gIH07XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctY3JlZGl0LWNhcmQtbnVtYmVyJywgJzxpbnB1dCB0eXBlPVwidGV4dFwiIG5hbWU9XCJjYXJkbnVtYmVyXCIgY2xhc3M9XCJmaWVsZCBjYXJkLW5vIHtSZ0NyZWRpdENhcmQuaWNvbn0ge3ZhbGlkOiBSZ0NyZWRpdENhcmQudmFsaWR9XCIgb25pbnB1dD1cInt2YWxpZGF0ZX1cIiBwbGFjZWhvbGRlcj1cIntSZ0NyZWRpdENhcmQucGxhY2Vob2xkZXJ9XCI+JywgJ3JnLWNyZWRpdC1jYXJkLW51bWJlciAuZmllbGQsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5maWVsZCB7IGZvbnQtc2l6ZTogMWVtOyBwYWRkaW5nOiAxMHB4OyBib3JkZXI6IDFweCBzb2xpZCAjRDNEM0QzOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyBvdXRsaW5lOiBub25lOyAtd2Via2l0LWFwcGVhcmFuY2U6IG5vbmU7IC1tb3otYXBwZWFyYW5jZTogbm9uZTsgYXBwZWFyYW5jZTogbm9uZTsgfSByZy1jcmVkaXQtY2FyZC1udW1iZXIgLmNhcmQtbm8sW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5jYXJkLW5vIHsgcGFkZGluZy1yaWdodDogNjBweDsgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDsgYmFja2dyb3VuZC1wb3NpdGlvbjogcmlnaHQgY2VudGVyOyBiYWNrZ3JvdW5kLXNpemU6IDYwcHg7IH0gcmctY3JlZGl0LWNhcmQtbnVtYmVyIC5hbWV4LFtyaW90LXRhZz1cInJnLWNyZWRpdC1jYXJkLW51bWJlclwiXSAuYW1leCB7IGJhY2tncm91bmQtaW1hZ2U6IHVybChpbWcvYW1leC5wbmcpOyB9IHJnLWNyZWRpdC1jYXJkLW51bWJlciAuZGluZXJzX2NsdWIsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5kaW5lcnNfY2x1YiB7IGJhY2tncm91bmQtaW1hZ2U6IHVybChpbWcvZGluZXJzX2NsdWIucG5nKTsgfSByZy1jcmVkaXQtY2FyZC1udW1iZXIgLmRpc2NvdmVyLFtyaW90LXRhZz1cInJnLWNyZWRpdC1jYXJkLW51bWJlclwiXSAuZGlzY292ZXIgeyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaW1nL2Rpc2NvdmVyLnBuZyk7IH0gcmctY3JlZGl0LWNhcmQtbnVtYmVyIC5qY2IsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5qY2IgeyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaW1nL2pjYi5wbmcpOyB9IHJnLWNyZWRpdC1jYXJkLW51bWJlciAubWFzdGVyY2FyZCxbcmlvdC10YWc9XCJyZy1jcmVkaXQtY2FyZC1udW1iZXJcIl0gLm1hc3RlcmNhcmQgeyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaW1nL21hc3RlcmNhcmQucG5nKTsgfSByZy1jcmVkaXQtY2FyZC1udW1iZXIgLnZpc2EsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC52aXNhIHsgYmFja2dyb3VuZC1pbWFnZTogdXJsKGltZy92aXNhLnBuZyk7IH0nLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB2YXIgc2V0VUkgPSBmdW5jdGlvbiBzZXRVSSgpIHtcbiAgICBpZiAoX3RoaXMuY2FyZG51bWJlci52YWx1ZSAhPSBfdGhpcy5SZ0NyZWRpdENhcmQuY2FyZG51bWJlcikgX3RoaXMuY2FyZG51bWJlci52YWx1ZSA9IF90aGlzLlJnQ3JlZGl0Q2FyZC5jYXJkbnVtYmVyO1xuICAgIF90aGlzLlJnQ3JlZGl0Q2FyZC52YWxpZGF0ZSgpO1xuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnQ3JlZGl0Q2FyZCA9IG9wdHMuY2FyZCB8fCBuZXcgUmdDcmVkaXRDYXJkKG9wdHMpO1xuICAgIF90aGlzLlJnQ3JlZGl0Q2FyZC5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNldFVJKCk7XG4gICAgfSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMudmFsaWRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdDcmVkaXRDYXJkLmNhcmRudW1iZXIgPSBfdGhpcy5jYXJkbnVtYmVyLnZhbHVlO1xuICAgIF90aGlzLlJnQ3JlZGl0Q2FyZC52YWxpZGF0ZSgpO1xuICB9O1xufSwgJ3sgfScpO1xuXG5yaW90LnRhZzIoJ3JnLWRhdGUnLCAnPGRpdiBjbGFzcz1cImNvbnRhaW5lciB7b3BlbjogUmdEYXRlLmlzdmlzaWJsZX1cIj4gPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJmaWVsZFwiIG9uY2xpY2s9XCJ7b3Blbn1cIiB2YWx1ZT1cIntSZ0RhdGUuZGF0ZUZvcm1hdHRlZH1cIiByZWFkb25seT4gPGRpdiBjbGFzcz1cImNhbGVuZGFyXCIgc2hvdz1cIntSZ0RhdGUuaXN2aXNpYmxlfVwiPiA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLXJvd1wiIGlmPVwie1JnRGF0ZS5zaG93WWVhcnN9XCI+IDxkaXYgY2xhc3M9XCJzZWxlY3RvclwiIG9uY2xpY2s9XCJ7cHJldlllYXJ9XCI+JmxzYXF1bzs8L2Rpdj4gPHNwYW4gY2xhc3M9XCJ5ZWFyXCI+e1JnRGF0ZS55ZWFyfTwvc3Bhbj4gPGRpdiBjbGFzcz1cInNlbGVjdG9yXCIgb25jbGljaz1cIntuZXh0WWVhcn1cIj4mcnNhcXVvOzwvZGl2PiA8L2Rpdj4gPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC1yb3dcIiBpZj1cInshUmdEYXRlLnNob3dZZWFyc31cIj4gPHNwYW4gY2xhc3M9XCJ5ZWFyIGZpbGxcIj57UmdEYXRlLnllYXJ9PC9zcGFuPiA8L2Rpdj4gPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC1yb3dcIiBpZj1cIntSZ0RhdGUuc2hvd01vbnRoc31cIj4gPGRpdiBjbGFzcz1cInNlbGVjdG9yXCIgb25jbGljaz1cIntwcmV2TW9udGh9XCI+JmxzYXF1bzs8L2Rpdj4gPHNwYW4gY2xhc3M9XCJtb250aFwiPntSZ0RhdGUubW9udGh9PC9zcGFuPiA8ZGl2IGNsYXNzPVwic2VsZWN0b3JcIiBvbmNsaWNrPVwie25leHRNb250aH1cIj4mcnNhcXVvOzwvZGl2PiA8L2Rpdj4gPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC1yb3dcIiBpZj1cInshUmdEYXRlLnNob3dNb250aHN9XCI+IDxzcGFuIGNsYXNzPVwibW9udGggZmlsbFwiPntSZ0RhdGUubW9udGh9PC9zcGFuPiA8L2Rpdj4gPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC1yb3dcIj4gPHNwYW4gY2xhc3M9XCJkYXktbmFtZVwiIGVhY2g9XCJ7ZGF5IGluIFJnRGF0ZS5kYXlOYW1lc31cIj57ZGF5fTwvc3Bhbj4gPC9kaXY+IDxkaXYgY2xhc3M9XCJncmlkIGdyaWQtd3JhcFwiPiA8ZGl2IGVhY2g9XCJ7ZGF5IGluIHN0YXJ0QnVmZmVyfVwiIG9uY2xpY2s9XCJ7c2VsZWN0fVwiIGNsYXNzPVwiZGF0ZSB7aW46IGRheS5pbk1vbnRoLCBzZWxlY3RlZDogZGF5LnNlbGVjdGVkLCB0b2RheTogZGF5LnRvZGF5fVwiPiB7ZGF5LmRhdGUuZm9ybWF0KHRoaXMuUmdEYXRlLmRheUZvcm1hdCl9IDwvZGl2PiA8ZGl2IGVhY2g9XCJ7ZGF5IGluIGRheXN9XCIgb25jbGljaz1cIntzZWxlY3R9XCIgY2xhc3M9XCJkYXRlIHtpbjogZGF5LmluTW9udGgsIHNlbGVjdGVkOiBkYXkuc2VsZWN0ZWQsIHRvZGF5OiBkYXkudG9kYXl9XCI+IHtkYXkuZGF0ZS5mb3JtYXQodGhpcy5SZ0RhdGUuZGF5Rm9ybWF0KX0gPC9kaXY+IDxkaXYgZWFjaD1cIntkYXkgaW4gZW5kQnVmZmVyfVwiIG9uY2xpY2s9XCJ7c2VsZWN0fVwiIGNsYXNzPVwiZGF0ZSB7aW46IGRheS5pbk1vbnRoLCBzZWxlY3RlZDogZGF5LnNlbGVjdGVkLCB0b2RheTogZGF5LnRvZGF5fVwiPiB7ZGF5LmRhdGUuZm9ybWF0KHRoaXMuUmdEYXRlLmRheUZvcm1hdCl9IDwvZGl2PiA8L2Rpdj4gPGRpdiBpZj1cIntSZ0RhdGUuc2hvd1RvZGF5fVwiIGNsYXNzPVwiZ3JpZCBncmlkLXJvd1wiPiA8YSBjbGFzcz1cInNob3J0Y3V0XCIgb25jbGljaz1cIntzZXRUb2RheX1cIj5Ub2RheTwvYT4gPC9kaXY+IDwvZGl2PiA8L2Rpdj4nLCAncmctZGF0ZSAuY29udGFpbmVyLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmNvbnRhaW5lciB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgZGlzcGxheTogaW5saW5lLWJsb2NrOyBjdXJzb3I6IHBvaW50ZXI7IH0gcmctZGF0ZSAuZmllbGQsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuZmllbGQgeyBmb250LXNpemU6IDFlbTsgcGFkZGluZzogMTBweDsgYm9yZGVyOiAxcHggc29saWQgI0QzRDNEMzsgY3Vyc29yOiBwb2ludGVyOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyBvdXRsaW5lOiBub25lOyAtd2Via2l0LWFwcGVhcmFuY2U6IG5vbmU7IC1tb3otYXBwZWFyYW5jZTogbm9uZTsgYXBwZWFyYW5jZTogbm9uZTsgfSByZy1kYXRlIC5jYWxlbmRhcixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5jYWxlbmRhciB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdGV4dC1hbGlnbjogY2VudGVyOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgYm9yZGVyOiAxcHggc29saWQgI0QzRDNEMzsgcGFkZGluZzogNXB4OyB3aWR0aDogMzMwcHg7IG1hcmdpbi10b3A6IDEwcHg7IGxlZnQ6IDUwJTsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgtNTAlLCAwLCAwKTsgLXdlYmtpdC11c2VyLXNlbGVjdDogbm9uZTsgLW1vei11c2VyLXNlbGVjdDogbm9uZTsgLW1zLXVzZXItc2VsZWN0OiBub25lOyB1c2VyLXNlbGVjdDogbm9uZTsgYm94LXNpemluZzogYm9yZGVyLWJveDsgei1pbmRleDogMTsgfSByZy1kYXRlIC5ncmlkLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmdyaWQgeyBkaXNwbGF5OiAtd2Via2l0LWZsZXg7IGRpc3BsYXk6IC1tcy1mbGV4Ym94OyBkaXNwbGF5OiBmbGV4OyAtd2Via2l0LWFsaWduLWl0ZW1zOiBjZW50ZXI7IC1tcy1mbGV4LWFsaWduOiBjZW50ZXI7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IH0gcmctZGF0ZSAuZ3JpZC13cmFwLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmdyaWQtd3JhcCB7IHdpZHRoOiAxMDAlOyAtd2Via2l0LWZsZXgtd3JhcDogd3JhcDsgLW1zLWZsZXgtd3JhcDogd3JhcDsgZmxleC13cmFwOiB3cmFwOyB9IHJnLWRhdGUgLmdyaWQtcm93LFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmdyaWQtcm93IHsgaGVpZ2h0OiAzNXB4OyB9IHJnLWRhdGUgLnNlbGVjdG9yLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLnNlbGVjdG9yIHsgZm9udC1zaXplOiAyZW07IGZvbnQtd2VpZ2h0OiAxMDA7IHBhZGRpbmc6IDA7IC13ZWJraXQtZmxleDogMCAwIDE1JTsgLW1zLWZsZXg6IDAgMCAxNSU7IGZsZXg6IDAgMCAxNSU7IH0gcmctZGF0ZSAueWVhcixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC55ZWFyLHJnLWRhdGUgLm1vbnRoLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLm1vbnRoIHsgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTsgZm9udC13ZWlnaHQ6IG5vcm1hbDsgLXdlYmtpdC1mbGV4OiAwIDAgNzAlOyAtbXMtZmxleDogMCAwIDcwJTsgZmxleDogMCAwIDcwJTsgfSByZy1kYXRlIC5maWxsLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmZpbGwgeyAtd2Via2l0LWZsZXg6IDAgMCAxMDAlOyAtbXMtZmxleDogMCAwIDEwMCU7IGZsZXg6IDAgMCAxMDAlOyB9IHJnLWRhdGUgLmRheS1uYW1lLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmRheS1uYW1lIHsgZm9udC13ZWlnaHQ6IGJvbGQ7IC13ZWJraXQtZmxleDogMCAwIDE0LjI4JTsgLW1zLWZsZXg6IDAgMCAxNC4yOCU7IGZsZXg6IDAgMCAxNC4yOCU7IH0gcmctZGF0ZSAuZGF0ZSxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5kYXRlIHsgLXdlYmtpdC1mbGV4OiAwIDAgMTQuMjglOyAtbXMtZmxleDogMCAwIDE0LjI4JTsgZmxleDogMCAwIDE0LjI4JTsgcGFkZGluZzogMTJweCAxMHB4OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyBmb250LXNpemU6IDAuOGVtOyBmb250LXdlaWdodDogbm9ybWFsOyBib3JkZXI6IDFweCBzb2xpZCB0cmFuc3BhcmVudDsgY29sb3I6ICNjYWNhY2E7IH0gcmctZGF0ZSAuZGF0ZTpob3ZlcixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5kYXRlOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogI2YzZjNmMzsgfSByZy1kYXRlIC5kYXRlLmluLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmRhdGUuaW4geyBjb2xvcjogaW5oZXJpdDsgfSByZy1kYXRlIC50b2RheSxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC50b2RheSB7IGJvcmRlci1jb2xvcjogI2VkZWRlZDsgfSByZy1kYXRlIC5zZWxlY3RlZCxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5zZWxlY3RlZCxyZy1kYXRlIC5zZWxlY3RlZDpob3ZlcixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5zZWxlY3RlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICNlZGVkZWQ7IGJvcmRlci1jb2xvcjogI2RlZGVkZTsgfSByZy1kYXRlIC5zaG9ydGN1dCxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5zaG9ydGN1dCB7IC13ZWJraXQtZmxleDogMCAwIDEwMCU7IC1tcy1mbGV4OiAwIDAgMTAwJTsgZmxleDogMCAwIDEwMCU7IGNvbG9yOiAjNjQ5NWVkOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdmFyIGhhbmRsZUNsaWNrT3V0c2lkZSA9IGZ1bmN0aW9uIGhhbmRsZUNsaWNrT3V0c2lkZShlKSB7XG4gICAgaWYgKCFfdGhpcy5yb290LmNvbnRhaW5zKGUudGFyZ2V0KSkgX3RoaXMuUmdEYXRlLmNsb3NlKCk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH07XG5cbiAgdmFyIGRheU9iaiA9IGZ1bmN0aW9uIGRheU9iaihkYXlEYXRlKSB7XG4gICAgdmFyIGRhdGVPYmogPSBkYXlEYXRlIHx8IG1vbWVudCgpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGU6IGRhdGVPYmosXG4gICAgICBzZWxlY3RlZDogX3RoaXMuUmdEYXRlLmRhdGUuaXNTYW1lKGRheURhdGUsICdkYXknKSxcbiAgICAgIHRvZGF5OiBtb21lbnQoKS5pc1NhbWUoZGF5RGF0ZSwgJ2RheScpLFxuICAgICAgaW5Nb250aDogX3RoaXMuUmdEYXRlLmRhdGUuaXNTYW1lKGRheURhdGUsICdtb250aCcpXG4gICAgfTtcbiAgfTtcblxuICB2YXIgYnVpbGRDYWxlbmRhciA9IGZ1bmN0aW9uIGJ1aWxkQ2FsZW5kYXIoKSB7XG4gICAgdmFyIGJlZ2luID0gbW9tZW50KF90aGlzLlJnRGF0ZS5kYXRlKS5zdGFydE9mKCdtb250aCcpO1xuICAgIHZhciBlbmQgPSBtb21lbnQoX3RoaXMuUmdEYXRlLmRhdGUpLmVuZE9mKCdtb250aCcpO1xuXG4gICAgX3RoaXMuZGF5cyA9IFtdO1xuICAgIF90aGlzLnN0YXJ0QnVmZmVyID0gW107XG4gICAgX3RoaXMuZW5kQnVmZmVyID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gYmVnaW4ud2Vla2RheSgpOyBpID49IDA7IGkgLT0gMSkge1xuICAgICAgdmFyIGJ1ZmZlckRhdGUgPSBtb21lbnQoYmVnaW4pLnN1YnRyYWN0KGksICdkYXlzJyk7XG4gICAgICBfdGhpcy5zdGFydEJ1ZmZlci5wdXNoKGRheU9iaihidWZmZXJEYXRlKSk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IGVuZC5kYXRlKCkgLSAxOyBpID4gMDsgaSAtPSAxKSB7XG4gICAgICB2YXIgY3VycmVudCA9IG1vbWVudChiZWdpbikuYWRkKGksICdkYXlzJyk7XG4gICAgICBfdGhpcy5kYXlzLnVuc2hpZnQoZGF5T2JqKGN1cnJlbnQpKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gZW5kLndlZWtkYXkoKTsgaSA8IDY7IGkgKz0gMSkge1xuICAgICAgdmFyIGJ1ZmZlckRhdGUgPSBtb21lbnQoZW5kKS5hZGQoaSwgJ2RheXMnKTtcbiAgICAgIF90aGlzLmVuZEJ1ZmZlci5wdXNoKGRheU9iaihidWZmZXJEYXRlKSk7XG4gICAgfVxuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnRGF0ZSA9IG9wdHMuZGF0ZSB8fCBuZXcgUmdEYXRlKG9wdHMpO1xuICAgIF90aGlzLlJnRGF0ZS5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGJ1aWxkQ2FsZW5kYXIoKTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZUNsaWNrT3V0c2lkZSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMub24oJ3VubW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDbGlja091dHNpZGUpO1xuICB9KTtcblxuICB0aGlzLm9wZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdEYXRlLm9wZW4oKTtcbiAgfTtcblxuICB0aGlzLnByZXZZZWFyID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnRGF0ZS5wcmV2WWVhcigpO1xuICB9O1xuXG4gIHRoaXMubmV4dFllYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdEYXRlLm5leHRZZWFyKCk7XG4gIH07XG5cbiAgdGhpcy5wcmV2TW9udGggPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdEYXRlLnByZXZNb250aCgpO1xuICB9O1xuXG4gIHRoaXMubmV4dE1vbnRoID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnRGF0ZS5uZXh0TW9udGgoKTtcbiAgfTtcblxuICB0aGlzLnNldFRvZGF5ID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnRGF0ZS5zZXRUb2RheSgpO1xuICB9O1xuXG4gIHRoaXMuc2VsZWN0ID0gZnVuY3Rpb24gKGUpIHtcbiAgICBfdGhpcy5SZ0RhdGUuc2VsZWN0KGUuaXRlbS5kYXkuZGF0ZSk7XG4gIH07XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctZHJhd2VyJywgJzxkaXYgY2xhc3M9XCJvdmVybGF5IHt2aXNpYmxlOiBSZ0RyYXdlci5pc3Zpc2libGV9XCIgb25jbGljaz1cIntjbG9zZX1cIj48L2Rpdj4gPGRpdiBjbGFzcz1cImRyYXdlciB7UmdEcmF3ZXIucG9zaXRpb259IHt2aXNpYmxlOiBSZ0RyYXdlci5pc3Zpc2libGV9XCI+IDxoNCBjbGFzcz1cImhlYWRlclwiPntSZ0RyYXdlci5oZWFkZXJ9PC9oND4gPHVsIGNsYXNzPVwiaXRlbXNcIj4gPGxpIGNsYXNzPVwiaXRlbSB7YWN0aXZlOiBhY3RpdmV9XCIgZWFjaD1cIntSZ0RyYXdlci5pdGVtc31cIiBvbmNsaWNrPVwie3BhcmVudC5zZWxlY3R9XCI+IDxyZy1yYXcgY29udGVudD1cIntjb250ZW50fVwiPjwvcmctcmF3PiA8L2xpPiA8L3VsPiA8ZGl2IGNsYXNzPVwiYm9keVwiPiA8eWllbGQ+PC95aWVsZD4gPC9kaXY+IDwvZGl2PicsICdyZy1kcmF3ZXIgLm92ZXJsYXksW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5vdmVybGF5IHsgZGlzcGxheTogbm9uZTsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDA7IGxlZnQ6IDA7IHJpZ2h0OiAwOyBib3R0b206IDA7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IGJhY2tncm91bmQtY29sb3I6IHJnYmEoMCwgMCwgMCwgMC41KTsgY3Vyc29yOiBwb2ludGVyOyB6LWluZGV4OiA1MDsgfSByZy1kcmF3ZXIgLm92ZXJsYXkudmlzaWJsZSxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLm92ZXJsYXkudmlzaWJsZSB7IGRpc3BsYXk6IGJsb2NrOyB9IHJnLWRyYXdlciAuZHJhd2VyLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyIHsgcG9zaXRpb246IGFic29sdXRlOyBvdmVyZmxvdy15OiBhdXRvOyBvdmVyZmxvdy14OiBoaWRkZW47IC13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOiB0b3VjaDsgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IGNvbG9yOiBibGFjazsgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuNXMgZWFzZTsgei1pbmRleDogNTE7IH0gcmctZHJhd2VyIC5kcmF3ZXIuYm90dG9tLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLmJvdHRvbSB7IHRvcDogMTAwJTsgbGVmdDogMDsgaGVpZ2h0OiBhdXRvOyB3aWR0aDogODAlOyBtYXJnaW4tbGVmdDogMTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDAsIDAsIDApOyB9IHJnLWRyYXdlciAuZHJhd2VyLmJvdHRvbS52aXNpYmxlLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLmJvdHRvbS52aXNpYmxlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgwLCAtMTAwJSwgMCk7IH0gcmctZHJhd2VyIC5kcmF3ZXIudG9wLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLnRvcCB7IGJvdHRvbTogMTAwJTsgbGVmdDogMDsgaGVpZ2h0OiBhdXRvOyB3aWR0aDogODAlOyBtYXJnaW4tbGVmdDogMTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDAsIDAsIDApOyB9IHJnLWRyYXdlciAuZHJhd2VyLnRvcC52aXNpYmxlLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLnRvcC52aXNpYmxlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgwLCAxMDAlLCAwKTsgfSByZy1kcmF3ZXIgLmRyYXdlci5sZWZ0LFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLmxlZnQgeyB0b3A6IDA7IGxlZnQ6IDA7IGhlaWdodDogMTAwJTsgd2lkdGg6IDI2MHB4OyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKC0xMDAlLCAwLCAwKTsgfSByZy1kcmF3ZXIgLmRyYXdlci5sZWZ0LnZpc2libGUsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIubGVmdC52aXNpYmxlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgwLCAwLCAwKTsgfSByZy1kcmF3ZXIgLmRyYXdlci5yaWdodCxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLmRyYXdlci5yaWdodCB7IHRvcDogMDsgbGVmdDogMTAwJTsgaGVpZ2h0OiAxMDAlOyB3aWR0aDogMjYwcHg7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoMCwgMCwgMCk7IH0gcmctZHJhd2VyIC5kcmF3ZXIucmlnaHQudmlzaWJsZSxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLmRyYXdlci5yaWdodC52aXNpYmxlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgtMTAwJSwgMCwgMCk7IH0gcmctZHJhd2VyIC5oZWFkZXIsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5oZWFkZXIgeyBwYWRkaW5nOiAxLjJyZW07IG1hcmdpbjogMDsgdGV4dC1hbGlnbjogY2VudGVyOyB9IHJnLWRyYXdlciAuaXRlbXMsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5pdGVtcyB7IHBhZGRpbmc6IDA7IG1hcmdpbjogMDsgbGlzdC1zdHlsZTogbm9uZTsgfSByZy1kcmF3ZXIgLml0ZW0sW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5pdGVtIHsgcGFkZGluZzogMXJlbSAwLjVyZW07IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjRThFOEU4OyB9IHJnLWRyYXdlciAuaXRlbTpsYXN0LWNoaWxkLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuaXRlbTpsYXN0LWNoaWxkIHsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNFOEU4RTg7IH0gcmctZHJhd2VyIC5pdGVtOmhvdmVyLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuaXRlbTpob3ZlciB7IGN1cnNvcjogcG9pbnRlcjsgYmFja2dyb3VuZC1jb2xvcjogI0U4RThFODsgfSByZy1kcmF3ZXIgLml0ZW0uYWN0aXZlLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuaXRlbS5hY3RpdmUgeyBjdXJzb3I6IHBvaW50ZXI7IGJhY2tncm91bmQtY29sb3I6ICNFRUU7IH0nLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ0RyYXdlciA9IG9wdHMuZHJhd2VyIHx8IG5ldyBSZ0RyYXdlcihvcHRzKTtcbiAgICBfdGhpcy5SZ0RyYXdlci5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdEcmF3ZXIuY2xvc2UoKTtcbiAgfTtcblxuICB0aGlzLnNlbGVjdCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgX3RoaXMuUmdEcmF3ZXIuc2VsZWN0KGUuaXRlbSk7XG4gIH07XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctZ2EnLCAnJywgJycsICcnLCBmdW5jdGlvbiAob3B0cykge1xuXG4gIChmdW5jdGlvbiAoaSwgcywgbywgZywgciwgYSwgbSkge1xuICAgIGlbJ0dvb2dsZUFuYWx5dGljc09iamVjdCddID0gcjtpW3JdID0gaVtyXSB8fCBmdW5jdGlvbiAoKSB7XG4gICAgICAoaVtyXS5xID0gaVtyXS5xIHx8IFtdKS5wdXNoKGFyZ3VtZW50cyk7XG4gICAgfSwgaVtyXS5sID0gMSAqIG5ldyBEYXRlKCk7YSA9IHMuY3JlYXRlRWxlbWVudChvKSwgbSA9IHMuZ2V0RWxlbWVudHNCeVRhZ05hbWUobylbMF07YS5hc3luYyA9IDE7YS5zcmMgPSBnO20ucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYSwgbSk7XG4gIH0pKHdpbmRvdywgZG9jdW1lbnQsICdzY3JpcHQnLCAnLy93d3cuZ29vZ2xlLWFuYWx5dGljcy5jb20vYW5hbHl0aWNzLmpzJywgJ2dhJyk7XG5cbiAgZ2EoJ2NyZWF0ZScsIG9wdHMucHJvcGVydHksICdhdXRvJyk7XG4gIGdhKCdzZW5kJywgJ3BhZ2V2aWV3Jyk7XG59KTtcblxucmlvdC50YWcyKCdyZy1pbmNsdWRlJywgJzxkaXY+IHtyZXNwb25zZVRleHR9IDwvZGl2PicsICcnLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ0luY2x1ZGUgPSBvcHRzLmluY2x1ZGUgfHwgbmV3IFJnSW5jbHVkZShvcHRzKTtcbiAgICBfdGhpcy5SZ0luY2x1ZGUub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIF90aGlzLlJnSW5jbHVkZS5mZXRjaCgpO1xuICAgIH0pO1xuICAgIF90aGlzLlJnSW5jbHVkZS5vbignZmV0Y2gnLCBmdW5jdGlvbiAoY29udGVudCkge1xuICAgICAgaWYgKF90aGlzLlJnSW5jbHVkZS51bnNhZmUpIF90aGlzLnJvb3QuaW5uZXJIVE1MID0gY29udGVudDtlbHNlIF90aGlzLnJlc3BvbnNlVGV4dCA9IGNvbnRlbnQ7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpcy5SZ0luY2x1ZGUuZmV0Y2goKTtcbiAgfSk7XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctbG9hZGluZycsICc8ZGl2IGNsYXNzPVwibG9hZGluZyB7dmlzaWJsZTogUmdMb2FkaW5nLmlzdmlzaWJsZX1cIj4gPGRpdiBjbGFzcz1cIm92ZXJsYXlcIj48L2Rpdj4gPGRpdiBjbGFzcz1cImNvbnRlbnRcIj4gPHlpZWxkPjwveWllbGQ+IDwvZGl2PiA8L2Rpdj4nLCAncmctbG9hZGluZyAubG9hZGluZyxbcmlvdC10YWc9XCJyZy1sb2FkaW5nXCJdIC5sb2FkaW5nIHsgZGlzcGxheTogbm9uZTsgfSByZy1sb2FkaW5nIC52aXNpYmxlLFtyaW90LXRhZz1cInJnLWxvYWRpbmdcIl0gLnZpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy1sb2FkaW5nIC5vdmVybGF5LFtyaW90LXRhZz1cInJnLWxvYWRpbmdcIl0gLm92ZXJsYXkgeyBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogMDsgbGVmdDogMDsgcmlnaHQ6IDA7IGJvdHRvbTogMDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgYmFja2dyb3VuZC1jb2xvcjogcmdiYSgwLCAwLCAwLCAwLjgpOyB6LWluZGV4OiAyMDA7IH0gcmctbG9hZGluZyAuY29udGVudCxbcmlvdC10YWc9XCJyZy1sb2FkaW5nXCJdIC5jb250ZW50IHsgcG9zaXRpb246IGFic29sdXRlOyB3aWR0aDogOTUlOyBtYXgtd2lkdGg6IDQyMHB4OyB0b3A6IDUwJTsgbGVmdDogNTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKC01MCUsIC01MCUsIDApOyBiYWNrZ3JvdW5kLWNvbG9yOiB0cmFuc3BhcmVudDsgY29sb3I6ICNmZmY7IHRleHQtYWxpZ246IGNlbnRlcjsgei1pbmRleDogMjAxOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdGhpcy5vbignbW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdMb2FkaW5nID0gb3B0cy5sb2FkaW5nIHx8IG5ldyBSZ0xvYWRpbmcob3B0cyk7XG4gICAgX3RoaXMuUmdMb2FkaW5nLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpcy51cGRhdGUoKTtcbiAgfSk7XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctbWFwJywgJzxkaXYgY2xhc3M9XCJyZy1tYXBcIj48L2Rpdj4nLCAncmctbWFwIC5yZy1tYXAsW3Jpb3QtdGFnPVwicmctbWFwXCJdIC5yZy1tYXAgeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IH0gcmctbWFwIC5yZy1tYXAgaW1nLFtyaW90LXRhZz1cInJnLW1hcFwiXSAucmctbWFwIGltZyB7IG1heC13aWR0aDogaW5oZXJpdDsgfScsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnTWFwID0gb3B0cy5tYXAgfHwgbmV3IFJnTWFwKG9wdHMpO1xuXG4gICAgcmcubWFwLm9uKCdpbml0aWFsaXplJywgZnVuY3Rpb24gKCkge1xuICAgICAgcmcubWFwLm9iaiA9IG5ldyBnb29nbGUubWFwcy5NYXAoX3RoaXMucm9vdC5xdWVyeVNlbGVjdG9yKCcucmctbWFwJyksIF90aGlzLlJnTWFwLm9wdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ21hcF9zY3JpcHQnKSkge1xuICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgc2NyaXB0LnNldEF0dHJpYnV0ZSgnaWQnLCAnZ21hcF9zY3JpcHQnKTtcbiAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG4gICAgICBzY3JpcHQuc3JjID0gJ2h0dHBzOi8vbWFwcy5nb29nbGVhcGlzLmNvbS9tYXBzL2FwaS9qcz9jYWxsYmFjaz1yZy5tYXAuaW5pdGlhbGl6ZSc7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgfVxuICB9KTtcbn0pO1xuXG5yaW90LnRhZzIoJ3JnLW1hcmtkb3duJywgJzxkaXYgY2xhc3M9XCJtYXJrZG93blwiPjwvZGl2PicsICcnLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ01hcmtkb3duID0gb3B0cy5tYXJrZG93biB8fCBuZXcgUmdNYXJrZG93bihvcHRzKTtcbiAgICBfdGhpcy5SZ01hcmtkb3duLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy5SZ01hcmtkb3duLmZldGNoKCk7XG4gICAgfSk7XG4gICAgX3RoaXMuUmdNYXJrZG93bi5vbignZmV0Y2gnLCBmdW5jdGlvbiAobWQpIHtcbiAgICAgIF90aGlzLlJnTWFya2Rvd24ucGFyc2UobWQpO1xuICAgIH0pO1xuICAgIF90aGlzLlJnTWFya2Rvd24ub24oJ3BhcnNlJywgZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgICAgIF90aGlzLnJvb3QuaW5uZXJIVE1MID0gY29udGVudDtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH0pO1xuICAgIF90aGlzLlJnTWFya2Rvd24uZmV0Y2goKTtcbiAgfSk7XG59KTtcblxucmlvdC50YWcyKCdyZy1tb2RhbCcsICc8ZGl2IGNsYXNzPVwib3ZlcmxheSB7dmlzaWJsZTogUmdNb2RhbC5pc3Zpc2libGUsIGdob3N0OiBSZ01vZGFsLmdob3N0LCBkaXNtaXNzYWJsZTogUmdNb2RhbC5kaXNtaXNzYWJsZX1cIiBvbmNsaWNrPVwie2Nsb3NlfVwiPjwvZGl2PiA8ZGl2IGNsYXNzPVwibW9kYWwge3Zpc2libGU6IFJnTW9kYWwuaXN2aXNpYmxlLCBnaG9zdDogUmdNb2RhbC5naG9zdCwgZGlzbWlzc2FibGU6IFJnTW9kYWwuZGlzbWlzc2FibGV9XCI+IDxoZWFkZXIgY2xhc3M9XCJoZWFkZXJcIj4gPGJ1dHRvbiBpZj1cIntSZ01vZGFsLmRpc21pc3NhYmxlfVwiIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNsb3NlXCIgYXJpYS1sYWJlbD1cIkNsb3NlXCIgb25jbGljaz1cIntjbG9zZX1cIj4gPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+JnRpbWVzOzwvc3Bhbj4gPC9idXR0b24+IDxoMyBjbGFzcz1cImhlYWRpbmdcIj48cmctcmF3IGNvbnRlbnQ9XCJ7UmdNb2RhbC5oZWFkaW5nfVwiPjwvcmctcmF3PjwvaDM+IDwvaGVhZGVyPiA8ZGl2IGNsYXNzPVwiYm9keVwiPiA8eWllbGQ+PC95aWVsZD4gPC9kaXY+IDxmb290ZXIgY2xhc3M9XCJmb290ZXJcIj4gPGJ1dHRvbiBjbGFzcz1cImJ1dHRvblwiIGVhY2g9XCJ7UmdNb2RhbC5idXR0b25zfVwiIHR5cGU9XCJidXR0b25cIiBvbmNsaWNrPVwie2FjdGlvbn1cIiByaW90LXN0eWxlPVwie3N0eWxlfVwiPiA8cmctcmF3IGNvbnRlbnQ9XCJ7Y29udGVudH1cIj48L3JnLXJhdz4gPC9idXR0b24+IDxkaXYgY2xhc3M9XCJjbGVhclwiPjwvZGl2PiA8L2Zvb3Rlcj4gPC9kaXY+JywgJ3JnLW1vZGFsIC5vdmVybGF5LFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5vdmVybGF5IHsgZGlzcGxheTogbm9uZTsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDA7IGxlZnQ6IDA7IHJpZ2h0OiAwOyBib3R0b206IDA7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IGJhY2tncm91bmQtY29sb3I6IHJnYmEoMCwgMCwgMCwgMC44KTsgei1pbmRleDogMTAwOyB9IHJnLW1vZGFsIC5vdmVybGF5LmRpc21pc3NhYmxlLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5vdmVybGF5LmRpc21pc3NhYmxlIHsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLW1vZGFsIC5tb2RhbCxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAubW9kYWwgeyBkaXNwbGF5OiBub25lOyBwb3NpdGlvbjogYWJzb2x1dGU7IHdpZHRoOiA5NSU7IG1heC13aWR0aDogNTAwcHg7IGZvbnQtc2l6ZTogMS4xZW07IHRvcDogNTAlOyBsZWZ0OiA1MCU7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoLTUwJSwgLTUwJSwgMCk7IGJhY2tncm91bmQtY29sb3I6IHdoaXRlOyBjb2xvcjogIzI1MjUxOTsgei1pbmRleDogMTAxOyB9IHJnLW1vZGFsIC5tb2RhbC5naG9zdCxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAubW9kYWwuZ2hvc3QgeyBiYWNrZ3JvdW5kLWNvbG9yOiB0cmFuc3BhcmVudDsgY29sb3I6IHdoaXRlOyB9IHJnLW1vZGFsIC52aXNpYmxlLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC52aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctbW9kYWwgLmhlYWRlcixbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAuaGVhZGVyIHsgcG9zaXRpb246IHJlbGF0aXZlOyB0ZXh0LWFsaWduOiBjZW50ZXI7IH0gcmctbW9kYWwgLmhlYWRpbmcsW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLmhlYWRpbmcgeyBwYWRkaW5nOiAyMHB4IDIwcHggMCAyMHB4OyBtYXJnaW46IDA7IGZvbnQtc2l6ZTogMS4yZW07IH0gcmctbW9kYWwgLm1vZGFsLmdob3N0IC5oZWFkaW5nLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5tb2RhbC5naG9zdCAuaGVhZGluZyB7IGNvbG9yOiB3aGl0ZTsgfSByZy1tb2RhbCAuY2xvc2UsW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLmNsb3NlIHsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDVweDsgcmlnaHQ6IDEwcHg7IHBhZGRpbmc6IDA7IGZvbnQtc2l6ZTogMS4yZW07IGJvcmRlcjogMDsgYmFja2dyb3VuZC1jb2xvcjogdHJhbnNwYXJlbnQ7IGNvbG9yOiAjMDAwOyBjdXJzb3I6IHBvaW50ZXI7IG91dGxpbmU6IG5vbmU7IH0gcmctbW9kYWwgLm1vZGFsLmdob3N0IC5jbG9zZSxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAubW9kYWwuZ2hvc3QgLmNsb3NlIHsgY29sb3I6IHdoaXRlOyB9IHJnLW1vZGFsIC5ib2R5LFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5ib2R5IHsgcGFkZGluZzogMjBweDsgfSByZy1tb2RhbCAuZm9vdGVyLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5mb290ZXIgeyBwYWRkaW5nOiAwIDIwcHggMjBweCAyMHB4OyB9IHJnLW1vZGFsIC5idXR0b24sW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLmJ1dHRvbiB7IGZsb2F0OiByaWdodDsgcGFkZGluZzogMTBweDsgbWFyZ2luOiAwIDVweCAwIDA7IGJvcmRlcjogbm9uZTsgZm9udC1zaXplOiAwLjllbTsgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTsgY3Vyc29yOiBwb2ludGVyOyBvdXRsaW5lOiBub25lOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgfSByZy1tb2RhbCAubW9kYWwuZ2hvc3QgLmJ1dHRvbixbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAubW9kYWwuZ2hvc3QgLmJ1dHRvbiB7IGNvbG9yOiB3aGl0ZTsgYmFja2dyb3VuZC1jb2xvcjogdHJhbnNwYXJlbnQ7IH0gcmctbW9kYWwgLmNsZWFyLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5jbGVhciB7IGNsZWFyOiBib3RoOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdGhpcy5vbignbW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdNb2RhbCA9IG9wdHMubW9kYWwgfHwgbmV3IFJnTW9kYWwob3B0cyk7XG4gICAgX3RoaXMuUmdNb2RhbC5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKF90aGlzLlJnTW9kYWwuZGlzbWlzc2FibGUpIF90aGlzLlJnTW9kYWwuaXN2aXNpYmxlID0gZmFsc2U7XG4gIH07XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctcGhvbmUtc2ltJywgJzxkaXYgY2xhc3M9XCJlbXVsYXRvclwiPiA8aWZyYW1lIGNsYXNzPVwic2NyZWVuXCIgcmlvdC1zcmM9XCJ7UmdQaG9uZVNpbS51cmx9XCI+PC9pZnJhbWU+IDwvZGl2PicsICdyZy1waG9uZS1zaW0gLmVtdWxhdG9yLFtyaW90LXRhZz1cInJnLXBob25lLXNpbVwiXSAuZW11bGF0b3IgeyBwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAzNjVweDsgaGVpZ2h0OiA3OTJweDsgYmFja2dyb3VuZC1pbWFnZTogdXJsKFxcJ2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBVzBBQUFNWUNBTUFBQUEzcjBaTEFBQUFHWFJGV0hSVGIyWjBkMkZ5WlFCQlpHOWlaU0JKYldGblpWSmxZV1I1Y2NsbFBBQUFBd0JRVEZSRk1EazYrdnI2S1RNMGxKdWNNejQvUGtsS0pTOHdMVGc1UWsxT3hzaklMem83Z29tSjJOdmJkSDUvaG8yTzlmYjJLelkzenRIUlBFZElPa1ZHWld4dGpKU1ZPRUpEa3BlWVdHUmx1TDIrS1RRMXZjSEJvYVdsUFVaSGNucDZuS0tqT2tSRjFOZlhxYTJ0cDYydFpuQnhhblYyVm1GaVoyOXdWbDFlYVhKemJYUjA0dVRrdGJxN1FFbEsxdG5aaXBLVGk1Q1JUbFpYcEtpb282bXFYbWxxVVZsYU9FRkNTVkZTVUZ4ZElTc3NUMXRjVGxwYkpDNHZJaXd0VFZsYUpqQXhJeTB1VEZoWlMxZFlKekV5S0RJelNsWlhQVWhKT1VSRk8wWkhTVlZXS3pVMlAwcExLalExT0VORU5EMCtRRXRNTERZM1NGUlZOMEpEUTA1UExUYzRORDlBTlVCQlFVeE5Oa0ZDUjFOVU1UbzdSRTlRTGpnNU4wQkJSMUpUUmxKVEx6azZSVkZTTWpzOFJWQlJSbEZTTmo5QU16dzlTRk5VTWowK0lpc3NNVHM4TURvN1NWUlZSRkJSTURzOE1UdzlJaXdzTXowK01qdzlTbFZXUTA5UUxqazZOVDQvUzFaWE5ENC9KQzR1UVUxT0l5MHRRazVQVEZkWVRWaFpRRXhOVGxsYUpTOHZKekl5UDB0TUx6ZzVMRGM0S0RNek5UOUFLalUxTjBGQ05rQkJKakF3SXl3dE1EczdNajA5TmtGQkpqRXhMams1TERjM04wSkNOVUJBS2pVMk1UdzhMRFUyTGpjNE9VTkVLREV5UVUxTlBFaElQRWhKTzBkSE9rWkdORDgvUWs1T1JGQlFRMDlQTFRZM09VUkVQa3BLUGtwTFBVbEpUMXBiUDB0TEpUQXdQVWxLSnpBeEtqTTA3dS92S1RJenNiVzJZR3BydExtNTB0WFdQa2hKbzZlbmRuK0EzZC9mNnV2cmVvT0VnNHlOMnR2Yy9QejhuNmFtOC9UMFZGdGNtNkNnSlM0djRPTGk1dWZuWUdkbmNudDhkSHA3Z1lhSEpDMHV1OERBakpHUlFreE54TWZIS3pRMVlHdHNTMU5VYVhOMGJuaDV5TXpNeXN6TXk4M095OC9QZG9DQUtESXk3TzN0VDFkWXVMdTcwTlRVYlhkNDZPbnE2ZXJyZW9DQTJkemM4UEh4OHZQejVPWGxuYVNrbjZXbXFxNnVjSFoydDd5OG82ZW9lb1NFa0phV201K2dXMlpuWkc1dnFhK3dPRUZCMDliV3RydTdxckN3Y1hkNHQ3dTgzZURnek03TzcvRHdOVDQrN2U3dXdNUER3Y1BFZUg1Ly8vLy83MHduVVFBQUFRQjBVazVULy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL0FGUDNCeVVBQUErTlNVUkJWSGphN04xM25CVGxHY0R4RVFJNUFtSlFCQWtjbnFoRURJaG9XTXQ1aW9nbVFiT2FZTnJxWXJKaDE2Z3BsbVRWa0lMSnBZQ21GK0RTRTFKSWNqUlI3TDMzM250UFlqUXh2VGw1NXRucjdON3Q3dXcrdkRQMysvMHgzRzNoczUrdnIrKzhNN3M3ZUg3NVhiNXgrck9qTjAxN2FlcSt0TysrVTErYXRtbjBzOU0zWGw2Qm9GZm00NjZaT1BST2hJdDI1OUNKMTlSUysrN0xkZ1cxMzNhOTdPN2FhSS9hK1ZFMHkralJuVWVGMXA2d3FmdnZhejYrWVZqVDBqTXlKM3JrZVNkbXpsamFOS3poK09adW9FMFRRbW12djY3ekx6cndtTVk4d2tYTE54NXpZQ2ZUZGV1cjFwNndkZWVnYmxnS2FyOHRiZWdjNGx2L3JpcnRqVE1MVDk5L1VWTUt6Z0ZMTlMzYXZ3QTJjMlBsMm44dFBIVjFReExKTWtzMnJDNmcvYWxDN1NjdktvenJoaHlJRlpScktJenZpNTZzUkh0OTRiL1JJc1oxeGVON1VZRnVmZm5hNC9VSkI2OEVyNHJHSGF4NjQ4dlVmbXFrUG54QkJybXF5aXhRdjVGUGxhUDlEejJlV2RJRVc5VTFMZEZqblFzRzFuNUVUejRkeW93ZGF2WStWRTlYUFRLUTlwaGRkUGZJQ2p2azZsdDNscnVNNlY5N2oxMzJsMjZCSzNTM0JKQXY3OUdmOWpOM0JZODVIS3NhZEhoQWVkZWJTbXRmK29mZ0VjT1Fxa25EQXN5TExpMnBQVHE0LzBpY2F0U1JBZWZvVXRvN0J2YzJvRlN6R2dMUUhZdHIzeFRjdDVEVlNBMVhKZ3NEMHB1S2FhOTlzOXd6bHdQSW1oNVd6aFhUbC81VFJIdDd1YU41R1VJMWJWbXpxTDY0dWZaZmdrRi9HRDQxN3JDQTllOTl0ZjhWekNQSG9WUHpqaFBYYVZ2MTBkNWJibHpDeVpFNm5ESUo1cEtkZTJ1L0VnejQ4N0NwMXpIbEhyMjBoOG90cDUwRVRUMldnYWVMN2RDZTJ2Y0YvdU9RcVVzckE5ejdlbWdIUTN0aGRFWkxMcGVMMGtIWXdxN0JyZHFqQXYyb2ZFQW5sVTBFWmFQanZUVGdIZFdsdlhlRWhuWXUwVmt1VW9ONzcwN3RiVzZYMzVvaWNpeWM2QzR5WnhtYXhQZjJiVHEwejVWZlRvL0lDOC8yME01R1puQUh5NUp6TzdUdmo4NWJDS2xFenlJemRRZHZMTnhmMEw0d21NUWpNZ25tZW1sSFp1Yk9CY1FYcXZiMENPMGprNzIwbzNPbUlkaFBUbGZ0NEZUcnRoNWp1NTV0SzhiYnEvWUcrZW1VaUx6cVRDL3Q2THoxY1lvWWJ3aTByNDdRaXNUejBqMncweEU2bmd4V0pWZUxkckQrV3hDWlZ4M0o5YmEwUU5lQW5qOVQvdHd1T2k4N0djRjlwTFNkS004VTdRMnJWNitPMGpjUU1vWEpKQjJ0OTZ0em9yekI5OVkyTnpmUGpkUUw5ekxKWkRKeW53MllLODVydloxa3U5Q2p1cSs0eFhrbmI0SnMrWHhVL1dzUTV3bmVjN0xsRGNuNmQ1NDRQK2RkTEZ1K3psVC9Wb3J6eGQ1azJmSUpxZnEzVEp3bmV5L0xscytSR0J3bmlQUEwzZzZ5NWFPV0JzdFdjZDdCbXlwYkxqaFMvMUxpUE5XVFRUTVdCaWswMm1palRXaWpUV2lqalRiRlZUdVpUcVNUUlc4T1V6cUpkcEd5eFQ4OW1VMkVMWXYyNWtPNCtMdm55VVQ0a21qM0xWMzhZempwR21pbjNkUmVJbTJwRjlCbFUrTG1NRG1ucmRCYlVudFFqZTB0cmoybzVtMkZQbEJpVFdLUVFtOVI3Y0cwM25aQWV4Q0ZOdHBvRTlwb0U5cG9vMDFvbzAxb28wMW9vNDAyMVZUN014SVVCaWswMm1palRlRzFENWFnTUVpaDBVWWJiVUliYlVJYmJiUUpiYlFKYmJRSmJiVFJwbHBwZjFxQ3dpQ0ZSaHR0dENtODlsd0pDb01VR20yMDBTYTAwU2EwMFVhYjBFYWIwRWFiMEVZNzN0cW5TMUFZcE5Cb280MDJoZGMrVklMQ0lJVkdHMjIwQ1cyMENXMjAwU2EwMFNhMDBhWUM5R2tTRkFZcE5OcG9vMDFvUjB2N2JSSVVCaWswMm1palRXaWpUV2lqalRhaGpUYWg3YkwyaHlVb0RGSm90TkZHbTlCR20wcHB2ME9Dd2lDRlJodHR0QWx0dEFsdHRORW10T09oZmJ3RWhVRUtqVGJhYUJQYWFCUGFMbWkvVDRMQ0lJVkdHMjIwQ1cyMENXMjAwYWI2YVMrVW9EQklvZEZHRzIxQ0cyMUMyd1h0NHlRb0RGSm90TkZHbTlCR205QkdlN0JwTDVLZ01FaWgwVVliYlVJYmJVTGJCZTBQU0ZBWXBOQm9vNDAyb1kwMm9ZMzJZTlArb0FTRlFRcU5OdHBvRTlwb0U5cG9EemJ0ajBoUUdLVFFhS09OTnFHTk5wWFMvcWtFaFVFS2ZZd0VoVUVLalRiYWFCUGFhQlBhYUE4MjdZOUxVQmlrMEdpampUYWhIUzN0bjBsUUdLVFFDeVFvREZKb3RORkdtOUJHbTlCR0cyMnFuL2FuSkNnTVVtaTAwVWFid212L1JJTENJSVZ1a0tBd1NLSFJSaHR0UWh0dFFodHR0S2wrMnArVW9EQklvZEZHRzIwS3IvMDlDUXFERlBvOUVoUUdLVFRhYUtOTmFLTk5hS09OTnRWUCs3TVNGQVlwTk5wb28wM2h0WStVb0RCSW9kRkdHMjFDRzIxQ0cyMjBDZTE0YUg5ZWdzSWdoVVliN2JocS8xcUN3aUNGUGx5Q3dpQ0ZSaHR0dEFsdHRBbHR0TkVtdE5HbVNyVi9LVUZoa0VML1FvTENJSVVlSmtGaGtFS2pqVGJhaERiYWhEYmFhQlBhYUZPbDJyK1ZvREJJb1g4bFFXR1FRaDhtUVdHUVFxT05OdHFFTnRxRU50cG9FOXBvRTlvdWEvOUFnc0lnaGY2K0JJVkJDcjJ0QklWQkNvMDIybWdUMm1nVDJtaWpUV2lqVFdpN3JQMURDUXFERlBxdEVoUUdLVFRhYUtOTmFLTk5hS09OTnFHTk5xSHRzdmFQSkNnTVV1anRKQ2dNVW1pMDBVYWIwRWFiMEVZYmJVSWJiVUliYlNwQXYwV0N3aUNGUmh0dHRBbHR0QWx0dE5FbXRORW10RjNXL3JrRWhVRUt2VktDd2lDRmZyc0VoVUVLalRiYWFCUGFhQlBhYUtOTmFLTk5hTHVzUFU2Q3dpQ0ZmcWNFaFVFS2pUYmFhQlBhYUJQYWFLTk5hTWREKzFzU0ZBWXBOTnFXMmtzbEtBeFNhTFF0dGQ4clFXR1FRcU9OTnRxRU50cUVOdHBvVS8yMHZ5WkJZWkJDbzIycHZVeUN3aUNGUnR0Uys5MFNGQVlwTk5wb28wMW9vMDFvbzQwMjFVLzcyeElVQmlrMDJwYmFYNUtnTUVpaDBVWTdydHJ2a3FBd1NLSFJSaHR0UWh0dFFodHR0S2wrMmorV29EQklvYytRb0RCSW9kRkdHMjBLci8wYUNRcURGQnB0dE5FbXRORW10TkZHbStxbmZZb0VoVUVLalRiYWFCUGEwZEwra0FTRlFRcU5OdHBvRTlwb0U5b3VhSDlWZ3NJZ2hVYmJVdnRVQ1FxREZCcHR0TkVtdEtPbC9URUpDb01VR20yMDBTYTAwYVpTMnQrVm9EQklvZEcyMUQ1UmdzSWdoVVliYmJRSmJiU3BsUFpISlNnTVVtaTAwVWFiMEVhYlNtbC9SWUxDSUlWRzIxTDdKQWtLZ3hRYWJiVFJKclRScGxMYXI1T2dNRWloMFVZYmJVSWJiVUxiQmUzM1MxQVlwTkJvbzQwMm9ZMDJvWTMyWU5QK2hBU0ZRUXFOTnRwb0U5clIwdjZHQklWQkNvMjJwZmF4RWhRR0tUVGFhS05OYUtOTmFLTTkyTFJmSzBGaGtFS2pqVGJhaERiYVZFcjdhQWtLZ3hRYWJiVFJKclRSSnJUUlJwdnFwLzBGQ1FxREZCcHR0T09xL1UwSkNvTVVHbTFMN2FNa0tBeFNhTFRSUnB2UVJwdlFSaHR0UWpzZTJxK1hvREJJb2RGR0cyMUNPMXJhOHlVb0RGSm90TkZHbTlCR205QkdHMjFDRzIycVZQczdFaFFHS1RUYWx0cGZscUF3U0tIUlJqdXUya2RJVUJpazBHaWpqVGFoalRhaGpUYmFoRGJhVktuMkd5UW9ERkpvdE5GR204SnJENUdnTUVpaDBVWWJiVUliYlVJYmJiUUpiYlFKYmJTcEFQMUZDUXFERkJwdHROR204TnJ6SkNnTVVtaTAwVWFiMEVhYjBFWWJiVUliYlVJYmJVTGJYdnR6RWhRR0tUVGFhTWRWK3hBSkNvTVVHbTIwMFNhMDBTYTAwVWFiMEVhYjBFYWIwRVk3M3RwZmw2QXdTS0hSdHRRK1NJTENJSVZHRzIyMENXMjBDVzIwMFNhMDBTYTAwU2EwMFVhYmFxVjl0Z1NGUVFxTnRxWDJieVFvREZMbzRSSVVCaWswMm1palRXaWpUV2lqalRhaGpUYWhqVFpGVlR1VnltUXlxUlRhOVM2VHpHY1RuYVd6K1Z3SzdUcVZ5eWMyTDV0TW9WMzc2U09aVHBRb200dU85bG1TKzliNVJIK2xvK0N0MEZIUVRpWUdLcHRDdTBhN3hqNXpTRHFkem1iVGZTZVdaQ1MwRDVBaU03RFQrVnltZTNySkpMTVJHdDRLN2JwMkQ5Qjhwc2pPczhmOUdiUkQ3aDY3TVVzdDlUTGREOG1oSFFxN2EzYk85ek5QNUNJeGVidXZuUzV2MUhZdkVITm9oNTZ6OHdQdUFIUHV6OTJ1YStjcm1CKzZ1Rk5vVjNkZXBLTEp1UFBSYWJTcjJrTld1T2ZyZkh3ZTdlb243V1RGL3k5azBLNTJIc2xXL3BRMDJ0VXUvaXJhNlNWZFhuVzdySjJzYXYyY2RuaHd1Nnlkcm5nZTBhTjRod2UzdzlxNUtuZDRlWGNIdDhQYTJTb1hjeGwzbHlYdWFxZXFSc3M3dStaMlZ6dFoxYXpkWTNDN3FuMm01T2hFVXRVSnZiU3JVNGxDTzZrZDRnUlQzdFZWaWJQYW1hb25rbkRQSFp6YXlURGowOVdKVzZIblNLNjlzSHlZOTJIU2pwN21WbWdYdGJOaDluUlpSM2VUem1xSEdwNTVSOStnUkJ2dHNEdTZwS05MUUxUUlJqdDY4N2FqMmtmSnBwVzlaTjFyRmVmbGF1NmFkaHpYMjYwNmh6VEtkZ1hIa25YdldIRnU5R2JKOW1qT2s5UzlvOFY1bGplMk1KODRWUnpQQVM0WDU3SGVhTm11Y1hNSkdLdnoyMnZFZWJRM1JiYnpYSHRwTVh6dlpwNDRUL0h1a2Exemw4Mk40ZnVTQjRuelBkN2pzblh1YmVBWXZ1ZCtnRGcvN3ZuakhGeHd4Ky96Sk1GeWU1enYrYnZMbi9OZGUzR3grNnpVZkZIZVhiUW5MVjY4K0FIblhsM2NQZ2Y0Z0NoUEV1MVI4cWQ3MzcyTzIyZGN6eExsVWFMdC8xbCthSFYwY01mbDg5dXRZdnh2UDlCK1FYNjZ6Ym5YRjYvdkp0d214cnVyOXZueWs0TVg4NC9WOTI3TzFtazcwSDdtSE1tOXFTUk8zeWxyRFlpZlVXMy9Ddmx4amVmcVhCS0g3MHV1RWVFci9JTDJwSmFXRmhlL0RWTFZkNEdkL1A3ZUFTSThxVVA3NllUOHN0ekJGMW5GOTl5ZHZLekFjdkZOUE4yaDdkOHN2N2w0NGJSVXhkZHdjUFBMZThQRjkyYS9VM3VNL05heXltbnVLRitmWkZYQU82WkwyMy9DMGNFZGoydnZCRVA3Q2I5YmUyS0xvek4zSEs0ckZjemFMUk43YVB1dk9yb3M4V0p3emJSZ1FmS3EzMU43Uk9DL3hzMVh1L24xQUxOUnVoN2drSUQyM2w3YS9wNXkwNXhqUGZlSGQ5U3VkYmxpanNpKzZQZld2akFwTnpyN3ozcEcrRHF1QjRucmpHMzZhUHUvZDNndThhSjdqZUkxQWV0ZWZsOXQvd1ZYRjkxZHkrcGlBenp0OXZXM2RhbjlOMzl6N2NkT0RkWWxyUzYvOXNoZFc3NDFXSStjK2xnUmJmLzVGbGVQY2ZwTUt0SDVkeE9DNDVxVzUvMWkydjdJNEw0MmoycFZXd0E2MGkrdTdZOE43bDJIVW8xYUYzQ085VXRwYjdWYmNQOFFuR3AzV0xQYlZpVzEvVXYyZ2J1bTJQdGM0cGZXOXYvWkdEeG1IbGFobXhkQU50N3I5NmZ0LzArNTIxdmhDcmYwYTFmcy8vcjlhL3UzempoWnVtb0ZZbUZPamx3VklNNjQxUjlJMjM5bGR2REl4Y3N4cTdybGl3UEMyYS80QTJ2N0QxNGJQUGJrTm1hVEttZVJOdlc3OWtHL0hHM2ZuNndQUDVQaFhkWEFQbFAxSmhlRExhcnRYNmxQT1Bsc1p1K0taK3oyQXQyVmZ2bmEvcGpkVHRDWVRpcWNSQXBzVjZ6M0s5SDIvZkdGNTUzVHh2Z3VlMXkzblZOQUcxOEt0YVMyUDJKYTRha250RE4vbHpWZnQzZDR2WEdFWDdtMjcrODFxK1A1TjdhdFFyUGZWclhkMkdFMWE2OStSUHZUbHIzbEhmdDExTkorQkZOS2lRbmtpUGFXVHFZNy90aXZaLy9hdm4vKzdQMjZhaGwreUpENXExYTBzdWZVUFdMcmlsWHpoeHd5dktVYmFQYjVBMmdPcEMzejk1Nk4rOUhBTmUwNVlrRExnYldsaDBmT1FMUGZab3g4dUJ6SXNyU2xDNlpjajNnSjZldW5YRkNtWXJuYVFXdEhUTHBoN0VPTnJlc1FsdGExTmo0MDlvWkpJOVpXSVBoL0FRWUEyd2h6V2xBOVIvY0FBQUFBU1VWT1JLNUNZSUk9XFwnKTsgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDsgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyOyBiYWNrZ3JvdW5kLXNpemU6IGNvdmVyOyB9IHJnLXBob25lLXNpbSAuc2NyZWVuLFtyaW90LXRhZz1cInJnLXBob25lLXNpbVwiXSAuc2NyZWVuIHsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDEwNXB4OyBsZWZ0OiAyMnB4OyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgd2lkdGg6IDMyMHB4OyBoZWlnaHQ6IDU2OHB4OyBib3JkZXI6IDA7IH0nLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ1Bob25lU2ltID0gb3B0cy5waG9uZXNpbSB8fCBuZXcgUmdQaG9uZVNpbShvcHRzKTtcbiAgICBfdGhpcy5SZ1Bob25lU2ltLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpcy51cGRhdGUoKTtcbiAgfSk7XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctcGxhY2Vob2xkaXQnLCAnPGltZyByaW90LXNyYz1cImh0dHBzOi8vcGxhY2Vob2xkaXQuaW1naXgubmV0L350ZXh0P2JnPXtSZ1BsYWNlaG9sZGl0LmJhY2tncm91bmR9JnR4dGNscj17UmdQbGFjZWhvbGRpdC5jb2xvcn0mdHh0PXtSZ1BsYWNlaG9sZGl0LnRleHR9JnR4dHNpemU9e1JnUGxhY2Vob2xkaXQudGV4dHNpemV9Jnc9e1JnUGxhY2Vob2xkaXQud2lkdGh9Jmg9e1JnUGxhY2Vob2xkaXQuaGVpZ2h0fSZmbT17UmdQbGFjZWhvbGRpdC5mb3JtYXR9XCI+JywgJycsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnUGxhY2Vob2xkaXQgPSBvcHRzLnBsYWNlaG9sZGl0IHx8IG5ldyBSZ1BsYWNlaG9sZGl0KG9wdHMpO1xuICAgIF90aGlzLlJnUGxhY2Vob2xkaXQub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH0pO1xuICAgIF90aGlzLnVwZGF0ZSgpO1xuICB9KTtcbn0sICd7IH0nKTtcblxucmlvdC50YWcyKCdyZy1yYXcnLCAnPHNwYW4+PC9zcGFuPicsICcnLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdGhpcy5vbignbW91bnQgdXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucm9vdC5pbm5lckhUTUwgPSBvcHRzLmNvbnRlbnQgfHwgJyc7XG4gIH0pO1xufSk7XG5cbnJpb3QudGFnMigncmctc2VsZWN0JywgJzxkaXYgY2xhc3M9XCJjb250YWluZXIge3Zpc2libGU6IFJnU2VsZWN0LmlzdmlzaWJsZX1cIiByaW90LXN0eWxlPVwid2lkdGg6IHt3aWR0aH1cIj4gPGlucHV0IGlmPVwieyFSZ1NlbGVjdC5hdXRvY29tcGxldGV9XCIgdHlwZT1cInRleHRcIiBuYW1lPVwic2VsZWN0ZmllbGRcIiBjbGFzcz1cImZpZWxkIHt2aXNpYmxlOiBSZ1NlbGVjdC5pc3Zpc2libGV9XCIgdmFsdWU9XCJ7ZmllbGRUZXh0fVwiIHBsYWNlaG9sZGVyPVwie1JnU2VsZWN0LnBsYWNlaG9sZGVyfVwiIG9ua2V5ZG93bj1cIntoYW5kbGVLZXlzfVwiIG9uY2xpY2s9XCJ7dG9nZ2xlfVwiIHJlYWRvbmx5PiA8aW5wdXQgaWY9XCJ7UmdTZWxlY3QuYXV0b2NvbXBsZXRlfVwiIHR5cGU9XCJ0ZXh0XCIgbmFtZT1cImF1dG9jb21wbGV0ZWZpZWxkXCIgY2xhc3M9XCJmaWVsZCB7dmlzaWJsZTogUmdTZWxlY3QuaXN2aXNpYmxlfVwiIHZhbHVlPVwie2ZpZWxkVGV4dH1cIiBwbGFjZWhvbGRlcj1cIntSZ1NlbGVjdC5wbGFjZWhvbGRlcn1cIiBvbmtleWRvd249XCJ7aGFuZGxlS2V5c31cIiBvbmNsaWNrPVwie3RvZ2dsZX1cIiBvbmlucHV0PVwie2ZpbHRlcn1cIj4gPGRpdiBjbGFzcz1cImRyb3Bkb3duIHtpc3Zpc2libGU6IFJnU2VsZWN0LmlzdmlzaWJsZX0ge2VtcHR5OiBSZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zLmxlbmd0aCA9PSAwfVwiPiA8ZGl2IGNsYXNzPVwiZmlsdGVyXCIgaWY9XCJ7UmdTZWxlY3QuaGFzZmlsdGVyICYmICFSZ1NlbGVjdC5hdXRvY29tcGxldGV9XCI+IDxpbnB1dCB0eXBlPVwidGV4dFwiIG5hbWU9XCJmaWx0ZXJmaWVsZFwiIGNsYXNzPVwiZmlsdGVyLWJveFwiIHBsYWNlaG9sZGVyPVwie1JnU2VsZWN0LmZpbHRlcnBsYWNlaG9sZGVyIHx8IFxcJ0ZpbHRlclxcJ31cIiBvbmtleWRvd249XCJ7aGFuZGxlS2V5c31cIiBvbmlucHV0PVwie2ZpbHRlcn1cIj4gPC9kaXY+IDx1bCBjbGFzcz1cImxpc3Qge2VtcHR5OiBSZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zLmxlbmd0aCA9PSAwfVwiPiA8bGkgZWFjaD1cIntSZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zfVwiIG9uY2xpY2s9XCJ7cGFyZW50LnNlbGVjdH1cIiBjbGFzcz1cIml0ZW0ge3NlbGVjdGVkOiBzZWxlY3RlZCwgZGlzYWJsZWQ6IGRpc2FibGVkLCBhY3RpdmU6IGFjdGl2ZX1cIj4ge3RleHR9IDwvbGk+IDwvdWw+IDwvZGl2PiA8L2Rpdj4nLCAncmctc2VsZWN0IC5jb250YWluZXIsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5jb250YWluZXIgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLXNlbGVjdCAuZmllbGQsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5maWVsZCB7IHdpZHRoOiAxMDAlOyBwYWRkaW5nOiAxMHB4OyBib3JkZXI6IDFweCBzb2xpZCAjRDNEM0QzOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpczsgZm9udC1zaXplOiAxZW07IGxpbmUtaGVpZ2h0OiBub3JtYWw7IG91dGxpbmU6IDA7IC13ZWJraXQtYXBwZWFyYW5jZTogbm9uZTsgLW1vei1hcHBlYXJhbmNlOiBub25lOyBhcHBlYXJhbmNlOiBub25lOyB9IHJnLXNlbGVjdCAuZHJvcGRvd24sW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5kcm9wZG93biB7IGRpc3BsYXk6IG5vbmU7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgd2lkdGg6IDEwMCU7IGJhY2tncm91bmQtY29sb3I6IHdoaXRlOyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI0QzRDNEMzsgYm94LXNpemluZzogYm9yZGVyLWJveDsgb3ZlcmZsb3cteTogYXV0bzsgb3ZlcmZsb3cteDogaGlkZGVuOyBtYXgtaGVpZ2h0OiAyODBweDsgei1pbmRleDogMTA7IH0gcmctc2VsZWN0IC5kcm9wZG93bi5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5kcm9wZG93bi5pc3Zpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy1zZWxlY3QgLmRyb3Bkb3duLmVtcHR5LFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuZHJvcGRvd24uZW1wdHkgeyBib3JkZXItYm90dG9tOiAwOyB9IHJnLXNlbGVjdCAuZmlsdGVyLWJveCxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLmZpbHRlci1ib3ggeyB3aWR0aDogMTAwJTsgcGFkZGluZzogMTBweDsgZm9udC1zaXplOiAwLjllbTsgYm9yZGVyOiAwOyBib3JkZXItbGVmdDogMXB4IHNvbGlkICNEM0QzRDM7IGJvcmRlci1yaWdodDogMXB4IHNvbGlkICNEM0QzRDM7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjRThFOEU4OyBvdXRsaW5lOiBub25lOyBjb2xvcjogIzU1NTsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfSByZy1zZWxlY3QgLmxpc3QsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5saXN0LHJnLXNlbGVjdCAuaXRlbSxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLml0ZW0geyBsaXN0LXN0eWxlOiBub25lOyBwYWRkaW5nOiAwOyBtYXJnaW46IDA7IH0gcmctc2VsZWN0IC5saXN0LmVtcHR5LFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAubGlzdC5lbXB0eSB7IGRpc3BsYXk6IG5vbmU7IH0gcmctc2VsZWN0IC5pdGVtLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuaXRlbSB7IHBhZGRpbmc6IDEwcHg7IGJvcmRlci1sZWZ0OiAxcHggc29saWQgI0QzRDNEMzsgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgI0QzRDNEMzsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICNFOEU4RTg7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyB9IHJnLXNlbGVjdCAuaXRlbTpmaXJzdC1jaGlsZCxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLml0ZW06Zmlyc3QtY2hpbGQgeyBib3JkZXItdG9wOiAwOyB9IHJnLXNlbGVjdCAuc2VsZWN0ZWQsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5zZWxlY3RlZCB7IGZvbnQtd2VpZ2h0OiBib2xkOyBiYWNrZ3JvdW5kLWNvbG9yOiAjZjhmOGY4OyB9IHJnLXNlbGVjdCAuaXRlbTpob3ZlcixbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLml0ZW06aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjZjNmM2YzOyB9IHJnLXNlbGVjdCAuaXRlbS5hY3RpdmUsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5pdGVtLmFjdGl2ZSxyZy1zZWxlY3QgLml0ZW06aG92ZXIuYWN0aXZlLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuaXRlbTpob3Zlci5hY3RpdmUgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjZWRlZGVkOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdmFyIGhhbmRsZUNsaWNrT3V0c2lkZSA9IGZ1bmN0aW9uIGhhbmRsZUNsaWNrT3V0c2lkZShlKSB7XG4gICAgaWYgKCFfdGhpcy5yb290LmNvbnRhaW5zKGUudGFyZ2V0KSkge1xuICAgICAgX3RoaXMuUmdTZWxlY3QuY2xvc2UoKTtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH1cbiAgfTtcblxuICB0aGlzLmhhbmRsZUtleXMgPSBmdW5jdGlvbiAoZSkge1xuICAgIGlmIChbMTMsIDM4LCA0MF0uaW5kZXhPZihlLmtleUNvZGUpID4gLTEgJiYgIV90aGlzLlJnU2VsZWN0LmlzdmlzaWJsZSkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX3RoaXMudG9nZ2xlKCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKF90aGlzLlJnU2VsZWN0LmF1dG9jb21wbGV0ZSAmJiAhX3RoaXMuUmdTZWxlY3QuaXN2aXNpYmxlKSBfdGhpcy50b2dnbGUoKTtcbiAgICB2YXIgbGVuZ3RoID0gX3RoaXMuUmdTZWxlY3QuZmlsdGVyZWRpdGVtcy5sZW5ndGg7XG4gICAgaWYgKGxlbmd0aCA+IDAgJiYgWzEzLCAzOCwgNDBdLmluZGV4T2YoZS5rZXlDb2RlKSA+IC0xKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgIHZhciBhY3RpdmVJbmRleCA9IG51bGw7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpdGVtID0gX3RoaXMuUmdTZWxlY3QuZmlsdGVyZWRpdGVtc1tpXTtcbiAgICAgICAgaWYgKGl0ZW0uYWN0aXZlKSB7XG4gICAgICAgICAgYWN0aXZlSW5kZXggPSBpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhY3RpdmVJbmRleCAhPSBudWxsKSBfdGhpcy5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW2FjdGl2ZUluZGV4XS5hY3RpdmUgPSBmYWxzZTtcblxuICAgICAgaWYgKGUua2V5Q29kZSA9PSAzOCkge1xuICAgICAgICBpZiAoYWN0aXZlSW5kZXggPT0gbnVsbCB8fCBhY3RpdmVJbmRleCA9PSAwKSBfdGhpcy5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW2xlbmd0aCAtIDFdLmFjdGl2ZSA9IHRydWU7ZWxzZSBfdGhpcy5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW2FjdGl2ZUluZGV4IC0gMV0uYWN0aXZlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoZS5rZXlDb2RlID09IDQwKSB7XG4gICAgICAgIGlmIChhY3RpdmVJbmRleCA9PSBudWxsIHx8IGFjdGl2ZUluZGV4ID09IGxlbmd0aCAtIDEpIF90aGlzLlJnU2VsZWN0LmZpbHRlcmVkaXRlbXNbMF0uYWN0aXZlID0gdHJ1ZTtlbHNlIF90aGlzLlJnU2VsZWN0LmZpbHRlcmVkaXRlbXNbYWN0aXZlSW5kZXggKyAxXS5hY3RpdmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChlLmtleUNvZGUgPT0gMTMgJiYgYWN0aXZlSW5kZXggIT0gbnVsbCkge1xuICAgICAgICBfdGhpcy5zZWxlY3QoeyBpdGVtOiBfdGhpcy5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW2FjdGl2ZUluZGV4XSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgdGhpcy50b2dnbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdTZWxlY3QudG9nZ2xlKCk7XG4gIH07XG5cbiAgdGhpcy5maWx0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRleHQgPSBfdGhpcy5maWx0ZXJmaWVsZC52YWx1ZTtcbiAgICBpZiAoX3RoaXMuUmdTZWxlY3QuYXV0b2NvbXBsZXRlKSB0ZXh0ID0gX3RoaXMuYXV0b2NvbXBsZXRlZmllbGQudmFsdWU7XG4gICAgX3RoaXMuUmdTZWxlY3QuZmlsdGVyKHRleHQpO1xuICB9O1xuXG4gIHRoaXMuc2VsZWN0ID0gZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpdGVtID0gaXRlbS5pdGVtO1xuICAgIF90aGlzLlJnU2VsZWN0LnNlbGVjdChpdGVtKTtcbiAgfTtcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ1NlbGVjdCA9IG9wdHMuc2VsZWN0IHx8IG5ldyBSZ1NlbGVjdChvcHRzKTtcbiAgICBfdGhpcy5SZ1NlbGVjdC5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKF90aGlzLlJnU2VsZWN0LmlzdmlzaWJsZSkgX3RoaXMuZmlsdGVyKCk7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpcy5SZ1NlbGVjdC5vbignc2VsZWN0JywgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIF90aGlzLnNlbGVjdGZpZWxkLnZhbHVlID0gaXRlbVtfdGhpcy5SZ1NlbGVjdC5maWx0ZXJvbl07XG4gICAgICBfdGhpcy5hdXRvY29tcGxldGVmaWVsZC52YWx1ZSA9IGl0ZW1bX3RoaXMuUmdTZWxlY3QuZmlsdGVyb25dO1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDbGlja091dHNpZGUpO1xuXG4gICAgX3RoaXMuZmlsdGVyKCk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMub24oJ3VubW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDbGlja091dHNpZGUpO1xuICB9KTtcbn0sICd7IH0nKTtcblxucmlvdC50YWcyKCdyZy1zaWRlbWVudScsICc8cmctZHJhd2VyIGRyYXdlcj1cIntSZ1NpZGVtZW51fVwiPicsICdyZy1zaWRlbWVudSAub3ZlcmxheSxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAub3ZlcmxheSB7IGJhY2tncm91bmQtY29sb3I6IHJnYmEoMCwgMCwgMCwgMC44KTsgfSByZy1zaWRlbWVudSAub3ZlcmxheS52aXNpYmxlLFtyaW90LXRhZz1cInJnLXNpZGVtZW51XCJdIC5vdmVybGF5LnZpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy1zaWRlbWVudSAuZHJhd2VyLFtyaW90LXRhZz1cInJnLXNpZGVtZW51XCJdIC5kcmF3ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiBibGFjazsgY29sb3I6IHdoaXRlOyB9IHJnLXNpZGVtZW51IC5oZWFkZXIsW3Jpb3QtdGFnPVwicmctc2lkZW1lbnVcIl0gLmhlYWRlciB7IGNvbG9yOiB3aGl0ZTsgfSByZy1zaWRlbWVudSAuaXRlbSxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAuaXRlbSB7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjMWExYTFhOyBjb2xvcjogd2hpdGU7IH0gcmctc2lkZW1lbnUgLml0ZW06bGFzdC1jaGlsZCxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAuaXRlbTpsYXN0LWNoaWxkIHsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICMxYTFhMWE7IH0gcmctc2lkZW1lbnUgLml0ZW06aG92ZXIsW3Jpb3QtdGFnPVwicmctc2lkZW1lbnVcIl0gLml0ZW06aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjMmEyYTJhOyB9IHJnLXNpZGVtZW51IC5pdGVtLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAuaXRlbS5hY3RpdmUgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjNDQ0OyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdGhpcy5vbignbW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdTaWRlbWVudSA9IG9wdHMuc2lkZW1lbnUgfHwgbmV3IFJnU2lkZW1lbnUob3B0cyk7XG4gICAgX3RoaXMuUmdTaWRlbWVudS5wb3NpdGlvbiA9ICdsZWZ0JztcbiAgICBfdGhpcy5SZ1NpZGVtZW51Lm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpcy51cGRhdGUoKTtcbiAgfSk7XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctdGFicycsICc8ZGl2IGNsYXNzPVwiaGVhZGVyc1wiPiA8ZGl2IGVhY2g9XCJ7UmdUYWJzLnRhYnN9XCIgY2xhc3M9XCJoZWFkZXIge2FjdGl2ZTogYWN0aXZlLCBkaXNhYmxlZDogZGlzYWJsZWR9XCIgb25jbGljaz1cIntwYXJlbnQuc2VsZWN0fVwiPiA8ZGl2IGNsYXNzPVwiaGVhZGluZ1wiIGlmPVwie2hlYWRpbmd9XCI+IDxyZy1yYXcgY29udGVudD1cIntoZWFkaW5nfVwiPjwvcmctcmF3PiA8L2Rpdj4gPC9kaXY+IDwvZGl2PiA8ZGl2IGVhY2g9XCJ7UmdUYWJzLnRhYnN9XCIgY2xhc3M9XCJ0YWIge2FjdGl2ZTogYWN0aXZlfVwiPiA8ZGl2IGlmPVwie3JnLmlzRGVmaW5lZChjb250ZW50KX1cIj4ge2NvbnRlbnR9IDwvZGl2PiA8ZGl2IGlmPVwie3JnLmlzRGVmaW5lZChpbmNsdWRlKX1cIj4gPHJnLWluY2x1ZGUgaW5jbHVkZT1cIntpbmNsdWRlfVwiPjwvcmctaW5jbHVkZT4gPC9kaXY+IDwvZGl2PicsICdyZy10YWJzIC5oZWFkZXJzLFtyaW90LXRhZz1cInJnLXRhYnNcIl0gLmhlYWRlcnMgeyBkaXNwbGF5OiAtd2Via2l0LWZsZXg7IGRpc3BsYXk6IC1tcy1mbGV4Ym94OyBkaXNwbGF5OiBmbGV4OyB9IHJnLXRhYnMgLmhlYWRlcixbcmlvdC10YWc9XCJyZy10YWJzXCJdIC5oZWFkZXIgeyAtd2Via2l0LWZsZXg6IDE7IC1tcy1mbGV4OiAxOyBmbGV4OiAxOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB0ZXh0LWFsaWduOiBjZW50ZXI7IGN1cnNvcjogcG9pbnRlcjsgYm94LXNoYWRvdzogMCAtMXB4IDAgMCAjMDAwIGluc2V0OyB9IHJnLXRhYnMgLmhlYWRpbmcsW3Jpb3QtdGFnPVwicmctdGFic1wiXSAuaGVhZGluZyB7IHBhZGRpbmc6IDEwcHg7IG1hcmdpbjogMDsgfSByZy10YWJzIC5oZWFkZXIuYWN0aXZlLFtyaW90LXRhZz1cInJnLXRhYnNcIl0gLmhlYWRlci5hY3RpdmUgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjMDAwOyB9IHJnLXRhYnMgLmhlYWRlci5hY3RpdmUgLmhlYWRpbmcsW3Jpb3QtdGFnPVwicmctdGFic1wiXSAuaGVhZGVyLmFjdGl2ZSAuaGVhZGluZyB7IGNvbG9yOiB3aGl0ZTsgfSByZy10YWJzIC5oZWFkZXIuZGlzYWJsZWQgLmhlYWRpbmcsW3Jpb3QtdGFnPVwicmctdGFic1wiXSAuaGVhZGVyLmRpc2FibGVkIC5oZWFkaW5nIHsgY29sb3I6ICM4ODg7IH0gcmctdGFicyAudGFiLFtyaW90LXRhZz1cInJnLXRhYnNcIl0gLnRhYiB7IGRpc3BsYXk6IG5vbmU7IHBhZGRpbmc6IDEwcHg7IH0gcmctdGFicyAudGFiLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy10YWJzXCJdIC50YWIuYWN0aXZlIHsgZGlzcGxheTogYmxvY2s7IH0nLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ1RhYnMgPSBvcHRzLnRhYnMgfHwgbmV3IFJnVGFicyhvcHRzKTtcbiAgICBfdGhpcy5SZ1RhYnMub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH0pO1xuICAgIF90aGlzLnVwZGF0ZSgpO1xuICB9KTtcblxuICB0aGlzLnNlbGVjdCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgX3RoaXMuUmdUYWJzLnNlbGVjdChlLml0ZW0pO1xuICB9O1xufSwgJ3sgfScpO1xuXG5yaW90LnRhZzIoJ3JnLXRhZ3MnLCAnPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPiA8c3BhbiBjbGFzcz1cInRhZ3NcIj4gPHNwYW4gY2xhc3M9XCJ0YWdcIiBlYWNoPVwie1JnVGFncy50YWdzfVwiIG9uY2xpY2s9XCJ7cGFyZW50LnJlbW92ZVRhZ31cIj4ge3RleHR9IDxzcGFuIGNsYXNzPVwiY2xvc2VcIj4mdGltZXM7PC9zcGFuPiA8L3NwYW4+IDwvc3Bhbj4gPGRpdiBjbGFzcz1cImZpZWxkLWNvbnRhaW5lciB7aXN2aXNpYmxlOiBSZ1RhZ3MuaXN2aXNpYmxlfVwiPiA8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cImZpZWxkXCIgbmFtZT1cImZpbHRlcmZpZWxkXCIgcGxhY2Vob2xkZXI9XCJ7UmdUYWdzLnBsYWNlaG9sZGVyfVwiIG9ua2V5ZG93bj1cIntoYW5kbGVLZXlzfVwiIG9uaW5wdXQ9XCJ7ZmlsdGVyfVwiIG9uZm9jdXM9XCJ7dG9nZ2xlfVwiPiA8ZGl2IGNsYXNzPVwiZHJvcGRvd24ge2lzdmlzaWJsZTogUmdUYWdzLmlzdmlzaWJsZX1cIj4gPHVsIGNsYXNzPVwibGlzdFwiPiA8bGkgZWFjaD1cIntSZ1RhZ3MuZmlsdGVyZWRpdGVtc31cIiBvbmNsaWNrPVwie3BhcmVudC5hZGRUYWd9XCIgY2xhc3M9XCJpdGVtIHtkaXNhYmxlZDogZGlzYWJsZWQsIGFjdGl2ZTogYWN0aXZlfVwiPiB7dGV4dH0gPC9saT4gPC91bD4gPC9kaXY+IDwvZGl2PiA8L2Rpdj4nLCAncmctdGFncyAuY29udGFpbmVyLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLmNvbnRhaW5lciB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgd2lkdGg6IDEwMCU7IGJvcmRlcjogMXB4IHNvbGlkICNEM0QzRDM7IGJhY2tncm91bmQtY29sb3I6IHdoaXRlOyB0ZXh0LWFsaWduOiBsZWZ0OyBwYWRkaW5nOiAwOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9IHJnLXRhZ3MgLmZpZWxkLWNvbnRhaW5lcixbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5maWVsZC1jb250YWluZXIgeyBwb3NpdGlvbjogYWJzb2x1dGU7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLXRhZ3MgLmZpZWxkLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLmZpZWxkIHsgd2lkdGg6IDEwMCU7IHBhZGRpbmc6IDEwcHg7IGJvcmRlcjogMDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgYmFja2dyb3VuZC1jb2xvcjogdHJhbnNwYXJlbnQ7IHdoaXRlLXNwYWNlOiBub3dyYXA7IGZvbnQtc2l6ZTogMWVtOyBsaW5lLWhlaWdodDogbm9ybWFsOyBvdXRsaW5lOiAwOyAtd2Via2l0LWFwcGVhcmFuY2U6IG5vbmU7IC1tb3otYXBwZWFyYW5jZTogbm9uZTsgYXBwZWFyYW5jZTogbm9uZTsgfSByZy10YWdzIC5kcm9wZG93bixbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5kcm9wZG93biB7IGRpc3BsYXk6IG5vbmU7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgd2lkdGg6IDEwMCU7IGJhY2tncm91bmQtY29sb3I6IHdoaXRlOyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI0QzRDNEMzsgYm94LXNpemluZzogYm9yZGVyLWJveDsgb3ZlcmZsb3cteTogYXV0bzsgb3ZlcmZsb3cteDogaGlkZGVuOyBtYXgtaGVpZ2h0OiAyODBweDsgbWFyZ2luOiAtMXB4IDAgMCAtMXB4OyB9IHJnLXRhZ3MgLmRyb3Bkb3duLmlzdmlzaWJsZSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5kcm9wZG93bi5pc3Zpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy10YWdzIC5saXN0LFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLmxpc3QscmctdGFncyAuaXRlbSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5pdGVtIHsgbGlzdC1zdHlsZTogbm9uZTsgcGFkZGluZzogMDsgbWFyZ2luOiAwOyB9IHJnLXRhZ3MgLmxpc3QuZW1wdHksW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAubGlzdC5lbXB0eSB7IGRpc3BsYXk6IG5vbmU7IH0gcmctdGFncyAuaXRlbSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5pdGVtIHsgcGFkZGluZzogMTBweDsgYm9yZGVyLWxlZnQ6IDFweCBzb2xpZCAjRDNEM0QzOyBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCAjRDNEM0QzOyBib3JkZXItdG9wOiAxcHggc29saWQgI0U4RThFODsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgb3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7IH0gcmctdGFncyAuaXRlbTpmaXJzdC1jaGlsZCxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5pdGVtOmZpcnN0LWNoaWxkIHsgYm9yZGVyLXRvcDogMDsgfSByZy10YWdzIC5pdGVtOmhvdmVyLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLml0ZW06aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjZjNmM2YzOyB9IHJnLXRhZ3MgLml0ZW0uYWN0aXZlLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLml0ZW0uYWN0aXZlLHJnLXRhZ3MgLml0ZW06aG92ZXIuYWN0aXZlLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLml0ZW06aG92ZXIuYWN0aXZlIHsgYmFja2dyb3VuZC1jb2xvcjogI2VkZWRlZDsgfSByZy10YWdzIC50YWdzLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLnRhZ3MgeyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IG1heC13aWR0aDogNzAlOyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdy15OiBoaWRkZW47IG92ZXJmbG93LXg6IGF1dG87IC13ZWJraXQtdXNlci1zZWxlY3Q6IG5vbmU7IC1tb3otdXNlci1zZWxlY3Q6IG5vbmU7IC1tcy11c2VyLXNlbGVjdDogbm9uZTsgdXNlci1zZWxlY3Q6IG5vbmU7IH0gcmctdGFncyAudGFnLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLnRhZyB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgZGlzcGxheTogaW5saW5lLWJsb2NrOyBwYWRkaW5nOiA4cHggMjBweCA4cHggNXB4OyBtYXJnaW46IDFweDsgYmFja2dyb3VuZC1jb2xvcjogIzAwMDsgY29sb3I6ICNmZmY7IGZvbnQtc2l6ZTogMWVtOyBsaW5lLWhlaWdodDogbm9ybWFsOyBjdXJzb3I6IHBvaW50ZXI7IH0gcmctdGFncyAudGFnOmhvdmVyLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLnRhZzpob3ZlcixyZy10YWdzIC50YWc6YWN0aXZlLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLnRhZzphY3RpdmUgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjNjY2OyB9IHJnLXRhZ3MgLmNsb3NlLFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLmNsb3NlIHsgcG9zaXRpb246IGFic29sdXRlOyByaWdodDogNXB4OyB0b3A6IDdweDsgY29sb3I6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC43KTsgfScsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHZhciBoYW5kbGVDbGlja091dHNpZGUgPSBmdW5jdGlvbiBoYW5kbGVDbGlja091dHNpZGUoZSkge1xuICAgIGlmICghX3RoaXMucm9vdC5jb250YWlucyhlLnRhcmdldCkpIHtcbiAgICAgIF90aGlzLlJnVGFncy5jbG9zZSgpO1xuICAgIH1cbiAgfTtcblxuICB0aGlzLmhhbmRsZUtleXMgPSBmdW5jdGlvbiAoZSkge1xuICAgIGlmIChbMTMsIDM4LCA0MF0uaW5kZXhPZihlLmtleUNvZGUpID4gLTEgJiYgIV90aGlzLlJnVGFncy5pc3Zpc2libGUpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF90aGlzLnRvZ2dsZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmICghX3RoaXMuUmdUYWdzLmlzdmlzaWJsZSkgX3RoaXMudG9nZ2xlKCk7XG4gICAgdmFyIGxlbmd0aCA9IF90aGlzLlJnVGFncy5maWx0ZXJlZGl0ZW1zLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoID4gMCAmJiBbMTMsIDM4LCA0MF0uaW5kZXhPZihlLmtleUNvZGUpID4gLTEpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgdmFyIGFjdGl2ZUluZGV4ID0gbnVsbDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGl0ZW0gPSBfdGhpcy5SZ1RhZ3MuZmlsdGVyZWRpdGVtc1tpXTtcbiAgICAgICAgaWYgKGl0ZW0uYWN0aXZlKSB7XG4gICAgICAgICAgYWN0aXZlSW5kZXggPSBpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhY3RpdmVJbmRleCAhPSBudWxsKSBfdGhpcy5SZ1RhZ3MuZmlsdGVyZWRpdGVtc1thY3RpdmVJbmRleF0uYWN0aXZlID0gZmFsc2U7XG5cbiAgICAgIGlmIChlLmtleUNvZGUgPT0gMzgpIHtcbiAgICAgICAgaWYgKGFjdGl2ZUluZGV4ID09IG51bGwgfHwgYWN0aXZlSW5kZXggPT0gMCkgX3RoaXMuUmdUYWdzLmZpbHRlcmVkaXRlbXNbbGVuZ3RoIC0gMV0uYWN0aXZlID0gdHJ1ZTtlbHNlIF90aGlzLlJnVGFncy5maWx0ZXJlZGl0ZW1zW2FjdGl2ZUluZGV4IC0gMV0uYWN0aXZlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoZS5rZXlDb2RlID09IDQwKSB7XG4gICAgICAgIGlmIChhY3RpdmVJbmRleCA9PSBudWxsIHx8IGFjdGl2ZUluZGV4ID09IGxlbmd0aCAtIDEpIF90aGlzLlJnVGFncy5maWx0ZXJlZGl0ZW1zWzBdLmFjdGl2ZSA9IHRydWU7ZWxzZSBfdGhpcy5SZ1RhZ3MuZmlsdGVyZWRpdGVtc1thY3RpdmVJbmRleCArIDFdLmFjdGl2ZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGUua2V5Q29kZSA9PSAxMyAmJiBhY3RpdmVJbmRleCAhPSBudWxsKSB7XG4gICAgICAgIF90aGlzLmFkZFRhZyh7XG4gICAgICAgICAgaXRlbTogX3RoaXMuUmdUYWdzLmZpbHRlcmVkaXRlbXNbYWN0aXZlSW5kZXhdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZS5rZXlDb2RlID09IDEzKSB7XG4gICAgICBfdGhpcy5hZGRUYWcoKTtcbiAgICB9IGVsc2UgaWYgKGUua2V5Q29kZSA9PSA4ICYmIF90aGlzLmZpbHRlcmZpZWxkLnZhbHVlID09ICcnICYmIF90aGlzLlJnVGFncy50YWdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZhciB0YWcgPSBfdGhpcy5SZ1RhZ3MudGFncy5wb3AoKTtcbiAgICAgIF90aGlzLmZpbHRlcmZpZWxkLnZhbHVlID0gdGFnLnRleHQ7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIHRoaXMudG9nZ2xlID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLmZpbHRlcigpO1xuICAgIF90aGlzLlJnVGFncy50b2dnbGUoKTtcbiAgfTtcblxuICB0aGlzLmZpbHRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ1RhZ3MuZmlsdGVyKF90aGlzLmZpbHRlcmZpZWxkLnZhbHVlKTtcbiAgfTtcblxuICB0aGlzLmFkZFRhZyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIHRhZyA9IHtcbiAgICAgIHRleHQ6IF90aGlzLmZpbHRlcmZpZWxkLnZhbHVlXG4gICAgfTtcbiAgICBpZiAoZSkgdGFnID0gZS5pdGVtO1xuICAgIGlmICh0YWcudGV4dC5sZW5ndGggPiAwKSBfdGhpcy5SZ1RhZ3MuYWRkVGFnKHRhZyk7XG4gICAgX3RoaXMuZmlsdGVyZmllbGQudmFsdWUgPSAnJztcbiAgfTtcblxuICB0aGlzLnJlbW92ZVRhZyA9IGZ1bmN0aW9uIChlKSB7XG4gICAgX3RoaXMuUmdUYWdzLnJlbW92ZVRhZyhlLml0ZW0pO1xuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnVGFncyA9IG9wdHMudGFncyB8fCBuZXcgUmdUYWdzKG9wdHMpO1xuICAgIF90aGlzLlJnVGFncy5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKF90aGlzLlJnVGFncy5pc3Zpc2libGUpIF90aGlzLmZpbHRlcigpO1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDbGlja091dHNpZGUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgaGFuZGxlQ2xpY2tPdXRzaWRlLCB0cnVlKTtcbiAgICBfdGhpcy5maWx0ZXJmaWVsZC52YWx1ZSA9IF90aGlzLlJnVGFncy52YWx1ZTtcbiAgICBfdGhpcy51cGRhdGUoKTtcbiAgfSk7XG5cbiAgdGhpcy5vbigndW5tb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZUNsaWNrT3V0c2lkZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXMnLCBoYW5kbGVDbGlja091dHNpZGUsIHRydWUpO1xuICB9KTtcblxuICB0aGlzLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKF90aGlzLmlzTW91bnRlZCkge1xuICAgICAgdmFyIGNvbnRhaW5lciA9IF90aGlzLnJvb3QucXVlcnlTZWxlY3RvcignLmNvbnRhaW5lcicpO1xuICAgICAgdmFyIGNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO1xuICAgICAgdmFyIHRhZ0xpc3QgPSBfdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoJy50YWdzJyk7XG4gICAgICB2YXIgdGFnTGlzdFdpZHRoID0gdGFnTGlzdC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcbiAgICAgIHRhZ0xpc3Quc2Nyb2xsTGVmdCA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICAgIHZhciBmaWVsZENvbnRhaW5lciA9IF90aGlzLnJvb3QucXVlcnlTZWxlY3RvcignLmZpZWxkLWNvbnRhaW5lcicpO1xuICAgICAgZmllbGRDb250YWluZXIuc3R5bGUud2lkdGggPSBjb250YWluZXJXaWR0aCAtIHRhZ0xpc3RXaWR0aCArICdweCc7XG4gICAgICBfdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoJy5jb250YWluZXInKS5zdHlsZS5oZWlnaHQgPSBmaWVsZENvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgKyAncHgnO1xuICAgIH1cbiAgfSk7XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctdGltZScsICc8cmctc2VsZWN0IHNlbGVjdD1cIntSZ1RpbWV9XCI+PC9yZy1zZWxlY3Q+JywgJycsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHZhciBidWlsZCA9IGZ1bmN0aW9uIGJ1aWxkKCkge1xuICAgIF90aGlzLlJnVGltZS5vcHRpb25zID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDE0NDA7IGkrKykge1xuICAgICAgaWYgKGkgJSBfdGhpcy5SZ1RpbWUuc3RlcCA9PSAwKSB7XG4gICAgICAgIHZhciBkID0gbmV3IERhdGUoMCk7XG4gICAgICAgIGQuc2V0SG91cnMoX3RoaXMuUmdUaW1lLnRpbWUuZ2V0SG91cnMoKSk7XG4gICAgICAgIGQuc2V0TWludXRlcyhfdGhpcy5SZ1RpbWUudGltZS5nZXRNaW51dGVzKCkpO1xuICAgICAgICBkID0gbmV3IERhdGUoZC5nZXRUaW1lKCkgKyBpICogNjAwMDApO1xuXG4gICAgICAgIGlmIChfdGhpcy5SZ1RpbWUubWluKSB7XG4gICAgICAgICAgaWYgKGQuZ2V0SG91cnMoKSA8IF90aGlzLlJnVGltZS5taW5bMF0pIGNvbnRpbnVlO1xuICAgICAgICAgIGlmIChkLmdldEhvdXJzKCkgPT0gX3RoaXMuUmdUaW1lLm1pblswXSAmJiBkLmdldE1pbnV0ZXMoKSA8IF90aGlzLlJnVGltZS5taW5bMV0pIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF90aGlzLlJnVGltZS5tYXgpIHtcbiAgICAgICAgICBpZiAoZC5nZXRIb3VycygpID4gX3RoaXMuUmdUaW1lLm1heFswXSkgY29udGludWU7XG4gICAgICAgICAgaWYgKGQuZ2V0SG91cnMoKSA9PSBfdGhpcy5SZ1RpbWUubWF4WzBdICYmIGQuZ2V0TWludXRlcygpID4gX3RoaXMuUmdUaW1lLm1heFsxXSkgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHQgPSB7XG4gICAgICAgICAgaG91cnM6IGQuZ2V0SG91cnMoKSxcbiAgICAgICAgICBtaW51dGVzOiBkLmdldE1pbnV0ZXMoKVxuICAgICAgICB9O1xuICAgICAgICB2YXIgbSA9IHQubWludXRlcztcbiAgICAgICAgaWYgKG0gPCAxMCkgbSA9ICcwJyArIG07XG4gICAgICAgIGlmIChfdGhpcy5SZ1RpbWUuYW1wbSkge1xuICAgICAgICAgIHZhciBhbXBtID0gJ2FtJztcbiAgICAgICAgICB2YXIgaCA9IHQuaG91cnM7XG4gICAgICAgICAgaWYgKGggPj0gMTIpIHtcbiAgICAgICAgICAgIGFtcG0gPSAncG0nO1xuICAgICAgICAgICAgaCA9IGggLSAxMjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGggPT0gMCkgaCA9IDEyO1xuICAgICAgICAgIHQudGV4dCA9IGggKyAnOicgKyBtICsgJyAnICsgYW1wbTtcbiAgICAgICAgICB0LnBlcmlvZCA9IGFtcG07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGggPSB0LmhvdXJzO1xuICAgICAgICAgIGlmIChoIDwgMTApIGggPSAnMCcgKyBoO1xuICAgICAgICAgIHQudGV4dCA9IGggKyAnOicgKyBtO1xuICAgICAgICB9XG4gICAgICAgIF90aGlzLlJnVGltZS5vcHRpb25zLnB1c2godCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnVGltZSA9IG9wdHMudGltZSB8fCBuZXcgUmdUaW1lKG9wdHMpO1xuICAgIF90aGlzLlJnVGltZS5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgYnVpbGQoKTtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH0pO1xuICAgIGJ1aWxkKCk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xufSwgJ3sgfScpO1xuXG5yaW90LnRhZzIoJ3JnLXRvYXN0cycsICc8ZGl2IGNsYXNzPVwidG9hc3RzIHtSZ1RvYXN0cy5wb3NpdGlvbn0ge2lzdmlzaWJsZTogUmdUb2FzdHMuaXN2aXNpYmxlfVwiPiA8ZGl2IGVhY2g9XCJ7UmdUb2FzdHMudG9hc3RzfVwiIGNsYXNzPVwidG9hc3Qge2lzdmlzaWJsZTogaXN2aXNpYmxlfVwiIG9uY2xpY2s9XCJ7cGFyZW50LnRvYXN0Q2xpY2tlZH1cIj4gPHJnLXJhdyBjb250ZW50PVwie2NvbnRlbnR9XCI+PC9yZy1yYXc+IDwvZGl2PiA8L2Rpdj4nLCAncmctdG9hc3RzIC50b2FzdHMsW3Jpb3QtdGFnPVwicmctdG9hc3RzXCJdIC50b2FzdHMgeyBkaXNwbGF5OiBub25lOyBwb3NpdGlvbjogZml4ZWQ7IHdpZHRoOiAyNTBweDsgbWF4LWhlaWdodDogMTAwJTsgb3ZlcmZsb3cteTogYXV0bzsgYmFja2dyb3VuZC1jb2xvcjogdHJhbnNwYXJlbnQ7IHotaW5kZXg6IDEwMTsgfSByZy10b2FzdHMgLnRvYXN0cy5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctdG9hc3RzXCJdIC50b2FzdHMuaXN2aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctdG9hc3RzIC50b2FzdHMudG9wbGVmdCxbcmlvdC10YWc9XCJyZy10b2FzdHNcIl0gLnRvYXN0cy50b3BsZWZ0IHsgdG9wOiAwOyBsZWZ0OiAwOyB9IHJnLXRvYXN0cyAudG9hc3RzLnRvcHJpZ2h0LFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3RzLnRvcHJpZ2h0IHsgdG9wOiAwOyByaWdodDogMDsgfSByZy10b2FzdHMgLnRvYXN0cy5ib3R0b21sZWZ0LFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3RzLmJvdHRvbWxlZnQgeyBib3R0b206IDA7IGxlZnQ6IDA7IH0gcmctdG9hc3RzIC50b2FzdHMuYm90dG9tcmlnaHQsW3Jpb3QtdGFnPVwicmctdG9hc3RzXCJdIC50b2FzdHMuYm90dG9tcmlnaHQgeyBib3R0b206IDA7IHJpZ2h0OiAwOyB9IHJnLXRvYXN0cyAudG9hc3QsW3Jpb3QtdGFnPVwicmctdG9hc3RzXCJdIC50b2FzdCB7IGRpc3BsYXk6IG5vbmU7IHBhZGRpbmc6IDIwcHg7IG1hcmdpbjogMjBweDsgYmFja2dyb3VuZC1jb2xvcjogIzAwMDsgY29sb3I6IHdoaXRlOyBmb250LXNpemU6IDAuOWVtOyBjdXJzb3I6IHBvaW50ZXI7IH0gcmctdG9hc3RzIC50b2FzdC5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctdG9hc3RzXCJdIC50b2FzdC5pc3Zpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfScsICcnLCBmdW5jdGlvbiAob3B0cykge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHRoaXMudG9hc3RDbGlja2VkID0gZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgdG9hc3QgPSBlLml0ZW07XG4gICAgaWYgKHJnLmlzRnVuY3Rpb24odG9hc3Qub25jbGljaykpIHRvYXN0Lm9uY2xpY2soKTtcbiAgICBpZiAocmcuaXNGdW5jdGlvbih0b2FzdC5vbmNsb3NlKSkgdG9hc3Qub25jbG9zZSgpO1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodG9hc3QudGltZXIpO1xuICAgIHRvYXN0LmlzdmlzaWJsZSA9IGZhbHNlO1xuICB9O1xuXG4gIHRoaXMub24oJ21vdW50JywgZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnVG9hc3RzID0gb3B0cy50b2FzdHMgfHwgbmV3IFJnVG9hc3RzKG9wdHMpO1xuICAgIF90aGlzLlJnVG9hc3RzLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy51cGRhdGUoKTtcbiAgICB9KTtcbiAgICBfdGhpcy51cGRhdGUoKTtcbiAgfSk7XG59LCAneyB9Jyk7XG5cbnJpb3QudGFnMigncmctdG9nZ2xlJywgJzxkaXYgY2xhc3M9XCJ3cmFwcGVyXCI+IDxsYWJlbCBjbGFzcz1cInRvZ2dsZVwiPiA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgX19jaGVja2VkPVwie1JnVG9nZ2xlLmNoZWNrZWR9XCIgb25jbGljaz1cInt0b2dnbGV9XCI+IDxkaXYgY2xhc3M9XCJ0cmFja1wiPiA8ZGl2IGNsYXNzPVwiaGFuZGxlXCI+PC9kaXY+IDwvZGl2PiA8L2xhYmVsPiA8L2Rpdj4nLCAncmctdG9nZ2xlIC53cmFwcGVyLFtyaW90LXRhZz1cInJnLXRvZ2dsZVwiXSAud3JhcHBlciB7IHdpZHRoOiA2MHB4OyBoZWlnaHQ6IDIwcHg7IG1hcmdpbjogMDsgZGlzcGxheTogaW5saW5lLWJsb2NrOyAtd2Via2l0LXVzZXItc2VsZWN0OiBub25lOyAtbW96LXVzZXItc2VsZWN0OiBub25lOyAtbXMtdXNlci1zZWxlY3Q6IG5vbmU7IHVzZXItc2VsZWN0OiBub25lOyB9IHJnLXRvZ2dsZSAudG9nZ2xlLFtyaW90LXRhZz1cInJnLXRvZ2dsZVwiXSAudG9nZ2xlIHsgcG9zaXRpb246IGFic29sdXRlOyBjdXJzb3I6IHBvaW50ZXI7IH0gcmctdG9nZ2xlIGlucHV0W3R5cGU9Y2hlY2tib3hdLFtyaW90LXRhZz1cInJnLXRvZ2dsZVwiXSBpbnB1dFt0eXBlPWNoZWNrYm94XSB7IGRpc3BsYXk6IG5vbmU7IH0gcmctdG9nZ2xlIC50cmFjayxbcmlvdC10YWc9XCJyZy10b2dnbGVcIl0gLnRyYWNrIHsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDA7IGJvdHRvbTogMDsgbGVmdDogMDsgcmlnaHQ6IDA7IHdpZHRoOiA2MHB4OyBoZWlnaHQ6IDIwcHg7IHBhZGRpbmc6IDJweDsgYmFja2dyb3VuZC1jb2xvcjogI2I2YzBjNzsgdHJhbnNpdGlvbjogYmFja2dyb3VuZC1jb2xvciAwLjFzIGxpbmVhcjsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfSByZy10b2dnbGUgaW5wdXRbdHlwZT1jaGVja2JveF06Y2hlY2tlZCArIC50cmFjayxbcmlvdC10YWc9XCJyZy10b2dnbGVcIl0gaW5wdXRbdHlwZT1jaGVja2JveF06Y2hlY2tlZCArIC50cmFjayB7IGJhY2tncm91bmQtY29sb3I6ICMwMDA7IH0gcmctdG9nZ2xlIC5oYW5kbGUsW3Jpb3QtdGFnPVwicmctdG9nZ2xlXCJdIC5oYW5kbGUgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGxlZnQ6IDA7IHdpZHRoOiA1MCU7IGhlaWdodDogMTAwJTsgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjFzIGxpbmVhcjsgfSByZy10b2dnbGUgaW5wdXRbdHlwZT1jaGVja2JveF06Y2hlY2tlZCArIC50cmFjayAuaGFuZGxlLFtyaW90LXRhZz1cInJnLXRvZ2dsZVwiXSBpbnB1dFt0eXBlPWNoZWNrYm94XTpjaGVja2VkICsgLnRyYWNrIC5oYW5kbGUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDEwMCUsIDAsIDApOyB9JywgJycsIGZ1bmN0aW9uIChvcHRzKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdGhpcy5vbignbW91bnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuUmdUb2dnbGUgPSBvcHRzLnRvZ2dsZSB8fCBuZXcgUmdUb2dnbGUoKTtcbiAgICBfdGhpcy5SZ1RvZ2dsZS5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMudXBkYXRlKCk7XG4gICAgfSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xuXG4gIHRoaXMudG9nZ2xlID0gZnVuY3Rpb24gKCkge1xuICAgIF90aGlzLlJnVG9nZ2xlLnRvZ2dsZSgpO1xuICB9O1xufSwgJ3sgfScpO1xuXG5yaW90LnRhZzIoJ3JnLXVuc3BsYXNoJywgJzxpbWcgcmlvdC1zcmM9XCJodHRwczovL3Vuc3BsYXNoLml0L3tncmV5c2NhbGV9e1JnVW5zcGxhc2gud2lkdGh9L3tSZ1Vuc3BsYXNoLmhlaWdodH0vP3tvcHRpb25zfVwiPicsICcnLCAnJywgZnVuY3Rpb24gKG9wdHMpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLm9uKCdtb3VudCcsIGZ1bmN0aW9uICgpIHtcbiAgICBfdGhpcy5SZ1Vuc3BsYXNoID0gb3B0cy51bnNwbGFzaCB8fCBuZXcgUmdVbnNwbGFzaCgpO1xuICAgIF90aGlzLlJnVW5zcGxhc2gub24oJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIF90aGlzLnVwZGF0ZSgpO1xuICAgIH0pO1xuICAgIF90aGlzLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpcy5vcHRpb25zID0gJyc7XG4gICAgICBpZiAoX3RoaXMuUmdVbnNwbGFzaC5ncmV5c2NhbGUpIF90aGlzLmdyZXlzY2FsZSA9ICdnLyc7XG4gICAgICBpZiAoX3RoaXMuUmdVbnNwbGFzaC5yYW5kb20pIF90aGlzLm9wdGlvbnMgKz0gJ3JhbmRvbSYnO1xuICAgICAgaWYgKF90aGlzLlJnVW5zcGxhc2guYmx1cikgX3RoaXMub3B0aW9ucyArPSAnYmx1ciYnO1xuICAgICAgaWYgKF90aGlzLlJnVW5zcGxhc2guaW1hZ2UpIF90aGlzLm9wdGlvbnMgKz0gJ2ltYWdlPScgKyBfdGhpcy5SZ1Vuc3BsYXNoLmltYWdlICsgJyYnO1xuICAgICAgaWYgKHJnLmlzRGVmaW5lZChfdGhpcy5SZ1Vuc3BsYXNoLmdyYXZpdHkpKSBfdGhpcy5vcHRpb25zICs9ICdncmF2aXR5PScgKyBfdGhpcy5SZ1Vuc3BsYXNoLmdyYXZpdHk7XG4gICAgfSk7XG4gICAgX3RoaXMudXBkYXRlKCk7XG4gIH0pO1xufSwgJ3sgfScpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7dmFyIF9nZXQ9ZnVuY3Rpb24gdChlLGksbyl7dmFyIG49dHJ1ZTt0OndoaWxlKG4pe3ZhciByPWUscz1pLGE9bztuPWZhbHNlO2lmKHI9PT1udWxsKXI9RnVuY3Rpb24ucHJvdG90eXBlO3ZhciBsPU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocixzKTtpZihsPT09dW5kZWZpbmVkKXt2YXIgZz1PYmplY3QuZ2V0UHJvdG90eXBlT2Yocik7aWYoZz09PW51bGwpe3JldHVybiB1bmRlZmluZWR9ZWxzZXtlPWc7aT1zO289YTtuPXRydWU7bD1nPXVuZGVmaW5lZDtjb250aW51ZSB0fX1lbHNlIGlmKFwidmFsdWVcImluIGwpe3JldHVybiBsLnZhbHVlfWVsc2V7dmFyIGM9bC5nZXQ7aWYoYz09PXVuZGVmaW5lZCl7cmV0dXJuIHVuZGVmaW5lZH1yZXR1cm4gYy5jYWxsKGEpfX19O3ZhciBfY3JlYXRlQ2xhc3M9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQsZSl7Zm9yKHZhciBpPTA7aTxlLmxlbmd0aDtpKyspe3ZhciBvPWVbaV07by5lbnVtZXJhYmxlPW8uZW51bWVyYWJsZXx8ZmFsc2U7by5jb25maWd1cmFibGU9dHJ1ZTtpZihcInZhbHVlXCJpbiBvKW8ud3JpdGFibGU9dHJ1ZTtPYmplY3QuZGVmaW5lUHJvcGVydHkodCxvLmtleSxvKX19cmV0dXJuIGZ1bmN0aW9uKGUsaSxvKXtpZihpKXQoZS5wcm90b3R5cGUsaSk7aWYobyl0KGUsbyk7cmV0dXJuIGV9fSgpO2Z1bmN0aW9uIF9pbmhlcml0cyh0LGUpe2lmKHR5cGVvZiBlIT09XCJmdW5jdGlvblwiJiZlIT09bnVsbCl7dGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIrdHlwZW9mIGUpfXQucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoZSYmZS5wcm90b3R5cGUse2NvbnN0cnVjdG9yOnt2YWx1ZTp0LGVudW1lcmFibGU6ZmFsc2Usd3JpdGFibGU6dHJ1ZSxjb25maWd1cmFibGU6dHJ1ZX19KTtpZihlKU9iamVjdC5zZXRQcm90b3R5cGVPZj9PYmplY3Quc2V0UHJvdG90eXBlT2YodCxlKTp0Ll9fcHJvdG9fXz1lfWZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayh0LGUpe2lmKCEodCBpbnN0YW5jZW9mIGUpKXt0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpfX0oZnVuY3Rpb24oKXtpZighd2luZG93LnJnKXdpbmRvdy5yZz17fTtyZy5pc1VuZGVmaW5lZD1mdW5jdGlvbih0KXtyZXR1cm4gdHlwZW9mIHQ9PT1cInVuZGVmaW5lZFwifTtyZy5pc0RlZmluZWQ9ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0IT09XCJ1bmRlZmluZWRcIn07cmcuaXNCb29sZWFuPWZ1bmN0aW9uKHQpe3JldHVybiB0eXBlb2YgdD09PVwiYm9vbGVhblwifTtyZy5pc09iamVjdD1mdW5jdGlvbih0KXtyZXR1cm4gdCE9PW51bGwmJnR5cGVvZiB0PT09XCJvYmplY3RcIn07cmcuaXNTdHJpbmc9ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0PT09XCJzdHJpbmdcIn07cmcuaXNOdW1iZXI9ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0PT09XCJudW1iZXJcIiYmIWlzTmFOKHQpfTtyZy5pc0RhdGU9ZnVuY3Rpb24odCl7cmV0dXJuIHRvU3RyaW5nLmNhbGwodCk9PT1cIltvYmplY3QgRGF0ZV1cIn07cmcuaXNBcnJheT1BcnJheS5pc0FycmF5O3JnLmlzRnVuY3Rpb249ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0PT09XCJmdW5jdGlvblwifTtyZy5pc1JlZ0V4cD1mdW5jdGlvbih0KXtyZXR1cm4gdG9TdHJpbmcuY2FsbCh0KT09PVwiW29iamVjdCBSZWdFeHBdXCJ9O3JnLmlzUHJvbWlzZT1mdW5jdGlvbih0KXtyZXR1cm4gdCYmaXNGdW5jdGlvbih0LnRoZW4pfTtyZy50b0Jvb2xlYW49ZnVuY3Rpb24odCl7cmV0dXJuIHQ9PVwidHJ1ZVwifHx0PT10cnVlfTtyZy50b051bWJlcj1mdW5jdGlvbih0KXt0PU51bWJlcih0KTtyZXR1cm4gcmcuaXNOdW1iZXIodCk/dDowfTt2YXIgdD0wO3JnLnVpZD1mdW5jdGlvbigpe3JldHVybiB0Kyt9O3JnLnhocj1mdW5jdGlvbih0LGUsaSl7dmFyIG89bmV3IFhNTEh0dHBSZXF1ZXN0O28ub25sb2FkPWZ1bmN0aW9uKCl7aWYocmcuaXNGdW5jdGlvbihpKSlpKG8ucmVzcG9uc2VUZXh0KX07by5vcGVuKHQsZSx0cnVlKTtvLnNlbmQoKX19KSgpOyhmdW5jdGlvbigpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIHQodCl7dmFyIGU9W10uaW5kZXhPZnx8ZnVuY3Rpb24odCl7Zm9yKHZhciBlPTAsaT10aGlzLmxlbmd0aDtlPGk7ZSsrKXtpZihlIGluIHRoaXMmJnRoaXNbZV09PT10KXJldHVybiBlfXJldHVybi0xfTt2YXIgaSxvLG4scixzLGEsbCxnLGMsZCx1LGgsZjtyPVt7bmFtZTpcImFtZXhcIixpY29uOlwiaW1hZ2VzL2FtZXgucG5nXCIscGF0dGVybjovXjNbNDddLyx2YWxpZF9sZW5ndGg6WzE1XX0se25hbWU6XCJkaW5lcnNfY2x1YlwiLGljb246XCJpbWFnZXMvZGluZXJzX2NsdWIucG5nXCIscGF0dGVybjovXjMwWzAtNV0vLHZhbGlkX2xlbmd0aDpbMTRdfSx7bmFtZTpcImRpbmVyc19jbHViXCIsaWNvbjpcImltYWdlcy9kaW5lcnNfY2x1Yi5wbmdcIixwYXR0ZXJuOi9eMzYvLHZhbGlkX2xlbmd0aDpbMTRdfSx7bmFtZTpcImpjYlwiLGljb246XCJpbWFnZXMvamNiLnBuZ1wiLHBhdHRlcm46L14zNSgyWzg5XXxbMy04XVswLTldKS8sdmFsaWRfbGVuZ3RoOlsxNl19LHtuYW1lOlwibGFzZXJcIixwYXR0ZXJuOi9eKDYzMDR8NjcwWzY5XXw2NzcxKS8sdmFsaWRfbGVuZ3RoOlsxNiwxNywxOCwxOV19LHtuYW1lOlwidmlzYV9lbGVjdHJvblwiLHBhdHRlcm46L14oNDAyNnw0MTc1MDB8NDUwOHw0ODQ0fDQ5MSgzfDcpKS8sdmFsaWRfbGVuZ3RoOlsxNl19LHtuYW1lOlwidmlzYVwiLGljb246XCJpbWFnZXMvdmlzYS5wbmdcIixwYXR0ZXJuOi9eNC8sdmFsaWRfbGVuZ3RoOlsxNl19LHtuYW1lOlwibWFzdGVyY2FyZFwiLGljb246XCJpbWFnZXMvbWFzdGVyY2FyZC5wbmdcIixwYXR0ZXJuOi9eNVsxLTVdLyx2YWxpZF9sZW5ndGg6WzE2XX0se25hbWU6XCJtYWVzdHJvXCIscGF0dGVybjovXig1MDE4fDUwMjB8NTAzOHw2MzA0fDY3NTl8Njc2WzEtM10pLyx2YWxpZF9sZW5ndGg6WzEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5XX0se25hbWU6XCJkaXNjb3ZlclwiLGljb246XCJpbWFnZXMvZGlzY292ZXIucG5nXCIscGF0dGVybjovXig2MDExfDYyMigxMls2LTldfDFbMy05XVswLTldfFsyLThdWzAtOV17Mn18OVswLTFdWzAtOV18OTJbMC01XXw2NFs0LTldKXw2NSkvLHZhbGlkX2xlbmd0aDpbMTZdfV07dmFyIHA9e307aWYocC5hY2NlcHQ9PW51bGwpe3AuYWNjZXB0PWZ1bmN0aW9uKCl7dmFyIHQsZSxpO2k9W107Zm9yKHQ9MCxlPXIubGVuZ3RoO3Q8ZTt0Kyspe289clt0XTtpLnB1c2goby5uYW1lKX1yZXR1cm4gaX0oKX1mPXAuYWNjZXB0O2Zvcih1PTAsaD1mLmxlbmd0aDt1PGg7dSsrKXtuPWZbdV07aWYoZS5jYWxsKGZ1bmN0aW9uKCl7dmFyIHQsZSxpO2k9W107Zm9yKHQ9MCxlPXIubGVuZ3RoO3Q8ZTt0Kyspe289clt0XTtpLnB1c2goby5uYW1lKX1yZXR1cm4gaX0oKSxuKTwwKXt0aHJvd1wiQ3JlZGl0IGNhcmQgdHlwZSAnXCIrbitcIicgaXMgbm90IHN1cHBvcnRlZFwifX1zPWZ1bmN0aW9uKHQpe3ZhciBpLHMsYTthPWZ1bmN0aW9uKCl7dmFyIHQsaSxuLHM7cz1bXTtmb3IodD0wLGk9ci5sZW5ndGg7dDxpO3QrKyl7bz1yW3RdO2lmKG49by5uYW1lLGUuY2FsbChwLmFjY2VwdCxuKT49MCl7cy5wdXNoKG8pfX1yZXR1cm4gc30oKTtmb3IoaT0wLHM9YS5sZW5ndGg7aTxzO2krKyl7bj1hW2ldO2lmKHQubWF0Y2gobi5wYXR0ZXJuKSl7cmV0dXJuIG59fXJldHVybiBudWxsfTtsPWZ1bmN0aW9uKHQpe3ZhciBlLGksbyxuLHIscztvPTA7cz10LnNwbGl0KFwiXCIpLnJldmVyc2UoKTtmb3IoaT1uPTAscj1zLmxlbmd0aDtuPHI7aT0rK24pe2U9c1tpXTtlPStlO2lmKGklMil7ZSo9MjtpZihlPDEwKXtvKz1lfWVsc2V7bys9ZS05fX1lbHNle28rPWV9fXJldHVybiBvJTEwPT09MH07YT1mdW5jdGlvbih0LGkpe3ZhciBvO3JldHVybiBvPXQubGVuZ3RoLGUuY2FsbChpLnZhbGlkX2xlbmd0aCxvKT49MH07ZD1mdW5jdGlvbih0KXtyZXR1cm4gZnVuY3Rpb24odCl7dmFyIGUsaTtuPXModCk7aT1mYWxzZTtlPWZhbHNlO2lmKG4hPW51bGwpe2k9bCh0KTtlPWEodCxuKX1yZXR1cm57Y2FyZF90eXBlOm4sdmFsaWQ6aSYmZSxsdWhuX3ZhbGlkOmksbGVuZ3RoX3ZhbGlkOmV9fX0odGhpcyk7Zz1mdW5jdGlvbih0KXtyZXR1cm4gdC5yZXBsYWNlKC9bIC1dL2csXCJcIil9O2M9ZnVuY3Rpb24oZSl7cmV0dXJuIGZ1bmN0aW9uKCl7cmV0dXJuIGQoZyh0KSl9fSh0aGlzKTtyZXR1cm4gYyh0KX1yaW90Lm1peGluKFwicmcuY3JlZGl0Y2FyZFwiLHtjcmVkaXRjYXJkOnt2YWxpZGF0ZTp0fX0pO2lmKCF3aW5kb3cucmcpd2luZG93LnJnPXt9O3JnLmNyZWRpdGNhcmQ9e3ZhbGlkYXRlOnR9fSkoKTsoZnVuY3Rpb24oKXt2YXIgdD17aW5pdGlhbGl6ZTpmdW5jdGlvbiBlKCl7dC50cmlnZ2VyKFwiaW5pdGlhbGl6ZVwiKX19O3Jpb3Qub2JzZXJ2YWJsZSh0KTtpZighd2luZG93LnJnKXdpbmRvdy5yZz17fTtyZy5tYXA9dH0pKCk7dmFyIFJnVGFnPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe19jbGFzc0NhbGxDaGVjayh0aGlzLHQpO3Jpb3Qub2JzZXJ2YWJsZSh0aGlzKX1fY3JlYXRlQ2xhc3ModCxbe2tleTpcInVwZGF0ZVwiLHZhbHVlOmZ1bmN0aW9uIGUoKXt0aGlzLnRyaWdnZXIoXCJ1cGRhdGVcIil9fV0pO3JldHVybiB0fSgpO3ZhciBSZ0FsZXJ0cz1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe3ZhciBpPXRoaXM7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5hbGVydHM9W107aWYoIXJnLmlzQXJyYXkodC5hbGVydHMpKXJldHVybjt0LmFsZXJ0cy5mb3JFYWNoKGZ1bmN0aW9uKHQpe2kuYWRkKHQpfSl9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJhZGRcIix2YWx1ZTpmdW5jdGlvbiBpKHQpe3ZhciBlPXRoaXM7dC5pZD1yZy51aWQoKTtpZihyZy5pc1VuZGVmaW5lZCh0LmlzdmlzaWJsZSkpdC5pc3Zpc2libGU9dHJ1ZTtpZih0LnRpbWVvdXQpe3Quc3RhcnRUaW1lcj1mdW5jdGlvbigpe3QudGltZXI9c2V0VGltZW91dChmdW5jdGlvbigpe2UuZGlzbWlzcyh0KTtlLnVwZGF0ZSgpfSxyZy50b051bWJlcih0LnRpbWVvdXQpKX07dC5zdGFydFRpbWVyKCl9dGhpcy5hbGVydHMucHVzaCh0KX19LHtrZXk6XCJkaXNtaXNzXCIsdmFsdWU6ZnVuY3Rpb24gbyh0KXt0LmlzdmlzaWJsZT1mYWxzZTtpZihyZy5pc0Z1bmN0aW9uKHQub25jbG9zZSkpdC5vbmNsb3NlKHQpO2NsZWFyVGltZW91dCh0LnRpbWVyKX19LHtrZXk6XCJzZWxlY3RcIix2YWx1ZTpmdW5jdGlvbiBuKHQpe2lmKHJnLmlzRnVuY3Rpb24odC5vbmNsaWNrKSl0Lm9uY2xpY2sodCl9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnQmVob2xkPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5faW1hZ2UxPXQuaW1hZ2UxO3RoaXMuX2ltYWdlMj10LmltYWdlMjt0aGlzLl9tb2RlPXQubW9kZX1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcImltYWdlMVwiLGdldDpmdW5jdGlvbiBpKCl7cmV0dXJuIHRoaXMuX2ltYWdlMX0sc2V0OmZ1bmN0aW9uIG8odCl7dGhpcy5faW1hZ2UxPXR9fSx7a2V5OlwiaW1hZ2UyXCIsZ2V0OmZ1bmN0aW9uIG4oKXtyZXR1cm4gdGhpcy5faW1hZ2UyfSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl9pbWFnZTI9dH19LHtrZXk6XCJtb2RlXCIsZ2V0OmZ1bmN0aW9uIHMoKXtyZXR1cm4gdGhpcy5fbW9kZXx8XCJzd2lwZVwifSxzZXQ6ZnVuY3Rpb24gYSh0KXt0aGlzLl9tb2RlPXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnQnViYmxlPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5faXN2aXNpYmxlPXQuaXN2aXNpYmxlO3RoaXMuX2NvbnRlbnQ9dC5jb250ZW50fV9jcmVhdGVDbGFzcyhlLFt7a2V5Olwic2hvd0J1YmJsZVwiLHZhbHVlOmZ1bmN0aW9uIGkoKXtjbGVhclRpbWVvdXQodGhpcy5fdGltZXIpO3RoaXMuaXN2aXNpYmxlPXRydWV9fSx7a2V5OlwiaGlkZUJ1YmJsZVwiLHZhbHVlOmZ1bmN0aW9uIG8oKXt2YXIgdD10aGlzO3RoaXMuX3RpbWVyPXNldFRpbWVvdXQoZnVuY3Rpb24oKXt0LmlzdmlzaWJsZT1mYWxzZTt0LnVwZGF0ZSgpfSwxZTMpfX0se2tleTpcInRvZ2dsZUJ1YmJsZVwiLHZhbHVlOmZ1bmN0aW9uIG4oKXt0aGlzLmlzdmlzaWJsZT0hdGhpcy5pc3Zpc2libGV9fSx7a2V5OlwiaXN2aXNpYmxlXCIsZ2V0OmZ1bmN0aW9uIHIoKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2lzdmlzaWJsZSl9LHNldDpmdW5jdGlvbiBzKHQpe3RoaXMuX2lzdmlzaWJsZT10fX0se2tleTpcImNvbnRlbnRcIixnZXQ6ZnVuY3Rpb24gYSgpe3JldHVybiB0aGlzLl9jb250ZW50fHxcIlwifSxzZXQ6ZnVuY3Rpb24gbCh0KXt0aGlzLl9jb250ZW50PXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnQ29kZT1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O3RoaXMuX3VybD10LnVybDt0aGlzLl9jb2RlPXQuY29kZTt0aGlzLl9vbmNoYW5nZT10Lm9uY2hhbmdlO3RoaXMuX3RoZW1lPXQudGhlbWU7dGhpcy5fbW9kZT10Lm1vZGU7dGhpcy5fdGFic2l6ZT10LnRhYnNpemU7dGhpcy5fc29mdHRhYnM9dC5zb2Z0dGFiczt0aGlzLl93b3Jkd3JhcD10LndvcmR3cmFwO3RoaXMuX3JlYWRvbmx5PXQucmVhZG9ubHl9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJ1cmxcIixnZXQ6ZnVuY3Rpb24gaSgpe3JldHVybiB0aGlzLl91cmx9LHNldDpmdW5jdGlvbiBvKHQpe3RoaXMuX3VybD10fX0se2tleTpcImNvZGVcIixnZXQ6ZnVuY3Rpb24gbigpe3JldHVybiB0aGlzLl9jb2RlfHxcIlwifSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl9jb2RlPXR9fSx7a2V5Olwib25jaGFuZ2VcIixnZXQ6ZnVuY3Rpb24gcygpe2lmKHJnLmlzRnVuY3Rpb24odGhpcy5fb25jaGFuZ2UpKXJldHVybiB0aGlzLl9vbmNoYW5nZTtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uIGEodCl7aWYocmcuaXNGdW5jdGlvbih0KSl0aGlzLl9vbmNoYW5nZT10fX0se2tleTpcInRoZW1lXCIsZ2V0OmZ1bmN0aW9uIGwoKXtyZXR1cm4gdGhpcy5fdGhlbWV8fFwibW9ub2thaVwifSxzZXQ6ZnVuY3Rpb24gZyh0KXt0aGlzLl90aGVtZT10fX0se2tleTpcIm1vZGVcIixnZXQ6ZnVuY3Rpb24gYygpe3JldHVybiB0aGlzLl9tb2RlfHxcImh0bWxcIn0sc2V0OmZ1bmN0aW9uIGQodCl7dGhpcy5fbW9kZT10fX0se2tleTpcInRhYnNpemVcIixnZXQ6ZnVuY3Rpb24gdSgpe3JldHVybiByZy50b051bWJlcih0aGlzLl90YWJzaXplKXx8Mn0sc2V0OmZ1bmN0aW9uIGgodCl7dGhpcy5fdGFic2l6ZT10fX0se2tleTpcInNvZnR0YWJzXCIsZ2V0OmZ1bmN0aW9uIGYoKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3NvZnR0YWJzKX0sc2V0OmZ1bmN0aW9uIHAodCl7dGhpcy5fc29mdHRhYnM9dH19LHtrZXk6XCJ3b3Jkd3JhcFwiLGdldDpmdW5jdGlvbiBtKCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl93b3Jkd3JhcCl9LHNldDpmdW5jdGlvbiBiKHQpe3RoaXMuX3dvcmR3cmFwPXR9fSx7a2V5OlwicmVhZG9ubHlcIixnZXQ6ZnVuY3Rpb24gdigpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5fcmVhZG9ubHkpfSxzZXQ6ZnVuY3Rpb24geSh0KXt0aGlzLl9yZWFkb25seT10fX1dKTtyZXR1cm4gZX0oUmdUYWcpO3ZhciBSZ0NvbnRleHRNZW51PWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7dmFyIGk9dGhpcztfY2xhc3NDYWxsQ2hlY2sodGhpcyxlKTtfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJjb25zdHJ1Y3RvclwiLHRoaXMpLmNhbGwodGhpcyk7aWYocmcuaXNVbmRlZmluZWQodCkpdD17fTt0aGlzLm5hbWU9dC5uYW1lO3RoaXMuX2lzdmlzaWJsZT10LmlzdmlzaWJsZTt0aGlzLl9vbmNsb3NlPXQub25jbG9zZTt0aGlzLl9vbm9wZW49dC5vbm9wZW47dGhpcy5faXRlbXM9W107aWYoIXJnLmlzQXJyYXkodC5pdGVtcykpcmV0dXJuO3QuaXRlbXMuZm9yRWFjaChmdW5jdGlvbih0KXtpLmFkZCh0KX0pfV9jcmVhdGVDbGFzcyhlLFt7a2V5OlwiYWRkXCIsdmFsdWU6ZnVuY3Rpb24gaSh0KXt0LmlkPXJnLnVpZCgpO2lmKHJnLmlzVW5kZWZpbmVkKHQuaXN2aXNpYmxlKSl0LmlzdmlzaWJsZT10cnVlO2lmKHJnLmlzVW5kZWZpbmVkKHQuaW5hY3RpdmUpKXQuaW5hY3RpdmU9ZmFsc2U7aWYoIXJnLmlzRnVuY3Rpb24odC5vbmNsaWNrKSl0Lm9uY2xpY2s9bnVsbDt0aGlzLl9pdGVtcy5wdXNoKHQpfX0se2tleTpcInNlbGVjdFwiLHZhbHVlOmZ1bmN0aW9uIG8odCl7aWYoIXQuaW5hY3RpdmUpe2lmKHJnLmlzRnVuY3Rpb24odC5vbmNsaWNrKSl0Lm9uY2xpY2sodCk7dGhpcy5pc3Zpc2libGU9ZmFsc2V9fX0se2tleTpcIml0ZW1zXCIsZ2V0OmZ1bmN0aW9uIG4oKXtpZihyZy5pc0FycmF5KHRoaXMuX2l0ZW1zKSlyZXR1cm4gdGhpcy5faXRlbXM7dGhpcy5faXRlbXM9W107cmV0dXJuIHRoaXMuX2l0ZW1zfSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl9pdGVtcz10fX0se2tleTpcIm9ub3BlblwiLGdldDpmdW5jdGlvbiBzKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbm9wZW4pKXJldHVybiB0aGlzLl9vbm9wZW47cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiBhKHQpe2lmKHJnLmlzRnVuY3Rpb24odCkpdGhpcy5fb25vcGVuPXR9fSx7a2V5Olwib25jbG9zZVwiLGdldDpmdW5jdGlvbiBsKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbmNsb3NlKSlyZXR1cm4gdGhpcy5fb25jbG9zZTtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uIGcodCl7aWYocmcuaXNGdW5jdGlvbih0KSl0aGlzLl9vbmNsb3NlPXR9fSx7a2V5OlwiaXN2aXNpYmxlXCIsZ2V0OmZ1bmN0aW9uIGMoKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2lzdmlzaWJsZSl9LHNldDpmdW5jdGlvbiBkKHQpe3RoaXMuX2lzdmlzaWJsZT1yZy50b0Jvb2xlYW4odCl9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnQ3JlZGl0Q2FyZD1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O3RoaXMuX3BsYWNlaG9sZGVyPXQucGxhY2Vob2xkZXI7dGhpcy5fY2FyZG51bWJlcj10LmNhcmRudW1iZXJ9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJ2YWxpZGF0ZVwiLHZhbHVlOmZ1bmN0aW9uIGkoKXt2YXIgdD1yZy5jcmVkaXRjYXJkLnZhbGlkYXRlKHRoaXMuY2FyZG51bWJlcik7dGhpcy52YWxpZD10LnZhbGlkO3RoaXMuaWNvbj10aGlzLnZhbGlkP3QuY2FyZF90eXBlLm5hbWU6XCJcIn19LHtrZXk6XCJjYXJkbnVtYmVyXCIsZ2V0OmZ1bmN0aW9uIG8oKXtyZXR1cm4odGhpcy5fY2FyZG51bWJlcnx8XCJcIikudG9TdHJpbmcoKX0sc2V0OmZ1bmN0aW9uIG4odCl7dGhpcy5fY2FyZG51bWJlcj10fX0se2tleTpcInZhbGlkXCIsZ2V0OmZ1bmN0aW9uIHIoKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3ZhbGlkKX0sc2V0OmZ1bmN0aW9uIHModCl7dGhpcy5fdmFsaWQ9cmcudG9Cb29sZWFuKHQpfX0se2tleTpcInBsYWNlaG9sZGVyXCIsZ2V0OmZ1bmN0aW9uIGEoKXtyZXR1cm4gdGhpcy5fcGxhY2Vob2xkZXJ8fFwiQ2FyZCBuby5cIn0sc2V0OmZ1bmN0aW9uIGwodCl7dGhpcy5fcGxhY2Vob2xkZXI9dH19XSk7cmV0dXJuIGV9KFJnVGFnKTt2YXIgUmdEYXRlPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5faXN2aXNpYmxlPXQuaXN2aXNpYmxlO3RoaXMuX2RhdGU9dC5kYXRlO3RoaXMuX3Nob3dZZWFycz10LnNob3d5ZWFyczt0aGlzLl9zaG93TW9udGhzPXQuc2hvd21vbnRoczt0aGlzLl9zaG93VG9kYXk9dC5zaG93dG9kYXk7dGhpcy5fZm9ybWF0PXQuZm9ybWF0O3RoaXMuX3llYXJGb3JtYXQ9dC55ZWFyZm9ybWF0O3RoaXMuX21vbnRoRm9ybWF0PXQubW9udGhmb3JtYXQ7dGhpcy5fd2Vla0Zvcm1hdD10LndlZWtmb3JtYXQ7dGhpcy5fZGF5Rm9ybWF0PXQuZGF5Zm9ybWF0O3RoaXMuX29uY2xvc2U9dC5vbmNsb3NlO3RoaXMuX29uc2VsZWN0PXQub25zZWxlY3Q7dGhpcy5fb25vcGVuPXQub25vcGVuO3ZhciBpPW1vbWVudCgpO3RoaXMuZGF5TmFtZXM9W2kuZGF5KDApLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLGkuZGF5KDEpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLGkuZGF5KDIpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLGkuZGF5KDMpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLGkuZGF5KDQpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLGkuZGF5KDUpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpLGkuZGF5KDYpLmZvcm1hdCh0aGlzLndlZWtGb3JtYXQpXX1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcIl90b01vbWVudFwiLHZhbHVlOmZ1bmN0aW9uIGkodCl7aWYoIW1vbWVudC5pc01vbWVudCh0KSl0PW1vbWVudCh0KTtpZih0LmlzVmFsaWQoKSlyZXR1cm4gdDtyZXR1cm4gbW9tZW50KCl9fSx7a2V5Olwib3BlblwiLHZhbHVlOmZ1bmN0aW9uIG8oKXt0aGlzLl9pc3Zpc2libGU9dHJ1ZTtpZihyZy5pc0Z1bmN0aW9uKHRoaXMuX29ub3BlbikpdGhpcy5fb25vcGVuKCl9fSx7a2V5OlwiY2xvc2VcIix2YWx1ZTpmdW5jdGlvbiBuKCl7aWYodGhpcy5pc3Zpc2libGUpe3RoaXMuX2lzdmlzaWJsZT1mYWxzZTtpZihyZy5pc0Z1bmN0aW9uKHRoaXMuX29uY2xvc2UpKXRoaXMuX29uY2xvc2UoKX19fSx7a2V5Olwic2V0VG9kYXlcIix2YWx1ZTpmdW5jdGlvbiByKCl7dGhpcy5zZWxlY3QobW9tZW50KCkpfX0se2tleTpcInByZXZZZWFyXCIsdmFsdWU6ZnVuY3Rpb24gcygpe3RoaXMuX2RhdGU9dGhpcy5kYXRlLnN1YnRyYWN0KDEsXCJ5ZWFyXCIpfX0se2tleTpcIm5leHRZZWFyXCIsdmFsdWU6ZnVuY3Rpb24gYSgpe3RoaXMuX2RhdGU9dGhpcy5kYXRlLmFkZCgxLFwieWVhclwiKX19LHtrZXk6XCJwcmV2TW9udGhcIix2YWx1ZTpmdW5jdGlvbiBsKCl7dGhpcy5fZGF0ZT10aGlzLmRhdGUuc3VidHJhY3QoMSxcIm1vbnRoXCIpfX0se2tleTpcIm5leHRNb250aFwiLHZhbHVlOmZ1bmN0aW9uIGcoKXt0aGlzLl9kYXRlPXRoaXMuZGF0ZS5hZGQoMSxcIm1vbnRoXCIpfX0se2tleTpcInNlbGVjdFwiLHZhbHVlOmZ1bmN0aW9uIGModCl7dGhpcy5fZGF0ZT10O2lmKHJnLmlzRnVuY3Rpb24odGhpcy5fb25zZWxlY3QpKXRoaXMuX29uc2VsZWN0KHRoaXMuZGF0ZSl9fSx7a2V5OlwiZGF0ZVwiLGdldDpmdW5jdGlvbiBkKCl7cmV0dXJuIHRoaXMuX3RvTW9tZW50KHRoaXMuX2RhdGUpfSxzZXQ6ZnVuY3Rpb24gdSh0KXt0aGlzLl9kYXRlPXQ7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbnNlbGVjdCkpdGhpcy5fb25zZWxlY3QodGhpcy5kYXRlKTt0aGlzLl9pc3Zpc2libGU9ZmFsc2V9fSx7a2V5OlwiZGF0ZUZvcm1hdHRlZFwiLGdldDpmdW5jdGlvbiBoKCl7cmV0dXJuIHRoaXMuZGF0ZS5mb3JtYXQodGhpcy5mb3JtYXQpfX0se2tleTpcImlzdmlzaWJsZVwiLGdldDpmdW5jdGlvbiBmKCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpfX0se2tleTpcInllYXJcIixnZXQ6ZnVuY3Rpb24gcCgpe3JldHVybiB0aGlzLmRhdGUuZm9ybWF0KHRoaXMueWVhckZvcm1hdCl9fSx7a2V5OlwibW9udGhcIixnZXQ6ZnVuY3Rpb24gbSgpe3JldHVybiB0aGlzLmRhdGUuZm9ybWF0KHRoaXMubW9udGhGb3JtYXQpfX0se2tleTpcImRheVwiLGdldDpmdW5jdGlvbiBiKCl7cmV0dXJuIHRoaXMuZGF0ZS5mb3JtYXQodGhpcy5kYXlGb3JtYXQpfX0se2tleTpcInNob3dZZWFyc1wiLGdldDpmdW5jdGlvbiB2KCl7aWYocmcuaXNVbmRlZmluZWQodGhpcy5fc2hvd1llYXJzKSlyZXR1cm4gdHJ1ZTtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX3Nob3dZZWFycyl9LHNldDpmdW5jdGlvbiB5KHQpe3RoaXMuX3Nob3dZZWFycz1yZy50b0Jvb2xlYW4odCl9fSx7a2V5Olwic2hvd01vbnRoc1wiLGdldDpmdW5jdGlvbiB3KCl7aWYocmcuaXNVbmRlZmluZWQodGhpcy5fc2hvd01vbnRocykpcmV0dXJuIHRydWU7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9zaG93TW9udGhzKX0sc2V0OmZ1bmN0aW9uIGsodCl7dGhpcy5fc2hvd01vbnRocz1yZy50b0Jvb2xlYW4odCl9fSx7a2V5Olwic2hvd1RvZGF5XCIsZ2V0OmZ1bmN0aW9uIF8oKXtpZihyZy5pc1VuZGVmaW5lZCh0aGlzLl9zaG93VG9kYXkpKXJldHVybiB0cnVlO3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5fc2hvd1RvZGF5KX0sc2V0OmZ1bmN0aW9uIFIodCl7dGhpcy5fc2hvd1RvZGF5PXJnLnRvQm9vbGVhbih0KX19LHtrZXk6XCJmb3JtYXRcIixnZXQ6ZnVuY3Rpb24geCgpe3JldHVybiB0aGlzLl9mb3JtYXR8fFwiTExcIn0sc2V0OmZ1bmN0aW9uIFQodCl7dGhpcy5fZm9ybWF0PXR9fSx7a2V5OlwieWVhckZvcm1hdFwiLGdldDpmdW5jdGlvbiBDKCl7cmV0dXJuIHRoaXMuX3llYXJGb3JtYXR8fFwiWVlZWVwifSxzZXQ6ZnVuY3Rpb24gRCh0KXt0aGlzLl95ZWFyRm9ybWF0PXR9fSx7a2V5OlwibW9udGhGb3JtYXRcIixnZXQ6ZnVuY3Rpb24gQigpe3JldHVybiB0aGlzLl9tb250aEZvcm1hdHx8XCJNTU1NXCJ9LHNldDpmdW5jdGlvbiBGKHQpe3RoaXMuX21vbnRoRm9ybWF0PXR9fSx7a2V5Olwid2Vla0Zvcm1hdFwiLGdldDpmdW5jdGlvbiBTKCl7cmV0dXJuIHRoaXMuX3dlZWtGb3JtYXR8fFwiZGRkXCJ9LHNldDpmdW5jdGlvbiBOKHQpe3RoaXMuX3dlZWtGb3JtYXQ9dH19LHtrZXk6XCJkYXlGb3JtYXRcIixnZXQ6ZnVuY3Rpb24gVSgpe3JldHVybiB0aGlzLl9kYXlGb3JtYXR8fFwiRERcIn0sc2V0OmZ1bmN0aW9uIHoodCl7dGhpcy5fZGF5Rm9ybWF0PXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnRHJhd2VyPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5faXN2aXNpYmxlPXQuaXN2aXNpYmxlO3RoaXMuX2hlYWRlcj10LmhlYWRlcjt0aGlzLl9pdGVtcz10Lml0ZW1zO3RoaXMuX3Bvc2l0aW9uPXQucG9zaXRpb247dGhpcy5fb25zZWxlY3Q9dC5vbnNlbGVjdDt0aGlzLl9vbm9wZW49dC5vbm9wZW47dGhpcy5fb25jbG9zZT10Lm9uY2xvc2V9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJvcGVuXCIsdmFsdWU6ZnVuY3Rpb24gaSgpe2lmKHRoaXMub25vcGVuJiYhdGhpcy5pc3Zpc2libGUpdGhpcy5vbm9wZW4oKTt0aGlzLmlzdmlzaWJsZT10cnVlfX0se2tleTpcImNsb3NlXCIsdmFsdWU6ZnVuY3Rpb24gbygpe2lmKHRoaXMub25jbG9zZSYmdGhpcy5pc3Zpc2libGUpdGhpcy5vbmNsb3NlKCk7dGhpcy5pc3Zpc2libGU9ZmFsc2V9fSx7a2V5OlwidG9nZ2xlXCIsdmFsdWU6ZnVuY3Rpb24gbigpe3RoaXMuaXN2aXNpYmxlPSF0aGlzLmlzdmlzaWJsZTtpZih0aGlzLm9ub3BlbiYmdGhpcy5pc3Zpc2libGUpdGhpcy5vbm9wZW4oKTtlbHNlIGlmKHRoaXMub25jbG9zZSYmIXRoaXMuaXN2aXNpYmxlKXRoaXMub25jbG9zZSgpfX0se2tleTpcInNlbGVjdFwiLHZhbHVlOmZ1bmN0aW9uIHIodCl7dGhpcy5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiB0LmFjdGl2ZT1mYWxzZX0pO3QuYWN0aXZlPXRydWU7aWYodC5hY3Rpb24pdC5hY3Rpb24odCk7aWYodGhpcy5vbnNlbGVjdCl0aGlzLm9uc2VsZWN0KHQpfX0se2tleTpcImlzdmlzaWJsZVwiLGdldDpmdW5jdGlvbiBzKCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9pc3Zpc2libGUpfSxzZXQ6ZnVuY3Rpb24gYSh0KXt0aGlzLl9pc3Zpc2libGU9dH19LHtrZXk6XCJoZWFkZXJcIixnZXQ6ZnVuY3Rpb24gbCgpe3JldHVybiB0aGlzLl9oZWFkZXJ9LHNldDpmdW5jdGlvbiBnKHQpe3RoaXMuX2hlYWRlcj10fX0se2tleTpcIml0ZW1zXCIsZ2V0OmZ1bmN0aW9uIGMoKXtpZihyZy5pc0FycmF5KHRoaXMuX2l0ZW1zKSlyZXR1cm4gdGhpcy5faXRlbXM7dGhpcy5faXRlbXM9W107cmV0dXJuIHRoaXMuX2l0ZW1zfSxzZXQ6ZnVuY3Rpb24gZCh0KXt0aGlzLl9pdGVtcz10fX0se2tleTpcInBvc2l0aW9uXCIsZ2V0OmZ1bmN0aW9uIHUoKXtyZXR1cm4gdGhpcy5fcG9zaXRpb258fFwiYm90dG9tXCJ9LHNldDpmdW5jdGlvbiBoKHQpe3RoaXMuX3Bvc2l0aW9uPXR9fSx7a2V5Olwib25vcGVuXCIsZ2V0OmZ1bmN0aW9uIGYoKXtpZihyZy5pc0Z1bmN0aW9uKHRoaXMuX29ub3BlbikpcmV0dXJuIHRoaXMuX29ub3BlbjtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uIHAodCl7dGhpcy5fb25vcGVuPXR9fSx7a2V5Olwib25jbG9zZVwiLGdldDpmdW5jdGlvbiBtKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbmNsb3NlKSlyZXR1cm4gdGhpcy5fb25jbG9zZTtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uIGIodCl7dGhpcy5fb25jbG9zZT10fX0se2tleTpcIm9uc2VsZWN0XCIsZ2V0OmZ1bmN0aW9uIHYoKXtpZihyZy5pc0Z1bmN0aW9uKHRoaXMuX29uc2VsZWN0KSlyZXR1cm4gdGhpcy5fb25zZWxlY3Q7cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiB5KHQpe3RoaXMuX29uc2VsZWN0PXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnSW5jbHVkZT1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O3RoaXMuX3Vuc2FmZT10LnVuc2FmZTt0aGlzLl91cmw9dC51cmx9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJmZXRjaFwiLHZhbHVlOmZ1bmN0aW9uIGkoKXt2YXIgdD10aGlzO3JnLnhocihcImdldFwiLHRoaXMudXJsLGZ1bmN0aW9uKGUpe3QudHJpZ2dlcihcImZldGNoXCIsZSl9KX19LHtrZXk6XCJ1bnNhZmVcIixnZXQ6ZnVuY3Rpb24gbygpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5fdW5zYWZlKX0sc2V0OmZ1bmN0aW9uIG4odCl7dGhpcy5fdW5zYWZlPXR9fSx7a2V5OlwidXJsXCIsZ2V0OmZ1bmN0aW9uIHIoKXtyZXR1cm4gdGhpcy5fdXJsfHxcIlwifSxzZXQ6ZnVuY3Rpb24gcyh0KXtpZih0aGlzLnVybCE9dCl7dGhpcy5fdXJsPXR9fX1dKTtyZXR1cm4gZX0oUmdUYWcpO3ZhciBSZ0xvYWRpbmc9ZnVuY3Rpb24odCl7X2luaGVyaXRzKGUsdCk7ZnVuY3Rpb24gZSh0KXtfY2xhc3NDYWxsQ2hlY2sodGhpcyxlKTtfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJjb25zdHJ1Y3RvclwiLHRoaXMpLmNhbGwodGhpcyk7aWYocmcuaXNVbmRlZmluZWQodCkpdD17fTt0aGlzLl9pc3Zpc2libGU9dC5pc3Zpc2libGV9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJpc3Zpc2libGVcIixnZXQ6ZnVuY3Rpb24gaSgpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5faXN2aXNpYmxlKX0sc2V0OmZ1bmN0aW9uIG8odCl7dGhpcy5faXN2aXNpYmxlPXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnTWFwPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO3RoaXMuX29wdGlvbnM9dH1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcIm9wdGlvbnNcIixnZXQ6ZnVuY3Rpb24gaSgpe2lmKHJnLmlzVW5kZWZpbmVkKHRoaXMuX29wdGlvbnMpKXt0aGlzLl9vcHRpb25zPXtjZW50ZXI6e2xhdDo1My44MDYsbG5nOi0xLjUzNX0sem9vbTo3fX1yZXR1cm4gdGhpcy5fb3B0aW9uc319XSk7cmV0dXJuIGV9KFJnVGFnKTt2YXIgUmdNYXJrZG93bj1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O2lmKGNvbW1vbm1hcmspe3RoaXMucmVhZGVyPW5ldyBjb21tb25tYXJrLlBhcnNlcjt0aGlzLndyaXRlcj1uZXcgY29tbW9ubWFyay5IdG1sUmVuZGVyZXJ9dGhpcy5fdXJsPXQudXJsfV9jcmVhdGVDbGFzcyhlLFt7a2V5OlwicGFyc2VcIix2YWx1ZTpmdW5jdGlvbiBpKHQpe3ZhciBlPXRoaXMucmVhZGVyLnBhcnNlKHQpO3RoaXMudHJpZ2dlcihcInBhcnNlXCIsdGhpcy53cml0ZXIucmVuZGVyKGUpKTtyZXR1cm4gdGhpcy53cml0ZXIucmVuZGVyKGUpfX0se2tleTpcImZldGNoXCIsdmFsdWU6ZnVuY3Rpb24gbygpe3ZhciB0PXRoaXM7cmcueGhyKFwiZ2V0XCIsdGhpcy51cmwsZnVuY3Rpb24oZSl7dC50cmlnZ2VyKFwiZmV0Y2hcIixlKX0pfX0se2tleTpcInVybFwiLGdldDpmdW5jdGlvbiBuKCl7cmV0dXJuIHRoaXMuX3VybHx8XCJcIn0sc2V0OmZ1bmN0aW9uIHIodCl7dGhpcy5fdXJsPXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnTW9kYWw9ZnVuY3Rpb24odCl7X2luaGVyaXRzKGUsdCk7ZnVuY3Rpb24gZSh0KXtfY2xhc3NDYWxsQ2hlY2sodGhpcyxlKTtfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJjb25zdHJ1Y3RvclwiLHRoaXMpLmNhbGwodGhpcyk7dGhpcy5faXN2aXNpYmxlPXQuaXN2aXNpYmxlO3RoaXMuX2Rpc21pc3NhYmxlPXQuZGlzbWlzc2FibGU7dGhpcy5fZ2hvc3Q9dC5naG9zdDt0aGlzLl9oZWFkaW5nPXQuaGVhZGluZzt0aGlzLl9idXR0b25zPXQuYnV0dG9uczt0aGlzLl9vbmNsb3NlPXQub25jbG9zZTt0aGlzLl9vbm9wZW49dC5vbm9wZW59X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJkaXNtaXNzYWJsZVwiLGdldDpmdW5jdGlvbiBpKCl7aWYocmcuaXNVbmRlZmluZWQodGhpcy5fZGlzbWlzc2FibGUpKXRoaXMuX2Rpc21pc3NhYmxlPXRydWU7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9kaXNtaXNzYWJsZSl9LHNldDpmdW5jdGlvbiBvKHQpe3RoaXMuX2Rpc21pc3NhYmxlPXR9fSx7a2V5OlwiZ2hvc3RcIixnZXQ6ZnVuY3Rpb24gbigpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5fZ2hvc3QpfSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl9naG9zdD10fX0se2tleTpcImhlYWRpbmdcIixnZXQ6ZnVuY3Rpb24gcygpe3JldHVybiB0aGlzLl9oZWFkaW5nfHxcIlwifSxzZXQ6ZnVuY3Rpb24gYSh0KXt0aGlzLl9oZWFkaW5nPXR9fSx7a2V5OlwiYnV0dG9uc1wiLGdldDpmdW5jdGlvbiBsKCl7aWYocmcuaXNBcnJheSh0aGlzLl9idXR0b25zKSlyZXR1cm4gdGhpcy5fYnV0dG9ucztyZXR1cm5bXX0sc2V0OmZ1bmN0aW9uIGcodCl7dGhpcy5fYnV0dG9ucz10fX0se2tleTpcIm9ub3BlblwiLGdldDpmdW5jdGlvbiBjKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbm9wZW4pKXJldHVybiB0aGlzLl9vbm9wZW47cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiBkKHQpe3RoaXMuX29ub3Blbj10fX0se2tleTpcIm9uY2xvc2VcIixnZXQ6ZnVuY3Rpb24gdSgpe2lmKHJnLmlzRnVuY3Rpb24odGhpcy5fb25jbG9zZSkpcmV0dXJuIHRoaXMuX29uY2xvc2U7cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiBoKHQpe3RoaXMuX29uY2xvc2U9dH19LHtrZXk6XCJpc3Zpc2libGVcIixnZXQ6ZnVuY3Rpb24gZigpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5faXN2aXNpYmxlKX0sc2V0OmZ1bmN0aW9uIHAodCl7dGhpcy5faXN2aXNpYmxlPXQ7aWYodGhpcy5pc3Zpc2libGUmJnRoaXMub25vcGVuKXRoaXMub25vcGVuKCk7aWYoIXRoaXMuaXN2aXNpYmxlJiZ0aGlzLm9uY2xvc2UpdGhpcy5vbmNsb3NlKCl9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnUGhvbmVTaW09ZnVuY3Rpb24odCl7X2luaGVyaXRzKGUsdCk7ZnVuY3Rpb24gZSh0KXtfY2xhc3NDYWxsQ2hlY2sodGhpcyxlKTtfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJjb25zdHJ1Y3RvclwiLHRoaXMpLmNhbGwodGhpcyk7aWYocmcuaXNVbmRlZmluZWQodCkpdD17fTt0aGlzLl91cmw9dC51cmx9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJ1cmxcIixnZXQ6ZnVuY3Rpb24gaSgpe3JldHVybiB0aGlzLl91cmx8fFwiXCJ9LHNldDpmdW5jdGlvbiBvKHQpe3RoaXMuX3VybD10fX1dKTtyZXR1cm4gZX0oUmdUYWcpO3ZhciBSZ1BsYWNlaG9sZGl0PWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5fd2lkdGg9dC53aWR0aDt0aGlzLl9oZWlnaHQ9dC5oZWlnaHQ7dGhpcy5fYmFja2dyb3VuZD10LmJhY2tncm91bmQ7dGhpcy5fY29sb3I9dC5jb2xvcjt0aGlzLl90ZXh0PXQudGV4dDt0aGlzLl90ZXh0c2l6ZT10LnRleHRzaXplO3RoaXMuX2Zvcm1hdD10LmZvcm1hdH1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcIndpZHRoXCIsZ2V0OmZ1bmN0aW9uIGkoKXtyZXR1cm4gcmcudG9OdW1iZXIodGhpcy5fd2lkdGgpfHw0NTB9LHNldDpmdW5jdGlvbiBvKHQpe3RoaXMuX3dpZHRoPXR9fSx7a2V5OlwiaGVpZ2h0XCIsZ2V0OmZ1bmN0aW9uIG4oKXtyZXR1cm4gcmcudG9OdW1iZXIodGhpcy5faGVpZ2h0KXx8MjUwfSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl9oZWlnaHQ9dH19LHtrZXk6XCJiYWNrZ3JvdW5kXCIsZ2V0OmZ1bmN0aW9uIHMoKXtyZXR1cm4gdGhpcy5fYmFja2dyb3VuZHx8XCJmMDFlNTJcIn0sc2V0OmZ1bmN0aW9uIGEodCl7dGhpcy5fYmFja2dyb3VuZD10fX0se2tleTpcImNvbG9yXCIsZ2V0OmZ1bmN0aW9uIGwoKXtyZXR1cm4gdGhpcy5fY29sb3J8fFwiZmZmXCJ9LHNldDpmdW5jdGlvbiBnKHQpe3RoaXMuX2NvbG9yPXR9fSx7a2V5OlwidGV4dFwiLGdldDpmdW5jdGlvbiBjKCl7cmV0dXJuIHRoaXMuX3RleHR8fHRoaXMud2lkdGgrXCIgeCBcIit0aGlzLmhlaWdodH0sc2V0OmZ1bmN0aW9uIGQodCl7dGhpcy5fdGV4dD10fX0se2tleTpcInRleHRzaXplXCIsZ2V0OmZ1bmN0aW9uIHUoKXtyZXR1cm4gcmcudG9OdW1iZXIodGhpcy5fdGV4dHNpemUpfHwzMH0sc2V0OmZ1bmN0aW9uIGgodCl7dGhpcy5fdGV4dHNpemU9dH19LHtrZXk6XCJmb3JtYXRcIixnZXQ6ZnVuY3Rpb24gZigpe3JldHVybiB0aGlzLl9mb3JtYXR8fFwicG5nXCJ9LHNldDpmdW5jdGlvbiBwKHQpe3RoaXMuX2Zvcm1hdD10fX1dKTtyZXR1cm4gZX0oUmdUYWcpO3ZhciBSZ1NlbGVjdD1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O3RoaXMuX2lzdmlzaWJsZT10LmlzdmlzaWJsZTt0aGlzLl9hdXRvY29tcGxldGU9dC5hdXRvY29tcGxldGU7dGhpcy5fZmlsdGVyb249dC5maWx0ZXJvbjt0aGlzLl9vcHRpb25zPXQub3B0aW9uczt0aGlzLl9oYXNmaWx0ZXI9dC5oYXNmaWx0ZXI7dGhpcy5fcGxhY2Vob2xkZXI9dC5wbGFjZWhvbGRlcjt0aGlzLl9maWx0ZXJwbGFjZWhvbGRlcj10LmZpbHRlcnBsYWNlaG9sZGVyO3RoaXMuX2ZpbHRlcmVkaXRlbXM9dC5maWx0ZXJlZGl0ZW1zO3RoaXMuX29ub3Blbj10Lm9ub3Blbjt0aGlzLl9vbmNsb3NlPXQub25jbG9zZTt0aGlzLl9vbnNlbGVjdD10Lm9uc2VsZWN0O3RoaXMuX29uZmlsdGVyPXQub25maWx0ZXJ9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJvcGVuXCIsdmFsdWU6ZnVuY3Rpb24gaSgpe2lmKHRoaXMub25vcGVuJiYhdGhpcy5pc3Zpc2libGUpdGhpcy5vbm9wZW4oKTt0aGlzLmlzdmlzaWJsZT10cnVlfX0se2tleTpcImNsb3NlXCIsdmFsdWU6ZnVuY3Rpb24gbygpe2lmKHRoaXMub25jbG9zZSYmdGhpcy5pc3Zpc2libGUpdGhpcy5vbmNsb3NlKCk7dGhpcy5pc3Zpc2libGU9ZmFsc2V9fSx7a2V5OlwidG9nZ2xlXCIsdmFsdWU6ZnVuY3Rpb24gbigpe3RoaXMuaXN2aXNpYmxlPSF0aGlzLmlzdmlzaWJsZTtpZih0aGlzLm9ub3BlbiYmdGhpcy5pc3Zpc2libGUpdGhpcy5vbm9wZW4oKTtlbHNlIGlmKHRoaXMub25jbG9zZSYmIXRoaXMuaXN2aXNpYmxlKXRoaXMub25jbG9zZSgpfX0se2tleTpcImZpbHRlclwiLHZhbHVlOmZ1bmN0aW9uIHIodCl7dmFyIGU9dGhpczt0aGlzLmZpbHRlcmVkaXRlbXM9dGhpcy5vcHRpb25zLmZpbHRlcihmdW5jdGlvbihpKXtpLmFjdGl2ZT1mYWxzZTt2YXIgbz1pW2UuZmlsdGVyb25dO2lmKHJnLmlzVW5kZWZpbmVkKG8pKXJldHVybiBmYWxzZTtpZih0Lmxlbmd0aD09MHx8by50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih0LnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSk+LTEpcmV0dXJuIHRydWV9KTtpZih0aGlzLm9uZmlsdGVyKXRoaXMub25maWx0ZXIodCl9fSx7a2V5Olwic2VsZWN0XCIsdmFsdWU6ZnVuY3Rpb24gcyh0KXt0aGlzLm9wdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0KXtyZXR1cm4gdC5zZWxlY3RlZD1mYWxzZX0pO3Quc2VsZWN0ZWQ9dHJ1ZTtpZih0aGlzLm9uc2VsZWN0KXRoaXMub25zZWxlY3QodCk7dGhpcy5pc3Zpc2libGU9ZmFsc2U7aWYodGhpcy5hdXRvY29tcGxldGUpdGhpcy5maWx0ZXIodFt0aGlzLmZpbHRlcm9uXSk7dGhpcy50cmlnZ2VyKFwic2VsZWN0XCIsdCl9fSx7a2V5OlwiaXN2aXNpYmxlXCIsZ2V0OmZ1bmN0aW9uIGEoKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2lzdmlzaWJsZSl9LHNldDpmdW5jdGlvbiBsKHQpe3RoaXMuX2lzdmlzaWJsZT10fX0se2tleTpcImF1dG9jb21wbGV0ZVwiLGdldDpmdW5jdGlvbiBnKCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9hdXRvY29tcGxldGUpfSxzZXQ6ZnVuY3Rpb24gYyh0KXt0aGlzLl9hdXRvY29tcGxldGU9dH19LHtrZXk6XCJmaWx0ZXJvblwiLGdldDpmdW5jdGlvbiBkKCl7cmV0dXJuIHRoaXMuX2ZpbHRlcm9ufHxcInRleHRcIn0sc2V0OmZ1bmN0aW9uIHUodCl7dGhpcy5fZmlsdGVyb249dH19LHtrZXk6XCJwbGFjZWhvbGRlclwiLGdldDpmdW5jdGlvbiBoKCl7cmV0dXJuIHRoaXMuX3BsYWNlaG9sZGVyfSxzZXQ6ZnVuY3Rpb24gZih0KXt0aGlzLl9wbGFjZWhvbGRlcj10fX0se2tleTpcImZpbHRlcnBsYWNlaG9sZGVyXCIsZ2V0OmZ1bmN0aW9uIHAoKXtyZXR1cm4gdGhpcy5fZmlsdGVycGxhY2Vob2xkZXJ9LHNldDpmdW5jdGlvbiBtKHQpe3RoaXMuX2ZpbHRlcnBsYWNlaG9sZGVyPXR9fSx7a2V5OlwiaGFzZmlsdGVyXCIsZ2V0OmZ1bmN0aW9uIGIoKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2hhc2ZpbHRlcil9LHNldDpmdW5jdGlvbiB2KHQpe3RoaXMuX2hhc2ZpbHRlcj10fX0se2tleTpcIm9wdGlvbnNcIixnZXQ6ZnVuY3Rpb24geSgpe2lmKHJnLmlzQXJyYXkodGhpcy5fb3B0aW9ucykpcmV0dXJuIHRoaXMuX29wdGlvbnM7dGhpcy5fb3B0aW9ucz1bXTtyZXR1cm4gdGhpcy5fb3B0aW9uc30sc2V0OmZ1bmN0aW9uIHcodCl7dmFyIGU9dGhpcztpZighcmcuaXNBcnJheSh0KSl0PVtdO3QuZm9yRWFjaChmdW5jdGlvbih0LGkpe3QuaW5kZXg9aTtpZih0LnNlbGVjdGVkKWUuc2VsZWN0KHQpfSk7dGhpcy5fb3B0aW9ucz10fX0se2tleTpcImZpbHRlcmVkaXRlbXNcIixnZXQ6ZnVuY3Rpb24gaygpe2lmKHJnLmlzQXJyYXkodGhpcy5fZmlsdGVyZWRpdGVtcykpcmV0dXJuIHRoaXMuX2ZpbHRlcmVkaXRlbXM7dGhpcy5fZmlsdGVyZWRpdGVtcz1bXTtyZXR1cm4gdGhpcy5fZmlsdGVyZWRpdGVtc30sc2V0OmZ1bmN0aW9uIF8odCl7dGhpcy5fZmlsdGVyZWRpdGVtcz10fX0se2tleTpcIm9ub3BlblwiLGdldDpmdW5jdGlvbiBSKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbm9wZW4pKXJldHVybiB0aGlzLl9vbm9wZW47cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiB4KHQpe3RoaXMuX29ub3Blbj10fX0se2tleTpcIm9uY2xvc2VcIixnZXQ6ZnVuY3Rpb24gVCgpe2lmKHJnLmlzRnVuY3Rpb24odGhpcy5fb25jbG9zZSkpcmV0dXJuIHRoaXMuX29uY2xvc2U7cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiBDKHQpe3RoaXMuX29uY2xvc2U9dH19LHtrZXk6XCJvbmZpbHRlclwiLGdldDpmdW5jdGlvbiBEKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbmZpbHRlcikpcmV0dXJuIHRoaXMuX29uZmlsdGVyO3JldHVybiBudWxsfSxzZXQ6ZnVuY3Rpb24gQih0KXt0aGlzLl9vbmZpbHRlcj10fX0se2tleTpcIm9uc2VsZWN0XCIsZ2V0OmZ1bmN0aW9uIEYoKXtpZihyZy5pc0Z1bmN0aW9uKHRoaXMuX29uc2VsZWN0KSlyZXR1cm4gdGhpcy5fb25zZWxlY3Q7cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiBTKHQpe3RoaXMuX29uc2VsZWN0PXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnU2lkZW1lbnU9ZnVuY3Rpb24odCl7X2luaGVyaXRzKGUsdCk7ZnVuY3Rpb24gZSh0KXtfY2xhc3NDYWxsQ2hlY2sodGhpcyxlKTtfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJjb25zdHJ1Y3RvclwiLHRoaXMpLmNhbGwodGhpcyx0KX1yZXR1cm4gZX0oUmdEcmF3ZXIpO3ZhciBSZ1RhYnM9ZnVuY3Rpb24odCl7X2luaGVyaXRzKGUsdCk7ZnVuY3Rpb24gZSh0KXtfY2xhc3NDYWxsQ2hlY2sodGhpcyxlKTtfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJjb25zdHJ1Y3RvclwiLHRoaXMpLmNhbGwodGhpcyk7aWYocmcuaXNVbmRlZmluZWQodCkpdD17fTt0aGlzLl90YWJzPXQudGFiczt0aGlzLl9vbm9wZW49dC5vbm9wZW59X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJzZWxlY3RcIix2YWx1ZTpmdW5jdGlvbiBpKHQpe2lmKCF0LmRpc2FibGVkKXt0aGlzLnRhYnMuZm9yRWFjaChmdW5jdGlvbih0KXt0LmFjdGl2ZT1mYWxzZX0pO2lmKHRoaXMub25vcGVuKXRoaXMub25vcGVuKHQpO3QuYWN0aXZlPXRydWV9fX0se2tleTpcIm9ub3BlblwiLGdldDpmdW5jdGlvbiBvKCl7aWYocmcuaXNGdW5jdGlvbih0aGlzLl9vbm9wZW4pKXJldHVybiB0aGlzLl9vbm9wZW47cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbiBuKHQpe2lmKHJnLmlzRnVuY3Rpb24odCkpdGhpcy5fb25vcGVuPXR9fSx7a2V5OlwidGFic1wiLGdldDpmdW5jdGlvbiByKCl7dmFyIHQ9dGhpcztpZihyZy5pc0FycmF5KHRoaXMuX3RhYnMpKXt2YXIgZT1mdW5jdGlvbigpe3ZhciBlPWZhbHNlO3QuX3RhYnMuZm9yRWFjaChmdW5jdGlvbih0LGkpe3QuaW5kZXg9aTtpZihlKXQuYWN0aXZlPWZhbHNlO2lmKHQuYWN0aXZlKWU9dHJ1ZX0pO3JldHVybnt2OnQuX3RhYnN9fSgpO2lmKHR5cGVvZiBlPT09XCJvYmplY3RcIilyZXR1cm4gZS52fXRoaXMuX3RhYnM9W107cmV0dXJuIHRoaXMuX3RhYnN9LHNldDpmdW5jdGlvbiBzKHQpe3RoaXMuX3RhYnM9dH19XSk7cmV0dXJuIGV9KFJnVGFnKTt2YXIgUmdUYWdzPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMsdCk7dGhpcy5fdGFncz10LnRhZ3M7dGhpcy5fdmFsdWU9dC52YWx1ZX1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcImFkZFRhZ1wiLHZhbHVlOmZ1bmN0aW9uIGkodCl7dC5pbmRleD10aGlzLnRhZ3MubGVuZ3RoO3RoaXMudGFncy5wdXNoKHQpO3RoaXMuaXN2aXNpYmxlPWZhbHNlfX0se2tleTpcInJlbW92ZVRhZ1wiLHZhbHVlOmZ1bmN0aW9uIG8odCl7dGhpcy50YWdzLnNwbGljZSh0aGlzLnRhZ3MuaW5kZXhPZih0KSwxKTt0aGlzLmlzdmlzaWJsZT1mYWxzZX19LHtrZXk6XCJ2YWx1ZVwiLGdldDpmdW5jdGlvbiBuKCl7cmV0dXJuIHRoaXMuX3ZhbHVlfHxcIlwifSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl92YWx1ZT10fX0se2tleTpcInRhZ3NcIixnZXQ6ZnVuY3Rpb24gcygpe2lmKHJnLmlzQXJyYXkodGhpcy5fdGFncykpcmV0dXJuIHRoaXMuX3RhZ3M7dGhpcy5fdGFncz1bXTtyZXR1cm4gdGhpcy5fdGFnc30sc2V0OmZ1bmN0aW9uIGEodCl7aWYoIXJnLmlzQXJyYXkodCkpdD1bXTt0LmZvckVhY2goZnVuY3Rpb24odCxlKXt0LmluZGV4PWV9KTt0aGlzLl90YWdzPXR9fV0pO3JldHVybiBlfShSZ1NlbGVjdCk7dmFyIFJnVGltZT1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzLHQpO3RoaXMuX21pbj10Lm1pbjt0aGlzLl9tYXg9dC5tYXg7dGhpcy5fdGltZT10LnRpbWU7dGhpcy5fc3RlcD10LnN0ZXA7dGhpcy5fYW1wbT10LmFtcG19X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJtaW5cIixnZXQ6ZnVuY3Rpb24gaSgpe2lmKHRoaXMuX21pbilyZXR1cm4gdGhpcy5fbWluLnNwbGl0KFwiOlwiKTtyZXR1cm4gdGhpcy5fbWlufSxzZXQ6ZnVuY3Rpb24gbyh0KXt0aGlzLl9taW49dH19LHtrZXk6XCJtYXhcIixnZXQ6ZnVuY3Rpb24gbigpe2lmKHRoaXMuX21heClyZXR1cm4gdGhpcy5fbWF4LnNwbGl0KFwiOlwiKTtyZXR1cm4gdGhpcy5fbWF4fSxzZXQ6ZnVuY3Rpb24gcih0KXt0aGlzLl9tYXg9dH19LHtrZXk6XCJ0aW1lXCIsZ2V0OmZ1bmN0aW9uIHMoKXtpZihyZy5pc0RhdGUodGhpcy5fdGltZSkpcmV0dXJuIHRoaXMuX3RpbWU7cmV0dXJuIG5ldyBEYXRlfSxzZXQ6ZnVuY3Rpb24gYSh0KXt0aGlzLl90aW1lPXR9fSx7a2V5Olwic3RlcFwiLGdldDpmdW5jdGlvbiBsKCl7cmV0dXJuIHJnLnRvTnVtYmVyKHRoaXMuX3N0ZXApfHwxfSxzZXQ6ZnVuY3Rpb24gZyh0KXt0aGlzLl9zdGVwPXR9fSx7a2V5OlwiYW1wbVwiLGdldDpmdW5jdGlvbiBjKCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9hbXBtKX0sc2V0OmZ1bmN0aW9uIGQodCl7dGhpcy5fYW1wbT10fX1dKTtyZXR1cm4gZX0oUmdTZWxlY3QpO3ZhciBSZ1RvYXN0cz1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O3RoaXMuX3RvYXN0cz10LnRvYXN0czt0aGlzLl9wb3NpdGlvbj10LnBvc2l0aW9uO3RoaXMuX2lzdmlzaWJsZT10LmlzdmlzaWJsZX1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcImFkZFwiLHZhbHVlOmZ1bmN0aW9uIGkodCl7dGhpcy50b2FzdHMucHVzaCh0KX19LHtrZXk6XCJ0b2FzdHNcIixnZXQ6ZnVuY3Rpb24gbygpe3ZhciB0PXRoaXM7aWYocmcuaXNBcnJheSh0aGlzLl90b2FzdHMpKXt0aGlzLl90b2FzdHMuZm9yRWFjaChmdW5jdGlvbihlKXtpZihyZy5pc1VuZGVmaW5lZChlLmlzdmlzaWJsZSkpZS5pc3Zpc2libGU9dHJ1ZTtlLmlkPWUuaWR8fHJnLnVpZCgpO2lmKCFlLnRpbWVyJiYhZS5zdGlja3kpe2Uuc3RhcnRUaW1lcj1mdW5jdGlvbigpe2UudGltZXI9d2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKXtlLmlzdmlzaWJsZT1mYWxzZTtpZihyZy5pc0Z1bmN0aW9uKGUub25jbG9zZSkpZS5vbmNsb3NlKCk7dC51cGRhdGUoKX0scmcudG9OdW1iZXIoZS50aW1lb3V0KXx8NmUzKX07ZS5zdGFydFRpbWVyKCl9fSk7dGhpcy5pc3Zpc2libGU9dGhpcy5fdG9hc3RzLmZpbHRlcihmdW5jdGlvbih0KXtyZXR1cm4gdC5pc3Zpc2libGV9KS5sZW5ndGg+MDtyZXR1cm4gdGhpcy5fdG9hc3RzfXRoaXMuX3RvYXRzPVtdO3JldHVybiB0aGlzLl90b2FzdHN9LHNldDpmdW5jdGlvbiBuKHQpe3RoaXMuX3RvYXN0cz10fX0se2tleTpcInBvc2l0aW9uXCIsZ2V0OmZ1bmN0aW9uIHIoKXtyZXR1cm4gdGhpcy5fcG9zaXRpb258fFwidG9wcmlnaHRcIn0sc2V0OmZ1bmN0aW9uIHModCl7dGhpcy5fcG9zaXRpb249dH19LHtrZXk6XCJpc3Zpc2libGVcIixnZXQ6ZnVuY3Rpb24gYSgpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5faXN2aXNpYmxlKX0sc2V0OmZ1bmN0aW9uIGwodCl7dGhpcy5faXN2aXNpYmxlPXR9fV0pO3JldHVybiBlfShSZ1RhZyk7dmFyIFJnVG9nZ2xlPWZ1bmN0aW9uKHQpe19pbmhlcml0cyhlLHQpO2Z1bmN0aW9uIGUodCl7X2NsYXNzQ2FsbENoZWNrKHRoaXMsZSk7X2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiY29uc3RydWN0b3JcIix0aGlzKS5jYWxsKHRoaXMpO2lmKHJnLmlzVW5kZWZpbmVkKHQpKXQ9e307dGhpcy5fY2hlY2tlZD10LmNoZWNrZWQ7dGhpcy5fb250b2dnbGU9dC5vbnRvZ2dsZX1fY3JlYXRlQ2xhc3MoZSxbe2tleTpcInRvZ2dsZVwiLHZhbHVlOmZ1bmN0aW9uIGkoKXt0aGlzLmNoZWNrZWQ9IXRoaXMuY2hlY2tlZDtpZih0aGlzLm9udG9nZ2xlKXRoaXMub250b2dnbGUodGhpcy5jaGVja2VkKX19LHtrZXk6XCJjaGVja2VkXCIsZ2V0OmZ1bmN0aW9uIG8oKXtyZXR1cm4gcmcudG9Cb29sZWFuKHRoaXMuX2NoZWNrZWQpfSxzZXQ6ZnVuY3Rpb24gbih0KXt0aGlzLl9jaGVja2VkPXR9fSx7a2V5Olwib250b2dnbGVcIixnZXQ6ZnVuY3Rpb24gcigpe2lmKHJnLmlzRnVuY3Rpb24odGhpcy5fb250b2dnbGUpKXJldHVybiB0aGlzLl9vbnRvZ2dsZTtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uIHModCl7dGhpcy5fb250b2dnbGU9dH19XSk7cmV0dXJuIGV9KFJnVGFnKTt2YXIgUmdVbnNwbGFzaD1mdW5jdGlvbih0KXtfaW5oZXJpdHMoZSx0KTtmdW5jdGlvbiBlKHQpe19jbGFzc0NhbGxDaGVjayh0aGlzLGUpO19nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImNvbnN0cnVjdG9yXCIsdGhpcykuY2FsbCh0aGlzKTtpZihyZy5pc1VuZGVmaW5lZCh0KSl0PXt9O3RoaXMuX3dpZHRoPXQud2lkdGg7dGhpcy5faGVpZ2h0PXQuaGVpZ2h0O3RoaXMuX2dyZXlzY2FsZT10LmdyZXlzY2FsZXx8dC5ncmF5c2NhbGU7dGhpcy5fcmFuZG9tPXQucmFuZG9tO3RoaXMuX2JsdXI9dC5ibHVyO3RoaXMuX2ltYWdlPXQuaW1hZ2U7dGhpcy5fZ3Jhdml0eT10LmdyYXZpdHl9X2NyZWF0ZUNsYXNzKGUsW3trZXk6XCJ3aWR0aFwiLGdldDpmdW5jdGlvbiBpKCl7cmV0dXJuIHJnLnRvTnVtYmVyKHRoaXMuX3dpZHRoKXx8NDUwfSxzZXQ6ZnVuY3Rpb24gbyh0KXt0aGlzLl93aWR0aD10O3RoaXMudHJpZ2dlcihcImNoYW5nZVwiKX19LHtrZXk6XCJoZWlnaHRcIixnZXQ6ZnVuY3Rpb24gbigpe3JldHVybiByZy50b051bWJlcih0aGlzLl9oZWlnaHQpfHwyNTB9LHNldDpmdW5jdGlvbiByKHQpe3RoaXMuX2hlaWdodD10O3RoaXMudHJpZ2dlcihcImNoYW5nZVwiKX19LHtrZXk6XCJncmV5c2NhbGVcIixnZXQ6ZnVuY3Rpb24gcygpe3JldHVybiByZy50b0Jvb2xlYW4odGhpcy5fZ3JleXNjYWxlKX0sc2V0OmZ1bmN0aW9uIGEodCl7dGhpcy5fZ3JleXNjYWxlPXQ7dGhpcy50cmlnZ2VyKFwiY2hhbmdlXCIpfX0se2tleTpcImdyYXlzY2FsZVwiLGdldDpmdW5jdGlvbiBsKCl7cmV0dXJuIHRoaXMuZ3JleXNjYWxlfSxzZXQ6ZnVuY3Rpb24gZyh0KXt0aGlzLmdyZXlzY2FsZT10fX0se2tleTpcInJhbmRvbVwiLGdldDpmdW5jdGlvbiBjKCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9yYW5kb20pfSxzZXQ6ZnVuY3Rpb24gZCh0KXt0aGlzLl9yYW5kb209dDt0aGlzLnRyaWdnZXIoXCJjaGFuZ2VcIil9fSx7a2V5OlwiYmx1clwiLGdldDpmdW5jdGlvbiB1KCl7cmV0dXJuIHJnLnRvQm9vbGVhbih0aGlzLl9ibHVyKX0sc2V0OmZ1bmN0aW9uIGgodCl7dGhpcy5fYmx1cj10O3RoaXMudHJpZ2dlcihcImNoYW5nZVwiKX19LHtrZXk6XCJpbWFnZVwiLGdldDpmdW5jdGlvbiBmKCl7cmV0dXJuIHJnLnRvTnVtYmVyKHRoaXMuX2ltYWdlKX0sc2V0OmZ1bmN0aW9uIHAodCl7dGhpcy5faW1hZ2U9dDt0aGlzLnRyaWdnZXIoXCJjaGFuZ2VcIil9fSx7a2V5OlwiZ3Jhdml0eVwiLGdldDpmdW5jdGlvbiBtKCl7cmV0dXJuIHRoaXMuX2dyYXZpdHl9LHNldDpmdW5jdGlvbiBiKHQpe3RoaXMuX2dyYXZpdHk9dDt0aGlzLnRyaWdnZXIoXCJjaGFuZ2VcIil9fV0pO3JldHVybiBlfShSZ1RhZyk7cmlvdC50YWcyKFwicmctYWxlcnRzXCIsJzxkaXYgZWFjaD1cIntSZ0FsZXJ0cy5hbGVydHN9XCIgY2xhc3M9XCJhbGVydCB7dHlwZX0ge2lzdmlzaWJsZTogaXN2aXNpYmxlfVwiIG9uY2xpY2s9XCJ7c2VsZWN0fVwiPiA8YSBjbGFzcz1cImNsb3NlXCIgYXJpYS1sYWJlbD1cIkNsb3NlXCIgb25jbGljaz1cIntwYXJlbnQuZGlzbWlzc31cIiBpZj1cIntkaXNtaXNzYWJsZSAhPSBmYWxzZX1cIj4gPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+JnRpbWVzOzwvc3Bhbj4gPC9hPiA8cmctcmF3IGNvbnRlbnQ9XCJ7Y29udGVudH1cIj48L3JnLXJhdz4gPC9kaXY+JywncmctYWxlcnRzLFtyaW90LXRhZz1cInJnLWFsZXJ0c1wiXSB7IGZvbnQtc2l6ZTogMC45ZW07IHBvc2l0aW9uOiByZWxhdGl2ZTsgdG9wOiAwOyByaWdodDogMDsgbGVmdDogMDsgd2lkdGg6IDEwMCU7IH0gcmctYWxlcnRzIC5hbGVydCxbcmlvdC10YWc9XCJyZy1hbGVydHNcIl0gLmFsZXJ0IHsgZGlzcGxheTogbm9uZTsgcG9zaXRpb246IHJlbGF0aXZlOyBtYXJnaW4tYm90dG9tOiAxNXB4OyBwYWRkaW5nOiAxNXB4IDM1cHggMTVweCAxNXB4OyB9IHJnLWFsZXJ0cyAuaXN2aXNpYmxlLFtyaW90LXRhZz1cInJnLWFsZXJ0c1wiXSAuaXN2aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctYWxlcnRzIC5jbG9zZSxbcmlvdC10YWc9XCJyZy1hbGVydHNcIl0gLmNsb3NlIHsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDUwJTsgcmlnaHQ6IDIwcHg7IGxpbmUtaGVpZ2h0OiAxMnB4OyBmb250LXNpemU6IDEuMWVtOyBib3JkZXI6IDA7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50OyBjb2xvcjogcmdiYSgwLCAwLCAwLCAwLjUpOyBjdXJzb3I6IHBvaW50ZXI7IG91dGxpbmU6IG5vbmU7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoMCwgLTUwJSwgMCk7IH0gcmctYWxlcnRzIC5kYW5nZXIsW3Jpb3QtdGFnPVwicmctYWxlcnRzXCJdIC5kYW5nZXIgeyBjb2xvcjogIzhmMWQyZTsgYmFja2dyb3VuZC1jb2xvcjogI2ZmY2VkODsgfSByZy1hbGVydHMgLmluZm9ybWF0aW9uLFtyaW90LXRhZz1cInJnLWFsZXJ0c1wiXSAuaW5mb3JtYXRpb24geyBjb2xvcjogIzMxNzA4ZjsgYmFja2dyb3VuZC1jb2xvcjogI2Q5ZWRmNzsgfSByZy1hbGVydHMgLnN1Y2Nlc3MsW3Jpb3QtdGFnPVwicmctYWxlcnRzXCJdIC5zdWNjZXNzIHsgY29sb3I6ICMyZDhmNDA7IGJhY2tncm91bmQtY29sb3I6ICNjY2Y3ZDQ7IH0gcmctYWxlcnRzIC53YXJuaW5nLFtyaW90LXRhZz1cInJnLWFsZXJ0c1wiXSAud2FybmluZyB7IGNvbG9yOiAjYzA2MzI5OyBiYWNrZ3JvdW5kLWNvbG9yOiAjZjdkZmQwOyB9JyxcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5vbihcIm1vdW50XCIsZnVuY3Rpb24oKXt2YXIgZT10aGlzO3RoaXMuUmdBbGVydHM9dC5hbGVydHN8fG5ldyBSZ0FsZXJ0cyh0KTt0aGlzLlJnQWxlcnRzLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7dGhpcy51cGRhdGUoKX0pO3RoaXMuZGlzbWlzcz1mdW5jdGlvbih0KXt2YXIgaT10Lml0ZW07ZS5SZ0FsZXJ0cy5kaXNtaXNzKGkpfTt0aGlzLnNlbGVjdD1mdW5jdGlvbih0KXt2YXIgaT10Lml0ZW07ZS5SZ0FsZXJ0cy5zZWxlY3QoaSl9fSxcInsgfVwiKTtyaW90LnRhZzIoXCJyZy1iZWhvbGRcIiwnPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPiA8ZGl2IGNsYXNzPVwiY29udHJvbHNcIj4gPGRpdiBjbGFzcz1cIm1vZGVzXCI+IDxhIG9uY2xpY2s9XCJ7c3dpcGVNb2RlfVwiIGNsYXNzPVwibW9kZSB7YWN0aXZlOiBSZ0JlaG9sZC5tb2RlID09IFxcJ3N3aXBlXFwnfVwiPlN3aXBlPC9hPiA8YSBvbmNsaWNrPVwie2ZhZGVNb2RlfVwiIGNsYXNzPVwibW9kZSB7YWN0aXZlOiBSZ0JlaG9sZC5tb2RlID09IFxcJ2ZhZGVcXCd9XCI+RmFkZTwvYT4gPC9kaXY+IDxpbnB1dCB0eXBlPVwicmFuZ2VcIiBjbGFzcz1cInJhbmdlclwiIG5hbWU9XCJkaWZmXCIgdmFsdWU9XCIwXCIgbWluPVwiMFwiIG1heD1cIjFcIiBzdGVwPVwiMC4wMVwiIG9uaW5wdXQ9XCJ7dXBkYXRlRGlmZn1cIiBvbmNoYW5nZT1cInt1cGRhdGVEaWZmfVwiPiA8L2Rpdj4gPGRpdiBjbGFzcz1cImltYWdlc1wiPiA8ZGl2IGNsYXNzPVwiaW1hZ2VcIj4gPGltZyBjbGFzcz1cImltYWdlLTJcIiByaW90LXNyYz1cIntSZ0JlaG9sZC5pbWFnZTJ9XCI+IDwvZGl2PiA8ZGl2IGNsYXNzPVwiaW1hZ2UgZmFsbGJhY2tcIj4gPGltZyBjbGFzcz1cImltYWdlLTFcIiByaW90LXNyYz1cIntSZ0JlaG9sZC5pbWFnZTF9XCI+IDwvZGl2PiA8L2Rpdj4gPC9kaXY+JywncmctYmVob2xkIC5jb250cm9scyxbcmlvdC10YWc9XCJyZy1iZWhvbGRcIl0gLmNvbnRyb2xzIHsgdGV4dC1hbGlnbjogY2VudGVyOyB9IHJnLWJlaG9sZCAubW9kZSxbcmlvdC10YWc9XCJyZy1iZWhvbGRcIl0gLm1vZGUgeyB0ZXh0LWRlY29yYXRpb246IG5vbmU7IGN1cnNvcjogcG9pbnRlcjsgcGFkZGluZzogMCAxMHB4OyB9IHJnLWJlaG9sZCBhLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy1iZWhvbGRcIl0gYS5hY3RpdmUgeyBmb250LXdlaWdodDogYm9sZDsgfSByZy1iZWhvbGQgLnJhbmdlcixbcmlvdC10YWc9XCJyZy1iZWhvbGRcIl0gLnJhbmdlciB7IHdpZHRoOiA5MCU7IG1heC13aWR0aDogMzAwcHg7IH0gcmctYmVob2xkIC5pbWFnZXMsW3Jpb3QtdGFnPVwicmctYmVob2xkXCJdIC5pbWFnZXMgeyBwb3NpdGlvbjogcmVsYXRpdmU7IH0gcmctYmVob2xkIC5pbWFnZSxbcmlvdC10YWc9XCJyZy1iZWhvbGRcIl0gLmltYWdlIHsgcG9zaXRpb246IGFic29sdXRlOyB3aWR0aDogMTAwJTsgdGV4dC1hbGlnbjogY2VudGVyOyB9IHJnLWJlaG9sZCAuaW1hZ2UgaW1nLFtyaW90LXRhZz1cInJnLWJlaG9sZFwiXSAuaW1hZ2UgaW1nIHsgbWF4LXdpZHRoOiA5MCU7IH0nLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt2YXIgaT11bmRlZmluZWQsbz11bmRlZmluZWQsbj11bmRlZmluZWQ7dmFyIHI9ZnVuY3Rpb24gcygpe2k9ZS5yb290LnF1ZXJ5U2VsZWN0b3IoXCIuaW1hZ2UtMVwiKTtvPWUucm9vdC5xdWVyeVNlbGVjdG9yKFwiLmltYWdlLTJcIik7bj10eXBlb2YgaS5zdHlsZS53ZWJraXRDbGlwUGF0aD09XCJ1bmRlZmluZWRcIjt2YXIgdD11bmRlZmluZWQscj11bmRlZmluZWQscz11bmRlZmluZWQsYT11bmRlZmluZWQ7dmFyIGw9bmV3IEltYWdlO3ZhciBnPW5ldyBJbWFnZTtsLm9ubG9hZD1mdW5jdGlvbigpe3Q9dHJ1ZTtzPXRoaXMuaGVpZ2h0O2QoKX07Zy5vbmxvYWQ9ZnVuY3Rpb24oKXtyPXRydWU7YT10aGlzLmhlaWdodDtkKCl9O2wuc3JjPWUuUmdCZWhvbGQuaW1hZ2UxO2cuc3JjPWUuUmdCZWhvbGQuaW1hZ2UyO3ZhciBjPWU7ZnVuY3Rpb24gZCgpe2lmKHQmJnIpe3ZhciBlPWMucm9vdC5xdWVyeVNlbGVjdG9yKFwiLmNvbnRyb2xzXCIpO3ZhciBpPWMucm9vdC5xdWVyeVNlbGVjdG9yKFwiLmNvbnRhaW5lclwiKTtpLnN0eWxlLmhlaWdodD1lLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCtNYXRoLm1heChzLGEpK1wicHhcIjtjLnVwZGF0ZURpZmYoKX19fTt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdCZWhvbGQ9dC5iZWhvbGR8fG5ldyBSZ0JlaG9sZCh0KTtlLlJnQmVob2xkLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7ZS5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7cigpfSk7ZS51cGRhdGUoKX0pO3RoaXMuc3dpcGVNb2RlPWZ1bmN0aW9uKCl7ZS5kaWZmLnZhbHVlPTA7ZS51cGRhdGVEaWZmKCk7ZS5SZ0JlaG9sZC5tb2RlPVwic3dpcGVcIn07dGhpcy5mYWRlTW9kZT1mdW5jdGlvbigpe2UuZGlmZi52YWx1ZT0wO2UudXBkYXRlRGlmZigpO2UuUmdCZWhvbGQubW9kZT1cImZhZGVcIjtcbn07dGhpcy51cGRhdGVEaWZmPWZ1bmN0aW9uKCl7aWYoZS5SZ0JlaG9sZC5tb2RlPT1cImZhZGVcIil7aS5zdHlsZS5vcGFjaXR5PTEtZS5kaWZmLnZhbHVlfWVsc2UgaWYoZS5SZ0JlaG9sZC5tb2RlPT1cInN3aXBlXCIpe2lmKCFuKXtpLnN0eWxlLmNsaXBQYXRoPWkuc3R5bGUud2Via2l0Q2xpcFBhdGg9XCJpbnNldCgwIDAgMCBcIisoaS5jbGllbnRXaWR0aCplLmRpZmYudmFsdWUtMSkrXCJweClcIn1lbHNle3ZhciB0PWUucm9vdC5xdWVyeVNlbGVjdG9yKFwiLmZhbGxiYWNrXCIpO3Quc3R5bGUuY2xpcD1cInJlY3QoYXV0bywgYXV0bywgYXV0bywgXCIrdC5jbGllbnRXaWR0aCplLmRpZmYudmFsdWUrXCJweClcIn19fX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctYnViYmxlXCIsJzxkaXYgY2xhc3M9XCJjb250ZXh0XCI+IDxkaXYgY2xhc3M9XCJidWJibGUge2lzdmlzaWJsZTogUmdCdWJibGUuaXN2aXNpYmxlfVwiPiA8cmctcmF3IGNvbnRlbnQ9XCJ7UmdCdWJibGUuY29udGVudH1cIj48L3JnLXJhdz4gPC9kaXY+IDxkaXYgY2xhc3M9XCJjb250ZW50XCIgb25tb3VzZW92ZXI9XCJ7c2hvd0J1YmJsZX1cIiBvbm1vdXNlb3V0PVwie2hpZGVCdWJibGV9XCIgb25jbGljaz1cInt0b2dnbGVCdWJibGV9XCI+IDx5aWVsZD48L3lpZWxkPiA8L2Rpdj4gPC9kaXY+JywncmctYnViYmxlIC5jb250ZXh0LFtyaW90LXRhZz1cInJnLWJ1YmJsZVwiXSAuY29udGV4dCxyZy1idWJibGUgLmNvbnRlbnQsW3Jpb3QtdGFnPVwicmctYnViYmxlXCJdIC5jb250ZW50IHsgZGlzcGxheTogaW5saW5lLWJsb2NrOyBwb3NpdGlvbjogcmVsYXRpdmU7IH0gcmctYnViYmxlIC5idWJibGUsW3Jpb3QtdGFnPVwicmctYnViYmxlXCJdIC5idWJibGUgeyBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogLTUwcHg7IGxlZnQ6IDUwJTsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgtNTAlLCAwLCAwKTsgcGFkZGluZzogMTBweCAxNXB4OyBiYWNrZ3JvdW5kLWNvbG9yOiAjMDAwOyBjb2xvcjogd2hpdGU7IHRleHQtYWxpZ246IGNlbnRlcjsgZm9udC1zaXplOiAwLjllbTsgbGluZS1oZWlnaHQ6IDE7IHdoaXRlLXNwYWNlOiBub3dyYXA7IGRpc3BsYXk6IG5vbmU7IH0gcmctYnViYmxlIC5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctYnViYmxlXCJdIC5pc3Zpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy1idWJibGUgLmJ1YmJsZTphZnRlcixbcmlvdC10YWc9XCJyZy1idWJibGVcIl0gLmJ1YmJsZTphZnRlciB7IGNvbnRlbnQ6IFxcJ1xcJzsgcG9zaXRpb246IGFic29sdXRlOyBkaXNwbGF5OiBibG9jazsgYm90dG9tOiAtMjBweDsgbGVmdDogNTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKC01MCUsIDAsIDApOyB3aWR0aDogMDsgaGVpZ2h0OiAwOyBib3JkZXI6IDEwcHggc29saWQgdHJhbnNwYXJlbnQ7IGJvcmRlci10b3AtY29sb3I6ICMwMDA7IH0nLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdCdWJibGU9dC5idWJibGV8fG5ldyBSZ0J1YmJsZSh0KTtlLlJnQnViYmxlLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7ZS51cGRhdGUoKX0pO3RoaXMuc2hvd0J1YmJsZT1mdW5jdGlvbigpe2UuUmdCdWJibGUuc2hvd0J1YmJsZSgpfTt0aGlzLmhpZGVCdWJibGU9ZnVuY3Rpb24oKXtlLlJnQnViYmxlLmhpZGVCdWJibGUoKX07dGhpcy50b2dnbGVCdWJibGU9ZnVuY3Rpb24oKXtlLlJnQnViYmxlLnRvZ2dsZUJ1YmJsZSgpfX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctY29kZVwiLCc8ZGl2IGNsYXNzPVwiZWRpdG9yXCI+PC9kaXY+JywncmctY29kZSAuZWRpdG9yLFtyaW90LXRhZz1cInJnLWNvZGVcIl0gLmVkaXRvciB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAwOyByaWdodDogMDsgYm90dG9tOiAwOyBsZWZ0OiAwOyB9JyxcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dmFyIGk9dW5kZWZpbmVkO3ZhciBvPWZ1bmN0aW9uIG4oKXtpLnNldFRoZW1lKFwiYWNlL3RoZW1lL1wiK2UuUmdDb2RlLnRoZW1lKTtpLmdldFNlc3Npb24oKS5zZXRNb2RlKFwiYWNlL21vZGUvXCIrZS5SZ0NvZGUubW9kZSk7aS5nZXRTZXNzaW9uKCkuc2V0VGFiU2l6ZShlLlJnQ29kZS50YWJzaXplKTtpLmdldFNlc3Npb24oKS5zZXRVc2VTb2Z0VGFicyhlLlJnQ29kZS5zb2Z0dGFicyk7aS5nZXRTZXNzaW9uKCkuc2V0VXNlV3JhcE1vZGUoZS5SZ0NvZGUud29yZHdyYXApO2kuc2V0UmVhZE9ubHkoZS5SZ0NvZGUucmVhZG9ubHkpfTt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2k9YWNlLmVkaXQoZS5yb290LnF1ZXJ5U2VsZWN0b3IoXCIuZWRpdG9yXCIpKTtpLiRibG9ja1Njcm9sbGluZz1JbmZpbml0eTtlLlJnQ29kZT10LmVkaXRvcnx8bmV3IFJnQ29kZSh0KTtlLlJnQ29kZS5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2Uub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe28oKTtpZihlLlJnQ29kZS5jb2RlIT1pLmdldFZhbHVlKCkpaS5zZXRWYWx1ZShlLlJnQ29kZS5jb2RlLDEpfSk7aWYoZS5SZ0NvZGUudXJsKXtyZy54aHIoXCJnZXRcIixlLlJnQ29kZS51cmwsZnVuY3Rpb24odCl7ZS5SZ0NvZGUuY29kZT10O2UudXBkYXRlKCl9KX1pLnNldFZhbHVlKGUuUmdDb2RlLmNvZGUsMSk7aS5nZXRTZXNzaW9uKCkub24oXCJjaGFuZ2VcIixmdW5jdGlvbih0KXtlLlJnQ29kZS5jb2RlPWkuZ2V0VmFsdWUoKTtpZihlLlJnQ29kZS5vbmNoYW5nZSllLlJnQ29kZS5vbmNoYW5nZShpLmdldFZhbHVlKCkpfSk7bygpO2UudXBkYXRlKCl9KX0pO3Jpb3QudGFnMihcInJnLWNvbnRleHQtbWVudVwiLCc8ZGl2IGNsYXNzPVwibWVudSB7aXN2aXNpYmxlOiBSZ0NvbnRleHRNZW51LmlzdmlzaWJsZX1cIj4gPGRpdiBjbGFzcz1cImxpc3RcIj4gPGRpdiBlYWNoPVwie1JnQ29udGV4dE1lbnUuaXRlbXN9XCIgY2xhc3M9XCJpdGVtIHtpbmFjdGl2ZTogaW5hY3RpdmV9XCIgb25jbGljaz1cIntzZWxlY3RJdGVtfVwiPiA8cmctcmF3IGNvbnRlbnQ9XCJ7Y29udGVudH1cIj48L3JnLXJhdz4gPC9kaXY+IDx5aWVsZD48L3lpZWxkPiA8L2Rpdj4gPC9kaXY+JywncmctY29udGV4dC1tZW51IC5tZW51LFtyaW90LXRhZz1cInJnLWNvbnRleHQtbWVudVwiXSAubWVudSB7IGRpc3BsYXk6IG5vbmU7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IGJvcmRlcjogMXB4IHNvbGlkICNEM0QzRDM7IHRleHQtYWxpZ246IGxlZnQ7IC13ZWJraXQtdXNlci1zZWxlY3Q6IG5vbmU7IC1tb3otdXNlci1zZWxlY3Q6IG5vbmU7IC1tcy11c2VyLXNlbGVjdDogbm9uZTsgdXNlci1zZWxlY3Q6IG5vbmU7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IHotaW5kZXg6IDI7IH0gcmctY29udGV4dC1tZW51IC5tZW51LmlzdmlzaWJsZSxbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLm1lbnUuaXN2aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctY29udGV4dC1tZW51IC5pdGVtLFtyaW90LXRhZz1cInJnLWNvbnRleHQtbWVudVwiXSAuaXRlbSB7IGN1cnNvcjogcG9pbnRlcjsgcGFkZGluZzogMTBweDsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICNFOEU4RTg7IGJhY2tncm91bmQtY29sb3I6ICNmZmY7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyB9IHJnLWNvbnRleHQtbWVudSAuaXRlbTpmaXJzdC1jaGlsZCxbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLml0ZW06Zmlyc3QtY2hpbGQgeyBib3JkZXItdG9wOiAwOyB9IHJnLWNvbnRleHQtbWVudSAuaXRlbTpob3ZlcixbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLml0ZW06aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjZjNmM2YzOyB9IHJnLWNvbnRleHQtbWVudSAuaXRlbS5pbmFjdGl2ZSxbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLml0ZW0uaW5hY3RpdmUgeyBjb2xvcjogIzhhOGE4YTsgZm9udC1zdHlsZTogaXRhbGljOyB9IHJnLWNvbnRleHQtbWVudSAuaXRlbS5pbmFjdGl2ZTpob3ZlcixbcmlvdC10YWc9XCJyZy1jb250ZXh0LW1lbnVcIl0gLml0ZW0uaW5hY3RpdmU6aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjZmZmOyB9JyxcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dmFyIGk9ZnVuY3Rpb24gbih0KXtpZighZS5yb290LmNvbnRhaW5zKHQudGFyZ2V0KSl7aWYoZS5SZ0NvbnRleHRNZW51Lm9uY2xvc2UmJmUuUmdDb250ZXh0TWVudS5pc3Zpc2libGUpZS5SZ0NvbnRleHRNZW51Lm9uY2xvc2UodCk7ZS5SZ0NvbnRleHRNZW51LmlzdmlzaWJsZT1mYWxzZX19O3ZhciBvPWZ1bmN0aW9uIHIodCl7dC5wcmV2ZW50RGVmYXVsdCgpO2lmKGUuUmdDb250ZXh0TWVudS5vbm9wZW4pZS5SZ0NvbnRleHRNZW51Lm9ub3Blbih0KTtlLlJnQ29udGV4dE1lbnUuaXN2aXNpYmxlPXRydWU7dmFyIGk9dC5wYWdlWDt2YXIgbz10LnBhZ2VZO3ZhciBuPWUucm9vdC5xdWVyeVNlbGVjdG9yKFwiLm1lbnVcIik7dmFyIHI9bi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtpZihpPndpbmRvdy5pbm5lcldpZHRoK3dpbmRvdy5zY3JvbGxYLXIud2lkdGgpaT13aW5kb3cuaW5uZXJXaWR0aCt3aW5kb3cuc2Nyb2xsWC1yLndpZHRoO24uc3R5bGUubGVmdD1pK1wicHhcIjtpZihvPndpbmRvdy5pbm5lckhlaWdodCt3aW5kb3cuc2Nyb2xsWS1yLmhlaWdodClvPXdpbmRvdy5pbm5lckhlaWdodCt3aW5kb3cuc2Nyb2xsWS1yLmhlaWdodDtuLnN0eWxlLnRvcD1vK1wicHhcIjtlLnVwZGF0ZSgpfTt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdDb250ZXh0TWVudT10Lm1lbnV8fG5ldyBSZ0NvbnRleHRNZW51KHQpO2UuUmdDb250ZXh0TWVudS5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLGkpO3ZhciBuPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcmctY29udGV4dC1tZW51XVwiKTtmb3IodmFyIHI9MCxzO3M9bltyXTtyKyspe2lmKHMuYXR0cmlidXRlc1tcInJnLWNvbnRleHQtbWVudVwiXS52YWx1ZT09ZS5SZ0NvbnRleHRNZW51Lm5hbWUpcy5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIixvKTtlbHNlIHMuYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsZS5jbG9zZU1lbnUpfWUudXBkYXRlKCl9KTt0aGlzLm9uKFwidW5tb3VudFwiLGZ1bmN0aW9uKCl7ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsaSk7dmFyIHQ9ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyZy1jb250ZXh0LW1lbnVdXCIpO2Zvcih2YXIgbj0wLHI7cj10W25dO24rKyl7aWYoci5hdHRyaWJ1dGVzW1wicmctY29udGV4dC1tZW51XCJdLnZhbHVlPT1lLlJnQ29udGV4dE1lbnUubmFtZSlyLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLG8pO2Vsc2Ugci5yZW1vdmVFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIixlLmNsb3NlTWVudSl9fSk7dGhpcy5jbG9zZU1lbnU9ZnVuY3Rpb24oKXtlLlJnQ29udGV4dE1lbnUuaXN2aXNpYmxlPWZhbHNlfTt0aGlzLnNlbGVjdEl0ZW09ZnVuY3Rpb24odCl7dD10Lml0ZW07ZS5SZ0NvbnRleHRNZW51LnNlbGVjdCh0KX19LFwieyB9XCIpO3Jpb3QudGFnMihcInJnLWNyZWRpdC1jYXJkLW51bWJlclwiLCc8aW5wdXQgdHlwZT1cInRleHRcIiBuYW1lPVwiY2FyZG51bWJlclwiIGNsYXNzPVwiZmllbGQgY2FyZC1ubyB7UmdDcmVkaXRDYXJkLmljb259IHt2YWxpZDogUmdDcmVkaXRDYXJkLnZhbGlkfVwiIG9uaW5wdXQ9XCJ7dmFsaWRhdGV9XCIgcGxhY2Vob2xkZXI9XCJ7UmdDcmVkaXRDYXJkLnBsYWNlaG9sZGVyfVwiPicsJ3JnLWNyZWRpdC1jYXJkLW51bWJlciAuZmllbGQsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5maWVsZCB7IGZvbnQtc2l6ZTogMWVtOyBwYWRkaW5nOiAxMHB4OyBib3JkZXI6IDFweCBzb2xpZCAjRDNEM0QzOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyBvdXRsaW5lOiBub25lOyAtd2Via2l0LWFwcGVhcmFuY2U6IG5vbmU7IC1tb3otYXBwZWFyYW5jZTogbm9uZTsgYXBwZWFyYW5jZTogbm9uZTsgfSByZy1jcmVkaXQtY2FyZC1udW1iZXIgLmNhcmQtbm8sW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5jYXJkLW5vIHsgcGFkZGluZy1yaWdodDogNjBweDsgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDsgYmFja2dyb3VuZC1wb3NpdGlvbjogcmlnaHQgY2VudGVyOyBiYWNrZ3JvdW5kLXNpemU6IDYwcHg7IH0gcmctY3JlZGl0LWNhcmQtbnVtYmVyIC5hbWV4LFtyaW90LXRhZz1cInJnLWNyZWRpdC1jYXJkLW51bWJlclwiXSAuYW1leCB7IGJhY2tncm91bmQtaW1hZ2U6IHVybChpbWcvYW1leC5wbmcpOyB9IHJnLWNyZWRpdC1jYXJkLW51bWJlciAuZGluZXJzX2NsdWIsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5kaW5lcnNfY2x1YiB7IGJhY2tncm91bmQtaW1hZ2U6IHVybChpbWcvZGluZXJzX2NsdWIucG5nKTsgfSByZy1jcmVkaXQtY2FyZC1udW1iZXIgLmRpc2NvdmVyLFtyaW90LXRhZz1cInJnLWNyZWRpdC1jYXJkLW51bWJlclwiXSAuZGlzY292ZXIgeyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaW1nL2Rpc2NvdmVyLnBuZyk7IH0gcmctY3JlZGl0LWNhcmQtbnVtYmVyIC5qY2IsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC5qY2IgeyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaW1nL2pjYi5wbmcpOyB9IHJnLWNyZWRpdC1jYXJkLW51bWJlciAubWFzdGVyY2FyZCxbcmlvdC10YWc9XCJyZy1jcmVkaXQtY2FyZC1udW1iZXJcIl0gLm1hc3RlcmNhcmQgeyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoaW1nL21hc3RlcmNhcmQucG5nKTsgfSByZy1jcmVkaXQtY2FyZC1udW1iZXIgLnZpc2EsW3Jpb3QtdGFnPVwicmctY3JlZGl0LWNhcmQtbnVtYmVyXCJdIC52aXNhIHsgYmFja2dyb3VuZC1pbWFnZTogdXJsKGltZy92aXNhLnBuZyk7IH0nLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt2YXIgaT1mdW5jdGlvbiBvKCl7aWYoZS5jYXJkbnVtYmVyLnZhbHVlIT1lLlJnQ3JlZGl0Q2FyZC5jYXJkbnVtYmVyKWUuY2FyZG51bWJlci52YWx1ZT1lLlJnQ3JlZGl0Q2FyZC5jYXJkbnVtYmVyO2UuUmdDcmVkaXRDYXJkLnZhbGlkYXRlKCl9O3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ0NyZWRpdENhcmQ9dC5jYXJkfHxuZXcgUmdDcmVkaXRDYXJkKHQpO2UuUmdDcmVkaXRDYXJkLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7ZS5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7aSgpfSk7ZS51cGRhdGUoKX0pO3RoaXMudmFsaWRhdGU9ZnVuY3Rpb24oKXtlLlJnQ3JlZGl0Q2FyZC5jYXJkbnVtYmVyPWUuY2FyZG51bWJlci52YWx1ZTtlLlJnQ3JlZGl0Q2FyZC52YWxpZGF0ZSgpfX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctZGF0ZVwiLCc8ZGl2IGNsYXNzPVwiY29udGFpbmVyIHtvcGVuOiBSZ0RhdGUuaXN2aXNpYmxlfVwiPiA8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cImZpZWxkXCIgb25jbGljaz1cIntvcGVufVwiIHZhbHVlPVwie1JnRGF0ZS5kYXRlRm9ybWF0dGVkfVwiIHJlYWRvbmx5PiA8ZGl2IGNsYXNzPVwiY2FsZW5kYXJcIiBzaG93PVwie1JnRGF0ZS5pc3Zpc2libGV9XCI+IDxkaXYgY2xhc3M9XCJncmlkIGdyaWQtcm93XCIgaWY9XCJ7UmdEYXRlLnNob3dZZWFyc31cIj4gPGRpdiBjbGFzcz1cInNlbGVjdG9yXCIgb25jbGljaz1cIntwcmV2WWVhcn1cIj4mbHNhcXVvOzwvZGl2PiA8c3BhbiBjbGFzcz1cInllYXJcIj57UmdEYXRlLnllYXJ9PC9zcGFuPiA8ZGl2IGNsYXNzPVwic2VsZWN0b3JcIiBvbmNsaWNrPVwie25leHRZZWFyfVwiPiZyc2FxdW87PC9kaXY+IDwvZGl2PiA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLXJvd1wiIGlmPVwieyFSZ0RhdGUuc2hvd1llYXJzfVwiPiA8c3BhbiBjbGFzcz1cInllYXIgZmlsbFwiPntSZ0RhdGUueWVhcn08L3NwYW4+IDwvZGl2PiA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLXJvd1wiIGlmPVwie1JnRGF0ZS5zaG93TW9udGhzfVwiPiA8ZGl2IGNsYXNzPVwic2VsZWN0b3JcIiBvbmNsaWNrPVwie3ByZXZNb250aH1cIj4mbHNhcXVvOzwvZGl2PiA8c3BhbiBjbGFzcz1cIm1vbnRoXCI+e1JnRGF0ZS5tb250aH08L3NwYW4+IDxkaXYgY2xhc3M9XCJzZWxlY3RvclwiIG9uY2xpY2s9XCJ7bmV4dE1vbnRofVwiPiZyc2FxdW87PC9kaXY+IDwvZGl2PiA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLXJvd1wiIGlmPVwieyFSZ0RhdGUuc2hvd01vbnRoc31cIj4gPHNwYW4gY2xhc3M9XCJtb250aCBmaWxsXCI+e1JnRGF0ZS5tb250aH08L3NwYW4+IDwvZGl2PiA8ZGl2IGNsYXNzPVwiZ3JpZCBncmlkLXJvd1wiPiA8c3BhbiBjbGFzcz1cImRheS1uYW1lXCIgZWFjaD1cIntkYXkgaW4gUmdEYXRlLmRheU5hbWVzfVwiPntkYXl9PC9zcGFuPiA8L2Rpdj4gPGRpdiBjbGFzcz1cImdyaWQgZ3JpZC13cmFwXCI+IDxkaXYgZWFjaD1cIntkYXkgaW4gc3RhcnRCdWZmZXJ9XCIgb25jbGljaz1cIntzZWxlY3R9XCIgY2xhc3M9XCJkYXRlIHtpbjogZGF5LmluTW9udGgsIHNlbGVjdGVkOiBkYXkuc2VsZWN0ZWQsIHRvZGF5OiBkYXkudG9kYXl9XCI+IHtkYXkuZGF0ZS5mb3JtYXQodGhpcy5SZ0RhdGUuZGF5Rm9ybWF0KX0gPC9kaXY+IDxkaXYgZWFjaD1cIntkYXkgaW4gZGF5c31cIiBvbmNsaWNrPVwie3NlbGVjdH1cIiBjbGFzcz1cImRhdGUge2luOiBkYXkuaW5Nb250aCwgc2VsZWN0ZWQ6IGRheS5zZWxlY3RlZCwgdG9kYXk6IGRheS50b2RheX1cIj4ge2RheS5kYXRlLmZvcm1hdCh0aGlzLlJnRGF0ZS5kYXlGb3JtYXQpfSA8L2Rpdj4gPGRpdiBlYWNoPVwie2RheSBpbiBlbmRCdWZmZXJ9XCIgb25jbGljaz1cIntzZWxlY3R9XCIgY2xhc3M9XCJkYXRlIHtpbjogZGF5LmluTW9udGgsIHNlbGVjdGVkOiBkYXkuc2VsZWN0ZWQsIHRvZGF5OiBkYXkudG9kYXl9XCI+IHtkYXkuZGF0ZS5mb3JtYXQodGhpcy5SZ0RhdGUuZGF5Rm9ybWF0KX0gPC9kaXY+IDwvZGl2PiA8ZGl2IGlmPVwie1JnRGF0ZS5zaG93VG9kYXl9XCIgY2xhc3M9XCJncmlkIGdyaWQtcm93XCI+IDxhIGNsYXNzPVwic2hvcnRjdXRcIiBvbmNsaWNrPVwie3NldFRvZGF5fVwiPlRvZGF5PC9hPiA8L2Rpdj4gPC9kaXY+IDwvZGl2PicsJ3JnLWRhdGUgLmNvbnRhaW5lcixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5jb250YWluZXIgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLWRhdGUgLmZpZWxkLFtyaW90LXRhZz1cInJnLWRhdGVcIl0gLmZpZWxkIHsgZm9udC1zaXplOiAxZW07IHBhZGRpbmc6IDEwcHg7IGJvcmRlcjogMXB4IHNvbGlkICNEM0QzRDM7IGN1cnNvcjogcG9pbnRlcjsgYm94LXNpemluZzogYm9yZGVyLWJveDsgb3V0bGluZTogbm9uZTsgLXdlYmtpdC1hcHBlYXJhbmNlOiBub25lOyAtbW96LWFwcGVhcmFuY2U6IG5vbmU7IGFwcGVhcmFuY2U6IG5vbmU7IH0gcmctZGF0ZSAuY2FsZW5kYXIsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuY2FsZW5kYXIgeyBwb3NpdGlvbjogYWJzb2x1dGU7IHRleHQtYWxpZ246IGNlbnRlcjsgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IGJvcmRlcjogMXB4IHNvbGlkICNEM0QzRDM7IHBhZGRpbmc6IDVweDsgd2lkdGg6IDMzMHB4OyBtYXJnaW4tdG9wOiAxMHB4OyBsZWZ0OiA1MCU7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoLTUwJSwgMCwgMCk7IC13ZWJraXQtdXNlci1zZWxlY3Q6IG5vbmU7IC1tb3otdXNlci1zZWxlY3Q6IG5vbmU7IC1tcy11c2VyLXNlbGVjdDogbm9uZTsgdXNlci1zZWxlY3Q6IG5vbmU7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IHotaW5kZXg6IDE7IH0gcmctZGF0ZSAuZ3JpZCxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5ncmlkIHsgZGlzcGxheTogLXdlYmtpdC1mbGV4OyBkaXNwbGF5OiAtbXMtZmxleGJveDsgZGlzcGxheTogZmxleDsgLXdlYmtpdC1hbGlnbi1pdGVtczogY2VudGVyOyAtbXMtZmxleC1hbGlnbjogY2VudGVyOyBhbGlnbi1pdGVtczogY2VudGVyOyB9IHJnLWRhdGUgLmdyaWQtd3JhcCxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5ncmlkLXdyYXAgeyB3aWR0aDogMTAwJTsgLXdlYmtpdC1mbGV4LXdyYXA6IHdyYXA7IC1tcy1mbGV4LXdyYXA6IHdyYXA7IGZsZXgtd3JhcDogd3JhcDsgfSByZy1kYXRlIC5ncmlkLXJvdyxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5ncmlkLXJvdyB7IGhlaWdodDogMzVweDsgfSByZy1kYXRlIC5zZWxlY3RvcixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5zZWxlY3RvciB7IGZvbnQtc2l6ZTogMmVtOyBmb250LXdlaWdodDogMTAwOyBwYWRkaW5nOiAwOyAtd2Via2l0LWZsZXg6IDAgMCAxNSU7IC1tcy1mbGV4OiAwIDAgMTUlOyBmbGV4OiAwIDAgMTUlOyB9IHJnLWRhdGUgLnllYXIsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAueWVhcixyZy1kYXRlIC5tb250aCxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5tb250aCB7IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7IGZvbnQtd2VpZ2h0OiBub3JtYWw7IC13ZWJraXQtZmxleDogMCAwIDcwJTsgLW1zLWZsZXg6IDAgMCA3MCU7IGZsZXg6IDAgMCA3MCU7IH0gcmctZGF0ZSAuZmlsbCxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5maWxsIHsgLXdlYmtpdC1mbGV4OiAwIDAgMTAwJTsgLW1zLWZsZXg6IDAgMCAxMDAlOyBmbGV4OiAwIDAgMTAwJTsgfSByZy1kYXRlIC5kYXktbmFtZSxbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5kYXktbmFtZSB7IGZvbnQtd2VpZ2h0OiBib2xkOyAtd2Via2l0LWZsZXg6IDAgMCAxNC4yOCU7IC1tcy1mbGV4OiAwIDAgMTQuMjglOyBmbGV4OiAwIDAgMTQuMjglOyB9IHJnLWRhdGUgLmRhdGUsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuZGF0ZSB7IC13ZWJraXQtZmxleDogMCAwIDE0LjI4JTsgLW1zLWZsZXg6IDAgMCAxNC4yOCU7IGZsZXg6IDAgMCAxNC4yOCU7IHBhZGRpbmc6IDEycHggMTBweDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgZm9udC1zaXplOiAwLjhlbTsgZm9udC13ZWlnaHQ6IG5vcm1hbDsgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7IGNvbG9yOiAjY2FjYWNhOyB9IHJnLWRhdGUgLmRhdGU6aG92ZXIsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuZGF0ZTpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICNmM2YzZjM7IH0gcmctZGF0ZSAuZGF0ZS5pbixbcmlvdC10YWc9XCJyZy1kYXRlXCJdIC5kYXRlLmluIHsgY29sb3I6IGluaGVyaXQ7IH0gcmctZGF0ZSAudG9kYXksW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAudG9kYXkgeyBib3JkZXItY29sb3I6ICNlZGVkZWQ7IH0gcmctZGF0ZSAuc2VsZWN0ZWQsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuc2VsZWN0ZWQscmctZGF0ZSAuc2VsZWN0ZWQ6aG92ZXIsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuc2VsZWN0ZWQ6aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjZWRlZGVkOyBib3JkZXItY29sb3I6ICNkZWRlZGU7IH0gcmctZGF0ZSAuc2hvcnRjdXQsW3Jpb3QtdGFnPVwicmctZGF0ZVwiXSAuc2hvcnRjdXQgeyAtd2Via2l0LWZsZXg6IDAgMCAxMDAlOyAtbXMtZmxleDogMCAwIDEwMCU7IGZsZXg6IDAgMCAxMDAlOyBjb2xvcjogIzY0OTVlZDsgfScsXCJcIixmdW5jdGlvbih0KXt2YXIgZT10aGlzO3ZhciBpPWZ1bmN0aW9uIHIodCl7aWYoIWUucm9vdC5jb250YWlucyh0LnRhcmdldCkpZS5SZ0RhdGUuY2xvc2UoKTtlLnVwZGF0ZSgpfTt2YXIgbz1mdW5jdGlvbiBzKHQpe3ZhciBpPXR8fG1vbWVudCgpO3JldHVybntkYXRlOmksc2VsZWN0ZWQ6ZS5SZ0RhdGUuZGF0ZS5pc1NhbWUodCxcImRheVwiKSx0b2RheTptb21lbnQoKS5pc1NhbWUodCxcImRheVwiKSxpbk1vbnRoOmUuUmdEYXRlLmRhdGUuaXNTYW1lKHQsXCJtb250aFwiKX19O3ZhciBuPWZ1bmN0aW9uIGEoKXt2YXIgdD1tb21lbnQoZS5SZ0RhdGUuZGF0ZSkuc3RhcnRPZihcIm1vbnRoXCIpO3ZhciBpPW1vbWVudChlLlJnRGF0ZS5kYXRlKS5lbmRPZihcIm1vbnRoXCIpO2UuZGF5cz1bXTtlLnN0YXJ0QnVmZmVyPVtdO2UuZW5kQnVmZmVyPVtdO2Zvcih2YXIgbj10LndlZWtkYXkoKTtuPj0wO24tPTEpe3ZhciByPW1vbWVudCh0KS5zdWJ0cmFjdChuLFwiZGF5c1wiKTtlLnN0YXJ0QnVmZmVyLnB1c2gobyhyKSl9Zm9yKHZhciBuPWkuZGF0ZSgpLTE7bj4wO24tPTEpe3ZhciBzPW1vbWVudCh0KS5hZGQobixcImRheXNcIik7ZS5kYXlzLnVuc2hpZnQobyhzKSl9Zm9yKHZhciBuPWkud2Vla2RheSgpO248NjtuKz0xKXt2YXIgcj1tb21lbnQoaSkuYWRkKG4sXCJkYXlzXCIpO2UuZW5kQnVmZmVyLnB1c2gobyhyKSl9fTt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdEYXRlPXQuZGF0ZXx8bmV3IFJnRGF0ZSh0KTtlLlJnRGF0ZS5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2Uub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe24oKX0pO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLGkpO2UudXBkYXRlKCl9KTt0aGlzLm9uKFwidW5tb3VudFwiLGZ1bmN0aW9uKCl7ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsaSl9KTt0aGlzLm9wZW49ZnVuY3Rpb24oKXtlLlJnRGF0ZS5vcGVuKCl9O3RoaXMucHJldlllYXI9ZnVuY3Rpb24oKXtlLlJnRGF0ZS5wcmV2WWVhcigpfTt0aGlzLm5leHRZZWFyPWZ1bmN0aW9uKCl7ZS5SZ0RhdGUubmV4dFllYXIoKX07dGhpcy5wcmV2TW9udGg9ZnVuY3Rpb24oKXtlLlJnRGF0ZS5wcmV2TW9udGgoKX07dGhpcy5uZXh0TW9udGg9ZnVuY3Rpb24oKXtlLlJnRGF0ZS5uZXh0TW9udGgoKX07dGhpcy5zZXRUb2RheT1mdW5jdGlvbigpe2UuUmdEYXRlLnNldFRvZGF5KCl9O3RoaXMuc2VsZWN0PWZ1bmN0aW9uKHQpe2UuUmdEYXRlLnNlbGVjdCh0Lml0ZW0uZGF5LmRhdGUpfX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctZHJhd2VyXCIsJzxkaXYgY2xhc3M9XCJvdmVybGF5IHt2aXNpYmxlOiBSZ0RyYXdlci5pc3Zpc2libGV9XCIgb25jbGljaz1cIntjbG9zZX1cIj48L2Rpdj4gPGRpdiBjbGFzcz1cImRyYXdlciB7UmdEcmF3ZXIucG9zaXRpb259IHt2aXNpYmxlOiBSZ0RyYXdlci5pc3Zpc2libGV9XCI+IDxoNCBjbGFzcz1cImhlYWRlclwiPntSZ0RyYXdlci5oZWFkZXJ9PC9oND4gPHVsIGNsYXNzPVwiaXRlbXNcIj4gPGxpIGNsYXNzPVwiaXRlbSB7YWN0aXZlOiBhY3RpdmV9XCIgZWFjaD1cIntSZ0RyYXdlci5pdGVtc31cIiBvbmNsaWNrPVwie3BhcmVudC5zZWxlY3R9XCI+IDxyZy1yYXcgY29udGVudD1cIntjb250ZW50fVwiPjwvcmctcmF3PiA8L2xpPiA8L3VsPiA8ZGl2IGNsYXNzPVwiYm9keVwiPiA8eWllbGQ+PC95aWVsZD4gPC9kaXY+IDwvZGl2PicsJ3JnLWRyYXdlciAub3ZlcmxheSxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLm92ZXJsYXkgeyBkaXNwbGF5OiBub25lOyBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogMDsgbGVmdDogMDsgcmlnaHQ6IDA7IGJvdHRvbTogMDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgYmFja2dyb3VuZC1jb2xvcjogcmdiYSgwLCAwLCAwLCAwLjUpOyBjdXJzb3I6IHBvaW50ZXI7IHotaW5kZXg6IDUwOyB9IHJnLWRyYXdlciAub3ZlcmxheS52aXNpYmxlLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAub3ZlcmxheS52aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctZHJhd2VyIC5kcmF3ZXIsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIgeyBwb3NpdGlvbjogYWJzb2x1dGU7IG92ZXJmbG93LXk6IGF1dG87IG92ZXJmbG93LXg6IGhpZGRlbjsgLXdlYmtpdC1vdmVyZmxvdy1zY3JvbGxpbmc6IHRvdWNoOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgY29sb3I6IGJsYWNrOyB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC41cyBlYXNlOyB6LWluZGV4OiA1MTsgfSByZy1kcmF3ZXIgLmRyYXdlci5ib3R0b20sW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIuYm90dG9tIHsgdG9wOiAxMDAlOyBsZWZ0OiAwOyBoZWlnaHQ6IGF1dG87IHdpZHRoOiA4MCU7IG1hcmdpbi1sZWZ0OiAxMCU7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoMCwgMCwgMCk7IH0gcmctZHJhd2VyIC5kcmF3ZXIuYm90dG9tLnZpc2libGUsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIuYm90dG9tLnZpc2libGUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDAsIC0xMDAlLCAwKTsgfSByZy1kcmF3ZXIgLmRyYXdlci50b3AsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIudG9wIHsgYm90dG9tOiAxMDAlOyBsZWZ0OiAwOyBoZWlnaHQ6IGF1dG87IHdpZHRoOiA4MCU7IG1hcmdpbi1sZWZ0OiAxMCU7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoMCwgMCwgMCk7IH0gcmctZHJhd2VyIC5kcmF3ZXIudG9wLnZpc2libGUsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIudG9wLnZpc2libGUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDAsIDEwMCUsIDApOyB9IHJnLWRyYXdlciAuZHJhd2VyLmxlZnQsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5kcmF3ZXIubGVmdCB7IHRvcDogMDsgbGVmdDogMDsgaGVpZ2h0OiAxMDAlOyB3aWR0aDogMjYwcHg7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoLTEwMCUsIDAsIDApOyB9IHJnLWRyYXdlciAuZHJhd2VyLmxlZnQudmlzaWJsZSxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLmRyYXdlci5sZWZ0LnZpc2libGUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKDAsIDAsIDApOyB9IHJnLWRyYXdlciAuZHJhd2VyLnJpZ2h0LFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLnJpZ2h0IHsgdG9wOiAwOyBsZWZ0OiAxMDAlOyBoZWlnaHQ6IDEwMCU7IHdpZHRoOiAyNjBweDsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgwLCAwLCAwKTsgfSByZy1kcmF3ZXIgLmRyYXdlci5yaWdodC52aXNpYmxlLFtyaW90LXRhZz1cInJnLWRyYXdlclwiXSAuZHJhd2VyLnJpZ2h0LnZpc2libGUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKC0xMDAlLCAwLCAwKTsgfSByZy1kcmF3ZXIgLmhlYWRlcixbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLmhlYWRlciB7IHBhZGRpbmc6IDEuMnJlbTsgbWFyZ2luOiAwOyB0ZXh0LWFsaWduOiBjZW50ZXI7IH0gcmctZHJhd2VyIC5pdGVtcyxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLml0ZW1zIHsgcGFkZGluZzogMDsgbWFyZ2luOiAwOyBsaXN0LXN0eWxlOiBub25lOyB9IHJnLWRyYXdlciAuaXRlbSxbcmlvdC10YWc9XCJyZy1kcmF3ZXJcIl0gLml0ZW0geyBwYWRkaW5nOiAxcmVtIDAuNXJlbTsgYm94LXNpemluZzogYm9yZGVyLWJveDsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICNFOEU4RTg7IH0gcmctZHJhd2VyIC5pdGVtOmxhc3QtY2hpbGQsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5pdGVtOmxhc3QtY2hpbGQgeyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI0U4RThFODsgfSByZy1kcmF3ZXIgLml0ZW06aG92ZXIsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5pdGVtOmhvdmVyIHsgY3Vyc29yOiBwb2ludGVyOyBiYWNrZ3JvdW5kLWNvbG9yOiAjRThFOEU4OyB9IHJnLWRyYXdlciAuaXRlbS5hY3RpdmUsW3Jpb3QtdGFnPVwicmctZHJhd2VyXCJdIC5pdGVtLmFjdGl2ZSB7IGN1cnNvcjogcG9pbnRlcjsgYmFja2dyb3VuZC1jb2xvcjogI0VFRTsgfScsXCJcIixmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ0RyYXdlcj10LmRyYXdlcnx8bmV3IFJnRHJhd2VyKHQpO2UuUmdEcmF3ZXIub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2UudXBkYXRlKCl9KTtlLnVwZGF0ZSgpfSk7dGhpcy5jbG9zZT1mdW5jdGlvbigpe2UuUmdEcmF3ZXIuY2xvc2UoKX07dGhpcy5zZWxlY3Q9ZnVuY3Rpb24odCl7ZS5SZ0RyYXdlci5zZWxlY3QodC5pdGVtKX19LFwieyB9XCIpO3Jpb3QudGFnMihcInJnLWdhXCIsXCJcIixcIlwiLFwiXCIsZnVuY3Rpb24odCl7KGZ1bmN0aW9uKHQsZSxpLG8sbixyLHMpe3RbXCJHb29nbGVBbmFseXRpY3NPYmplY3RcIl09bjt0W25dPXRbbl18fGZ1bmN0aW9uKCl7KHRbbl0ucT10W25dLnF8fFtdKS5wdXNoKGFyZ3VtZW50cyl9LHRbbl0ubD0xKm5ldyBEYXRlO3I9ZS5jcmVhdGVFbGVtZW50KGkpLHM9ZS5nZXRFbGVtZW50c0J5VGFnTmFtZShpKVswXTtyLmFzeW5jPTE7ci5zcmM9bztzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHIscyl9KSh3aW5kb3csZG9jdW1lbnQsXCJzY3JpcHRcIixcIi8vd3d3Lmdvb2dsZS1hbmFseXRpY3MuY29tL2FuYWx5dGljcy5qc1wiLFwiZ2FcIik7Z2EoXCJjcmVhdGVcIix0LnByb3BlcnR5LFwiYXV0b1wiKTtnYShcInNlbmRcIixcInBhZ2V2aWV3XCIpfSk7cmlvdC50YWcyKFwicmctaW5jbHVkZVwiLFwiPGRpdj4ge3Jlc3BvbnNlVGV4dH0gPC9kaXY+XCIsXCJcIixcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5vbihcIm1vdW50XCIsZnVuY3Rpb24oKXtlLlJnSW5jbHVkZT10LmluY2x1ZGV8fG5ldyBSZ0luY2x1ZGUodCk7ZS5SZ0luY2x1ZGUub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2UuUmdJbmNsdWRlLmZldGNoKCl9KTtlLlJnSW5jbHVkZS5vbihcImZldGNoXCIsZnVuY3Rpb24odCl7aWYoZS5SZ0luY2x1ZGUudW5zYWZlKWUucm9vdC5pbm5lckhUTUw9dDtlbHNlIGUucmVzcG9uc2VUZXh0PXQ7ZS51cGRhdGUoKX0pO2UuUmdJbmNsdWRlLmZldGNoKCl9KX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctbG9hZGluZ1wiLCc8ZGl2IGNsYXNzPVwibG9hZGluZyB7dmlzaWJsZTogUmdMb2FkaW5nLmlzdmlzaWJsZX1cIj4gPGRpdiBjbGFzcz1cIm92ZXJsYXlcIj48L2Rpdj4gPGRpdiBjbGFzcz1cImNvbnRlbnRcIj4gPHlpZWxkPjwveWllbGQ+IDwvZGl2PiA8L2Rpdj4nLCdyZy1sb2FkaW5nIC5sb2FkaW5nLFtyaW90LXRhZz1cInJnLWxvYWRpbmdcIl0gLmxvYWRpbmcgeyBkaXNwbGF5OiBub25lOyB9IHJnLWxvYWRpbmcgLnZpc2libGUsW3Jpb3QtdGFnPVwicmctbG9hZGluZ1wiXSAudmlzaWJsZSB7IGRpc3BsYXk6IGJsb2NrOyB9IHJnLWxvYWRpbmcgLm92ZXJsYXksW3Jpb3QtdGFnPVwicmctbG9hZGluZ1wiXSAub3ZlcmxheSB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAwOyBsZWZ0OiAwOyByaWdodDogMDsgYm90dG9tOiAwOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuOCk7IHotaW5kZXg6IDIwMDsgfSByZy1sb2FkaW5nIC5jb250ZW50LFtyaW90LXRhZz1cInJnLWxvYWRpbmdcIl0gLmNvbnRlbnQgeyBwb3NpdGlvbjogYWJzb2x1dGU7IHdpZHRoOiA5NSU7IG1heC13aWR0aDogNDIwcHg7IHRvcDogNTAlOyBsZWZ0OiA1MCU7IHRyYW5zZm9ybTogdHJhbnNsYXRlM2QoLTUwJSwgLTUwJSwgMCk7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50OyBjb2xvcjogI2ZmZjsgdGV4dC1hbGlnbjogY2VudGVyOyB6LWluZGV4OiAyMDE7IH0nLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdMb2FkaW5nPXQubG9hZGluZ3x8bmV3IFJnTG9hZGluZyh0KTtlLlJnTG9hZGluZy5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2UudXBkYXRlKCl9KX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctbWFwXCIsJzxkaXYgY2xhc3M9XCJyZy1tYXBcIj48L2Rpdj4nLCdyZy1tYXAgLnJnLW1hcCxbcmlvdC10YWc9XCJyZy1tYXBcIl0gLnJnLW1hcCB7IG1hcmdpbjogMDsgcGFkZGluZzogMDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgfSByZy1tYXAgLnJnLW1hcCBpbWcsW3Jpb3QtdGFnPVwicmctbWFwXCJdIC5yZy1tYXAgaW1nIHsgbWF4LXdpZHRoOiBpbmhlcml0OyB9JyxcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5vbihcIm1vdW50XCIsZnVuY3Rpb24oKXtlLlJnTWFwPXQubWFwfHxuZXcgUmdNYXAodCk7cmcubWFwLm9uKFwiaW5pdGlhbGl6ZVwiLGZ1bmN0aW9uKCl7cmcubWFwLm9iaj1uZXcgZ29vZ2xlLm1hcHMuTWFwKGUucm9vdC5xdWVyeVNlbGVjdG9yKFwiLnJnLW1hcFwiKSxlLlJnTWFwLm9wdGlvbnMpfSk7aWYoIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZ21hcF9zY3JpcHRcIikpe3ZhciBpPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7aS5zZXRBdHRyaWJ1dGUoXCJpZFwiLFwiZ21hcF9zY3JpcHRcIik7aS50eXBlPVwidGV4dC9qYXZhc2NyaXB0XCI7aS5zcmM9XCJodHRwczovL21hcHMuZ29vZ2xlYXBpcy5jb20vbWFwcy9hcGkvanM/Y2FsbGJhY2s9cmcubWFwLmluaXRpYWxpemVcIjtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGkpfX0pfSk7cmlvdC50YWcyKFwicmctbWFya2Rvd25cIiwnPGRpdiBjbGFzcz1cIm1hcmtkb3duXCI+PC9kaXY+JyxcIlwiLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdNYXJrZG93bj10Lm1hcmtkb3dufHxuZXcgUmdNYXJrZG93bih0KTtlLlJnTWFya2Rvd24ub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2UuUmdNYXJrZG93bi5mZXRjaCgpfSk7ZS5SZ01hcmtkb3duLm9uKFwiZmV0Y2hcIixmdW5jdGlvbih0KXtlLlJnTWFya2Rvd24ucGFyc2UodCl9KTtlLlJnTWFya2Rvd24ub24oXCJwYXJzZVwiLGZ1bmN0aW9uKHQpe2Uucm9vdC5pbm5lckhUTUw9dDtlLnVwZGF0ZSgpfSk7ZS5SZ01hcmtkb3duLmZldGNoKCl9KX0pO3Jpb3QudGFnMihcInJnLW1vZGFsXCIsJzxkaXYgY2xhc3M9XCJvdmVybGF5IHt2aXNpYmxlOiBSZ01vZGFsLmlzdmlzaWJsZSwgZ2hvc3Q6IFJnTW9kYWwuZ2hvc3QsIGRpc21pc3NhYmxlOiBSZ01vZGFsLmRpc21pc3NhYmxlfVwiIG9uY2xpY2s9XCJ7Y2xvc2V9XCI+PC9kaXY+IDxkaXYgY2xhc3M9XCJtb2RhbCB7dmlzaWJsZTogUmdNb2RhbC5pc3Zpc2libGUsIGdob3N0OiBSZ01vZGFsLmdob3N0LCBkaXNtaXNzYWJsZTogUmdNb2RhbC5kaXNtaXNzYWJsZX1cIj4gPGhlYWRlciBjbGFzcz1cImhlYWRlclwiPiA8YnV0dG9uIGlmPVwie1JnTW9kYWwuZGlzbWlzc2FibGV9XCIgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY2xvc2VcIiBhcmlhLWxhYmVsPVwiQ2xvc2VcIiBvbmNsaWNrPVwie2Nsb3NlfVwiPiA8c3BhbiBhcmlhLWhpZGRlbj1cInRydWVcIj4mdGltZXM7PC9zcGFuPiA8L2J1dHRvbj4gPGgzIGNsYXNzPVwiaGVhZGluZ1wiPjxyZy1yYXcgY29udGVudD1cIntSZ01vZGFsLmhlYWRpbmd9XCI+PC9yZy1yYXc+PC9oMz4gPC9oZWFkZXI+IDxkaXYgY2xhc3M9XCJib2R5XCI+IDx5aWVsZD48L3lpZWxkPiA8L2Rpdj4gPGZvb3RlciBjbGFzcz1cImZvb3RlclwiPiA8YnV0dG9uIGNsYXNzPVwiYnV0dG9uXCIgZWFjaD1cIntSZ01vZGFsLmJ1dHRvbnN9XCIgdHlwZT1cImJ1dHRvblwiIG9uY2xpY2s9XCJ7YWN0aW9ufVwiIHJpb3Qtc3R5bGU9XCJ7c3R5bGV9XCI+IDxyZy1yYXcgY29udGVudD1cIntjb250ZW50fVwiPjwvcmctcmF3PiA8L2J1dHRvbj4gPGRpdiBjbGFzcz1cImNsZWFyXCI+PC9kaXY+IDwvZm9vdGVyPiA8L2Rpdj4nLCdyZy1tb2RhbCAub3ZlcmxheSxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAub3ZlcmxheSB7IGRpc3BsYXk6IG5vbmU7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAwOyBsZWZ0OiAwOyByaWdodDogMDsgYm90dG9tOiAwOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDAsIDAsIDAsIDAuOCk7IHotaW5kZXg6IDEwMDsgfSByZy1tb2RhbCAub3ZlcmxheS5kaXNtaXNzYWJsZSxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAub3ZlcmxheS5kaXNtaXNzYWJsZSB7IGN1cnNvcjogcG9pbnRlcjsgfSByZy1tb2RhbCAubW9kYWwsW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLm1vZGFsIHsgZGlzcGxheTogbm9uZTsgcG9zaXRpb246IGFic29sdXRlOyB3aWR0aDogOTUlOyBtYXgtd2lkdGg6IDUwMHB4OyBmb250LXNpemU6IDEuMWVtOyB0b3A6IDUwJTsgbGVmdDogNTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZTNkKC01MCUsIC01MCUsIDApOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgY29sb3I6ICMyNTI1MTk7IHotaW5kZXg6IDEwMTsgfSByZy1tb2RhbCAubW9kYWwuZ2hvc3QsW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLm1vZGFsLmdob3N0IHsgYmFja2dyb3VuZC1jb2xvcjogdHJhbnNwYXJlbnQ7IGNvbG9yOiB3aGl0ZTsgfSByZy1tb2RhbCAudmlzaWJsZSxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAudmlzaWJsZSB7IGRpc3BsYXk6IGJsb2NrOyB9IHJnLW1vZGFsIC5oZWFkZXIsW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLmhlYWRlciB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdGV4dC1hbGlnbjogY2VudGVyOyB9IHJnLW1vZGFsIC5oZWFkaW5nLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5oZWFkaW5nIHsgcGFkZGluZzogMjBweCAyMHB4IDAgMjBweDsgbWFyZ2luOiAwOyBmb250LXNpemU6IDEuMmVtOyB9IHJnLW1vZGFsIC5tb2RhbC5naG9zdCAuaGVhZGluZyxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAubW9kYWwuZ2hvc3QgLmhlYWRpbmcgeyBjb2xvcjogd2hpdGU7IH0gcmctbW9kYWwgLmNsb3NlLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5jbG9zZSB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiA1cHg7IHJpZ2h0OiAxMHB4OyBwYWRkaW5nOiAwOyBmb250LXNpemU6IDEuMmVtOyBib3JkZXI6IDA7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50OyBjb2xvcjogIzAwMDsgY3Vyc29yOiBwb2ludGVyOyBvdXRsaW5lOiBub25lOyB9IHJnLW1vZGFsIC5tb2RhbC5naG9zdCAuY2xvc2UsW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLm1vZGFsLmdob3N0IC5jbG9zZSB7IGNvbG9yOiB3aGl0ZTsgfSByZy1tb2RhbCAuYm9keSxbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAuYm9keSB7IHBhZGRpbmc6IDIwcHg7IH0gcmctbW9kYWwgLmZvb3RlcixbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAuZm9vdGVyIHsgcGFkZGluZzogMCAyMHB4IDIwcHggMjBweDsgfSByZy1tb2RhbCAuYnV0dG9uLFtyaW90LXRhZz1cInJnLW1vZGFsXCJdIC5idXR0b24geyBmbG9hdDogcmlnaHQ7IHBhZGRpbmc6IDEwcHg7IG1hcmdpbjogMCA1cHggMCAwOyBib3JkZXI6IG5vbmU7IGZvbnQtc2l6ZTogMC45ZW07IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7IGN1cnNvcjogcG9pbnRlcjsgb3V0bGluZTogbm9uZTsgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IH0gcmctbW9kYWwgLm1vZGFsLmdob3N0IC5idXR0b24sW3Jpb3QtdGFnPVwicmctbW9kYWxcIl0gLm1vZGFsLmdob3N0IC5idXR0b24geyBjb2xvcjogd2hpdGU7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50OyB9IHJnLW1vZGFsIC5jbGVhcixbcmlvdC10YWc9XCJyZy1tb2RhbFwiXSAuY2xlYXIgeyBjbGVhcjogYm90aDsgfScsXCJcIixmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ01vZGFsPXQubW9kYWx8fG5ldyBSZ01vZGFsKHQpO2UuUmdNb2RhbC5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2UudXBkYXRlKCl9KTt0aGlzLmNsb3NlPWZ1bmN0aW9uKCl7aWYoZS5SZ01vZGFsLmRpc21pc3NhYmxlKWUuUmdNb2RhbC5pc3Zpc2libGU9ZmFsc2V9fSxcInsgfVwiKTtyaW90LnRhZzIoXCJyZy1waG9uZS1zaW1cIiwnPGRpdiBjbGFzcz1cImVtdWxhdG9yXCI+IDxpZnJhbWUgY2xhc3M9XCJzY3JlZW5cIiByaW90LXNyYz1cIntSZ1Bob25lU2ltLnVybH1cIj48L2lmcmFtZT4gPC9kaXY+JywncmctcGhvbmUtc2ltIC5lbXVsYXRvcixbcmlvdC10YWc9XCJyZy1waG9uZS1zaW1cIl0gLmVtdWxhdG9yIHsgcG9zaXRpb246IHJlbGF0aXZlOyB3aWR0aDogMzY1cHg7IGhlaWdodDogNzkycHg7IGJhY2tncm91bmQtaW1hZ2U6IHVybChcXCdkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQVcwQUFBTVlDQU1BQUFBM3IwWkxBQUFBR1hSRldIUlRiMlowZDJGeVpRQkJaRzlpWlNCSmJXRm5aVkpsWVdSNWNjbGxQQUFBQXdCUVRGUkZNRGs2K3ZyNktUTTBsSnVjTXo0L1BrbEtKUzh3TFRnNVFrMU94c2pJTHpvN2dvbUoyTnZiZEg1L2hvMk85ZmIyS3pZM3p0SFJQRWRJT2tWR1pXeHRqSlNWT0VKRGtwZVlXR1JsdUwyK0tUUTF2Y0hCb2FXbFBVWkhjbnA2bktLak9rUkYxTmZYcWEydHA2MnRabkJ4YW5WMlZtRmlaMjl3VmwxZWFYSnpiWFIwNHVUa3RicTdRRWxLMXRuWmlwS1RpNUNSVGxaWHBLaW9vNm1xWG1scVVWbGFPRUZDU1ZGU1VGeGRJU3NzVDF0Y1RscGJKQzR2SWl3dFRWbGFKakF4SXkwdVRGaFpTMWRZSnpFeUtESXpTbFpYUFVoSk9VUkZPMFpIU1ZWV0t6VTJQMHBMS2pRMU9FTkVORDArUUV0TUxEWTNTRlJWTjBKRFEwNVBMVGM0TkQ5QU5VQkJRVXhOTmtGQ1IxTlVNVG83UkU5UUxqZzVOMEJCUjFKVFJsSlRMems2UlZGU01qczhSVkJSUmxGU05qOUFNenc5U0ZOVU1qMCtJaXNzTVRzOE1EbzdTVlJWUkZCUk1EczhNVHc5SWl3c016MCtNanc5U2xWV1EwOVFMams2TlQ0L1MxWlhORDQvSkM0dVFVMU9JeTB0UWs1UFRGZFlUVmhaUUV4TlRsbGFKUzh2SnpJeVAwdE1Memc1TERjNEtETXpOVDlBS2pVMU4wRkNOa0JCSmpBd0l5d3RNRHM3TWowOU5rRkJKakV4TGprNUxEYzNOMEpDTlVCQUtqVTJNVHc4TERVMkxqYzRPVU5FS0RFeVFVMU5QRWhJUEVoSk8wZEhPa1pHTkQ4L1FrNU9SRkJRUTA5UExUWTNPVVJFUGtwS1BrcExQVWxKVDFwYlAwdExKVEF3UFVsS0p6QXhLak0wN3UvdktUSXpzYlcyWUdwcnRMbTUwdFhXUGtoSm82ZW5kbitBM2QvZjZ1dnJlb09FZzR5TjJ0dmMvUHo4bjZhbTgvVDBWRnRjbTZDZ0pTNHY0T0xpNXVmbllHZG5jbnQ4ZEhwN2dZYUhKQzB1dThEQWpKR1JRa3hOeE1mSEt6UTFZR3RzUzFOVWFYTjBibmg1eU16TXlzek15ODNPeTgvUGRvQ0FLREl5N08zdFQxZFl1THU3ME5UVWJYZDQ2T25xNmVycmVvQ0EyZHpjOFBIeDh2UHo1T1hsbmFTa242V21xcTZ1Y0haMnQ3eThvNmVvZW9TRWtKYVdtNStnVzJablpHNXZxYSt3T0VGQjA5Yld0cnU3cXJDd2NYZDR0N3U4M2VEZ3pNN083L0R3TlQ0KzdlN3V3TVBEd2NQRWVINS8vLy8vNzB3blVRQUFBUUIwVWs1VC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9BRlAzQnlVQUFBK05TVVJCVkhqYTdOMTNuQlRsR2NEeEVRSTVBbUpRQkFrY25xaEVESWhvV010NWlvZ21RYk9hWU5ycVlySmgxNmdwbG1UVmtJTEpwWUNtRitEU0UxSkljalJSN0wzMzNudFBZalF4dlRsNTV0bnI3Tjd0N3V3K3ZEUDMrLzB4M0czaHM1K3ZyKys4TTdzN2VINzVYYjV4K3JPak4wMTdhZXErdE8rK1UxK2F0bW4wczlNM1hsNkJvRmZtNDY2Wk9QUk9oSXQyNTlDSjE5UlMrKzdMZGdXMTMzYTk3TzdhYUkvYStWRTB5K2pSblVlRjFwNndxZnZ2YXo2K1lWalQwak15SjNya2VTZG16bGphTkt6aCtPWnVvRTBUUW1tdnY2N3pMenJ3bU1ZOHdrWExOeDV6WUNmVGRldXIxcDZ3ZGVlZ2JsZ0thcjh0YmVnYzRsdi9yaXJ0alRNTFQ5OS9VVk1LemdGTE5TM2F2d0EyYzJQbDJuOHRQSFYxUXhMSk1rczJyQzZnL2FsQzdTY3ZLb3pyaGh5SUZaUnJLSXp2aTU2c1JIdDk0Yi9SSXNaMXhlTjdVWUZ1ZmZuYTQvVUpCNjhFcjRyR0hheDY0OHZVZm1xa1BueEJCcm1xeWl4UXY1RlBsYVA5RHoyZVdkSUVXOVUxTGRGam5Rc0cxbjVFVHo0ZHlvd2RhdlkrVkU5WFBUS1E5cGhkZFBmSUNqdms2bHQzbHJ1TTZWOTdqMTMybDI2QkszUzNCSkF2NzlHZjlqTjNCWTg1SEtzYWRIaEFlZGViU210ZitvZmdFY09RcWtuREFzeUxMaTJwUFRxNC8waWNhdFNSQWVmb1V0bzdCdmMyb0ZTekdnTFFIWXRyM3hUY3Q1RFZTQTFYSmdzRDBwdUthYTk5czl3emx3UEltaDVXemhYVGwvNVRSSHQ3dWFONUdVSTFiVm16cUw2NHVmWmZna0YvR0Q0MTdyQ0E5ZTk5dGY4VnpDUEhvVlB6amhQWGFWdjEwZDViYmx6Q3laRTZuRElKNXBLZGUydS9FZ3o0ODdDcDF6SGxIcjIwaDhvdHA1MEVUVDJXZ2FlTDdkQ2UydmNGL3VPUXFVc3JBOXo3ZW1nSFEzdGhkRVpMTHBlTDBrSFl3cTdCcmRxakF2Mm9mRUFubFUwRVphUGp2VFRnSGRXbHZYZUVobll1MFZrdVVvTjc3MDd0Ylc2WDM1b2ljaXljNkM0eVp4bWF4UGYyYlRxMHo1VmZUby9JQzgvMjBNNUdabkFIeTVKek83VHZqODViQ0tsRXp5SXpkUWR2TE54ZjBMNHdtTVFqTWdubWVtbEhadWJPQmNRWHF2YjBDTzBqazcyMG8zT21JZGhQVGxmdDRGVHJ0aDVqdTU1dEs4YmJxL1lHK2VtVWlMenFUQy90Nkx6MWNZb1lid2kwcjQ3UWlzVHowajJ3MHhFNm5neFdKVmVMZHJEK1d4Q1pWeDNKOWJhMFFOZUFuajlUL3R3dU9pODdHY0Y5cExTZEtNOFU3UTJyVjYrTzBqY1FNb1hKSkIydDk2dHpvcnpCOTlZMk56ZlBqZFFMOXpMSlpESnludzJZSzg1cnZaMWt1OUNqdXErNHhYa25iNEpzK1h4VS9Xc1E1d25lYzdMbERjbjZkNTQ0UCtkZExGdSt6bFQvVm9yenhkNWsyZklKcWZxM1RKd25leS9MbHMrUkdCd25pUFBMM2c2eTVhT1dCc3RXY2Q3Qm15cGJMamhTLzFMaVBOV1RUVE1XQmlrMDJtaWpUV2lqVFdpampUYkZWVHVaVHFTVFJXOE9VenFKZHBHeXhUODltVTJFTFl2MjVrTzQrTHZueVVUNGttajNMVjM4WXpqcEdtaW4zZFJlSW0ycEY5QmxVK0xtTURtbnJkQmJVbnRRamUwdHJqMm81bTJGUGxCaVRXS1FRbTlSN2NHMDNuWkFleENGTnRwb0U5cG9FOXBvbzAxb28wMW9vMDFvbzQwMjFWVDdNeElVQmlrMDJtaWpUZUcxRDVhZ01FaWgwVVliYlVJYmJVSWJiYlFKYmJRSmJiUUpiYlRScGxwcGYxcUN3aUNGUmh0dHRDbTg5bHdKQ29NVUdtMjAwU2EwMFNhMDBVYWIwRWFiMEVhYjBFWTczdHFuUzFBWXBOQm9vNDAyaGRjK1ZJTENJSVZHRzIyMENXMjBDVzIwMFNhMDBTYTAwYVlDOUdrU0ZBWXBOTnBvbzAxb1IwdjdiUklVQmlrMDJtaWpUV2lqVFdpampUYWhqVGFoN2JMMmh5VW9ERkpvdE5GR205QkdtMHBwdjBPQ3dpQ0ZSaHR0dEFsdHRBbHR0TkVtdE9PaGZid0VoVUVLalRiYWFCUGFhQlBhTG1pL1Q0TENJSVZHRzIyMENXMjBDVzIwMGFiNmFTK1VvREJJb2RGR0cyMUNHMjFDMndYdDR5UW9ERkpvdE5GR205QkdtOUJHZTdCcEw1S2dNRWloMFVZYmJVSWJiVUxiQmUwUFNGQVlwTkJvbzQwMm9ZMDJvWTMyWU5QK29BU0ZRUXFOTnRwb0U5cG9FOXBvRHpidGowaFFHS1RRYUtPTk5xR05OcFhTL3FrRWhVRUtmWXdFaFVFS2pUYmFhQlBhYUJQYWFBODI3WTlMVUJpazBHaWpqVGFoSFMzdG4wbFFHS1RRQ3lRb0RGSm90TkZHbTlCR205QkdHMjJxbi9hbkpDZ01VbWkwMFVhYndtdi9SSUxDSUlWdWtLQXdTS0hSUmh0dFFodHRRaHR0dEtsKzJwK1VvREJJb2RGR0cyMEtyLzA5Q1FxREZQbzlFaFFHS1RUYWFLTk5hS05OYUtPTk50VlArN01TRkFZcE5OcG9vMDNodFkrVW9EQklvZEZHRzIxQ0cyMUNHMjIwQ2UxNGFIOWVnc0lnaFVZYjdiaHEvMXFDd2lDRlBseUN3aUNGUmh0dHRBbHR0QWx0dE5FbXROR21TclYvS1VGaGtFTC9Rb0xDSUlVZUprRmhrRUtqalRiYWhEYmFoRGJhYUJQYWFGT2wycitWb0RCSW9YOGxRV0dRUWg4bVFXR1FRcU9OTnRxRU50cUVOdHBvRTlwb0U5b3VhLzlBZ3NJZ2hmNitCSVZCQ3IydEJJVkJDbzAyMm1nVDJtZ1QybWlqVFdpalRXaTdyUDFEQ1FxREZQcXRFaFFHS1RUYWFLTk5hS05OYUtPTk5xR05OcUh0c3ZhUEpDZ01VdWp0SkNnTVVtaTAwVWFiMEVhYjBFWWJiVUliYlVJYmJTcEF2MFdDd2lDRlJodHR0QWx0dEFsdHRORW10TkVtdEYzVy9ya0VoVUVLdlZLQ3dpQ0ZmcnNFaFVFS2pUYmFhQlBhYUJQYWFLTk5hS05OYUx1c1BVNkN3aUNGZnFjRWhVRUtqVGJhYUJQYWFCUGFhS05OYU1kRCsxc1NGQVlwTk5xVzJrc2xLQXhTYUxRdHRkOHJRV0dRUXFPTk50cUVOdHFFTnRwb1UvMjB2eVpCWVpCQ28yMnB2VXlDd2lDRlJ0dFMrOTBTRkFZcE5OcG9vMDFvbzAxb280MDIxVS83MnhJVUJpazAycGJhWDVLZ01FaWgwVVk3cnRydmtxQXdTS0hSUmh0dFFodHRRaHR0dEtsKzJqK1dvREJJb2MrUW9EQklvZEZHRzIwS3IvMGFDUXFERkJwdHRORW10TkVtdE5GR20rcW5mWW9FaFVFS2pUYmFhQlBhMGRMK2tBU0ZRUXFOTnRwb0U5cG9FOW91YUg5VmdzSWdoVWJiVXZ0VUNRcURGQnB0dE5FbXRLT2wvVEVKQ29NVUdtMjAwU2EwMGFaUzJ0K1ZvREJJb2RHMjFENVJnc0lnaFVZYmJiUUpiYlNwbFBaSEpTZ01VbWkwMFVhYjBFYWJTbWwvUllMQ0lJVkcyMUw3SkFrS2d4UWFiYlRSSnJUUnBsTGFyNU9nTUVpaDBVWWJiVUliYlVMYkJlMzNTMUFZcE5Cb280MDJvWTAyb1kzMllOUCtoQVNGUVFxTk50cG9FOXJSMHY2R0JJVkJDbzIycGZheEVoUUdLVFRhYUtOTmFLTk5hS005MkxSZkswRmhrRUtqalRiYWhEYmFWRXI3YUFrS2d4UWFiYlRSSnJUUkpyVFJScHZxcC8wRkNRcURGQnB0dE9PcS9VMEpDb01VR20xTDdhTWtLQXhTYUxUUlJwdlFScHZRUmh0dFFqc2UycStYb0RCSW9kRkdHMjFDTzFyYTh5VW9ERkpvdE5GR205QkdtOUJHRzIxQ0cyMnFWUHM3RWhRR0tUVGFsdHBmbHFBd1NLSFJSanV1MmtkSVVCaWswR2lqalRhaGpUYWhqVGJhaERiYVZLbjJHeVFvREZKb3RORkdtOEpyRDVHZ01FaWgwVVliYlVJYmJVSWJiYlFKYmJRSmJiU3BBUDFGQ1FxREZCcHR0TkdtOE5yekpDZ01VbWkwMFVhYjBFYWIwRVliYlVJYmJVSWJiVUxiWHZ0ekVoUUdLVFRhYU1kVit4QUpDb01VR20yMDBTYTAwU2EwMFVhYjBFYWIwRWFiMEVZNzN0cGZsNkF3U0tIUnR0UStTSUxDSUlWR0cyMjBDVzIwQ1cyMDBTYTAwU2EwMFNhMDBVYWJhcVY5dGdTRlFRcU50cVgyYnlRb0RGTG80UklVQmlrMDJtaWpUV2lqVFdpampUYWhqVGFoalRaRlZUdVZ5bVF5cVJUYTlTNlR6R2NUbmFXeitWd0s3VHFWeXljMkw1dE1vVjM3NlNPWlRwUW9tNHVPOWxtUys5YjVSSCtsbytDdDBGSFFUaVlHS3B0Q3UwYTd4ajV6U0RxZHptYlRmU2VXWkNTMEQ1QWlNN0RUK1Z5bWUzckpKTE1SR3Q0SzdicDJEOUI4cHNqT3M4ZjlHYlJEN2g2N01Vc3Q5VExkRDhtaEhRcTdhM2JPOXpOUDVDSXhlYnV2blM1djFIWXZFSE5vaDU2ejh3UHVBSFB1ejkydWErY3JtQis2dUZOb1YzZGVwS0xKdVBQUmFiU3Iya05XdU9mcmZId2U3ZW9uN1dURi95OWswSzUySHNsVy9wUTAydFV1L2lyYTZTVmRYblc3ckoyc2F2MmNkbmh3dTZ5ZHJuZ2UwYU40aHdlM3c5cTVLbmQ0ZVhjSHQ4UGEyU29YY3hsM2x5WHVhcWVxUnNzN3UrWjJWenRaMWF6ZFkzQzdxbjJtNU9oRVV0VUp2YlNyVTRsQ082a2Q0Z1JUM3RWVmliUGFtYW9ua25EUEhaemF5VERqMDlXSlc2SG5TSzY5c0h5WTkySFNqcDdtVm1nWHRiTmg5blJaUjNlVHptcUhHcDU1UjkrZ1JCdnRzRHU2cEtOTFFMVFJSanQ2ODdhajJrZkpwcFc5Wk4xckZlZmxhdTZhZGh6WDI2MDZoelRLZGdYSGtuWHZXSEZ1OUdiSjltak9rOVM5bzhWNWxqZTJNSjg0VlJ6UEFTNFg1N0hlYU5tdWNYTUpHS3Z6MjJ2RWViUTNSYmJ6WEh0cE1YenZacDQ0VC9IdWthMXpsODJONGZ1U0I0bnpQZDdqc25YdWJlQVl2dWQrZ0RnLzd2bmpIRnh3eCsvekpNRnllNXp2K2J2TG4vTmRlM0d4KzZ6VWZGSGVYYlFuTFY2OCtBSG5YbDNjUGdmNGdDaFBFdTFSOHFkNzM3Mk8yMmRjenhMbFVhTHQvMWwrYUhWMGNNZmw4OXV0WXZ4dlA5QitRWDY2emJuWEY2L3ZKdHdteHJ1cjl2bnlrNE1YODQvVjkyN08xbWs3MEg3bUhNbTlxU1JPM3lsckRZaWZVVzMvQ3ZseGplZnFYQktINzB1dUVlRXIvSUwycEphV0ZoZS9EVkxWZDRHZC9QN2VBU0k4cVVQNzZZVDhzdHpCRjFuRjk5eWR2S3pBY3ZGTlBOMmg3ZDhzdjdsNDRiUlV4ZGR3Y1BQTGU4UEY5MmEvVTN1TS9OYXl5bW51S0YrZlpGWEFPNlpMMjMvQzBjRWRqMnZ2QkVQN0NiOWJlMktMb3pOM0hLNHJGY3phTFJON2FQdXZPcm9zOFdKd3piUmdRZktxMzFON1JPQy94czFYdS9uMUFMTlJ1aDdna0lEMjNsN2EvcDV5MDV4alBmZUhkOVN1ZGJsaWpzaSs2UGZXdmpBcE56cjd6M3BHK0RxdUI0bnJqRzM2YVB1L2QzZ3U4YUo3amVJMUFldGVmbDl0L3dWWEY5MWR5K3BpQXp6dDl2VzNkYW45TjM5ejdjZE9EZFlsclM2LzlzaGRXNzQxV0krYytsZ1JiZi81RmxlUGNmcE1LdEg1ZHhPQzQ1cVc1LzFpMnY3STRMNDJqMnBWV3dBNjBpK3U3WThON2wySFVvMWFGM0NPOVV0cGI3VmJjUDhRbkdwM1dMUGJWaVcxL1V2MmdidW0yUHRjNHBmVzl2L1pHRHhtSGxhaG14ZEFOdDdyOTZmdC8wKzUyMXZoQ3JmMGExZnMvL3I5YS91M3pqaFp1bW9GWW1GT2psd1ZJTTY0MVI5STIzOWxkdkRJeGNzeHE3cmxpd1BDMmEvNEEydjdEMTRiUFBia05tYVRLbWVSTnZXNzlrRy9IRzNmbjZ3UFA1UGhYZFhBUGxQMUpoZURMYXJ0WDZsUE9QbHNadStLWit6MkF0MlZmdm5hL3BqZFR0Q1lUaXFjUkFwc1Y2ejNLOUgyL2ZHRjU1M1R4dmd1ZTF5M25WTkFHMThLdGFTMlAySmE0YWtudEROL2x6VmZ0M2Q0dlhHRVg3bTI3KzgxcStQNU43YXRRclBmVnJYZDJHRTFhNjkrUlB2VGxyM2xIZnQxMU5KK0JGTktpUW5raVBhV1RxWTcvdGl2Wi8vYXZuLys3UDI2YWhsK3lKRDVxMWEwc3VmVVBXTHJpbFh6aHh3eXZLVWJhUGI1QTJnT3BDM3o5NTZOKzlIQU5lMDVZa0RMZ2JXbGgwZk9RTFBmWm94OHVCeklzclNsQzZaY2ozZ0o2ZXVuWEZDbVlybmFRV3RIVExwaDdFT05yZXNRbHRhMU5qNDA5b1pKSTlaV0lQaC9BUVlBMndoeldsQTlSL2NBQUFBQVNVVk9SSzVDWUlJPVxcJyk7IGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7IGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjsgYmFja2dyb3VuZC1zaXplOiBjb3ZlcjsgfSByZy1waG9uZS1zaW0gLnNjcmVlbixbcmlvdC10YWc9XCJyZy1waG9uZS1zaW1cIl0gLnNjcmVlbiB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAxMDVweDsgbGVmdDogMjJweDsgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7IHdpZHRoOiAzMjBweDsgaGVpZ2h0OiA1NjhweDsgYm9yZGVyOiAwOyB9JyxcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5vbihcIm1vdW50XCIsZnVuY3Rpb24oKXtlLlJnUGhvbmVTaW09dC5waG9uZXNpbXx8bmV3IFJnUGhvbmVTaW0odCk7ZS5SZ1Bob25lU2ltLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7ZS51cGRhdGUoKX0pfSxcInsgfVwiKTtyaW90LnRhZzIoXCJyZy1wbGFjZWhvbGRpdFwiLCc8aW1nIHJpb3Qtc3JjPVwiaHR0cHM6Ly9wbGFjZWhvbGRpdC5pbWdpeC5uZXQvfnRleHQ/Ymc9e1JnUGxhY2Vob2xkaXQuYmFja2dyb3VuZH0mdHh0Y2xyPXtSZ1BsYWNlaG9sZGl0LmNvbG9yfSZ0eHQ9e1JnUGxhY2Vob2xkaXQudGV4dH0mdHh0c2l6ZT17UmdQbGFjZWhvbGRpdC50ZXh0c2l6ZX0mdz17UmdQbGFjZWhvbGRpdC53aWR0aH0maD17UmdQbGFjZWhvbGRpdC5oZWlnaHR9JmZtPXtSZ1BsYWNlaG9sZGl0LmZvcm1hdH1cIj4nLFwiXCIsXCJcIixmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ1BsYWNlaG9sZGl0PXQucGxhY2Vob2xkaXR8fG5ldyBSZ1BsYWNlaG9sZGl0KHQpO2UuUmdQbGFjZWhvbGRpdC5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2UudXBkYXRlKCl9KX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctcmF3XCIsXCI8c3Bhbj48L3NwYW4+XCIsXCJcIixcIlwiLGZ1bmN0aW9uKHQpe3RoaXMub24oXCJtb3VudCB1cGRhdGVcIixmdW5jdGlvbigpe3RoaXMucm9vdC5pbm5lckhUTUw9dC5jb250ZW50fHxcIlwifSl9KTtyaW90LnRhZzIoXCJyZy1zZWxlY3RcIiwnPGRpdiBjbGFzcz1cImNvbnRhaW5lciB7dmlzaWJsZTogUmdTZWxlY3QuaXN2aXNpYmxlfVwiIHJpb3Qtc3R5bGU9XCJ3aWR0aDoge3dpZHRofVwiPiA8aW5wdXQgaWY9XCJ7IVJnU2VsZWN0LmF1dG9jb21wbGV0ZX1cIiB0eXBlPVwidGV4dFwiIG5hbWU9XCJzZWxlY3RmaWVsZFwiIGNsYXNzPVwiZmllbGQge3Zpc2libGU6IFJnU2VsZWN0LmlzdmlzaWJsZX1cIiB2YWx1ZT1cIntmaWVsZFRleHR9XCIgcGxhY2Vob2xkZXI9XCJ7UmdTZWxlY3QucGxhY2Vob2xkZXJ9XCIgb25rZXlkb3duPVwie2hhbmRsZUtleXN9XCIgb25jbGljaz1cInt0b2dnbGV9XCIgcmVhZG9ubHk+IDxpbnB1dCBpZj1cIntSZ1NlbGVjdC5hdXRvY29tcGxldGV9XCIgdHlwZT1cInRleHRcIiBuYW1lPVwiYXV0b2NvbXBsZXRlZmllbGRcIiBjbGFzcz1cImZpZWxkIHt2aXNpYmxlOiBSZ1NlbGVjdC5pc3Zpc2libGV9XCIgdmFsdWU9XCJ7ZmllbGRUZXh0fVwiIHBsYWNlaG9sZGVyPVwie1JnU2VsZWN0LnBsYWNlaG9sZGVyfVwiIG9ua2V5ZG93bj1cIntoYW5kbGVLZXlzfVwiIG9uY2xpY2s9XCJ7dG9nZ2xlfVwiIG9uaW5wdXQ9XCJ7ZmlsdGVyfVwiPiA8ZGl2IGNsYXNzPVwiZHJvcGRvd24ge2lzdmlzaWJsZTogUmdTZWxlY3QuaXN2aXNpYmxlfSB7ZW1wdHk6IFJnU2VsZWN0LmZpbHRlcmVkaXRlbXMubGVuZ3RoID09IDB9XCI+IDxkaXYgY2xhc3M9XCJmaWx0ZXJcIiBpZj1cIntSZ1NlbGVjdC5oYXNmaWx0ZXIgJiYgIVJnU2VsZWN0LmF1dG9jb21wbGV0ZX1cIj4gPGlucHV0IHR5cGU9XCJ0ZXh0XCIgbmFtZT1cImZpbHRlcmZpZWxkXCIgY2xhc3M9XCJmaWx0ZXItYm94XCIgcGxhY2Vob2xkZXI9XCJ7UmdTZWxlY3QuZmlsdGVycGxhY2Vob2xkZXIgfHwgXFwnRmlsdGVyXFwnfVwiIG9ua2V5ZG93bj1cIntoYW5kbGVLZXlzfVwiIG9uaW5wdXQ9XCJ7ZmlsdGVyfVwiPiA8L2Rpdj4gPHVsIGNsYXNzPVwibGlzdCB7ZW1wdHk6IFJnU2VsZWN0LmZpbHRlcmVkaXRlbXMubGVuZ3RoID09IDB9XCI+IDxsaSBlYWNoPVwie1JnU2VsZWN0LmZpbHRlcmVkaXRlbXN9XCIgb25jbGljaz1cIntwYXJlbnQuc2VsZWN0fVwiIGNsYXNzPVwiaXRlbSB7c2VsZWN0ZWQ6IHNlbGVjdGVkLCBkaXNhYmxlZDogZGlzYWJsZWQsIGFjdGl2ZTogYWN0aXZlfVwiPiB7dGV4dH0gPC9saT4gPC91bD4gPC9kaXY+IDwvZGl2PicsJ3JnLXNlbGVjdCAuY29udGFpbmVyLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuY29udGFpbmVyIHsgcG9zaXRpb246IHJlbGF0aXZlOyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGN1cnNvcjogcG9pbnRlcjsgfSByZy1zZWxlY3QgLmZpZWxkLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuZmllbGQgeyB3aWR0aDogMTAwJTsgcGFkZGluZzogMTBweDsgYm9yZGVyOiAxcHggc29saWQgI0QzRDNEMzsgYm94LXNpemluZzogYm9yZGVyLWJveDsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgb3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7IGZvbnQtc2l6ZTogMWVtOyBsaW5lLWhlaWdodDogbm9ybWFsOyBvdXRsaW5lOiAwOyAtd2Via2l0LWFwcGVhcmFuY2U6IG5vbmU7IC1tb3otYXBwZWFyYW5jZTogbm9uZTsgYXBwZWFyYW5jZTogbm9uZTsgfSByZy1zZWxlY3QgLmRyb3Bkb3duLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuZHJvcGRvd24geyBkaXNwbGF5OiBub25lOyBwb3NpdGlvbjogYWJzb2x1dGU7IHdpZHRoOiAxMDAlOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNEM0QzRDM7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IG92ZXJmbG93LXk6IGF1dG87IG92ZXJmbG93LXg6IGhpZGRlbjsgbWF4LWhlaWdodDogMjgwcHg7IHotaW5kZXg6IDEwOyB9IHJnLXNlbGVjdCAuZHJvcGRvd24uaXN2aXNpYmxlLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuZHJvcGRvd24uaXN2aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctc2VsZWN0IC5kcm9wZG93bi5lbXB0eSxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLmRyb3Bkb3duLmVtcHR5IHsgYm9yZGVyLWJvdHRvbTogMDsgfSByZy1zZWxlY3QgLmZpbHRlci1ib3gsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5maWx0ZXItYm94IHsgd2lkdGg6IDEwMCU7IHBhZGRpbmc6IDEwcHg7IGZvbnQtc2l6ZTogMC45ZW07IGJvcmRlcjogMDsgYm9yZGVyLWxlZnQ6IDFweCBzb2xpZCAjRDNEM0QzOyBib3JkZXItcmlnaHQ6IDFweCBzb2xpZCAjRDNEM0QzOyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI0U4RThFODsgb3V0bGluZTogbm9uZTsgY29sb3I6ICM1NTU7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH0gcmctc2VsZWN0IC5saXN0LFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAubGlzdCxyZy1zZWxlY3QgLml0ZW0sW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5pdGVtIHsgbGlzdC1zdHlsZTogbm9uZTsgcGFkZGluZzogMDsgbWFyZ2luOiAwOyB9IHJnLXNlbGVjdCAubGlzdC5lbXB0eSxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLmxpc3QuZW1wdHkgeyBkaXNwbGF5OiBub25lOyB9IHJnLXNlbGVjdCAuaXRlbSxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLml0ZW0geyBwYWRkaW5nOiAxMHB4OyBib3JkZXItbGVmdDogMXB4IHNvbGlkICNEM0QzRDM7IGJvcmRlci1yaWdodDogMXB4IHNvbGlkICNEM0QzRDM7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjRThFOEU4OyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpczsgfSByZy1zZWxlY3QgLml0ZW06Zmlyc3QtY2hpbGQsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5pdGVtOmZpcnN0LWNoaWxkIHsgYm9yZGVyLXRvcDogMDsgfSByZy1zZWxlY3QgLnNlbGVjdGVkLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuc2VsZWN0ZWQgeyBmb250LXdlaWdodDogYm9sZDsgYmFja2dyb3VuZC1jb2xvcjogI2Y4ZjhmODsgfSByZy1zZWxlY3QgLml0ZW06aG92ZXIsW3Jpb3QtdGFnPVwicmctc2VsZWN0XCJdIC5pdGVtOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogI2YzZjNmMzsgfSByZy1zZWxlY3QgLml0ZW0uYWN0aXZlLFtyaW90LXRhZz1cInJnLXNlbGVjdFwiXSAuaXRlbS5hY3RpdmUscmctc2VsZWN0IC5pdGVtOmhvdmVyLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy1zZWxlY3RcIl0gLml0ZW06aG92ZXIuYWN0aXZlIHsgYmFja2dyb3VuZC1jb2xvcjogI2VkZWRlZDsgfScsXCJcIixmdW5jdGlvbih0KXtcbnZhciBlPXRoaXM7dmFyIGk9ZnVuY3Rpb24gbyh0KXtpZighZS5yb290LmNvbnRhaW5zKHQudGFyZ2V0KSl7ZS5SZ1NlbGVjdC5jbG9zZSgpO2UudXBkYXRlKCl9fTt0aGlzLmhhbmRsZUtleXM9ZnVuY3Rpb24odCl7aWYoWzEzLDM4LDQwXS5pbmRleE9mKHQua2V5Q29kZSk+LTEmJiFlLlJnU2VsZWN0LmlzdmlzaWJsZSl7dC5wcmV2ZW50RGVmYXVsdCgpO2UudG9nZ2xlKCk7cmV0dXJuIHRydWV9aWYoZS5SZ1NlbGVjdC5hdXRvY29tcGxldGUmJiFlLlJnU2VsZWN0LmlzdmlzaWJsZSllLnRvZ2dsZSgpO3ZhciBpPWUuUmdTZWxlY3QuZmlsdGVyZWRpdGVtcy5sZW5ndGg7aWYoaT4wJiZbMTMsMzgsNDBdLmluZGV4T2YodC5rZXlDb2RlKT4tMSl7dC5wcmV2ZW50RGVmYXVsdCgpO3ZhciBvPW51bGw7Zm9yKHZhciBuPTA7bjxpO24rKyl7dmFyIHI9ZS5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW25dO2lmKHIuYWN0aXZlKXtvPW47YnJlYWt9fWlmKG8hPW51bGwpZS5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW29dLmFjdGl2ZT1mYWxzZTtpZih0LmtleUNvZGU9PTM4KXtpZihvPT1udWxsfHxvPT0wKWUuUmdTZWxlY3QuZmlsdGVyZWRpdGVtc1tpLTFdLmFjdGl2ZT10cnVlO2Vsc2UgZS5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW28tMV0uYWN0aXZlPXRydWV9ZWxzZSBpZih0LmtleUNvZGU9PTQwKXtpZihvPT1udWxsfHxvPT1pLTEpZS5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zWzBdLmFjdGl2ZT10cnVlO2Vsc2UgZS5SZ1NlbGVjdC5maWx0ZXJlZGl0ZW1zW28rMV0uYWN0aXZlPXRydWV9ZWxzZSBpZih0LmtleUNvZGU9PTEzJiZvIT1udWxsKXtlLnNlbGVjdCh7aXRlbTplLlJnU2VsZWN0LmZpbHRlcmVkaXRlbXNbb119KX19cmV0dXJuIHRydWV9O3RoaXMudG9nZ2xlPWZ1bmN0aW9uKCl7ZS5SZ1NlbGVjdC50b2dnbGUoKX07dGhpcy5maWx0ZXI9ZnVuY3Rpb24oKXt2YXIgdD1lLmZpbHRlcmZpZWxkLnZhbHVlO2lmKGUuUmdTZWxlY3QuYXV0b2NvbXBsZXRlKXQ9ZS5hdXRvY29tcGxldGVmaWVsZC52YWx1ZTtlLlJnU2VsZWN0LmZpbHRlcih0KX07dGhpcy5zZWxlY3Q9ZnVuY3Rpb24odCl7dD10Lml0ZW07ZS5SZ1NlbGVjdC5zZWxlY3QodCl9O3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ1NlbGVjdD10LnNlbGVjdHx8bmV3IFJnU2VsZWN0KHQpO2UuUmdTZWxlY3Qub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2lmKGUuUmdTZWxlY3QuaXN2aXNpYmxlKWUuZmlsdGVyKCk7ZS51cGRhdGUoKX0pO2UuUmdTZWxlY3Qub24oXCJzZWxlY3RcIixmdW5jdGlvbih0KXtlLnNlbGVjdGZpZWxkLnZhbHVlPXRbZS5SZ1NlbGVjdC5maWx0ZXJvbl07ZS5hdXRvY29tcGxldGVmaWVsZC52YWx1ZT10W2UuUmdTZWxlY3QuZmlsdGVyb25dO2UudXBkYXRlKCl9KTtkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIixpKTtlLmZpbHRlcigpO2UudXBkYXRlKCl9KTt0aGlzLm9uKFwidW5tb3VudFwiLGZ1bmN0aW9uKCl7ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsaSl9KX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctc2lkZW1lbnVcIiwnPHJnLWRyYXdlciBkcmF3ZXI9XCJ7UmdTaWRlbWVudX1cIj4nLCdyZy1zaWRlbWVudSAub3ZlcmxheSxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAub3ZlcmxheSB7IGJhY2tncm91bmQtY29sb3I6IHJnYmEoMCwgMCwgMCwgMC44KTsgfSByZy1zaWRlbWVudSAub3ZlcmxheS52aXNpYmxlLFtyaW90LXRhZz1cInJnLXNpZGVtZW51XCJdIC5vdmVybGF5LnZpc2libGUgeyBkaXNwbGF5OiBibG9jazsgfSByZy1zaWRlbWVudSAuZHJhd2VyLFtyaW90LXRhZz1cInJnLXNpZGVtZW51XCJdIC5kcmF3ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiBibGFjazsgY29sb3I6IHdoaXRlOyB9IHJnLXNpZGVtZW51IC5oZWFkZXIsW3Jpb3QtdGFnPVwicmctc2lkZW1lbnVcIl0gLmhlYWRlciB7IGNvbG9yOiB3aGl0ZTsgfSByZy1zaWRlbWVudSAuaXRlbSxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAuaXRlbSB7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjMWExYTFhOyBjb2xvcjogd2hpdGU7IH0gcmctc2lkZW1lbnUgLml0ZW06bGFzdC1jaGlsZCxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAuaXRlbTpsYXN0LWNoaWxkIHsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICMxYTFhMWE7IH0gcmctc2lkZW1lbnUgLml0ZW06aG92ZXIsW3Jpb3QtdGFnPVwicmctc2lkZW1lbnVcIl0gLml0ZW06aG92ZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjMmEyYTJhOyB9IHJnLXNpZGVtZW51IC5pdGVtLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy1zaWRlbWVudVwiXSAuaXRlbS5hY3RpdmUgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjNDQ0OyB9JyxcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5vbihcIm1vdW50XCIsZnVuY3Rpb24oKXtlLlJnU2lkZW1lbnU9dC5zaWRlbWVudXx8bmV3IFJnU2lkZW1lbnUodCk7ZS5SZ1NpZGVtZW51LnBvc2l0aW9uPVwibGVmdFwiO2UuUmdTaWRlbWVudS5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7ZS51cGRhdGUoKX0pO2UudXBkYXRlKCl9KX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctdGFic1wiLCc8ZGl2IGNsYXNzPVwiaGVhZGVyc1wiPiA8ZGl2IGVhY2g9XCJ7UmdUYWJzLnRhYnN9XCIgY2xhc3M9XCJoZWFkZXIge2FjdGl2ZTogYWN0aXZlLCBkaXNhYmxlZDogZGlzYWJsZWR9XCIgb25jbGljaz1cIntwYXJlbnQuc2VsZWN0fVwiPiA8ZGl2IGNsYXNzPVwiaGVhZGluZ1wiIGlmPVwie2hlYWRpbmd9XCI+IDxyZy1yYXcgY29udGVudD1cIntoZWFkaW5nfVwiPjwvcmctcmF3PiA8L2Rpdj4gPC9kaXY+IDwvZGl2PiA8ZGl2IGVhY2g9XCJ7UmdUYWJzLnRhYnN9XCIgY2xhc3M9XCJ0YWIge2FjdGl2ZTogYWN0aXZlfVwiPiA8ZGl2IGlmPVwie3JnLmlzRGVmaW5lZChjb250ZW50KX1cIj4ge2NvbnRlbnR9IDwvZGl2PiA8ZGl2IGlmPVwie3JnLmlzRGVmaW5lZChpbmNsdWRlKX1cIj4gPHJnLWluY2x1ZGUgaW5jbHVkZT1cIntpbmNsdWRlfVwiPjwvcmctaW5jbHVkZT4gPC9kaXY+IDwvZGl2PicsJ3JnLXRhYnMgLmhlYWRlcnMsW3Jpb3QtdGFnPVwicmctdGFic1wiXSAuaGVhZGVycyB7IGRpc3BsYXk6IC13ZWJraXQtZmxleDsgZGlzcGxheTogLW1zLWZsZXhib3g7IGRpc3BsYXk6IGZsZXg7IH0gcmctdGFicyAuaGVhZGVyLFtyaW90LXRhZz1cInJnLXRhYnNcIl0gLmhlYWRlciB7IC13ZWJraXQtZmxleDogMTsgLW1zLWZsZXg6IDE7IGZsZXg6IDE7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IHRleHQtYWxpZ246IGNlbnRlcjsgY3Vyc29yOiBwb2ludGVyOyBib3gtc2hhZG93OiAwIC0xcHggMCAwICMwMDAgaW5zZXQ7IH0gcmctdGFicyAuaGVhZGluZyxbcmlvdC10YWc9XCJyZy10YWJzXCJdIC5oZWFkaW5nIHsgcGFkZGluZzogMTBweDsgbWFyZ2luOiAwOyB9IHJnLXRhYnMgLmhlYWRlci5hY3RpdmUsW3Jpb3QtdGFnPVwicmctdGFic1wiXSAuaGVhZGVyLmFjdGl2ZSB7IGJhY2tncm91bmQtY29sb3I6ICMwMDA7IH0gcmctdGFicyAuaGVhZGVyLmFjdGl2ZSAuaGVhZGluZyxbcmlvdC10YWc9XCJyZy10YWJzXCJdIC5oZWFkZXIuYWN0aXZlIC5oZWFkaW5nIHsgY29sb3I6IHdoaXRlOyB9IHJnLXRhYnMgLmhlYWRlci5kaXNhYmxlZCAuaGVhZGluZyxbcmlvdC10YWc9XCJyZy10YWJzXCJdIC5oZWFkZXIuZGlzYWJsZWQgLmhlYWRpbmcgeyBjb2xvcjogIzg4ODsgfSByZy10YWJzIC50YWIsW3Jpb3QtdGFnPVwicmctdGFic1wiXSAudGFiIHsgZGlzcGxheTogbm9uZTsgcGFkZGluZzogMTBweDsgfSByZy10YWJzIC50YWIuYWN0aXZlLFtyaW90LXRhZz1cInJnLXRhYnNcIl0gLnRhYi5hY3RpdmUgeyBkaXNwbGF5OiBibG9jazsgfScsXCJcIixmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ1RhYnM9dC50YWJzfHxuZXcgUmdUYWJzKHQpO2UuUmdUYWJzLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7ZS51cGRhdGUoKX0pO3RoaXMuc2VsZWN0PWZ1bmN0aW9uKHQpe2UuUmdUYWJzLnNlbGVjdCh0Lml0ZW0pfX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctdGFnc1wiLCc8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+IDxzcGFuIGNsYXNzPVwidGFnc1wiPiA8c3BhbiBjbGFzcz1cInRhZ1wiIGVhY2g9XCJ7UmdUYWdzLnRhZ3N9XCIgb25jbGljaz1cIntwYXJlbnQucmVtb3ZlVGFnfVwiPiB7dGV4dH0gPHNwYW4gY2xhc3M9XCJjbG9zZVwiPiZ0aW1lczs8L3NwYW4+IDwvc3Bhbj4gPC9zcGFuPiA8ZGl2IGNsYXNzPVwiZmllbGQtY29udGFpbmVyIHtpc3Zpc2libGU6IFJnVGFncy5pc3Zpc2libGV9XCI+IDxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwiZmllbGRcIiBuYW1lPVwiZmlsdGVyZmllbGRcIiBwbGFjZWhvbGRlcj1cIntSZ1RhZ3MucGxhY2Vob2xkZXJ9XCIgb25rZXlkb3duPVwie2hhbmRsZUtleXN9XCIgb25pbnB1dD1cIntmaWx0ZXJ9XCIgb25mb2N1cz1cInt0b2dnbGV9XCI+IDxkaXYgY2xhc3M9XCJkcm9wZG93biB7aXN2aXNpYmxlOiBSZ1RhZ3MuaXN2aXNpYmxlfVwiPiA8dWwgY2xhc3M9XCJsaXN0XCI+IDxsaSBlYWNoPVwie1JnVGFncy5maWx0ZXJlZGl0ZW1zfVwiIG9uY2xpY2s9XCJ7cGFyZW50LmFkZFRhZ31cIiBjbGFzcz1cIml0ZW0ge2Rpc2FibGVkOiBkaXNhYmxlZCwgYWN0aXZlOiBhY3RpdmV9XCI+IHt0ZXh0fSA8L2xpPiA8L3VsPiA8L2Rpdj4gPC9kaXY+IDwvZGl2PicsJ3JnLXRhZ3MgLmNvbnRhaW5lcixbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5jb250YWluZXIgeyBwb3NpdGlvbjogcmVsYXRpdmU7IHdpZHRoOiAxMDAlOyBib3JkZXI6IDFweCBzb2xpZCAjRDNEM0QzOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgdGV4dC1hbGlnbjogbGVmdDsgcGFkZGluZzogMDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfSByZy10YWdzIC5maWVsZC1jb250YWluZXIsW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAuZmllbGQtY29udGFpbmVyIHsgcG9zaXRpb246IGFic29sdXRlOyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGN1cnNvcjogcG9pbnRlcjsgfSByZy10YWdzIC5maWVsZCxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5maWVsZCB7IHdpZHRoOiAxMDAlOyBwYWRkaW5nOiAxMHB4OyBib3JkZXI6IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50OyB3aGl0ZS1zcGFjZTogbm93cmFwOyBmb250LXNpemU6IDFlbTsgbGluZS1oZWlnaHQ6IG5vcm1hbDsgb3V0bGluZTogMDsgLXdlYmtpdC1hcHBlYXJhbmNlOiBub25lOyAtbW96LWFwcGVhcmFuY2U6IG5vbmU7IGFwcGVhcmFuY2U6IG5vbmU7IH0gcmctdGFncyAuZHJvcGRvd24sW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAuZHJvcGRvd24geyBkaXNwbGF5OiBub25lOyBwb3NpdGlvbjogYWJzb2x1dGU7IHdpZHRoOiAxMDAlOyBiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNEM0QzRDM7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IG92ZXJmbG93LXk6IGF1dG87IG92ZXJmbG93LXg6IGhpZGRlbjsgbWF4LWhlaWdodDogMjgwcHg7IG1hcmdpbjogLTFweCAwIDAgLTFweDsgfSByZy10YWdzIC5kcm9wZG93bi5pc3Zpc2libGUsW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAuZHJvcGRvd24uaXN2aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0gcmctdGFncyAubGlzdCxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5saXN0LHJnLXRhZ3MgLml0ZW0sW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAuaXRlbSB7IGxpc3Qtc3R5bGU6IG5vbmU7IHBhZGRpbmc6IDA7IG1hcmdpbjogMDsgfSByZy10YWdzIC5saXN0LmVtcHR5LFtyaW90LXRhZz1cInJnLXRhZ3NcIl0gLmxpc3QuZW1wdHkgeyBkaXNwbGF5OiBub25lOyB9IHJnLXRhZ3MgLml0ZW0sW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAuaXRlbSB7IHBhZGRpbmc6IDEwcHg7IGJvcmRlci1sZWZ0OiAxcHggc29saWQgI0QzRDNEMzsgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgI0QzRDNEMzsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICNFOEU4RTg7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyB9IHJnLXRhZ3MgLml0ZW06Zmlyc3QtY2hpbGQsW3Jpb3QtdGFnPVwicmctdGFnc1wiXSAuaXRlbTpmaXJzdC1jaGlsZCB7IGJvcmRlci10b3A6IDA7IH0gcmctdGFncyAuaXRlbTpob3ZlcixbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5pdGVtOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogI2YzZjNmMzsgfSByZy10YWdzIC5pdGVtLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5pdGVtLmFjdGl2ZSxyZy10YWdzIC5pdGVtOmhvdmVyLmFjdGl2ZSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5pdGVtOmhvdmVyLmFjdGl2ZSB7IGJhY2tncm91bmQtY29sb3I6ICNlZGVkZWQ7IH0gcmctdGFncyAudGFncyxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC50YWdzIHsgZGlzcGxheTogaW5saW5lLWJsb2NrOyBtYXgtd2lkdGg6IDcwJTsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgb3ZlcmZsb3cteTogaGlkZGVuOyBvdmVyZmxvdy14OiBhdXRvOyAtd2Via2l0LXVzZXItc2VsZWN0OiBub25lOyAtbW96LXVzZXItc2VsZWN0OiBub25lOyAtbXMtdXNlci1zZWxlY3Q6IG5vbmU7IHVzZXItc2VsZWN0OiBub25lOyB9IHJnLXRhZ3MgLnRhZyxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC50YWcgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgcGFkZGluZzogOHB4IDIwcHggOHB4IDVweDsgbWFyZ2luOiAxcHg7IGJhY2tncm91bmQtY29sb3I6ICMwMDA7IGNvbG9yOiAjZmZmOyBmb250LXNpemU6IDFlbTsgbGluZS1oZWlnaHQ6IG5vcm1hbDsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLXRhZ3MgLnRhZzpob3ZlcixbcmlvdC10YWc9XCJyZy10YWdzXCJdIC50YWc6aG92ZXIscmctdGFncyAudGFnOmFjdGl2ZSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC50YWc6YWN0aXZlIHsgYmFja2dyb3VuZC1jb2xvcjogIzY2NjsgfSByZy10YWdzIC5jbG9zZSxbcmlvdC10YWc9XCJyZy10YWdzXCJdIC5jbG9zZSB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgcmlnaHQ6IDVweDsgdG9wOiA3cHg7IGNvbG9yOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuNyk7IH0nLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt2YXIgaT1mdW5jdGlvbiBvKHQpe2lmKCFlLnJvb3QuY29udGFpbnModC50YXJnZXQpKXtlLlJnVGFncy5jbG9zZSgpfX07dGhpcy5oYW5kbGVLZXlzPWZ1bmN0aW9uKHQpe2lmKFsxMywzOCw0MF0uaW5kZXhPZih0LmtleUNvZGUpPi0xJiYhZS5SZ1RhZ3MuaXN2aXNpYmxlKXt0LnByZXZlbnREZWZhdWx0KCk7ZS50b2dnbGUoKTtyZXR1cm4gdHJ1ZX1pZighZS5SZ1RhZ3MuaXN2aXNpYmxlKWUudG9nZ2xlKCk7dmFyIGk9ZS5SZ1RhZ3MuZmlsdGVyZWRpdGVtcy5sZW5ndGg7aWYoaT4wJiZbMTMsMzgsNDBdLmluZGV4T2YodC5rZXlDb2RlKT4tMSl7dC5wcmV2ZW50RGVmYXVsdCgpO3ZhciBvPW51bGw7Zm9yKHZhciBuPTA7bjxpO24rKyl7dmFyIHI9ZS5SZ1RhZ3MuZmlsdGVyZWRpdGVtc1tuXTtpZihyLmFjdGl2ZSl7bz1uO2JyZWFrfX1pZihvIT1udWxsKWUuUmdUYWdzLmZpbHRlcmVkaXRlbXNbb10uYWN0aXZlPWZhbHNlO2lmKHQua2V5Q29kZT09Mzgpe2lmKG89PW51bGx8fG89PTApZS5SZ1RhZ3MuZmlsdGVyZWRpdGVtc1tpLTFdLmFjdGl2ZT10cnVlO2Vsc2UgZS5SZ1RhZ3MuZmlsdGVyZWRpdGVtc1tvLTFdLmFjdGl2ZT10cnVlfWVsc2UgaWYodC5rZXlDb2RlPT00MCl7aWYobz09bnVsbHx8bz09aS0xKWUuUmdUYWdzLmZpbHRlcmVkaXRlbXNbMF0uYWN0aXZlPXRydWU7ZWxzZSBlLlJnVGFncy5maWx0ZXJlZGl0ZW1zW28rMV0uYWN0aXZlPXRydWV9ZWxzZSBpZih0LmtleUNvZGU9PTEzJiZvIT1udWxsKXtlLmFkZFRhZyh7aXRlbTplLlJnVGFncy5maWx0ZXJlZGl0ZW1zW29dfSl9fWlmKHQua2V5Q29kZT09MTMpe2UuYWRkVGFnKCl9ZWxzZSBpZih0LmtleUNvZGU9PTgmJmUuZmlsdGVyZmllbGQudmFsdWU9PVwiXCImJmUuUmdUYWdzLnRhZ3MubGVuZ3RoPjApe3ZhciBzPWUuUmdUYWdzLnRhZ3MucG9wKCk7ZS5maWx0ZXJmaWVsZC52YWx1ZT1zLnRleHR9cmV0dXJuIHRydWV9O3RoaXMudG9nZ2xlPWZ1bmN0aW9uKCl7ZS5maWx0ZXIoKTtlLlJnVGFncy50b2dnbGUoKX07dGhpcy5maWx0ZXI9ZnVuY3Rpb24oKXtlLlJnVGFncy5maWx0ZXIoZS5maWx0ZXJmaWVsZC52YWx1ZSl9O3RoaXMuYWRkVGFnPWZ1bmN0aW9uKHQpe3ZhciBpPXt0ZXh0OmUuZmlsdGVyZmllbGQudmFsdWV9O2lmKHQpaT10Lml0ZW07aWYoaS50ZXh0Lmxlbmd0aD4wKWUuUmdUYWdzLmFkZFRhZyhpKTtlLmZpbHRlcmZpZWxkLnZhbHVlPVwiXCJ9O3RoaXMucmVtb3ZlVGFnPWZ1bmN0aW9uKHQpe2UuUmdUYWdzLnJlbW92ZVRhZyh0Lml0ZW0pfTt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdUYWdzPXQudGFnc3x8bmV3IFJnVGFncyh0KTtlLlJnVGFncy5vbihcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7aWYoZS5SZ1RhZ3MuaXN2aXNpYmxlKWUuZmlsdGVyKCk7ZS51cGRhdGUoKX0pO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLGkpO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJmb2N1c1wiLGksdHJ1ZSk7ZS5maWx0ZXJmaWVsZC52YWx1ZT1lLlJnVGFncy52YWx1ZTtlLnVwZGF0ZSgpfSk7dGhpcy5vbihcInVubW91bnRcIixmdW5jdGlvbigpe2RvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLGkpO2RvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJmb2N1c1wiLGksdHJ1ZSl9KTt0aGlzLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtpZihlLmlzTW91bnRlZCl7dmFyIHQ9ZS5yb290LnF1ZXJ5U2VsZWN0b3IoXCIuY29udGFpbmVyXCIpO3ZhciBpPXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7dmFyIG89ZS5yb290LnF1ZXJ5U2VsZWN0b3IoXCIudGFnc1wiKTt2YXIgbj1vLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO28uc2Nyb2xsTGVmdD1OdW1iZXIuTUFYX1ZBTFVFO3ZhciByPWUucm9vdC5xdWVyeVNlbGVjdG9yKFwiLmZpZWxkLWNvbnRhaW5lclwiKTtyLnN0eWxlLndpZHRoPWktbitcInB4XCI7ZS5yb290LnF1ZXJ5U2VsZWN0b3IoXCIuY29udGFpbmVyXCIpLnN0eWxlLmhlaWdodD1yLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCtcInB4XCJ9fSl9LFwieyB9XCIpO3Jpb3QudGFnMihcInJnLXRpbWVcIiwnPHJnLXNlbGVjdCBzZWxlY3Q9XCJ7UmdUaW1lfVwiPjwvcmctc2VsZWN0PicsXCJcIixcIlwiLGZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dmFyIGk9ZnVuY3Rpb24gbygpe2UuUmdUaW1lLm9wdGlvbnM9W107Zm9yKHZhciB0PTA7dDwxNDQwO3QrKyl7aWYodCVlLlJnVGltZS5zdGVwPT0wKXt2YXIgaT1uZXcgRGF0ZSgwKTtpLnNldEhvdXJzKGUuUmdUaW1lLnRpbWUuZ2V0SG91cnMoKSk7aS5zZXRNaW51dGVzKGUuUmdUaW1lLnRpbWUuZ2V0TWludXRlcygpKTtpPW5ldyBEYXRlKGkuZ2V0VGltZSgpK3QqNmU0KTtpZihlLlJnVGltZS5taW4pe2lmKGkuZ2V0SG91cnMoKTxlLlJnVGltZS5taW5bMF0pY29udGludWU7aWYoaS5nZXRIb3VycygpPT1lLlJnVGltZS5taW5bMF0mJmkuZ2V0TWludXRlcygpPGUuUmdUaW1lLm1pblsxXSljb250aW51ZX1pZihlLlJnVGltZS5tYXgpe2lmKGkuZ2V0SG91cnMoKT5lLlJnVGltZS5tYXhbMF0pY29udGludWU7aWYoaS5nZXRIb3VycygpPT1lLlJnVGltZS5tYXhbMF0mJmkuZ2V0TWludXRlcygpPmUuUmdUaW1lLm1heFsxXSljb250aW51ZX12YXIgbz17aG91cnM6aS5nZXRIb3VycygpLG1pbnV0ZXM6aS5nZXRNaW51dGVzKCl9O3ZhciBuPW8ubWludXRlcztpZihuPDEwKW49XCIwXCIrbjtpZihlLlJnVGltZS5hbXBtKXt2YXIgcj1cImFtXCI7dmFyIHM9by5ob3VycztpZihzPj0xMil7cj1cInBtXCI7cz1zLTEyfWlmKHM9PTApcz0xMjtvLnRleHQ9cytcIjpcIituK1wiIFwiK3I7by5wZXJpb2Q9cn1lbHNle3ZhciBzPW8uaG91cnM7aWYoczwxMClzPVwiMFwiK3M7by50ZXh0PXMrXCI6XCIrbn1lLlJnVGltZS5vcHRpb25zLnB1c2gobyl9fX07dGhpcy5vbihcIm1vdW50XCIsZnVuY3Rpb24oKXtlLlJnVGltZT10LnRpbWV8fG5ldyBSZ1RpbWUodCk7ZS5SZ1RpbWUub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2koKTtlLnVwZGF0ZSgpfSk7aSgpO2UudXBkYXRlKCl9KX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctdG9hc3RzXCIsJzxkaXYgY2xhc3M9XCJ0b2FzdHMge1JnVG9hc3RzLnBvc2l0aW9ufSB7aXN2aXNpYmxlOiBSZ1RvYXN0cy5pc3Zpc2libGV9XCI+IDxkaXYgZWFjaD1cIntSZ1RvYXN0cy50b2FzdHN9XCIgY2xhc3M9XCJ0b2FzdCB7aXN2aXNpYmxlOiBpc3Zpc2libGV9XCIgb25jbGljaz1cIntwYXJlbnQudG9hc3RDbGlja2VkfVwiPiA8cmctcmF3IGNvbnRlbnQ9XCJ7Y29udGVudH1cIj48L3JnLXJhdz4gPC9kaXY+IDwvZGl2PicsJ3JnLXRvYXN0cyAudG9hc3RzLFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3RzIHsgZGlzcGxheTogbm9uZTsgcG9zaXRpb246IGZpeGVkOyB3aWR0aDogMjUwcHg7IG1heC1oZWlnaHQ6IDEwMCU7IG92ZXJmbG93LXk6IGF1dG87IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50OyB6LWluZGV4OiAxMDE7IH0gcmctdG9hc3RzIC50b2FzdHMuaXN2aXNpYmxlLFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3RzLmlzdmlzaWJsZSB7IGRpc3BsYXk6IGJsb2NrOyB9IHJnLXRvYXN0cyAudG9hc3RzLnRvcGxlZnQsW3Jpb3QtdGFnPVwicmctdG9hc3RzXCJdIC50b2FzdHMudG9wbGVmdCB7IHRvcDogMDsgbGVmdDogMDsgfSByZy10b2FzdHMgLnRvYXN0cy50b3ByaWdodCxbcmlvdC10YWc9XCJyZy10b2FzdHNcIl0gLnRvYXN0cy50b3ByaWdodCB7IHRvcDogMDsgcmlnaHQ6IDA7IH0gcmctdG9hc3RzIC50b2FzdHMuYm90dG9tbGVmdCxbcmlvdC10YWc9XCJyZy10b2FzdHNcIl0gLnRvYXN0cy5ib3R0b21sZWZ0IHsgYm90dG9tOiAwOyBsZWZ0OiAwOyB9IHJnLXRvYXN0cyAudG9hc3RzLmJvdHRvbXJpZ2h0LFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3RzLmJvdHRvbXJpZ2h0IHsgYm90dG9tOiAwOyByaWdodDogMDsgfSByZy10b2FzdHMgLnRvYXN0LFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3QgeyBkaXNwbGF5OiBub25lOyBwYWRkaW5nOiAyMHB4OyBtYXJnaW46IDIwcHg7IGJhY2tncm91bmQtY29sb3I6ICMwMDA7IGNvbG9yOiB3aGl0ZTsgZm9udC1zaXplOiAwLjllbTsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLXRvYXN0cyAudG9hc3QuaXN2aXNpYmxlLFtyaW90LXRhZz1cInJnLXRvYXN0c1wiXSAudG9hc3QuaXN2aXNpYmxlIHsgZGlzcGxheTogYmxvY2s7IH0nLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLnRvYXN0Q2xpY2tlZD1mdW5jdGlvbih0KXt2YXIgZT10Lml0ZW07aWYocmcuaXNGdW5jdGlvbihlLm9uY2xpY2spKWUub25jbGljaygpO2lmKHJnLmlzRnVuY3Rpb24oZS5vbmNsb3NlKSllLm9uY2xvc2UoKTt3aW5kb3cuY2xlYXJUaW1lb3V0KGUudGltZXIpO2UuaXN2aXNpYmxlPWZhbHNlfTt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdUb2FzdHM9dC50b2FzdHN8fG5ldyBSZ1RvYXN0cyh0KTtlLlJnVG9hc3RzLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLnVwZGF0ZSgpfSk7ZS51cGRhdGUoKX0pfSxcInsgfVwiKTtyaW90LnRhZzIoXCJyZy10b2dnbGVcIiwnPGRpdiBjbGFzcz1cIndyYXBwZXJcIj4gPGxhYmVsIGNsYXNzPVwidG9nZ2xlXCI+IDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBfX2NoZWNrZWQ9XCJ7UmdUb2dnbGUuY2hlY2tlZH1cIiBvbmNsaWNrPVwie3RvZ2dsZX1cIj4gPGRpdiBjbGFzcz1cInRyYWNrXCI+IDxkaXYgY2xhc3M9XCJoYW5kbGVcIj48L2Rpdj4gPC9kaXY+IDwvbGFiZWw+IDwvZGl2PicsJ3JnLXRvZ2dsZSAud3JhcHBlcixbcmlvdC10YWc9XCJyZy10b2dnbGVcIl0gLndyYXBwZXIgeyB3aWR0aDogNjBweDsgaGVpZ2h0OiAyMHB4OyBtYXJnaW46IDA7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgLXdlYmtpdC11c2VyLXNlbGVjdDogbm9uZTsgLW1vei11c2VyLXNlbGVjdDogbm9uZTsgLW1zLXVzZXItc2VsZWN0OiBub25lOyB1c2VyLXNlbGVjdDogbm9uZTsgfSByZy10b2dnbGUgLnRvZ2dsZSxbcmlvdC10YWc9XCJyZy10b2dnbGVcIl0gLnRvZ2dsZSB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgY3Vyc29yOiBwb2ludGVyOyB9IHJnLXRvZ2dsZSBpbnB1dFt0eXBlPWNoZWNrYm94XSxbcmlvdC10YWc9XCJyZy10b2dnbGVcIl0gaW5wdXRbdHlwZT1jaGVja2JveF0geyBkaXNwbGF5OiBub25lOyB9IHJnLXRvZ2dsZSAudHJhY2ssW3Jpb3QtdGFnPVwicmctdG9nZ2xlXCJdIC50cmFjayB7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAwOyBib3R0b206IDA7IGxlZnQ6IDA7IHJpZ2h0OiAwOyB3aWR0aDogNjBweDsgaGVpZ2h0OiAyMHB4OyBwYWRkaW5nOiAycHg7IGJhY2tncm91bmQtY29sb3I6ICNiNmMwYzc7IHRyYW5zaXRpb246IGJhY2tncm91bmQtY29sb3IgMC4xcyBsaW5lYXI7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH0gcmctdG9nZ2xlIGlucHV0W3R5cGU9Y2hlY2tib3hdOmNoZWNrZWQgKyAudHJhY2ssW3Jpb3QtdGFnPVwicmctdG9nZ2xlXCJdIGlucHV0W3R5cGU9Y2hlY2tib3hdOmNoZWNrZWQgKyAudHJhY2sgeyBiYWNrZ3JvdW5kLWNvbG9yOiAjMDAwOyB9IHJnLXRvZ2dsZSAuaGFuZGxlLFtyaW90LXRhZz1cInJnLXRvZ2dsZVwiXSAuaGFuZGxlIHsgcG9zaXRpb246IHJlbGF0aXZlOyBsZWZ0OiAwOyB3aWR0aDogNTAlOyBoZWlnaHQ6IDEwMCU7IGJhY2tncm91bmQtY29sb3I6IHdoaXRlOyB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4xcyBsaW5lYXI7IH0gcmctdG9nZ2xlIGlucHV0W3R5cGU9Y2hlY2tib3hdOmNoZWNrZWQgKyAudHJhY2sgLmhhbmRsZSxbcmlvdC10YWc9XCJyZy10b2dnbGVcIl0gaW5wdXRbdHlwZT1jaGVja2JveF06Y2hlY2tlZCArIC50cmFjayAuaGFuZGxlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGUzZCgxMDAlLCAwLCAwKTsgfScsXCJcIixmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMub24oXCJtb3VudFwiLGZ1bmN0aW9uKCl7ZS5SZ1RvZ2dsZT10LnRvZ2dsZXx8bmV3IFJnVG9nZ2xlO2UuUmdUb2dnbGUub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2UudXBkYXRlKCl9KTtlLnVwZGF0ZSgpfSk7dGhpcy50b2dnbGU9ZnVuY3Rpb24oKXtlLlJnVG9nZ2xlLnRvZ2dsZSgpfX0sXCJ7IH1cIik7cmlvdC50YWcyKFwicmctdW5zcGxhc2hcIiwnPGltZyByaW90LXNyYz1cImh0dHBzOi8vdW5zcGxhc2guaXQve2dyZXlzY2FsZX17UmdVbnNwbGFzaC53aWR0aH0ve1JnVW5zcGxhc2guaGVpZ2h0fS8/e29wdGlvbnN9XCI+JyxcIlwiLFwiXCIsZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLm9uKFwibW91bnRcIixmdW5jdGlvbigpe2UuUmdVbnNwbGFzaD10LnVuc3BsYXNofHxuZXcgUmdVbnNwbGFzaDtlLlJnVW5zcGxhc2gub24oXCJ1cGRhdGVcIixmdW5jdGlvbigpe2UudXBkYXRlKCl9KTtlLm9uKFwidXBkYXRlXCIsZnVuY3Rpb24oKXtlLm9wdGlvbnM9XCJcIjtpZihlLlJnVW5zcGxhc2guZ3JleXNjYWxlKWUuZ3JleXNjYWxlPVwiZy9cIjtpZihlLlJnVW5zcGxhc2gucmFuZG9tKWUub3B0aW9ucys9XCJyYW5kb20mXCI7aWYoZS5SZ1Vuc3BsYXNoLmJsdXIpZS5vcHRpb25zKz1cImJsdXImXCI7aWYoZS5SZ1Vuc3BsYXNoLmltYWdlKWUub3B0aW9ucys9XCJpbWFnZT1cIitlLlJnVW5zcGxhc2guaW1hZ2UrXCImXCI7aWYocmcuaXNEZWZpbmVkKGUuUmdVbnNwbGFzaC5ncmF2aXR5KSllLm9wdGlvbnMrPVwiZ3Jhdml0eT1cIitlLlJnVW5zcGxhc2guZ3Jhdml0eX0pO2UudXBkYXRlKCl9KX0sXCJ7IH1cIik7IiwidmFyIHJpb3QgPSByZXF1aXJlKCdyaW90Jyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJpb3QudGFnMignYXBwJywgJzxkaXY+IDxwPlRoaXMgaXMgdGhlIGFwcCB0YWc8L3A+IDxwPlJhdyBjb250ZW50OjxyYXcgY29udGVudD1cInRoaXMgaXMgaW5zaWRlIHRoZSByYXcgdGFnXCI+PC9yYXc+IDxyZy1sb2FkaW5nIGxvYWRpbmc9XCJ7bG9hZGluZ31cIj4gUGxlYXNlIHdhaXQuLi4gPC9yZy1sb2FkaW5nPiA8L2Rpdj4nLCAnJywgJycsIGZ1bmN0aW9uKG9wdHMpIHtcblx0dmFyIHJnID0gcmVxdWlyZSgnLi4vbm9kZV9tb2R1bGVzL3Jpb3RnZWFyL2Rpc3QvcmcuanMnKSgpO1xuXHRkZWJ1Z2dlcjtcblxuXHR0aGlzLmxvYWRpbmcgPSBuZXcgUmdMb2FkaW5nKHtcblx0ICBpc3Zpc2libGU6IHRydWVcblx0fSk7XG5cblx0dGhpcy5vbignbW91bnQnLCBmdW5jdGlvbigpIHtcblx0fSk7XG59LCAneyB9Jyk7IiwidmFyIHJpb3QgPSByZXF1aXJlKCdyaW90Jyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJpb3QudGFnMigncmF3JywgJzxzcGFuPjwvc3Bhbj4nLCAnJywgJycsIGZ1bmN0aW9uKG9wdHMpIHtcbiAgICB0aGlzLnJvb3QuaW5uZXJIVE1MID0gb3B0cy5jb250ZW50XG59KTsiXX0=
