/*  Prototype JavaScript framework, version 1.7
 *  (c) 2005-2010 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {

  Version: '1.7',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    return {
      IE:             !!window.attachEvent && !isOpera,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile/.test(ua)
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,

    SelectorsAPI: !!document.querySelector,

    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div'),
          form = document.createElement('form'),
          isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },

  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {

  var IS_DONTENUM_BUGGY = (function(){
    for (var p in { toString: 1 }) {
      if (p === 'toString') return false;
    }
    return true;
  })();

  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0, length = properties.length; i < length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype,
        properties = Object.keys(source);

    if (IS_DONTENUM_BUGGY) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames()[0] == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString,
      NULL_TYPE = 'Null',
      UNDEFINED_TYPE = 'Undefined',
      BOOLEAN_TYPE = 'Boolean',
      NUMBER_TYPE = 'Number',
      STRING_TYPE = 'String',
      OBJECT_TYPE = 'Object',
      FUNCTION_CLASS = '[object Function]',
      BOOLEAN_CLASS = '[object Boolean]',
      NUMBER_CLASS = '[object Number]',
      STRING_CLASS = '[object String]',
      ARRAY_CLASS = '[object Array]',
      DATE_CLASS = '[object Date]',
      NATIVE_JSON_STRINGIFY_SUPPORT = window.JSON &&
        typeof JSON.stringify === 'function' &&
        JSON.stringify(0) === '0' &&
        typeof JSON.stringify(Prototype.K) === 'undefined';

  function Type(o) {
    switch(o) {
      case null: return NULL_TYPE;
      case (void 0): return UNDEFINED_TYPE;
    }
    var type = typeof o;
    switch(type) {
      case 'boolean': return BOOLEAN_TYPE;
      case 'number':  return NUMBER_TYPE;
      case 'string':  return STRING_TYPE;
    }
    return OBJECT_TYPE;
  }

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(value) {
    return Str('', { '': value }, []);
  }

  function Str(key, holder, stack) {
    var value = holder[key],
        type = typeof value;

    if (Type(value) === OBJECT_TYPE && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    var _class = _toString.call(value);

    switch (_class) {
      case NUMBER_CLASS:
      case BOOLEAN_CLASS:
      case STRING_CLASS:
        value = value.valueOf();
    }

    switch (value) {
      case null: return 'null';
      case true: return 'true';
      case false: return 'false';
    }

    type = typeof value;
    switch (type) {
      case 'string':
        return value.inspect(true);
      case 'number':
        return isFinite(value) ? String(value) : 'null';
      case 'object':

        for (var i = 0, length = stack.length; i < length; i++) {
          if (stack[i] === value) { throw new TypeError(); }
        }
        stack.push(value);

        var partial = [];
        if (_class === ARRAY_CLASS) {
          for (var i = 0, length = value.length; i < length; i++) {
            var str = Str(i, value, stack);
            partial.push(typeof str === 'undefined' ? 'null' : str);
          }
          partial = '[' + partial.join(',') + ']';
        } else {
          var keys = Object.keys(value);
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i], str = Str(key, value, stack);
            if (typeof str !== "undefined") {
               partial.push(key.inspect(true)+ ':' + str);
             }
          }
          partial = '{' + partial.join(',') + '}';
        }
        stack.pop();
        return partial;
    }
  }

  function stringify(object) {
    return JSON.stringify(object);
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    if (Type(object) !== OBJECT_TYPE) { throw new TypeError(); }
    var results = [];
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        results.push(property);
      }
    }
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) === ARRAY_CLASS;
  }

  var hasNativeIsArray = (typeof Array.isArray == 'function')
    && Array.isArray([]) && !Array.isArray({});

  if (hasNativeIsArray) {
    isArray = Array.isArray;
  }

  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return _toString.call(object) === FUNCTION_CLASS;
  }

  function isString(object) {
    return _toString.call(object) === STRING_CLASS;
  }

  function isNumber(object) {
    return _toString.call(object) === NUMBER_CLASS;
  }

  function isDate(object) {
    return _toString.call(object) === DATE_CLASS;
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        NATIVE_JSON_STRINGIFY_SUPPORT ? stringify : toJSON,
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          Object.keys || keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isDate:        isDate,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());



(function(proto) {


  function toISOString() {
    return this.getUTCFullYear() + '-' +
      (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
      this.getUTCDate().toPaddedString(2) + 'T' +
      this.getUTCHours().toPaddedString(2) + ':' +
      this.getUTCMinutes().toPaddedString(2) + ':' +
      this.getUTCSeconds().toPaddedString(2) + 'Z';
  }


  function toJSON() {
    return this.toISOString();
  }

  if (!proto.toISOString) proto.toISOString = toISOString;
  if (!proto.toJSON) proto.toJSON = toJSON;

})(Date.prototype);


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {
  var NATIVE_JSON_PARSE_SUPPORT = window.JSON &&
    typeof JSON.parse === 'function' &&
    JSON.parse('{"test": true}').test;

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img'),
        matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift()),
            value = pair.length > 1 ? pair.join('=') : pair[0];

        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    return this.replace(/-+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON(),
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    if (cx.test(json)) {
      json = json.replace(cx, function (a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      });
    }
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function parseJSON() {
    var json = this.unfilterJSON();
    return JSON.parse(json);
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.lastIndexOf(pattern, 0) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.indexOf(pattern, d) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim || strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       NATIVE_JSON_PARSE_SUPPORT ? parseJSON : evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3],
          pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;

      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();

function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}


function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator, context) {
    for (var i = 0, length = this.length >>> 0; i < length; i++) {
      if (i in this) iterator.call(context, this[i], i, this);
    }
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline === false ? this.toArray() : this)._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }


  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }



  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values)) {
          var queryValues = [];
          for (var i = 0, len = values.length, value; i < len; i++) {
            value = values[i];
            queryValues.push(toQueryPair(key, value));
          }
          return results.concat(queryValues);
        }
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toObject,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.isString(this.options.parameters) ?
          this.options.parameters :
          Object.toQueryString(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params += (params ? '&' : '') + "_method=" + this.method;
      this.method = 'post';
    }

    if (params && this.method === 'get') {
      this.url += (this.url.include('?') ? '&' : '?') + params;
    }

    this.parameters = params.toQueryParams();

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300) || status == 304;
  },

  getStatus: function() {
    try {
      if (this.transport.status === 1223) return 204;
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if (readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});


function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}



(function(global) {
  function shouldUseCache(tagName, attributes) {
    if (tagName === 'select') return false;
    if ('type' in attributes) return false;
    return true;
  }

  var HAS_EXTENDED_CREATE_ELEMENT_SYNTAX = (function(){
    try {
      var el = document.createElement('<input name="x">');
      return el.tagName.toLowerCase() === 'input' && el.name === 'x';
    }
    catch(err) {
      return false;
    }
  })();

  var element = global.Element;

  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;

    if (HAS_EXTENDED_CREATE_ELEMENT_SYNTAX && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }

    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));

    var node = shouldUseCache(tagName, attributes) ?
     cache[tagName].cloneNode(false) : document.createElement(tagName);

    return Element.writeAttribute(node, attributes);
  };

  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;

})(this);

Element.idCounter = 1;
Element.cache = { };

Element._purgeElement = function(element) {
  var uid = element._prototypeUID;
  if (uid) {
    Element.stopObserving(element);
    element._prototypeUID = void 0;
    delete Element.Storage[uid];
  }
}

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var LINK_ELEMENT_INNERHTML_BUGGY = (function() {
      try {
        var el = document.createElement('div');
        el.innerHTML = "<link>";
        var isBuggy = (el.childNodes.length === 0);
        el = null;
        return isBuggy;
      } catch(e) {
        return true;
      }
    })();

    var ANY_INNERHTML_BUGGY = SELECT_ELEMENT_INNERHTML_BUGGY ||
     TABLE_ELEMENT_INNERHTML_BUGGY || LINK_ELEMENT_INNERHTML_BUGGY;

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();


    function update(element, content) {
      element = $(element);
      var purgeElement = Element._purgeElement;

      var descendants = element.getElementsByTagName('*'),
       i = descendants.length;
      while (i--) purgeElement(descendants[i]);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (ANY_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        } else if (LINK_ELEMENT_INNERHTML_BUGGY && Object.isString(content) && content.indexOf('<link') > -1) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          var nodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts(), true);
          nodes.each(function(node) { element.appendChild(node) });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(),
          attribute = pair.last(),
          value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    var elements = [];

    while (element = element[property]) {
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
      if (elements.length == maximumLength)
        break;
    }

    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    var results = [], child = $(element).firstChild;
    while (child) {
      if (child.nodeType === 1) {
        results.push(Element.extend(child));
      }
      child = child.nextSibling;
    }
    return results;
  },

  previousSiblings: function(element, maximumLength) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    element = $(element);
    if (Object.isString(selector))
      return Prototype.Selector.match(element, selector);
    return selector.match(element);
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Prototype.Selector.find(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.previousSiblings(), expression, index);
    } else {
      return element.recursivelyCollect("previousSibling", index + 1)[index];
    }
  },

  next: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.nextSiblings(), expression, index);
    } else {
      var maximumLength = Object.isNumber(index) ? index + 1 : 1;
      return element.recursivelyCollect("nextSibling", index + 1)[index];
    }
  },


  select: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element);
  },

  adjacent: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element.parentNode).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source), delta = [0, 0], parent = null;

    element = $(element);

    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className',
        forProp = 'for',
        el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div'), f;
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if (element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next(),
          fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html, force) {
  var div = new Element('div'),
      t = Element._insertionTranslations.tags[tagName];

  var workaround = false;
  if (t) workaround = true;
  else if (force) {
    workaround = true;
    t = ['', '', 0];
  }

  if (workaround) {
    div.innerHTML = '&nbsp;' + t[0] + html + t[1];
    div.removeChild(div.firstChild);
    for (var i = t[2]; i--; ) {
      div = div.firstChild;
    }
  }
  else {
    div.innerHTML = html;
  }
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'));

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2),
            el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

if (document.documentElement.hasAttribute) {
  Element.hasAttribute = function(element, attribute) {
    return element.hasAttribute(attribute);
  };
}
else {
  Element.hasAttribute = Element.Methods.Simulated.hasAttribute;
}

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName),
        proto = element['__proto__'] || element.constructor.prototype;

    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = Element.Storage.UID++;
      uid = element._prototypeUID;
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  },

  purge: function(element) {
    if (!(element = $(element))) return;
    var purgeElement = Element._purgeElement;

    purgeElement(element);

    var descendants = element.getElementsByTagName('*'),
     i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }
});

(function() {

  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }

  function getPixelValue(value, property, context) {
    var element = null;
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }

    if (value === null) {
      return null;
    }

    if ((/^(?:-)?\d+(\.\d+)?(px)?$/i).test(value)) {
      return window.parseFloat(value);
    }

    var isPercentage = value.include('%'), isViewport = (context === document.viewport);

    if (/\d/.test(value) && element && element.runtimeStyle && !(isPercentage && isViewport)) {
      var style = element.style.left, rStyle = element.runtimeStyle.left;
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;

      return value;
    }

    if (element && isPercentage) {
      context = context || element.parentNode;
      var decimal = toDecimal(value);
      var whole = null;
      var position = element.getStyle('position');

      var isHorizontal = property.include('left') || property.include('right') ||
       property.include('width');

      var isVertical =  property.include('top') || property.include('bottom') ||
        property.include('height');

      if (context === document.viewport) {
        if (isHorizontal) {
          whole = document.viewport.getWidth();
        } else if (isVertical) {
          whole = document.viewport.getHeight();
        }
      } else {
        if (isHorizontal) {
          whole = $(context).measure('width');
        } else if (isVertical) {
          whole = $(context).measure('height');
        }
      }

      return (whole === null) ? 0 : whole * decimal;
    }

    return 0;
  }

  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }
    return number + 'px';
  }

  function isDisplayed(element) {
    var originalElement = element;
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }
    return true;
  }

  var hasLayout = Prototype.K;
  if ('currentStyle' in document.documentElement) {
    hasLayout = function(element) {
      if (!element.currentStyle.hasLayout) {
        element.style.zoom = 1;
      }
      return element;
    };
  }

  function cssNameFor(key) {
    if (key.include('border')) key = key + '-width';
    return key.camelize();
  }

  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();
      this.element = $(element);

      Element.Layout.PROPERTIES.each( function(property) {
        this._set(property, null);
      }, this);

      if (preCompute) {
        this._preComputing = true;
        this._begin();
        Element.Layout.PROPERTIES.each( this._compute, this );
        this._end();
        this._preComputing = false;
      }
    },

    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },

    set: function(property, value) {
      throw "Properties of Element.Layout are read-only.";
    },

    get: function($super, property) {
      var value = $super(property);
      return value === null ? this._compute(property) : value;
    },

    _begin: function() {
      if (this._prepared) return;

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }

      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };

      element.store('prototype_original_styles', originalStyles);

      var position = element.getStyle('position'),
       width = element.getStyle('width');

      if (width === "0px" || width === null) {
        element.style.display = 'block';
        width = element.getStyle('width');
      }

      var context = (position === 'fixed') ? document.viewport :
       element.parentNode;

      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });

      var positionedWidth = element.getStyle('width');

      var newWidth;
      if (width && (positionedWidth === width)) {
        newWidth = getPixelValue(element, 'width', context);
      } else if (position === 'absolute' || position === 'fixed') {
        newWidth = getPixelValue(element, 'width', context);
      } else {
        var parent = element.parentNode, pLayout = $(parent).getLayout();

        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }

      element.setStyle({ width: newWidth + 'px' });

      this._prepared = true;
    },

    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);
      element.setStyle(originalStyles);
      this._prepared = false;
    },

    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }

      return this._set(property, COMPUTATIONS[property].call(this, this.element));
    },

    toObject: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var obj = {};
      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        var value = this.get(key);
        if (value != null) obj[key] = value;
      }, this);
      return obj;
    },

    toHash: function() {
      var obj = this.toObject.apply(this, arguments);
      return new Hash(obj);
    },

    toCSS: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var css = {};

      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        if (Element.Layout.COMPOSITE_PROPERTIES.include(key)) return;

        var value = this.get(key);
        if (value != null) css[cssNameFor(key)] = value + 'px';
      }, this);
      return css;
    },

    inspect: function() {
      return "#<Element.Layout>";
    }
  });

  Object.extend(Element.Layout, {
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),

    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),

    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();

        var bHeight = this.get('border-box-height');
        if (bHeight <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');

        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        if (!this._preComputing) this._end();

        return bHeight - bTop - bBottom - pTop - pBottom;
      },

      'width': function(element) {
        if (!this._preComputing) this._begin();

        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        if (!this._preComputing) this._end();

        return bWidth - bLeft - bRight - pLeft - pRight;
      },

      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        return width + pLeft + pRight;
      },

      'border-box-height': function(element) {
        if (!this._preComputing) this._begin();
        var height = element.offsetHeight;
        if (!this._preComputing) this._end();
        return height;
      },

      'border-box-width': function(element) {
        if (!this._preComputing) this._begin();
        var width = element.offsetWidth;
        if (!this._preComputing) this._end();
        return width;
      },

      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');

        if (bHeight <= 0) return 0;

        return bHeight + mTop + mBottom;
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;

        return bWidth + mLeft + mRight;
      },

      'top': function(element) {
        var offset = element.positionedOffset();
        return offset.top;
      },

      'bottom': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pHeight = parent.measure('height');

        var mHeight = this.get('border-box-height');

        return pHeight - mHeight - offset.top;
      },

      'left': function(element) {
        var offset = element.positionedOffset();
        return offset.left;
      },

      'right': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pWidth = parent.measure('width');

        var mWidth = this.get('border-box-width');

        return pWidth - mWidth - offset.left;
      },

      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },

      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },

      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },

      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },

      'border-top': function(element) {
        return getPixelValue(element, 'borderTopWidth');
      },

      'border-bottom': function(element) {
        return getPixelValue(element, 'borderBottomWidth');
      },

      'border-left': function(element) {
        return getPixelValue(element, 'borderLeftWidth');
      },

      'border-right': function(element) {
        return getPixelValue(element, 'borderRightWidth');
      },

      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },

      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },

      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },

      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });

  if ('getBoundingClientRect' in document.documentElement) {
    Object.extend(Element.Layout.COMPUTATIONS, {
      'right': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.right - rect.right).round();
      },

      'bottom': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.bottom - rect.bottom).round();
      }
    });
  }

  Element.Offset = Class.create({
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();

      this[0] = this.left;
      this[1] = this.top;
    },

    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left,
        this.top  - offset.top
      );
    },

    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}>".interpolate(this);
    },

    toString: function() {
      return "[#{left}, #{top}]".interpolate(this);
    },

    toArray: function() {
      return [this.left, this.top];
    }
  });

  function getLayout(element, preCompute) {
    return new Element.Layout(element, preCompute);
  }

  function measure(element, property) {
    return $(element).getLayout().get(property);
  }

  function getDimensions(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');

    if (display && display !== 'none') {
      return { width: element.offsetWidth, height: element.offsetHeight };
    }

    var style = element.style;
    var originalStyles = {
      visibility: style.visibility,
      position:   style.position,
      display:    style.display
    };

    var newStyles = {
      visibility: 'hidden',
      display:    'block'
    };

    if (originalStyles.position !== 'fixed')
      newStyles.position = 'absolute';

    Element.setStyle(element, newStyles);

    var dimensions = {
      width:  element.offsetWidth,
      height: element.offsetHeight
    };

    Element.setStyle(element, originalStyles);

    return dimensions;
  }

  function getOffsetParent(element) {
    element = $(element);

    if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
      return $(document.body);

    var isInline = (Element.getStyle(element, 'display') === 'inline');
    if (!isInline && element.offsetParent) return $(element.offsetParent);

    while ((element = element.parentNode) && element !== document.body) {
      if (Element.getStyle(element, 'position') !== 'static') {
        return isHtml(element) ? $(document.body) : $(element);
      }
    }

    return $(document.body);
  }


  function cumulativeOffset(element) {
    element = $(element);
    var valueT = 0, valueL = 0;
    if (element.parentNode) {
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
      } while (element);
    }
    return new Element.Offset(valueL, valueT);
  }

  function positionedOffset(element) {
    element = $(element);

    var layout = element.getLayout();

    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (isBody(element)) break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);

    valueL -= layout.get('margin-top');
    valueT -= layout.get('margin-left');

    return new Element.Offset(valueL, valueT);
  }

  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  function viewportOffset(forElement) {
    element = $(element);
    var valueT = 0, valueL = 0, docBody = document.body;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == docBody &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (element != docBody) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);
    return new Element.Offset(valueL, valueT);
  }

  function absolutize(element) {
    element = $(element);

    if (Element.getStyle(element, 'position') === 'absolute') {
      return element;
    }

    var offsetParent = getOffsetParent(element);
    var eOffset = element.viewportOffset(),
     pOffset = offsetParent.viewportOffset();

    var offset = eOffset.relativeTo(pOffset);
    var layout = element.getLayout();

    element.store('prototype_absolutize_original_styles', {
      left:   element.getStyle('left'),
      top:    element.getStyle('top'),
      width:  element.getStyle('width'),
      height: element.getStyle('height')
    });

    element.setStyle({
      position: 'absolute',
      top:    offset.top + 'px',
      left:   offset.left + 'px',
      width:  layout.get('width') + 'px',
      height: layout.get('height') + 'px'
    });

    return element;
  }

  function relativize(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') === 'relative') {
      return element;
    }

    var originalStyles =
     element.retrieve('prototype_absolutize_original_styles');

    if (originalStyles) element.setStyle(originalStyles);
    return element;
  }

  if (Prototype.Browser.IE) {
    getOffsetParent = getOffsetParent.wrap(
      function(proceed, element) {
        element = $(element);

        if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
          return $(document.body);

        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);

        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );

    positionedOffset = positionedOffset.wrap(function(proceed, element) {
      element = $(element);
      if (!element.parentNode) return new Element.Offset(0, 0);
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);

      var offsetParent = element.getOffsetParent();
      if (offsetParent && offsetParent.getStyle('position') === 'fixed')
        hasLayout(offsetParent);

      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    });
  } else if (Prototype.Browser.Webkit) {
    cumulativeOffset = function(element) {
      element = $(element);
      var valueT = 0, valueL = 0;
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        if (element.offsetParent == document.body)
          if (Element.getStyle(element, 'position') == 'absolute') break;

        element = element.offsetParent;
      } while (element);

      return new Element.Offset(valueL, valueT);
    };
  }


  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    getDimensions:          getDimensions,
    getOffsetParent:        getOffsetParent,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset,
    absolutize:             absolutize,
    relativize:             relativize
  });

  function isBody(element) {
    return element.nodeName.toUpperCase() === 'BODY';
  }

  function isHtml(element) {
    return element.nodeName.toUpperCase() === 'HTML';
  }

  function isDocument(element) {
    return element.nodeType === Node.DOCUMENT_NODE;
  }

  function isDetached(element) {
    return element !== document.body &&
     !Element.descendantOf(element, document.body);
  }

  if ('getBoundingClientRect' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        if (isDetached(element)) return new Element.Offset(0, 0);

        var rect = element.getBoundingClientRect(),
         docEl = document.documentElement;
        return new Element.Offset(rect.left - docEl.clientLeft,
         rect.top - docEl.clientTop);
      }
    });
  }
})();
window.$$ = function() {
  var expression = $A(arguments).join(', ');
  return Prototype.Selector.select(expression, document);
};

Prototype.Selector = (function() {

  function select() {
    throw new Error('Method "Prototype.Selector.select" must be defined.');
  }

  function match() {
    throw new Error('Method "Prototype.Selector.match" must be defined.');
  }

  function find(elements, expression, index) {
    index = index || 0;
    var match = Prototype.Selector.match, length = elements.length, matchIndex = 0, i;

    for (i = 0; i < length; i++) {
      if (match(elements[i], expression) && index == matchIndex++) {
        return Element.extend(elements[i]);
      }
    }
  }

  function extendElements(elements) {
    for (var i = 0, length = elements.length; i < length; i++) {
      Element.extend(elements[i]);
    }
    return elements;
  }


  var K = Prototype.K;

  return {
    select: select,
    match: match,
    find: find,
    extendElements: (Element.extend === K) ? K : extendElements,
    extendElement: Element.extend
  };
})();
Prototype._original_property = window.Sizzle;
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true;

[0, 0].sort(function(){
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function(selector, context, results, seed) {
	results = results || [];
	var origContext = context = context || document;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context),
		soFar = selector;

	while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
		soFar = m[3];

		parts.push( m[1] );

		if ( m[2] ) {
			extra = m[3];
			break;
		}
	}

	if ( parts.length > 1 && origPOS.exec( selector ) ) {
		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );
		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] )
					selector += parts.shift();

				set = posProcess( selector, set );
			}
		}
	} else {
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
			var ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
		}

		if ( context ) {
			var ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
			set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray(set);
			} else {
				prune = false;
			}

			while ( parts.length ) {
				var cur = parts.pop(), pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}
		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		throw "Syntax error, unrecognized expression: " + (cur || selector);
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );
		} else if ( context && context.nodeType === 1 ) {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}
		} else {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}
	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function(results){
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort(sortOrder);

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[i-1] ) {
					results.splice(i--, 1);
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function(expr, set){
	return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
	var set, match;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var type = Expr.order[i], match;

		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice(1,1);

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace(/\\/g, "");
				set = Expr.find[ type ]( match, context, isXML );
				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = context.getElementsByTagName("*");
	}

	return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
	var old = expr, result = [], curLoop = set, match, anyFound,
		isXMLFilter = set && set[0] && isXML(set[0]);

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.match[ type ].exec( expr )) != null ) {
				var filter = Expr.filter[ type ], found, item;
				anyFound = false;

				if ( curLoop == result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;
					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;
								} else {
									curLoop[i] = false;
								}
							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		if ( expr == old ) {
			if ( anyFound == null ) {
				throw "Syntax error, unrecognized expression: " + expr;
			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],
	match: {
		ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
	},
	leftMatch: {},
	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},
	attrHandle: {
		href: function(elem){
			return elem.getAttribute("href");
		}
	},
	relative: {
		"+": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !/\W/.test(part),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag && !isXML ) {
				part = part.toUpperCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},
		">": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string";

			if ( isPartStr && !/\W/.test(part) ) {
				part = isXML ? part : part.toUpperCase();

				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName === part ? parent : false;
					}
				}
			} else {
				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},
		"": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
		},
		"~": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
		}
	},
	find: {
		ID: function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? [m] : [];
			}
		},
		NAME: function(match, context, isXML){
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [], results = context.getElementsByName(match[1]);

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},
		TAG: function(match, context){
			return context.getElementsByTagName(match[1]);
		}
	},
	preFilter: {
		CLASS: function(match, curLoop, inplace, result, not, isXML){
			match = " " + match[1].replace(/\\/g, "") + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
						if ( !inplace )
							result.push( elem );
					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},
		ID: function(match){
			return match[1].replace(/\\/g, "");
		},
		TAG: function(match, curLoop){
			for ( var i = 0; curLoop[i] === false; i++ ){}
			return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
		},
		CHILD: function(match){
			if ( match[1] == "nth" ) {
				var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
					match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}

			match[0] = done++;

			return match;
		},
		ATTR: function(match, curLoop, inplace, result, not, isXML){
			var name = match[1].replace(/\\/g, "");

			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},
		PSEUDO: function(match, curLoop, inplace, result, not){
			if ( match[1] === "not" ) {
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);
				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
					if ( !inplace ) {
						result.push.apply( result, ret );
					}
					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}

			return match;
		},
		POS: function(match){
			match.unshift( true );
			return match;
		}
	},
	filters: {
		enabled: function(elem){
			return elem.disabled === false && elem.type !== "hidden";
		},
		disabled: function(elem){
			return elem.disabled === true;
		},
		checked: function(elem){
			return elem.checked === true;
		},
		selected: function(elem){
			elem.parentNode.selectedIndex;
			return elem.selected === true;
		},
		parent: function(elem){
			return !!elem.firstChild;
		},
		empty: function(elem){
			return !elem.firstChild;
		},
		has: function(elem, i, match){
			return !!Sizzle( match[3], elem ).length;
		},
		header: function(elem){
			return /h\d/i.test( elem.nodeName );
		},
		text: function(elem){
			return "text" === elem.type;
		},
		radio: function(elem){
			return "radio" === elem.type;
		},
		checkbox: function(elem){
			return "checkbox" === elem.type;
		},
		file: function(elem){
			return "file" === elem.type;
		},
		password: function(elem){
			return "password" === elem.type;
		},
		submit: function(elem){
			return "submit" === elem.type;
		},
		image: function(elem){
			return "image" === elem.type;
		},
		reset: function(elem){
			return "reset" === elem.type;
		},
		button: function(elem){
			return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
		},
		input: function(elem){
			return /input|select|textarea|button/i.test(elem.nodeName);
		}
	},
	setFilters: {
		first: function(elem, i){
			return i === 0;
		},
		last: function(elem, i, match, array){
			return i === array.length - 1;
		},
		even: function(elem, i){
			return i % 2 === 0;
		},
		odd: function(elem, i){
			return i % 2 === 1;
		},
		lt: function(elem, i, match){
			return i < match[3] - 0;
		},
		gt: function(elem, i, match){
			return i > match[3] - 0;
		},
		nth: function(elem, i, match){
			return match[3] - 0 == i;
		},
		eq: function(elem, i, match){
			return match[3] - 0 == i;
		}
	},
	filter: {
		PSEUDO: function(elem, match, i, array){
			var name = match[1], filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
			} else if ( name === "not" ) {
				var not = match[3];

				for ( var i = 0, l = not.length; i < l; i++ ) {
					if ( not[i] === elem ) {
						return false;
					}
				}

				return true;
			}
		},
		CHILD: function(elem, match){
			var type = match[1], node = elem;
			switch (type) {
				case 'only':
				case 'first':
					while ( (node = node.previousSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					if ( type == 'first') return true;
					node = elem;
				case 'last':
					while ( (node = node.nextSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					return true;
				case 'nth':
					var first = match[2], last = match[3];

					if ( first == 1 && last == 0 ) {
						return true;
					}

					var doneName = match[0],
						parent = elem.parentNode;

					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						}
						parent.sizcache = doneName;
					}

					var diff = elem.nodeIndex - last;
					if ( first == 0 ) {
						return diff == 0;
					} else {
						return ( diff % first == 0 && diff / first >= 0 );
					}
			}
		},
		ID: function(elem, match){
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},
		TAG: function(elem, match){
			return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
		},
		CLASS: function(elem, match){
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},
		ATTR: function(elem, match){
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value != check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},
		POS: function(elem, match, i, array){
			var name = match[2], filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source );
}

var makeArray = function(array, results) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}

	return array;
};

try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 );

} catch(e){
	makeArray = function(array, results) {
		var ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );
		} else {
			if ( typeof array.length === "number" ) {
				for ( var i = 0, l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}
			} else {
				for ( var i = 0; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( "sourceIndex" in document.documentElement ) {
	sortOrder = function( a, b ) {
		if ( !a.sourceIndex || !b.sourceIndex ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.sourceIndex - b.sourceIndex;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( document.createRange ) {
	sortOrder = function( a, b ) {
		if ( !a.ownerDocument || !b.ownerDocument ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
}

(function(){
	var form = document.createElement("div"),
		id = "script" + (new Date).getTime();
	form.innerHTML = "<a name='" + id + "'/>";

	var root = document.documentElement;
	root.insertBefore( form, root.firstChild );

	if ( !!document.getElementById( id ) ) {
		Expr.find.ID = function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
			}
		};

		Expr.filter.ID = function(elem, match){
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	root = form = null; // release memory in IE
})();

(function(){

	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function(match, context){
			var results = context.getElementsByTagName(match[1]);

			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	div.innerHTML = "<a href='#'></a>";
	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {
		Expr.attrHandle.href = function(elem){
			return elem.getAttribute("href", 2);
		};
	}

	div = null; // release memory in IE
})();

if ( document.querySelectorAll ) (function(){
	var oldSizzle = Sizzle, div = document.createElement("div");
	div.innerHTML = "<p class='TEST'></p>";

	if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
		return;
	}

	Sizzle = function(query, context, extra, seed){
		context = context || document;

		if ( !seed && context.nodeType === 9 && !isXML(context) ) {
			try {
				return makeArray( context.querySelectorAll(query), extra );
			} catch(e){}
		}

		return oldSizzle(query, context, extra, seed);
	};

	for ( var prop in oldSizzle ) {
		Sizzle[ prop ] = oldSizzle[ prop ];
	}

	div = null; // release memory in IE
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
	var div = document.createElement("div");
	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	if ( div.getElementsByClassName("e").length === 0 )
		return;

	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 )
		return;

	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function(match, context, isXML) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ){
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ) {
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

var contains = document.compareDocumentPosition ?  function(a, b){
	return a.compareDocumentPosition(b) & 16;
} : function(a, b){
	return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
	return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
		!!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
	var tmpSet = [], later = "", match,
		root = context.nodeType ? [context] : context;

	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};


window.Sizzle = Sizzle;

})();

;(function(engine) {
  var extendElements = Prototype.Selector.extendElements;

  function select(selector, scope) {
    return extendElements(engine(selector, scope || document));
  }

  function match(element, selector) {
    return engine.matches(selector, [element]).length == 1;
  }

  Prototype.Selector.engine = engine;
  Prototype.Selector.select = select;
  Prototype.Selector.match = match;
})(Sizzle);

window.Sizzle = Prototype._original_property;
delete Prototype._original_property;

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit, accumulator, initial;

    if (options.hash) {
      initial = {};
      accumulator = function(result, key, value) {
        if (key in result) {
          if (!Object.isArray(result[key])) result[key] = [result[key]];
          result[key].push(value);
        } else result[key] = value;
        return result;
      };
    } else {
      initial = '';
      accumulator = function(result, key, value) {
        return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    }

    return elements.inject(initial, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          result = accumulator(result, key, value);
        }
      }
      return result;
    });
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    var element = form.findFirstElement();
    if (element) element.activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = (function() {
  function input(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return inputSelector(element, value);
      default:
        return valueSelector(element, value);
    }
  }

  function inputSelector(element, value) {
    if (Object.isUndefined(value))
      return element.checked ? element.value : null;
    else element.checked = !!value;
  }

  function valueSelector(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  }

  function select(element, value) {
    if (Object.isUndefined(value))
      return (element.type === 'select-one' ? selectOne : selectMany)(element);

    var opt, currentValue, single = !Object.isArray(value);
    for (var i = 0, length = element.length; i < length; i++) {
      opt = element.options[i];
      currentValue = this.optionValue(opt);
      if (single) {
        if (currentValue == value) {
          opt.selected = true;
          return;
        }
      }
      else opt.selected = value.include(currentValue);
    }
  }

  function selectOne(element) {
    var index = element.selectedIndex;
    return index >= 0 ? optionValue(element.options[index]) : null;
  }

  function selectMany(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(optionValue(opt));
    }
    return values;
  }

  function optionValue(opt) {
    return Element.hasAttribute(opt, 'value') ? opt.value : opt.text;
  }

  return {
    input:         input,
    inputSelector: inputSelector,
    textarea:      valueSelector,
    select:        select,
    selectOne:     selectOne,
    selectMany:    selectMany,
    optionValue:   optionValue,
    button:        valueSelector
  };
})();

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;



  var isIELegacyEvent = function(event) { return false; };

  if (window.attachEvent) {
    if (window.addEventListener) {
      isIELegacyEvent = function(event) {
        return !(event instanceof window.Event);
      };
    } else {
      isIELegacyEvent = function(event) { return true; };
    }
  }

  var _isButton;

  function _isButtonForDOMEvents(event, code) {
    return event.which ? (event.which === code + 1) : (event.button === code);
  }

  var legacyButtonMap = { 0: 1, 1: 4, 2: 2 };
  function _isButtonForLegacyEvents(event, code) {
    return event.button === legacyButtonMap[code];
  }

  function _isButtonForWebKit(event, code) {
    switch (code) {
      case 0: return event.which == 1 && !event.metaKey;
      case 1: return event.which == 2 || (event.which == 1 && event.metaKey);
      case 2: return event.which == 3;
      default: return false;
    }
  }

  if (window.attachEvent) {
    if (!window.addEventListener) {
      _isButton = _isButtonForLegacyEvents;
    } else {
      _isButton = function(event, code) {
        return isIELegacyEvent(event) ? _isButtonForLegacyEvents(event, code) :
         _isButtonForDOMEvents(event, code);
      }
    }
  } else if (Prototype.Browser.WebKit) {
    _isButton = _isButtonForWebKit;
  } else {
    _isButton = _isButtonForDOMEvents;
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);

    if (!expression) return element;
    while (element) {
      if (Object.isElement(element) && Prototype.Selector.match(element, expression)) {
        return Element.extend(element);
      }
      element = element.parentNode;
    }
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }


  Event.Methods = {
    isLeftClick:   isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick:  isRightClick,

    element:     element,
    findElement: findElement,

    pointer:  pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };

  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (window.attachEvent) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover':
        case 'mouseenter':
          element = event.fromElement;
          break;
        case 'mouseout':
        case 'mouseleave':
          element = event.toElement;
          break;
        default:
          return null;
      }
      return Element.extend(element);
    }

    var additionalMethods = {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    };

    Event.extend = function(event, element) {
      if (!event) return false;

      if (!isIELegacyEvent(event)) return event;

      if (event._extendedByPrototype) return event;
      event._extendedByPrototype = Prototype.emptyFunction;

      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      Object.extend(event, methods);
      Object.extend(event, additionalMethods);

      return event;
    };
  } else {
    Event.extend = Prototype.K;
  }

  if (window.addEventListener) {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        responder = function(event) {
          Event.extend(event, element);
          handler.call(element, event);
        };
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K,
      translations = { mouseenter: "mouseover", mouseleave: "mouseout" };

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      return (translations[eventName] || eventName);
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');
    if (!registry) return element;

    if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key;
        stopObserving(element, eventName);
      });
      return element;
    }

    var responders = registry.get(eventName);
    if (!responders) return element;

    if (!handler) {
      responders.each(function(r) {
        stopObserving(element, eventName, r.handler);
      });
      return element;
    }

    var i = responders.length, responder;
    while (i--) {
      if (responders[i].handler === handler) {
        responder = responders[i];
        break;
      }
    }
    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', bubble, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onlosecapture';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }

  Event.Handler = Class.create({
    initialize: function(element, eventName, selector, callback) {
      this.element   = $(element);
      this.eventName = eventName;
      this.selector  = selector;
      this.callback  = callback;
      this.handler   = this.handleEvent.bind(this);
    },

    start: function() {
      Event.observe(this.element, this.eventName, this.handler);
      return this;
    },

    stop: function() {
      Event.stopObserving(this.element, this.eventName, this.handler);
      return this;
    },

    handleEvent: function(event) {
      var element = Event.findElement(event, this.selector);
      if (element) this.callback.call(this.element, event, element);
    }
  });

  function on(element, eventName, selector, callback) {
    element = $(element);
    if (Object.isFunction(selector) && Object.isUndefined(callback)) {
      callback = selector, selector = null;
    }

    return new Event.Handler(element, eventName, selector, callback).start();
  }

  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving,
    on:            on
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving,

    on:            on
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    on:            on.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

(function() {
  window.Selector = Class.create({
    initialize: function(expression) {
      this.expression = expression.strip();
    },

    findElements: function(rootElement) {
      return Prototype.Selector.select(this.expression, rootElement);
    },

    match: function(element) {
      return Prototype.Selector.match(element, this.expression);
    },

    toString: function() {
      return this.expression;
    },

    inspect: function() {
      return "#<Selector: " + this.expression + ">";
    }
  });

  Object.extend(Selector, {
    matchElements: function(elements, expression) {
      var match = Prototype.Selector.match,
          results = [];

      for (var i = 0, length = elements.length; i < length; i++) {
        var element = elements[i];
        if (match(element, expression)) {
          results.push(Element.extend(element));
        }
      }
      return results;
    },

    findElement: function(elements, expression, index) {
      index = index || 0;
      var matchIndex = 0, element;
      for (var i = 0, length = elements.length; i < length; i++) {
        element = elements[i];
        if (Prototype.Selector.match(element, expression) && index === matchIndex++) {
          return Element.extend(element);
        }
      }
    },

    findChildElements: function(element, expressions) {
      var selector = expressions.toArray().join(', ');
      return Prototype.Selector.select(selector, element || document);
    }
  });
})();

// Credit Card Validation Javascript
// copyright 12th May 2003, by Stephen Chapman, Felgall Pty Ltd

// You have permission to copy and use this javascript provided that
// the content of the script is not changed in any way.

function validateCreditCard(s) {
    // remove non-numerics
    var v = "0123456789";
    var w = "";
    for (i=0; i < s.length; i++) {
        x = s.charAt(i);
        if (v.indexOf(x,0) != -1)
        w += x;
    }
    // validate number
    j = w.length / 2;
    k = Math.floor(j);
    m = Math.ceil(j) - k;
    c = 0;
    for (i=0; i<k; i++) {
        a = w.charAt(i*2+m) * 2;
        c += a > 9 ? Math.floor(a/10 + a%10) : a;
    }
    for (i=0; i<k+m; i++) c += w.charAt(i*2+1-m) * 1;
    return (c%10 == 0);
}


/*
* Really easy field validation with Prototype
* http://tetlaw.id.au/view/javascript/really-easy-field-validation
* Andrew Tetlaw
* Version 1.5.4.1 (2007-01-05)
*
* Copyright (c) 2007 Andrew Tetlaw
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies
* of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
* BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
* ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
* CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*
*/
var Validator = Class.create();

Validator.prototype = {
    initialize : function(className, error, test, options) {
        if(typeof test == 'function'){
            this.options = $H(options);
            this._test = test;
        } else {
            this.options = $H(test);
            this._test = function(){return true};
        }
        this.error = error || 'Validation failed.';
        this.className = className;
    },
    test : function(v, elm) {
        return (this._test(v,elm) && this.options.all(function(p){
            return Validator.methods[p.key] ? Validator.methods[p.key](v,elm,p.value) : true;
        }));
    }
}
Validator.methods = {
    pattern : function(v,elm,opt) {return Validation.get('IsEmpty').test(v) || opt.test(v)},
    minLength : function(v,elm,opt) {return v.length >= opt},
    maxLength : function(v,elm,opt) {return v.length <= opt},
    min : function(v,elm,opt) {return v >= parseFloat(opt)},
    max : function(v,elm,opt) {return v <= parseFloat(opt)},
    notOneOf : function(v,elm,opt) {return $A(opt).all(function(value) {
        return v != value;
    })},
    oneOf : function(v,elm,opt) {return $A(opt).any(function(value) {
        return v == value;
    })},
    is : function(v,elm,opt) {return v == opt},
    isNot : function(v,elm,opt) {return v != opt},
    equalToField : function(v,elm,opt) {return v == $F(opt)},
    notEqualToField : function(v,elm,opt) {return v != $F(opt)},
    include : function(v,elm,opt) {return $A(opt).all(function(value) {
        return Validation.get(value).test(v,elm);
    })}
}

var Validation = Class.create();
Validation.defaultOptions = {
    onSubmit : true,
    stopOnFirst : false,
    immediate : false,
    focusOnError : true,
    useTitles : false,
    addClassNameToContainer: false,
    containerClassName: '.input-box',
    onFormValidate : function(result, form) {},
    onElementValidate : function(result, elm) {}
};

Validation.prototype = {
    initialize : function(form, options){
        this.form = $(form);
        if (!this.form) {
            return;
        }
        this.options = Object.extend({
            onSubmit : Validation.defaultOptions.onSubmit,
            stopOnFirst : Validation.defaultOptions.stopOnFirst,
            immediate : Validation.defaultOptions.immediate,
            focusOnError : Validation.defaultOptions.focusOnError,
            useTitles : Validation.defaultOptions.useTitles,
            onFormValidate : Validation.defaultOptions.onFormValidate,
            onElementValidate : Validation.defaultOptions.onElementValidate
        }, options || {});
        if(this.options.onSubmit) Event.observe(this.form,'submit',this.onSubmit.bind(this),false);
        if(this.options.immediate) {
            Form.getElements(this.form).each(function(input) { // Thanks Mike!
                if (input.tagName.toLowerCase() == 'select') {
                    Event.observe(input, 'blur', this.onChange.bindAsEventListener(this));
                }
                if (input.type.toLowerCase() == 'radio' || input.type.toLowerCase() == 'checkbox') {
                    Event.observe(input, 'click', this.onChange.bindAsEventListener(this));
                } else {
                    Event.observe(input, 'change', this.onChange.bindAsEventListener(this));
                }
            }, this);
        }
    },
    onChange : function (ev) {
        Validation.isOnChange = true;
        Validation.validate(Event.element(ev),{
                useTitle : this.options.useTitles,
                onElementValidate : this.options.onElementValidate
        });
        Validation.isOnChange = false;
    },
    onSubmit :  function(ev){
        if(!this.validate()) Event.stop(ev);
    },
    validate : function() {
        var result = false;
        var useTitles = this.options.useTitles;
        var callback = this.options.onElementValidate;
        try {
            if(this.options.stopOnFirst) {
                result = Form.getElements(this.form).all(function(elm) {
                    if (elm.hasClassName('local-validation') && !this.isElementInForm(elm, this.form)) {
                        return true;
                    }
                    return Validation.validate(elm,{useTitle : useTitles, onElementValidate : callback});
                }, this);
            } else {
                result = Form.getElements(this.form).collect(function(elm) {
                    if (elm.hasClassName('local-validation') && !this.isElementInForm(elm, this.form)) {
                        return true;
                    }
                    return Validation.validate(elm,{useTitle : useTitles, onElementValidate : callback});
                }, this).all();
            }
        } catch (e) {
        }
        if(!result && this.options.focusOnError) {
            try{
                Form.getElements(this.form).findAll(function(elm){return $(elm).hasClassName('validation-failed')}).first().focus()
            }
            catch(e){
            }
        }
        this.options.onFormValidate(result, this.form);
        return result;
    },
    reset : function() {
        Form.getElements(this.form).each(Validation.reset);
    },
    isElementInForm : function(elm, form) {
        var domForm = elm.up('form');
        if (domForm == form) {
            return true;
        }
        return false;
    }
}

Object.extend(Validation, {
    validate : function(elm, options){
        options = Object.extend({
            useTitle : false,
            onElementValidate : function(result, elm) {}
        }, options || {});
        elm = $(elm);

        var cn = $w(elm.className);
        return result = cn.all(function(value) {
            var test = Validation.test(value,elm,options.useTitle);
            options.onElementValidate(test, elm);
            return test;
        });
    },
    insertAdvice : function(elm, advice){
        var container = $(elm).up('.field-row');
        if(container){
            Element.insert(container, {after: advice});
        } else if (elm.up('td.value')) {
            elm.up('td.value').insert({bottom: advice});
        } else if (elm.advaiceContainer && $(elm.advaiceContainer)) {
            $(elm.advaiceContainer).update(advice);
        }
        else {
            switch (elm.type.toLowerCase()) {
                case 'checkbox':
                case 'radio':
                    var p = elm.parentNode;
                    if(p) {
                        Element.insert(p, {'bottom': advice});
                    } else {
                        Element.insert(elm, {'after': advice});
                    }
                    break;
                default:
                    Element.insert(elm, {'after': advice});
            }
        }
    },
    showAdvice : function(elm, advice, adviceName){
        if(!elm.advices){
            elm.advices = new Hash();
        }
        else{
            elm.advices.each(function(pair){
                if (!advice || pair.value.id != advice.id) {
                    // hide non-current advice after delay
                    this.hideAdvice(elm, pair.value);
                }
            }.bind(this));
        }
        elm.advices.set(adviceName, advice);
        if(typeof Effect == 'undefined') {
            advice.style.display = 'block';
        } else {
            if(!advice._adviceAbsolutize) {
                new Effect.Appear(advice, {duration : 1 });
            } else {
                Position.absolutize(advice);
                advice.show();
                advice.setStyle({
                    'top':advice._adviceTop,
                    'left': advice._adviceLeft,
                    'width': advice._adviceWidth,
                    'z-index': 1000
                });
                advice.addClassName('advice-absolute');
            }
        }
    },
    hideAdvice : function(elm, advice){
        if (advice != null) {
            new Effect.Fade(advice, {duration : 1, afterFinishInternal : function() {advice.hide();}});
        }
    },
    updateCallback : function(elm, status) {
        if (typeof elm.callbackFunction != 'undefined') {
            eval(elm.callbackFunction+'(\''+elm.id+'\',\''+status+'\')');
        }
    },
    ajaxError : function(elm, errorMsg) {
        var name = 'validate-ajax';
        var advice = Validation.getAdvice(name, elm);
        if (advice == null) {
            advice = this.createAdvice(name, elm, false, errorMsg);
        }
        this.showAdvice(elm, advice, 'validate-ajax');
        this.updateCallback(elm, 'failed');

        elm.addClassName('validation-failed');
        elm.addClassName('validate-ajax');
        if (Validation.defaultOptions.addClassNameToContainer && Validation.defaultOptions.containerClassName != '') {
            var container = elm.up(Validation.defaultOptions.containerClassName);
            if (container && this.allowContainerClassName(elm)) {
                container.removeClassName('validation-passed');
                container.addClassName('validation-error');
            }
        }
    },
    allowContainerClassName: function (elm) {
        if (elm.type == 'radio' || elm.type == 'checkbox') {
            return elm.hasClassName('change-container-classname');
        }

        return true;
    },
    test : function(name, elm, useTitle) {
        var v = Validation.get(name);
        var prop = '__advice'+name.camelize();
        try {
        if(Validation.isVisible(elm) && !v.test($F(elm), elm)) {
            //if(!elm[prop]) {
                var advice = Validation.getAdvice(name, elm);
                if (advice == null) {
                    advice = this.createAdvice(name, elm, useTitle);
                }
                this.showAdvice(elm, advice, name);
                this.updateCallback(elm, 'failed');
            //}
            elm[prop] = 1;
            if (!elm.advaiceContainer) {
                elm.removeClassName('validation-passed');
                elm.addClassName('validation-failed');
            }

           if (Validation.defaultOptions.addClassNameToContainer && Validation.defaultOptions.containerClassName != '') {
                var container = elm.up(Validation.defaultOptions.containerClassName);
                if (container && this.allowContainerClassName(elm)) {
                    container.removeClassName('validation-passed');
                    container.addClassName('validation-error');
                }
            }
            return false;
        } else {
            var advice = Validation.getAdvice(name, elm);
            this.hideAdvice(elm, advice);
            this.updateCallback(elm, 'passed');
            elm[prop] = '';
            elm.removeClassName('validation-failed');
            elm.addClassName('validation-passed');
            if (Validation.defaultOptions.addClassNameToContainer && Validation.defaultOptions.containerClassName != '') {
                var container = elm.up(Validation.defaultOptions.containerClassName);
                if (container && !container.down('.validation-failed') && this.allowContainerClassName(elm)) {
                    if (!Validation.get('IsEmpty').test(elm.value) || !this.isVisible(elm)) {
                        container.addClassName('validation-passed');
                    } else {
                        container.removeClassName('validation-passed');
                    }
                    container.removeClassName('validation-error');
                }
            }
            return true;
        }
        } catch(e) {
            throw(e)
        }
    },
    isVisible : function(elm) {
        while(elm.tagName != 'BODY') {
            if(!$(elm).visible()) return false;
            elm = elm.parentNode;
        }
        return true;
    },
    getAdvice : function(name, elm) {
        return $('advice-' + name + '-' + Validation.getElmID(elm)) || $('advice-' + Validation.getElmID(elm));
    },
    createAdvice : function(name, elm, useTitle, customError) {
        var v = Validation.get(name);
        var errorMsg = useTitle ? ((elm && elm.title) ? elm.title : v.error) : v.error;
        if (customError) {
            errorMsg = customError;
        }
        try {
            if (Translator){
                errorMsg = Translator.translate(errorMsg);
            }
        }
        catch(e){}

        advice = '<div class="validation-advice" id="advice-' + name + '-' + Validation.getElmID(elm) +'" style="display:none">' + errorMsg + '</div>'


        Validation.insertAdvice(elm, advice);
        advice = Validation.getAdvice(name, elm);
        if($(elm).hasClassName('absolute-advice')) {
            var dimensions = $(elm).getDimensions();
            var originalPosition = Position.cumulativeOffset(elm);

            advice._adviceTop = (originalPosition[1] + dimensions.height) + 'px';
            advice._adviceLeft = (originalPosition[0])  + 'px';
            advice._adviceWidth = (dimensions.width)  + 'px';
            advice._adviceAbsolutize = true;
        }
        return advice;
    },
    getElmID : function(elm) {
        return elm.id ? elm.id : elm.name;
    },
    reset : function(elm) {
        elm = $(elm);
        var cn = $w(elm.className);
        cn.each(function(value) {
            var prop = '__advice'+value.camelize();
            if(elm[prop]) {
                var advice = Validation.getAdvice(value, elm);
                if (advice) {
                    advice.hide();
                }
                elm[prop] = '';
            }
            elm.removeClassName('validation-failed');
            elm.removeClassName('validation-passed');
            if (Validation.defaultOptions.addClassNameToContainer && Validation.defaultOptions.containerClassName != '') {
                var container = elm.up(Validation.defaultOptions.containerClassName);
                if (container) {
                    container.removeClassName('validation-passed');
                    container.removeClassName('validation-error');
                }
            }
        });
    },
    add : function(className, error, test, options) {
        var nv = {};
        nv[className] = new Validator(className, error, test, options);
        Object.extend(Validation.methods, nv);
    },
    addAllThese : function(validators) {
        var nv = {};
        $A(validators).each(function(value) {
                nv[value[0]] = new Validator(value[0], value[1], value[2], (value.length > 3 ? value[3] : {}));
            });
        Object.extend(Validation.methods, nv);
    },
    get : function(name) {
        return  Validation.methods[name] ? Validation.methods[name] : Validation.methods['_LikeNoIDIEverSaw_'];
    },
    methods : {
        '_LikeNoIDIEverSaw_' : new Validator('_LikeNoIDIEverSaw_','',{})
    }
});

Validation.add('IsEmpty', '', function(v) {
    return  (v == '' || (v == null) || (v.length == 0) || /^\s+$/.test(v));
});

Validation.addAllThese([
    ['validate-no-html-tags', 'HTML tags are not allowed', function(v) {
				return !/<(\/)?\w+/.test(v);
			}],
	['validate-select', 'Please select an option.', function(v) {
                return ((v != "none") && (v != null) && (v.length != 0));
            }],
    ['required-entry', 'This is a required field.', function(v) {
                return !Validation.get('IsEmpty').test(v);
            }],
    ['validate-number', 'Please enter a valid number in this field.', function(v) {
                return Validation.get('IsEmpty').test(v)
                    || (!isNaN(parseNumber(v)) && /^\s*-?\d*(\.\d*)?\s*$/.test(v));
            }],
    ['validate-number-range', 'The value is not within the specified range.', function(v, elm) {
                if (Validation.get('IsEmpty').test(v)) {
                    return true;
                }

                var numValue = parseNumber(v);
                if (isNaN(numValue)) {
                    return false;
                }

                var reRange = /^number-range-(-?[\d.,]+)?-(-?[\d.,]+)?$/,
                    result = true;

                $w(elm.className).each(function(name) {
                    var m = reRange.exec(name);
                    if (m) {
                        result = result
                            && (m[1] == null || m[1] == '' || numValue >= parseNumber(m[1]))
                            && (m[2] == null || m[2] == '' || numValue <= parseNumber(m[2]));
                    }
                });

                return result;
            }],
    ['validate-digits', 'Please use numbers only in this field. Please avoid spaces or other characters such as dots or commas.', function(v) {
                return Validation.get('IsEmpty').test(v) ||  !/[^\d]/.test(v);
            }],
    ['validate-digits-range', 'The value is not within the specified range.', function(v, elm) {
                if (Validation.get('IsEmpty').test(v)) {
                    return true;
                }

                var numValue = parseNumber(v);
                if (isNaN(numValue)) {
                    return false;
                }

                var reRange = /^digits-range-(-?\d+)?-(-?\d+)?$/,
                    result = true;

                $w(elm.className).each(function(name) {
                    var m = reRange.exec(name);
                    if (m) {
                        result = result
                            && (m[1] == null || m[1] == '' || numValue >= parseNumber(m[1]))
                            && (m[2] == null || m[2] == '' || numValue <= parseNumber(m[2]));
                    }
                });

                return result;
            }],
    ['validate-alpha', 'Please use letters only (a-z or A-Z) in this field.', function (v) {
                return Validation.get('IsEmpty').test(v) ||  /^[a-zA-Z]+$/.test(v)
            }],
    ['validate-code', 'Please use only letters (a-z), numbers (0-9) or underscore(_) in this field, first character should be a letter.', function (v) {
                return Validation.get('IsEmpty').test(v) ||  /^[a-z]+[a-z0-9_]+$/.test(v)
            }],
    ['validate-alphanum', 'Please use only letters (a-z or A-Z) or numbers (0-9) only in this field. No spaces or other characters are allowed.', function(v) {
                return Validation.get('IsEmpty').test(v) || /^[a-zA-Z0-9]+$/.test(v)
            }],
    ['validate-alphanum-with-spaces', 'Please use only letters (a-z or A-Z), numbers (0-9) or spaces only in this field.', function(v) {
                    return Validation.get('IsEmpty').test(v) || /^[a-zA-Z0-9 ]+$/.test(v)
            }],
    ['validate-street', 'Please use only letters (a-z or A-Z) or numbers (0-9) or spaces and # only in this field.', function(v) {
                return Validation.get('IsEmpty').test(v) ||  /^[ \w]{3,}([A-Za-z]\.)?([ \w]*\#\d+)?(\r\n| )[ \w]{3,}/.test(v)
            }],
    ['validate-phoneStrict', 'Please enter a valid phone number. For example (123) 456-7890 or 123-456-7890.', function(v) {
                return Validation.get('IsEmpty').test(v) || /^(\()?\d{3}(\))?(-|\s)?\d{3}(-|\s)\d{4}$/.test(v);
            }],
    ['validate-phoneLax', 'Please enter a valid phone number. For example (123) 456-7890 or 123-456-7890.', function(v) {
                return Validation.get('IsEmpty').test(v) || /^((\d[-. ]?)?((\(\d{3}\))|\d{3}))?[-. ]?\d{3}[-. ]?\d{4}$/.test(v);
            }],
    ['validate-fax', 'Please enter a valid fax number. For example (123) 456-7890 or 123-456-7890.', function(v) {
                return Validation.get('IsEmpty').test(v) || /^(\()?\d{3}(\))?(-|\s)?\d{3}(-|\s)\d{4}$/.test(v);
            }],
    ['validate-date', 'Please enter a valid date.', function(v) {
                var test = new Date(v);
                return Validation.get('IsEmpty').test(v) || !isNaN(test);
            }],
    ['validate-date-range', 'The From Date value should be less than or equal to the To Date value.', function(v, elm) {
            var m = /\bdate-range-(\w+)-(\w+)\b/.exec(elm.className);
            if (!m || m[2] == 'to' || Validation.get('IsEmpty').test(v)) {
                return true;
            }

            var currentYear = new Date().getFullYear() + '';
            var normalizedTime = function(v) {
                v = v.split(/[.\/]/);
                if (v[2] && v[2].length < 4) {
                    v[2] = currentYear.substr(0, v[2].length) + v[2];
                }
                return new Date(v.join('/')).getTime();
            };

            var dependentElements = Element.select(elm.form, '.validate-date-range.date-range-' + m[1] + '-to');
            return !dependentElements.length || Validation.get('IsEmpty').test(dependentElements[0].value)
                || normalizedTime(v) <= normalizedTime(dependentElements[0].value);
        }],
    ['validate-email', 'Please enter a valid email address. For example johndoe@domain.com.', function (v) {
                //return Validation.get('IsEmpty').test(v) || /\w{1,}[@][\w\-]{1,}([.]([\w\-]{1,})){1,3}$/.test(v)
                //return Validation.get('IsEmpty').test(v) || /^[\!\#$%\*/?|\^\{\}`~&\'\+\-=_a-z0-9][\!\#$%\*/?|\^\{\}`~&\'\+\-=_a-z0-9\.]{1,30}[\!\#$%\*/?|\^\{\}`~&\'\+\-=_a-z0-9]@([a-z0-9_-]{1,30}\.){1,5}[a-z]{2,4}$/i.test(v)
                return Validation.get('IsEmpty').test(v) || /^([a-z0-9,!\#\$%&'\*\+\/=\?\^_`\{\|\}~-]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z0-9,!\#\$%&'\*\+\/=\?\^_`\{\|\}~-]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*@([a-z0-9-]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z0-9-]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*\.(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]){2,})$/i.test(v)
            }],
    ['validate-emailSender', 'Please use only visible characters and spaces.', function (v) {
                return Validation.get('IsEmpty').test(v) ||  /^[\S ]+$/.test(v)
                    }],
    ['validate-password', 'Please enter 6 or more characters. Leading or trailing spaces will be ignored.', function(v) {
                var pass=v.strip(); /*strip leading and trailing spaces*/
                return !(pass.length>0 && pass.length < 6);
            }],
    ['validate-admin-password', 'Please enter 7 or more characters. Password should contain both numeric and alphabetic characters.', function(v) {
                var pass=v.strip();
                if (0 == pass.length) {
                    return true;
                }
                if (!(/[a-z]/i.test(v)) || !(/[0-9]/.test(v))) {
                    return false;
                }
                return !(pass.length < 7);
            }],
    ['validate-cpassword', 'Please make sure your passwords match.', function(v) {
                var conf = $('confirmation') ? $('confirmation') : $$('.validate-cpassword')[0];
                var pass = false;
                if ($('password')) {
                    pass = $('password');
                }
                var passwordElements = $$('.validate-password');
                for (var i = 0; i < passwordElements.size(); i++) {
                    var passwordElement = passwordElements[i];
                    if (passwordElement.up('form').id == conf.up('form').id) {
                        pass = passwordElement;
                    }
                }
                if ($$('.validate-admin-password').size()) {
                    pass = $$('.validate-admin-password')[0];
                }
                return (pass.value == conf.value);
            }],
    ['validate-both-passwords', 'Please make sure your passwords match.', function(v, input) {
                var dependentInput = $(input.form[input.name == 'password' ? 'confirmation' : 'password']),
                    isEqualValues  = input.value == dependentInput.value;

                if (isEqualValues && dependentInput.hasClassName('validation-failed')) {
                    Validation.test(this.className, dependentInput);
                }

                return dependentInput.value == '' || isEqualValues;
            }],
    ['validate-url', 'Please enter a valid URL. Protocol is required (http://, https:// or ftp://)', function (v) {
                v = (v || '').replace(/^\s+/, '').replace(/\s+$/, '');
                return Validation.get('IsEmpty').test(v) || /^(http|https|ftp):\/\/(([A-Z0-9]([A-Z0-9_-]*[A-Z0-9]|))(\.[A-Z0-9]([A-Z0-9_-]*[A-Z0-9]|))*)(:(\d+))?(\/[A-Z0-9~](([A-Z0-9_~-]|\.)*[A-Z0-9~]|))*\/?(.*)?$/i.test(v)
            }],
    ['validate-clean-url', 'Please enter a valid URL. For example http://www.example.com or www.example.com', function (v) {
                return Validation.get('IsEmpty').test(v) || /^(http|https|ftp):\/\/(([A-Z0-9][A-Z0-9_-]*)(\.[A-Z0-9][A-Z0-9_-]*)+.(com|org|net|dk|at|us|tv|info|uk|co.uk|biz|se)$)(:(\d+))?\/?/i.test(v) || /^(www)((\.[A-Z0-9][A-Z0-9_-]*)+.(com|org|net|dk|at|us|tv|info|uk|co.uk|biz|se)$)(:(\d+))?\/?/i.test(v)
            }],
    ['validate-identifier', 'Please enter a valid URL Key. For example "example-page", "example-page.html" or "anotherlevel/example-page".', function (v) {
                return Validation.get('IsEmpty').test(v) || /^[a-z0-9][a-z0-9_\/-]+(\.[a-z0-9_-]+)?$/.test(v)
            }],
    ['validate-xml-identifier', 'Please enter a valid XML-identifier. For example something_1, block5, id-4.', function (v) {
                return Validation.get('IsEmpty').test(v) || /^[A-Z][A-Z0-9_\/-]*$/i.test(v)
            }],
    ['validate-ssn', 'Please enter a valid social security number. For example 123-45-6789.', function(v) {
            return Validation.get('IsEmpty').test(v) || /^\d{3}-?\d{2}-?\d{4}$/.test(v);
            }],
    ['validate-zip', 'Please enter a valid zip code. For example 90602 or 90602-1234.', function(v) {
            return Validation.get('IsEmpty').test(v) || /(^\d{5}$)|(^\d{5}-\d{4}$)/.test(v);
            }],
    ['validate-zip-international', 'Please enter a valid zip code.', function(v) {
            //return Validation.get('IsEmpty').test(v) || /(^[A-z0-9]{2,10}([\s]{0,1}|[\-]{0,1})[A-z0-9]{2,10}$)/.test(v);
            return true;
            }],
    ['validate-date-au', 'Please use this date format: dd/mm/yyyy. For example 17/03/2006 for the 17th of March, 2006.', function(v) {
                if(Validation.get('IsEmpty').test(v)) return true;
                var regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                if(!regex.test(v)) return false;
                var d = new Date(v.replace(regex, '$2/$1/$3'));
                return ( parseInt(RegExp.$2, 10) == (1+d.getMonth()) ) &&
                            (parseInt(RegExp.$1, 10) == d.getDate()) &&
                            (parseInt(RegExp.$3, 10) == d.getFullYear() );
            }],
    ['validate-currency-dollar', 'Please enter a valid $ amount. For example $100.00.', function(v) {
                // [$]1[##][,###]+[.##]
                // [$]1###+[.##]
                // [$]0.##
                // [$].##
                return Validation.get('IsEmpty').test(v) ||  /^\$?\-?([1-9]{1}[0-9]{0,2}(\,[0-9]{3})*(\.[0-9]{0,2})?|[1-9]{1}\d*(\.[0-9]{0,2})?|0(\.[0-9]{0,2})?|(\.[0-9]{1,2})?)$/.test(v)
            }],
    ['validate-one-required', 'Please select one of the above options.', function (v,elm) {
                var p = elm.parentNode;
                var options = p.getElementsByTagName('INPUT');
                return $A(options).any(function(elm) {
                    return $F(elm);
                });
            }],
    ['validate-one-required-by-name', 'Please select one of the options.', function (v,elm) {
                var inputs = $$('input[name="' + elm.name.replace(/([\\"])/g, '\\$1') + '"]');

                var error = 1;
                for(var i=0;i<inputs.length;i++) {
                    if((inputs[i].type == 'checkbox' || inputs[i].type == 'radio') && inputs[i].checked == true) {
                        error = 0;
                    }

                    if(Validation.isOnChange && (inputs[i].type == 'checkbox' || inputs[i].type == 'radio')) {
                        Validation.reset(inputs[i]);
                    }
                }

                if( error == 0 ) {
                    return true;
                } else {
                    return false;
                }
            }],
    ['validate-not-negative-number', 'Please enter a number 0 or greater in this field.', function(v) {
                if (Validation.get('IsEmpty').test(v)) {
                    return true;
                }
                v = parseNumber(v);
                return !isNaN(v) && v >= 0;
            }],
    ['validate-zero-or-greater', 'Please enter a number 0 or greater in this field.', function(v) {
            return Validation.get('validate-not-negative-number').test(v);
        }],
    ['validate-greater-than-zero', 'Please enter a number greater than 0 in this field.', function(v) {
            if (Validation.get('IsEmpty').test(v)) {
                return true;
            }
            v = parseNumber(v);
            return !isNaN(v) && v > 0;
        }],
    ['validate-state', 'Please select State/Province.', function(v) {
                return (v!=0 || v == '');
            }],
    ['validate-new-password', 'Please enter 6 or more characters. Leading or trailing spaces will be ignored.', function(v) {
                if (!Validation.get('validate-password').test(v)) return false;
                if (Validation.get('IsEmpty').test(v) && v != '') return false;
                return true;
            }],
    ['validate-cc-number', 'Please enter a valid credit card number.', function(v, elm) {
                // remove non-numerics
                var ccTypeContainer = $(elm.id.substr(0,elm.id.indexOf('_cc_number')) + '_cc_type');
                if (ccTypeContainer && typeof Validation.creditCartTypes.get(ccTypeContainer.value) != 'undefined'
                        && Validation.creditCartTypes.get(ccTypeContainer.value)[2] == false) {
                    if (!Validation.get('IsEmpty').test(v) && Validation.get('validate-digits').test(v)) {
                        return true;
                    } else {
                        return false;
                    }
                }
                return validateCreditCard(v);
            }],
    ['validate-cc-type', 'Credit card number does not match credit card type.', function(v, elm) {
                // remove credit card number delimiters such as "-" and space
                elm.value = removeDelimiters(elm.value);
                v         = removeDelimiters(v);

                var ccTypeContainer = $(elm.id.substr(0,elm.id.indexOf('_cc_number')) + '_cc_type');
                if (!ccTypeContainer) {
                    return true;
                }
                var ccType = ccTypeContainer.value;

                if (typeof Validation.creditCartTypes.get(ccType) == 'undefined') {
                    return false;
                }

                // Other card type or switch or solo card
                if (Validation.creditCartTypes.get(ccType)[0]==false) {
                    return true;
                }

                var validationFailure = false;
                Validation.creditCartTypes.each(function (pair) {
                    if (pair.key == ccType) {
                        if (pair.value[0] && !v.match(pair.value[0])) {
                            validationFailure = true;
                        }
                        throw $break;
                    }
                });

                if (validationFailure) {
                    return false;
                }

                if (ccTypeContainer.hasClassName('validation-failed') && Validation.isOnChange) {
                    Validation.validate(ccTypeContainer);
                }

                return true;
            }],
     ['validate-cc-type-select', 'Card type does not match credit card number.', function(v, elm) {
                var ccNumberContainer = $(elm.id.substr(0,elm.id.indexOf('_cc_type')) + '_cc_number');
                if (Validation.isOnChange && Validation.get('IsEmpty').test(ccNumberContainer.value)) {
                    return true;
                }
                if (Validation.get('validate-cc-type').test(ccNumberContainer.value, ccNumberContainer)) {
                    Validation.validate(ccNumberContainer);
                }
                return Validation.get('validate-cc-type').test(ccNumberContainer.value, ccNumberContainer);
            }],
     ['validate-cc-exp', 'Incorrect credit card expiration date.', function(v, elm) {
                var ccExpMonth   = v;
                var ccExpYear    = $(elm.id.substr(0,elm.id.indexOf('_expiration')) + '_expiration_yr').value;
                var currentTime  = new Date();
                var currentMonth = currentTime.getMonth() + 1;
                var currentYear  = currentTime.getFullYear();
                if (ccExpMonth < currentMonth && ccExpYear == currentYear) {
                    return false;
                }
                return true;
            }],
     ['validate-cc-cvn', 'Please enter a valid credit card verification number.', function(v, elm) {
                var ccTypeContainer = $(elm.id.substr(0,elm.id.indexOf('_cc_cid')) + '_cc_type');
                if (!ccTypeContainer) {
                    return true;
                }
                var ccType = ccTypeContainer.value;

                if (typeof Validation.creditCartTypes.get(ccType) == 'undefined') {
                    return false;
                }

                var re = Validation.creditCartTypes.get(ccType)[1];

                if (v.match(re)) {
                    return true;
                }

                return false;
            }],
     ['validate-ajax', '', function(v, elm) { return true; }],
     ['validate-data', 'Please use only letters (a-z or A-Z), numbers (0-9) or underscore(_) in this field, first character should be a letter.', function (v) {
                if(v != '' && v) {
                    return /^[A-Za-z]+[A-Za-z0-9_]+$/.test(v);
                }
                return true;
            }],
     ['validate-css-length', 'Please input a valid CSS-length. For example 100px or 77pt or 20em or .5ex or 50%.', function (v) {
                if (v != '' && v) {
                    return /^[0-9\.]+(px|pt|em|ex|%)?$/.test(v) && (!(/\..*\./.test(v))) && !(/\.$/.test(v));
                }
                return true;
            }],
     ['validate-length', 'Text length does not satisfy specified text range.', function (v, elm) {
                var reMax = new RegExp(/^maximum-length-[0-9]+$/);
                var reMin = new RegExp(/^minimum-length-[0-9]+$/);
                var result = true;
                $w(elm.className).each(function(name, index) {
                    if (name.match(reMax) && result) {
                       var length = name.split('-')[2];
                       result = (v.length <= length);
                    }
                    if (name.match(reMin) && result && !Validation.get('IsEmpty').test(v)) {
                        var length = name.split('-')[2];
                        result = (v.length >= length);
                    }
                });
                return result;
            }],
     ['validate-percents', 'Please enter a number lower than 100.', {max:100}],
     ['required-file', 'Please select a file', function(v, elm) {
         var result = !Validation.get('IsEmpty').test(v);
         if (result === false) {
             ovId = elm.id + '_value';
             if ($(ovId)) {
                 result = !Validation.get('IsEmpty').test($(ovId).value);
             }
         }
         return result;
     }],
     ['validate-cc-ukss', 'Please enter issue number or start date for switch/solo card type.', function(v,elm) {
         var endposition;

         if (elm.id.match(/(.)+_cc_issue$/)) {
             endposition = elm.id.indexOf('_cc_issue');
         } else if (elm.id.match(/(.)+_start_month$/)) {
             endposition = elm.id.indexOf('_start_month');
         } else {
             endposition = elm.id.indexOf('_start_year');
         }

         var prefix = elm.id.substr(0,endposition);

         var ccTypeContainer = $(prefix + '_cc_type');

         if (!ccTypeContainer) {
               return true;
         }
         var ccType = ccTypeContainer.value;

         if(['SS','SM','SO'].indexOf(ccType) == -1){
             return true;
         }

         $(prefix + '_cc_issue').advaiceContainer
           = $(prefix + '_start_month').advaiceContainer
           = $(prefix + '_start_year').advaiceContainer
           = $(prefix + '_cc_type_ss_div').down('ul li.adv-container');

         var ccIssue   =  $(prefix + '_cc_issue').value;
         var ccSMonth  =  $(prefix + '_start_month').value;
         var ccSYear   =  $(prefix + '_start_year').value;

         var ccStartDatePresent = (ccSMonth && ccSYear) ? true : false;

         if (!ccStartDatePresent && !ccIssue){
             return false;
         }
         return true;
     }]
]);

function removeDelimiters (v) {
    v = v.replace(/\s/g, '');
    v = v.replace(/\-/g, '');
    return v;
}

function parseNumber(v)
{
    if (typeof v != 'string') {
        return parseFloat(v);
    }

    var isDot  = v.indexOf('.');
    var isComa = v.indexOf(',');

    if (isDot != -1 && isComa != -1) {
        if (isComa > isDot) {
            v = v.replace('.', '').replace(',', '.');
        }
        else {
            v = v.replace(',', '');
        }
    }
    else if (isComa != -1) {
        v = v.replace(',', '.');
    }

    return parseFloat(v);
}

/**
 * Hash with credit card types which can be simply extended in payment modules
 * 0 - regexp for card number
 * 1 - regexp for cvn
 * 2 - check or not credit card number trough Luhn algorithm by
 *     function validateCreditCard which you can find above in this file
 */
Validation.creditCartTypes = $H({
//    'SS': [new RegExp('^((6759[0-9]{12})|(5018|5020|5038|6304|6759|6761|6763[0-9]{12,19})|(49[013][1356][0-9]{12})|(6333[0-9]{12})|(6334[0-4]\d{11})|(633110[0-9]{10})|(564182[0-9]{10}))([0-9]{2,3})?$'), new RegExp('^([0-9]{3}|[0-9]{4})?$'), true],
    'SO': [new RegExp('^(6334[5-9]([0-9]{11}|[0-9]{13,14}))|(6767([0-9]{12}|[0-9]{14,15}))$'), new RegExp('^([0-9]{3}|[0-9]{4})?$'), true],
    'VI': [new RegExp('^4[0-9]{12}([0-9]{3})?$'), new RegExp('^[0-9]{3}$'), true],
    'MC': [new RegExp('^5[1-5][0-9]{14}$'), new RegExp('^[0-9]{3}$'), true],
    'AE': [new RegExp('^3[47][0-9]{13}$'), new RegExp('^[0-9]{4}$'), true],
    'DI': [new RegExp('^(30[0-5][0-9]{13}|3095[0-9]{12}|35(2[8-9][0-9]{12}|[3-8][0-9]{13})|36[0-9]{12}|3[8-9][0-9]{14}|6011(0[0-9]{11}|[2-4][0-9]{11}|74[0-9]{10}|7[7-9][0-9]{10}|8[6-9][0-9]{10}|9[0-9]{11})|62(2(12[6-9][0-9]{10}|1[3-9][0-9]{11}|[2-8][0-9]{12}|9[0-1][0-9]{11}|92[0-5][0-9]{10})|[4-6][0-9]{13}|8[2-8][0-9]{12})|6(4[4-9][0-9]{13}|5[0-9]{14}))$'), new RegExp('^[0-9]{3}$'), true],
    'JCB': [new RegExp('^(30[0-5][0-9]{13}|3095[0-9]{12}|35(2[8-9][0-9]{12}|[3-8][0-9]{13})|36[0-9]{12}|3[8-9][0-9]{14}|6011(0[0-9]{11}|[2-4][0-9]{11}|74[0-9]{10}|7[7-9][0-9]{10}|8[6-9][0-9]{10}|9[0-9]{11})|62(2(12[6-9][0-9]{10}|1[3-9][0-9]{11}|[2-8][0-9]{12}|9[0-1][0-9]{11}|92[0-5][0-9]{10})|[4-6][0-9]{13}|8[2-8][0-9]{12})|6(4[4-9][0-9]{13}|5[0-9]{14}))$'), new RegExp('^[0-9]{3,4}$'), true],
    'DICL': [new RegExp('^(30[0-5][0-9]{13}|3095[0-9]{12}|35(2[8-9][0-9]{12}|[3-8][0-9]{13})|36[0-9]{12}|3[8-9][0-9]{14}|6011(0[0-9]{11}|[2-4][0-9]{11}|74[0-9]{10}|7[7-9][0-9]{10}|8[6-9][0-9]{10}|9[0-9]{11})|62(2(12[6-9][0-9]{10}|1[3-9][0-9]{11}|[2-8][0-9]{12}|9[0-1][0-9]{11}|92[0-5][0-9]{10})|[4-6][0-9]{13}|8[2-8][0-9]{12})|6(4[4-9][0-9]{13}|5[0-9]{14}))$'), new RegExp('^[0-9]{3}$'), true],
    'SM': [new RegExp('(^(5[0678])[0-9]{11,18}$)|(^(6[^05])[0-9]{11,18}$)|(^(601)[^1][0-9]{9,16}$)|(^(6011)[0-9]{9,11}$)|(^(6011)[0-9]{13,16}$)|(^(65)[0-9]{11,13}$)|(^(65)[0-9]{15,18}$)|(^(49030)[2-9]([0-9]{10}$|[0-9]{12,13}$))|(^(49033)[5-9]([0-9]{10}$|[0-9]{12,13}$))|(^(49110)[1-2]([0-9]{10}$|[0-9]{12,13}$))|(^(49117)[4-9]([0-9]{10}$|[0-9]{12,13}$))|(^(49118)[0-2]([0-9]{10}$|[0-9]{12,13}$))|(^(4936)([0-9]{12}$|[0-9]{14,15}$))'), new RegExp('^([0-9]{3}|[0-9]{4})?$'), true],
    'OT': [false, new RegExp('^([0-9]{3}|[0-9]{4})?$'), false]
});

// script.aculo.us builder.js v1.8.2, Tue Nov 18 18:30:58 +0100 2008

// Copyright (c) 2005-2008 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

var Builder = {
  NODEMAP: {
    AREA: 'map',
    CAPTION: 'table',
    COL: 'table',
    COLGROUP: 'table',
    LEGEND: 'fieldset',
    OPTGROUP: 'select',
    OPTION: 'select',
    PARAM: 'object',
    TBODY: 'table',
    TD: 'table',
    TFOOT: 'table',
    TH: 'table',
    THEAD: 'table',
    TR: 'table'
  },
  // note: For Firefox < 1.5, OPTION and OPTGROUP tags are currently broken,
  //       due to a Firefox bug
  node: function(elementName) {
    elementName = elementName.toUpperCase();

    // try innerHTML approach
    var parentTag = this.NODEMAP[elementName] || 'div';
    var parentElement = document.createElement(parentTag);
    try { // prevent IE "feature": http://dev.rubyonrails.org/ticket/2707
      parentElement.innerHTML = "<" + elementName + "></" + elementName + ">";
    } catch(e) {}
    var element = parentElement.firstChild || null;

    // see if browser added wrapping tags
    if(element && (element.tagName.toUpperCase() != elementName))
      element = element.getElementsByTagName(elementName)[0];

    // fallback to createElement approach
    if(!element) element = document.createElement(elementName);

    // abort if nothing could be created
    if(!element) return;

    // attributes (or text)
    if(arguments[1])
      if(this._isStringOrNumber(arguments[1]) ||
        (arguments[1] instanceof Array) ||
        arguments[1].tagName) {
          this._children(element, arguments[1]);
        } else {
          var attrs = this._attributes(arguments[1]);
          if(attrs.length) {
            try { // prevent IE "feature": http://dev.rubyonrails.org/ticket/2707
              parentElement.innerHTML = "<" +elementName + " " +
                attrs + "></" + elementName + ">";
            } catch(e) {}
            element = parentElement.firstChild || null;
            // workaround firefox 1.0.X bug
            if(!element) {
              element = document.createElement(elementName);
              for(attr in arguments[1])
                element[attr == 'class' ? 'className' : attr] = arguments[1][attr];
            }
            if(element.tagName.toUpperCase() != elementName)
              element = parentElement.getElementsByTagName(elementName)[0];
          }
        }

    // text, or array of children
    if(arguments[2])
      this._children(element, arguments[2]);

     return $(element);
  },
  _text: function(text) {
     return document.createTextNode(text);
  },

  ATTR_MAP: {
    'className': 'class',
    'htmlFor': 'for'
  },

  _attributes: function(attributes) {
    var attrs = [];
    for(attribute in attributes)
      attrs.push((attribute in this.ATTR_MAP ? this.ATTR_MAP[attribute] : attribute) +
          '="' + attributes[attribute].toString().escapeHTML().gsub(/"/,'&quot;') + '"');
    return attrs.join(" ");
  },
  _children: function(element, children) {
    if(children.tagName) {
      element.appendChild(children);
      return;
    }
    if(typeof children=='object') { // array can hold nodes and text
      children.flatten().each( function(e) {
        if(typeof e=='object')
          element.appendChild(e);
        else
          if(Builder._isStringOrNumber(e))
            element.appendChild(Builder._text(e));
      });
    } else
      if(Builder._isStringOrNumber(children))
        element.appendChild(Builder._text(children));
  },
  _isStringOrNumber: function(param) {
    return(typeof param=='string' || typeof param=='number');
  },
  build: function(html) {
    var element = this.node('div');
    $(element).update(html.strip());
    return element.down();
  },
  dump: function(scope) {
    if(typeof scope != 'object' && typeof scope != 'function') scope = window; //global scope

    var tags = ("A ABBR ACRONYM ADDRESS APPLET AREA B BASE BASEFONT BDO BIG BLOCKQUOTE BODY " +
      "BR BUTTON CAPTION CENTER CITE CODE COL COLGROUP DD DEL DFN DIR DIV DL DT EM FIELDSET " +
      "FONT FORM FRAME FRAMESET H1 H2 H3 H4 H5 H6 HEAD HR HTML I IFRAME IMG INPUT INS ISINDEX "+
      "KBD LABEL LEGEND LI LINK MAP MENU META NOFRAMES NOSCRIPT OBJECT OL OPTGROUP OPTION P "+
      "PARAM PRE Q S SAMP SCRIPT SELECT SMALL SPAN STRIKE STRONG STYLE SUB SUP TABLE TBODY TD "+
      "TEXTAREA TFOOT TH THEAD TITLE TR TT U UL VAR").split(/\s+/);

    tags.each( function(tag){
      scope[tag] = function() {
        return Builder.node.apply(Builder, [tag].concat($A(arguments)));
      };
    });
  }
};
// script.aculo.us effects.js v1.8.2, Tue Nov 18 18:30:58 +0100 2008

// Copyright (c) 2005-2008 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
// Contributors:
//  Justin Palmer (http://encytemedia.com/)
//  Mark Pilgrim (http://diveintomark.org/)
//  Martin Bialasinki
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// converts rgb() and #xxx to #xxxxxx format,
// returns self (or first argument) if not convertable
String.prototype.parseColor = function() {
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {
    var cols = this.slice(4,this.length-1).split(',');
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);
  } else {
    if (this.slice(0,1) == '#') {
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();
      if (this.length==7) color = this.toLowerCase();
    }
  }
  return (color.length==7 ? color : (arguments[0] || this));
};

/*--------------------------------------------------------------------------*/

Element.collectTextNodes = function(element) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ?
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);
  element.setStyle({fontSize: (percent/100) + 'em'});
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

/*--------------------------------------------------------------------------*/

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + .5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + .75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + .5;
    },
    pulse: function(pos, pulses) {
      return (-Math.cos((pos*((pulses||5)-.5)*2)*Math.PI)/2) + .5;
    },
    spring: function(pos) {
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6));
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';

    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character),
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') ||
        Object.isFunction(element)) &&
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;

    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect) {
    element = $(element);
    effect = (effect || 'appear').toLowerCase();
    var options = Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, arguments[2] || { });
    Effect[element.visible() ?
      Effect.PAIRS[effect][1] : Effect.PAIRS[effect][0]](element, options);
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

/* ------------- core effects ------------- */

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();

    var position = Object.isString(effect.options.queue) ?
      effect.options.queue : effect.options.queue.position;

    switch(position) {
      case 'front':
        // move unstarted effects after this effect
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        // start effect after last queued effect has finished
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }

    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);

    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++)
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;

    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    function codeForEvent(options,eventName){
      return (
        (options[eventName+'Internal'] ? 'this.options.'+eventName+'Internal(this);' : '') +
        (options[eventName] ? 'this.options.'+eventName+'(this);' : '')
      );
    }
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;

    this.render = (function() {
      function dispatch(effect, eventName) {
        if (effect.options[eventName + 'Internal'])
          effect.options[eventName + 'Internal'](effect);
        if (effect.options[eventName])
          effect.options[eventName](effect);
      }

      return function(pos) {
        if (this.state === "idle") {
          this.state = "running";
          dispatch(this, 'beforeSetup');
          if (this.setup) this.setup();
          dispatch(this, 'afterSetup');
        }
        if (this.state === "running") {
          pos = (this.options.transition(pos) * this.fromToDelta) + this.options.from;
          this.position = pos;
          dispatch(this, 'beforeUpdate');
          if (this.update) this.update(pos);
          dispatch(this, 'afterUpdate');
        }
      };
    })();

    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish();
        this.event('afterFinish');
        return;
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(),
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) :
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    // make this work on IE on elements without 'layout'
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

// for backwards compatibility
Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element,
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');

    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));

    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;

    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));

    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;

    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    // Prevent executing on elements not in the layout flow
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    // Disable background image during the effect
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    // init color calculations
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
  scrollOffsets = document.viewport.getScrollOffsets(),
  elementOffsets = $(element).cumulativeOffset();

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()); }
  );
};

/* ------------- combination effects ------------- */

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) {
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity});
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  // force Safari to render floated elements properly
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show();
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = {
    opacity: element.getInlineOpacity(),
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200,
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }),
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ],
     Object.extend({ duration: 1.0,
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element);
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false,
      scaleX: false,
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      }
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, {
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) {
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      });
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }),
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned();
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        }
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}); }}); }}); }}); }}); }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  // SlideDown need to have the content of the element wrapped in a container element with fixed height!
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false,
    scaleX: false,
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

// Bug in opera makes the TD containing this element expand for a instance after finish
Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, {
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping();
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping();
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var initialMoveX, initialMoveY;
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0;
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }

  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01,
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width },
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show();
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle);
             }
           }, options)
      );
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }

  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping();
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { },
    oldOpacity = element.getInlineOpacity(),
    transition = options.transition || Effect.Transitions.linear,
    reverser   = function(pos){
      return 1 - transition((-Math.cos((pos*(options.pulses||5)*2)*Math.PI)/2) + .5);
    };

  return new Effect.Opacity(element,
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, {
      scaleContent: false,
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });

    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        };
      }
    }
    this.start(options);
  },

  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 );
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return {
        style: property.camelize(),
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0),
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      );
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] =
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) +
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' +
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');

Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }

  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]);
  });

  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(results, property) {
      results[property] = css[property];
      return results;
    });
    if (!styles.opacity) styles.opacity = element.getOpacity();
    return styles;
  };
}

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element);
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) {
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    };
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each(
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);
// script.aculo.us dragdrop.js v1.9.0, Thu Dec 23 16:54:48 -0500 2010

// Copyright (c) 2005-2010 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

if(Object.isUndefined(Effect))
  throw("dragdrop.js requires including script.aculo.us' effects.js library");

var Droppables = {
  drops: [],

  remove: function(element) {
    this.drops = this.drops.reject(function(d) { return d.element==$(element) });
  },

  add: function(element) {
    element = $(element);
    var options = Object.extend({
      greedy:     true,
      hoverclass: null,
      tree:       false
    }, arguments[1] || { });

    // cache containers
    if(options.containment) {
      options._containers = [];
      var containment = options.containment;
      if(Object.isArray(containment)) {
        containment.each( function(c) { options._containers.push($(c)) });
      } else {
        options._containers.push($(containment));
      }
    }

    if(options.accept) options.accept = [options.accept].flatten();

    Element.makePositioned(element); // fix IE
    options.element = element;

    this.drops.push(options);
  },

  findDeepestChild: function(drops) {
    deepest = drops[0];

    for (i = 1; i < drops.length; ++i)
      if (Element.isParent(drops[i].element, deepest.element))
        deepest = drops[i];

    return deepest;
  },

  isContained: function(element, drop) {
    var containmentNode;
    if(drop.tree) {
      containmentNode = element.treeNode;
    } else {
      containmentNode = element.parentNode;
    }
    return drop._containers.detect(function(c) { return containmentNode == c });
  },

  isAffected: function(point, element, drop) {
    return (
      (drop.element!=element) &&
      ((!drop._containers) ||
        this.isContained(element, drop)) &&
      ((!drop.accept) ||
        (Element.classNames(element).detect(
          function(v) { return drop.accept.include(v) } ) )) &&
      Position.within(drop.element, point[0], point[1]) );
  },

  deactivate: function(drop) {
    if(drop.hoverclass)
      Element.removeClassName(drop.element, drop.hoverclass);
    this.last_active = null;
  },

  activate: function(drop) {
    if(drop.hoverclass)
      Element.addClassName(drop.element, drop.hoverclass);
    this.last_active = drop;
  },

  show: function(point, element) {
    if(!this.drops.length) return;
    var drop, affected = [];

    this.drops.each( function(drop) {
      if(Droppables.isAffected(point, element, drop))
        affected.push(drop);
    });

    if(affected.length>0)
      drop = Droppables.findDeepestChild(affected);

    if(this.last_active && this.last_active != drop) this.deactivate(this.last_active);
    if (drop) {
      Position.within(drop.element, point[0], point[1]);
      if(drop.onHover)
        drop.onHover(element, drop.element, Position.overlap(drop.overlap, drop.element));

      if (drop != this.last_active) Droppables.activate(drop);
    }
  },

  fire: function(event, element) {
    if(!this.last_active) return;
    Position.prepare();

    if (this.isAffected([Event.pointerX(event), Event.pointerY(event)], element, this.last_active))
      if (this.last_active.onDrop) {
        this.last_active.onDrop(element, this.last_active.element, event);
        return true;
      }
  },

  reset: function() {
    if(this.last_active)
      this.deactivate(this.last_active);
  }
};

var Draggables = {
  drags: [],
  observers: [],

  register: function(draggable) {
    if(this.drags.length == 0) {
      this.eventMouseUp   = this.endDrag.bindAsEventListener(this);
      this.eventMouseMove = this.updateDrag.bindAsEventListener(this);
      this.eventKeypress  = this.keyPress.bindAsEventListener(this);

      Event.observe(document, "mouseup", this.eventMouseUp);
      Event.observe(document, "mousemove", this.eventMouseMove);
      Event.observe(document, "keypress", this.eventKeypress);
    }
    this.drags.push(draggable);
  },

  unregister: function(draggable) {
    this.drags = this.drags.reject(function(d) { return d==draggable });
    if(this.drags.length == 0) {
      Event.stopObserving(document, "mouseup", this.eventMouseUp);
      Event.stopObserving(document, "mousemove", this.eventMouseMove);
      Event.stopObserving(document, "keypress", this.eventKeypress);
    }
  },

  activate: function(draggable) {
    if(draggable.options.delay) {
      this._timeout = setTimeout(function() {
        Draggables._timeout = null;
        window.focus();
        Draggables.activeDraggable = draggable;
      }.bind(this), draggable.options.delay);
    } else {
      window.focus(); // allows keypress events if window isn't currently focused, fails for Safari
      this.activeDraggable = draggable;
    }
  },

  deactivate: function() {
    this.activeDraggable = null;
  },

  updateDrag: function(event) {
    if(!this.activeDraggable) return;
    var pointer = [Event.pointerX(event), Event.pointerY(event)];
    // Mozilla-based browsers fire successive mousemove events with
    // the same coordinates, prevent needless redrawing (moz bug?)
    if(this._lastPointer && (this._lastPointer.inspect() == pointer.inspect())) return;
    this._lastPointer = pointer;

    this.activeDraggable.updateDrag(event, pointer);
  },

  endDrag: function(event) {
    if(this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if(!this.activeDraggable) return;
    this._lastPointer = null;
    this.activeDraggable.endDrag(event);
    this.activeDraggable = null;
  },

  keyPress: function(event) {
    if(this.activeDraggable)
      this.activeDraggable.keyPress(event);
  },

  addObserver: function(observer) {
    this.observers.push(observer);
    this._cacheObserverCallbacks();
  },

  removeObserver: function(element) {  // element instead of observer fixes mem leaks
    this.observers = this.observers.reject( function(o) { return o.element==element });
    this._cacheObserverCallbacks();
  },

  notify: function(eventName, draggable, event) {  // 'onStart', 'onEnd', 'onDrag'
    if(this[eventName+'Count'] > 0)
      this.observers.each( function(o) {
        if(o[eventName]) o[eventName](eventName, draggable, event);
      });
    if(draggable.options[eventName]) draggable.options[eventName](draggable, event);
  },

  _cacheObserverCallbacks: function() {
    ['onStart','onEnd','onDrag'].each( function(eventName) {
      Draggables[eventName+'Count'] = Draggables.observers.select(
        function(o) { return o[eventName]; }
      ).length;
    });
  }
};

/*--------------------------------------------------------------------------*/

var Draggable = Class.create({
  initialize: function(element) {
    var defaults = {
      handle: false,
      reverteffect: function(element, top_offset, left_offset) {
        var dur = Math.sqrt(Math.abs(top_offset^2)+Math.abs(left_offset^2))*0.02;
        new Effect.Move(element, { x: -left_offset, y: -top_offset, duration: dur,
          queue: {scope:'_draggable', position:'end'}
        });
      },
      endeffect: function(element) {
        var toOpacity = Object.isNumber(element._opacity) ? element._opacity : 1.0;
        new Effect.Opacity(element, {duration:0.2, from:0.7, to:toOpacity,
          queue: {scope:'_draggable', position:'end'},
          afterFinish: function(){
            Draggable._dragging[element] = false
          }
        });
      },
      zindex: 1000,
      revert: false,
      quiet: false,
      scroll: false,
      scrollSensitivity: 20,
      scrollSpeed: 15,
      snap: false,  // false, or xy or [x,y] or function(x,y){ return [x,y] }
      delay: 0
    };

    if(!arguments[1] || Object.isUndefined(arguments[1].endeffect))
      Object.extend(defaults, {
        starteffect: function(element) {
          element._opacity = Element.getOpacity(element);
          Draggable._dragging[element] = true;
          new Effect.Opacity(element, {duration:0.2, from:element._opacity, to:0.7});
        }
      });

    var options = Object.extend(defaults, arguments[1] || { });

    this.element = $(element);

    if(options.handle && Object.isString(options.handle))
      this.handle = this.element.down('.'+options.handle, 0);

    if(!this.handle) this.handle = $(options.handle);
    if(!this.handle) this.handle = this.element;

    if(options.scroll && !options.scroll.scrollTo && !options.scroll.outerHTML) {
      options.scroll = $(options.scroll);
      this._isScrollChild = Element.childOf(this.element, options.scroll);
    }

    Element.makePositioned(this.element); // fix IE

    this.options  = options;
    this.dragging = false;

    this.eventMouseDown = this.initDrag.bindAsEventListener(this);
    Event.observe(this.handle, "mousedown", this.eventMouseDown);

    Draggables.register(this);
  },

  destroy: function() {
    Event.stopObserving(this.handle, "mousedown", this.eventMouseDown);
    Draggables.unregister(this);
  },

  currentDelta: function() {
    return([
      parseInt(Element.getStyle(this.element,'left') || '0'),
      parseInt(Element.getStyle(this.element,'top') || '0')]);
  },

  initDrag: function(event) {
    if(!Object.isUndefined(Draggable._dragging[this.element]) &&
      Draggable._dragging[this.element]) return;
    if(Event.isLeftClick(event)) {
      // abort on form elements, fixes a Firefox issue
      var src = Event.element(event);
      if((tag_name = src.tagName.toUpperCase()) && (
        tag_name=='INPUT' ||
        tag_name=='SELECT' ||
        tag_name=='OPTION' ||
        tag_name=='BUTTON' ||
        tag_name=='TEXTAREA')) return;

      var pointer = [Event.pointerX(event), Event.pointerY(event)];
      var pos     = this.element.cumulativeOffset();
      this.offset = [0,1].map( function(i) { return (pointer[i] - pos[i]) });

      Draggables.activate(this);
      Event.stop(event);
    }
  },

  startDrag: function(event) {
    this.dragging = true;
    if(!this.delta)
      this.delta = this.currentDelta();

    if(this.options.zindex) {
      this.originalZ = parseInt(Element.getStyle(this.element,'z-index') || 0);
      this.element.style.zIndex = this.options.zindex;
    }

    if(this.options.ghosting) {
      this._clone = this.element.cloneNode(true);
      this._originallyAbsolute = (this.element.getStyle('position') == 'absolute');
      if (!this._originallyAbsolute)
        Position.absolutize(this.element);
      this.element.parentNode.insertBefore(this._clone, this.element);
    }

    if(this.options.scroll) {
      if (this.options.scroll == window) {
        var where = this._getWindowScroll(this.options.scroll);
        this.originalScrollLeft = where.left;
        this.originalScrollTop = where.top;
      } else {
        this.originalScrollLeft = this.options.scroll.scrollLeft;
        this.originalScrollTop = this.options.scroll.scrollTop;
      }
    }

    Draggables.notify('onStart', this, event);

    if(this.options.starteffect) this.options.starteffect(this.element);
  },

  updateDrag: function(event, pointer) {
    if(!this.dragging) this.startDrag(event);

    if(!this.options.quiet){
      Position.prepare();
      Droppables.show(pointer, this.element);
    }

    Draggables.notify('onDrag', this, event);

    this.draw(pointer);
    if(this.options.change) this.options.change(this);

    if(this.options.scroll) {
      this.stopScrolling();

      var p;
      if (this.options.scroll == window) {
        with(this._getWindowScroll(this.options.scroll)) { p = [ left, top, left+width, top+height ]; }
      } else {
        p = Position.page(this.options.scroll).toArray();
        p[0] += this.options.scroll.scrollLeft + Position.deltaX;
        p[1] += this.options.scroll.scrollTop + Position.deltaY;
        p.push(p[0]+this.options.scroll.offsetWidth);
        p.push(p[1]+this.options.scroll.offsetHeight);
      }
      var speed = [0,0];
      if(pointer[0] < (p[0]+this.options.scrollSensitivity)) speed[0] = pointer[0]-(p[0]+this.options.scrollSensitivity);
      if(pointer[1] < (p[1]+this.options.scrollSensitivity)) speed[1] = pointer[1]-(p[1]+this.options.scrollSensitivity);
      if(pointer[0] > (p[2]-this.options.scrollSensitivity)) speed[0] = pointer[0]-(p[2]-this.options.scrollSensitivity);
      if(pointer[1] > (p[3]-this.options.scrollSensitivity)) speed[1] = pointer[1]-(p[3]-this.options.scrollSensitivity);
      this.startScrolling(speed);
    }

    // fix AppleWebKit rendering
    if(Prototype.Browser.WebKit) window.scrollBy(0,0);

    Event.stop(event);
  },

  finishDrag: function(event, success) {
    this.dragging = false;

    if(this.options.quiet){
      Position.prepare();
      var pointer = [Event.pointerX(event), Event.pointerY(event)];
      Droppables.show(pointer, this.element);
    }

    if(this.options.ghosting) {
      if (!this._originallyAbsolute)
        Position.relativize(this.element);
      delete this._originallyAbsolute;
      Element.remove(this._clone);
      this._clone = null;
    }

    var dropped = false;
    if(success) {
      dropped = Droppables.fire(event, this.element);
      if (!dropped) dropped = false;
    }
    if(dropped && this.options.onDropped) this.options.onDropped(this.element);
    Draggables.notify('onEnd', this, event);

    var revert = this.options.revert;
    if(revert && Object.isFunction(revert)) revert = revert(this.element);

    var d = this.currentDelta();
    if(revert && this.options.reverteffect) {
      if (dropped == 0 || revert != 'failure')
        this.options.reverteffect(this.element,
          d[1]-this.delta[1], d[0]-this.delta[0]);
    } else {
      this.delta = d;
    }

    if(this.options.zindex)
      this.element.style.zIndex = this.originalZ;

    if(this.options.endeffect)
      this.options.endeffect(this.element);

    Draggables.deactivate(this);
    Droppables.reset();
  },

  keyPress: function(event) {
    if(event.keyCode!=Event.KEY_ESC) return;
    this.finishDrag(event, false);
    Event.stop(event);
  },

  endDrag: function(event) {
    if(!this.dragging) return;
    this.stopScrolling();
    this.finishDrag(event, true);
    Event.stop(event);
  },

  draw: function(point) {
    var pos = this.element.cumulativeOffset();
    if(this.options.ghosting) {
      var r   = Position.realOffset(this.element);
      pos[0] += r[0] - Position.deltaX; pos[1] += r[1] - Position.deltaY;
    }

    var d = this.currentDelta();
    pos[0] -= d[0]; pos[1] -= d[1];

    if(this.options.scroll && (this.options.scroll != window && this._isScrollChild)) {
      pos[0] -= this.options.scroll.scrollLeft-this.originalScrollLeft;
      pos[1] -= this.options.scroll.scrollTop-this.originalScrollTop;
    }

    var p = [0,1].map(function(i){
      return (point[i]-pos[i]-this.offset[i])
    }.bind(this));

    if(this.options.snap) {
      if(Object.isFunction(this.options.snap)) {
        p = this.options.snap(p[0],p[1],this);
      } else {
      if(Object.isArray(this.options.snap)) {
        p = p.map( function(v, i) {
          return (v/this.options.snap[i]).round()*this.options.snap[i] }.bind(this));
      } else {
        p = p.map( function(v) {
          return (v/this.options.snap).round()*this.options.snap }.bind(this));
      }
    }}

    var style = this.element.style;
    if((!this.options.constraint) || (this.options.constraint=='horizontal'))
      style.left = p[0] + "px";
    if((!this.options.constraint) || (this.options.constraint=='vertical'))
      style.top  = p[1] + "px";

    if(style.visibility=="hidden") style.visibility = ""; // fix gecko rendering
  },

  stopScrolling: function() {
    if(this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
      Draggables._lastScrollPointer = null;
    }
  },

  startScrolling: function(speed) {
    if(!(speed[0] || speed[1])) return;
    this.scrollSpeed = [speed[0]*this.options.scrollSpeed,speed[1]*this.options.scrollSpeed];
    this.lastScrolled = new Date();
    this.scrollInterval = setInterval(this.scroll.bind(this), 10);
  },

  scroll: function() {
    var current = new Date();
    var delta = current - this.lastScrolled;
    this.lastScrolled = current;
    if(this.options.scroll == window) {
      with (this._getWindowScroll(this.options.scroll)) {
        if (this.scrollSpeed[0] || this.scrollSpeed[1]) {
          var d = delta / 1000;
          this.options.scroll.scrollTo( left + d*this.scrollSpeed[0], top + d*this.scrollSpeed[1] );
        }
      }
    } else {
      this.options.scroll.scrollLeft += this.scrollSpeed[0] * delta / 1000;
      this.options.scroll.scrollTop  += this.scrollSpeed[1] * delta / 1000;
    }

    Position.prepare();
    Droppables.show(Draggables._lastPointer, this.element);
    Draggables.notify('onDrag', this);
    if (this._isScrollChild) {
      Draggables._lastScrollPointer = Draggables._lastScrollPointer || $A(Draggables._lastPointer);
      Draggables._lastScrollPointer[0] += this.scrollSpeed[0] * delta / 1000;
      Draggables._lastScrollPointer[1] += this.scrollSpeed[1] * delta / 1000;
      if (Draggables._lastScrollPointer[0] < 0)
        Draggables._lastScrollPointer[0] = 0;
      if (Draggables._lastScrollPointer[1] < 0)
        Draggables._lastScrollPointer[1] = 0;
      this.draw(Draggables._lastScrollPointer);
    }

    if(this.options.change) this.options.change(this);
  },

  _getWindowScroll: function(w) {
    var T, L, W, H;
    with (w.document) {
      if (w.document.documentElement && documentElement.scrollTop) {
        T = documentElement.scrollTop;
        L = documentElement.scrollLeft;
      } else if (w.document.body) {
        T = body.scrollTop;
        L = body.scrollLeft;
      }
      if (w.innerWidth) {
        W = w.innerWidth;
        H = w.innerHeight;
      } else if (w.document.documentElement && documentElement.clientWidth) {
        W = documentElement.clientWidth;
        H = documentElement.clientHeight;
      } else {
        W = body.offsetWidth;
        H = body.offsetHeight;
      }
    }
    return { top: T, left: L, width: W, height: H };
  }
});

Draggable._dragging = { };

/*--------------------------------------------------------------------------*/

var SortableObserver = Class.create({
  initialize: function(element, observer) {
    this.element   = $(element);
    this.observer  = observer;
    this.lastValue = Sortable.serialize(this.element);
  },

  onStart: function() {
    this.lastValue = Sortable.serialize(this.element);
  },

  onEnd: function() {
    Sortable.unmark();
    if(this.lastValue != Sortable.serialize(this.element))
      this.observer(this.element)
  }
});

var Sortable = {
  SERIALIZE_RULE: /^[^_\-](?:[A-Za-z0-9\-\_]*)[_](.*)$/,

  sortables: { },

  _findRootElement: function(element) {
    while (element.tagName.toUpperCase() != "BODY") {
      if(element.id && Sortable.sortables[element.id]) return element;
      element = element.parentNode;
    }
  },

  options: function(element) {
    element = Sortable._findRootElement($(element));
    if(!element) return;
    return Sortable.sortables[element.id];
  },

  destroy: function(element){
    element = $(element);
    var s = Sortable.sortables[element.id];

    if(s) {
      Draggables.removeObserver(s.element);
      s.droppables.each(function(d){ Droppables.remove(d) });
      s.draggables.invoke('destroy');

      delete Sortable.sortables[s.element.id];
    }
  },

  create: function(element) {
    element = $(element);
    var options = Object.extend({
      element:     element,
      tag:         'li',       // assumes li children, override with tag: 'tagname'
      dropOnEmpty: false,
      tree:        false,
      treeTag:     'ul',
      overlap:     'vertical', // one of 'vertical', 'horizontal'
      constraint:  'vertical', // one of 'vertical', 'horizontal', false
      containment: element,    // also takes array of elements (or id's); or false
      handle:      false,      // or a CSS class
      only:        false,
      delay:       0,
      hoverclass:  null,
      ghosting:    false,
      quiet:       false,
      scroll:      false,
      scrollSensitivity: 20,
      scrollSpeed: 15,
      format:      this.SERIALIZE_RULE,

      // these take arrays of elements or ids and can be
      // used for better initialization performance
      elements:    false,
      handles:     false,

      onChange:    Prototype.emptyFunction,
      onUpdate:    Prototype.emptyFunction
    }, arguments[1] || { });

    // clear any old sortable with same element
    this.destroy(element);

    // build options for the draggables
    var options_for_draggable = {
      revert:      true,
      quiet:       options.quiet,
      scroll:      options.scroll,
      scrollSpeed: options.scrollSpeed,
      scrollSensitivity: options.scrollSensitivity,
      delay:       options.delay,
      ghosting:    options.ghosting,
      constraint:  options.constraint,
      handle:      options.handle };

    if(options.starteffect)
      options_for_draggable.starteffect = options.starteffect;

    if(options.reverteffect)
      options_for_draggable.reverteffect = options.reverteffect;
    else
      if(options.ghosting) options_for_draggable.reverteffect = function(element) {
        element.style.top  = 0;
        element.style.left = 0;
      };

    if(options.endeffect)
      options_for_draggable.endeffect = options.endeffect;

    if(options.zindex)
      options_for_draggable.zindex = options.zindex;

    // build options for the droppables
    var options_for_droppable = {
      overlap:     options.overlap,
      containment: options.containment,
      tree:        options.tree,
      hoverclass:  options.hoverclass,
      onHover:     Sortable.onHover
    };

    var options_for_tree = {
      onHover:      Sortable.onEmptyHover,
      overlap:      options.overlap,
      containment:  options.containment,
      hoverclass:   options.hoverclass
    };

    // fix for gecko engine
    Element.cleanWhitespace(element);

    options.draggables = [];
    options.droppables = [];

    // drop on empty handling
    if(options.dropOnEmpty || options.tree) {
      Droppables.add(element, options_for_tree);
      options.droppables.push(element);
    }

    (options.elements || this.findElements(element, options) || []).each( function(e,i) {
      var handle = options.handles ? $(options.handles[i]) :
        (options.handle ? $(e).select('.' + options.handle)[0] : e);
      options.draggables.push(
        new Draggable(e, Object.extend(options_for_draggable, { handle: handle })));
      Droppables.add(e, options_for_droppable);
      if(options.tree) e.treeNode = element;
      options.droppables.push(e);
    });

    if(options.tree) {
      (Sortable.findTreeElements(element, options) || []).each( function(e) {
        Droppables.add(e, options_for_tree);
        e.treeNode = element;
        options.droppables.push(e);
      });
    }

    // keep reference
    this.sortables[element.identify()] = options;

    // for onupdate
    Draggables.addObserver(new SortableObserver(element, options.onUpdate));

  },

  // return all suitable-for-sortable elements in a guaranteed order
  findElements: function(element, options) {
    return Element.findChildren(
      element, options.only, options.tree ? true : false, options.tag);
  },

  findTreeElements: function(element, options) {
    return Element.findChildren(
      element, options.only, options.tree ? true : false, options.treeTag);
  },

  onHover: function(element, dropon, overlap) {
    if(Element.isParent(dropon, element)) return;

    if(overlap > .33 && overlap < .66 && Sortable.options(dropon).tree) {
      return;
    } else if(overlap>0.5) {
      Sortable.mark(dropon, 'before');
      if(dropon.previousSibling != element) {
        var oldParentNode = element.parentNode;
        element.style.visibility = "hidden"; // fix gecko rendering
        dropon.parentNode.insertBefore(element, dropon);
        if(dropon.parentNode!=oldParentNode)
          Sortable.options(oldParentNode).onChange(element);
        Sortable.options(dropon.parentNode).onChange(element);
      }
    } else {
      Sortable.mark(dropon, 'after');
      var nextElement = dropon.nextSibling || null;
      if(nextElement != element) {
        var oldParentNode = element.parentNode;
        element.style.visibility = "hidden"; // fix gecko rendering
        dropon.parentNode.insertBefore(element, nextElement);
        if(dropon.parentNode!=oldParentNode)
          Sortable.options(oldParentNode).onChange(element);
        Sortable.options(dropon.parentNode).onChange(element);
      }
    }
  },

  onEmptyHover: function(element, dropon, overlap) {
    var oldParentNode = element.parentNode;
    var droponOptions = Sortable.options(dropon);

    if(!Element.isParent(dropon, element)) {
      var index;

      var children = Sortable.findElements(dropon, {tag: droponOptions.tag, only: droponOptions.only});
      var child = null;

      if(children) {
        var offset = Element.offsetSize(dropon, droponOptions.overlap) * (1.0 - overlap);

        for (index = 0; index < children.length; index += 1) {
          if (offset - Element.offsetSize (children[index], droponOptions.overlap) >= 0) {
            offset -= Element.offsetSize (children[index], droponOptions.overlap);
          } else if (offset - (Element.offsetSize (children[index], droponOptions.overlap) / 2) >= 0) {
            child = index + 1 < children.length ? children[index + 1] : null;
            break;
          } else {
            child = children[index];
            break;
          }
        }
      }

      dropon.insertBefore(element, child);

      Sortable.options(oldParentNode).onChange(element);
      droponOptions.onChange(element);
    }
  },

  unmark: function() {
    if(Sortable._marker) Sortable._marker.hide();
  },

  mark: function(dropon, position) {
    // mark on ghosting only
    var sortable = Sortable.options(dropon.parentNode);
    if(sortable && !sortable.ghosting) return;

    if(!Sortable._marker) {
      Sortable._marker =
        ($('dropmarker') || Element.extend(document.createElement('DIV'))).
          hide().addClassName('dropmarker').setStyle({position:'absolute'});
      document.getElementsByTagName("body").item(0).appendChild(Sortable._marker);
    }
    var offsets = dropon.cumulativeOffset();
    Sortable._marker.setStyle({left: offsets[0]+'px', top: offsets[1] + 'px'});

    if(position=='after')
      if(sortable.overlap == 'horizontal')
        Sortable._marker.setStyle({left: (offsets[0]+dropon.clientWidth) + 'px'});
      else
        Sortable._marker.setStyle({top: (offsets[1]+dropon.clientHeight) + 'px'});

    Sortable._marker.show();
  },

  _tree: function(element, options, parent) {
    var children = Sortable.findElements(element, options) || [];

    for (var i = 0; i < children.length; ++i) {
      var match = children[i].id.match(options.format);

      if (!match) continue;

      var child = {
        id: encodeURIComponent(match ? match[1] : null),
        element: element,
        parent: parent,
        children: [],
        position: parent.children.length,
        container: $(children[i]).down(options.treeTag)
      };

      /* Get the element containing the children and recurse over it */
      if (child.container)
        this._tree(child.container, options, child);

      parent.children.push (child);
    }

    return parent;
  },

  tree: function(element) {
    element = $(element);
    var sortableOptions = this.options(element);
    var options = Object.extend({
      tag: sortableOptions.tag,
      treeTag: sortableOptions.treeTag,
      only: sortableOptions.only,
      name: element.id,
      format: sortableOptions.format
    }, arguments[1] || { });

    var root = {
      id: null,
      parent: null,
      children: [],
      container: element,
      position: 0
    };

    return Sortable._tree(element, options, root);
  },

  /* Construct a [i] index for a particular node */
  _constructIndex: function(node) {
    var index = '';
    do {
      if (node.id) index = '[' + node.position + ']' + index;
    } while ((node = node.parent) != null);
    return index;
  },

  sequence: function(element) {
    element = $(element);
    var options = Object.extend(this.options(element), arguments[1] || { });

    return $(this.findElements(element, options) || []).map( function(item) {
      return item.id.match(options.format) ? item.id.match(options.format)[1] : '';
    });
  },

  setSequence: function(element, new_sequence) {
    element = $(element);
    var options = Object.extend(this.options(element), arguments[2] || { });

    var nodeMap = { };
    this.findElements(element, options).each( function(n) {
        if (n.id.match(options.format))
            nodeMap[n.id.match(options.format)[1]] = [n, n.parentNode];
        n.parentNode.removeChild(n);
    });

    new_sequence.each(function(ident) {
      var n = nodeMap[ident];
      if (n) {
        n[1].appendChild(n[0]);
        delete nodeMap[ident];
      }
    });
  },

  serialize: function(element) {
    element = $(element);
    var options = Object.extend(Sortable.options(element), arguments[1] || { });
    var name = encodeURIComponent(
      (arguments[1] && arguments[1].name) ? arguments[1].name : element.id);

    if (options.tree) {
      return Sortable.tree(element, arguments[1]).children.map( function (item) {
        return [name + Sortable._constructIndex(item) + "[id]=" +
                encodeURIComponent(item.id)].concat(item.children.map(arguments.callee));
      }).flatten().join('&');
    } else {
      return Sortable.sequence(element, arguments[1]).map( function(item) {
        return name + "[]=" + encodeURIComponent(item);
      }).join('&');
    }
  }
};

// Returns true if child is contained within element
Element.isParent = function(child, element) {
  if (!child.parentNode || child == element) return false;
  if (child.parentNode == element) return true;
  return Element.isParent(child.parentNode, element);
};

Element.findChildren = function(element, only, recursive, tagName) {
  if(!element.hasChildNodes()) return null;
  tagName = tagName.toUpperCase();
  if(only) only = [only].flatten();
  var elements = [];
  $A(element.childNodes).each( function(e) {
    if(e.tagName && e.tagName.toUpperCase()==tagName &&
      (!only || (Element.classNames(e).detect(function(v) { return only.include(v) }))))
        elements.push(e);
    if(recursive) {
      var grandchildren = Element.findChildren(e, only, recursive, tagName);
      if(grandchildren) elements.push(grandchildren);
    }
  });

  return (elements.length>0 ? elements.flatten() : []);
};

Element.offsetSize = function (element, type) {
  return element['offset' + ((type=='vertical' || type=='height') ? 'Height' : 'Width')];
};
// script.aculo.us controls.js v1.8.2, Tue Nov 18 18:30:58 +0100 2008

// Copyright (c) 2005-2008 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
//           (c) 2005-2008 Ivan Krstic (http://blogs.law.harvard.edu/ivan)
//           (c) 2005-2008 Jon Tirsen (http://www.tirsen.com)
// Contributors:
//  Richard Livsey
//  Rahul Bhargava
//  Rob Wills
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// Autocompleter.Base handles all the autocompletion functionality
// that's independent of the data source for autocompletion. This
// includes drawing the autocompletion menu, observing keyboard
// and mouse events, and similar.
//
// Specific autocompleters need to provide, at the very least,
// a getUpdatedChoices function that will be invoked every time
// the text inside the monitored textbox changes. This method
// should get the text for which to provide autocompletion by
// invoking this.getToken(), NOT by directly accessing
// this.element.value. This is to allow incremental tokenized
// autocompletion. Specific auto-completion logic (AJAX, etc)
// belongs in getUpdatedChoices.
//
// Tokenized incremental autocompletion is enabled automatically
// when an autocompleter is instantiated with the 'tokens' option
// in the options parameter, e.g.:
// new Ajax.Autocompleter('id','upd', '/url/', { tokens: ',' });
// will incrementally autocomplete with a comma as the token.
// Additionally, ',' in the above example can be replaced with
// a token array, e.g. { tokens: [',', '\n'] } which
// enables autocompletion on multiple tokens. This is most
// useful when one of the tokens is \n (a newline), as it
// allows smart autocompletion after linebreaks.

if(typeof Effect == 'undefined')
  throw("controls.js requires including script.aculo.us' effects.js library");

var Autocompleter = { };
Autocompleter.Base = Class.create({
  baseInitialize: function(element, update, options) {
    element          = $(element);
    this.element     = element;
    this.update      = $(update);
    this.hasFocus    = false;
    this.changed     = false;
    this.active      = false;
    this.index       = 0;
    this.entryCount  = 0;
    this.oldElementValue = this.element.value;

    if(this.setOptions)
      this.setOptions(options);
    else
      this.options = options || { };

    this.options.paramName    = this.options.paramName || this.element.name;
    this.options.tokens       = this.options.tokens || [];
    this.options.frequency    = this.options.frequency || 0.4;
    this.options.minChars     = this.options.minChars || 1;
    this.options.onShow       = this.options.onShow ||
      function(element, update){
        if(!update.style.position || update.style.position=='absolute') {
          update.style.position = 'absolute';
          Position.clone(element, update, {
            setHeight: false,
            offsetTop: element.offsetHeight
          });
        }
        Effect.Appear(update,{duration:0.15});
      };
    this.options.onHide = this.options.onHide ||
      function(element, update){ new Effect.Fade(update,{duration:0.15}) };

    if(typeof(this.options.tokens) == 'string')
      this.options.tokens = new Array(this.options.tokens);
    // Force carriage returns as token delimiters anyway
    if (!this.options.tokens.include('\n'))
      this.options.tokens.push('\n');

    this.observer = null;

    this.element.setAttribute('autocomplete','off');

    Element.hide(this.update);

    Event.observe(this.element, 'blur', this.onBlur.bindAsEventListener(this));
    Event.observe(this.element, 'keydown', this.onKeyPress.bindAsEventListener(this));
  },

  show: function() {
    if(Element.getStyle(this.update, 'display')=='none') this.options.onShow(this.element, this.update);
    if(!this.iefix &&
      (Prototype.Browser.IE) &&
      (Element.getStyle(this.update, 'position')=='absolute')) {
      new Insertion.After(this.update,
       '<iframe id="' + this.update.id + '_iefix" '+
       'style="display:none;position:absolute;filter:progid:DXImageTransform.Microsoft.Alpha(opacity=0);" ' +
       'src="javascript:false;" frameborder="0" scrolling="no"></iframe>');
      this.iefix = $(this.update.id+'_iefix');
    }
    if(this.iefix) setTimeout(this.fixIEOverlapping.bind(this), 50);
  },

  fixIEOverlapping: function() {
    Position.clone(this.update, this.iefix, {setTop:(!this.update.style.height)});
    this.iefix.style.zIndex = 1;
    this.update.style.zIndex = 2;
    Element.show(this.iefix);
  },

  hide: function() {
    this.stopIndicator();
    if(Element.getStyle(this.update, 'display')!='none') this.options.onHide(this.element, this.update);
    if(this.iefix) Element.hide(this.iefix);
  },

  startIndicator: function() {
    if(this.options.indicator) Element.show(this.options.indicator);
  },

  stopIndicator: function() {
    if(this.options.indicator) Element.hide(this.options.indicator);
  },

  onKeyPress: function(event) {
    if(this.active)
      switch(event.keyCode) {
       case Event.KEY_TAB:
       case Event.KEY_RETURN:
         this.selectEntry();
         Event.stop(event);
       case Event.KEY_ESC:
         this.hide();
         this.active = false;
         Event.stop(event);
         return;
       case Event.KEY_LEFT:
       case Event.KEY_RIGHT:
         return;
       case Event.KEY_UP:
         this.markPrevious();
         this.render();
         Event.stop(event);
         return;
       case Event.KEY_DOWN:
         this.markNext();
         this.render();
         Event.stop(event);
         return;
      }
     else
       if(event.keyCode==Event.KEY_TAB || event.keyCode==Event.KEY_RETURN ||
         (Prototype.Browser.WebKit > 0 && event.keyCode == 0)) return;

    this.changed = true;
    this.hasFocus = true;

    if(this.observer) clearTimeout(this.observer);
      this.observer =
        setTimeout(this.onObserverEvent.bind(this), this.options.frequency*1000);
  },

  activate: function() {
    this.changed = false;
    this.hasFocus = true;
    this.getUpdatedChoices();
  },

  onHover: function(event) {
    var element = Event.findElement(event, 'LI');
    if(this.index != element.autocompleteIndex)
    {
        this.index = element.autocompleteIndex;
        this.render();
    }
    Event.stop(event);
  },

  onClick: function(event) {
    var element = Event.findElement(event, 'LI');
    this.index = element.autocompleteIndex;
    this.selectEntry();
    this.hide();
  },

  onBlur: function(event) {
    // needed to make click events working
    setTimeout(this.hide.bind(this), 250);
    this.hasFocus = false;
    this.active = false;
  },

  render: function() {
    if(this.entryCount > 0) {
      for (var i = 0; i < this.entryCount; i++)
        this.index==i ?
          Element.addClassName(this.getEntry(i),"selected") :
          Element.removeClassName(this.getEntry(i),"selected");
      if(this.hasFocus) {
        this.show();
        this.active = true;
      }
    } else {
      this.active = false;
      this.hide();
    }
  },

  markPrevious: function() {
    if(this.index > 0) this.index--;
      else this.index = this.entryCount-1;
    //this.getEntry(this.index).scrollIntoView(true); useless
  },

  markNext: function() {
    if(this.index < this.entryCount-1) this.index++;
      else this.index = 0;
    this.getEntry(this.index).scrollIntoView(false);
  },

  getEntry: function(index) {
    return this.update.firstChild.childNodes[index];
  },

  getCurrentEntry: function() {
    return this.getEntry(this.index);
  },

  selectEntry: function() {
    this.active = false;
    this.updateElement(this.getCurrentEntry());
  },

  updateElement: function(selectedElement) {
    if (this.options.updateElement) {
      this.options.updateElement(selectedElement);
      return;
    }
    var value = '';
    if (this.options.select) {
      var nodes = $(selectedElement).select('.' + this.options.select) || [];
      if(nodes.length>0) value = Element.collectTextNodes(nodes[0], this.options.select);
    } else
      value = Element.collectTextNodesIgnoreClass(selectedElement, 'informal');

    var bounds = this.getTokenBounds();
    if (bounds[0] != -1) {
      var newValue = this.element.value.substr(0, bounds[0]);
      var whitespace = this.element.value.substr(bounds[0]).match(/^\s+/);
      if (whitespace)
        newValue += whitespace[0];
      this.element.value = newValue + value + this.element.value.substr(bounds[1]);
    } else {
      this.element.value = value;
    }
    this.oldElementValue = this.element.value;
    this.element.focus();

    if (this.options.afterUpdateElement)
      this.options.afterUpdateElement(this.element, selectedElement);
  },

  updateChoices: function(choices) {
    if(!this.changed && this.hasFocus) {
      this.update.innerHTML = choices;
      Element.cleanWhitespace(this.update);
      Element.cleanWhitespace(this.update.down());

      if(this.update.firstChild && this.update.down().childNodes) {
        this.entryCount =
          this.update.down().childNodes.length;
        for (var i = 0; i < this.entryCount; i++) {
          var entry = this.getEntry(i);
          entry.autocompleteIndex = i;
          this.addObservers(entry);
        }
      } else {
        this.entryCount = 0;
      }

      this.stopIndicator();
      this.index = 0;

      if(this.entryCount==1 && this.options.autoSelect) {
        this.selectEntry();
        this.hide();
      } else {
        this.render();
      }
    }
  },

  addObservers: function(element) {
    Event.observe(element, "mouseover", this.onHover.bindAsEventListener(this));
    Event.observe(element, "click", this.onClick.bindAsEventListener(this));
  },

  onObserverEvent: function() {
    this.changed = false;
    this.tokenBounds = null;
    if(this.getToken().length>=this.options.minChars) {
      this.getUpdatedChoices();
    } else {
      this.active = false;
      this.hide();
    }
    this.oldElementValue = this.element.value;
  },

  getToken: function() {
    var bounds = this.getTokenBounds();
    return this.element.value.substring(bounds[0], bounds[1]).strip();
  },

  getTokenBounds: function() {
    if (null != this.tokenBounds) return this.tokenBounds;
    var value = this.element.value;
    if (value.strip().empty()) return [-1, 0];
    var diff = arguments.callee.getFirstDifferencePos(value, this.oldElementValue);
    var offset = (diff == this.oldElementValue.length ? 1 : 0);
    var prevTokenPos = -1, nextTokenPos = value.length;
    var tp;
    for (var index = 0, l = this.options.tokens.length; index < l; ++index) {
      tp = value.lastIndexOf(this.options.tokens[index], diff + offset - 1);
      if (tp > prevTokenPos) prevTokenPos = tp;
      tp = value.indexOf(this.options.tokens[index], diff + offset);
      if (-1 != tp && tp < nextTokenPos) nextTokenPos = tp;
    }
    return (this.tokenBounds = [prevTokenPos + 1, nextTokenPos]);
  }
});

Autocompleter.Base.prototype.getTokenBounds.getFirstDifferencePos = function(newS, oldS) {
  var boundary = Math.min(newS.length, oldS.length);
  for (var index = 0; index < boundary; ++index)
    if (newS[index] != oldS[index])
      return index;
  return boundary;
};

Ajax.Autocompleter = Class.create(Autocompleter.Base, {
  initialize: function(element, update, url, options) {
    this.baseInitialize(element, update, options);
    this.options.asynchronous  = true;
    this.options.onComplete    = this.onComplete.bind(this);
    this.options.defaultParams = this.options.parameters || null;
    this.url                   = url;
  },

  getUpdatedChoices: function() {
    this.startIndicator();

    var entry = encodeURIComponent(this.options.paramName) + '=' +
      encodeURIComponent(this.getToken());

    this.options.parameters = this.options.callback ?
      this.options.callback(this.element, entry) : entry;

    if(this.options.defaultParams)
      this.options.parameters += '&' + this.options.defaultParams;

    new Ajax.Request(this.url, this.options);
  },

  onComplete: function(request) {
    this.updateChoices(request.responseText);
  }
});

// The local array autocompleter. Used when you'd prefer to
// inject an array of autocompletion options into the page, rather
// than sending out Ajax queries, which can be quite slow sometimes.
//
// The constructor takes four parameters. The first two are, as usual,
// the id of the monitored textbox, and id of the autocompletion menu.
// The third is the array you want to autocomplete from, and the fourth
// is the options block.
//
// Extra local autocompletion options:
// - choices - How many autocompletion choices to offer
//
// - partialSearch - If false, the autocompleter will match entered
//                    text only at the beginning of strings in the
//                    autocomplete array. Defaults to true, which will
//                    match text at the beginning of any *word* in the
//                    strings in the autocomplete array. If you want to
//                    search anywhere in the string, additionally set
//                    the option fullSearch to true (default: off).
//
// - fullSsearch - Search anywhere in autocomplete array strings.
//
// - partialChars - How many characters to enter before triggering
//                   a partial match (unlike minChars, which defines
//                   how many characters are required to do any match
//                   at all). Defaults to 2.
//
// - ignoreCase - Whether to ignore case when autocompleting.
//                 Defaults to true.
//
// It's possible to pass in a custom function as the 'selector'
// option, if you prefer to write your own autocompletion logic.
// In that case, the other options above will not apply unless
// you support them.

Autocompleter.Local = Class.create(Autocompleter.Base, {
  initialize: function(element, update, array, options) {
    this.baseInitialize(element, update, options);
    this.options.array = array;
  },

  getUpdatedChoices: function() {
    this.updateChoices(this.options.selector(this));
  },

  setOptions: function(options) {
    this.options = Object.extend({
      choices: 10,
      partialSearch: true,
      partialChars: 2,
      ignoreCase: true,
      fullSearch: false,
      selector: function(instance) {
        var ret       = []; // Beginning matches
        var partial   = []; // Inside matches
        var entry     = instance.getToken();
        var count     = 0;

        for (var i = 0; i < instance.options.array.length &&
          ret.length < instance.options.choices ; i++) {

          var elem = instance.options.array[i];
          var foundPos = instance.options.ignoreCase ?
            elem.toLowerCase().indexOf(entry.toLowerCase()) :
            elem.indexOf(entry);

          while (foundPos != -1) {
            if (foundPos == 0 && elem.length != entry.length) {
              ret.push("<li><strong>" + elem.substr(0, entry.length) + "</strong>" +
                elem.substr(entry.length) + "</li>");
              break;
            } else if (entry.length >= instance.options.partialChars &&
              instance.options.partialSearch && foundPos != -1) {
              if (instance.options.fullSearch || /\s/.test(elem.substr(foundPos-1,1))) {
                partial.push("<li>" + elem.substr(0, foundPos) + "<strong>" +
                  elem.substr(foundPos, entry.length) + "</strong>" + elem.substr(
                  foundPos + entry.length) + "</li>");
                break;
              }
            }

            foundPos = instance.options.ignoreCase ?
              elem.toLowerCase().indexOf(entry.toLowerCase(), foundPos + 1) :
              elem.indexOf(entry, foundPos + 1);

          }
        }
        if (partial.length)
          ret = ret.concat(partial.slice(0, instance.options.choices - ret.length));
        return "<ul>" + ret.join('') + "</ul>";
      }
    }, options || { });
  }
});

// AJAX in-place editor and collection editor
// Full rewrite by Christophe Porteneuve <tdd@tddsworld.com> (April 2007).

// Use this if you notice weird scrolling problems on some browsers,
// the DOM might be a bit confused when this gets called so do this
// waits 1 ms (with setTimeout) until it does the activation
Field.scrollFreeActivate = function(field) {
  setTimeout(function() {
    Field.activate(field);
  }, 1);
};

Ajax.InPlaceEditor = Class.create({
  initialize: function(element, url, options) {
    this.url = url;
    this.element = element = $(element);
    this.prepareOptions();
    this._controls = { };
    arguments.callee.dealWithDeprecatedOptions(options); // DEPRECATION LAYER!!!
    Object.extend(this.options, options || { });
    if (!this.options.formId && this.element.id) {
      this.options.formId = this.element.id + '-inplaceeditor';
      if ($(this.options.formId))
        this.options.formId = '';
    }
    if (this.options.externalControl)
      this.options.externalControl = $(this.options.externalControl);
    if (!this.options.externalControl)
      this.options.externalControlOnly = false;
    this._originalBackground = this.element.getStyle('background-color') || 'transparent';
    this.element.title = this.options.clickToEditText;
    this._boundCancelHandler = this.handleFormCancellation.bind(this);
    this._boundComplete = (this.options.onComplete || Prototype.emptyFunction).bind(this);
    this._boundFailureHandler = this.handleAJAXFailure.bind(this);
    this._boundSubmitHandler = this.handleFormSubmission.bind(this);
    this._boundWrapperHandler = this.wrapUp.bind(this);
    this.registerListeners();
  },
  checkForEscapeOrReturn: function(e) {
    if (!this._editing || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (Event.KEY_ESC == e.keyCode)
      this.handleFormCancellation(e);
    else if (Event.KEY_RETURN == e.keyCode)
      this.handleFormSubmission(e);
  },
  createControl: function(mode, handler, extraClasses) {
    var control = this.options[mode + 'Control'];
    var text = this.options[mode + 'Text'];
    if ('button' == control) {
      var btn = document.createElement('input');
      btn.type = 'submit';
      btn.value = text;
      btn.className = 'editor_' + mode + '_button';
      if ('cancel' == mode)
        btn.onclick = this._boundCancelHandler;
      this._form.appendChild(btn);
      this._controls[mode] = btn;
    } else if ('link' == control) {
      var link = document.createElement('a');
      link.href = '#';
      link.appendChild(document.createTextNode(text));
      link.onclick = 'cancel' == mode ? this._boundCancelHandler : this._boundSubmitHandler;
      link.className = 'editor_' + mode + '_link';
      if (extraClasses)
        link.className += ' ' + extraClasses;
      this._form.appendChild(link);
      this._controls[mode] = link;
    }
  },
  createEditField: function() {
    var text = (this.options.loadTextURL ? this.options.loadingText : this.getText());
    var fld;
    if (1 >= this.options.rows && !/\r|\n/.test(this.getText())) {
      fld = document.createElement('input');
      fld.type = 'text';
      var size = this.options.size || this.options.cols || 0;
      if (0 < size) fld.size = size;
    } else {
      fld = document.createElement('textarea');
      fld.rows = (1 >= this.options.rows ? this.options.autoRows : this.options.rows);
      fld.cols = this.options.cols || 40;
    }
    fld.name = this.options.paramName;
    fld.value = text; // No HTML breaks conversion anymore
    fld.className = 'editor_field';
    if (this.options.submitOnBlur)
      fld.onblur = this._boundSubmitHandler;
    this._controls.editor = fld;
    if (this.options.loadTextURL)
      this.loadExternalText();
    this._form.appendChild(this._controls.editor);
  },
  createForm: function() {
    var ipe = this;
    function addText(mode, condition) {
      var text = ipe.options['text' + mode + 'Controls'];
      if (!text || condition === false) return;
      ipe._form.appendChild(document.createTextNode(text));
    };
    this._form = $(document.createElement('form'));
    this._form.id = this.options.formId;
    this._form.addClassName(this.options.formClassName);
    this._form.onsubmit = this._boundSubmitHandler;
    this.createEditField();
    if ('textarea' == this._controls.editor.tagName.toLowerCase())
      this._form.appendChild(document.createElement('br'));
    if (this.options.onFormCustomization)
      this.options.onFormCustomization(this, this._form);
    addText('Before', this.options.okControl || this.options.cancelControl);
    this.createControl('ok', this._boundSubmitHandler);
    addText('Between', this.options.okControl && this.options.cancelControl);
    this.createControl('cancel', this._boundCancelHandler, 'editor_cancel');
    addText('After', this.options.okControl || this.options.cancelControl);
  },
  destroy: function() {
    if (this._oldInnerHTML)
      this.element.innerHTML = this._oldInnerHTML;
    this.leaveEditMode();
    this.unregisterListeners();
  },
  enterEditMode: function(e) {
    if (this._saving || this._editing) return;
    this._editing = true;
    this.triggerCallback('onEnterEditMode');
    if (this.options.externalControl)
      this.options.externalControl.hide();
    this.element.hide();
    this.createForm();
    this.element.parentNode.insertBefore(this._form, this.element);
    if (!this.options.loadTextURL)
      this.postProcessEditField();
    if (e) Event.stop(e);
  },
  enterHover: function(e) {
    if (this.options.hoverClassName)
      this.element.addClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onEnterHover');
  },
  getText: function() {
    return this.element.innerHTML.unescapeHTML();
  },
  handleAJAXFailure: function(transport) {
    this.triggerCallback('onFailure', transport);
    if (this._oldInnerHTML) {
      this.element.innerHTML = this._oldInnerHTML;
      this._oldInnerHTML = null;
    }
  },
  handleFormCancellation: function(e) {
    this.wrapUp();
    if (e) Event.stop(e);
  },
  handleFormSubmission: function(e) {
    var form = this._form;
    var value = $F(this._controls.editor);
    this.prepareSubmission();
    var params = this.options.callback(form, value) || '';
    if (Object.isString(params))
      params = params.toQueryParams();
    params.editorId = this.element.id;
    if (this.options.htmlResponse) {
      var options = Object.extend({ evalScripts: true }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Updater({ success: this.element }, this.url, options);
    } else {
      var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Request(this.url, options);
    }
    if (e) Event.stop(e);
  },
  leaveEditMode: function() {
    this.element.removeClassName(this.options.savingClassName);
    this.removeForm();
    this.leaveHover();
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
    if (this.options.externalControl)
      this.options.externalControl.show();
    this._saving = false;
    this._editing = false;
    this._oldInnerHTML = null;
    this.triggerCallback('onLeaveEditMode');
  },
  leaveHover: function(e) {
    if (this.options.hoverClassName)
      this.element.removeClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onLeaveHover');
  },
  loadExternalText: function() {
    this._form.addClassName(this.options.loadingClassName);
    this._controls.editor.disabled = true;
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._form.removeClassName(this.options.loadingClassName);
        var text = transport.responseText;
        if (this.options.stripLoadedTextTags)
          text = text.stripTags();
        this._controls.editor.value = text;
        this._controls.editor.disabled = false;
        this.postProcessEditField();
      }.bind(this),
      onFailure: this._boundFailureHandler
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },
  postProcessEditField: function() {
    var fpc = this.options.fieldPostCreation;
    if (fpc)
      $(this._controls.editor)['focus' == fpc ? 'focus' : 'activate']();
  },
  prepareOptions: function() {
    this.options = Object.clone(Ajax.InPlaceEditor.DefaultOptions);
    Object.extend(this.options, Ajax.InPlaceEditor.DefaultCallbacks);
    [this._extraDefaultOptions].flatten().compact().each(function(defs) {
      Object.extend(this.options, defs);
    }.bind(this));
  },
  prepareSubmission: function() {
    this._saving = true;
    this.removeForm();
    this.leaveHover();
    this.showSaving();
  },
  registerListeners: function() {
    this._listeners = { };
    var listener;
    $H(Ajax.InPlaceEditor.Listeners).each(function(pair) {
      listener = this[pair.value].bind(this);
      this._listeners[pair.key] = listener;
      if (!this.options.externalControlOnly)
        this.element.observe(pair.key, listener);
      if (this.options.externalControl)
        this.options.externalControl.observe(pair.key, listener);
    }.bind(this));
  },
  removeForm: function() {
    if (!this._form) return;
    this._form.remove();
    this._form = null;
    this._controls = { };
  },
  showSaving: function() {
    this._oldInnerHTML = this.element.innerHTML;
    this.element.innerHTML = this.options.savingText;
    this.element.addClassName(this.options.savingClassName);
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
  },
  triggerCallback: function(cbName, arg) {
    if ('function' == typeof this.options[cbName]) {
      this.options[cbName](this, arg);
    }
  },
  unregisterListeners: function() {
    $H(this._listeners).each(function(pair) {
      if (!this.options.externalControlOnly)
        this.element.stopObserving(pair.key, pair.value);
      if (this.options.externalControl)
        this.options.externalControl.stopObserving(pair.key, pair.value);
    }.bind(this));
  },
  wrapUp: function(transport) {
    this.leaveEditMode();
    // Can't use triggerCallback due to backward compatibility: requires
    // binding + direct element
    this._boundComplete(transport, this.element);
  }
});

Object.extend(Ajax.InPlaceEditor.prototype, {
  dispose: Ajax.InPlaceEditor.prototype.destroy
});

Ajax.InPlaceCollectionEditor = Class.create(Ajax.InPlaceEditor, {
  initialize: function($super, element, url, options) {
    this._extraDefaultOptions = Ajax.InPlaceCollectionEditor.DefaultOptions;
    $super(element, url, options);
  },

  createEditField: function() {
    var list = document.createElement('select');
    list.name = this.options.paramName;
    list.size = 1;
    this._controls.editor = list;
    this._collection = this.options.collection || [];
    if (this.options.loadCollectionURL)
      this.loadCollection();
    else
      this.checkForExternalText();
    this._form.appendChild(this._controls.editor);
  },

  loadCollection: function() {
    this._form.addClassName(this.options.loadingClassName);
    this.showLoadingText(this.options.loadingCollectionText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        var js = transport.responseText.strip();
        if (!/^\[.*\]$/.test(js)) // TODO: improve sanity check
          throw('Server returned an invalid collection representation.');
        this._collection = eval(js);
        this.checkForExternalText();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadCollectionURL, options);
  },

  showLoadingText: function(text) {
    this._controls.editor.disabled = true;
    var tempOption = this._controls.editor.firstChild;
    if (!tempOption) {
      tempOption = document.createElement('option');
      tempOption.value = '';
      this._controls.editor.appendChild(tempOption);
      tempOption.selected = true;
    }
    tempOption.update((text || '').stripScripts().stripTags());
  },

  checkForExternalText: function() {
    this._text = this.getText();
    if (this.options.loadTextURL)
      this.loadExternalText();
    else
      this.buildOptionList();
  },

  loadExternalText: function() {
    this.showLoadingText(this.options.loadingText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._text = transport.responseText.strip();
        this.buildOptionList();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },

  buildOptionList: function() {
    this._form.removeClassName(this.options.loadingClassName);
    this._collection = this._collection.map(function(entry) {
      return 2 === entry.length ? entry : [entry, entry].flatten();
    });
    var marker = ('value' in this.options) ? this.options.value : this._text;
    var textFound = this._collection.any(function(entry) {
      return entry[0] == marker;
    }.bind(this));
    this._controls.editor.update('');
    var option;
    this._collection.each(function(entry, index) {
      option = document.createElement('option');
      option.value = entry[0];
      option.selected = textFound ? entry[0] == marker : 0 == index;
      option.appendChild(document.createTextNode(entry[1]));
      this._controls.editor.appendChild(option);
    }.bind(this));
    this._controls.editor.disabled = false;
    Field.scrollFreeActivate(this._controls.editor);
  }
});

//**** DEPRECATION LAYER FOR InPlace[Collection]Editor! ****
//**** This only  exists for a while,  in order to  let ****
//**** users adapt to  the new API.  Read up on the new ****
//**** API and convert your code to it ASAP!            ****

Ajax.InPlaceEditor.prototype.initialize.dealWithDeprecatedOptions = function(options) {
  if (!options) return;
  function fallback(name, expr) {
    if (name in options || expr === undefined) return;
    options[name] = expr;
  };
  fallback('cancelControl', (options.cancelLink ? 'link' : (options.cancelButton ? 'button' :
    options.cancelLink == options.cancelButton == false ? false : undefined)));
  fallback('okControl', (options.okLink ? 'link' : (options.okButton ? 'button' :
    options.okLink == options.okButton == false ? false : undefined)));
  fallback('highlightColor', options.highlightcolor);
  fallback('highlightEndColor', options.highlightendcolor);
};

Object.extend(Ajax.InPlaceEditor, {
  DefaultOptions: {
    ajaxOptions: { },
    autoRows: 3,                                // Use when multi-line w/ rows == 1
    cancelControl: 'link',                      // 'link'|'button'|false
    cancelText: 'cancel',
    clickToEditText: 'Click to edit',
    externalControl: null,                      // id|elt
    externalControlOnly: false,
    fieldPostCreation: 'activate',              // 'activate'|'focus'|false
    formClassName: 'inplaceeditor-form',
    formId: null,                               // id|elt
    highlightColor: '#ffff99',
    highlightEndColor: '#ffffff',
    hoverClassName: '',
    htmlResponse: true,
    loadingClassName: 'inplaceeditor-loading',
    loadingText: 'Loading...',
    okControl: 'button',                        // 'link'|'button'|false
    okText: 'ok',
    paramName: 'value',
    rows: 1,                                    // If 1 and multi-line, uses autoRows
    savingClassName: 'inplaceeditor-saving',
    savingText: 'Saving...',
    size: 0,
    stripLoadedTextTags: false,
    submitOnBlur: false,
    textAfterControls: '',
    textBeforeControls: '',
    textBetweenControls: ''
  },
  DefaultCallbacks: {
    callback: function(form) {
      return Form.serialize(form);
    },
    onComplete: function(transport, element) {
      // For backward compatibility, this one is bound to the IPE, and passes
      // the element directly.  It was too often customized, so we don't break it.
      new Effect.Highlight(element, {
        startcolor: this.options.highlightColor, keepBackgroundImage: true });
    },
    onEnterEditMode: null,
    onEnterHover: function(ipe) {
      ipe.element.style.backgroundColor = ipe.options.highlightColor;
      if (ipe._effect)
        ipe._effect.cancel();
    },
    onFailure: function(transport, ipe) {
      alert('Error communication with the server: ' + transport.responseText.stripTags());
    },
    onFormCustomization: null, // Takes the IPE and its generated form, after editor, before controls.
    onLeaveEditMode: null,
    onLeaveHover: function(ipe) {
      ipe._effect = new Effect.Highlight(ipe.element, {
        startcolor: ipe.options.highlightColor, endcolor: ipe.options.highlightEndColor,
        restorecolor: ipe._originalBackground, keepBackgroundImage: true
      });
    }
  },
  Listeners: {
    click: 'enterEditMode',
    keydown: 'checkForEscapeOrReturn',
    mouseover: 'enterHover',
    mouseout: 'leaveHover'
  }
});

Ajax.InPlaceCollectionEditor.DefaultOptions = {
  loadingCollectionText: 'Loading options...'
};

// Delayed observer, like Form.Element.Observer,
// but waits for delay after last key input
// Ideal for live-search fields

Form.Element.DelayedObserver = Class.create({
  initialize: function(element, delay, callback) {
    this.delay     = delay || 0.5;
    this.element   = $(element);
    this.callback  = callback;
    this.timer     = null;
    this.lastValue = $F(this.element);
    Event.observe(this.element,'keyup',this.delayedListener.bindAsEventListener(this));
  },
  delayedListener: function(event) {
    if(this.lastValue == $F(this.element)) return;
    if(this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.onTimerEvent.bind(this), this.delay * 1000);
    this.lastValue = $F(this.element);
  },
  onTimerEvent: function() {
    this.timer = null;
    this.callback(this.element, $F(this.element));
  }
});
// script.aculo.us slider.js v1.8.2, Tue Nov 18 18:30:58 +0100 2008

// Copyright (c) 2005-2008 Marty Haught, Thomas Fuchs
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

if (!Control) var Control = { };

// options:
//  axis: 'vertical', or 'horizontal' (default)
//
// callbacks:
//  onChange(value)
//  onSlide(value)
Control.Slider = Class.create({
  initialize: function(handle, track, options) {
    var slider = this;

    if (Object.isArray(handle)) {
      this.handles = handle.collect( function(e) { return $(e) });
    } else {
      this.handles = [$(handle)];
    }

    this.track   = $(track);
    this.options = options || { };

    this.axis      = this.options.axis || 'horizontal';
    this.increment = this.options.increment || 1;
    this.step      = parseInt(this.options.step || '1');
    this.range     = this.options.range || $R(0,1);

    this.value     = 0; // assure backwards compat
    this.values    = this.handles.map( function() { return 0 });
    this.spans     = this.options.spans ? this.options.spans.map(function(s){ return $(s) }) : false;
    this.options.startSpan = $(this.options.startSpan || null);
    this.options.endSpan   = $(this.options.endSpan || null);

    this.restricted = this.options.restricted || false;

    this.maximum   = this.options.maximum || this.range.end;
    this.minimum   = this.options.minimum || this.range.start;

    // Will be used to align the handle onto the track, if necessary
    this.alignX = parseInt(this.options.alignX || '0');
    this.alignY = parseInt(this.options.alignY || '0');

    this.trackLength = this.maximumOffset() - this.minimumOffset();

    this.handleLength = this.isVertical() ?
      (this.handles[0].offsetHeight != 0 ?
        this.handles[0].offsetHeight : this.handles[0].style.height.replace(/px$/,"")) :
      (this.handles[0].offsetWidth != 0 ? this.handles[0].offsetWidth :
        this.handles[0].style.width.replace(/px$/,""));

    this.active   = false;
    this.dragging = false;
    this.disabled = false;

    if (this.options.disabled) this.setDisabled();

    // Allowed values array
    this.allowedValues = this.options.values ? this.options.values.sortBy(Prototype.K) : false;
    if (this.allowedValues) {
      this.minimum = this.allowedValues.min();
      this.maximum = this.allowedValues.max();
    }

    this.eventMouseDown = this.startDrag.bindAsEventListener(this);
    this.eventMouseUp   = this.endDrag.bindAsEventListener(this);
    this.eventMouseMove = this.update.bindAsEventListener(this);

    // Initialize handles in reverse (make sure first handle is active)
    this.handles.each( function(h,i) {
      i = slider.handles.length-1-i;
      slider.setValue(parseFloat(
        (Object.isArray(slider.options.sliderValue) ?
          slider.options.sliderValue[i] : slider.options.sliderValue) ||
         slider.range.start), i);
      h.makePositioned().observe("mousedown", slider.eventMouseDown);
    });

    this.track.observe("mousedown", this.eventMouseDown);
    document.observe("mouseup", this.eventMouseUp);
    $(this.track.parentNode.parentNode).observe("mousemove", this.eventMouseMove);


    this.initialized = true;
  },
  dispose: function() {
    var slider = this;
    Event.stopObserving(this.track, "mousedown", this.eventMouseDown);
    Event.stopObserving(document, "mouseup", this.eventMouseUp);
    Event.stopObserving(this.track.parentNode.parentNode, "mousemove", this.eventMouseMove);
    this.handles.each( function(h) {
      Event.stopObserving(h, "mousedown", slider.eventMouseDown);
    });
  },
  setDisabled: function(){
    this.disabled = true;
    this.track.parentNode.className = this.track.parentNode.className + ' disabled';
  },
  setEnabled: function(){
    this.disabled = false;
  },
  getNearestValue: function(value){
    if (this.allowedValues){
      if (value >= this.allowedValues.max()) return(this.allowedValues.max());
      if (value <= this.allowedValues.min()) return(this.allowedValues.min());

      var offset = Math.abs(this.allowedValues[0] - value);
      var newValue = this.allowedValues[0];
      this.allowedValues.each( function(v) {
        var currentOffset = Math.abs(v - value);
        if (currentOffset <= offset){
          newValue = v;
          offset = currentOffset;
        }
      });
      return newValue;
    }
    if (value > this.range.end) return this.range.end;
    if (value < this.range.start) return this.range.start;
    return value;
  },
  setValue: function(sliderValue, handleIdx){
    if (!this.active) {
      this.activeHandleIdx = handleIdx || 0;
      this.activeHandle    = this.handles[this.activeHandleIdx];
      this.updateStyles();
    }
    handleIdx = handleIdx || this.activeHandleIdx || 0;
    if (this.initialized && this.restricted) {
      if ((handleIdx>0) && (sliderValue<this.values[handleIdx-1]))
        sliderValue = this.values[handleIdx-1];
      if ((handleIdx < (this.handles.length-1)) && (sliderValue>this.values[handleIdx+1]))
        sliderValue = this.values[handleIdx+1];
    }
    sliderValue = this.getNearestValue(sliderValue);
    this.values[handleIdx] = sliderValue;
    this.value = this.values[0]; // assure backwards compat

    this.handles[handleIdx].style[this.isVertical() ? 'top' : 'left'] =
      this.translateToPx(sliderValue);

    this.drawSpans();
    if (!this.dragging || !this.event) this.updateFinished();
  },
  setValueBy: function(delta, handleIdx) {
    this.setValue(this.values[handleIdx || this.activeHandleIdx || 0] + delta,
      handleIdx || this.activeHandleIdx || 0);
  },
  translateToPx: function(value) {
    return Math.round(
      ((this.trackLength-this.handleLength)/(this.range.end-this.range.start)) *
      (value - this.range.start)) + "px";
  },
  translateToValue: function(offset) {
    return ((offset/(this.trackLength-this.handleLength) *
      (this.range.end-this.range.start)) + this.range.start);
  },
  getRange: function(range) {
    var v = this.values.sortBy(Prototype.K);
    range = range || 0;
    return $R(v[range],v[range+1]);
  },
  minimumOffset: function(){
    return(this.isVertical() ? this.alignY : this.alignX);
  },
  maximumOffset: function(){
    return(this.isVertical() ?
      (this.track.offsetHeight != 0 ? this.track.offsetHeight :
        this.track.style.height.replace(/px$/,"")) - this.alignY :
      (this.track.offsetWidth != 0 ? this.track.offsetWidth :
        this.track.style.width.replace(/px$/,"")) - this.alignX);
  },
  isVertical:  function(){
    return (this.axis == 'vertical');
  },
  drawSpans: function() {
    var slider = this;
    if (this.spans)
      $R(0, this.spans.length-1).each(function(r) { slider.setSpan(slider.spans[r], slider.getRange(r)) });
    if (this.options.startSpan)
      this.setSpan(this.options.startSpan,
        $R(0, this.values.length>1 ? this.getRange(0).min() : this.value ));
    if (this.options.endSpan)
      this.setSpan(this.options.endSpan,
        $R(this.values.length>1 ? this.getRange(this.spans.length-1).max() : this.value, this.maximum));
  },
  setSpan: function(span, range) {
    if (this.isVertical()) {
      span.style.top = this.translateToPx(range.start);
      span.style.height = this.translateToPx(range.end - range.start + this.range.start);
    } else {
      span.style.left = this.translateToPx(range.start);
      span.style.width = this.translateToPx(range.end - range.start + this.range.start);
    }
  },
  updateStyles: function() {
    this.handles.each( function(h){ Element.removeClassName(h, 'selected') });
    Element.addClassName(this.activeHandle, 'selected');
  },
  startDrag: function(event) {
    if (Event.isLeftClick(event)) {
      if (!this.disabled){
        this.active = true;

        var handle = Event.element(event);
        var pointer  = [Event.pointerX(event), Event.pointerY(event)];
        var track = handle;
        if (track==this.track) {
          var offsets  = Position.cumulativeOffset(this.track);
          this.event = event;
          this.setValue(this.translateToValue(
           (this.isVertical() ? pointer[1]-offsets[1] : pointer[0]-offsets[0])-(this.handleLength/2)
          ));
          var offsets  = Position.cumulativeOffset(this.activeHandle);
          this.offsetX = (pointer[0] - offsets[0]);
          this.offsetY = (pointer[1] - offsets[1]);
        } else {
          // find the handle (prevents issues with Safari)
          while((this.handles.indexOf(handle) == -1) && handle.parentNode)
            handle = handle.parentNode;

          if (this.handles.indexOf(handle)!=-1) {
            this.activeHandle    = handle;
            this.activeHandleIdx = this.handles.indexOf(this.activeHandle);
            this.updateStyles();

            var offsets  = Position.cumulativeOffset(this.activeHandle);
            this.offsetX = (pointer[0] - offsets[0]);
            this.offsetY = (pointer[1] - offsets[1]);
          }
        }
      }
      Event.stop(event);
    }
  },
  update: function(event) {
   if (this.active) {
      if (!this.dragging) this.dragging = true;
      this.draw(event);
      if (Prototype.Browser.WebKit) window.scrollBy(0,0);
      Event.stop(event);
   }
  },
  draw: function(event) {
    var pointer = [Event.pointerX(event), Event.pointerY(event)];
    var offsets = Position.cumulativeOffset(this.track);
    pointer[0] -= this.offsetX + offsets[0];
    pointer[1] -= this.offsetY + offsets[1];
    this.event = event;
    this.setValue(this.translateToValue( this.isVertical() ? pointer[1] : pointer[0] ));
    if (this.initialized && this.options.onSlide)
      this.options.onSlide(this.values.length>1 ? this.values : this.value, this);
  },
  endDrag: function(event) {
    if (this.active && this.dragging) {
      this.finishDrag(event, true);
      Event.stop(event);
    }
    this.active = false;
    this.dragging = false;
  },
  finishDrag: function(event, success) {
    this.active = false;
    this.dragging = false;
    this.updateFinished();
  },
  updateFinished: function() {
    if (this.initialized && this.options.onChange)
      this.options.onChange(this.values.length>1 ? this.values : this.value, this);
    this.event = null;
  }
});
/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Varien
 * @package     js
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */
function popWin(url,win,para) {
    var win = window.open(url,win,para);
    win.focus();
}

function setLocation(url){
    window.location.href = url;
}

function setPLocation(url, setFocus){
    if( setFocus ) {
        window.opener.focus();
    }
    window.opener.location.href = url;
}

function setLanguageCode(code, fromCode){
    //TODO: javascript cookies have different domain and path than php cookies
    var href = window.location.href;
    var after = '', dash;
    if (dash = href.match(/\#(.*)$/)) {
        href = href.replace(/\#(.*)$/, '');
        after = dash[0];
    }

    if (href.match(/[?]/)) {
        var re = /([?&]store=)[a-z0-9_]*/;
        if (href.match(re)) {
            href = href.replace(re, '$1'+code);
        } else {
            href += '&store='+code;
        }

        var re = /([?&]from_store=)[a-z0-9_]*/;
        if (href.match(re)) {
            href = href.replace(re, '');
        }
    } else {
        href += '?store='+code;
    }
    if (typeof(fromCode) != 'undefined') {
        href += '&from_store='+fromCode;
    }
    href += after;

    setLocation(href);
}

/**
 * Add classes to specified elements.
 * Supported classes are: 'odd', 'even', 'first', 'last'
 *
 * @param elements - array of elements to be decorated
 * [@param decorateParams] - array of classes to be set. If omitted, all available will be used
 */
function decorateGeneric(elements, decorateParams)
{
    var allSupportedParams = ['odd', 'even', 'first', 'last'];
    var _decorateParams = {};
    var total = elements.length;

    if (total) {
        // determine params called
        if (typeof(decorateParams) == 'undefined') {
            decorateParams = allSupportedParams;
        }
        if (!decorateParams.length) {
            return;
        }
        for (var k in allSupportedParams) {
            _decorateParams[allSupportedParams[k]] = false;
        }
        for (var k in decorateParams) {
            _decorateParams[decorateParams[k]] = true;
        }

        // decorate elements
        // elements[0].addClassName('first'); // will cause bug in IE (#5587)
        if (_decorateParams.first) {
            Element.addClassName(elements[0], 'first');
        }
        if (_decorateParams.last) {
            Element.addClassName(elements[total-1], 'last');
        }
        for (var i = 0; i < total; i++) {
            if ((i + 1) % 2 == 0) {
                if (_decorateParams.even) {
                    Element.addClassName(elements[i], 'even');
                }
            }
            else {
                if (_decorateParams.odd) {
                    Element.addClassName(elements[i], 'odd');
                }
            }
        }
    }
}

/**
 * Decorate table rows and cells, tbody etc
 * @see decorateGeneric()
 */
function decorateTable(table, options) {
    var table = $(table);
    if (table) {
        // set default options
        var _options = {
            'tbody'    : false,
            'tbody tr' : ['odd', 'even', 'first', 'last'],
            'thead tr' : ['first', 'last'],
            'tfoot tr' : ['first', 'last'],
            'tr td'    : ['last']
        };
        // overload options
        if (typeof(options) != 'undefined') {
            for (var k in options) {
                _options[k] = options[k];
            }
        }
        // decorate
        if (_options['tbody']) {
            decorateGeneric(table.select('tbody'), _options['tbody']);
        }
        if (_options['tbody tr']) {
            decorateGeneric(table.select('tbody tr'), _options['tbody tr']);
        }
        if (_options['thead tr']) {
            decorateGeneric(table.select('thead tr'), _options['thead tr']);
        }
        if (_options['tfoot tr']) {
            decorateGeneric(table.select('tfoot tr'), _options['tfoot tr']);
        }
        if (_options['tr td']) {
            var allRows = table.select('tr');
            if (allRows.length) {
                for (var i = 0; i < allRows.length; i++) {
                    decorateGeneric(allRows[i].getElementsByTagName('TD'), _options['tr td']);
                }
            }
        }
    }
}

/**
 * Set "odd", "even" and "last" CSS classes for list items
 * @see decorateGeneric()
 */
function decorateList(list, nonRecursive) {
    if ($(list)) {
        if (typeof(nonRecursive) == 'undefined') {
            var items = $(list).select('li')
        }
        else {
            var items = $(list).childElements();
        }
        decorateGeneric(items, ['odd', 'even', 'last']);
    }
}

/**
 * Set "odd", "even" and "last" CSS classes for list items
 * @see decorateGeneric()
 */
function decorateDataList(list) {
    list = $(list);
    if (list) {
        decorateGeneric(list.select('dt'), ['odd', 'even', 'last']);
        decorateGeneric(list.select('dd'), ['odd', 'even', 'last']);
    }
}

/**
 * Parse SID and produces the correct URL
 */
function parseSidUrl(baseUrl, urlExt) {
    var sidPos = baseUrl.indexOf('/?SID=');
    var sid = '';
    urlExt = (urlExt != undefined) ? urlExt : '';

    if(sidPos > -1) {
        sid = '?' + baseUrl.substring(sidPos + 2);
        baseUrl = baseUrl.substring(0, sidPos + 1);
    }

    return baseUrl+urlExt+sid;
}

/**
 * Formats currency using patern
 * format - JSON (pattern, decimal, decimalsDelimeter, groupsDelimeter)
 * showPlus - true (always show '+'or '-'),
 *      false (never show '-' even if number is negative)
 *      null (show '-' if number is negative)
 */

function formatCurrency(price, format, showPlus){
    var precision = isNaN(format.precision = Math.abs(format.precision)) ? 2 : format.precision;
    var requiredPrecision = isNaN(format.requiredPrecision = Math.abs(format.requiredPrecision)) ? 2 : format.requiredPrecision;

    //precision = (precision > requiredPrecision) ? precision : requiredPrecision;
    //for now we don't need this difference so precision is requiredPrecision
    precision = requiredPrecision;

    var integerRequired = isNaN(format.integerRequired = Math.abs(format.integerRequired)) ? 1 : format.integerRequired;

    var decimalSymbol = format.decimalSymbol == undefined ? "," : format.decimalSymbol;
    var groupSymbol = format.groupSymbol == undefined ? "." : format.groupSymbol;
    var groupLength = format.groupLength == undefined ? 3 : format.groupLength;

    var s = '';

    if (showPlus == undefined || showPlus == true) {
        s = price < 0 ? "-" : ( showPlus ? "+" : "");
    } else if (showPlus == false) {
        s = '';
    }

    var i = parseInt(price = Math.abs(+price || 0).toFixed(precision)) + "";
    var pad = (i.length < integerRequired) ? (integerRequired - i.length) : 0;
    while (pad) { i = '0' + i; pad--; }
    j = (j = i.length) > groupLength ? j % groupLength : 0;
    re = new RegExp("(\\d{" + groupLength + "})(?=\\d)", "g");

    /**
     * replace(/-/, 0) is only for fixing Safari bug which appears
     * when Math.abs(0).toFixed() executed on "0" number.
     * Result is "0.-0" :(
     */
    var r = (j ? i.substr(0, j) + groupSymbol : "") + i.substr(j).replace(re, "$1" + groupSymbol) + (precision ? decimalSymbol + Math.abs(price - i).toFixed(precision).replace(/-/, 0).slice(2) : "")
    var pattern = '';
    if (format.pattern.indexOf('{sign}') == -1) {
        pattern = s + format.pattern;
    } else {
        pattern = format.pattern.replace('{sign}', s);
    }

    return pattern.replace('%s', r).replace(/^\s\s*/, '').replace(/\s\s*$/, '');
};

function expandDetails(el, childClass) {
    if (Element.hasClassName(el,'show-details')) {
        $$(childClass).each(function(item){item.hide()});
        Element.removeClassName(el,'show-details');
    }
    else {
        $$(childClass).each(function(item){item.show()});
        Element.addClassName(el,'show-details');
    }
}

// Version 1.0
var isIE = navigator.appVersion.match(/MSIE/) == "MSIE";

if (!window.Varien)
    var Varien = new Object();

Varien.showLoading = function(){
    var loader = $('loading-process');
    loader && loader.show();
}
Varien.hideLoading = function(){
    var loader = $('loading-process');
    loader && loader.hide();
}
Varien.GlobalHandlers = {
    onCreate: function() {
        Varien.showLoading();
    },

    onComplete: function() {
        if(Ajax.activeRequestCount == 0) {
            Varien.hideLoading();
        }
    }
};

Ajax.Responders.register(Varien.GlobalHandlers);

/**
 * Quick Search form client model
 */
Varien.searchForm = Class.create();
Varien.searchForm.prototype = {
    initialize : function(form, field, emptyText){
        this.form   = $(form);
        this.field  = $(field);
        this.emptyText = emptyText;

        Event.observe(this.form,  'submit', this.submit.bind(this));
        Event.observe(this.field, 'focus', this.focus.bind(this));
        Event.observe(this.field, 'blur', this.blur.bind(this));
        this.blur();
    },

    submit : function(event){
        if (this.field.value == this.emptyText || this.field.value == ''){
            Event.stop(event);
            return false;
        }
        return true;
    },

    focus : function(event){
        if(this.field.value==this.emptyText){
            this.field.value='';
        }

    },

    blur : function(event){
        if(this.field.value==''){
            this.field.value=this.emptyText;
        }
    },

    initAutocomplete : function(url, destinationElement){
        new Ajax.Autocompleter(
            this.field,
            destinationElement,
            url,
            {
                paramName: this.field.name,
                method: 'get',
                minChars: 2,
                updateElement: this._selectAutocompleteItem.bind(this),
                onShow : function(element, update) {
                    if(!update.style.position || update.style.position=='absolute') {
                        update.style.position = 'absolute';
                        Position.clone(element, update, {
                            setHeight: false,
                            offsetTop: element.offsetHeight
                        });
                    }
                    Effect.Appear(update,{duration:0});
                }

            }
        );
    },

    _selectAutocompleteItem : function(element){
        if(element.title){
            this.field.value = element.title;
        }
        this.form.submit();
    }
}

Varien.Tabs = Class.create();
Varien.Tabs.prototype = {
  initialize: function(selector) {
    var self=this;
    $$(selector+' a').each(this.initTab.bind(this));
  },

  initTab: function(el) {
      el.href = 'javascript:void(0)';
      if ($(el.parentNode).hasClassName('active')) {
        this.showContent(el);
      }
      el.observe('click', this.showContent.bind(this, el));
  },

  showContent: function(a) {
    var li = $(a.parentNode), ul = $(li.parentNode);
    ul.getElementsBySelector('li', 'ol').each(function(el){
      var contents = $(el.id+'_contents');
      if (el==li) {
        el.addClassName('active');
        contents.show();
      } else {
        el.removeClassName('active');
        contents.hide();
      }
    });
  }
}

Varien.DateElement = Class.create();
Varien.DateElement.prototype = {
    initialize: function(type, content, required, format) {
        if (type == 'id') {
            // id prefix
            this.day    = $(content + 'day');
            this.month  = $(content + 'month');
            this.year   = $(content + 'year');
            this.full   = $(content + 'full');
            this.advice = $(content + 'date-advice');
        } else if (type == 'container') {
            // content must be container with data
            this.day    = content.day;
            this.month  = content.month;
            this.year   = content.year;
            this.full   = content.full;
            this.advice = content.advice;
        } else {
            return;
        }

        this.required = required;
        this.format   = format;

        this.day.addClassName('validate-custom');
        this.day.validate = this.validate.bind(this);
        this.month.addClassName('validate-custom');
        this.month.validate = this.validate.bind(this);
        this.year.addClassName('validate-custom');
        this.year.validate = this.validate.bind(this);

        this.setDateRange(false, false);
        this.year.setAttribute('autocomplete','off');

        this.advice.hide();
    },
    validate: function() {
        var error = false,
            day   = parseInt(this.day.value, 10)   || 0,
            month = parseInt(this.month.value, 10) || 0,
            year  = parseInt(this.year.value, 10)  || 0;
        if (this.day.value.strip().empty()
            && this.month.value.strip().empty()
            && this.year.value.strip().empty()
        ) {
            if (this.required) {
                error = 'This date is a required value.';
            } else {
                this.full.value = '';
            }
        } else if (!day || !month || !year) {
            error = 'Please enter a valid full date.';
        } else {
            var date = new Date, countDaysInMonth = 0, errorType = null;
            date.setYear(year);date.setMonth(month-1);date.setDate(32);
            countDaysInMonth = 32 - date.getDate();
            if(!countDaysInMonth || countDaysInMonth>31) countDaysInMonth = 31;

            if (day<1 || day>countDaysInMonth) {
                errorType = 'day';
                error = 'Please enter a valid day (1-%d).';
            } else if (month<1 || month>12) {
                errorType = 'month';
                error = 'Please enter a valid month (1-12).';
            } else {
                if(day % 10 == day) this.day.value = '0'+day;
                if(month % 10 == month) this.month.value = '0'+month;
                this.full.value = this.format.replace(/%[mb]/i, this.month.value).replace(/%[de]/i, this.day.value).replace(/%y/i, this.year.value);
                var testFull = this.month.value + '/' + this.day.value + '/'+ this.year.value;
                var test = new Date(testFull);
                if (isNaN(test)) {
                    error = 'Please enter a valid date.';
                } else {
                    this.setFullDate(test);
                }
            }
            var valueError = false;
            if (!error && !this.validateData()){//(year<1900 || year>curyear) {
                errorType = this.validateDataErrorType;//'year';
                valueError = this.validateDataErrorText;//'Please enter a valid year (1900-%d).';
                error = valueError;
            }
        }

        if (error !== false) {
            try {
                error = Translator.translate(error);
            }
            catch (e) {}
            if (!valueError) {
                this.advice.innerHTML = error.replace('%d', countDaysInMonth);
            } else {
                this.advice.innerHTML = this.errorTextModifier(error);
            }
            this.advice.show();
            return false;
        }

        // fixing elements class
        this.day.removeClassName('validation-failed');
        this.month.removeClassName('validation-failed');
        this.year.removeClassName('validation-failed');

        this.advice.hide();
        return true;
    },
    validateData: function() {
        var year = this.fullDate.getFullYear();
        var date = new Date;
        this.curyear = date.getFullYear();
        return (year>=1900 && year<=this.curyear);
    },
    validateDataErrorType: 'year',
    validateDataErrorText: 'Please enter a valid year (1900-%d).',
    errorTextModifier: function(text) {
        return text.replace('%d', this.curyear);
    },
    setDateRange: function(minDate, maxDate) {
        this.minDate = minDate;
        this.maxDate = maxDate;
    },
    setFullDate: function(date) {
        this.fullDate = date;
    }
};

Varien.DOB = Class.create();
Varien.DOB.prototype = {
    initialize: function(selector, required, format) {
        var el = $$(selector)[0];
        var container       = {};
        container.day       = Element.select(el, '.dob-day input')[0];
        container.month     = Element.select(el, '.dob-month input')[0];
        container.year      = Element.select(el, '.dob-year input')[0];
        container.full      = Element.select(el, '.dob-full input')[0];
        container.advice    = Element.select(el, '.validation-advice')[0];

        new Varien.DateElement('container', container, required, format);
    }
};

Varien.dateRangeDate = Class.create();
Varien.dateRangeDate.prototype = Object.extend(new Varien.DateElement(), {
    validateData: function() {
        var validate = true;
        if (this.minDate || this.maxValue) {
            if (this.minDate) {
                this.minDate = new Date(this.minDate);
                this.minDate.setHours(0);
                if (isNaN(this.minDate)) {
                    this.minDate = new Date('1/1/1900');
                }
                validate = validate && (this.fullDate >= this.minDate)
            }
            if (this.maxDate) {
                this.maxDate = new Date(this.maxDate)
                this.minDate.setHours(0);
                if (isNaN(this.maxDate)) {
                    this.maxDate = new Date();
                }
                validate = validate && (this.fullDate <= this.maxDate)
            }
            if (this.maxDate && this.minDate) {
                this.validateDataErrorText = 'Please enter a valid date between %s and %s';
            } else if (this.maxDate) {
                this.validateDataErrorText = 'Please enter a valid date less than or equal to %s';
            } else if (this.minDate) {
                this.validateDataErrorText = 'Please enter a valid date equal to or greater than %s';
            } else {
                this.validateDataErrorText = '';
            }
        }
        return validate;
    },
    validateDataErrorText: 'Date should be between %s and %s',
    errorTextModifier: function(text) {
        if (this.minDate) {
            text = text.sub('%s', this.dateFormat(this.minDate));
        }
        if (this.maxDate) {
            text = text.sub('%s', this.dateFormat(this.maxDate));
        }
        return text;
    },
    dateFormat: function(date) {
        return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    }
});

Varien.FileElement = Class.create();
Varien.FileElement.prototype = {
    initialize: function (id) {
        this.fileElement = $(id);
        this.hiddenElement = $(id + '_value');

        this.fileElement.observe('change', this.selectFile.bind(this));
    },
    selectFile: function(event) {
        this.hiddenElement.value = this.fileElement.getValue();
    }
};

Validation.addAllThese([
    ['validate-custom', ' ', function(v,elm) {
        return elm.validate();
    }]
]);

function truncateOptions() {
    $$('.truncated').each(function(element){
        Event.observe(element, 'mouseover', function(){
            if (element.down('div.truncated_full_value')) {
                element.down('div.truncated_full_value').addClassName('show')
            }
        });
        Event.observe(element, 'mouseout', function(){
            if (element.down('div.truncated_full_value')) {
                element.down('div.truncated_full_value').removeClassName('show')
            }
        });

    });
}
Event.observe(window, 'load', function(){
   truncateOptions();
});

Element.addMethods({
    getInnerText: function(element)
    {
        element = $(element);
        if(element.innerText && !Prototype.Browser.Opera) {
            return element.innerText
        }
        return element.innerHTML.stripScripts().unescapeHTML().replace(/[\n\r\s]+/g, ' ').strip();
    }
});

/*
if (!("console" in window) || !("firebug" in console))
{
    var names = ["log", "debug", "info", "warn", "error", "assert", "dir", "dirxml",
    "group", "groupEnd", "time", "timeEnd", "count", "trace", "profile", "profileEnd"];

    window.console = {};
    for (var i = 0; i < names.length; ++i)
        window.console[names[i]] = function() {}
}
*/

/**
 * Executes event handler on the element. Works with event handlers attached by Prototype,
 * in a browser-agnostic fashion.
 * @param element The element object
 * @param event Event name, like 'change'
 *
 * @example fireEvent($('my-input', 'click'));
 */
function fireEvent(element, event) {
    if (document.createEvent) {
        // dispatch for all browsers except IE before version 9
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent(event, true, true ); // event type, bubbling, cancelable
        return element.dispatchEvent(evt);
    } else {
        // dispatch for IE before version 9
        var evt = document.createEventObject();
        return element.fireEvent('on' + event, evt)
    }
}

/**
 * Returns more accurate results of floating-point modulo division
 * E.g.:
 * 0.6 % 0.2 = 0.19999999999999996
 * modulo(0.6, 0.2) = 0
 *
 * @param dividend
 * @param divisor
 */
function modulo(dividend, divisor)
{
    var epsilon = divisor / 10000;
    var remainder = dividend % divisor;

    if (Math.abs(remainder - divisor) < epsilon || Math.abs(remainder) < epsilon) {
        remainder = 0;
    }

    return remainder;
}

/**
 * createContextualFragment is not supported in IE9. Adding its support.
 */
if ((typeof Range != "undefined") && !Range.prototype.createContextualFragment)
{
    Range.prototype.createContextualFragment = function(html)
    {
        var frag = document.createDocumentFragment(),
        div = document.createElement("div");
        frag.appendChild(div);
        div.outerHTML = html;
        return frag;
    };
}

/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Varien
 * @package     js
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */
VarienForm = Class.create();
VarienForm.prototype = {
    initialize: function(formId, firstFieldFocus){
        this.form       = $(formId);
        if (!this.form) {
            return;
        }
        this.cache      = $A();
        this.currLoader = false;
        this.currDataIndex = false;
        this.validator  = new Validation(this.form);
        this.elementFocus   = this.elementOnFocus.bindAsEventListener(this);
        this.elementBlur    = this.elementOnBlur.bindAsEventListener(this);
        this.childLoader    = this.onChangeChildLoad.bindAsEventListener(this);
        this.highlightClass = 'highlight';
        this.extraChildParams = '';
        this.firstFieldFocus= firstFieldFocus || false;
        this.bindElements();
        if(this.firstFieldFocus){
            try{
                Form.Element.focus(Form.findFirstElement(this.form))
            }
            catch(e){}
        }
    },

    submit : function(url){
        if(this.validator && this.validator.validate()){
             this.form.submit();
        }
        return false;
    },

    bindElements:function (){
        var elements = Form.getElements(this.form);
        for (var row in elements) {
            if (elements[row].id) {
                Event.observe(elements[row],'focus',this.elementFocus);
                Event.observe(elements[row],'blur',this.elementBlur);
            }
        }
    },

    elementOnFocus: function(event){
        var element = Event.findElement(event, 'fieldset');
        if(element){
            Element.addClassName(element, this.highlightClass);
        }
    },

    elementOnBlur: function(event){
        var element = Event.findElement(event, 'fieldset');
        if(element){
            Element.removeClassName(element, this.highlightClass);
        }
    },

    setElementsRelation: function(parent, child, dataUrl, first){
        if (parent=$(parent)) {
            // TODO: array of relation and caching
            if (!this.cache[parent.id]){
                this.cache[parent.id] = $A();
                this.cache[parent.id]['child']     = child;
                this.cache[parent.id]['dataUrl']   = dataUrl;
                this.cache[parent.id]['data']      = $A();
                this.cache[parent.id]['first']      = first || false;
            }
            Event.observe(parent,'change',this.childLoader);
        }
    },

    onChangeChildLoad: function(event){
        element = Event.element(event);
        this.elementChildLoad(element);
    },

    elementChildLoad: function(element, callback){
        this.callback = callback || false;
        if (element.value) {
            this.currLoader = element.id;
            this.currDataIndex = element.value;
            if (this.cache[element.id]['data'][element.value]) {
                this.setDataToChild(this.cache[element.id]['data'][element.value]);
            }
            else{
                new Ajax.Request(this.cache[this.currLoader]['dataUrl'],{
                        method: 'post',
                        parameters: {"parent":element.value},
                        onComplete: this.reloadChildren.bind(this)
                });
            }
        }
    },

    reloadChildren: function(transport){
        var data = eval('(' + transport.responseText + ')');
        this.cache[this.currLoader]['data'][this.currDataIndex] = data;
        this.setDataToChild(data);
    },

    setDataToChild: function(data){
        if (data.length) {
            var child = $(this.cache[this.currLoader]['child']);
            if (child){
                var html = '<select name="'+child.name+'" id="'+child.id+'" class="'+child.className+'" title="'+child.title+'" '+this.extraChildParams+'>';
                if(this.cache[this.currLoader]['first']){
                    html+= '<option value="">'+this.cache[this.currLoader]['first']+'</option>';
                }
                for (var i in data){
                    if(data[i].value) {
                        html+= '<option value="'+data[i].value+'"';
                        if(child.value && (child.value == data[i].value || child.value == data[i].label)){
                            html+= ' selected';
                        }
                        html+='>'+data[i].label+'</option>';
                    }
                }
                html+= '</select>';
                Element.insert(child, {before: html});
                Element.remove(child);
            }
        }
        else{
            var child = $(this.cache[this.currLoader]['child']);
            if (child){
                var html = '<input type="text" name="'+child.name+'" id="'+child.id+'" class="'+child.className+'" title="'+child.title+'" '+this.extraChildParams+'>';
                Element.insert(child, {before: html});
                Element.remove(child);
            }
        }

        this.bindElements();
        if (this.callback) {
            this.callback();
        }
    }
}

RegionUpdater = Class.create();
RegionUpdater.prototype = {
    initialize: function (countryEl, regionTextEl, regionSelectEl, regions, disableAction, zipEl)
    {
        this.countryEl = $(countryEl);
        this.regionTextEl = $(regionTextEl);
        this.regionSelectEl = $(regionSelectEl);
        this.zipEl = $(zipEl);
        this.config = regions['config'];
        delete regions.config;
        this.regions = regions;

        this.disableAction = (typeof disableAction=='undefined') ? 'hide' : disableAction;
        this.zipOptions = (typeof zipOptions=='undefined') ? false : zipOptions;

        if (this.regionSelectEl.options.length<=1) {
            this.update();
        }

        Event.observe(this.countryEl, 'change', this.update.bind(this));
    },

    _checkRegionRequired: function()
    {
        var label, wildCard;
        var elements = [this.regionTextEl, this.regionSelectEl];
        var that = this;
        if (typeof this.config == 'undefined') {
            return;
        }
        var regionRequired = this.config.regions_required.indexOf(this.countryEl.value) >= 0;

        elements.each(function(currentElement) {
            Validation.reset(currentElement);
            label = $$('label[for="' + currentElement.id + '"]')[0];
            if (label) {
                wildCard = label.down('em') || label.down('span.required');
                if (!that.config.show_all_regions) {
                    if (regionRequired) {
                        label.up().show();
                    } else {
                        label.up().hide();
                    }
                }
            }

            if (label && wildCard) {
                if (!regionRequired) {
                    wildCard.hide();
                    if (label.hasClassName('required')) {
                        label.removeClassName('required');
                    }
                } else if (regionRequired) {
                    wildCard.show();
                    if (!label.hasClassName('required')) {
                        label.addClassName('required')
                    }
                }
            }

            if (!regionRequired) {
                if (currentElement.hasClassName('required-entry')) {
                    currentElement.removeClassName('required-entry');
                }
                if ('select' == currentElement.tagName.toLowerCase() &&
                    currentElement.hasClassName('validate-select')) {
                    currentElement.removeClassName('validate-select');
                }
            } else {
                if (!currentElement.hasClassName('required-entry')) {
                    currentElement.addClassName('required-entry');
                }
                if ('select' == currentElement.tagName.toLowerCase() &&
                    !currentElement.hasClassName('validate-select')) {
                    currentElement.addClassName('validate-select');
                }
            }
        });
    },

    update: function()
    {
        if (this.regions[this.countryEl.value]) {
            var i, option, region, def;

            def = this.regionSelectEl.getAttribute('defaultValue');
            if (this.regionTextEl) {
                if (!def) {
                    def = this.regionTextEl.value.toLowerCase();
                }
                this.regionTextEl.value = '';
            }

            this.regionSelectEl.options.length = 1;
            for (regionId in this.regions[this.countryEl.value]) {
                region = this.regions[this.countryEl.value][regionId];

                option = document.createElement('OPTION');
                option.value = regionId;
                option.text = region.name.stripTags();
                option.title = region.name;

                if (this.regionSelectEl.options.add) {
                    this.regionSelectEl.options.add(option);
                } else {
                    this.regionSelectEl.appendChild(option);
                }

                if (regionId==def || (region.name && region.name.toLowerCase()==def) ||
                    (region.name && region.code.toLowerCase()==def)
                ) {
                    this.regionSelectEl.value = regionId;
                }
            }

            if (this.disableAction=='hide') {
                if (this.regionTextEl) {
                    this.regionTextEl.style.display = 'none';
                }

                this.regionSelectEl.style.display = '';
            } else if (this.disableAction=='disable') {
                if (this.regionTextEl) {
                    this.regionTextEl.disabled = true;
                }
                this.regionSelectEl.disabled = false;
            }
            this.setMarkDisplay(this.regionSelectEl, true);
        } else {
            this.regionSelectEl.options.length = 1;
            if (this.disableAction=='hide') {
                if (this.regionTextEl) {
                    this.regionTextEl.style.display = '';
                }
                this.regionSelectEl.style.display = 'none';
                Validation.reset(this.regionSelectEl);
            } else if (this.disableAction=='disable') {
                if (this.regionTextEl) {
                    this.regionTextEl.disabled = false;
                }
                this.regionSelectEl.disabled = true;
            } else if (this.disableAction=='nullify') {
                this.regionSelectEl.options.length = 1;
                this.regionSelectEl.value = '';
                this.regionSelectEl.selectedIndex = 0;
                this.lastCountryId = '';
            }
            this.setMarkDisplay(this.regionSelectEl, false);
        }

        this._checkRegionRequired();
        // Make Zip and its label required/optional
        var zipUpdater = new ZipUpdater(this.countryEl.value, this.zipEl);
        zipUpdater.update();
    },

    setMarkDisplay: function(elem, display){
        elem = $(elem);
        var labelElement = elem.up(0).down('label > span.required') ||
                           elem.up(1).down('label > span.required') ||
                           elem.up(0).down('label.required > em') ||
                           elem.up(1).down('label.required > em');
        if(labelElement) {
            inputElement = labelElement.up().next('input');
            if (display) {
                labelElement.show();
                if (inputElement) {
                    inputElement.addClassName('required-entry');
                }
            } else {
                labelElement.hide();
                if (inputElement) {
                    inputElement.removeClassName('required-entry');
                }
            }
        }
    }
}

ZipUpdater = Class.create();
ZipUpdater.prototype = {
    initialize: function(country, zipElement)
    {
        this.country = country;
        this.zipElement = $(zipElement);
    },

    update: function()
    {
        // Country ISO 2-letter codes must be pre-defined
        if (typeof optionalZipCountries == 'undefined') {
            return false;
        }

        // Ajax-request and normal content load compatibility
        if (this.zipElement != undefined) {
            Validation.reset(this.zipElement)
            this._setPostcodeOptional();
        } else {
            Event.observe(window, "load", this._setPostcodeOptional.bind(this));
        }
    },

    _setPostcodeOptional: function()
    {
        this.zipElement = $(this.zipElement);
        if (this.zipElement == undefined) {
            return false;
        }

        // find label
        var label = $$('label[for="' + this.zipElement.id + '"]')[0];
        if (label != undefined) {
            var wildCard = label.down('em') || label.down('span.required');
        }

        // Make Zip and its label required/optional
        if (optionalZipCountries.indexOf(this.country) != -1) {
            while (this.zipElement.hasClassName('required-entry')) {
                this.zipElement.removeClassName('required-entry');
            }
            if (wildCard != undefined) {
                wildCard.hide();
            }
        } else {
            this.zipElement.addClassName('required-entry');
            if (wildCard != undefined) {
                wildCard.show();
            }
        }
    }
}

/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Varien
 * @package     js
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */

/**
 * @classDescription simple Navigation with replacing old handlers
 * @param {String} id id of ul element with navigation lists
 * @param {Object} settings object with settings
 */
var mainNav = function() {

    var main = {
        obj_nav :   $(arguments[0]) || $("nav"),

        settings :  {
            show_delay      :   0,
            hide_delay      :   0,
            _ie6            :   /MSIE 6.+Win/.test(navigator.userAgent),
            _ie7            :   /MSIE 7.+Win/.test(navigator.userAgent)
        },

        init :  function(obj, level) {
            obj.lists = obj.childElements();
            obj.lists.each(function(el,ind){
                main.handlNavElement(el);
                if((main.settings._ie6 || main.settings._ie7) && level){
                    main.ieFixZIndex(el, ind, obj.lists.size());
                }
            });
            if(main.settings._ie6 && !level){
                document.execCommand("BackgroundImageCache", false, true);
            }
        },

        handlNavElement :   function(list) {
            if(list !== undefined){
                list.onmouseover = function(){
                    main.fireNavEvent(this,true);
                };
                list.onmouseout = function(){
                    main.fireNavEvent(this,false);
                };
                if(list.down("ul")){
                    main.init(list.down("ul"), true);
                }
            }
        },

        ieFixZIndex : function(el, i, l) {
            if(el.tagName.toString().toLowerCase().indexOf("iframe") == -1){
                el.style.zIndex = l - i;
            } else {
                el.onmouseover = "null";
                el.onmouseout = "null";
            }
        },

        fireNavEvent :  function(elm,ev) {
            if(ev){
                elm.addClassName("over");
                elm.down("a").addClassName("over");
                if (elm.childElements()[1]) {
                    main.show(elm.childElements()[1]);
                }
            } else {
                elm.removeClassName("over");
                elm.down("a").removeClassName("over");
                if (elm.childElements()[1]) {
                    main.hide(elm.childElements()[1]);
                }
            }
        },

        show : function (sub_elm) {
            if (sub_elm.hide_time_id) {
                clearTimeout(sub_elm.hide_time_id);
            }
            sub_elm.show_time_id = setTimeout(function() {
                if (!sub_elm.hasClassName("shown-sub")) {
                    sub_elm.addClassName("shown-sub");
                }
            }, main.settings.show_delay);
        },

        hide : function (sub_elm) {
            if (sub_elm.show_time_id) {
                clearTimeout(sub_elm.show_time_id);
            }
            sub_elm.hide_time_id = setTimeout(function(){
                if (sub_elm.hasClassName("shown-sub")) {
                    sub_elm.removeClassName("shown-sub");
                }
            }, main.settings.hide_delay);
        }

    };
    if (arguments[1]) {
        main.settings = Object.extend(main.settings, arguments[1]);
    }
    if (main.obj_nav) {
        main.init(main.obj_nav, false);
    }
};

document.observe("dom:loaded", function() {
    //run navigation without delays and with default id="#nav"
    //mainNav();

    //run navigation with delays
    mainNav("nav", {"show_delay":"100","hide_delay":"100"});
});

/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Mage
 * @package     js
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */

var Translate = Class.create();
Translate.prototype = {
    initialize: function(data){
        this.data = $H(data);
    },

    translate : function(){
        var args = arguments;
        var text = arguments[0];

        if(this.data.get(text)){
            return this.data.get(text);
        }
        return text;
    },
    add : function() {
        if (arguments.length > 1) {
            this.data.set(arguments[0], arguments[1]);
        } else if (typeof arguments[0] =='object') {
            $H(arguments[0]).each(function (pair){
                this.data.set(pair.key, pair.value);
            }.bind(this));
        }
    }
}

/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Mage
 * @package     js
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */
// old school cookie functions grabbed off the web

if (!window.Mage) var Mage = {};

Mage.Cookies = {};
Mage.Cookies.expires  = null;
Mage.Cookies.path     = '/';
Mage.Cookies.domain   = null;
Mage.Cookies.secure   = false;
Mage.Cookies.set = function(name, value){
     var argv = arguments;
     var argc = arguments.length;
     var expires = (argc > 2) ? argv[2] : Mage.Cookies.expires;
     var path = (argc > 3) ? argv[3] : Mage.Cookies.path;
     var domain = (argc > 4) ? argv[4] : Mage.Cookies.domain;
     var secure = (argc > 5) ? argv[5] : Mage.Cookies.secure;
     document.cookie = name + "=" + escape (value) +
       ((expires == null) ? "" : ("; expires=" + expires.toGMTString())) +
       ((path == null) ? "" : ("; path=" + path)) +
       ((domain == null) ? "" : ("; domain=" + domain)) +
       ((secure == true) ? "; secure" : "");
};

Mage.Cookies.get = function(name){
    var arg = name + "=";
    var alen = arg.length;
    var clen = document.cookie.length;
    var i = 0;
    var j = 0;
    while(i < clen){
        j = i + alen;
        if (document.cookie.substring(i, j) == arg)
            return Mage.Cookies.getCookieVal(j);
        i = document.cookie.indexOf(" ", i) + 1;
        if(i == 0)
            break;
    }
    return null;
};

Mage.Cookies.clear = function(name) {
  if(Mage.Cookies.get(name)){
    document.cookie = name + "=" +
    "; expires=Thu, 01-Jan-70 00:00:01 GMT";
  }
};

Mage.Cookies.getCookieVal = function(offset){
   var endstr = document.cookie.indexOf(";", offset);
   if(endstr == -1){
       endstr = document.cookie.length;
   }
   return unescape(document.cookie.substring(offset, endstr));
};

/*! jQuery v1.11.0 | (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license */
!function(a,b){"object"==typeof module&&"object"==typeof module.exports?module.exports=a.document?b(a,!0):function(a){if(!a.document)throw new Error("jQuery requires a window with a document");return b(a)}:b(a)}("undefined"!=typeof window?window:this,function(a,b){var c=[],d=c.slice,e=c.concat,f=c.push,g=c.indexOf,h={},i=h.toString,j=h.hasOwnProperty,k="".trim,l={},m="1.11.0",n=function(a,b){return new n.fn.init(a,b)},o=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,p=/^-ms-/,q=/-([\da-z])/gi,r=function(a,b){return b.toUpperCase()};n.fn=n.prototype={jquery:m,constructor:n,selector:"",length:0,toArray:function(){return d.call(this)},get:function(a){return null!=a?0>a?this[a+this.length]:this[a]:d.call(this)},pushStack:function(a){var b=n.merge(this.constructor(),a);return b.prevObject=this,b.context=this.context,b},each:function(a,b){return n.each(this,a,b)},map:function(a){return this.pushStack(n.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(d.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(0>a?b:0);return this.pushStack(c>=0&&b>c?[this[c]]:[])},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:c.sort,splice:c.splice},n.extend=n.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||n.isFunction(g)||(g={}),h===i&&(g=this,h--);i>h;h++)if(null!=(e=arguments[h]))for(d in e)a=g[d],c=e[d],g!==c&&(j&&c&&(n.isPlainObject(c)||(b=n.isArray(c)))?(b?(b=!1,f=a&&n.isArray(a)?a:[]):f=a&&n.isPlainObject(a)?a:{},g[d]=n.extend(j,f,c)):void 0!==c&&(g[d]=c));return g},n.extend({expando:"jQuery"+(m+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===n.type(a)},isArray:Array.isArray||function(a){return"array"===n.type(a)},isWindow:function(a){return null!=a&&a==a.window},isNumeric:function(a){return a-parseFloat(a)>=0},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},isPlainObject:function(a){var b;if(!a||"object"!==n.type(a)||a.nodeType||n.isWindow(a))return!1;try{if(a.constructor&&!j.call(a,"constructor")&&!j.call(a.constructor.prototype,"isPrototypeOf"))return!1}catch(c){return!1}if(l.ownLast)for(b in a)return j.call(a,b);for(b in a);return void 0===b||j.call(a,b)},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?h[i.call(a)]||"object":typeof a},globalEval:function(b){b&&n.trim(b)&&(a.execScript||function(b){a.eval.call(a,b)})(b)},camelCase:function(a){return a.replace(p,"ms-").replace(q,r)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()},each:function(a,b,c){var d,e=0,f=a.length,g=s(a);if(c){if(g){for(;f>e;e++)if(d=b.apply(a[e],c),d===!1)break}else for(e in a)if(d=b.apply(a[e],c),d===!1)break}else if(g){for(;f>e;e++)if(d=b.call(a[e],e,a[e]),d===!1)break}else for(e in a)if(d=b.call(a[e],e,a[e]),d===!1)break;return a},trim:k&&!k.call("\ufeff\xa0")?function(a){return null==a?"":k.call(a)}:function(a){return null==a?"":(a+"").replace(o,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(s(Object(a))?n.merge(c,"string"==typeof a?[a]:a):f.call(c,a)),c},inArray:function(a,b,c){var d;if(b){if(g)return g.call(b,a,c);for(d=b.length,c=c?0>c?Math.max(0,d+c):c:0;d>c;c++)if(c in b&&b[c]===a)return c}return-1},merge:function(a,b){var c=+b.length,d=0,e=a.length;while(c>d)a[e++]=b[d++];if(c!==c)while(void 0!==b[d])a[e++]=b[d++];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;g>f;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,f=0,g=a.length,h=s(a),i=[];if(h)for(;g>f;f++)d=b(a[f],f,c),null!=d&&i.push(d);else for(f in a)d=b(a[f],f,c),null!=d&&i.push(d);return e.apply([],i)},guid:1,proxy:function(a,b){var c,e,f;return"string"==typeof b&&(f=a[b],b=a,a=f),n.isFunction(a)?(c=d.call(arguments,2),e=function(){return a.apply(b||this,c.concat(d.call(arguments)))},e.guid=a.guid=a.guid||n.guid++,e):void 0},now:function(){return+new Date},support:l}),n.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(a,b){h["[object "+b+"]"]=b.toLowerCase()});function s(a){var b=a.length,c=n.type(a);return"function"===c||n.isWindow(a)?!1:1===a.nodeType&&b?!0:"array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a}var t=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s="sizzle"+-new Date,t=a.document,u=0,v=0,w=eb(),x=eb(),y=eb(),z=function(a,b){return a===b&&(j=!0),0},A="undefined",B=1<<31,C={}.hasOwnProperty,D=[],E=D.pop,F=D.push,G=D.push,H=D.slice,I=D.indexOf||function(a){for(var b=0,c=this.length;c>b;b++)if(this[b]===a)return b;return-1},J="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",K="[\\x20\\t\\r\\n\\f]",L="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",M=L.replace("w","w#"),N="\\["+K+"*("+L+")"+K+"*(?:([*^$|!~]?=)"+K+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+M+")|)|)"+K+"*\\]",O=":("+L+")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|"+N.replace(3,8)+")*)|.*)\\)|)",P=new RegExp("^"+K+"+|((?:^|[^\\\\])(?:\\\\.)*)"+K+"+$","g"),Q=new RegExp("^"+K+"*,"+K+"*"),R=new RegExp("^"+K+"*([>+~]|"+K+")"+K+"*"),S=new RegExp("="+K+"*([^\\]'\"]*?)"+K+"*\\]","g"),T=new RegExp(O),U=new RegExp("^"+M+"$"),V={ID:new RegExp("^#("+L+")"),CLASS:new RegExp("^\\.("+L+")"),TAG:new RegExp("^("+L.replace("w","w*")+")"),ATTR:new RegExp("^"+N),PSEUDO:new RegExp("^"+O),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+K+"*(even|odd|(([+-]|)(\\d*)n|)"+K+"*(?:([+-]|)"+K+"*(\\d+)|))"+K+"*\\)|)","i"),bool:new RegExp("^(?:"+J+")$","i"),needsContext:new RegExp("^"+K+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+K+"*((?:-\\d)?\\d*)"+K+"*\\)|)(?=[^-]|$)","i")},W=/^(?:input|select|textarea|button)$/i,X=/^h\d$/i,Y=/^[^{]+\{\s*\[native \w/,Z=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,$=/[+~]/,_=/'|\\/g,ab=new RegExp("\\\\([\\da-f]{1,6}"+K+"?|("+K+")|.)","ig"),bb=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:0>d?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)};try{G.apply(D=H.call(t.childNodes),t.childNodes),D[t.childNodes.length].nodeType}catch(cb){G={apply:D.length?function(a,b){F.apply(a,H.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function db(a,b,d,e){var f,g,h,i,j,m,p,q,u,v;if((b?b.ownerDocument||b:t)!==l&&k(b),b=b||l,d=d||[],!a||"string"!=typeof a)return d;if(1!==(i=b.nodeType)&&9!==i)return[];if(n&&!e){if(f=Z.exec(a))if(h=f[1]){if(9===i){if(g=b.getElementById(h),!g||!g.parentNode)return d;if(g.id===h)return d.push(g),d}else if(b.ownerDocument&&(g=b.ownerDocument.getElementById(h))&&r(b,g)&&g.id===h)return d.push(g),d}else{if(f[2])return G.apply(d,b.getElementsByTagName(a)),d;if((h=f[3])&&c.getElementsByClassName&&b.getElementsByClassName)return G.apply(d,b.getElementsByClassName(h)),d}if(c.qsa&&(!o||!o.test(a))){if(q=p=s,u=b,v=9===i&&a,1===i&&"object"!==b.nodeName.toLowerCase()){m=ob(a),(p=b.getAttribute("id"))?q=p.replace(_,"\\$&"):b.setAttribute("id",q),q="[id='"+q+"'] ",j=m.length;while(j--)m[j]=q+pb(m[j]);u=$.test(a)&&mb(b.parentNode)||b,v=m.join(",")}if(v)try{return G.apply(d,u.querySelectorAll(v)),d}catch(w){}finally{p||b.removeAttribute("id")}}}return xb(a.replace(P,"$1"),b,d,e)}function eb(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function fb(a){return a[s]=!0,a}function gb(a){var b=l.createElement("div");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function hb(a,b){var c=a.split("|"),e=a.length;while(e--)d.attrHandle[c[e]]=b}function ib(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&(~b.sourceIndex||B)-(~a.sourceIndex||B);if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function jb(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function kb(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function lb(a){return fb(function(b){return b=+b,fb(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function mb(a){return a&&typeof a.getElementsByTagName!==A&&a}c=db.support={},f=db.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return b?"HTML"!==b.nodeName:!1},k=db.setDocument=function(a){var b,e=a?a.ownerDocument||a:t,g=e.defaultView;return e!==l&&9===e.nodeType&&e.documentElement?(l=e,m=e.documentElement,n=!f(e),g&&g!==g.top&&(g.addEventListener?g.addEventListener("unload",function(){k()},!1):g.attachEvent&&g.attachEvent("onunload",function(){k()})),c.attributes=gb(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=gb(function(a){return a.appendChild(e.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=Y.test(e.getElementsByClassName)&&gb(function(a){return a.innerHTML="<div class='a'></div><div class='a i'></div>",a.firstChild.className="i",2===a.getElementsByClassName("i").length}),c.getById=gb(function(a){return m.appendChild(a).id=s,!e.getElementsByName||!e.getElementsByName(s).length}),c.getById?(d.find.ID=function(a,b){if(typeof b.getElementById!==A&&n){var c=b.getElementById(a);return c&&c.parentNode?[c]:[]}},d.filter.ID=function(a){var b=a.replace(ab,bb);return function(a){return a.getAttribute("id")===b}}):(delete d.find.ID,d.filter.ID=function(a){var b=a.replace(ab,bb);return function(a){var c=typeof a.getAttributeNode!==A&&a.getAttributeNode("id");return c&&c.value===b}}),d.find.TAG=c.getElementsByTagName?function(a,b){return typeof b.getElementsByTagName!==A?b.getElementsByTagName(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){return typeof b.getElementsByClassName!==A&&n?b.getElementsByClassName(a):void 0},p=[],o=[],(c.qsa=Y.test(e.querySelectorAll))&&(gb(function(a){a.innerHTML="<select t=''><option selected=''></option></select>",a.querySelectorAll("[t^='']").length&&o.push("[*^$]="+K+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||o.push("\\["+K+"*(?:value|"+J+")"),a.querySelectorAll(":checked").length||o.push(":checked")}),gb(function(a){var b=e.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&o.push("name"+K+"*[*^$|!~]?="),a.querySelectorAll(":enabled").length||o.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),o.push(",.*:")})),(c.matchesSelector=Y.test(q=m.webkitMatchesSelector||m.mozMatchesSelector||m.oMatchesSelector||m.msMatchesSelector))&&gb(function(a){c.disconnectedMatch=q.call(a,"div"),q.call(a,"[s!='']:x"),p.push("!=",O)}),o=o.length&&new RegExp(o.join("|")),p=p.length&&new RegExp(p.join("|")),b=Y.test(m.compareDocumentPosition),r=b||Y.test(m.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},z=b?function(a,b){if(a===b)return j=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===e||a.ownerDocument===t&&r(t,a)?-1:b===e||b.ownerDocument===t&&r(t,b)?1:i?I.call(i,a)-I.call(i,b):0:4&d?-1:1)}:function(a,b){if(a===b)return j=!0,0;var c,d=0,f=a.parentNode,g=b.parentNode,h=[a],k=[b];if(!f||!g)return a===e?-1:b===e?1:f?-1:g?1:i?I.call(i,a)-I.call(i,b):0;if(f===g)return ib(a,b);c=a;while(c=c.parentNode)h.unshift(c);c=b;while(c=c.parentNode)k.unshift(c);while(h[d]===k[d])d++;return d?ib(h[d],k[d]):h[d]===t?-1:k[d]===t?1:0},e):l},db.matches=function(a,b){return db(a,null,null,b)},db.matchesSelector=function(a,b){if((a.ownerDocument||a)!==l&&k(a),b=b.replace(S,"='$1']"),!(!c.matchesSelector||!n||p&&p.test(b)||o&&o.test(b)))try{var d=q.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return db(b,l,null,[a]).length>0},db.contains=function(a,b){return(a.ownerDocument||a)!==l&&k(a),r(a,b)},db.attr=function(a,b){(a.ownerDocument||a)!==l&&k(a);var e=d.attrHandle[b.toLowerCase()],f=e&&C.call(d.attrHandle,b.toLowerCase())?e(a,b,!n):void 0;return void 0!==f?f:c.attributes||!n?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},db.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},db.uniqueSort=function(a){var b,d=[],e=0,f=0;if(j=!c.detectDuplicates,i=!c.sortStable&&a.slice(0),a.sort(z),j){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return i=null,a},e=db.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=db.selectors={cacheLength:50,createPseudo:fb,match:V,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(ab,bb),a[3]=(a[4]||a[5]||"").replace(ab,bb),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||db.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&db.error(a[0]),a},PSEUDO:function(a){var b,c=!a[5]&&a[2];return V.CHILD.test(a[0])?null:(a[3]&&void 0!==a[4]?a[2]=a[4]:c&&T.test(c)&&(b=ob(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(ab,bb).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=w[a+" "];return b||(b=new RegExp("(^|"+K+")"+a+"("+K+"|$)"))&&w(a,function(a){return b.test("string"==typeof a.className&&a.className||typeof a.getAttribute!==A&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=db.attr(d,a);return null==e?"!="===b:b?(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e+" ").indexOf(c)>-1:"|="===b?e===c||e.slice(0,c.length+1)===c+"-":!1):!0}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),t=!i&&!h;if(q){if(f){while(p){l=b;while(l=l[p])if(h?l.nodeName.toLowerCase()===r:1===l.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&t){k=q[s]||(q[s]={}),j=k[a]||[],n=j[0]===u&&j[1],m=j[0]===u&&j[2],l=n&&q.childNodes[n];while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if(1===l.nodeType&&++m&&l===b){k[a]=[u,n,m];break}}else if(t&&(j=(b[s]||(b[s]={}))[a])&&j[0]===u)m=j[1];else while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if((h?l.nodeName.toLowerCase()===r:1===l.nodeType)&&++m&&(t&&((l[s]||(l[s]={}))[a]=[u,m]),l===b))break;return m-=e,m===d||m%d===0&&m/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||db.error("unsupported pseudo: "+a);return e[s]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?fb(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=I.call(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:fb(function(a){var b=[],c=[],d=g(a.replace(P,"$1"));return d[s]?fb(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),!c.pop()}}),has:fb(function(a){return function(b){return db(a,b).length>0}}),contains:fb(function(a){return function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:fb(function(a){return U.test(a||"")||db.error("unsupported lang: "+a),a=a.replace(ab,bb).toLowerCase(),function(b){var c;do if(c=n?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===m},focus:function(a){return a===l.activeElement&&(!l.hasFocus||l.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:function(a){return a.disabled===!1},disabled:function(a){return a.disabled===!0},checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return X.test(a.nodeName)},input:function(a){return W.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:lb(function(){return[0]}),last:lb(function(a,b){return[b-1]}),eq:lb(function(a,b,c){return[0>c?c+b:c]}),even:lb(function(a,b){for(var c=0;b>c;c+=2)a.push(c);return a}),odd:lb(function(a,b){for(var c=1;b>c;c+=2)a.push(c);return a}),lt:lb(function(a,b,c){for(var d=0>c?c+b:c;--d>=0;)a.push(d);return a}),gt:lb(function(a,b,c){for(var d=0>c?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=jb(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=kb(b);function nb(){}nb.prototype=d.filters=d.pseudos,d.setFilters=new nb;function ob(a,b){var c,e,f,g,h,i,j,k=x[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){(!c||(e=Q.exec(h)))&&(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=R.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(P," ")}),h=h.slice(c.length));for(g in d.filter)!(e=V[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?db.error(a):x(a,i).slice(0)}function pb(a){for(var b=0,c=a.length,d="";c>b;b++)d+=a[b].value;return d}function qb(a,b,c){var d=b.dir,e=c&&"parentNode"===d,f=v++;return b.first?function(b,c,f){while(b=b[d])if(1===b.nodeType||e)return a(b,c,f)}:function(b,c,g){var h,i,j=[u,f];if(g){while(b=b[d])if((1===b.nodeType||e)&&a(b,c,g))return!0}else while(b=b[d])if(1===b.nodeType||e){if(i=b[s]||(b[s]={}),(h=i[d])&&h[0]===u&&h[1]===f)return j[2]=h[2];if(i[d]=j,j[2]=a(b,c,g))return!0}}}function rb(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function sb(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;i>h;h++)(f=a[h])&&(!c||c(f,d,e))&&(g.push(f),j&&b.push(h));return g}function tb(a,b,c,d,e,f){return d&&!d[s]&&(d=tb(d)),e&&!e[s]&&(e=tb(e,f)),fb(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||wb(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:sb(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=sb(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?I.call(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=sb(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):G.apply(g,r)})}function ub(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],i=g||d.relative[" "],j=g?1:0,k=qb(function(a){return a===b},i,!0),l=qb(function(a){return I.call(b,a)>-1},i,!0),m=[function(a,c,d){return!g&&(d||c!==h)||((b=c).nodeType?k(a,c,d):l(a,c,d))}];f>j;j++)if(c=d.relative[a[j].type])m=[qb(rb(m),c)];else{if(c=d.filter[a[j].type].apply(null,a[j].matches),c[s]){for(e=++j;f>e;e++)if(d.relative[a[e].type])break;return tb(j>1&&rb(m),j>1&&pb(a.slice(0,j-1).concat({value:" "===a[j-2].type?"*":""})).replace(P,"$1"),c,e>j&&ub(a.slice(j,e)),f>e&&ub(a=a.slice(e)),f>e&&pb(a))}m.push(c)}return rb(m)}function vb(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,i,j,k){var m,n,o,p=0,q="0",r=f&&[],s=[],t=h,v=f||e&&d.find.TAG("*",k),w=u+=null==t?1:Math.random()||.1,x=v.length;for(k&&(h=g!==l&&g);q!==x&&null!=(m=v[q]);q++){if(e&&m){n=0;while(o=a[n++])if(o(m,g,i)){j.push(m);break}k&&(u=w)}c&&((m=!o&&m)&&p--,f&&r.push(m))}if(p+=q,c&&q!==p){n=0;while(o=b[n++])o(r,s,g,i);if(f){if(p>0)while(q--)r[q]||s[q]||(s[q]=E.call(j));s=sb(s)}G.apply(j,s),k&&!f&&s.length>0&&p+b.length>1&&db.uniqueSort(j)}return k&&(u=w,h=t),r};return c?fb(f):f}g=db.compile=function(a,b){var c,d=[],e=[],f=y[a+" "];if(!f){b||(b=ob(a)),c=b.length;while(c--)f=ub(b[c]),f[s]?d.push(f):e.push(f);f=y(a,vb(e,d))}return f};function wb(a,b,c){for(var d=0,e=b.length;e>d;d++)db(a,b[d],c);return c}function xb(a,b,e,f){var h,i,j,k,l,m=ob(a);if(!f&&1===m.length){if(i=m[0]=m[0].slice(0),i.length>2&&"ID"===(j=i[0]).type&&c.getById&&9===b.nodeType&&n&&d.relative[i[1].type]){if(b=(d.find.ID(j.matches[0].replace(ab,bb),b)||[])[0],!b)return e;a=a.slice(i.shift().value.length)}h=V.needsContext.test(a)?0:i.length;while(h--){if(j=i[h],d.relative[k=j.type])break;if((l=d.find[k])&&(f=l(j.matches[0].replace(ab,bb),$.test(i[0].type)&&mb(b.parentNode)||b))){if(i.splice(h,1),a=f.length&&pb(i),!a)return G.apply(e,f),e;break}}}return g(a,m)(f,b,!n,e,$.test(a)&&mb(b.parentNode)||b),e}return c.sortStable=s.split("").sort(z).join("")===s,c.detectDuplicates=!!j,k(),c.sortDetached=gb(function(a){return 1&a.compareDocumentPosition(l.createElement("div"))}),gb(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||hb("type|href|height|width",function(a,b,c){return c?void 0:a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&gb(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||hb("value",function(a,b,c){return c||"input"!==a.nodeName.toLowerCase()?void 0:a.defaultValue}),gb(function(a){return null==a.getAttribute("disabled")})||hb(J,function(a,b,c){var d;return c?void 0:a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),db}(a);n.find=t,n.expr=t.selectors,n.expr[":"]=n.expr.pseudos,n.unique=t.uniqueSort,n.text=t.getText,n.isXMLDoc=t.isXML,n.contains=t.contains;var u=n.expr.match.needsContext,v=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,w=/^.[^:#\[\.,]*$/;function x(a,b,c){if(n.isFunction(b))return n.grep(a,function(a,d){return!!b.call(a,d,a)!==c});if(b.nodeType)return n.grep(a,function(a){return a===b!==c});if("string"==typeof b){if(w.test(b))return n.filter(b,a,c);b=n.filter(b,a)}return n.grep(a,function(a){return n.inArray(a,b)>=0!==c})}n.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?n.find.matchesSelector(d,a)?[d]:[]:n.find.matches(a,n.grep(b,function(a){return 1===a.nodeType}))},n.fn.extend({find:function(a){var b,c=[],d=this,e=d.length;if("string"!=typeof a)return this.pushStack(n(a).filter(function(){for(b=0;e>b;b++)if(n.contains(d[b],this))return!0}));for(b=0;e>b;b++)n.find(a,d[b],c);return c=this.pushStack(e>1?n.unique(c):c),c.selector=this.selector?this.selector+" "+a:a,c},filter:function(a){return this.pushStack(x(this,a||[],!1))},not:function(a){return this.pushStack(x(this,a||[],!0))},is:function(a){return!!x(this,"string"==typeof a&&u.test(a)?n(a):a||[],!1).length}});var y,z=a.document,A=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,B=n.fn.init=function(a,b){var c,d;if(!a)return this;if("string"==typeof a){if(c="<"===a.charAt(0)&&">"===a.charAt(a.length-1)&&a.length>=3?[null,a,null]:A.exec(a),!c||!c[1]&&b)return!b||b.jquery?(b||y).find(a):this.constructor(b).find(a);if(c[1]){if(b=b instanceof n?b[0]:b,n.merge(this,n.parseHTML(c[1],b&&b.nodeType?b.ownerDocument||b:z,!0)),v.test(c[1])&&n.isPlainObject(b))for(c in b)n.isFunction(this[c])?this[c](b[c]):this.attr(c,b[c]);return this}if(d=z.getElementById(c[2]),d&&d.parentNode){if(d.id!==c[2])return y.find(a);this.length=1,this[0]=d}return this.context=z,this.selector=a,this}return a.nodeType?(this.context=this[0]=a,this.length=1,this):n.isFunction(a)?"undefined"!=typeof y.ready?y.ready(a):a(n):(void 0!==a.selector&&(this.selector=a.selector,this.context=a.context),n.makeArray(a,this))};B.prototype=n.fn,y=n(z);var C=/^(?:parents|prev(?:Until|All))/,D={children:!0,contents:!0,next:!0,prev:!0};n.extend({dir:function(a,b,c){var d=[],e=a[b];while(e&&9!==e.nodeType&&(void 0===c||1!==e.nodeType||!n(e).is(c)))1===e.nodeType&&d.push(e),e=e[b];return d},sibling:function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c}}),n.fn.extend({has:function(a){var b,c=n(a,this),d=c.length;return this.filter(function(){for(b=0;d>b;b++)if(n.contains(this,c[b]))return!0})},closest:function(a,b){for(var c,d=0,e=this.length,f=[],g=u.test(a)||"string"!=typeof a?n(a,b||this.context):0;e>d;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&n.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?n.unique(f):f)},index:function(a){return a?"string"==typeof a?n.inArray(this[0],n(a)):n.inArray(a.jquery?a[0]:a,this):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(n.unique(n.merge(this.get(),n(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function E(a,b){do a=a[b];while(a&&1!==a.nodeType);return a}n.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return n.dir(a,"parentNode")},parentsUntil:function(a,b,c){return n.dir(a,"parentNode",c)},next:function(a){return E(a,"nextSibling")},prev:function(a){return E(a,"previousSibling")},nextAll:function(a){return n.dir(a,"nextSibling")},prevAll:function(a){return n.dir(a,"previousSibling")},nextUntil:function(a,b,c){return n.dir(a,"nextSibling",c)},prevUntil:function(a,b,c){return n.dir(a,"previousSibling",c)},siblings:function(a){return n.sibling((a.parentNode||{}).firstChild,a)},children:function(a){return n.sibling(a.firstChild)},contents:function(a){return n.nodeName(a,"iframe")?a.contentDocument||a.contentWindow.document:n.merge([],a.childNodes)}},function(a,b){n.fn[a]=function(c,d){var e=n.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=n.filter(d,e)),this.length>1&&(D[a]||(e=n.unique(e)),C.test(a)&&(e=e.reverse())),this.pushStack(e)}});var F=/\S+/g,G={};function H(a){var b=G[a]={};return n.each(a.match(F)||[],function(a,c){b[c]=!0}),b}n.Callbacks=function(a){a="string"==typeof a?G[a]||H(a):n.extend({},a);var b,c,d,e,f,g,h=[],i=!a.once&&[],j=function(l){for(c=a.memory&&l,d=!0,f=g||0,g=0,e=h.length,b=!0;h&&e>f;f++)if(h[f].apply(l[0],l[1])===!1&&a.stopOnFalse){c=!1;break}b=!1,h&&(i?i.length&&j(i.shift()):c?h=[]:k.disable())},k={add:function(){if(h){var d=h.length;!function f(b){n.each(b,function(b,c){var d=n.type(c);"function"===d?a.unique&&k.has(c)||h.push(c):c&&c.length&&"string"!==d&&f(c)})}(arguments),b?e=h.length:c&&(g=d,j(c))}return this},remove:function(){return h&&n.each(arguments,function(a,c){var d;while((d=n.inArray(c,h,d))>-1)h.splice(d,1),b&&(e>=d&&e--,f>=d&&f--)}),this},has:function(a){return a?n.inArray(a,h)>-1:!(!h||!h.length)},empty:function(){return h=[],e=0,this},disable:function(){return h=i=c=void 0,this},disabled:function(){return!h},lock:function(){return i=void 0,c||k.disable(),this},locked:function(){return!i},fireWith:function(a,c){return!h||d&&!i||(c=c||[],c=[a,c.slice?c.slice():c],b?i.push(c):j(c)),this},fire:function(){return k.fireWith(this,arguments),this},fired:function(){return!!d}};return k},n.extend({Deferred:function(a){var b=[["resolve","done",n.Callbacks("once memory"),"resolved"],["reject","fail",n.Callbacks("once memory"),"rejected"],["notify","progress",n.Callbacks("memory")]],c="pending",d={state:function(){return c},always:function(){return e.done(arguments).fail(arguments),this},then:function(){var a=arguments;return n.Deferred(function(c){n.each(b,function(b,f){var g=n.isFunction(a[b])&&a[b];e[f[1]](function(){var a=g&&g.apply(this,arguments);a&&n.isFunction(a.promise)?a.promise().done(c.resolve).fail(c.reject).progress(c.notify):c[f[0]+"With"](this===d?c.promise():this,g?[a]:arguments)})}),a=null}).promise()},promise:function(a){return null!=a?n.extend(a,d):d}},e={};return d.pipe=d.then,n.each(b,function(a,f){var g=f[2],h=f[3];d[f[1]]=g.add,h&&g.add(function(){c=h},b[1^a][2].disable,b[2][2].lock),e[f[0]]=function(){return e[f[0]+"With"](this===e?d:this,arguments),this},e[f[0]+"With"]=g.fireWith}),d.promise(e),a&&a.call(e,e),e},when:function(a){var b=0,c=d.call(arguments),e=c.length,f=1!==e||a&&n.isFunction(a.promise)?e:0,g=1===f?a:n.Deferred(),h=function(a,b,c){return function(e){b[a]=this,c[a]=arguments.length>1?d.call(arguments):e,c===i?g.notifyWith(b,c):--f||g.resolveWith(b,c)}},i,j,k;if(e>1)for(i=new Array(e),j=new Array(e),k=new Array(e);e>b;b++)c[b]&&n.isFunction(c[b].promise)?c[b].promise().done(h(b,k,c)).fail(g.reject).progress(h(b,j,i)):--f;return f||g.resolveWith(k,c),g.promise()}});var I;n.fn.ready=function(a){return n.ready.promise().done(a),this},n.extend({isReady:!1,readyWait:1,holdReady:function(a){a?n.readyWait++:n.ready(!0)},ready:function(a){if(a===!0?!--n.readyWait:!n.isReady){if(!z.body)return setTimeout(n.ready);n.isReady=!0,a!==!0&&--n.readyWait>0||(I.resolveWith(z,[n]),n.fn.trigger&&n(z).trigger("ready").off("ready"))}}});function J(){z.addEventListener?(z.removeEventListener("DOMContentLoaded",K,!1),a.removeEventListener("load",K,!1)):(z.detachEvent("onreadystatechange",K),a.detachEvent("onload",K))}function K(){(z.addEventListener||"load"===event.type||"complete"===z.readyState)&&(J(),n.ready())}n.ready.promise=function(b){if(!I)if(I=n.Deferred(),"complete"===z.readyState)setTimeout(n.ready);else if(z.addEventListener)z.addEventListener("DOMContentLoaded",K,!1),a.addEventListener("load",K,!1);else{z.attachEvent("onreadystatechange",K),a.attachEvent("onload",K);var c=!1;try{c=null==a.frameElement&&z.documentElement}catch(d){}c&&c.doScroll&&!function e(){if(!n.isReady){try{c.doScroll("left")}catch(a){return setTimeout(e,50)}J(),n.ready()}}()}return I.promise(b)};var L="undefined",M;for(M in n(l))break;l.ownLast="0"!==M,l.inlineBlockNeedsLayout=!1,n(function(){var a,b,c=z.getElementsByTagName("body")[0];c&&(a=z.createElement("div"),a.style.cssText="border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px",b=z.createElement("div"),c.appendChild(a).appendChild(b),typeof b.style.zoom!==L&&(b.style.cssText="border:0;margin:0;width:1px;padding:1px;display:inline;zoom:1",(l.inlineBlockNeedsLayout=3===b.offsetWidth)&&(c.style.zoom=1)),c.removeChild(a),a=b=null)}),function(){var a=z.createElement("div");if(null==l.deleteExpando){l.deleteExpando=!0;try{delete a.test}catch(b){l.deleteExpando=!1}}a=null}(),n.acceptData=function(a){var b=n.noData[(a.nodeName+" ").toLowerCase()],c=+a.nodeType||1;return 1!==c&&9!==c?!1:!b||b!==!0&&a.getAttribute("classid")===b};var N=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,O=/([A-Z])/g;function P(a,b,c){if(void 0===c&&1===a.nodeType){var d="data-"+b.replace(O,"-$1").toLowerCase();if(c=a.getAttribute(d),"string"==typeof c){try{c="true"===c?!0:"false"===c?!1:"null"===c?null:+c+""===c?+c:N.test(c)?n.parseJSON(c):c}catch(e){}n.data(a,b,c)}else c=void 0}return c}function Q(a){var b;for(b in a)if(("data"!==b||!n.isEmptyObject(a[b]))&&"toJSON"!==b)return!1;return!0}function R(a,b,d,e){if(n.acceptData(a)){var f,g,h=n.expando,i=a.nodeType,j=i?n.cache:a,k=i?a[h]:a[h]&&h;if(k&&j[k]&&(e||j[k].data)||void 0!==d||"string"!=typeof b)return k||(k=i?a[h]=c.pop()||n.guid++:h),j[k]||(j[k]=i?{}:{toJSON:n.noop}),("object"==typeof b||"function"==typeof b)&&(e?j[k]=n.extend(j[k],b):j[k].data=n.extend(j[k].data,b)),g=j[k],e||(g.data||(g.data={}),g=g.data),void 0!==d&&(g[n.camelCase(b)]=d),"string"==typeof b?(f=g[b],null==f&&(f=g[n.camelCase(b)])):f=g,f
}}function S(a,b,c){if(n.acceptData(a)){var d,e,f=a.nodeType,g=f?n.cache:a,h=f?a[n.expando]:n.expando;if(g[h]){if(b&&(d=c?g[h]:g[h].data)){n.isArray(b)?b=b.concat(n.map(b,n.camelCase)):b in d?b=[b]:(b=n.camelCase(b),b=b in d?[b]:b.split(" ")),e=b.length;while(e--)delete d[b[e]];if(c?!Q(d):!n.isEmptyObject(d))return}(c||(delete g[h].data,Q(g[h])))&&(f?n.cleanData([a],!0):l.deleteExpando||g!=g.window?delete g[h]:g[h]=null)}}}n.extend({cache:{},noData:{"applet ":!0,"embed ":!0,"object ":"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"},hasData:function(a){return a=a.nodeType?n.cache[a[n.expando]]:a[n.expando],!!a&&!Q(a)},data:function(a,b,c){return R(a,b,c)},removeData:function(a,b){return S(a,b)},_data:function(a,b,c){return R(a,b,c,!0)},_removeData:function(a,b){return S(a,b,!0)}}),n.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=n.data(f),1===f.nodeType&&!n._data(f,"parsedAttrs"))){c=g.length;while(c--)d=g[c].name,0===d.indexOf("data-")&&(d=n.camelCase(d.slice(5)),P(f,d,e[d]));n._data(f,"parsedAttrs",!0)}return e}return"object"==typeof a?this.each(function(){n.data(this,a)}):arguments.length>1?this.each(function(){n.data(this,a,b)}):f?P(f,a,n.data(f,a)):void 0},removeData:function(a){return this.each(function(){n.removeData(this,a)})}}),n.extend({queue:function(a,b,c){var d;return a?(b=(b||"fx")+"queue",d=n._data(a,b),c&&(!d||n.isArray(c)?d=n._data(a,b,n.makeArray(c)):d.push(c)),d||[]):void 0},dequeue:function(a,b){b=b||"fx";var c=n.queue(a,b),d=c.length,e=c.shift(),f=n._queueHooks(a,b),g=function(){n.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return n._data(a,c)||n._data(a,c,{empty:n.Callbacks("once memory").add(function(){n._removeData(a,b+"queue"),n._removeData(a,c)})})}}),n.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?n.queue(this[0],a):void 0===b?this:this.each(function(){var c=n.queue(this,a,b);n._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&n.dequeue(this,a)})},dequeue:function(a){return this.each(function(){n.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=n.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=n._data(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var T=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,U=["Top","Right","Bottom","Left"],V=function(a,b){return a=b||a,"none"===n.css(a,"display")||!n.contains(a.ownerDocument,a)},W=n.access=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===n.type(c)){e=!0;for(h in c)n.access(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,n.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(n(a),c)})),b))for(;i>h;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f},X=/^(?:checkbox|radio)$/i;!function(){var a=z.createDocumentFragment(),b=z.createElement("div"),c=z.createElement("input");if(b.setAttribute("className","t"),b.innerHTML="  <link/><table></table><a href='/a'>a</a>",l.leadingWhitespace=3===b.firstChild.nodeType,l.tbody=!b.getElementsByTagName("tbody").length,l.htmlSerialize=!!b.getElementsByTagName("link").length,l.html5Clone="<:nav></:nav>"!==z.createElement("nav").cloneNode(!0).outerHTML,c.type="checkbox",c.checked=!0,a.appendChild(c),l.appendChecked=c.checked,b.innerHTML="<textarea>x</textarea>",l.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue,a.appendChild(b),b.innerHTML="<input type='radio' checked='checked' name='t'/>",l.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,l.noCloneEvent=!0,b.attachEvent&&(b.attachEvent("onclick",function(){l.noCloneEvent=!1}),b.cloneNode(!0).click()),null==l.deleteExpando){l.deleteExpando=!0;try{delete b.test}catch(d){l.deleteExpando=!1}}a=b=c=null}(),function(){var b,c,d=z.createElement("div");for(b in{submit:!0,change:!0,focusin:!0})c="on"+b,(l[b+"Bubbles"]=c in a)||(d.setAttribute(c,"t"),l[b+"Bubbles"]=d.attributes[c].expando===!1);d=null}();var Y=/^(?:input|select|textarea)$/i,Z=/^key/,$=/^(?:mouse|contextmenu)|click/,_=/^(?:focusinfocus|focusoutblur)$/,ab=/^([^.]*)(?:\.(.+)|)$/;function bb(){return!0}function cb(){return!1}function db(){try{return z.activeElement}catch(a){}}n.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=n._data(a);if(r){c.handler&&(i=c,c=i.handler,e=i.selector),c.guid||(c.guid=n.guid++),(g=r.events)||(g=r.events={}),(k=r.handle)||(k=r.handle=function(a){return typeof n===L||a&&n.event.triggered===a.type?void 0:n.event.dispatch.apply(k.elem,arguments)},k.elem=a),b=(b||"").match(F)||[""],h=b.length;while(h--)f=ab.exec(b[h])||[],o=q=f[1],p=(f[2]||"").split(".").sort(),o&&(j=n.event.special[o]||{},o=(e?j.delegateType:j.bindType)||o,j=n.event.special[o]||{},l=n.extend({type:o,origType:q,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&n.expr.match.needsContext.test(e),namespace:p.join(".")},i),(m=g[o])||(m=g[o]=[],m.delegateCount=0,j.setup&&j.setup.call(a,d,p,k)!==!1||(a.addEventListener?a.addEventListener(o,k,!1):a.attachEvent&&a.attachEvent("on"+o,k))),j.add&&(j.add.call(a,l),l.handler.guid||(l.handler.guid=c.guid)),e?m.splice(m.delegateCount++,0,l):m.push(l),n.event.global[o]=!0);a=null}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=n.hasData(a)&&n._data(a);if(r&&(k=r.events)){b=(b||"").match(F)||[""],j=b.length;while(j--)if(h=ab.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o){l=n.event.special[o]||{},o=(d?l.delegateType:l.bindType)||o,m=k[o]||[],h=h[2]&&new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"),i=f=m.length;while(f--)g=m[f],!e&&q!==g.origType||c&&c.guid!==g.guid||h&&!h.test(g.namespace)||d&&d!==g.selector&&("**"!==d||!g.selector)||(m.splice(f,1),g.selector&&m.delegateCount--,l.remove&&l.remove.call(a,g));i&&!m.length&&(l.teardown&&l.teardown.call(a,p,r.handle)!==!1||n.removeEvent(a,o,r.handle),delete k[o])}else for(o in k)n.event.remove(a,o+b[j],c,d,!0);n.isEmptyObject(k)&&(delete r.handle,n._removeData(a,"events"))}},trigger:function(b,c,d,e){var f,g,h,i,k,l,m,o=[d||z],p=j.call(b,"type")?b.type:b,q=j.call(b,"namespace")?b.namespace.split("."):[];if(h=l=d=d||z,3!==d.nodeType&&8!==d.nodeType&&!_.test(p+n.event.triggered)&&(p.indexOf(".")>=0&&(q=p.split("."),p=q.shift(),q.sort()),g=p.indexOf(":")<0&&"on"+p,b=b[n.expando]?b:new n.Event(p,"object"==typeof b&&b),b.isTrigger=e?2:3,b.namespace=q.join("."),b.namespace_re=b.namespace?new RegExp("(^|\\.)"+q.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=d),c=null==c?[b]:n.makeArray(c,[b]),k=n.event.special[p]||{},e||!k.trigger||k.trigger.apply(d,c)!==!1)){if(!e&&!k.noBubble&&!n.isWindow(d)){for(i=k.delegateType||p,_.test(i+p)||(h=h.parentNode);h;h=h.parentNode)o.push(h),l=h;l===(d.ownerDocument||z)&&o.push(l.defaultView||l.parentWindow||a)}m=0;while((h=o[m++])&&!b.isPropagationStopped())b.type=m>1?i:k.bindType||p,f=(n._data(h,"events")||{})[b.type]&&n._data(h,"handle"),f&&f.apply(h,c),f=g&&h[g],f&&f.apply&&n.acceptData(h)&&(b.result=f.apply(h,c),b.result===!1&&b.preventDefault());if(b.type=p,!e&&!b.isDefaultPrevented()&&(!k._default||k._default.apply(o.pop(),c)===!1)&&n.acceptData(d)&&g&&d[p]&&!n.isWindow(d)){l=d[g],l&&(d[g]=null),n.event.triggered=p;try{d[p]()}catch(r){}n.event.triggered=void 0,l&&(d[g]=l)}return b.result}},dispatch:function(a){a=n.event.fix(a);var b,c,e,f,g,h=[],i=d.call(arguments),j=(n._data(this,"events")||{})[a.type]||[],k=n.event.special[a.type]||{};if(i[0]=a,a.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,a)!==!1){h=n.event.handlers.call(this,a,j),b=0;while((f=h[b++])&&!a.isPropagationStopped()){a.currentTarget=f.elem,g=0;while((e=f.handlers[g++])&&!a.isImmediatePropagationStopped())(!a.namespace_re||a.namespace_re.test(e.namespace))&&(a.handleObj=e,a.data=e.data,c=((n.event.special[e.origType]||{}).handle||e.handler).apply(f.elem,i),void 0!==c&&(a.result=c)===!1&&(a.preventDefault(),a.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,a),a.result}},handlers:function(a,b){var c,d,e,f,g=[],h=b.delegateCount,i=a.target;if(h&&i.nodeType&&(!a.button||"click"!==a.type))for(;i!=this;i=i.parentNode||this)if(1===i.nodeType&&(i.disabled!==!0||"click"!==a.type)){for(e=[],f=0;h>f;f++)d=b[f],c=d.selector+" ",void 0===e[c]&&(e[c]=d.needsContext?n(c,this).index(i)>=0:n.find(c,this,null,[i]).length),e[c]&&e.push(d);e.length&&g.push({elem:i,handlers:e})}return h<b.length&&g.push({elem:this,handlers:b.slice(h)}),g},fix:function(a){if(a[n.expando])return a;var b,c,d,e=a.type,f=a,g=this.fixHooks[e];g||(this.fixHooks[e]=g=$.test(e)?this.mouseHooks:Z.test(e)?this.keyHooks:{}),d=g.props?this.props.concat(g.props):this.props,a=new n.Event(f),b=d.length;while(b--)c=d[b],a[c]=f[c];return a.target||(a.target=f.srcElement||z),3===a.target.nodeType&&(a.target=a.target.parentNode),a.metaKey=!!a.metaKey,g.filter?g.filter(a,f):a},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){return null==a.which&&(a.which=null!=b.charCode?b.charCode:b.keyCode),a}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,b){var c,d,e,f=b.button,g=b.fromElement;return null==a.pageX&&null!=b.clientX&&(d=a.target.ownerDocument||z,e=d.documentElement,c=d.body,a.pageX=b.clientX+(e&&e.scrollLeft||c&&c.scrollLeft||0)-(e&&e.clientLeft||c&&c.clientLeft||0),a.pageY=b.clientY+(e&&e.scrollTop||c&&c.scrollTop||0)-(e&&e.clientTop||c&&c.clientTop||0)),!a.relatedTarget&&g&&(a.relatedTarget=g===a.target?b.toElement:g),a.which||void 0===f||(a.which=1&f?1:2&f?3:4&f?2:0),a}},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==db()&&this.focus)try{return this.focus(),!1}catch(a){}},delegateType:"focusin"},blur:{trigger:function(){return this===db()&&this.blur?(this.blur(),!1):void 0},delegateType:"focusout"},click:{trigger:function(){return n.nodeName(this,"input")&&"checkbox"===this.type&&this.click?(this.click(),!1):void 0},_default:function(a){return n.nodeName(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&(a.originalEvent.returnValue=a.result)}}},simulate:function(a,b,c,d){var e=n.extend(new n.Event,c,{type:a,isSimulated:!0,originalEvent:{}});d?n.event.trigger(e,null,b):n.event.dispatch.call(b,e),e.isDefaultPrevented()&&c.preventDefault()}},n.removeEvent=z.removeEventListener?function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c,!1)}:function(a,b,c){var d="on"+b;a.detachEvent&&(typeof a[d]===L&&(a[d]=null),a.detachEvent(d,c))},n.Event=function(a,b){return this instanceof n.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&(a.returnValue===!1||a.getPreventDefault&&a.getPreventDefault())?bb:cb):this.type=a,b&&n.extend(this,b),this.timeStamp=a&&a.timeStamp||n.now(),void(this[n.expando]=!0)):new n.Event(a,b)},n.Event.prototype={isDefaultPrevented:cb,isPropagationStopped:cb,isImmediatePropagationStopped:cb,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=bb,a&&(a.preventDefault?a.preventDefault():a.returnValue=!1)},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=bb,a&&(a.stopPropagation&&a.stopPropagation(),a.cancelBubble=!0)},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=bb,this.stopPropagation()}},n.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(a,b){n.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return(!e||e!==d&&!n.contains(d,e))&&(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),l.submitBubbles||(n.event.special.submit={setup:function(){return n.nodeName(this,"form")?!1:void n.event.add(this,"click._submit keypress._submit",function(a){var b=a.target,c=n.nodeName(b,"input")||n.nodeName(b,"button")?b.form:void 0;c&&!n._data(c,"submitBubbles")&&(n.event.add(c,"submit._submit",function(a){a._submit_bubble=!0}),n._data(c,"submitBubbles",!0))})},postDispatch:function(a){a._submit_bubble&&(delete a._submit_bubble,this.parentNode&&!a.isTrigger&&n.event.simulate("submit",this.parentNode,a,!0))},teardown:function(){return n.nodeName(this,"form")?!1:void n.event.remove(this,"._submit")}}),l.changeBubbles||(n.event.special.change={setup:function(){return Y.test(this.nodeName)?(("checkbox"===this.type||"radio"===this.type)&&(n.event.add(this,"propertychange._change",function(a){"checked"===a.originalEvent.propertyName&&(this._just_changed=!0)}),n.event.add(this,"click._change",function(a){this._just_changed&&!a.isTrigger&&(this._just_changed=!1),n.event.simulate("change",this,a,!0)})),!1):void n.event.add(this,"beforeactivate._change",function(a){var b=a.target;Y.test(b.nodeName)&&!n._data(b,"changeBubbles")&&(n.event.add(b,"change._change",function(a){!this.parentNode||a.isSimulated||a.isTrigger||n.event.simulate("change",this.parentNode,a,!0)}),n._data(b,"changeBubbles",!0))})},handle:function(a){var b=a.target;return this!==b||a.isSimulated||a.isTrigger||"radio"!==b.type&&"checkbox"!==b.type?a.handleObj.handler.apply(this,arguments):void 0},teardown:function(){return n.event.remove(this,"._change"),!Y.test(this.nodeName)}}),l.focusinBubbles||n.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){n.event.simulate(b,a.target,n.event.fix(a),!0)};n.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=n._data(d,b);e||d.addEventListener(a,c,!0),n._data(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=n._data(d,b)-1;e?n._data(d,b,e):(d.removeEventListener(a,c,!0),n._removeData(d,b))}}}),n.fn.extend({on:function(a,b,c,d,e){var f,g;if("object"==typeof a){"string"!=typeof b&&(c=c||b,b=void 0);for(f in a)this.on(f,b,c,a[f],e);return this}if(null==c&&null==d?(d=b,c=b=void 0):null==d&&("string"==typeof b?(d=c,c=void 0):(d=c,c=b,b=void 0)),d===!1)d=cb;else if(!d)return this;return 1===e&&(g=d,d=function(a){return n().off(a),g.apply(this,arguments)},d.guid=g.guid||(g.guid=n.guid++)),this.each(function(){n.event.add(this,a,d,c,b)})},one:function(a,b,c,d){return this.on(a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,n(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return(b===!1||"function"==typeof b)&&(c=b,b=void 0),c===!1&&(c=cb),this.each(function(){n.event.remove(this,a,c,b)})},trigger:function(a,b){return this.each(function(){n.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];return c?n.event.trigger(a,b,c,!0):void 0}});function eb(a){var b=fb.split("|"),c=a.createDocumentFragment();if(c.createElement)while(b.length)c.createElement(b.pop());return c}var fb="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",gb=/ jQuery\d+="(?:null|\d+)"/g,hb=new RegExp("<(?:"+fb+")[\\s/>]","i"),ib=/^\s+/,jb=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,kb=/<([\w:]+)/,lb=/<tbody/i,mb=/<|&#?\w+;/,nb=/<(?:script|style|link)/i,ob=/checked\s*(?:[^=]|=\s*.checked.)/i,pb=/^$|\/(?:java|ecma)script/i,qb=/^true\/(.*)/,rb=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,sb={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],area:[1,"<map>","</map>"],param:[1,"<object>","</object>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:l.htmlSerialize?[0,"",""]:[1,"X<div>","</div>"]},tb=eb(z),ub=tb.appendChild(z.createElement("div"));sb.optgroup=sb.option,sb.tbody=sb.tfoot=sb.colgroup=sb.caption=sb.thead,sb.th=sb.td;function vb(a,b){var c,d,e=0,f=typeof a.getElementsByTagName!==L?a.getElementsByTagName(b||"*"):typeof a.querySelectorAll!==L?a.querySelectorAll(b||"*"):void 0;if(!f)for(f=[],c=a.childNodes||a;null!=(d=c[e]);e++)!b||n.nodeName(d,b)?f.push(d):n.merge(f,vb(d,b));return void 0===b||b&&n.nodeName(a,b)?n.merge([a],f):f}function wb(a){X.test(a.type)&&(a.defaultChecked=a.checked)}function xb(a,b){return n.nodeName(a,"table")&&n.nodeName(11!==b.nodeType?b:b.firstChild,"tr")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function yb(a){return a.type=(null!==n.find.attr(a,"type"))+"/"+a.type,a}function zb(a){var b=qb.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function Ab(a,b){for(var c,d=0;null!=(c=a[d]);d++)n._data(c,"globalEval",!b||n._data(b[d],"globalEval"))}function Bb(a,b){if(1===b.nodeType&&n.hasData(a)){var c,d,e,f=n._data(a),g=n._data(b,f),h=f.events;if(h){delete g.handle,g.events={};for(c in h)for(d=0,e=h[c].length;e>d;d++)n.event.add(b,c,h[c][d])}g.data&&(g.data=n.extend({},g.data))}}function Cb(a,b){var c,d,e;if(1===b.nodeType){if(c=b.nodeName.toLowerCase(),!l.noCloneEvent&&b[n.expando]){e=n._data(b);for(d in e.events)n.removeEvent(b,d,e.handle);b.removeAttribute(n.expando)}"script"===c&&b.text!==a.text?(yb(b).text=a.text,zb(b)):"object"===c?(b.parentNode&&(b.outerHTML=a.outerHTML),l.html5Clone&&a.innerHTML&&!n.trim(b.innerHTML)&&(b.innerHTML=a.innerHTML)):"input"===c&&X.test(a.type)?(b.defaultChecked=b.checked=a.checked,b.value!==a.value&&(b.value=a.value)):"option"===c?b.defaultSelected=b.selected=a.defaultSelected:("input"===c||"textarea"===c)&&(b.defaultValue=a.defaultValue)}}n.extend({clone:function(a,b,c){var d,e,f,g,h,i=n.contains(a.ownerDocument,a);if(l.html5Clone||n.isXMLDoc(a)||!hb.test("<"+a.nodeName+">")?f=a.cloneNode(!0):(ub.innerHTML=a.outerHTML,ub.removeChild(f=ub.firstChild)),!(l.noCloneEvent&&l.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||n.isXMLDoc(a)))for(d=vb(f),h=vb(a),g=0;null!=(e=h[g]);++g)d[g]&&Cb(e,d[g]);if(b)if(c)for(h=h||vb(a),d=d||vb(f),g=0;null!=(e=h[g]);g++)Bb(e,d[g]);else Bb(a,f);return d=vb(f,"script"),d.length>0&&Ab(d,!i&&vb(a,"script")),d=h=e=null,f},buildFragment:function(a,b,c,d){for(var e,f,g,h,i,j,k,m=a.length,o=eb(b),p=[],q=0;m>q;q++)if(f=a[q],f||0===f)if("object"===n.type(f))n.merge(p,f.nodeType?[f]:f);else if(mb.test(f)){h=h||o.appendChild(b.createElement("div")),i=(kb.exec(f)||["",""])[1].toLowerCase(),k=sb[i]||sb._default,h.innerHTML=k[1]+f.replace(jb,"<$1></$2>")+k[2],e=k[0];while(e--)h=h.lastChild;if(!l.leadingWhitespace&&ib.test(f)&&p.push(b.createTextNode(ib.exec(f)[0])),!l.tbody){f="table"!==i||lb.test(f)?"<table>"!==k[1]||lb.test(f)?0:h:h.firstChild,e=f&&f.childNodes.length;while(e--)n.nodeName(j=f.childNodes[e],"tbody")&&!j.childNodes.length&&f.removeChild(j)}n.merge(p,h.childNodes),h.textContent="";while(h.firstChild)h.removeChild(h.firstChild);h=o.lastChild}else p.push(b.createTextNode(f));h&&o.removeChild(h),l.appendChecked||n.grep(vb(p,"input"),wb),q=0;while(f=p[q++])if((!d||-1===n.inArray(f,d))&&(g=n.contains(f.ownerDocument,f),h=vb(o.appendChild(f),"script"),g&&Ab(h),c)){e=0;while(f=h[e++])pb.test(f.type||"")&&c.push(f)}return h=null,o},cleanData:function(a,b){for(var d,e,f,g,h=0,i=n.expando,j=n.cache,k=l.deleteExpando,m=n.event.special;null!=(d=a[h]);h++)if((b||n.acceptData(d))&&(f=d[i],g=f&&j[f])){if(g.events)for(e in g.events)m[e]?n.event.remove(d,e):n.removeEvent(d,e,g.handle);j[f]&&(delete j[f],k?delete d[i]:typeof d.removeAttribute!==L?d.removeAttribute(i):d[i]=null,c.push(f))}}}),n.fn.extend({text:function(a){return W(this,function(a){return void 0===a?n.text(this):this.empty().append((this[0]&&this[0].ownerDocument||z).createTextNode(a))},null,a,arguments.length)},append:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=xb(this,a);b.appendChild(a)}})},prepend:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=xb(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},remove:function(a,b){for(var c,d=a?n.filter(a,this):this,e=0;null!=(c=d[e]);e++)b||1!==c.nodeType||n.cleanData(vb(c)),c.parentNode&&(b&&n.contains(c.ownerDocument,c)&&Ab(vb(c,"script")),c.parentNode.removeChild(c));return this},empty:function(){for(var a,b=0;null!=(a=this[b]);b++){1===a.nodeType&&n.cleanData(vb(a,!1));while(a.firstChild)a.removeChild(a.firstChild);a.options&&n.nodeName(a,"select")&&(a.options.length=0)}return this},clone:function(a,b){return a=null==a?!1:a,b=null==b?a:b,this.map(function(){return n.clone(this,a,b)})},html:function(a){return W(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a)return 1===b.nodeType?b.innerHTML.replace(gb,""):void 0;if(!("string"!=typeof a||nb.test(a)||!l.htmlSerialize&&hb.test(a)||!l.leadingWhitespace&&ib.test(a)||sb[(kb.exec(a)||["",""])[1].toLowerCase()])){a=a.replace(jb,"<$1></$2>");try{for(;d>c;c++)b=this[c]||{},1===b.nodeType&&(n.cleanData(vb(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=arguments[0];return this.domManip(arguments,function(b){a=this.parentNode,n.cleanData(vb(this)),a&&a.replaceChild(b,this)}),a&&(a.length||a.nodeType)?this:this.remove()},detach:function(a){return this.remove(a,!0)},domManip:function(a,b){a=e.apply([],a);var c,d,f,g,h,i,j=0,k=this.length,m=this,o=k-1,p=a[0],q=n.isFunction(p);if(q||k>1&&"string"==typeof p&&!l.checkClone&&ob.test(p))return this.each(function(c){var d=m.eq(c);q&&(a[0]=p.call(this,c,d.html())),d.domManip(a,b)});if(k&&(i=n.buildFragment(a,this[0].ownerDocument,!1,this),c=i.firstChild,1===i.childNodes.length&&(i=c),c)){for(g=n.map(vb(i,"script"),yb),f=g.length;k>j;j++)d=i,j!==o&&(d=n.clone(d,!0,!0),f&&n.merge(g,vb(d,"script"))),b.call(this[j],d,j);if(f)for(h=g[g.length-1].ownerDocument,n.map(g,zb),j=0;f>j;j++)d=g[j],pb.test(d.type||"")&&!n._data(d,"globalEval")&&n.contains(h,d)&&(d.src?n._evalUrl&&n._evalUrl(d.src):n.globalEval((d.text||d.textContent||d.innerHTML||"").replace(rb,"")));i=c=null}return this}}),n.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){n.fn[a]=function(a){for(var c,d=0,e=[],g=n(a),h=g.length-1;h>=d;d++)c=d===h?this:this.clone(!0),n(g[d])[b](c),f.apply(e,c.get());return this.pushStack(e)}});var Db,Eb={};function Fb(b,c){var d=n(c.createElement(b)).appendTo(c.body),e=a.getDefaultComputedStyle?a.getDefaultComputedStyle(d[0]).display:n.css(d[0],"display");return d.detach(),e}function Gb(a){var b=z,c=Eb[a];return c||(c=Fb(a,b),"none"!==c&&c||(Db=(Db||n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement),b=(Db[0].contentWindow||Db[0].contentDocument).document,b.write(),b.close(),c=Fb(a,b),Db.detach()),Eb[a]=c),c}!function(){var a,b,c=z.createElement("div"),d="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;padding:0;margin:0;border:0";c.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",a=c.getElementsByTagName("a")[0],a.style.cssText="float:left;opacity:.5",l.opacity=/^0.5/.test(a.style.opacity),l.cssFloat=!!a.style.cssFloat,c.style.backgroundClip="content-box",c.cloneNode(!0).style.backgroundClip="",l.clearCloneStyle="content-box"===c.style.backgroundClip,a=c=null,l.shrinkWrapBlocks=function(){var a,c,e,f;if(null==b){if(a=z.getElementsByTagName("body")[0],!a)return;f="border:0;width:0;height:0;position:absolute;top:0;left:-9999px",c=z.createElement("div"),e=z.createElement("div"),a.appendChild(c).appendChild(e),b=!1,typeof e.style.zoom!==L&&(e.style.cssText=d+";width:1px;padding:1px;zoom:1",e.innerHTML="<div></div>",e.firstChild.style.width="5px",b=3!==e.offsetWidth),a.removeChild(c),a=c=e=null}return b}}();var Hb=/^margin/,Ib=new RegExp("^("+T+")(?!px)[a-z%]+$","i"),Jb,Kb,Lb=/^(top|right|bottom|left)$/;a.getComputedStyle?(Jb=function(a){return a.ownerDocument.defaultView.getComputedStyle(a,null)},Kb=function(a,b,c){var d,e,f,g,h=a.style;return c=c||Jb(a),g=c?c.getPropertyValue(b)||c[b]:void 0,c&&(""!==g||n.contains(a.ownerDocument,a)||(g=n.style(a,b)),Ib.test(g)&&Hb.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f)),void 0===g?g:g+""}):z.documentElement.currentStyle&&(Jb=function(a){return a.currentStyle},Kb=function(a,b,c){var d,e,f,g,h=a.style;return c=c||Jb(a),g=c?c[b]:void 0,null==g&&h&&h[b]&&(g=h[b]),Ib.test(g)&&!Lb.test(b)&&(d=h.left,e=a.runtimeStyle,f=e&&e.left,f&&(e.left=a.currentStyle.left),h.left="fontSize"===b?"1em":g,g=h.pixelLeft+"px",h.left=d,f&&(e.left=f)),void 0===g?g:g+""||"auto"});function Mb(a,b){return{get:function(){var c=a();if(null!=c)return c?void delete this.get:(this.get=b).apply(this,arguments)}}}!function(){var b,c,d,e,f,g,h=z.createElement("div"),i="border:0;width:0;height:0;position:absolute;top:0;left:-9999px",j="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;padding:0;margin:0;border:0";h.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",b=h.getElementsByTagName("a")[0],b.style.cssText="float:left;opacity:.5",l.opacity=/^0.5/.test(b.style.opacity),l.cssFloat=!!b.style.cssFloat,h.style.backgroundClip="content-box",h.cloneNode(!0).style.backgroundClip="",l.clearCloneStyle="content-box"===h.style.backgroundClip,b=h=null,n.extend(l,{reliableHiddenOffsets:function(){if(null!=c)return c;var a,b,d,e=z.createElement("div"),f=z.getElementsByTagName("body")[0];if(f)return e.setAttribute("className","t"),e.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",a=z.createElement("div"),a.style.cssText=i,f.appendChild(a).appendChild(e),e.innerHTML="<table><tr><td></td><td>t</td></tr></table>",b=e.getElementsByTagName("td"),b[0].style.cssText="padding:0;margin:0;border:0;display:none",d=0===b[0].offsetHeight,b[0].style.display="",b[1].style.display="none",c=d&&0===b[0].offsetHeight,f.removeChild(a),e=f=null,c},boxSizing:function(){return null==d&&k(),d},boxSizingReliable:function(){return null==e&&k(),e},pixelPosition:function(){return null==f&&k(),f},reliableMarginRight:function(){var b,c,d,e;if(null==g&&a.getComputedStyle){if(b=z.getElementsByTagName("body")[0],!b)return;c=z.createElement("div"),d=z.createElement("div"),c.style.cssText=i,b.appendChild(c).appendChild(d),e=d.appendChild(z.createElement("div")),e.style.cssText=d.style.cssText=j,e.style.marginRight=e.style.width="0",d.style.width="1px",g=!parseFloat((a.getComputedStyle(e,null)||{}).marginRight),b.removeChild(c)}return g}});function k(){var b,c,h=z.getElementsByTagName("body")[0];h&&(b=z.createElement("div"),c=z.createElement("div"),b.style.cssText=i,h.appendChild(b).appendChild(c),c.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:absolute;display:block;padding:1px;border:1px;width:4px;margin-top:1%;top:1%",n.swap(h,null!=h.style.zoom?{zoom:1}:{},function(){d=4===c.offsetWidth}),e=!0,f=!1,g=!0,a.getComputedStyle&&(f="1%"!==(a.getComputedStyle(c,null)||{}).top,e="4px"===(a.getComputedStyle(c,null)||{width:"4px"}).width),h.removeChild(b),c=h=null)}}(),n.swap=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e};var Nb=/alpha\([^)]*\)/i,Ob=/opacity\s*=\s*([^)]*)/,Pb=/^(none|table(?!-c[ea]).+)/,Qb=new RegExp("^("+T+")(.*)$","i"),Rb=new RegExp("^([+-])=("+T+")","i"),Sb={position:"absolute",visibility:"hidden",display:"block"},Tb={letterSpacing:0,fontWeight:400},Ub=["Webkit","O","Moz","ms"];function Vb(a,b){if(b in a)return b;var c=b.charAt(0).toUpperCase()+b.slice(1),d=b,e=Ub.length;while(e--)if(b=Ub[e]+c,b in a)return b;return d}function Wb(a,b){for(var c,d,e,f=[],g=0,h=a.length;h>g;g++)d=a[g],d.style&&(f[g]=n._data(d,"olddisplay"),c=d.style.display,b?(f[g]||"none"!==c||(d.style.display=""),""===d.style.display&&V(d)&&(f[g]=n._data(d,"olddisplay",Gb(d.nodeName)))):f[g]||(e=V(d),(c&&"none"!==c||!e)&&n._data(d,"olddisplay",e?c:n.css(d,"display"))));for(g=0;h>g;g++)d=a[g],d.style&&(b&&"none"!==d.style.display&&""!==d.style.display||(d.style.display=b?f[g]||"":"none"));return a}function Xb(a,b,c){var d=Qb.exec(b);return d?Math.max(0,d[1]-(c||0))+(d[2]||"px"):b}function Yb(a,b,c,d,e){for(var f=c===(d?"border":"content")?4:"width"===b?1:0,g=0;4>f;f+=2)"margin"===c&&(g+=n.css(a,c+U[f],!0,e)),d?("content"===c&&(g-=n.css(a,"padding"+U[f],!0,e)),"margin"!==c&&(g-=n.css(a,"border"+U[f]+"Width",!0,e))):(g+=n.css(a,"padding"+U[f],!0,e),"padding"!==c&&(g+=n.css(a,"border"+U[f]+"Width",!0,e)));return g}function Zb(a,b,c){var d=!0,e="width"===b?a.offsetWidth:a.offsetHeight,f=Jb(a),g=l.boxSizing()&&"border-box"===n.css(a,"boxSizing",!1,f);if(0>=e||null==e){if(e=Kb(a,b,f),(0>e||null==e)&&(e=a.style[b]),Ib.test(e))return e;d=g&&(l.boxSizingReliable()||e===a.style[b]),e=parseFloat(e)||0}return e+Yb(a,b,c||(g?"border":"content"),d,f)+"px"}n.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=Kb(a,"opacity");return""===c?"1":c}}}},cssNumber:{columnCount:!0,fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":l.cssFloat?"cssFloat":"styleFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=n.camelCase(b),i=a.style;if(b=n.cssProps[h]||(n.cssProps[h]=Vb(i,h)),g=n.cssHooks[b]||n.cssHooks[h],void 0===c)return g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:i[b];if(f=typeof c,"string"===f&&(e=Rb.exec(c))&&(c=(e[1]+1)*e[2]+parseFloat(n.css(a,b)),f="number"),null!=c&&c===c&&("number"!==f||n.cssNumber[h]||(c+="px"),l.clearCloneStyle||""!==c||0!==b.indexOf("background")||(i[b]="inherit"),!(g&&"set"in g&&void 0===(c=g.set(a,c,d)))))try{i[b]="",i[b]=c}catch(j){}}},css:function(a,b,c,d){var e,f,g,h=n.camelCase(b);return b=n.cssProps[h]||(n.cssProps[h]=Vb(a.style,h)),g=n.cssHooks[b]||n.cssHooks[h],g&&"get"in g&&(f=g.get(a,!0,c)),void 0===f&&(f=Kb(a,b,d)),"normal"===f&&b in Tb&&(f=Tb[b]),""===c||c?(e=parseFloat(f),c===!0||n.isNumeric(e)?e||0:f):f}}),n.each(["height","width"],function(a,b){n.cssHooks[b]={get:function(a,c,d){return c?0===a.offsetWidth&&Pb.test(n.css(a,"display"))?n.swap(a,Sb,function(){return Zb(a,b,d)}):Zb(a,b,d):void 0},set:function(a,c,d){var e=d&&Jb(a);return Xb(a,c,d?Yb(a,b,d,l.boxSizing()&&"border-box"===n.css(a,"boxSizing",!1,e),e):0)}}}),l.opacity||(n.cssHooks.opacity={get:function(a,b){return Ob.test((b&&a.currentStyle?a.currentStyle.filter:a.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":b?"1":""},set:function(a,b){var c=a.style,d=a.currentStyle,e=n.isNumeric(b)?"alpha(opacity="+100*b+")":"",f=d&&d.filter||c.filter||"";c.zoom=1,(b>=1||""===b)&&""===n.trim(f.replace(Nb,""))&&c.removeAttribute&&(c.removeAttribute("filter"),""===b||d&&!d.filter)||(c.filter=Nb.test(f)?f.replace(Nb,e):f+" "+e)}}),n.cssHooks.marginRight=Mb(l.reliableMarginRight,function(a,b){return b?n.swap(a,{display:"inline-block"},Kb,[a,"marginRight"]):void 0}),n.each({margin:"",padding:"",border:"Width"},function(a,b){n.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];4>d;d++)e[a+U[d]+b]=f[d]||f[d-2]||f[0];return e}},Hb.test(a)||(n.cssHooks[a+b].set=Xb)}),n.fn.extend({css:function(a,b){return W(this,function(a,b,c){var d,e,f={},g=0;if(n.isArray(b)){for(d=Jb(a),e=b.length;e>g;g++)f[b[g]]=n.css(a,b[g],!1,d);return f}return void 0!==c?n.style(a,b,c):n.css(a,b)
},a,b,arguments.length>1)},show:function(){return Wb(this,!0)},hide:function(){return Wb(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){V(this)?n(this).show():n(this).hide()})}});function $b(a,b,c,d,e){return new $b.prototype.init(a,b,c,d,e)}n.Tween=$b,$b.prototype={constructor:$b,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||"swing",this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(n.cssNumber[c]?"":"px")},cur:function(){var a=$b.propHooks[this.prop];return a&&a.get?a.get(this):$b.propHooks._default.get(this)},run:function(a){var b,c=$b.propHooks[this.prop];return this.pos=b=this.options.duration?n.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):$b.propHooks._default.set(this),this}},$b.prototype.init.prototype=$b.prototype,$b.propHooks={_default:{get:function(a){var b;return null==a.elem[a.prop]||a.elem.style&&null!=a.elem.style[a.prop]?(b=n.css(a.elem,a.prop,""),b&&"auto"!==b?b:0):a.elem[a.prop]},set:function(a){n.fx.step[a.prop]?n.fx.step[a.prop](a):a.elem.style&&(null!=a.elem.style[n.cssProps[a.prop]]||n.cssHooks[a.prop])?n.style(a.elem,a.prop,a.now+a.unit):a.elem[a.prop]=a.now}}},$b.propHooks.scrollTop=$b.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},n.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2}},n.fx=$b.prototype.init,n.fx.step={};var _b,ac,bc=/^(?:toggle|show|hide)$/,cc=new RegExp("^(?:([+-])=|)("+T+")([a-z%]*)$","i"),dc=/queueHooks$/,ec=[jc],fc={"*":[function(a,b){var c=this.createTween(a,b),d=c.cur(),e=cc.exec(b),f=e&&e[3]||(n.cssNumber[a]?"":"px"),g=(n.cssNumber[a]||"px"!==f&&+d)&&cc.exec(n.css(c.elem,a)),h=1,i=20;if(g&&g[3]!==f){f=f||g[3],e=e||[],g=+d||1;do h=h||".5",g/=h,n.style(c.elem,a,g+f);while(h!==(h=c.cur()/d)&&1!==h&&--i)}return e&&(g=c.start=+g||+d||0,c.unit=f,c.end=e[1]?g+(e[1]+1)*e[2]:+e[2]),c}]};function gc(){return setTimeout(function(){_b=void 0}),_b=n.now()}function hc(a,b){var c,d={height:a},e=0;for(b=b?1:0;4>e;e+=2-b)c=U[e],d["margin"+c]=d["padding"+c]=a;return b&&(d.opacity=d.width=a),d}function ic(a,b,c){for(var d,e=(fc[b]||[]).concat(fc["*"]),f=0,g=e.length;g>f;f++)if(d=e[f].call(c,b,a))return d}function jc(a,b,c){var d,e,f,g,h,i,j,k,m=this,o={},p=a.style,q=a.nodeType&&V(a),r=n._data(a,"fxshow");c.queue||(h=n._queueHooks(a,"fx"),null==h.unqueued&&(h.unqueued=0,i=h.empty.fire,h.empty.fire=function(){h.unqueued||i()}),h.unqueued++,m.always(function(){m.always(function(){h.unqueued--,n.queue(a,"fx").length||h.empty.fire()})})),1===a.nodeType&&("height"in b||"width"in b)&&(c.overflow=[p.overflow,p.overflowX,p.overflowY],j=n.css(a,"display"),k=Gb(a.nodeName),"none"===j&&(j=k),"inline"===j&&"none"===n.css(a,"float")&&(l.inlineBlockNeedsLayout&&"inline"!==k?p.zoom=1:p.display="inline-block")),c.overflow&&(p.overflow="hidden",l.shrinkWrapBlocks()||m.always(function(){p.overflow=c.overflow[0],p.overflowX=c.overflow[1],p.overflowY=c.overflow[2]}));for(d in b)if(e=b[d],bc.exec(e)){if(delete b[d],f=f||"toggle"===e,e===(q?"hide":"show")){if("show"!==e||!r||void 0===r[d])continue;q=!0}o[d]=r&&r[d]||n.style(a,d)}if(!n.isEmptyObject(o)){r?"hidden"in r&&(q=r.hidden):r=n._data(a,"fxshow",{}),f&&(r.hidden=!q),q?n(a).show():m.done(function(){n(a).hide()}),m.done(function(){var b;n._removeData(a,"fxshow");for(b in o)n.style(a,b,o[b])});for(d in o)g=ic(q?r[d]:0,d,m),d in r||(r[d]=g.start,q&&(g.end=g.start,g.start="width"===d||"height"===d?1:0))}}function kc(a,b){var c,d,e,f,g;for(c in a)if(d=n.camelCase(c),e=b[d],f=a[c],n.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=n.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function lc(a,b,c){var d,e,f=0,g=ec.length,h=n.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=_b||gc(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;i>g;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),1>f&&i?c:(h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:n.extend({},b),opts:n.extend(!0,{specialEasing:{}},c),originalProperties:b,originalOptions:c,startTime:_b||gc(),duration:c.duration,tweens:[],createTween:function(b,c){var d=n.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;d>c;c++)j.tweens[c].run(1);return b?h.resolveWith(a,[j,b]):h.rejectWith(a,[j,b]),this}}),k=j.props;for(kc(k,j.opts.specialEasing);g>f;f++)if(d=ec[f].call(j,a,k,j.opts))return d;return n.map(k,ic,j),n.isFunction(j.opts.start)&&j.opts.start.call(a,j),n.fx.timer(n.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always)}n.Animation=n.extend(lc,{tweener:function(a,b){n.isFunction(a)?(b=a,a=["*"]):a=a.split(" ");for(var c,d=0,e=a.length;e>d;d++)c=a[d],fc[c]=fc[c]||[],fc[c].unshift(b)},prefilter:function(a,b){b?ec.unshift(a):ec.push(a)}}),n.speed=function(a,b,c){var d=a&&"object"==typeof a?n.extend({},a):{complete:c||!c&&b||n.isFunction(a)&&a,duration:a,easing:c&&b||b&&!n.isFunction(b)&&b};return d.duration=n.fx.off?0:"number"==typeof d.duration?d.duration:d.duration in n.fx.speeds?n.fx.speeds[d.duration]:n.fx.speeds._default,(null==d.queue||d.queue===!0)&&(d.queue="fx"),d.old=d.complete,d.complete=function(){n.isFunction(d.old)&&d.old.call(this),d.queue&&n.dequeue(this,d.queue)},d},n.fn.extend({fadeTo:function(a,b,c,d){return this.filter(V).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=n.isEmptyObject(a),f=n.speed(b,c,d),g=function(){var b=lc(this,n.extend({},a),f);(e||n._data(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=n.timers,g=n._data(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&dc.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));(b||!c)&&n.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=n._data(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=n.timers,g=d?d.length:0;for(c.finish=!0,n.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;g>b;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),n.each(["toggle","show","hide"],function(a,b){var c=n.fn[b];n.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(hc(b,!0),a,d,e)}}),n.each({slideDown:hc("show"),slideUp:hc("hide"),slideToggle:hc("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){n.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),n.timers=[],n.fx.tick=function(){var a,b=n.timers,c=0;for(_b=n.now();c<b.length;c++)a=b[c],a()||b[c]!==a||b.splice(c--,1);b.length||n.fx.stop(),_b=void 0},n.fx.timer=function(a){n.timers.push(a),a()?n.fx.start():n.timers.pop()},n.fx.interval=13,n.fx.start=function(){ac||(ac=setInterval(n.fx.tick,n.fx.interval))},n.fx.stop=function(){clearInterval(ac),ac=null},n.fx.speeds={slow:600,fast:200,_default:400},n.fn.delay=function(a,b){return a=n.fx?n.fx.speeds[a]||a:a,b=b||"fx",this.queue(b,function(b,c){var d=setTimeout(b,a);c.stop=function(){clearTimeout(d)}})},function(){var a,b,c,d,e=z.createElement("div");e.setAttribute("className","t"),e.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",a=e.getElementsByTagName("a")[0],c=z.createElement("select"),d=c.appendChild(z.createElement("option")),b=e.getElementsByTagName("input")[0],a.style.cssText="top:1px",l.getSetAttribute="t"!==e.className,l.style=/top/.test(a.getAttribute("style")),l.hrefNormalized="/a"===a.getAttribute("href"),l.checkOn=!!b.value,l.optSelected=d.selected,l.enctype=!!z.createElement("form").enctype,c.disabled=!0,l.optDisabled=!d.disabled,b=z.createElement("input"),b.setAttribute("value",""),l.input=""===b.getAttribute("value"),b.value="t",b.setAttribute("type","radio"),l.radioValue="t"===b.value,a=b=c=d=e=null}();var mc=/\r/g;n.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=n.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,n(this).val()):a,null==e?e="":"number"==typeof e?e+="":n.isArray(e)&&(e=n.map(e,function(a){return null==a?"":a+""})),b=n.valHooks[this.type]||n.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=n.valHooks[e.type]||n.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(mc,""):null==c?"":c)}}}),n.extend({valHooks:{option:{get:function(a){var b=n.find.attr(a,"value");return null!=b?b:n.text(a)}},select:{get:function(a){for(var b,c,d=a.options,e=a.selectedIndex,f="select-one"===a.type||0>e,g=f?null:[],h=f?e+1:d.length,i=0>e?h:f?e:0;h>i;i++)if(c=d[i],!(!c.selected&&i!==e||(l.optDisabled?c.disabled:null!==c.getAttribute("disabled"))||c.parentNode.disabled&&n.nodeName(c.parentNode,"optgroup"))){if(b=n(c).val(),f)return b;g.push(b)}return g},set:function(a,b){var c,d,e=a.options,f=n.makeArray(b),g=e.length;while(g--)if(d=e[g],n.inArray(n.valHooks.option.get(d),f)>=0)try{d.selected=c=!0}catch(h){d.scrollHeight}else d.selected=!1;return c||(a.selectedIndex=-1),e}}}}),n.each(["radio","checkbox"],function(){n.valHooks[this]={set:function(a,b){return n.isArray(b)?a.checked=n.inArray(n(a).val(),b)>=0:void 0}},l.checkOn||(n.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})});var nc,oc,pc=n.expr.attrHandle,qc=/^(?:checked|selected)$/i,rc=l.getSetAttribute,sc=l.input;n.fn.extend({attr:function(a,b){return W(this,n.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){n.removeAttr(this,a)})}}),n.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(a&&3!==f&&8!==f&&2!==f)return typeof a.getAttribute===L?n.prop(a,b,c):(1===f&&n.isXMLDoc(a)||(b=b.toLowerCase(),d=n.attrHooks[b]||(n.expr.match.bool.test(b)?oc:nc)),void 0===c?d&&"get"in d&&null!==(e=d.get(a,b))?e:(e=n.find.attr(a,b),null==e?void 0:e):null!==c?d&&"set"in d&&void 0!==(e=d.set(a,c,b))?e:(a.setAttribute(b,c+""),c):void n.removeAttr(a,b))},removeAttr:function(a,b){var c,d,e=0,f=b&&b.match(F);if(f&&1===a.nodeType)while(c=f[e++])d=n.propFix[c]||c,n.expr.match.bool.test(c)?sc&&rc||!qc.test(c)?a[d]=!1:a[n.camelCase("default-"+c)]=a[d]=!1:n.attr(a,c,""),a.removeAttribute(rc?c:d)},attrHooks:{type:{set:function(a,b){if(!l.radioValue&&"radio"===b&&n.nodeName(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}}}),oc={set:function(a,b,c){return b===!1?n.removeAttr(a,c):sc&&rc||!qc.test(c)?a.setAttribute(!rc&&n.propFix[c]||c,c):a[n.camelCase("default-"+c)]=a[c]=!0,c}},n.each(n.expr.match.bool.source.match(/\w+/g),function(a,b){var c=pc[b]||n.find.attr;pc[b]=sc&&rc||!qc.test(b)?function(a,b,d){var e,f;return d||(f=pc[b],pc[b]=e,e=null!=c(a,b,d)?b.toLowerCase():null,pc[b]=f),e}:function(a,b,c){return c?void 0:a[n.camelCase("default-"+b)]?b.toLowerCase():null}}),sc&&rc||(n.attrHooks.value={set:function(a,b,c){return n.nodeName(a,"input")?void(a.defaultValue=b):nc&&nc.set(a,b,c)}}),rc||(nc={set:function(a,b,c){var d=a.getAttributeNode(c);return d||a.setAttributeNode(d=a.ownerDocument.createAttribute(c)),d.value=b+="","value"===c||b===a.getAttribute(c)?b:void 0}},pc.id=pc.name=pc.coords=function(a,b,c){var d;return c?void 0:(d=a.getAttributeNode(b))&&""!==d.value?d.value:null},n.valHooks.button={get:function(a,b){var c=a.getAttributeNode(b);return c&&c.specified?c.value:void 0},set:nc.set},n.attrHooks.contenteditable={set:function(a,b,c){nc.set(a,""===b?!1:b,c)}},n.each(["width","height"],function(a,b){n.attrHooks[b]={set:function(a,c){return""===c?(a.setAttribute(b,"auto"),c):void 0}}})),l.style||(n.attrHooks.style={get:function(a){return a.style.cssText||void 0},set:function(a,b){return a.style.cssText=b+""}});var tc=/^(?:input|select|textarea|button|object)$/i,uc=/^(?:a|area)$/i;n.fn.extend({prop:function(a,b){return W(this,n.prop,a,b,arguments.length>1)},removeProp:function(a){return a=n.propFix[a]||a,this.each(function(){try{this[a]=void 0,delete this[a]}catch(b){}})}}),n.extend({propFix:{"for":"htmlFor","class":"className"},prop:function(a,b,c){var d,e,f,g=a.nodeType;if(a&&3!==g&&8!==g&&2!==g)return f=1!==g||!n.isXMLDoc(a),f&&(b=n.propFix[b]||b,e=n.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){var b=n.find.attr(a,"tabindex");return b?parseInt(b,10):tc.test(a.nodeName)||uc.test(a.nodeName)&&a.href?0:-1}}}}),l.hrefNormalized||n.each(["href","src"],function(a,b){n.propHooks[b]={get:function(a){return a.getAttribute(b,4)}}}),l.optSelected||(n.propHooks.selected={get:function(a){var b=a.parentNode;return b&&(b.selectedIndex,b.parentNode&&b.parentNode.selectedIndex),null}}),n.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){n.propFix[this.toLowerCase()]=this}),l.enctype||(n.propFix.enctype="encoding");var vc=/[\t\r\n\f]/g;n.fn.extend({addClass:function(a){var b,c,d,e,f,g,h=0,i=this.length,j="string"==typeof a&&a;if(n.isFunction(a))return this.each(function(b){n(this).addClass(a.call(this,b,this.className))});if(j)for(b=(a||"").match(F)||[];i>h;h++)if(c=this[h],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(vc," "):" ")){f=0;while(e=b[f++])d.indexOf(" "+e+" ")<0&&(d+=e+" ");g=n.trim(d),c.className!==g&&(c.className=g)}return this},removeClass:function(a){var b,c,d,e,f,g,h=0,i=this.length,j=0===arguments.length||"string"==typeof a&&a;if(n.isFunction(a))return this.each(function(b){n(this).removeClass(a.call(this,b,this.className))});if(j)for(b=(a||"").match(F)||[];i>h;h++)if(c=this[h],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(vc," "):"")){f=0;while(e=b[f++])while(d.indexOf(" "+e+" ")>=0)d=d.replace(" "+e+" "," ");g=a?n.trim(d):"",c.className!==g&&(c.className=g)}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):this.each(n.isFunction(a)?function(c){n(this).toggleClass(a.call(this,c,this.className,b),b)}:function(){if("string"===c){var b,d=0,e=n(this),f=a.match(F)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else(c===L||"boolean"===c)&&(this.className&&n._data(this,"__className__",this.className),this.className=this.className||a===!1?"":n._data(this,"__className__")||"")})},hasClass:function(a){for(var b=" "+a+" ",c=0,d=this.length;d>c;c++)if(1===this[c].nodeType&&(" "+this[c].className+" ").replace(vc," ").indexOf(b)>=0)return!0;return!1}}),n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){n.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),n.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)},bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)}});var wc=n.now(),xc=/\?/,yc=/(,)|(\[|{)|(}|])|"(?:[^"\\\r\n]|\\["\\\/bfnrt]|\\u[\da-fA-F]{4})*"\s*:?|true|false|null|-?(?!0\d)\d+(?:\.\d+|)(?:[eE][+-]?\d+|)/g;n.parseJSON=function(b){if(a.JSON&&a.JSON.parse)return a.JSON.parse(b+"");var c,d=null,e=n.trim(b+"");return e&&!n.trim(e.replace(yc,function(a,b,e,f){return c&&b&&(d=0),0===d?a:(c=e||b,d+=!f-!e,"")}))?Function("return "+e)():n.error("Invalid JSON: "+b)},n.parseXML=function(b){var c,d;if(!b||"string"!=typeof b)return null;try{a.DOMParser?(d=new DOMParser,c=d.parseFromString(b,"text/xml")):(c=new ActiveXObject("Microsoft.XMLDOM"),c.async="false",c.loadXML(b))}catch(e){c=void 0}return c&&c.documentElement&&!c.getElementsByTagName("parsererror").length||n.error("Invalid XML: "+b),c};var zc,Ac,Bc=/#.*$/,Cc=/([?&])_=[^&]*/,Dc=/^(.*?):[ \t]*([^\r\n]*)\r?$/gm,Ec=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Fc=/^(?:GET|HEAD)$/,Gc=/^\/\//,Hc=/^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,Ic={},Jc={},Kc="*/".concat("*");try{Ac=location.href}catch(Lc){Ac=z.createElement("a"),Ac.href="",Ac=Ac.href}zc=Hc.exec(Ac.toLowerCase())||[];function Mc(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(F)||[];if(n.isFunction(c))while(d=f[e++])"+"===d.charAt(0)?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function Nc(a,b,c,d){var e={},f=a===Jc;function g(h){var i;return e[h]=!0,n.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function Oc(a,b){var c,d,e=n.ajaxSettings.flatOptions||{};for(d in b)void 0!==b[d]&&((e[d]?a:c||(c={}))[d]=b[d]);return c&&n.extend(!0,a,c),a}function Pc(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===e&&(e=a.mimeType||b.getResponseHeader("Content-Type"));if(e)for(g in h)if(h[g]&&h[g].test(e)){i.unshift(g);break}if(i[0]in c)f=i[0];else{for(g in c){if(!i[0]||a.converters[g+" "+i[0]]){f=g;break}d||(d=g)}f=f||d}return f?(f!==i[0]&&i.unshift(f),c[f]):void 0}function Qc(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}n.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:Ac,type:"GET",isLocal:Ec.test(zc[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Kc,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":n.parseJSON,"text xml":n.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?Oc(Oc(a,n.ajaxSettings),b):Oc(n.ajaxSettings,a)},ajaxPrefilter:Mc(Ic),ajaxTransport:Mc(Jc),ajax:function(a,b){"object"==typeof a&&(b=a,a=void 0),b=b||{};var c,d,e,f,g,h,i,j,k=n.ajaxSetup({},b),l=k.context||k,m=k.context&&(l.nodeType||l.jquery)?n(l):n.event,o=n.Deferred(),p=n.Callbacks("once memory"),q=k.statusCode||{},r={},s={},t=0,u="canceled",v={readyState:0,getResponseHeader:function(a){var b;if(2===t){if(!j){j={};while(b=Dc.exec(f))j[b[1].toLowerCase()]=b[2]}b=j[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return 2===t?f:null},setRequestHeader:function(a,b){var c=a.toLowerCase();return t||(a=s[c]=s[c]||a,r[a]=b),this},overrideMimeType:function(a){return t||(k.mimeType=a),this},statusCode:function(a){var b;if(a)if(2>t)for(b in a)q[b]=[q[b],a[b]];else v.always(a[v.status]);return this},abort:function(a){var b=a||u;return i&&i.abort(b),x(0,b),this}};if(o.promise(v).complete=p.add,v.success=v.done,v.error=v.fail,k.url=((a||k.url||Ac)+"").replace(Bc,"").replace(Gc,zc[1]+"//"),k.type=b.method||b.type||k.method||k.type,k.dataTypes=n.trim(k.dataType||"*").toLowerCase().match(F)||[""],null==k.crossDomain&&(c=Hc.exec(k.url.toLowerCase()),k.crossDomain=!(!c||c[1]===zc[1]&&c[2]===zc[2]&&(c[3]||("http:"===c[1]?"80":"443"))===(zc[3]||("http:"===zc[1]?"80":"443")))),k.data&&k.processData&&"string"!=typeof k.data&&(k.data=n.param(k.data,k.traditional)),Nc(Ic,k,b,v),2===t)return v;h=k.global,h&&0===n.active++&&n.event.trigger("ajaxStart"),k.type=k.type.toUpperCase(),k.hasContent=!Fc.test(k.type),e=k.url,k.hasContent||(k.data&&(e=k.url+=(xc.test(e)?"&":"?")+k.data,delete k.data),k.cache===!1&&(k.url=Cc.test(e)?e.replace(Cc,"$1_="+wc++):e+(xc.test(e)?"&":"?")+"_="+wc++)),k.ifModified&&(n.lastModified[e]&&v.setRequestHeader("If-Modified-Since",n.lastModified[e]),n.etag[e]&&v.setRequestHeader("If-None-Match",n.etag[e])),(k.data&&k.hasContent&&k.contentType!==!1||b.contentType)&&v.setRequestHeader("Content-Type",k.contentType),v.setRequestHeader("Accept",k.dataTypes[0]&&k.accepts[k.dataTypes[0]]?k.accepts[k.dataTypes[0]]+("*"!==k.dataTypes[0]?", "+Kc+"; q=0.01":""):k.accepts["*"]);for(d in k.headers)v.setRequestHeader(d,k.headers[d]);if(k.beforeSend&&(k.beforeSend.call(l,v,k)===!1||2===t))return v.abort();u="abort";for(d in{success:1,error:1,complete:1})v[d](k[d]);if(i=Nc(Jc,k,b,v)){v.readyState=1,h&&m.trigger("ajaxSend",[v,k]),k.async&&k.timeout>0&&(g=setTimeout(function(){v.abort("timeout")},k.timeout));try{t=1,i.send(r,x)}catch(w){if(!(2>t))throw w;x(-1,w)}}else x(-1,"No Transport");function x(a,b,c,d){var j,r,s,u,w,x=b;2!==t&&(t=2,g&&clearTimeout(g),i=void 0,f=d||"",v.readyState=a>0?4:0,j=a>=200&&300>a||304===a,c&&(u=Pc(k,v,c)),u=Qc(k,u,v,j),j?(k.ifModified&&(w=v.getResponseHeader("Last-Modified"),w&&(n.lastModified[e]=w),w=v.getResponseHeader("etag"),w&&(n.etag[e]=w)),204===a||"HEAD"===k.type?x="nocontent":304===a?x="notmodified":(x=u.state,r=u.data,s=u.error,j=!s)):(s=x,(a||!x)&&(x="error",0>a&&(a=0))),v.status=a,v.statusText=(b||x)+"",j?o.resolveWith(l,[r,x,v]):o.rejectWith(l,[v,x,s]),v.statusCode(q),q=void 0,h&&m.trigger(j?"ajaxSuccess":"ajaxError",[v,k,j?r:s]),p.fireWith(l,[v,x]),h&&(m.trigger("ajaxComplete",[v,k]),--n.active||n.event.trigger("ajaxStop")))}return v},getJSON:function(a,b,c){return n.get(a,b,c,"json")},getScript:function(a,b){return n.get(a,void 0,b,"script")}}),n.each(["get","post"],function(a,b){n[b]=function(a,c,d,e){return n.isFunction(c)&&(e=e||d,d=c,c=void 0),n.ajax({url:a,type:b,dataType:e,data:c,success:d})}}),n.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){n.fn[b]=function(a){return this.on(b,a)}}),n._evalUrl=function(a){return n.ajax({url:a,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},n.fn.extend({wrapAll:function(a){if(n.isFunction(a))return this.each(function(b){n(this).wrapAll(a.call(this,b))});if(this[0]){var b=n(a,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstChild&&1===a.firstChild.nodeType)a=a.firstChild;return a}).append(this)}return this},wrapInner:function(a){return this.each(n.isFunction(a)?function(b){n(this).wrapInner(a.call(this,b))}:function(){var b=n(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=n.isFunction(a);return this.each(function(c){n(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(){return this.parent().each(function(){n.nodeName(this,"body")||n(this).replaceWith(this.childNodes)}).end()}}),n.expr.filters.hidden=function(a){return a.offsetWidth<=0&&a.offsetHeight<=0||!l.reliableHiddenOffsets()&&"none"===(a.style&&a.style.display||n.css(a,"display"))},n.expr.filters.visible=function(a){return!n.expr.filters.hidden(a)};var Rc=/%20/g,Sc=/\[\]$/,Tc=/\r?\n/g,Uc=/^(?:submit|button|image|reset|file)$/i,Vc=/^(?:input|select|textarea|keygen)/i;function Wc(a,b,c,d){var e;if(n.isArray(b))n.each(b,function(b,e){c||Sc.test(a)?d(a,e):Wc(a+"["+("object"==typeof e?b:"")+"]",e,c,d)});else if(c||"object"!==n.type(b))d(a,b);else for(e in b)Wc(a+"["+e+"]",b[e],c,d)}n.param=function(a,b){var c,d=[],e=function(a,b){b=n.isFunction(b)?b():null==b?"":b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};if(void 0===b&&(b=n.ajaxSettings&&n.ajaxSettings.traditional),n.isArray(a)||a.jquery&&!n.isPlainObject(a))n.each(a,function(){e(this.name,this.value)});else for(c in a)Wc(c,a[c],b,e);return d.join("&").replace(Rc,"+")},n.fn.extend({serialize:function(){return n.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=n.prop(this,"elements");return a?n.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!n(this).is(":disabled")&&Vc.test(this.nodeName)&&!Uc.test(a)&&(this.checked||!X.test(a))}).map(function(a,b){var c=n(this).val();return null==c?null:n.isArray(c)?n.map(c,function(a){return{name:b.name,value:a.replace(Tc,"\r\n")}}):{name:b.name,value:c.replace(Tc,"\r\n")}}).get()}}),n.ajaxSettings.xhr=void 0!==a.ActiveXObject?function(){return!this.isLocal&&/^(get|post|head|put|delete|options)$/i.test(this.type)&&$c()||_c()}:$c;var Xc=0,Yc={},Zc=n.ajaxSettings.xhr();a.ActiveXObject&&n(a).on("unload",function(){for(var a in Yc)Yc[a](void 0,!0)}),l.cors=!!Zc&&"withCredentials"in Zc,Zc=l.ajax=!!Zc,Zc&&n.ajaxTransport(function(a){if(!a.crossDomain||l.cors){var b;return{send:function(c,d){var e,f=a.xhr(),g=++Xc;if(f.open(a.type,a.url,a.async,a.username,a.password),a.xhrFields)for(e in a.xhrFields)f[e]=a.xhrFields[e];a.mimeType&&f.overrideMimeType&&f.overrideMimeType(a.mimeType),a.crossDomain||c["X-Requested-With"]||(c["X-Requested-With"]="XMLHttpRequest");for(e in c)void 0!==c[e]&&f.setRequestHeader(e,c[e]+"");f.send(a.hasContent&&a.data||null),b=function(c,e){var h,i,j;if(b&&(e||4===f.readyState))if(delete Yc[g],b=void 0,f.onreadystatechange=n.noop,e)4!==f.readyState&&f.abort();else{j={},h=f.status,"string"==typeof f.responseText&&(j.text=f.responseText);try{i=f.statusText}catch(k){i=""}h||!a.isLocal||a.crossDomain?1223===h&&(h=204):h=j.text?200:404}j&&d(h,i,j,f.getAllResponseHeaders())},a.async?4===f.readyState?setTimeout(b):f.onreadystatechange=Yc[g]=b:b()},abort:function(){b&&b(void 0,!0)}}}});function $c(){try{return new a.XMLHttpRequest}catch(b){}}function _c(){try{return new a.ActiveXObject("Microsoft.XMLHTTP")}catch(b){}}n.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(a){return n.globalEval(a),a}}}),n.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET",a.global=!1)}),n.ajaxTransport("script",function(a){if(a.crossDomain){var b,c=z.head||n("head")[0]||z.documentElement;return{send:function(d,e){b=z.createElement("script"),b.async=!0,a.scriptCharset&&(b.charset=a.scriptCharset),b.src=a.url,b.onload=b.onreadystatechange=function(a,c){(c||!b.readyState||/loaded|complete/.test(b.readyState))&&(b.onload=b.onreadystatechange=null,b.parentNode&&b.parentNode.removeChild(b),b=null,c||e(200,"success"))},c.insertBefore(b,c.firstChild)},abort:function(){b&&b.onload(void 0,!0)}}}});var ad=[],bd=/(=)\?(?=&|$)|\?\?/;n.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=ad.pop()||n.expando+"_"+wc++;return this[a]=!0,a}}),n.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(bd.test(b.url)?"url":"string"==typeof b.data&&!(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&bd.test(b.data)&&"data");return h||"jsonp"===b.dataTypes[0]?(e=b.jsonpCallback=n.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(bd,"$1"+e):b.jsonp!==!1&&(b.url+=(xc.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||n.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,ad.push(e)),g&&n.isFunction(f)&&f(g[0]),g=f=void 0}),"script"):void 0}),n.parseHTML=function(a,b,c){if(!a||"string"!=typeof a)return null;"boolean"==typeof b&&(c=b,b=!1),b=b||z;var d=v.exec(a),e=!c&&[];return d?[b.createElement(d[1])]:(d=n.buildFragment([a],b,e),e&&e.length&&n(e).remove(),n.merge([],d.childNodes))};var cd=n.fn.load;n.fn.load=function(a,b,c){if("string"!=typeof a&&cd)return cd.apply(this,arguments);var d,e,f,g=this,h=a.indexOf(" ");return h>=0&&(d=a.slice(h,a.length),a=a.slice(0,h)),n.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(f="POST"),g.length>0&&n.ajax({url:a,type:f,dataType:"html",data:b}).done(function(a){e=arguments,g.html(d?n("<div>").append(n.parseHTML(a)).find(d):a)}).complete(c&&function(a,b){g.each(c,e||[a.responseText,b,a])}),this},n.expr.filters.animated=function(a){return n.grep(n.timers,function(b){return a===b.elem}).length};var dd=a.document.documentElement;function ed(a){return n.isWindow(a)?a:9===a.nodeType?a.defaultView||a.parentWindow:!1}n.offset={setOffset:function(a,b,c){var d,e,f,g,h,i,j,k=n.css(a,"position"),l=n(a),m={};"static"===k&&(a.style.position="relative"),h=l.offset(),f=n.css(a,"top"),i=n.css(a,"left"),j=("absolute"===k||"fixed"===k)&&n.inArray("auto",[f,i])>-1,j?(d=l.position(),g=d.top,e=d.left):(g=parseFloat(f)||0,e=parseFloat(i)||0),n.isFunction(b)&&(b=b.call(a,c,h)),null!=b.top&&(m.top=b.top-h.top+g),null!=b.left&&(m.left=b.left-h.left+e),"using"in b?b.using.call(a,m):l.css(m)}},n.fn.extend({offset:function(a){if(arguments.length)return void 0===a?this:this.each(function(b){n.offset.setOffset(this,a,b)});var b,c,d={top:0,left:0},e=this[0],f=e&&e.ownerDocument;if(f)return b=f.documentElement,n.contains(b,e)?(typeof e.getBoundingClientRect!==L&&(d=e.getBoundingClientRect()),c=ed(f),{top:d.top+(c.pageYOffset||b.scrollTop)-(b.clientTop||0),left:d.left+(c.pageXOffset||b.scrollLeft)-(b.clientLeft||0)}):d},position:function(){if(this[0]){var a,b,c={top:0,left:0},d=this[0];return"fixed"===n.css(d,"position")?b=d.getBoundingClientRect():(a=this.offsetParent(),b=this.offset(),n.nodeName(a[0],"html")||(c=a.offset()),c.top+=n.css(a[0],"borderTopWidth",!0),c.left+=n.css(a[0],"borderLeftWidth",!0)),{top:b.top-c.top-n.css(d,"marginTop",!0),left:b.left-c.left-n.css(d,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var a=this.offsetParent||dd;while(a&&!n.nodeName(a,"html")&&"static"===n.css(a,"position"))a=a.offsetParent;return a||dd})}}),n.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(a,b){var c=/Y/.test(b);n.fn[a]=function(d){return W(this,function(a,d,e){var f=ed(a);return void 0===e?f?b in f?f[b]:f.document.documentElement[d]:a[d]:void(f?f.scrollTo(c?n(f).scrollLeft():e,c?e:n(f).scrollTop()):a[d]=e)},a,d,arguments.length,null)}}),n.each(["top","left"],function(a,b){n.cssHooks[b]=Mb(l.pixelPosition,function(a,c){return c?(c=Kb(a,b),Ib.test(c)?n(a).position()[b]+"px":c):void 0})}),n.each({Height:"height",Width:"width"},function(a,b){n.each({padding:"inner"+a,content:b,"":"outer"+a},function(c,d){n.fn[d]=function(d,e){var f=arguments.length&&(c||"boolean"!=typeof d),g=c||(d===!0||e===!0?"margin":"border");return W(this,function(b,c,d){var e;return n.isWindow(b)?b.document.documentElement["client"+a]:9===b.nodeType?(e=b.documentElement,Math.max(b.body["scroll"+a],e["scroll"+a],b.body["offset"+a],e["offset"+a],e["client"+a])):void 0===d?n.css(b,c,g):n.style(b,c,d,g)},b,f?d:void 0,f,null)}})}),n.fn.size=function(){return this.length},n.fn.andSelf=n.fn.addBack,"function"==typeof define&&define.amd&&define("jquery",[],function(){return n});var fd=a.jQuery,gd=a.$;return n.noConflict=function(b){return a.$===n&&(a.$=gd),b&&a.jQuery===n&&(a.jQuery=fd),n},typeof b===L&&(a.jQuery=a.$=n),n});

jQuery.noConflict();
/**
 * Cookie plugin
 *
 * Copyright (c) 2006 Klaus Hartl (stilbuero.de)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 */
jQuery.cookie=function(name,value,options){if(typeof value!='undefined'){options=options||{};if(value===null){value='';options.expires=-1;}
var expires='';if(options.expires&&(typeof options.expires=='number'||options.expires.toUTCString)){var date;if(typeof options.expires=='number'){date=new Date();date.setTime(date.getTime()+(options.expires*24*60*60*1000));}else{date=options.expires;}
expires='; expires='+date.toUTCString();}
var path=options.path?'; path='+(options.path):'';var domain=options.domain?'; domain='+(options.domain):'';var secure=options.secure?'; secure':'';document.cookie=[name,'=',encodeURIComponent(value),expires,path,domain,secure].join('');}else{var cookieValue=null;if(document.cookie&&document.cookie!=''){var cookies=document.cookie.split(';');for(var i=0;i<cookies.length;i++){var cookie=jQuery.trim(cookies[i]);if(cookie.substring(0,name.length+1)==(name+'=')){cookieValue=decodeURIComponent(cookie.substring(name.length+1));break;}}}
return cookieValue;}};
/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 * 
 * Open source under the BSD License. 
 * 
 * Copyright © 2008 George McGinley Smith
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of 
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list 
 * of conditions and the following disclaimer in the documentation and/or other materials 
 * provided with the distribution.
 * 
 * Neither the name of the author nor the names of contributors may be used to endorse 
 * or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
 * OF THE POSSIBILITY OF SUCH DAMAGE. 
 *
*/

// t: current time, b: begInnIng value, c: change In value, d: duration
jQuery.easing['jswing'] = jQuery.easing['swing'];

jQuery.extend( jQuery.easing,
{
	def: 'easeOutQuad',
	swing: function (x, t, b, c, d) {
		//alert(jQuery.easing.default);
		return jQuery.easing[jQuery.easing.def](x, t, b, c, d);
	},
	easeInQuad: function (x, t, b, c, d) {
		return c*(t/=d)*t + b;
	},
	easeOutQuad: function (x, t, b, c, d) {
		return -c *(t/=d)*(t-2) + b;
	},
	easeInOutQuad: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t + b;
		return -c/2 * ((--t)*(t-2) - 1) + b;
	},
	easeInCubic: function (x, t, b, c, d) {
		return c*(t/=d)*t*t + b;
	},
	easeOutCubic: function (x, t, b, c, d) {
		return c*((t=t/d-1)*t*t + 1) + b;
	},
	easeInOutCubic: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t + b;
		return c/2*((t-=2)*t*t + 2) + b;
	},
	easeInQuart: function (x, t, b, c, d) {
		return c*(t/=d)*t*t*t + b;
	},
	easeOutQuart: function (x, t, b, c, d) {
		return -c * ((t=t/d-1)*t*t*t - 1) + b;
	},
	easeInOutQuart: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
		return -c/2 * ((t-=2)*t*t*t - 2) + b;
	},
	easeInQuint: function (x, t, b, c, d) {
		return c*(t/=d)*t*t*t*t + b;
	},
	easeOutQuint: function (x, t, b, c, d) {
		return c*((t=t/d-1)*t*t*t*t + 1) + b;
	},
	easeInOutQuint: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
		return c/2*((t-=2)*t*t*t*t + 2) + b;
	},
	easeInSine: function (x, t, b, c, d) {
		return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
	},
	easeOutSine: function (x, t, b, c, d) {
		return c * Math.sin(t/d * (Math.PI/2)) + b;
	},
	easeInOutSine: function (x, t, b, c, d) {
		return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
	},
	easeInExpo: function (x, t, b, c, d) {
		return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
	},
	easeOutExpo: function (x, t, b, c, d) {
		return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
	},
	easeInOutExpo: function (x, t, b, c, d) {
		if (t==0) return b;
		if (t==d) return b+c;
		if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
		return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
	},
	easeInCirc: function (x, t, b, c, d) {
		return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
	},
	easeOutCirc: function (x, t, b, c, d) {
		return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
	},
	easeInOutCirc: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
		return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
	},
	easeInElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
	},
	easeOutElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
	},
	easeInOutElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
		return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
	},
	easeInBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		return c*(t/=d)*t*((s+1)*t - s) + b;
	},
	easeOutBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
	},
	easeInOutBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158; 
		if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
		return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
	},
	easeInBounce: function (x, t, b, c, d) {
		return c - jQuery.easing.easeOutBounce (x, d-t, 0, c, d) + b;
	},
	easeOutBounce: function (x, t, b, c, d) {
		if ((t/=d) < (1/2.75)) {
			return c*(7.5625*t*t) + b;
		} else if (t < (2/2.75)) {
			return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
		} else if (t < (2.5/2.75)) {
			return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
		} else {
			return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
		}
	},
	easeInOutBounce: function (x, t, b, c, d) {
		if (t < d/2) return jQuery.easing.easeInBounce (x, t*2, 0, c, d) * .5 + b;
		return jQuery.easing.easeOutBounce (x, t*2-d, 0, c, d) * .5 + c*.5 + b;
	}
});

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 * 
 * Open source under the BSD License. 
 * 
 * Copyright © 2001 Robert Penner
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of 
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list 
 * of conditions and the following disclaimer in the documentation and/or other materials 
 * provided with the distribution.
 * 
 * Neither the name of the author nor the names of contributors may be used to endorse 
 * or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
 * OF THE POSSIBILITY OF SUCH DAMAGE. 
 *
 */
/*!
 * Bootstrap v3.1.1 (http://getbootstrap.com)
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */
if("undefined"==typeof jQuery)throw new Error("Bootstrap's JavaScript requires jQuery");+function(a){"use strict";function b(){var a=document.createElement("bootstrap"),b={WebkitTransition:"webkitTransitionEnd",MozTransition:"transitionend",OTransition:"oTransitionEnd otransitionend",transition:"transitionend"};for(var c in b)if(void 0!==a.style[c])return{end:b[c]};return!1}a.fn.emulateTransitionEnd=function(b){var c=!1,d=this;a(this).one(a.support.transition.end,function(){c=!0});var e=function(){c||a(d).trigger(a.support.transition.end)};return setTimeout(e,b),this},a(function(){a.support.transition=b()})}(jQuery),+function(a){"use strict";var b='[data-dismiss="alert"]',c=function(c){a(c).on("click",b,this.close)};c.prototype.close=function(b){function c(){f.trigger("closed.bs.alert").remove()}var d=a(this),e=d.attr("data-target");e||(e=d.attr("href"),e=e&&e.replace(/.*(?=#[^\s]*$)/,""));var f=a(e);b&&b.preventDefault(),f.length||(f=d.hasClass("alert")?d:d.parent()),f.trigger(b=a.Event("close.bs.alert")),b.isDefaultPrevented()||(f.removeClass("in"),a.support.transition&&f.hasClass("fade")?f.one(a.support.transition.end,c).emulateTransitionEnd(150):c())};var d=a.fn.alert;a.fn.alert=function(b){return this.each(function(){var d=a(this),e=d.data("bs.alert");e||d.data("bs.alert",e=new c(this)),"string"==typeof b&&e[b].call(d)})},a.fn.alert.Constructor=c,a.fn.alert.noConflict=function(){return a.fn.alert=d,this},a(document).on("click.bs.alert.data-api",b,c.prototype.close)}(jQuery),+function(a){"use strict";var b=function(c,d){this.$element=a(c),this.options=a.extend({},b.DEFAULTS,d),this.isLoading=!1};b.DEFAULTS={loadingText:"loading..."},b.prototype.setState=function(b){var c="disabled",d=this.$element,e=d.is("input")?"val":"html",f=d.data();b+="Text",f.resetText||d.data("resetText",d[e]()),d[e](f[b]||this.options[b]),setTimeout(a.proxy(function(){"loadingText"==b?(this.isLoading=!0,d.addClass(c).attr(c,c)):this.isLoading&&(this.isLoading=!1,d.removeClass(c).removeAttr(c))},this),0)},b.prototype.toggle=function(){var a=!0,b=this.$element.closest('[data-toggle="buttons"]');if(b.length){var c=this.$element.find("input");"radio"==c.prop("type")&&(c.prop("checked")&&this.$element.hasClass("active")?a=!1:b.find(".active").removeClass("active")),a&&c.prop("checked",!this.$element.hasClass("active")).trigger("change")}a&&this.$element.toggleClass("active")};var c=a.fn.button;a.fn.button=function(c){return this.each(function(){var d=a(this),e=d.data("bs.button"),f="object"==typeof c&&c;e||d.data("bs.button",e=new b(this,f)),"toggle"==c?e.toggle():c&&e.setState(c)})},a.fn.button.Constructor=b,a.fn.button.noConflict=function(){return a.fn.button=c,this},a(document).on("click.bs.button.data-api","[data-toggle^=button]",function(b){var c=a(b.target);c.hasClass("btn")||(c=c.closest(".btn")),c.button("toggle"),b.preventDefault()})}(jQuery),+function(a){"use strict";var b=function(b,c){this.$element=a(b),this.$indicators=this.$element.find(".carousel-indicators"),this.options=c,this.paused=this.sliding=this.interval=this.$active=this.$items=null,"hover"==this.options.pause&&this.$element.on("mouseenter",a.proxy(this.pause,this)).on("mouseleave",a.proxy(this.cycle,this))};b.DEFAULTS={interval:5e3,pause:"hover",wrap:!0},b.prototype.cycle=function(b){return b||(this.paused=!1),this.interval&&clearInterval(this.interval),this.options.interval&&!this.paused&&(this.interval=setInterval(a.proxy(this.next,this),this.options.interval)),this},b.prototype.getActiveIndex=function(){return this.$active=this.$element.find(".item.active"),this.$items=this.$active.parent().children(),this.$items.index(this.$active)},b.prototype.to=function(b){var c=this,d=this.getActiveIndex();return b>this.$items.length-1||0>b?void 0:this.sliding?this.$element.one("slid.bs.carousel",function(){c.to(b)}):d==b?this.pause().cycle():this.slide(b>d?"next":"prev",a(this.$items[b]))},b.prototype.pause=function(b){return b||(this.paused=!0),this.$element.find(".next, .prev").length&&a.support.transition&&(this.$element.trigger(a.support.transition.end),this.cycle(!0)),this.interval=clearInterval(this.interval),this},b.prototype.next=function(){return this.sliding?void 0:this.slide("next")},b.prototype.prev=function(){return this.sliding?void 0:this.slide("prev")},b.prototype.slide=function(b,c){var d=this.$element.find(".item.active"),e=c||d[b](),f=this.interval,g="next"==b?"left":"right",h="next"==b?"first":"last",i=this;if(!e.length){if(!this.options.wrap)return;e=this.$element.find(".item")[h]()}if(e.hasClass("active"))return this.sliding=!1;var j=a.Event("slide.bs.carousel",{relatedTarget:e[0],direction:g});return this.$element.trigger(j),j.isDefaultPrevented()?void 0:(this.sliding=!0,f&&this.pause(),this.$indicators.length&&(this.$indicators.find(".active").removeClass("active"),this.$element.one("slid.bs.carousel",function(){var b=a(i.$indicators.children()[i.getActiveIndex()]);b&&b.addClass("active")})),a.support.transition&&this.$element.hasClass("slide")?(e.addClass(b),e[0].offsetWidth,d.addClass(g),e.addClass(g),d.one(a.support.transition.end,function(){e.removeClass([b,g].join(" ")).addClass("active"),d.removeClass(["active",g].join(" ")),i.sliding=!1,setTimeout(function(){i.$element.trigger("slid.bs.carousel")},0)}).emulateTransitionEnd(1e3*d.css("transition-duration").slice(0,-1))):(d.removeClass("active"),e.addClass("active"),this.sliding=!1,this.$element.trigger("slid.bs.carousel")),f&&this.cycle(),this)};var c=a.fn.carousel;a.fn.carousel=function(c){return this.each(function(){var d=a(this),e=d.data("bs.carousel"),f=a.extend({},b.DEFAULTS,d.data(),"object"==typeof c&&c),g="string"==typeof c?c:f.slide;e||d.data("bs.carousel",e=new b(this,f)),"number"==typeof c?e.to(c):g?e[g]():f.interval&&e.pause().cycle()})},a.fn.carousel.Constructor=b,a.fn.carousel.noConflict=function(){return a.fn.carousel=c,this},a(document).on("click.bs.carousel.data-api","[data-slide], [data-slide-to]",function(b){var c,d=a(this),e=a(d.attr("data-target")||(c=d.attr("href"))&&c.replace(/.*(?=#[^\s]+$)/,"")),f=a.extend({},e.data(),d.data()),g=d.attr("data-slide-to");g&&(f.interval=!1),e.carousel(f),(g=d.attr("data-slide-to"))&&e.data("bs.carousel").to(g),b.preventDefault()}),a(window).on("load",function(){a('[data-ride="carousel"]').each(function(){var b=a(this);b.carousel(b.data())})})}(jQuery),+function(a){"use strict";var b=function(c,d){this.$element=a(c),this.options=a.extend({},b.DEFAULTS,d),this.transitioning=null,this.options.parent&&(this.$parent=a(this.options.parent)),this.options.toggle&&this.toggle()};b.DEFAULTS={toggle:!0},b.prototype.dimension=function(){var a=this.$element.hasClass("width");return a?"width":"height"},b.prototype.show=function(){if(!this.transitioning&&!this.$element.hasClass("in")){var b=a.Event("show.bs.collapse");if(this.$element.trigger(b),!b.isDefaultPrevented()){var c=this.$parent&&this.$parent.find("> .panel > .in");if(c&&c.length){var d=c.data("bs.collapse");if(d&&d.transitioning)return;c.collapse("hide"),d||c.data("bs.collapse",null)}var e=this.dimension();this.$element.removeClass("collapse").addClass("collapsing")[e](0),this.transitioning=1;var f=function(){this.$element.removeClass("collapsing").addClass("collapse in")[e]("auto"),this.transitioning=0,this.$element.trigger("shown.bs.collapse")};if(!a.support.transition)return f.call(this);var g=a.camelCase(["scroll",e].join("-"));this.$element.one(a.support.transition.end,a.proxy(f,this)).emulateTransitionEnd(350)[e](this.$element[0][g])}}},b.prototype.hide=function(){if(!this.transitioning&&this.$element.hasClass("in")){var b=a.Event("hide.bs.collapse");if(this.$element.trigger(b),!b.isDefaultPrevented()){var c=this.dimension();this.$element[c](this.$element[c]())[0].offsetHeight,this.$element.addClass("collapsing").removeClass("collapse").removeClass("in"),this.transitioning=1;var d=function(){this.transitioning=0,this.$element.trigger("hidden.bs.collapse").removeClass("collapsing").addClass("collapse")};return a.support.transition?void this.$element[c](0).one(a.support.transition.end,a.proxy(d,this)).emulateTransitionEnd(350):d.call(this)}}},b.prototype.toggle=function(){this[this.$element.hasClass("in")?"hide":"show"]()};var c=a.fn.collapse;a.fn.collapse=function(c){return this.each(function(){var d=a(this),e=d.data("bs.collapse"),f=a.extend({},b.DEFAULTS,d.data(),"object"==typeof c&&c);!e&&f.toggle&&"show"==c&&(c=!c),e||d.data("bs.collapse",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.collapse.Constructor=b,a.fn.collapse.noConflict=function(){return a.fn.collapse=c,this},a(document).on("click.bs.collapse.data-api","[data-toggle=collapse]",function(b){var c,d=a(this),e=d.attr("data-target")||b.preventDefault()||(c=d.attr("href"))&&c.replace(/.*(?=#[^\s]+$)/,""),f=a(e),g=f.data("bs.collapse"),h=g?"toggle":d.data(),i=d.attr("data-parent"),j=i&&a(i);g&&g.transitioning||(j&&j.find('[data-toggle=collapse][data-parent="'+i+'"]').not(d).addClass("collapsed"),d[f.hasClass("in")?"addClass":"removeClass"]("collapsed")),f.collapse(h)})}(jQuery),+function(a){"use strict";function b(b){a(d).remove(),a(e).each(function(){var d=c(a(this)),e={relatedTarget:this};d.hasClass("open")&&(d.trigger(b=a.Event("hide.bs.dropdown",e)),b.isDefaultPrevented()||d.removeClass("open").trigger("hidden.bs.dropdown",e))})}function c(b){var c=b.attr("data-target");c||(c=b.attr("href"),c=c&&/#[A-Za-z]/.test(c)&&c.replace(/.*(?=#[^\s]*$)/,""));var d=c&&a(c);return d&&d.length?d:b.parent()}var d=".dropdown-backdrop",e="[data-toggle=dropdown]",f=function(b){a(b).on("click.bs.dropdown",this.toggle)};f.prototype.toggle=function(d){var e=a(this);if(!e.is(".disabled, :disabled")){var f=c(e),g=f.hasClass("open");if(b(),!g){"ontouchstart"in document.documentElement&&!f.closest(".navbar-nav").length&&a('<div class="dropdown-backdrop"/>').insertAfter(a(this)).on("click",b);var h={relatedTarget:this};if(f.trigger(d=a.Event("show.bs.dropdown",h)),d.isDefaultPrevented())return;f.toggleClass("open").trigger("shown.bs.dropdown",h),e.focus()}return!1}},f.prototype.keydown=function(b){if(/(38|40|27)/.test(b.keyCode)){var d=a(this);if(b.preventDefault(),b.stopPropagation(),!d.is(".disabled, :disabled")){var f=c(d),g=f.hasClass("open");if(!g||g&&27==b.keyCode)return 27==b.which&&f.find(e).focus(),d.click();var h=" li:not(.divider):visible a",i=f.find("[role=menu]"+h+", [role=listbox]"+h);if(i.length){var j=i.index(i.filter(":focus"));38==b.keyCode&&j>0&&j--,40==b.keyCode&&j<i.length-1&&j++,~j||(j=0),i.eq(j).focus()}}}};var g=a.fn.dropdown;a.fn.dropdown=function(b){return this.each(function(){var c=a(this),d=c.data("bs.dropdown");d||c.data("bs.dropdown",d=new f(this)),"string"==typeof b&&d[b].call(c)})},a.fn.dropdown.Constructor=f,a.fn.dropdown.noConflict=function(){return a.fn.dropdown=g,this},a(document).on("click.bs.dropdown.data-api",b).on("click.bs.dropdown.data-api",".dropdown form",function(a){a.stopPropagation()}).on("click.bs.dropdown.data-api",e,f.prototype.toggle).on("keydown.bs.dropdown.data-api",e+", [role=menu], [role=listbox]",f.prototype.keydown)}(jQuery),+function(a){"use strict";var b=function(b,c){this.options=c,this.$element=a(b),this.$backdrop=this.isShown=null,this.options.remote&&this.$element.find(".modal-content").load(this.options.remote,a.proxy(function(){this.$element.trigger("loaded.bs.modal")},this))};b.DEFAULTS={backdrop:!0,keyboard:!0,show:!0},b.prototype.toggle=function(a){return this[this.isShown?"hide":"show"](a)},b.prototype.show=function(b){var c=this,d=a.Event("show.bs.modal",{relatedTarget:b});this.$element.trigger(d),this.isShown||d.isDefaultPrevented()||(this.isShown=!0,this.escape(),this.$element.on("click.dismiss.bs.modal",'[data-dismiss="modal"]',a.proxy(this.hide,this)),this.backdrop(function(){var d=a.support.transition&&c.$element.hasClass("fade");c.$element.parent().length||c.$element.appendTo(document.body),c.$element.show().scrollTop(0),d&&c.$element[0].offsetWidth,c.$element.addClass("in").attr("aria-hidden",!1),c.enforceFocus();var e=a.Event("shown.bs.modal",{relatedTarget:b});d?c.$element.find(".modal-dialog").one(a.support.transition.end,function(){c.$element.focus().trigger(e)}).emulateTransitionEnd(300):c.$element.focus().trigger(e)}))},b.prototype.hide=function(b){b&&b.preventDefault(),b=a.Event("hide.bs.modal"),this.$element.trigger(b),this.isShown&&!b.isDefaultPrevented()&&(this.isShown=!1,this.escape(),a(document).off("focusin.bs.modal"),this.$element.removeClass("in").attr("aria-hidden",!0).off("click.dismiss.bs.modal"),a.support.transition&&this.$element.hasClass("fade")?this.$element.one(a.support.transition.end,a.proxy(this.hideModal,this)).emulateTransitionEnd(300):this.hideModal())},b.prototype.enforceFocus=function(){a(document).off("focusin.bs.modal").on("focusin.bs.modal",a.proxy(function(a){this.$element[0]===a.target||this.$element.has(a.target).length||this.$element.focus()},this))},b.prototype.escape=function(){this.isShown&&this.options.keyboard?this.$element.on("keyup.dismiss.bs.modal",a.proxy(function(a){27==a.which&&this.hide()},this)):this.isShown||this.$element.off("keyup.dismiss.bs.modal")},b.prototype.hideModal=function(){var a=this;this.$element.hide(),this.backdrop(function(){a.removeBackdrop(),a.$element.trigger("hidden.bs.modal")})},b.prototype.removeBackdrop=function(){this.$backdrop&&this.$backdrop.remove(),this.$backdrop=null},b.prototype.backdrop=function(b){var c=this.$element.hasClass("fade")?"fade":"";if(this.isShown&&this.options.backdrop){var d=a.support.transition&&c;if(this.$backdrop=a('<div class="modal-backdrop '+c+'" />').appendTo(document.body),this.$element.on("click.dismiss.bs.modal",a.proxy(function(a){a.target===a.currentTarget&&("static"==this.options.backdrop?this.$element[0].focus.call(this.$element[0]):this.hide.call(this))},this)),d&&this.$backdrop[0].offsetWidth,this.$backdrop.addClass("in"),!b)return;d?this.$backdrop.one(a.support.transition.end,b).emulateTransitionEnd(150):b()}else!this.isShown&&this.$backdrop?(this.$backdrop.removeClass("in"),a.support.transition&&this.$element.hasClass("fade")?this.$backdrop.one(a.support.transition.end,b).emulateTransitionEnd(150):b()):b&&b()};var c=a.fn.modal;a.fn.modal=function(c,d){return this.each(function(){var e=a(this),f=e.data("bs.modal"),g=a.extend({},b.DEFAULTS,e.data(),"object"==typeof c&&c);f||e.data("bs.modal",f=new b(this,g)),"string"==typeof c?f[c](d):g.show&&f.show(d)})},a.fn.modal.Constructor=b,a.fn.modal.noConflict=function(){return a.fn.modal=c,this},a(document).on("click.bs.modal.data-api",'[data-toggle="modal"]',function(b){var c=a(this),d=c.attr("href"),e=a(c.attr("data-target")||d&&d.replace(/.*(?=#[^\s]+$)/,"")),f=e.data("bs.modal")?"toggle":a.extend({remote:!/#/.test(d)&&d},e.data(),c.data());c.is("a")&&b.preventDefault(),e.modal(f,this).one("hide",function(){c.is(":visible")&&c.focus()})}),a(document).on("show.bs.modal",".modal",function(){a(document.body).addClass("modal-open")}).on("hidden.bs.modal",".modal",function(){a(document.body).removeClass("modal-open")})}(jQuery),+function(a){"use strict";var b=function(a,b){this.type=this.options=this.enabled=this.timeout=this.hoverState=this.$element=null,this.init("tooltip",a,b)};b.DEFAULTS={animation:!0,placement:"top",selector:!1,template:'<div class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',trigger:"hover focus",title:"",delay:0,html:!1,container:!1},b.prototype.init=function(b,c,d){this.enabled=!0,this.type=b,this.$element=a(c),this.options=this.getOptions(d);for(var e=this.options.trigger.split(" "),f=e.length;f--;){var g=e[f];if("click"==g)this.$element.on("click."+this.type,this.options.selector,a.proxy(this.toggle,this));else if("manual"!=g){var h="hover"==g?"mouseenter":"focusin",i="hover"==g?"mouseleave":"focusout";this.$element.on(h+"."+this.type,this.options.selector,a.proxy(this.enter,this)),this.$element.on(i+"."+this.type,this.options.selector,a.proxy(this.leave,this))}}this.options.selector?this._options=a.extend({},this.options,{trigger:"manual",selector:""}):this.fixTitle()},b.prototype.getDefaults=function(){return b.DEFAULTS},b.prototype.getOptions=function(b){return b=a.extend({},this.getDefaults(),this.$element.data(),b),b.delay&&"number"==typeof b.delay&&(b.delay={show:b.delay,hide:b.delay}),b},b.prototype.getDelegateOptions=function(){var b={},c=this.getDefaults();return this._options&&a.each(this._options,function(a,d){c[a]!=d&&(b[a]=d)}),b},b.prototype.enter=function(b){var c=b instanceof this.constructor?b:a(b.currentTarget)[this.type](this.getDelegateOptions()).data("bs."+this.type);return clearTimeout(c.timeout),c.hoverState="in",c.options.delay&&c.options.delay.show?void(c.timeout=setTimeout(function(){"in"==c.hoverState&&c.show()},c.options.delay.show)):c.show()},b.prototype.leave=function(b){var c=b instanceof this.constructor?b:a(b.currentTarget)[this.type](this.getDelegateOptions()).data("bs."+this.type);return clearTimeout(c.timeout),c.hoverState="out",c.options.delay&&c.options.delay.hide?void(c.timeout=setTimeout(function(){"out"==c.hoverState&&c.hide()},c.options.delay.hide)):c.hide()},b.prototype.show=function(){var b=a.Event("show.bs."+this.type);if(this.hasContent()&&this.enabled){if(this.$element.trigger(b),b.isDefaultPrevented())return;var c=this,d=this.tip();this.setContent(),this.options.animation&&d.addClass("fade");var e="function"==typeof this.options.placement?this.options.placement.call(this,d[0],this.$element[0]):this.options.placement,f=/\s?auto?\s?/i,g=f.test(e);g&&(e=e.replace(f,"")||"top"),d.detach().css({top:0,left:0,display:"block"}).addClass(e),this.options.container?d.appendTo(this.options.container):d.insertAfter(this.$element);var h=this.getPosition(),i=d[0].offsetWidth,j=d[0].offsetHeight;if(g){var k=this.$element.parent(),l=e,m=document.documentElement.scrollTop||document.body.scrollTop,n="body"==this.options.container?window.innerWidth:k.outerWidth(),o="body"==this.options.container?window.innerHeight:k.outerHeight(),p="body"==this.options.container?0:k.offset().left;e="bottom"==e&&h.top+h.height+j-m>o?"top":"top"==e&&h.top-m-j<0?"bottom":"right"==e&&h.right+i>n?"left":"left"==e&&h.left-i<p?"right":e,d.removeClass(l).addClass(e)}var q=this.getCalculatedOffset(e,h,i,j);this.applyPlacement(q,e),this.hoverState=null;var r=function(){c.$element.trigger("shown.bs."+c.type)};a.support.transition&&this.$tip.hasClass("fade")?d.one(a.support.transition.end,r).emulateTransitionEnd(150):r()}},b.prototype.applyPlacement=function(b,c){var d,e=this.tip(),f=e[0].offsetWidth,g=e[0].offsetHeight,h=parseInt(e.css("margin-top"),10),i=parseInt(e.css("margin-left"),10);isNaN(h)&&(h=0),isNaN(i)&&(i=0),b.top=b.top+h,b.left=b.left+i,a.offset.setOffset(e[0],a.extend({using:function(a){e.css({top:Math.round(a.top),left:Math.round(a.left)})}},b),0),e.addClass("in");var j=e[0].offsetWidth,k=e[0].offsetHeight;if("top"==c&&k!=g&&(d=!0,b.top=b.top+g-k),/bottom|top/.test(c)){var l=0;b.left<0&&(l=-2*b.left,b.left=0,e.offset(b),j=e[0].offsetWidth,k=e[0].offsetHeight),this.replaceArrow(l-f+j,j,"left")}else this.replaceArrow(k-g,k,"top");d&&e.offset(b)},b.prototype.replaceArrow=function(a,b,c){this.arrow().css(c,a?50*(1-a/b)+"%":"")},b.prototype.setContent=function(){var a=this.tip(),b=this.getTitle();a.find(".tooltip-inner")[this.options.html?"html":"text"](b),a.removeClass("fade in top bottom left right")},b.prototype.hide=function(){function b(){"in"!=c.hoverState&&d.detach(),c.$element.trigger("hidden.bs."+c.type)}var c=this,d=this.tip(),e=a.Event("hide.bs."+this.type);return this.$element.trigger(e),e.isDefaultPrevented()?void 0:(d.removeClass("in"),a.support.transition&&this.$tip.hasClass("fade")?d.one(a.support.transition.end,b).emulateTransitionEnd(150):b(),this.hoverState=null,this)},b.prototype.fixTitle=function(){var a=this.$element;(a.attr("title")||"string"!=typeof a.attr("data-original-title"))&&a.attr("data-original-title",a.attr("title")||"").attr("title","")},b.prototype.hasContent=function(){return this.getTitle()},b.prototype.getPosition=function(){var b=this.$element[0];return a.extend({},"function"==typeof b.getBoundingClientRect?b.getBoundingClientRect():{width:b.offsetWidth,height:b.offsetHeight},this.$element.offset())},b.prototype.getCalculatedOffset=function(a,b,c,d){return"bottom"==a?{top:b.top+b.height,left:b.left+b.width/2-c/2}:"top"==a?{top:b.top-d,left:b.left+b.width/2-c/2}:"left"==a?{top:b.top+b.height/2-d/2,left:b.left-c}:{top:b.top+b.height/2-d/2,left:b.left+b.width}},b.prototype.getTitle=function(){var a,b=this.$element,c=this.options;return a=b.attr("data-original-title")||("function"==typeof c.title?c.title.call(b[0]):c.title)},b.prototype.tip=function(){return this.$tip=this.$tip||a(this.options.template)},b.prototype.arrow=function(){return this.$arrow=this.$arrow||this.tip().find(".tooltip-arrow")},b.prototype.validate=function(){this.$element[0].parentNode||(this.hide(),this.$element=null,this.options=null)},b.prototype.enable=function(){this.enabled=!0},b.prototype.disable=function(){this.enabled=!1},b.prototype.toggleEnabled=function(){this.enabled=!this.enabled},b.prototype.toggle=function(b){var c=b?a(b.currentTarget)[this.type](this.getDelegateOptions()).data("bs."+this.type):this;c.tip().hasClass("in")?c.leave(c):c.enter(c)},b.prototype.destroy=function(){clearTimeout(this.timeout),this.hide().$element.off("."+this.type).removeData("bs."+this.type)};var c=a.fn.tooltip;a.fn.tooltip=function(c){return this.each(function(){var d=a(this),e=d.data("bs.tooltip"),f="object"==typeof c&&c;(e||"destroy"!=c)&&(e||d.data("bs.tooltip",e=new b(this,f)),"string"==typeof c&&e[c]())})},a.fn.tooltip.Constructor=b,a.fn.tooltip.noConflict=function(){return a.fn.tooltip=c,this}}(jQuery),+function(a){"use strict";var b=function(a,b){this.init("popover",a,b)};if(!a.fn.tooltip)throw new Error("Popover requires tooltip.js");b.DEFAULTS=a.extend({},a.fn.tooltip.Constructor.DEFAULTS,{placement:"right",trigger:"click",content:"",template:'<div class="popover"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'}),b.prototype=a.extend({},a.fn.tooltip.Constructor.prototype),b.prototype.constructor=b,b.prototype.getDefaults=function(){return b.DEFAULTS},b.prototype.setContent=function(){var a=this.tip(),b=this.getTitle(),c=this.getContent();a.find(".popover-title")[this.options.html?"html":"text"](b),a.find(".popover-content")[this.options.html?"string"==typeof c?"html":"append":"text"](c),a.removeClass("fade top bottom left right in"),a.find(".popover-title").html()||a.find(".popover-title").hide()},b.prototype.hasContent=function(){return this.getTitle()||this.getContent()},b.prototype.getContent=function(){var a=this.$element,b=this.options;return a.attr("data-content")||("function"==typeof b.content?b.content.call(a[0]):b.content)},b.prototype.arrow=function(){return this.$arrow=this.$arrow||this.tip().find(".arrow")},b.prototype.tip=function(){return this.$tip||(this.$tip=a(this.options.template)),this.$tip};var c=a.fn.popover;a.fn.popover=function(c){return this.each(function(){var d=a(this),e=d.data("bs.popover"),f="object"==typeof c&&c;(e||"destroy"!=c)&&(e||d.data("bs.popover",e=new b(this,f)),"string"==typeof c&&e[c]())})},a.fn.popover.Constructor=b,a.fn.popover.noConflict=function(){return a.fn.popover=c,this}}(jQuery),+function(a){"use strict";function b(c,d){var e,f=a.proxy(this.process,this);this.$element=a(a(c).is("body")?window:c),this.$body=a("body"),this.$scrollElement=this.$element.on("scroll.bs.scroll-spy.data-api",f),this.options=a.extend({},b.DEFAULTS,d),this.selector=(this.options.target||(e=a(c).attr("href"))&&e.replace(/.*(?=#[^\s]+$)/,"")||"")+" .nav li > a",this.offsets=a([]),this.targets=a([]),this.activeTarget=null,this.refresh(),this.process()}b.DEFAULTS={offset:10},b.prototype.refresh=function(){var b=this.$element[0]==window?"offset":"position";this.offsets=a([]),this.targets=a([]);{var c=this;this.$body.find(this.selector).map(function(){var d=a(this),e=d.data("target")||d.attr("href"),f=/^#./.test(e)&&a(e);return f&&f.length&&f.is(":visible")&&[[f[b]().top+(!a.isWindow(c.$scrollElement.get(0))&&c.$scrollElement.scrollTop()),e]]||null}).sort(function(a,b){return a[0]-b[0]}).each(function(){c.offsets.push(this[0]),c.targets.push(this[1])})}},b.prototype.process=function(){var a,b=this.$scrollElement.scrollTop()+this.options.offset,c=this.$scrollElement[0].scrollHeight||this.$body[0].scrollHeight,d=c-this.$scrollElement.height(),e=this.offsets,f=this.targets,g=this.activeTarget;if(b>=d)return g!=(a=f.last()[0])&&this.activate(a);if(g&&b<=e[0])return g!=(a=f[0])&&this.activate(a);for(a=e.length;a--;)g!=f[a]&&b>=e[a]&&(!e[a+1]||b<=e[a+1])&&this.activate(f[a])},b.prototype.activate=function(b){this.activeTarget=b,a(this.selector).parentsUntil(this.options.target,".active").removeClass("active");var c=this.selector+'[data-target="'+b+'"],'+this.selector+'[href="'+b+'"]',d=a(c).parents("li").addClass("active");d.parent(".dropdown-menu").length&&(d=d.closest("li.dropdown").addClass("active")),d.trigger("activate.bs.scrollspy")};var c=a.fn.scrollspy;a.fn.scrollspy=function(c){return this.each(function(){var d=a(this),e=d.data("bs.scrollspy"),f="object"==typeof c&&c;e||d.data("bs.scrollspy",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.scrollspy.Constructor=b,a.fn.scrollspy.noConflict=function(){return a.fn.scrollspy=c,this},a(window).on("load",function(){a('[data-spy="scroll"]').each(function(){var b=a(this);b.scrollspy(b.data())})})}(jQuery),+function(a){"use strict";var b=function(b){this.element=a(b)};b.prototype.show=function(){var b=this.element,c=b.closest("ul:not(.dropdown-menu)"),d=b.data("target");if(d||(d=b.attr("href"),d=d&&d.replace(/.*(?=#[^\s]*$)/,"")),!b.parent("li").hasClass("active")){var e=c.find(".active:last a")[0],f=a.Event("show.bs.tab",{relatedTarget:e});if(b.trigger(f),!f.isDefaultPrevented()){var g=a(d);this.activate(b.parent("li"),c),this.activate(g,g.parent(),function(){b.trigger({type:"shown.bs.tab",relatedTarget:e})})}}},b.prototype.activate=function(b,c,d){function e(){f.removeClass("active").find("> .dropdown-menu > .active").removeClass("active"),b.addClass("active"),g?(b[0].offsetWidth,b.addClass("in")):b.removeClass("fade"),b.parent(".dropdown-menu")&&b.closest("li.dropdown").addClass("active"),d&&d()}var f=c.find("> .active"),g=d&&a.support.transition&&f.hasClass("fade");g?f.one(a.support.transition.end,e).emulateTransitionEnd(150):e(),f.removeClass("in")};var c=a.fn.tab;a.fn.tab=function(c){return this.each(function(){var d=a(this),e=d.data("bs.tab");e||d.data("bs.tab",e=new b(this)),"string"==typeof c&&e[c]()})},a.fn.tab.Constructor=b,a.fn.tab.noConflict=function(){return a.fn.tab=c,this},a(document).on("click.bs.tab.data-api",'[data-toggle="tab"], [data-toggle="pill"]',function(b){b.preventDefault(),a(this).tab("show")})}(jQuery),+function(a){"use strict";var b=function(c,d){this.options=a.extend({},b.DEFAULTS,d),this.$window=a(window).on("scroll.bs.affix.data-api",a.proxy(this.checkPosition,this)).on("click.bs.affix.data-api",a.proxy(this.checkPositionWithEventLoop,this)),this.$element=a(c),this.affixed=this.unpin=this.pinnedOffset=null,this.checkPosition()};b.RESET="affix affix-top affix-bottom",b.DEFAULTS={offset:0},b.prototype.getPinnedOffset=function(){if(this.pinnedOffset)return this.pinnedOffset;this.$element.removeClass(b.RESET).addClass("affix");var a=this.$window.scrollTop(),c=this.$element.offset();return this.pinnedOffset=c.top-a},b.prototype.checkPositionWithEventLoop=function(){setTimeout(a.proxy(this.checkPosition,this),1)},b.prototype.checkPosition=function(){if(this.$element.is(":visible")){var c=a(document).height(),d=this.$window.scrollTop(),e=this.$element.offset(),f=this.options.offset,g=f.top,h=f.bottom;"top"==this.affixed&&(e.top+=d),"object"!=typeof f&&(h=g=f),"function"==typeof g&&(g=f.top(this.$element)),"function"==typeof h&&(h=f.bottom(this.$element));var i=null!=this.unpin&&d+this.unpin<=e.top?!1:null!=h&&e.top+this.$element.height()>=c-h?"bottom":null!=g&&g>=d?"top":!1;if(this.affixed!==i){this.unpin&&this.$element.css("top","");var j="affix"+(i?"-"+i:""),k=a.Event(j+".bs.affix");this.$element.trigger(k),k.isDefaultPrevented()||(this.affixed=i,this.unpin="bottom"==i?this.getPinnedOffset():null,this.$element.removeClass(b.RESET).addClass(j).trigger(a.Event(j.replace("affix","affixed"))),"bottom"==i&&this.$element.offset({top:c-h-this.$element.height()}))}}};var c=a.fn.affix;a.fn.affix=function(c){return this.each(function(){var d=a(this),e=d.data("bs.affix"),f="object"==typeof c&&c;e||d.data("bs.affix",e=new b(this,f)),"string"==typeof c&&e[c]()})},a.fn.affix.Constructor=b,a.fn.affix.noConflict=function(){return a.fn.affix=c,this},a(window).on("load",function(){a('[data-spy="affix"]').each(function(){var b=a(this),c=b.data();c.offset=c.offset||{},c.offsetBottom&&(c.offset.bottom=c.offsetBottom),c.offsetTop&&(c.offset.top=c.offsetTop),b.affix(c)})})}(jQuery);
/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Varien
 * @package     js
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */
if(typeof Product=='undefined') {
    var Product = {};
}

/********************* IMAGE ZOOMER ***********************/

Product.Zoom = Class.create();
/**
 * Image zoom control
 *
 * @author      Magento Core Team <core@magentocommerce.com>
 */
Product.Zoom.prototype = {
    initialize: function(imageEl, trackEl, handleEl, zoomInEl, zoomOutEl, hintEl){
        this.containerEl = $(imageEl).parentNode;
        this.imageEl = $(imageEl);
        this.handleEl = $(handleEl);
        this.trackEl = $(trackEl);
        this.hintEl = $(hintEl);

        this.containerDim = Element.getDimensions(this.containerEl);
        this.imageDim = Element.getDimensions(this.imageEl);

        this.imageDim.ratio = this.imageDim.width/this.imageDim.height;

        this.floorZoom = 1;

        if (this.imageDim.width > this.imageDim.height) {
            this.ceilingZoom = this.imageDim.width / this.containerDim.width;
        } else {
            this.ceilingZoom = this.imageDim.height / this.containerDim.height;
        }

        if (this.imageDim.width <= this.containerDim.width
            && this.imageDim.height <= this.containerDim.height) {
            this.trackEl.up().hide();
            this.hintEl.hide();
            this.containerEl.removeClassName('product-image-zoom');
            return;
        }

        this.imageX = 0;
        this.imageY = 0;
        this.imageZoom = 1;

        this.sliderSpeed = 0;
        this.sliderAccel = 0;
        this.zoomBtnPressed = false;

        this.showFull = false;

        this.selects = document.getElementsByTagName('select');

        this.draggable = new Draggable(imageEl, {
            starteffect:false,
            reverteffect:false,
            endeffect:false,
            snap:this.contain.bind(this)
        });

        this.slider = new Control.Slider(handleEl, trackEl, {
            axis:'horizontal',
            minimum:0,
            maximum:Element.getDimensions(this.trackEl).width,
            alignX:0,
            increment:1,
            sliderValue:0,
            onSlide:this.scale.bind(this),
            onChange:this.scale.bind(this)
        });

        this.scale(0);

        Event.observe(this.imageEl, 'dblclick', this.toggleFull.bind(this));

        Event.observe($(zoomInEl), 'mousedown', this.startZoomIn.bind(this));
        Event.observe($(zoomInEl), 'mouseup', this.stopZooming.bind(this));
        Event.observe($(zoomInEl), 'mouseout', this.stopZooming.bind(this));

        Event.observe($(zoomOutEl), 'mousedown', this.startZoomOut.bind(this));
        Event.observe($(zoomOutEl), 'mouseup', this.stopZooming.bind(this));
        Event.observe($(zoomOutEl), 'mouseout', this.stopZooming.bind(this));
    },

    toggleFull: function () {
        this.showFull = !this.showFull;

        //Hide selects for IE6 only
        if (typeof document.body.style.maxHeight == "undefined")  {
            for (i=0; i<this.selects.length; i++) {
                this.selects[i].style.visibility = this.showFull ? 'hidden' : 'visible';
            }
        }
        val_scale = !this.showFull ? this.slider.value : 1;
        this.scale(val_scale);

        this.trackEl.style.visibility = this.showFull ? 'hidden' : 'visible';
        this.containerEl.style.overflow = this.showFull ? 'visible' : 'hidden';
        this.containerEl.style.zIndex = this.showFull ? '1000' : '9';

        return this;
    },

    scale: function (v) {
        var centerX  = (this.containerDim.width*(1-this.imageZoom)/2-this.imageX)/this.imageZoom;
        var centerY  = (this.containerDim.height*(1-this.imageZoom)/2-this.imageY)/this.imageZoom;
        var overSize = (this.imageDim.width > this.containerDim.width || this.imageDim.height > this.containerDim.height);

        this.imageZoom = this.floorZoom+(v*(this.ceilingZoom-this.floorZoom));

        if (overSize) {
            if (this.imageDim.width > this.imageDim.height) {
                this.imageEl.style.width = (this.imageZoom*this.containerDim.width)+'px';
            } else {
                this.imageEl.style.height = (this.imageZoom*this.containerDim.height)+'px';
            }
            if (this.containerDim.ratio) {
                if (this.imageDim.width > this.imageDim.height) {
                    this.imageEl.style.height = (this.imageZoom*this.containerDim.width*this.containerDim.ratio)+'px'; // for safari
                } else {
                    this.imageEl.style.width = (this.imageZoom*this.containerDim.height*this.containerDim.ratio)+'px'; // for safari
                }
            }
        } else {
            this.slider.setDisabled();
        }

        this.imageX = this.containerDim.width*(1-this.imageZoom)/2-centerX*this.imageZoom;
        this.imageY = this.containerDim.height*(1-this.imageZoom)/2-centerY*this.imageZoom;

        this.contain(this.imageX, this.imageY, this.draggable);

        return true;
    },

    startZoomIn: function()
    {
        if (!this.slider.disabled) {
            this.zoomBtnPressed = true;
            this.sliderAccel = .002;
            this.periodicalZoom();
            this.zoomer = new PeriodicalExecuter(this.periodicalZoom.bind(this), .05);
        }
        return this;
    },

    startZoomOut: function()
    {
        if (!this.slider.disabled) {
            this.zoomBtnPressed = true;
            this.sliderAccel = -.002;
            this.periodicalZoom();
            this.zoomer = new PeriodicalExecuter(this.periodicalZoom.bind(this), .05);
        }
        return this;
    },

    stopZooming: function()
    {
        if (!this.zoomer || this.sliderSpeed==0) {
            return;
        }
        this.zoomBtnPressed = false;
        this.sliderAccel = 0;
    },

    periodicalZoom: function()
    {
        if (!this.zoomer) {
            return this;
        }

        if (this.zoomBtnPressed) {
            this.sliderSpeed += this.sliderAccel;
        } else {
            this.sliderSpeed /= 1.5;
            if (Math.abs(this.sliderSpeed)<.001) {
                this.sliderSpeed = 0;
                this.zoomer.stop();
                this.zoomer = null;
            }
        }
        this.slider.value += this.sliderSpeed;

        this.slider.setValue(this.slider.value);
        this.scale(this.slider.value);

        return this;
    },

    contain: function (x,y,draggable) {

        var dim = Element.getDimensions(draggable.element);

        var xMin = 0, xMax = this.containerDim.width-dim.width;
        var yMin = 0, yMax = this.containerDim.height-dim.height;

        x = x>xMin ? xMin : x;
        x = x<xMax ? xMax : x;
        y = y>yMin ? yMin : y;
        y = y<yMax ? yMax : y;

        if (this.containerDim.width > dim.width) {
            x = (this.containerDim.width/2) - (dim.width/2);
        }

        if (this.containerDim.height > dim.height) {
            y = (this.containerDim.height/2) - (dim.height/2);
        }

        this.imageX = x;
        this.imageY = y;

        this.imageEl.style.left = this.imageX+'px';
        this.imageEl.style.top = this.imageY+'px';

        return [x,y];
    }
}

/**************************** CONFIGURABLE PRODUCT **************************/
Product.Config = Class.create();
Product.Config.prototype = {
    initialize: function(config){
        this.config     = config;
        this.taxConfig  = this.config.taxConfig;
        this.settings   = $$('.super-attribute-select');
        this.state      = new Hash();
        this.priceTemplate = new Template(this.config.template);
        this.prices     = config.prices;

        this.settings.each(function(element){
            Event.observe(element, 'change', this.configure.bind(this))
        }.bind(this));

        // fill state
        this.settings.each(function(element){
            var attributeId = element.id.replace(/[a-z]*/, '');
            if(attributeId && this.config.attributes[attributeId]) {
                element.config = this.config.attributes[attributeId];
                element.attributeId = attributeId;
                this.state[attributeId] = false;
            }
        }.bind(this))

        // Init settings dropdown
        var childSettings = [];
        for(var i=this.settings.length-1;i>=0;i--){
            var prevSetting = this.settings[i-1] ? this.settings[i-1] : false;
            var nextSetting = this.settings[i+1] ? this.settings[i+1] : false;
            if(i==0){
                this.fillSelect(this.settings[i])
            }
            else {
                this.settings[i].disabled=true;
            }
            $(this.settings[i]).childSettings = childSettings.clone();
            $(this.settings[i]).prevSetting   = prevSetting;
            $(this.settings[i]).nextSetting   = nextSetting;
            childSettings.push(this.settings[i]);
        }

        // Set default values - from config and overwrite them by url values
        if (config.defaultValues) {
            this.values = config.defaultValues;
        }

        var separatorIndex = window.location.href.indexOf('#');
        if (separatorIndex != -1) {
            var paramsStr = window.location.href.substr(separatorIndex+1);
            var urlValues = paramsStr.toQueryParams();
            if (!this.values) {
                this.values = {};
            }
            for (var i in urlValues) {
                this.values[i] = urlValues[i];
            }
        }

        this.configureForValues();
        document.observe("dom:loaded", this.configureForValues.bind(this));
    },

    configureForValues: function () {
        if (this.values) {
            this.settings.each(function(element){
                var attributeId = element.attributeId;
                element.value = (typeof(this.values[attributeId]) == 'undefined')? '' : this.values[attributeId];
                this.configureElement(element);
            }.bind(this));
        }
    },

    configure: function(event){
        var element = Event.element(event);
        this.configureElement(element);
    },

    configureElement : function(element) {
        this.reloadOptionLabels(element);
        if(element.value){
            this.state[element.config.id] = element.value;
            if(element.nextSetting){
                element.nextSetting.disabled = false;
                this.fillSelect(element.nextSetting);
                this.resetChildren(element.nextSetting);
            }
        }
        else {
            this.resetChildren(element);
        }
        this.reloadPrice();
//      Calculator.updatePrice();
    },

    reloadOptionLabels: function(element){
        var selectedPrice;
        if(element.options[element.selectedIndex].config){
            selectedPrice = parseFloat(element.options[element.selectedIndex].config.price)
        }
        else{
            selectedPrice = 0;
        }
        for(var i=0;i<element.options.length;i++){
            if(element.options[i].config){
                element.options[i].text = this.getOptionLabel(element.options[i].config, element.options[i].config.price-selectedPrice);
            }
        }
    },

    resetChildren : function(element){
        if(element.childSettings) {
            for(var i=0;i<element.childSettings.length;i++){
                element.childSettings[i].selectedIndex = 0;
                element.childSettings[i].disabled = true;
                if(element.config){
                    this.state[element.config.id] = false;
                }
            }
        }
    },

    fillSelect: function(element){
        var attributeId = element.id.replace(/[a-z]*/, '');
        var options = this.getAttributeOptions(attributeId);
        this.clearSelect(element);
        element.options[0] = new Option('', '');
        element.options[0].innerHTML = this.config.chooseText;

        var prevConfig = false;
        if(element.prevSetting){
            prevConfig = element.prevSetting.options[element.prevSetting.selectedIndex];
        }

        if(options) {
            var index = 1;
            for(var i=0;i<options.length;i++){
                var allowedProducts = [];
                if(prevConfig) {
                    for(var j=0;j<options[i].products.length;j++){
                        if(prevConfig.config.allowedProducts
                            && prevConfig.config.allowedProducts.indexOf(options[i].products[j])>-1){
                            allowedProducts.push(options[i].products[j]);
                        }
                    }
                } else {
                    allowedProducts = options[i].products.clone();
                }

                if(allowedProducts.size()>0){
                    options[i].allowedProducts = allowedProducts;
                    element.options[index] = new Option(this.getOptionLabel(options[i], options[i].price), options[i].id);
                    element.options[index].config = options[i];
                    index++;
                }
            }
        }
    },

    getOptionLabel: function(option, price){
        var price = parseFloat(price);
        if (this.taxConfig.includeTax) {
            var tax = price / (100 + this.taxConfig.defaultTax) * this.taxConfig.defaultTax;
            var excl = price - tax;
            var incl = excl*(1+(this.taxConfig.currentTax/100));
        } else {
            var tax = price * (this.taxConfig.currentTax / 100);
            var excl = price;
            var incl = excl + tax;
        }

        if (this.taxConfig.showIncludeTax || this.taxConfig.showBothPrices) {
            price = incl;
        } else {
            price = excl;
        }

        var str = option.label;
        if(price){
            if (this.taxConfig.showBothPrices) {
                str+= ' ' + this.formatPrice(excl, true) + ' (' + this.formatPrice(price, true) + ' ' + this.taxConfig.inclTaxTitle + ')';
            } else {
                str+= ' ' + this.formatPrice(price, true);
            }
        }
        return str;
    },

    formatPrice: function(price, showSign){
        var str = '';
        price = parseFloat(price);
        if(showSign){
            if(price<0){
                str+= '-';
                price = -price;
            }
            else{
                str+= '+';
            }
        }

        var roundedPrice = (Math.round(price*100)/100).toString();

        if (this.prices && this.prices[roundedPrice]) {
            str+= this.prices[roundedPrice];
        }
        else {
            str+= this.priceTemplate.evaluate({price:price.toFixed(2)});
        }
        return str;
    },

    clearSelect: function(element){
        for(var i=element.options.length-1;i>=0;i--){
            element.remove(i);
        }
    },

    getAttributeOptions: function(attributeId){
        if(this.config.attributes[attributeId]){
            return this.config.attributes[attributeId].options;
        }
    },

    reloadPrice: function(){
        var price    = 0;
        var oldPrice = 0;
        for(var i=this.settings.length-1;i>=0;i--){
            var selected = this.settings[i].options[this.settings[i].selectedIndex];
            if(selected.config){
                price    += parseFloat(selected.config.price);
                oldPrice += parseFloat(selected.config.oldPrice);
            }
        }

        optionsPrice.changePrice('config', {'price': price, 'oldPrice': oldPrice});
        optionsPrice.reload();

        return price;

        if($('product-price-'+this.config.productId)){
            $('product-price-'+this.config.productId).innerHTML = price;
        }
        this.reloadOldPrice();
    },

    reloadOldPrice: function(){
        if ($('old-price-'+this.config.productId)) {

            var price = parseFloat(this.config.oldPrice);
            for(var i=this.settings.length-1;i>=0;i--){
                var selected = this.settings[i].options[this.settings[i].selectedIndex];
                if(selected.config){
                    var parsedOldPrice = parseFloat(selected.config.oldPrice);
                    price += isNaN(parsedOldPrice) ? 0 : parsedOldPrice;
                }
            }
            if (price < 0)
                price = 0;
            price = this.formatPrice(price);

            if($('old-price-'+this.config.productId)){
                $('old-price-'+this.config.productId).innerHTML = price;
            }

        }
    }
}


/**************************** SUPER PRODUCTS ********************************/

Product.Super = {};
Product.Super.Configurable = Class.create();

Product.Super.Configurable.prototype = {
    initialize: function(container, observeCss, updateUrl, updatePriceUrl, priceContainerId) {
        this.container = $(container);
        this.observeCss = observeCss;
        this.updateUrl = updateUrl;
        this.updatePriceUrl = updatePriceUrl;
        this.priceContainerId = priceContainerId;
        this.registerObservers();
    },
    registerObservers: function() {
        var elements = this.container.getElementsByClassName(this.observeCss);
        elements.each(function(element){
            Event.observe(element, 'change', this.update.bindAsEventListener(this));
        }.bind(this));
        return this;
    },
    update: function(event) {
        var elements = this.container.getElementsByClassName(this.observeCss);
        var parameters = Form.serializeElements(elements, true);

        new Ajax.Updater(this.container, this.updateUrl + '?ajax=1', {
                parameters:parameters,
                onComplete:this.registerObservers.bind(this)
        });
        var priceContainer = $(this.priceContainerId);
        if(priceContainer) {
            new Ajax.Updater(priceContainer, this.updatePriceUrl + '?ajax=1', {
                parameters:parameters
            });
        }
    }
}

/**************************** PRICE RELOADER ********************************/
Product.OptionsPrice = Class.create();
Product.OptionsPrice.prototype = {
    initialize: function(config) {
        this.productId          = config.productId;
        this.priceFormat        = config.priceFormat;
        this.includeTax         = config.includeTax;
        this.defaultTax         = config.defaultTax;
        this.currentTax         = config.currentTax;
        this.productPrice       = config.productPrice;
        this.showIncludeTax     = config.showIncludeTax;
        this.showBothPrices     = config.showBothPrices;
        this.productOldPrice    = config.productOldPrice;
        this.priceInclTax       = config.priceInclTax;
        this.priceExclTax       = config.priceExclTax;
        this.skipCalculate      = config.skipCalculate; /** @deprecated after 1.5.1.0 */
        this.duplicateIdSuffix  = config.idSuffix;
        this.specialTaxPrice    = config.specialTaxPrice;
        this.tierPrices         = config.tierPrices;
        this.tierPricesInclTax  = config.tierPricesInclTax;

        this.oldPlusDisposition = config.oldPlusDisposition;
        this.plusDisposition    = config.plusDisposition;
        this.plusDispositionTax = config.plusDispositionTax;

        this.oldMinusDisposition = config.oldMinusDisposition;
        this.minusDisposition    = config.minusDisposition;

        this.exclDisposition     = config.exclDisposition;

        this.optionPrices   = {};
        this.customPrices   = {};
        this.containers     = {};

        this.displayZeroPrice   = true;

        this.initPrices();
    },

    setDuplicateIdSuffix: function(idSuffix) {
        this.duplicateIdSuffix = idSuffix;
    },

    initPrices: function() {
        this.containers[0] = 'product-price-' + this.productId;
        this.containers[1] = 'bundle-price-' + this.productId;
        this.containers[2] = 'price-including-tax-' + this.productId;
        this.containers[3] = 'price-excluding-tax-' + this.productId;
        this.containers[4] = 'old-price-' + this.productId;
    },

    changePrice: function(key, price) {
        this.optionPrices[key] = price;
    },

    addCustomPrices: function(key, price) {
        this.customPrices[key] = price;
    },
    getOptionPrices: function() {
        var price = 0;
        var nonTaxable = 0;
        var oldPrice = 0;
        var priceInclTax = 0;
        var currentTax = this.currentTax;
        $H(this.optionPrices).each(function(pair) {
            if ('undefined' != typeof(pair.value.price) && 'undefined' != typeof(pair.value.oldPrice)) {
                price += parseFloat(pair.value.price);
                oldPrice += parseFloat(pair.value.oldPrice);
            } else if (pair.key == 'nontaxable') {
                nonTaxable = pair.value;
            } else if (pair.key == 'priceInclTax') {
                priceInclTax += pair.value;
            } else if (pair.key == 'optionsPriceInclTax') {
                priceInclTax += pair.value * (100 + currentTax) / 100;
            } else {
                price += parseFloat(pair.value);
                oldPrice += parseFloat(pair.value);
            }
        });
        var result = [price, nonTaxable, oldPrice, priceInclTax];
        return result;
    },

    reload: function() {
        var price;
        var formattedPrice;
        var optionPrices = this.getOptionPrices();
        var nonTaxable = optionPrices[1];
        var optionOldPrice = optionPrices[2];
        var priceInclTax = optionPrices[3];
        optionPrices = optionPrices[0];

        $H(this.containers).each(function(pair) {
            var _productPrice;
            var _plusDisposition;
            var _minusDisposition;
            var _priceInclTax;
            if ($(pair.value)) {
                if (pair.value == 'old-price-'+this.productId && this.productOldPrice != this.productPrice) {
                    _productPrice = this.productOldPrice;
                    _plusDisposition = this.oldPlusDisposition;
                    _minusDisposition = this.oldMinusDisposition;
                } else {
                    _productPrice = this.productPrice;
                    _plusDisposition = this.plusDisposition;
                    _minusDisposition = this.minusDisposition;
                }
                _priceInclTax = priceInclTax;

                if (pair.value == 'old-price-'+this.productId && optionOldPrice !== undefined) {
                    price = optionOldPrice+parseFloat(_productPrice);
                } else if (this.specialTaxPrice == 'true' && this.priceInclTax !== undefined && this.priceExclTax !== undefined) {
                    price = optionPrices+parseFloat(this.priceExclTax);
                    _priceInclTax += this.priceInclTax;
                } else {
                    price = optionPrices+parseFloat(_productPrice);
                    _priceInclTax += parseFloat(_productPrice) * (100 + this.currentTax) / 100;
                }

                if (this.specialTaxPrice == 'true') {
                    var excl = price;
                    var incl = _priceInclTax;
                } else if (this.includeTax == 'true') {
                    // tax = tax included into product price by admin
                    var tax = price / (100 + this.defaultTax) * this.defaultTax;
                    var excl = price - tax;
                    var incl = excl*(1+(this.currentTax/100));
                } else {
                    var tax = price * (this.currentTax / 100);
                    var excl = price;
                    var incl = excl + tax;
                }

                var subPrice = 0;
                var subPriceincludeTax = 0;
                Object.values(this.customPrices).each(function(el){
                    if (el.excludeTax && el.includeTax) {
                        subPrice += parseFloat(el.excludeTax);
                        subPriceincludeTax += parseFloat(el.includeTax);
                    } else {
                        subPrice += parseFloat(el.price);
                        subPriceincludeTax += parseFloat(el.price);
                    }
                });
                excl += subPrice;
                incl += subPriceincludeTax;

                if (typeof this.exclDisposition == 'undefined') {
                    excl += parseFloat(_plusDisposition);
                }

                incl += parseFloat(_plusDisposition) + parseFloat(this.plusDispositionTax);
                excl -= parseFloat(_minusDisposition);
                incl -= parseFloat(_minusDisposition);

                //adding nontaxlable part of options
                excl += parseFloat(nonTaxable);
                incl += parseFloat(nonTaxable);

                if (pair.value == 'price-including-tax-'+this.productId) {
                    price = incl;
                } else if (pair.value == 'price-excluding-tax-'+this.productId) {
                    price = excl;
                } else if (pair.value == 'old-price-'+this.productId) {
                    if (this.showIncludeTax || this.showBothPrices) {
                        price = incl;
                    } else {
                        price = excl;
                    }
                } else {
                    if (this.showIncludeTax) {
                        price = incl;
                    } else {
                        price = excl;
                    }
                }

                if (price < 0) price = 0;

                if (price > 0 || this.displayZeroPrice) {
                    formattedPrice = this.formatPrice(price);
                } else {
                    formattedPrice = '';
                }

                if ($(pair.value).select('.price')[0]) {
                    $(pair.value).select('.price')[0].innerHTML = formattedPrice;
                    if ($(pair.value+this.duplicateIdSuffix) && $(pair.value+this.duplicateIdSuffix).select('.price')[0]) {
                        $(pair.value+this.duplicateIdSuffix).select('.price')[0].innerHTML = formattedPrice;
                    }
                } else {
                    $(pair.value).innerHTML = formattedPrice;
                    if ($(pair.value+this.duplicateIdSuffix)) {
                        $(pair.value+this.duplicateIdSuffix).innerHTML = formattedPrice;
                    }
                }
            };
        }.bind(this));

        if (typeof(skipTierPricePercentUpdate) === "undefined" && typeof(this.tierPrices) !== "undefined") {
            for (var i = 0; i < this.tierPrices.length; i++) {
                $$('.benefit').each(function(el) {
                    var parsePrice = function(html) {
                        var format = this.priceFormat;
                        var decimalSymbol = format.decimalSymbol === undefined ? "," : format.decimalSymbol;
                        var regexStr = '[^0-9-' + decimalSymbol + ']';
                        //remove all characters except number and decimal symbol
                        html = html.replace(new RegExp(regexStr, 'g'), '');
                        html = html.replace(decimalSymbol, '.');
                        return parseFloat(html);
                    }.bind(this);

                    var updateTierPriceInfo = function(priceEl, tierPriceDiff, tierPriceEl, benefitEl) {
                        if (typeof(tierPriceEl) === "undefined") {
                            //tierPrice is not shown, e.g., MAP, no need to update the tier price info
                            return;
                        }
                        var price = parsePrice(priceEl.innerHTML);
                        var tierPrice = price + tierPriceDiff;

                        tierPriceEl.innerHTML = this.formatPrice(tierPrice);

                        var $percent = Selector.findChildElements(benefitEl, ['.percent.tier-' + i]);
                        $percent.each(function(el) {
                            el.innerHTML = Math.ceil(100 - ((100 / price) * tierPrice));
                        });
                    }.bind(this);

                    var tierPriceElArray = $$('.tier-price.tier-' + i + ' .price');
                    if (this.showBothPrices) {
                        var containerExclTax = $(this.containers[3]);
                        var tierPriceExclTaxDiff = this.tierPrices[i];
                        var tierPriceExclTaxEl = tierPriceElArray[0];
                        updateTierPriceInfo(containerExclTax, tierPriceExclTaxDiff, tierPriceExclTaxEl, el);
                        var containerInclTax = $(this.containers[2]);
                        var tierPriceInclTaxDiff = this.tierPricesInclTax[i];
                        var tierPriceInclTaxEl = tierPriceElArray[1];
                        updateTierPriceInfo(containerInclTax, tierPriceInclTaxDiff, tierPriceInclTaxEl, el);
                    } else if (this.showIncludeTax) {
                        var container = $(this.containers[0]);
                        var tierPriceInclTaxDiff = this.tierPricesInclTax[i];
                        var tierPriceInclTaxEl = tierPriceElArray[0];
                        updateTierPriceInfo(container, tierPriceInclTaxDiff, tierPriceInclTaxEl, el);
                    } else {
                        var container = $(this.containers[0]);
                        var tierPriceExclTaxDiff = this.tierPrices[i];
                        var tierPriceExclTaxEl = tierPriceElArray[0];
                        updateTierPriceInfo(container, tierPriceExclTaxDiff, tierPriceExclTaxEl, el);
                    }
                }, this);
            }
        }

    },
    formatPrice: function(price) {
        return formatCurrency(price, this.priceFormat);
    }
}

/*  Copyright Mihai Bazon, 2002-2005 | www.bazon.net/mishoo
 * -----------------------------------------------------------
 *
 * The DHTML Calendar, version 1.0 "It is happening again"
 *
 * Details and latest version at:
 * www.dynarch.com/projects/calendar
 *
 * This script is developed by Dynarch.com.  Visit us at www.dynarch.com.
 *
 * This script is distributed under the GNU Lesser General Public License.
 * Read the entire license text here: http://www.gnu.org/licenses/lgpl.html
 */

// $Id: calendar.js,v 1.51 2005/03/07 16:44:31 mishoo Exp $

/** The Calendar object constructor. */
Calendar = function (firstDayOfWeek, dateStr, onSelected, onClose) {
    // member variables
    this.activeDiv = null;
    this.currentDateEl = null;
    this.getDateStatus = null;
    this.getDateToolTip = null;
    this.getDateText = null;
    this.timeout = null;
    this.onSelected = onSelected || null;
    this.onClose = onClose || null;
    this.dragging = false;
    this.hidden = false;
    this.minYear = 1970;
    this.maxYear = 2050;
    this.dateFormat = Calendar._TT["DEF_DATE_FORMAT"];
    this.ttDateFormat = Calendar._TT["TT_DATE_FORMAT"];
    this.isPopup = true;
    this.weekNumbers = true;
    this.firstDayOfWeek = typeof firstDayOfWeek == "number" ? firstDayOfWeek : Calendar._FD; // 0 for Sunday, 1 for Monday, etc.
    this.showsOtherMonths = false;
    this.dateStr = dateStr;
    this.ar_days = null;
    this.showsTime = false;
    this.time24 = true;
    this.yearStep = 2;
    this.hiliteToday = true;
    this.multiple = null;
    // HTML elements
    this.table = null;
    this.element = null;
    this.tbody = null;
    this.firstdayname = null;
    // Combo boxes
    this.monthsCombo = null;
    this.yearsCombo = null;
    this.hilitedMonth = null;
    this.activeMonth = null;
    this.hilitedYear = null;
    this.activeYear = null;
    // Information
    this.dateClicked = false;

    // one-time initializations
    if (typeof Calendar._SDN == "undefined") {
        // table of short day names
        if (typeof Calendar._SDN_len == "undefined")
            Calendar._SDN_len = 3;
        var ar = new Array();
        for (var i = 8; i > 0;) {
            ar[--i] = Calendar._DN[i].substr(0, Calendar._SDN_len);
        }
        Calendar._SDN = ar;
        // table of short month names
        if (typeof Calendar._SMN_len == "undefined")
            Calendar._SMN_len = 3;
        ar = new Array();
        for (var i = 12; i > 0;) {
            ar[--i] = Calendar._MN[i].substr(0, Calendar._SMN_len);
        }
        Calendar._SMN = ar;
    }
};

// ** constants

/// "static", needed for event handlers.
Calendar._C = null;

/// detect a special case of "web browser"
Calendar.is_ie = ( /msie/i.test(navigator.userAgent) &&
           !/opera/i.test(navigator.userAgent) );

Calendar.is_ie5 = ( Calendar.is_ie && /msie 5\.0/i.test(navigator.userAgent) );

/// detect Opera browser
Calendar.is_opera = /opera/i.test(navigator.userAgent);

/// detect KHTML-based browsers
Calendar.is_khtml = /Konqueror|Safari|KHTML/i.test(navigator.userAgent);

/// detect Gecko browsers
Calendar.is_gecko = navigator.userAgent.match(/gecko/i);

// BEGIN: UTILITY FUNCTIONS; beware that these might be moved into a separate
//        library, at some point.

// Returns CSS property for element
Calendar.getStyle = function(element, style) {
    if (element.currentStyle) {
        var y = element.currentStyle[style];
    } else if (window.getComputedStyle) {
        var y = document.defaultView.getComputedStyle(element,null).getPropertyValue(style);
    }

    return y;
};

/*
 * Different ways to find element's absolute position
 */
Calendar.getAbsolutePos = function(element) {

    var res = new Object();
    res.x = 0; res.y = 0;

    // variant 1 (working best, copy-paste from prototype library)
    do {
        res.x += element.offsetLeft || 0;
        res.y += element.offsetTop  || 0;
        element = element.offsetParent;
        if (element) {
            if (element.tagName.toUpperCase() == 'BODY') break;
            var p = Calendar.getStyle(element, 'position');
            if ((p !== 'static') && (p !== 'relative')) break;
        }
    } while (element);

    return res;

    // variant 2 (good solution, but lost in IE8)
    if (element !== null) {
        res.x = element.offsetLeft;
        res.y = element.offsetTop;

        var offsetParent = element.offsetParent;
        var parentNode = element.parentNode;

        while (offsetParent !== null) {
            res.x += offsetParent.offsetLeft;
            res.y += offsetParent.offsetTop;

            if (offsetParent != document.body && offsetParent != document.documentElement) {
                res.x -= offsetParent.scrollLeft;
                res.y -= offsetParent.scrollTop;
            }
            //next lines are necessary to support FireFox problem with offsetParent
            if (Calendar.is_gecko) {
                while (offsetParent != parentNode && parentNode !== null) {
                    res.x -= parentNode.scrollLeft;
                    res.y -= parentNode.scrollTop;
                    parentNode = parentNode.parentNode;
                }
            }
            parentNode = offsetParent.parentNode;
            offsetParent = offsetParent.offsetParent;
        }
    }
    return res;

    // variant 2 (not working)

//    var SL = 0, ST = 0;
//    var is_div = /^div$/i.test(el.tagName);
//    if (is_div && el.scrollLeft)
//        SL = el.scrollLeft;
//    if (is_div && el.scrollTop)
//        ST = el.scrollTop;
//    var r = { x: el.offsetLeft - SL, y: el.offsetTop - ST };
//    if (el.offsetParent) {
//        var tmp = this.getAbsolutePos(el.offsetParent);
//        r.x += tmp.x;
//        r.y += tmp.y;
//    }
//    return r;
};

Calendar.isRelated = function (el, evt) {
    var related = evt.relatedTarget;
    if (!related) {
        var type = evt.type;
        if (type == "mouseover") {
            related = evt.fromElement;
        } else if (type == "mouseout") {
            related = evt.toElement;
        }
    }
    while (related) {
        if (related == el) {
            return true;
        }
        related = related.parentNode;
    }
    return false;
};

Calendar.removeClass = function(el, className) {
    if (!(el && el.className)) {
        return;
    }
    var cls = el.className.split(" ");
    var ar = new Array();
    for (var i = cls.length; i > 0;) {
        if (cls[--i] != className) {
            ar[ar.length] = cls[i];
        }
    }
    el.className = ar.join(" ");
};

Calendar.addClass = function(el, className) {
    Calendar.removeClass(el, className);
    el.className += " " + className;
};

// FIXME: the following 2 functions totally suck, are useless and should be replaced immediately.
Calendar.getElement = function(ev) {
    var f = Calendar.is_ie ? window.event.srcElement : ev.currentTarget;
    while (f.nodeType != 1 || /^div$/i.test(f.tagName))
        f = f.parentNode;
    return f;
};

Calendar.getTargetElement = function(ev) {
    var f = Calendar.is_ie ? window.event.srcElement : ev.target;
    while (f.nodeType != 1)
        f = f.parentNode;
    return f;
};

Calendar.stopEvent = function(ev) {
    ev || (ev = window.event);
    if (Calendar.is_ie) {
        ev.cancelBubble = true;
        ev.returnValue = false;
    } else {
        ev.preventDefault();
        ev.stopPropagation();
    }
    return false;
};

Calendar.addEvent = function(el, evname, func) {
    if (el.attachEvent) { // IE
        el.attachEvent("on" + evname, func);
    } else if (el.addEventListener) { // Gecko / W3C
        el.addEventListener(evname, func, true);
    } else {
        el["on" + evname] = func;
    }
};

Calendar.removeEvent = function(el, evname, func) {
    if (el.detachEvent) { // IE
        el.detachEvent("on" + evname, func);
    } else if (el.removeEventListener) { // Gecko / W3C
        el.removeEventListener(evname, func, true);
    } else {
        el["on" + evname] = null;
    }
};

Calendar.createElement = function(type, parent) {
    var el = null;
    if (document.createElementNS) {
        // use the XHTML namespace; IE won't normally get here unless
        // _they_ "fix" the DOM2 implementation.
        el = document.createElementNS("http://www.w3.org/1999/xhtml", type);
    } else {
        el = document.createElement(type);
    }
    if (typeof parent != "undefined") {
        parent.appendChild(el);
    }
    return el;
};

// END: UTILITY FUNCTIONS

// BEGIN: CALENDAR STATIC FUNCTIONS

/** Internal -- adds a set of events to make some element behave like a button. */
Calendar._add_evs = function(el) {
    with (Calendar) {
        addEvent(el, "mouseover", dayMouseOver);
        addEvent(el, "mousedown", dayMouseDown);
        addEvent(el, "mouseout", dayMouseOut);
        if (is_ie) {
            addEvent(el, "dblclick", dayMouseDblClick);
            el.setAttribute("unselectable", true);
        }
    }
};

Calendar.findMonth = function(el) {
    if (typeof el.month != "undefined") {
        return el;
    } else if (typeof el.parentNode.month != "undefined") {
        return el.parentNode;
    }
    return null;
};

Calendar.findYear = function(el) {
    if (typeof el.year != "undefined") {
        return el;
    } else if (typeof el.parentNode.year != "undefined") {
        return el.parentNode;
    }
    return null;
};

Calendar.showMonthsCombo = function () {
    var cal = Calendar._C;
    if (!cal) {
        return false;
    }
    var cal = cal;
    var cd = cal.activeDiv;
    var mc = cal.monthsCombo;
    if (cal.hilitedMonth) {
        Calendar.removeClass(cal.hilitedMonth, "hilite");
    }
    if (cal.activeMonth) {
        Calendar.removeClass(cal.activeMonth, "active");
    }
    var mon = cal.monthsCombo.getElementsByTagName("div")[cal.date.getMonth()];
    Calendar.addClass(mon, "active");
    cal.activeMonth = mon;
    var s = mc.style;
    s.display = "block";
    if (cd.navtype < 0)
        s.left = cd.offsetLeft + "px";
    else {
        var mcw = mc.offsetWidth;
        if (typeof mcw == "undefined")
            // Konqueror brain-dead techniques
            mcw = 50;
        s.left = (cd.offsetLeft + cd.offsetWidth - mcw) + "px";
    }
    s.top = (cd.offsetTop + cd.offsetHeight) + "px";
};

Calendar.showYearsCombo = function (fwd) {
    var cal = Calendar._C;
    if (!cal) {
        return false;
    }
    var cal = cal;
    var cd = cal.activeDiv;
    var yc = cal.yearsCombo;
    if (cal.hilitedYear) {
        Calendar.removeClass(cal.hilitedYear, "hilite");
    }
    if (cal.activeYear) {
        Calendar.removeClass(cal.activeYear, "active");
    }
    cal.activeYear = null;
    var Y = cal.date.getFullYear() + (fwd ? 1 : -1);
    var yr = yc.firstChild;
    var show = false;
    for (var i = 12; i > 0; --i) {
        if (Y >= cal.minYear && Y <= cal.maxYear) {
            yr.innerHTML = Y;
            yr.year = Y;
            yr.style.display = "block";
            show = true;
        } else {
            yr.style.display = "none";
        }
        yr = yr.nextSibling;
        Y += fwd ? cal.yearStep : -cal.yearStep;
    }
    if (show) {
        var s = yc.style;
        s.display = "block";
        if (cd.navtype < 0)
            s.left = cd.offsetLeft + "px";
        else {
            var ycw = yc.offsetWidth;
            if (typeof ycw == "undefined")
                // Konqueror brain-dead techniques
                ycw = 50;
            s.left = (cd.offsetLeft + cd.offsetWidth - ycw) + "px";
        }
        s.top = (cd.offsetTop + cd.offsetHeight) + "px";
    }
};

// event handlers

Calendar.tableMouseUp = function(ev) {
    var cal = Calendar._C;
    if (!cal) {
        return false;
    }
    if (cal.timeout) {
        clearTimeout(cal.timeout);
    }
    var el = cal.activeDiv;
    if (!el) {
        return false;
    }
    var target = Calendar.getTargetElement(ev);
    ev || (ev = window.event);
    Calendar.removeClass(el, "active");
    if (target == el || target.parentNode == el) {
        Calendar.cellClick(el, ev);
    }
    var mon = Calendar.findMonth(target);
    var date = null;
    if (mon) {
        date = new CalendarDateObject(cal.date);
        if (mon.month != date.getMonth()) {
            date.setMonth(mon.month);
            cal.setDate(date);
            cal.dateClicked = false;
            cal.callHandler();
        }
    } else {
        var year = Calendar.findYear(target);
        if (year) {
            date = new CalendarDateObject(cal.date);
            if (year.year != date.getFullYear()) {
                date.setFullYear(year.year);
                cal.setDate(date);
                cal.dateClicked = false;
                cal.callHandler();
            }
        }
    }
    with (Calendar) {
        removeEvent(document, "mouseup", tableMouseUp);
        removeEvent(document, "mouseover", tableMouseOver);
        removeEvent(document, "mousemove", tableMouseOver);
        cal._hideCombos();
        _C = null;
        return stopEvent(ev);
    }
};

Calendar.tableMouseOver = function (ev) {
    var cal = Calendar._C;
    if (!cal) {
        return;
    }
    var el = cal.activeDiv;
    var target = Calendar.getTargetElement(ev);
    if (target == el || target.parentNode == el) {
        Calendar.addClass(el, "hilite active");
        Calendar.addClass(el.parentNode, "rowhilite");
    } else {
        if (typeof el.navtype == "undefined" || (el.navtype != 50 && (el.navtype == 0 || Math.abs(el.navtype) > 2)))
            Calendar.removeClass(el, "active");
        Calendar.removeClass(el, "hilite");
        Calendar.removeClass(el.parentNode, "rowhilite");
    }
    ev || (ev = window.event);
    if (el.navtype == 50 && target != el) {
        var pos = Calendar.getAbsolutePos(el);
        var w = el.offsetWidth;
        var x = ev.clientX;
        var dx;
        var decrease = true;
        if (x > pos.x + w) {
            dx = x - pos.x - w;
            decrease = false;
        } else
            dx = pos.x - x;

        if (dx < 0) dx = 0;
        var range = el._range;
        var current = el._current;
        var count = Math.floor(dx / 10) % range.length;
        for (var i = range.length; --i >= 0;)
            if (range[i] == current)
                break;
        while (count-- > 0)
            if (decrease) {
                if (--i < 0)
                    i = range.length - 1;
            } else if ( ++i >= range.length )
                i = 0;
        var newval = range[i];
        el.innerHTML = newval;

        cal.onUpdateTime();
    }
    var mon = Calendar.findMonth(target);
    if (mon) {
        if (mon.month != cal.date.getMonth()) {
            if (cal.hilitedMonth) {
                Calendar.removeClass(cal.hilitedMonth, "hilite");
            }
            Calendar.addClass(mon, "hilite");
            cal.hilitedMonth = mon;
        } else if (cal.hilitedMonth) {
            Calendar.removeClass(cal.hilitedMonth, "hilite");
        }
    } else {
        if (cal.hilitedMonth) {
            Calendar.removeClass(cal.hilitedMonth, "hilite");
        }
        var year = Calendar.findYear(target);
        if (year) {
            if (year.year != cal.date.getFullYear()) {
                if (cal.hilitedYear) {
                    Calendar.removeClass(cal.hilitedYear, "hilite");
                }
                Calendar.addClass(year, "hilite");
                cal.hilitedYear = year;
            } else if (cal.hilitedYear) {
                Calendar.removeClass(cal.hilitedYear, "hilite");
            }
        } else if (cal.hilitedYear) {
            Calendar.removeClass(cal.hilitedYear, "hilite");
        }
    }
    return Calendar.stopEvent(ev);
};

Calendar.tableMouseDown = function (ev) {
    if (Calendar.getTargetElement(ev) == Calendar.getElement(ev)) {
        return Calendar.stopEvent(ev);
    }
};

Calendar.calDragIt = function (ev) {
    var cal = Calendar._C;
    if (!(cal && cal.dragging)) {
        return false;
    }
    var posX;
    var posY;
    if (Calendar.is_ie) {
        posY = window.event.clientY + document.body.scrollTop;
        posX = window.event.clientX + document.body.scrollLeft;
    } else {
        posX = ev.pageX;
        posY = ev.pageY;
    }
    cal.hideShowCovered();
    var st = cal.element.style;
    st.left = (posX - cal.xOffs) + "px";
    st.top = (posY - cal.yOffs) + "px";
    return Calendar.stopEvent(ev);
};

Calendar.calDragEnd = function (ev) {
    var cal = Calendar._C;
    if (!cal) {
        return false;
    }
    cal.dragging = false;
    with (Calendar) {
        removeEvent(document, "mousemove", calDragIt);
        removeEvent(document, "mouseup", calDragEnd);
        tableMouseUp(ev);
    }
    cal.hideShowCovered();
};

Calendar.dayMouseDown = function(ev) {
    var el = Calendar.getElement(ev);
    if (el.disabled) {
        return false;
    }
    var cal = el.calendar;
    cal.activeDiv = el;
    Calendar._C = cal;
    if (el.navtype != 300) with (Calendar) {
        if (el.navtype == 50) {
            el._current = el.innerHTML;
            addEvent(document, "mousemove", tableMouseOver);
        } else
            addEvent(document, Calendar.is_ie5 ? "mousemove" : "mouseover", tableMouseOver);
        addClass(el, "hilite active");
        addEvent(document, "mouseup", tableMouseUp);
    } else if (cal.isPopup) {
        cal._dragStart(ev);
    }
    if (el.navtype == -1 || el.navtype == 1) {
        if (cal.timeout) clearTimeout(cal.timeout);
        cal.timeout = setTimeout("Calendar.showMonthsCombo()", 250);
    } else if (el.navtype == -2 || el.navtype == 2) {
        if (cal.timeout) clearTimeout(cal.timeout);
        cal.timeout = setTimeout((el.navtype > 0) ? "Calendar.showYearsCombo(true)" : "Calendar.showYearsCombo(false)", 250);
    } else {
        cal.timeout = null;
    }
    return Calendar.stopEvent(ev);
};

Calendar.dayMouseDblClick = function(ev) {
    Calendar.cellClick(Calendar.getElement(ev), ev || window.event);
    if (Calendar.is_ie) {
        document.selection.empty();
    }
};

Calendar.dayMouseOver = function(ev) {
    var el = Calendar.getElement(ev);
    if (Calendar.isRelated(el, ev) || Calendar._C || el.disabled) {
        return false;
    }
    if (el.ttip) {
        if (el.ttip.substr(0, 1) == "_") {
            el.ttip = el.caldate.print(el.calendar.ttDateFormat) + el.ttip.substr(1);
        }
        el.calendar.tooltips.innerHTML = el.ttip;
    }
    if (el.navtype != 300) {
        Calendar.addClass(el, "hilite");
        if (el.caldate) {
            Calendar.addClass(el.parentNode, "rowhilite");
        }
    }
    return Calendar.stopEvent(ev);
};

Calendar.dayMouseOut = function(ev) {
    with (Calendar) {
        var el = getElement(ev);
        if (isRelated(el, ev) || _C || el.disabled)
            return false;
        removeClass(el, "hilite");
        if (el.caldate)
            removeClass(el.parentNode, "rowhilite");
        if (el.calendar)
            el.calendar.tooltips.innerHTML = _TT["SEL_DATE"];
        return stopEvent(ev);
    }
};

/**
 *  A generic "click" handler :) handles all types of buttons defined in this
 *  calendar.
 */
Calendar.cellClick = function(el, ev) {
    var cal = el.calendar;
    var closing = false;
    var newdate = false;
    var date = null;
    if (typeof el.navtype == "undefined") {
        if (cal.currentDateEl) {
            Calendar.removeClass(cal.currentDateEl, "selected");
            Calendar.addClass(el, "selected");
            closing = (cal.currentDateEl == el);
            if (!closing) {
                cal.currentDateEl = el;
            }
        }
        cal.date.setDateOnly(el.caldate);
        date = cal.date;
        var other_month = !(cal.dateClicked = !el.otherMonth);
        if (!other_month && !cal.currentDateEl)
            cal._toggleMultipleDate(new CalendarDateObject(date));
        else
            newdate = !el.disabled;
        // a date was clicked
        if (other_month)
            cal._init(cal.firstDayOfWeek, date);
    } else {
        if (el.navtype == 200) {
            Calendar.removeClass(el, "hilite");
            cal.callCloseHandler();
            return;
        }
        date = new CalendarDateObject(cal.date);
        if (el.navtype == 0)
            date.setDateOnly(new CalendarDateObject()); // TODAY
        // unless "today" was clicked, we assume no date was clicked so
        // the selected handler will know not to close the calenar when
        // in single-click mode.
        // cal.dateClicked = (el.navtype == 0);
        cal.dateClicked = false;
        var year = date.getFullYear();
        var mon = date.getMonth();
        function setMonth(m) {
            var day = date.getDate();
            var max = date.getMonthDays(m);
            if (day > max) {
                date.setDate(max);
            }
            date.setMonth(m);
        };
        switch (el.navtype) {
            case 400:
            Calendar.removeClass(el, "hilite");
            var text = Calendar._TT["ABOUT"];
            if (typeof text != "undefined") {
                text += cal.showsTime ? Calendar._TT["ABOUT_TIME"] : "";
            } else {
                // FIXME: this should be removed as soon as lang files get updated!
                text = "Help and about box text is not translated into this language.\n" +
                    "If you know this language and you feel generous please update\n" +
                    "the corresponding file in \"lang\" subdir to match calendar-en.js\n" +
                    "and send it back to <mihai_bazon@yahoo.com> to get it into the distribution  ;-)\n\n" +
                    "Thank you!\n" +
                    "http://dynarch.com/mishoo/calendar.epl\n";
            }
            alert(text);
            return;
            case -2:
            if (year > cal.minYear) {
                date.setFullYear(year - 1);
            }
            break;
            case -1:
            if (mon > 0) {
                setMonth(mon - 1);
            } else if (year-- > cal.minYear) {
                date.setFullYear(year);
                setMonth(11);
            }
            break;
            case 1:
            if (mon < 11) {
                setMonth(mon + 1);
            } else if (year < cal.maxYear) {
                date.setFullYear(year + 1);
                setMonth(0);
            }
            break;
            case 2:
            if (year < cal.maxYear) {
                date.setFullYear(year + 1);
            }
            break;
            case 100:
            cal.setFirstDayOfWeek(el.fdow);
            return;
            case 50:
            var range = el._range;
            var current = el.innerHTML;
            for (var i = range.length; --i >= 0;)
                if (range[i] == current)
                    break;
            if (ev && ev.shiftKey) {
                if (--i < 0)
                    i = range.length - 1;
            } else if ( ++i >= range.length )
                i = 0;
            var newval = range[i];
            el.innerHTML = newval;
            cal.onUpdateTime();
            return;
            case 0:
            // TODAY will bring us here
            if ((typeof cal.getDateStatus == "function") &&
                cal.getDateStatus(date, date.getFullYear(), date.getMonth(), date.getDate())) {
                return false;
            }
            break;
        }
        if (!date.equalsTo(cal.date)) {
            cal.setDate(date);
            newdate = true;
        } else if (el.navtype == 0)
            newdate = closing = true;
    }
    if (newdate) {
        ev && cal.callHandler();
    }
    if (closing) {
        Calendar.removeClass(el, "hilite");
        ev && cal.callCloseHandler();
    }
};

// END: CALENDAR STATIC FUNCTIONS

// BEGIN: CALENDAR OBJECT FUNCTIONS

/**
 *  This function creates the calendar inside the given parent.  If _par is
 *  null than it creates a popup calendar inside the BODY element.  If _par is
 *  an element, be it BODY, then it creates a non-popup calendar (still
 *  hidden).  Some properties need to be set before calling this function.
 */
Calendar.prototype.create = function (_par) {
    var parent = null;
    if (! _par) {
        // default parent is the document body, in which case we create
        // a popup calendar.
        parent = document.getElementsByTagName("body")[0];
        this.isPopup = true;
    } else {
        parent = _par;
        this.isPopup = false;
    }
    this.date = this.dateStr ? new CalendarDateObject(this.dateStr) : new CalendarDateObject();

    var table = Calendar.createElement("table");
    this.table = table;
    table.cellSpacing = 0;
    table.cellPadding = 0;
    table.calendar = this;
    Calendar.addEvent(table, "mousedown", Calendar.tableMouseDown);

    var div = Calendar.createElement("div");
    this.element = div;
    div.className = "calendar";
    if (this.isPopup) {
        div.style.position = "absolute";
        div.style.display = "none";
    }
    div.appendChild(table);

    var thead = Calendar.createElement("thead", table);
    var cell = null;
    var row = null;

    var cal = this;
    var hh = function (text, cs, navtype) {
        cell = Calendar.createElement("td", row);
        cell.colSpan = cs;
        cell.className = "button";
        if (navtype != 0 && Math.abs(navtype) <= 2)
            cell.className += " nav";
        Calendar._add_evs(cell);
        cell.calendar = cal;
        cell.navtype = navtype;
        cell.innerHTML = "<div unselectable='on'>" + text + "</div>";
        return cell;
    };

    row = Calendar.createElement("tr", thead);
    var title_length = 6;
    (this.isPopup) && --title_length;
    (this.weekNumbers) && ++title_length;

    hh("?", 1, 400).ttip = Calendar._TT["INFO"];
    this.title = hh("", title_length, 300);
    this.title.className = "title";
    if (this.isPopup) {
        this.title.ttip = Calendar._TT["DRAG_TO_MOVE"];
        this.title.style.cursor = "move";
        hh("&#x00d7;", 1, 200).ttip = Calendar._TT["CLOSE"];
    }

    row = Calendar.createElement("tr", thead);
    row.className = "headrow";

    this._nav_py = hh("&#x00ab;", 1, -2);
    this._nav_py.ttip = Calendar._TT["PREV_YEAR"];

    this._nav_pm = hh("&#x2039;", 1, -1);
    this._nav_pm.ttip = Calendar._TT["PREV_MONTH"];

    this._nav_now = hh(Calendar._TT["TODAY"], this.weekNumbers ? 4 : 3, 0);
    this._nav_now.ttip = Calendar._TT["GO_TODAY"];

    this._nav_nm = hh("&#x203a;", 1, 1);
    this._nav_nm.ttip = Calendar._TT["NEXT_MONTH"];

    this._nav_ny = hh("&#x00bb;", 1, 2);
    this._nav_ny.ttip = Calendar._TT["NEXT_YEAR"];

    // day names
    row = Calendar.createElement("tr", thead);
    row.className = "daynames";
    if (this.weekNumbers) {
        cell = Calendar.createElement("td", row);
        cell.className = "name wn";
        cell.innerHTML = Calendar._TT["WK"];
    }
    for (var i = 7; i > 0; --i) {
        cell = Calendar.createElement("td", row);
        if (!i) {
            cell.navtype = 100;
            cell.calendar = this;
            Calendar._add_evs(cell);
        }
    }
    this.firstdayname = (this.weekNumbers) ? row.firstChild.nextSibling : row.firstChild;
    this._displayWeekdays();

    var tbody = Calendar.createElement("tbody", table);
    this.tbody = tbody;

    for (i = 6; i > 0; --i) {
        row = Calendar.createElement("tr", tbody);
        if (this.weekNumbers) {
            cell = Calendar.createElement("td", row);
        }
        for (var j = 7; j > 0; --j) {
            cell = Calendar.createElement("td", row);
            cell.calendar = this;
            Calendar._add_evs(cell);
        }
    }

    if (this.showsTime) {
        row = Calendar.createElement("tr", tbody);
        row.className = "time";

        cell = Calendar.createElement("td", row);
        cell.className = "time";
        cell.colSpan = 2;
        cell.innerHTML = Calendar._TT["TIME"] || "&nbsp;";

        cell = Calendar.createElement("td", row);
        cell.className = "time";
        cell.colSpan = this.weekNumbers ? 4 : 3;

        (function(){
            function makeTimePart(className, init, range_start, range_end) {
                var part = Calendar.createElement("span", cell);
                part.className = className;
                part.innerHTML = init;
                part.calendar = cal;
                part.ttip = Calendar._TT["TIME_PART"];
                part.navtype = 50;
                part._range = [];
                if (typeof range_start != "number")
                    part._range = range_start;
                else {
                    for (var i = range_start; i <= range_end; ++i) {
                        var txt;
                        if (i < 10 && range_end >= 10) txt = '0' + i;
                        else txt = '' + i;
                        part._range[part._range.length] = txt;
                    }
                }
                Calendar._add_evs(part);
                return part;
            };
            var hrs = cal.date.getHours();
            var mins = cal.date.getMinutes();
            var t12 = !cal.time24;
            var pm = (hrs > 12);
            if (t12 && pm) hrs -= 12;
            var H = makeTimePart("hour", hrs, t12 ? 1 : 0, t12 ? 12 : 23);
            var span = Calendar.createElement("span", cell);
            span.innerHTML = ":";
            span.className = "colon";
            var M = makeTimePart("minute", mins, 0, 59);
            var AP = null;
            cell = Calendar.createElement("td", row);
            cell.className = "time";
            cell.colSpan = 2;
            if (t12)
                AP = makeTimePart("ampm", pm ? "pm" : "am", ["am", "pm"]);
            else
                cell.innerHTML = "&nbsp;";

            cal.onSetTime = function() {
                var pm, hrs = this.date.getHours(),
                    mins = this.date.getMinutes();
                if (t12) {
                    pm = (hrs >= 12);
                    if (pm) hrs -= 12;
                    if (hrs == 0) hrs = 12;
                    AP.innerHTML = pm ? "pm" : "am";
                }
                H.innerHTML = (hrs < 10) ? ("0" + hrs) : hrs;
                M.innerHTML = (mins < 10) ? ("0" + mins) : mins;
            };

            cal.onUpdateTime = function() {
                var date = this.date;
                var h = parseInt(H.innerHTML, 10);
                if (t12) {
                    if (/pm/i.test(AP.innerHTML) && h < 12)
                        h += 12;
                    else if (/am/i.test(AP.innerHTML) && h == 12)
                        h = 0;
                }
                var d = date.getDate();
                var m = date.getMonth();
                var y = date.getFullYear();
                date.setHours(h);
                date.setMinutes(parseInt(M.innerHTML, 10));
                date.setFullYear(y);
                date.setMonth(m);
                date.setDate(d);
                this.dateClicked = false;
                this.callHandler();
            };
        })();
    } else {
        this.onSetTime = this.onUpdateTime = function() {};
    }

    var tfoot = Calendar.createElement("tfoot", table);

    row = Calendar.createElement("tr", tfoot);
    row.className = "footrow";

    cell = hh(Calendar._TT["SEL_DATE"], this.weekNumbers ? 8 : 7, 300);
    cell.className = "ttip";
    if (this.isPopup) {
        cell.ttip = Calendar._TT["DRAG_TO_MOVE"];
        cell.style.cursor = "move";
    }
    this.tooltips = cell;

    div = Calendar.createElement("div", this.element);
    this.monthsCombo = div;
    div.className = "combo";
    for (i = 0; i < Calendar._MN.length; ++i) {
        var mn = Calendar.createElement("div");
        mn.className = Calendar.is_ie ? "label-IEfix" : "label";
        mn.month = i;
        mn.innerHTML = Calendar._SMN[i];
        div.appendChild(mn);
    }

    div = Calendar.createElement("div", this.element);
    this.yearsCombo = div;
    div.className = "combo";
    for (i = 12; i > 0; --i) {
        var yr = Calendar.createElement("div");
        yr.className = Calendar.is_ie ? "label-IEfix" : "label";
        div.appendChild(yr);
    }

    this._init(this.firstDayOfWeek, this.date);
    parent.appendChild(this.element);
};

/** keyboard navigation, only for popup calendars */
Calendar._keyEvent = function(ev) {
    var cal = window._dynarch_popupCalendar;
    if (!cal || cal.multiple)
        return false;
    (Calendar.is_ie) && (ev = window.event);
    var act = (Calendar.is_ie || ev.type == "keypress"),
        K = ev.keyCode;
    if (ev.ctrlKey) {
        switch (K) {
            case 37: // KEY left
            act && Calendar.cellClick(cal._nav_pm);
            break;
            case 38: // KEY up
            act && Calendar.cellClick(cal._nav_py);
            break;
            case 39: // KEY right
            act && Calendar.cellClick(cal._nav_nm);
            break;
            case 40: // KEY down
            act && Calendar.cellClick(cal._nav_ny);
            break;
            default:
            return false;
        }
    } else switch (K) {
        case 32: // KEY space (now)
        Calendar.cellClick(cal._nav_now);
        break;
        case 27: // KEY esc
        act && cal.callCloseHandler();
        break;
        case 37: // KEY left
        case 38: // KEY up
        case 39: // KEY right
        case 40: // KEY down
        if (act) {
            var prev, x, y, ne, el, step;
            prev = K == 37 || K == 38;
            step = (K == 37 || K == 39) ? 1 : 7;
            function setVars() {
                el = cal.currentDateEl;
                var p = el.pos;
                x = p & 15;
                y = p >> 4;
                ne = cal.ar_days[y][x];
            };setVars();
            function prevMonth() {
                var date = new CalendarDateObject(cal.date);
                date.setDate(date.getDate() - step);
                cal.setDate(date);
            };
            function nextMonth() {
                var date = new CalendarDateObject(cal.date);
                date.setDate(date.getDate() + step);
                cal.setDate(date);
            };
            while (1) {
                switch (K) {
                    case 37: // KEY left
                    if (--x >= 0)
                        ne = cal.ar_days[y][x];
                    else {
                        x = 6;
                        K = 38;
                        continue;
                    }
                    break;
                    case 38: // KEY up
                    if (--y >= 0)
                        ne = cal.ar_days[y][x];
                    else {
                        prevMonth();
                        setVars();
                    }
                    break;
                    case 39: // KEY right
                    if (++x < 7)
                        ne = cal.ar_days[y][x];
                    else {
                        x = 0;
                        K = 40;
                        continue;
                    }
                    break;
                    case 40: // KEY down
                    if (++y < cal.ar_days.length)
                        ne = cal.ar_days[y][x];
                    else {
                        nextMonth();
                        setVars();
                    }
                    break;
                }
                break;
            }
            if (ne) {
                if (!ne.disabled)
                    Calendar.cellClick(ne);
                else if (prev)
                    prevMonth();
                else
                    nextMonth();
            }
        }
        break;
        case 13: // KEY enter
        if (act)
            Calendar.cellClick(cal.currentDateEl, ev);
        break;
        default:
        return false;
    }
    return Calendar.stopEvent(ev);
};

/**
 *  (RE)Initializes the calendar to the given date and firstDayOfWeek
 */
Calendar.prototype._init = function (firstDayOfWeek, date) {
    var today = new CalendarDateObject(),
        TY = today.getFullYear(),
        TM = today.getMonth(),
        TD = today.getDate();
    this.table.style.visibility = "hidden";
    var year = date.getFullYear();
    if (year < this.minYear) {
        year = this.minYear;
        date.setFullYear(year);
    } else if (year > this.maxYear) {
        year = this.maxYear;
        date.setFullYear(year);
    }
    this.firstDayOfWeek = firstDayOfWeek;
    this.date = new CalendarDateObject(date);
    var month = date.getMonth();
    var mday = date.getDate();
    var no_days = date.getMonthDays();

    // calendar voodoo for computing the first day that would actually be
    // displayed in the calendar, even if it's from the previous month.
    // WARNING: this is magic. ;-)
    date.setDate(1);
    var day1 = (date.getDay() - this.firstDayOfWeek) % 7;
    if (day1 < 0)
        day1 += 7;
    date.setDate(-day1);
    date.setDate(date.getDate() + 1);

    var row = this.tbody.firstChild;
    var MN = Calendar._SMN[month];
    var ar_days = this.ar_days = new Array();
    var weekend = Calendar._TT["WEEKEND"];
    var dates = this.multiple ? (this.datesCells = {}) : null;
    for (var i = 0; i < 6; ++i, row = row.nextSibling) {
        var cell = row.firstChild;
        if (this.weekNumbers) {
            cell.className = "day wn";
            cell.innerHTML = date.getWeekNumber();
            cell = cell.nextSibling;
        }
        row.className = "daysrow";
        var hasdays = false, iday, dpos = ar_days[i] = [];
        for (var j = 0; j < 7; ++j, cell = cell.nextSibling, date.setDate(iday + 1)) {
            iday = date.getDate();
            var wday = date.getDay();
            cell.className = "day";
            cell.pos = i << 4 | j;
            dpos[j] = cell;
            var current_month = (date.getMonth() == month);
            if (!current_month) {
                if (this.showsOtherMonths) {
                    cell.className += " othermonth";
                    cell.otherMonth = true;
                } else {
                    cell.className = "emptycell";
                    cell.innerHTML = "&nbsp;";
                    cell.disabled = true;
                    continue;
                }
            } else {
                cell.otherMonth = false;
                hasdays = true;
            }
            cell.disabled = false;
            cell.innerHTML = this.getDateText ? this.getDateText(date, iday) : iday;
            if (dates)
                dates[date.print("%Y%m%d")] = cell;
            if (this.getDateStatus) {
                var status = this.getDateStatus(date, year, month, iday);
                if (this.getDateToolTip) {
                    var toolTip = this.getDateToolTip(date, year, month, iday);
                    if (toolTip)
                        cell.title = toolTip;
                }
                if (status === true) {
                    cell.className += " disabled";
                    cell.disabled = true;
                } else {
                    if (/disabled/i.test(status))
                        cell.disabled = true;
                    cell.className += " " + status;
                }
            }
            if (!cell.disabled) {
                cell.caldate = new CalendarDateObject(date);
                cell.ttip = "_";
                if (!this.multiple && current_month
                    && iday == mday && this.hiliteToday) {
                    cell.className += " selected";
                    this.currentDateEl = cell;
                }
                if (date.getFullYear() == TY &&
                    date.getMonth() == TM &&
                    iday == TD) {
                    cell.className += " today";
                    cell.ttip += Calendar._TT["PART_TODAY"];
                }
                if (weekend.indexOf(wday.toString()) != -1)
                    cell.className += cell.otherMonth ? " oweekend" : " weekend";
            }
        }
        if (!(hasdays || this.showsOtherMonths))
            row.className = "emptyrow";
    }
    this.title.innerHTML = Calendar._MN[month] + ", " + year;
    this.onSetTime();
    this.table.style.visibility = "visible";
    this._initMultipleDates();
    // PROFILE
    // this.tooltips.innerHTML = "Generated in " + ((new CalendarDateObject()) - today) + " ms";
};

Calendar.prototype._initMultipleDates = function() {
    if (this.multiple) {
        for (var i in this.multiple) {
            var cell = this.datesCells[i];
            var d = this.multiple[i];
            if (!d)
                continue;
            if (cell)
                cell.className += " selected";
        }
    }
};

Calendar.prototype._toggleMultipleDate = function(date) {
    if (this.multiple) {
        var ds = date.print("%Y%m%d");
        var cell = this.datesCells[ds];
        if (cell) {
            var d = this.multiple[ds];
            if (!d) {
                Calendar.addClass(cell, "selected");
                this.multiple[ds] = date;
            } else {
                Calendar.removeClass(cell, "selected");
                delete this.multiple[ds];
            }
        }
    }
};

Calendar.prototype.setDateToolTipHandler = function (unaryFunction) {
    this.getDateToolTip = unaryFunction;
};

/**
 *  Calls _init function above for going to a certain date (but only if the
 *  date is different than the currently selected one).
 */
Calendar.prototype.setDate = function (date) {
    if (!date.equalsTo(this.date)) {
        this._init(this.firstDayOfWeek, date);
    }
};

/**
 *  Refreshes the calendar.  Useful if the "disabledHandler" function is
 *  dynamic, meaning that the list of disabled date can change at runtime.
 *  Just * call this function if you think that the list of disabled dates
 *  should * change.
 */
Calendar.prototype.refresh = function () {
    this._init(this.firstDayOfWeek, this.date);
};

/** Modifies the "firstDayOfWeek" parameter (pass 0 for Synday, 1 for Monday, etc.). */
Calendar.prototype.setFirstDayOfWeek = function (firstDayOfWeek) {
    this._init(firstDayOfWeek, this.date);
    this._displayWeekdays();
};

/**
 *  Allows customization of what dates are enabled.  The "unaryFunction"
 *  parameter must be a function object that receives the date (as a JS Date
 *  object) and returns a boolean value.  If the returned value is true then
 *  the passed date will be marked as disabled.
 */
Calendar.prototype.setDateStatusHandler = Calendar.prototype.setDisabledHandler = function (unaryFunction) {
    this.getDateStatus = unaryFunction;
};

/** Customization of allowed year range for the calendar. */
Calendar.prototype.setRange = function (a, z) {
    this.minYear = a;
    this.maxYear = z;
};

/** Calls the first user handler (selectedHandler). */
Calendar.prototype.callHandler = function () {
    if (this.onSelected) {
        this.onSelected(this, this.date.print(this.dateFormat));
    }
};

/** Calls the second user handler (closeHandler). */
Calendar.prototype.callCloseHandler = function () {
    if (this.onClose) {
        this.onClose(this);
    }
    this.hideShowCovered();
};

/** Removes the calendar object from the DOM tree and destroys it. */
Calendar.prototype.destroy = function () {
    var el = this.element.parentNode;
    el.removeChild(this.element);
    Calendar._C = null;
    window._dynarch_popupCalendar = null;
};

/**
 *  Moves the calendar element to a different section in the DOM tree (changes
 *  its parent).
 */
Calendar.prototype.reparent = function (new_parent) {
    var el = this.element;
    el.parentNode.removeChild(el);
    new_parent.appendChild(el);
};

// This gets called when the user presses a mouse button anywhere in the
// document, if the calendar is shown.  If the click was outside the open
// calendar this function closes it.
Calendar._checkCalendar = function(ev) {
    var calendar = window._dynarch_popupCalendar;
    if (!calendar) {
        return false;
    }
    var el = Calendar.is_ie ? Calendar.getElement(ev) : Calendar.getTargetElement(ev);
    for (; el != null && el != calendar.element; el = el.parentNode);
    if (el == null) {
        // calls closeHandler which should hide the calendar.
        window._dynarch_popupCalendar.callCloseHandler();
        return Calendar.stopEvent(ev);
    }
};

/** Shows the calendar. */
Calendar.prototype.show = function () {
    var rows = this.table.getElementsByTagName("tr");
    for (var i = rows.length; i > 0;) {
        var row = rows[--i];
        Calendar.removeClass(row, "rowhilite");
        var cells = row.getElementsByTagName("td");
        for (var j = cells.length; j > 0;) {
            var cell = cells[--j];
            Calendar.removeClass(cell, "hilite");
            Calendar.removeClass(cell, "active");
        }
    }
    this.element.style.display = "block";
    this.hidden = false;
    if (this.isPopup) {
        window._dynarch_popupCalendar = this;
        Calendar.addEvent(document, "keydown", Calendar._keyEvent);
        Calendar.addEvent(document, "keypress", Calendar._keyEvent);
        Calendar.addEvent(document, "mousedown", Calendar._checkCalendar);
    }
    this.hideShowCovered();
};

/**
 *  Hides the calendar.  Also removes any "hilite" from the class of any TD
 *  element.
 */
Calendar.prototype.hide = function () {
    if (this.isPopup) {
        Calendar.removeEvent(document, "keydown", Calendar._keyEvent);
        Calendar.removeEvent(document, "keypress", Calendar._keyEvent);
        Calendar.removeEvent(document, "mousedown", Calendar._checkCalendar);
    }
    this.element.style.display = "none";
    this.hidden = true;
    this.hideShowCovered();
};

/**
 *  Shows the calendar at a given absolute position (beware that, depending on
 *  the calendar element style -- position property -- this might be relative
 *  to the parent's containing rectangle).
 */
Calendar.prototype.showAt = function (x, y) {
    var s = this.element.style;
    s.left = x + "px";
    s.top = y + "px";
    this.show();
};

/** Shows the calendar near a given element. */
Calendar.prototype.showAtElement = function (el, opts) {
    var self = this;
    var p = Calendar.getAbsolutePos(el);
    if (!opts || typeof opts != "string") {
        this.showAt(p.x, p.y + el.offsetHeight);
        return true;
    }
    function fixPosition(box) {
        if (box.x < 0)
            box.x = 0;
        if (box.y < 0)
            box.y = 0;
        var cp = document.createElement("div");
        var s = cp.style;
        s.position = "absolute";
        s.right = s.bottom = s.width = s.height = "0px";
        document.body.appendChild(cp);
        var br = Calendar.getAbsolutePos(cp);
        document.body.removeChild(cp);
        if (Calendar.is_ie) {
            br.y += document.documentElement.scrollTop;
            br.x += document.documentElement.scrollLeft;
        } else {
            br.y += window.scrollY;
            br.x += window.scrollX;
        }
        var tmp = box.x + box.width - br.x;
        if (tmp > 0) box.x -= tmp;
        tmp = box.y + box.height - br.y;
        if (tmp > 0) box.y -= tmp;
    };
    this.element.style.display = "block";
    Calendar.continuation_for_the_fucking_khtml_browser = function() {
        var w = self.element.offsetWidth;
        var h = self.element.offsetHeight;
        self.element.style.display = "none";
        var valign = opts.substr(0, 1);
        var halign = "l";
        if (opts.length > 1) {
            halign = opts.substr(1, 1);
        }
        // vertical alignment
        switch (valign) {
            case "T": p.y -= h; break;
            case "B": p.y += el.offsetHeight; break;
            case "C": p.y += (el.offsetHeight - h) / 2; break;
            case "t": p.y += el.offsetHeight - h; break;
            case "b": break; // already there
        }
        // horizontal alignment
        switch (halign) {
            case "L": p.x -= w; break;
            case "R": p.x += el.offsetWidth; break;
            case "C": p.x += (el.offsetWidth - w) / 2; break;
            case "l": p.x += el.offsetWidth - w; break;
            case "r": break; // already there
        }
        p.width = w;
        p.height = h + 40;
        self.monthsCombo.style.display = "none";
        fixPosition(p);
        self.showAt(p.x, p.y);
    };
    if (Calendar.is_khtml)
        setTimeout("Calendar.continuation_for_the_fucking_khtml_browser()", 10);
    else
        Calendar.continuation_for_the_fucking_khtml_browser();
};

/** Customizes the date format. */
Calendar.prototype.setDateFormat = function (str) {
    this.dateFormat = str;
};

/** Customizes the tooltip date format. */
Calendar.prototype.setTtDateFormat = function (str) {
    this.ttDateFormat = str;
};

/**
 *  Tries to identify the date represented in a string.  If successful it also
 *  calls this.setDate which moves the calendar to the given date.
 */
Calendar.prototype.parseDate = function(str, fmt) {
    if (!fmt)
        fmt = this.dateFormat;
    this.setDate(Date.parseDate(str, fmt));
};

Calendar.prototype.hideShowCovered = function () {
    if (!Calendar.is_ie && !Calendar.is_opera)
        return;
    function getVisib(obj){
        var value = obj.style.visibility;
        if (!value) {
            if (document.defaultView && typeof (document.defaultView.getComputedStyle) == "function") { // Gecko, W3C
                if (!Calendar.is_khtml)
                    value = document.defaultView.
                        getComputedStyle(obj, "").getPropertyValue("visibility");
                else
                    value = '';
            } else if (obj.currentStyle) { // IE
                value = obj.currentStyle.visibility;
            } else
                value = '';
        }
        return value;
    };

    var tags = new Array("applet", "iframe", "select");
    var el = this.element;

    var p = Calendar.getAbsolutePos(el);
    var EX1 = p.x;
    var EX2 = el.offsetWidth + EX1;
    var EY1 = p.y;
    var EY2 = el.offsetHeight + EY1;

    for (var k = tags.length; k > 0; ) {
        var ar = document.getElementsByTagName(tags[--k]);
        var cc = null;

        for (var i = ar.length; i > 0;) {
            cc = ar[--i];

            p = Calendar.getAbsolutePos(cc);
            var CX1 = p.x;
            var CX2 = cc.offsetWidth + CX1;
            var CY1 = p.y;
            var CY2 = cc.offsetHeight + CY1;

            if (this.hidden || (CX1 > EX2) || (CX2 < EX1) || (CY1 > EY2) || (CY2 < EY1)) {
                if (!cc.__msh_save_visibility) {
                    cc.__msh_save_visibility = getVisib(cc);
                }
                cc.style.visibility = cc.__msh_save_visibility;
            } else {
                if (!cc.__msh_save_visibility) {
                    cc.__msh_save_visibility = getVisib(cc);
                }
                cc.style.visibility = "hidden";
            }
        }
    }
};

/** Internal function; it displays the bar with the names of the weekday. */
Calendar.prototype._displayWeekdays = function () {
    var fdow = this.firstDayOfWeek;
    var cell = this.firstdayname;
    var weekend = Calendar._TT["WEEKEND"];
    for (var i = 0; i < 7; ++i) {
        cell.className = "day name";
        var realday = (i + fdow) % 7;
        if (i) {
            cell.ttip = Calendar._TT["DAY_FIRST"].replace("%s", Calendar._DN[realday]);
            cell.navtype = 100;
            cell.calendar = this;
            cell.fdow = realday;
            Calendar._add_evs(cell);
        }
        if (weekend.indexOf(realday.toString()) != -1) {
            Calendar.addClass(cell, "weekend");
        }
        cell.innerHTML = Calendar._SDN[(i + fdow) % 7];
        cell = cell.nextSibling;
    }
};

/** Internal function.  Hides all combo boxes that might be displayed. */
Calendar.prototype._hideCombos = function () {
    this.monthsCombo.style.display = "none";
    this.yearsCombo.style.display = "none";
};

/** Internal function.  Starts dragging the element. */
Calendar.prototype._dragStart = function (ev) {
    if (this.dragging) {
        return;
    }
    this.dragging = true;
    var posX;
    var posY;
    if (Calendar.is_ie) {
        posY = window.event.clientY + document.body.scrollTop;
        posX = window.event.clientX + document.body.scrollLeft;
    } else {
        posY = ev.clientY + window.scrollY;
        posX = ev.clientX + window.scrollX;
    }
    var st = this.element.style;
    this.xOffs = posX - parseInt(st.left);
    this.yOffs = posY - parseInt(st.top);
    with (Calendar) {
        addEvent(document, "mousemove", calDragIt);
        addEvent(document, "mouseup", calDragEnd);
    }
};

// BEGIN: DATE OBJECT PATCHES

/** Adds the number of days array to the Date object. */
Date._MD = new Array(31,28,31,30,31,30,31,31,30,31,30,31);

/** Constants used for time computations */
Date.SECOND = 1000 /* milliseconds */;
Date.MINUTE = 60 * Date.SECOND;
Date.HOUR   = 60 * Date.MINUTE;
Date.DAY    = 24 * Date.HOUR;
Date.WEEK   =  7 * Date.DAY;

Date.parseDate = function(str, fmt) {
    var today = new CalendarDateObject();
    var y = 0;
    var m = -1;
    var d = 0;

    // translate date into en_US, because split() cannot parse non-latin stuff
    var a = str;
    var i;
    for (i = 0; i < Calendar._MN.length; i++) {
        a = a.replace(Calendar._MN[i], enUS.m.wide[i]);
    }
    for (i = 0; i < Calendar._SMN.length; i++) {
        a = a.replace(Calendar._SMN[i], enUS.m.abbr[i]);
    }
    a = a.replace(Calendar._am, 'am');
    a = a.replace(Calendar._am.toLowerCase(), 'am');
    a = a.replace(Calendar._pm, 'pm');
    a = a.replace(Calendar._pm.toLowerCase(), 'pm');

    a = a.split(/\W+/);

    var b = fmt.match(/%./g);
    var i = 0, j = 0;
    var hr = 0;
    var min = 0;
    for (i = 0; i < a.length; ++i) {
        if (!a[i])
            continue;
        switch (b[i]) {
            case "%d":
            case "%e":
            d = parseInt(a[i], 10);
            break;

            case "%m":
            m = parseInt(a[i], 10) - 1;
            break;

            case "%Y":
            case "%y":
            y = parseInt(a[i], 10);
            (y < 100) && (y += (y > 29) ? 1900 : 2000);
            break;

            case "%b":
            for (j = 0; j < 12; ++j) {
                if (enUS.m.abbr[j].substr(0, a[i].length).toLowerCase() == a[i].toLowerCase()) { m = j; break; }
            }
            break;

            case "%B":
            for (j = 0; j < 12; ++j) {
                if (enUS.m.wide[j].substr(0, a[i].length).toLowerCase() == a[i].toLowerCase()) { m = j; break; }
            }
            break;

            case "%H":
            case "%I":
            case "%k":
            case "%l":
            hr = parseInt(a[i], 10);
            break;

            case "%P":
            case "%p":
            if (/pm/i.test(a[i]) && hr < 12)
                hr += 12;
            else if (/am/i.test(a[i]) && hr >= 12)
                hr -= 12;
            break;

            case "%M":
            min = parseInt(a[i], 10);
            break;
        }
    }
    if (isNaN(y)) y = today.getFullYear();
    if (isNaN(m)) m = today.getMonth();
    if (isNaN(d)) d = today.getDate();
    if (isNaN(hr)) hr = today.getHours();
    if (isNaN(min)) min = today.getMinutes();
    if (y != 0 && m != -1 && d != 0)
        return new CalendarDateObject(y, m, d, hr, min, 0);
    y = 0; m = -1; d = 0;
    for (i = 0; i < a.length; ++i) {
        if (a[i].search(/[a-zA-Z]+/) != -1) {
            var t = -1;
            for (j = 0; j < 12; ++j) {
                if (Calendar._MN[j].substr(0, a[i].length).toLowerCase() == a[i].toLowerCase()) { t = j; break; }
            }
            if (t != -1) {
                if (m != -1) {
                    d = m+1;
                }
                m = t;
            }
        } else if (parseInt(a[i], 10) <= 12 && m == -1) {
            m = a[i]-1;
        } else if (parseInt(a[i], 10) > 31 && y == 0) {
            y = parseInt(a[i], 10);
            (y < 100) && (y += (y > 29) ? 1900 : 2000);
        } else if (d == 0) {
            d = a[i];
        }
    }
    if (y == 0)
        y = today.getFullYear();
    if (m != -1 && d != 0)
        return new CalendarDateObject(y, m, d, hr, min, 0);
    return today;
};

/** Returns the number of days in the current month */
Date.prototype.getMonthDays = function(month) {
    var year = this.getFullYear();
    if (typeof month == "undefined") {
        month = this.getMonth();
    }
    if (((0 == (year%4)) && ( (0 != (year%100)) || (0 == (year%400)))) && month == 1) {
        return 29;
    } else {
        return Date._MD[month];
    }
};

/** Returns the number of day in the year. */
Date.prototype.getDayOfYear = function() {
    var now = new CalendarDateObject(this.getFullYear(), this.getMonth(), this.getDate(), 0, 0, 0);
    var then = new CalendarDateObject(this.getFullYear(), 0, 0, 0, 0, 0);
    var time = now - then;
    return Math.floor(time / Date.DAY);
};

/** Returns the number of the week in year, as defined in ISO 8601. */
Date.prototype.getWeekNumber = function() {
    var d = new CalendarDateObject(this.getFullYear(), this.getMonth(), this.getDate(), 0, 0, 0);
    var DoW = d.getDay();
    d.setDate(d.getDate() - (DoW + 6) % 7 + 3); // Nearest Thu
    var ms = d.valueOf(); // GMT
    d.setMonth(0);
    d.setDate(4); // Thu in Week 1
    return Math.round((ms - d.valueOf()) / (7 * 864e5)) + 1;
};

/** Checks date and time equality */
Date.prototype.equalsTo = function(date) {
    return ((this.getFullYear() == date.getFullYear()) &&
        (this.getMonth() == date.getMonth()) &&
        (this.getDate() == date.getDate()) &&
        (this.getHours() == date.getHours()) &&
        (this.getMinutes() == date.getMinutes()));
};

/** Set only the year, month, date parts (keep existing time) */
Date.prototype.setDateOnly = function(date) {
    var tmp = new CalendarDateObject(date);
    this.setDate(1);
    this.setFullYear(tmp.getFullYear());
    this.setMonth(tmp.getMonth());
    this.setDate(tmp.getDate());
};

/** Prints the date in a string according to the given format. */
Date.prototype.print = function (str) {
    var m = this.getMonth();
    var d = this.getDate();
    var y = this.getFullYear();
    var wn = this.getWeekNumber();
    var w = this.getDay();
    var s = {};
    var hr = this.getHours();
    var pm = (hr >= 12);
    var ir = (pm) ? (hr - 12) : hr;
    var dy = this.getDayOfYear();
    if (ir == 0)
        ir = 12;
    var min = this.getMinutes();
    var sec = this.getSeconds();
    s["%a"] = Calendar._SDN[w]; // abbreviated weekday name [FIXME: I18N]
    s["%A"] = Calendar._DN[w]; // full weekday name
    s["%b"] = Calendar._SMN[m]; // abbreviated month name [FIXME: I18N]
    s["%B"] = Calendar._MN[m]; // full month name
    // FIXME: %c : preferred date and time representation for the current locale
    s["%C"] = 1 + Math.floor(y / 100); // the century number
    s["%d"] = (d < 10) ? ("0" + d) : d; // the day of the month (range 01 to 31)
    s["%e"] = d; // the day of the month (range 1 to 31)
    // FIXME: %D : american date style: %m/%d/%y
    // FIXME: %E, %F, %G, %g, %h (man strftime)
    s["%H"] = (hr < 10) ? ("0" + hr) : hr; // hour, range 00 to 23 (24h format)
    s["%I"] = (ir < 10) ? ("0" + ir) : ir; // hour, range 01 to 12 (12h format)
    s["%j"] = (dy < 100) ? ((dy < 10) ? ("00" + dy) : ("0" + dy)) : dy; // day of the year (range 001 to 366)
    s["%k"] = hr;        // hour, range 0 to 23 (24h format)
    s["%l"] = ir;        // hour, range 1 to 12 (12h format)
    s["%m"] = (m < 9) ? ("0" + (1+m)) : (1+m); // month, range 01 to 12
    s["%M"] = (min < 10) ? ("0" + min) : min; // minute, range 00 to 59
    s["%n"] = "\n";        // a newline character
    s["%p"] = pm ? Calendar._pm.toUpperCase() : Calendar._am.toUpperCase();
    s["%P"] = pm ? Calendar._pm.toLowerCase() : Calendar._am.toLowerCase();
    // FIXME: %r : the time in am/pm notation %I:%M:%S %p
    // FIXME: %R : the time in 24-hour notation %H:%M
    s["%s"] = Math.floor(this.getTime() / 1000);
    s["%S"] = (sec < 10) ? ("0" + sec) : sec; // seconds, range 00 to 59
    s["%t"] = "\t";        // a tab character
    // FIXME: %T : the time in 24-hour notation (%H:%M:%S)
    s["%U"] = s["%W"] = s["%V"] = (wn < 10) ? ("0" + wn) : wn;
    s["%u"] = w + 1;    // the day of the week (range 1 to 7, 1 = MON)
    s["%w"] = w;        // the day of the week (range 0 to 6, 0 = SUN)
    // FIXME: %x : preferred date representation for the current locale without the time
    // FIXME: %X : preferred time representation for the current locale without the date
    s["%y"] = ('' + y).substr(2, 2); // year without the century (range 00 to 99)
    s["%Y"] = y;        // year with the century
    s["%%"] = "%";        // a literal '%' character

    var re = /%./g;
    if (!Calendar.is_ie5 && !Calendar.is_khtml)
        return str.replace(re, function (par) { return s[par] || par; });

    var a = str.match(re);
    for (var i = 0; i < a.length; i++) {
        var tmp = s[a[i]];
        if (tmp) {
            re = new RegExp(a[i], 'g');
            str = str.replace(re, tmp);
        }
    }

    return str;
};

Date.prototype.__msh_oldSetFullYear = Date.prototype.setFullYear;
Date.prototype.setFullYear = function(y) {
    var d = new CalendarDateObject(this);
    d.__msh_oldSetFullYear(y);
    if (d.getMonth() != this.getMonth())
        this.setDate(28);
    this.__msh_oldSetFullYear(y);
};

CalendarDateObject.prototype = new Date();
CalendarDateObject.prototype.constructor = CalendarDateObject;
CalendarDateObject.prototype.parent = Date.prototype;
function CalendarDateObject() {
    var dateObj;
    if (arguments.length > 1) {
        dateObj = eval("new this.parent.constructor("+Array.prototype.slice.call(arguments).join(",")+");");
    } else if (arguments.length > 0) {
        dateObj = new this.parent.constructor(arguments[0]);
    } else {
        dateObj = new this.parent.constructor();
        if (typeof(CalendarDateObject._SERVER_TIMZEONE_SECONDS) != "undefined") {
            dateObj.setTime((CalendarDateObject._SERVER_TIMZEONE_SECONDS + dateObj.getTimezoneOffset()*60)*1000);
        }
    }
    return dateObj;
}

// END: DATE OBJECT PATCHES


// global object that remembers the calendar
window._dynarch_popupCalendar = null;

/*  Copyright Mihai Bazon, 2002, 2003  |  http://dynarch.com/mishoo/
 * ---------------------------------------------------------------------------
 *
 * The DHTML Calendar
 *
 * Details and latest version at:
 * http://dynarch.com/mishoo/calendar.epl
 *
 * This script is distributed under the GNU Lesser General Public License.
 * Read the entire license text here: http://www.gnu.org/licenses/lgpl.html
 *
 * This file defines helper functions for setting up the calendar.  They are
 * intended to help non-programmers get a working calendar on their site
 * quickly.  This script should not be seen as part of the calendar.  It just
 * shows you what one can do with the calendar, while in the same time
 * providing a quick and simple method for setting it up.  If you need
 * exhaustive customization of the calendar creation process feel free to
 * modify this code to suit your needs (this is recommended and much better
 * than modifying calendar.js itself).
 */
Calendar.setup=function(params){function param_default(pname,def){if(typeof params[pname]=="undefined"){params[pname]=def;}};param_default("inputField",null);param_default("displayArea",null);param_default("button",null);param_default("eventName","click");param_default("ifFormat","%Y/%m/%d");param_default("daFormat","%Y/%m/%d");param_default("singleClick",true);param_default("disableFunc",null);param_default("dateStatusFunc",params["disableFunc"]);param_default("dateText",null);param_default("firstDay",null);param_default("align","Br");param_default("range",[1900,2999]);param_default("weekNumbers",true);param_default("flat",null);param_default("flatCallback",null);param_default("onSelect",null);param_default("onClose",null);param_default("onUpdate",null);param_default("date",null);param_default("showsTime",false);param_default("timeFormat","24");param_default("electric",true);param_default("step",2);param_default("position",null);param_default("cache",false);param_default("showOthers",false);param_default("multiple",null);var tmp=["inputField","displayArea","button"];for(var i in tmp){if(typeof params[tmp[i]]=="string"){params[tmp[i]]=document.getElementById(params[tmp[i]]);}}if(!(params.flat||params.multiple||params.inputField||params.displayArea||params.button)){alert("Calendar.setup:\n  Nothing to setup (no fields found).  Please check your code");return false;}function onSelect(cal){var p=cal.params;var update=(cal.dateClicked||p.electric);if(update&&p.inputField){p.inputField.value=cal.date.print(p.ifFormat);if(typeof p.inputField.onchange=="function")p.inputField.onchange();if(typeof fireEvent == 'function')fireEvent(p.inputField, "change");}if(update&&p.displayArea)p.displayArea.innerHTML=cal.date.print(p.daFormat);if(update&&typeof p.onUpdate=="function")p.onUpdate(cal);if(update&&p.flat){if(typeof p.flatCallback=="function")p.flatCallback(cal);}if(update&&p.singleClick&&cal.dateClicked)cal.callCloseHandler();};if(params.flat!=null){if(typeof params.flat=="string")params.flat=document.getElementById(params.flat);if(!params.flat){alert("Calendar.setup:\n  Flat specified but can't find parent.");return false;}var cal=new Calendar(params.firstDay,params.date,params.onSelect||onSelect);cal.showsOtherMonths=params.showOthers;cal.showsTime=params.showsTime;cal.time24=(params.timeFormat=="24");cal.params=params;cal.weekNumbers=params.weekNumbers;cal.setRange(params.range[0],params.range[1]);cal.setDateStatusHandler(params.dateStatusFunc);cal.getDateText=params.dateText;if(params.ifFormat){cal.setDateFormat(params.ifFormat);}if(params.inputField&&typeof params.inputField.value=="string"){cal.parseDate(params.inputField.value);}cal.create(params.flat);cal.show();return false;}var triggerEl=params.button||params.displayArea||params.inputField;triggerEl["on"+params.eventName]=function(){var dateEl=params.inputField||params.displayArea;var dateFmt=params.inputField?params.ifFormat:params.daFormat;var mustCreate=false;var cal=window.calendar;if(dateEl)params.date=Date.parseDate(dateEl.value||dateEl.innerHTML,dateFmt);if(!(cal&&params.cache)){window.calendar=cal=new Calendar(params.firstDay,params.date,params.onSelect||onSelect,params.onClose||function(cal){cal.hide();});cal.showsTime=params.showsTime;cal.time24=(params.timeFormat=="24");cal.weekNumbers=params.weekNumbers;mustCreate=true;}else{if(params.date)cal.setDate(params.date);cal.hide();}if(params.multiple){cal.multiple={};for(var i=params.multiple.length;--i>=0;){var d=params.multiple[i];var ds=d.print("%Y%m%d");cal.multiple[ds]=d;}}cal.showsOtherMonths=params.showOthers;cal.yearStep=params.step;cal.setRange(params.range[0],params.range[1]);cal.params=params;cal.setDateStatusHandler(params.dateStatusFunc);cal.getDateText=params.dateText;cal.setDateFormat(dateFmt);if(mustCreate)cal.create();cal.refresh();if(!params.position)cal.showAtElement(params.button||params.displayArea||params.inputField,params.align);else cal.showAt(params.position[0],params.position[1]);return false;};return cal;};
"function"!==typeof Object.create&&(Object.create=function(f){function g(){}g.prototype=f;return new g});
(function(f,g,k){var l={init:function(a,b){this.$elem=f(b);this.options=f.extend({},f.fn.owlCarousel.options,this.$elem.data(),a);this.userOptions=a;this.loadContent()},loadContent:function(){function a(a){var d,e="";if("function"===typeof b.options.jsonSuccess)b.options.jsonSuccess.apply(this,[a]);else{for(d in a.owl)a.owl.hasOwnProperty(d)&&(e+=a.owl[d].item);b.$elem.html(e)}b.logIn()}var b=this,e;"function"===typeof b.options.beforeInit&&b.options.beforeInit.apply(this,[b.$elem]);"string"===typeof b.options.jsonPath?
(e=b.options.jsonPath,f.getJSON(e,a)):b.logIn()},logIn:function(){this.$elem.data("owl-originalStyles",this.$elem.attr("style"));this.$elem.data("owl-originalClasses",this.$elem.attr("class"));this.$elem.css({opacity:0});this.orignalItems=this.options.items;this.checkBrowser();this.wrapperWidth=0;this.checkVisible=null;this.setVars()},setVars:function(){if(0===this.$elem.children().length)return!1;this.baseClass();this.eventTypes();this.$userItems=this.$elem.children();this.itemsAmount=this.$userItems.length;
this.wrapItems();this.$owlItems=this.$elem.find(".owl-item");this.$owlWrapper=this.$elem.find(".owl-wrapper");this.playDirection="next";this.prevItem=0;this.prevArr=[0];this.currentItem=0;this.customEvents();this.onStartup()},onStartup:function(){this.updateItems();this.calculateAll();this.buildControls();this.updateControls();this.response();this.moveEvents();this.stopOnHover();this.owlStatus();!1!==this.options.transitionStyle&&this.transitionTypes(this.options.transitionStyle);!0===this.options.autoPlay&&
(this.options.autoPlay=5E3);this.play();this.$elem.find(".owl-wrapper").css("display","block");this.$elem.is(":visible")?this.$elem.css("opacity",1):this.watchVisibility();this.onstartup=!1;this.eachMoveUpdate();"function"===typeof this.options.afterInit&&this.options.afterInit.apply(this,[this.$elem])},eachMoveUpdate:function(){!0===this.options.lazyLoad&&this.lazyLoad();!0===this.options.autoHeight&&this.autoHeight();this.onVisibleItems();"function"===typeof this.options.afterAction&&this.options.afterAction.apply(this,
[this.$elem])},updateVars:function(){"function"===typeof this.options.beforeUpdate&&this.options.beforeUpdate.apply(this,[this.$elem]);this.watchVisibility();this.updateItems();this.calculateAll();this.updatePosition();this.updateControls();this.eachMoveUpdate();"function"===typeof this.options.afterUpdate&&this.options.afterUpdate.apply(this,[this.$elem])},reload:function(){var a=this;g.setTimeout(function(){a.updateVars()},0)},watchVisibility:function(){var a=this;if(!1===a.$elem.is(":visible"))a.$elem.css({opacity:0}),
g.clearInterval(a.autoPlayInterval),g.clearInterval(a.checkVisible);else return!1;a.checkVisible=g.setInterval(function(){a.$elem.is(":visible")&&(a.reload(),a.$elem.animate({opacity:1},200),g.clearInterval(a.checkVisible))},500)},wrapItems:function(){this.$userItems.wrapAll('<div class="owl-wrapper">').wrap('<div class="owl-item"></div>');this.$elem.find(".owl-wrapper").wrap('<div class="owl-wrapper-outer">');this.wrapperOuter=this.$elem.find(".owl-wrapper-outer");this.$elem.css("display","block")},
baseClass:function(){var a=this.$elem.hasClass(this.options.baseClass),b=this.$elem.hasClass(this.options.theme);a||this.$elem.addClass(this.options.baseClass);b||this.$elem.addClass(this.options.theme)},updateItems:function(){var a,b;if(!1===this.options.responsive)return!1;if(!0===this.options.singleItem)return this.options.items=this.orignalItems=1,this.options.itemsCustom=!1,this.options.itemsDesktop=!1,this.options.itemsDesktopSmall=!1,this.options.itemsTablet=!1,this.options.itemsTabletSmall=
!1,this.options.itemsMobile=!1;a=f(this.options.responsiveBaseWidth).width();a>(this.options.itemsDesktop[0]||this.orignalItems)&&(this.options.items=this.orignalItems);if(!1!==this.options.itemsCustom)for(this.options.itemsCustom.sort(function(a,b){return a[0]-b[0]}),b=0;b<this.options.itemsCustom.length;b+=1)this.options.itemsCustom[b][0]<=a&&(this.options.items=this.options.itemsCustom[b][1]);else a<=this.options.itemsDesktop[0]&&!1!==this.options.itemsDesktop&&(this.options.items=this.options.itemsDesktop[1]),
a<=this.options.itemsDesktopSmall[0]&&!1!==this.options.itemsDesktopSmall&&(this.options.items=this.options.itemsDesktopSmall[1]),a<=this.options.itemsTablet[0]&&!1!==this.options.itemsTablet&&(this.options.items=this.options.itemsTablet[1]),a<=this.options.itemsTabletSmall[0]&&!1!==this.options.itemsTabletSmall&&(this.options.items=this.options.itemsTabletSmall[1]),a<=this.options.itemsMobile[0]&&!1!==this.options.itemsMobile&&(this.options.items=this.options.itemsMobile[1]);this.options.items>this.itemsAmount&&
!0===this.options.itemsScaleUp&&(this.options.items=this.itemsAmount)},response:function(){var a=this,b,e;if(!0!==a.options.responsive)return!1;e=f(g).width();a.resizer=function(){f(g).width()!==e&&(!1!==a.options.autoPlay&&g.clearInterval(a.autoPlayInterval),g.clearTimeout(b),b=g.setTimeout(function(){e=f(g).width();a.updateVars()},a.options.responsiveRefreshRate))};f(g).resize(a.resizer)},updatePosition:function(){this.jumpTo(this.currentItem);!1!==this.options.autoPlay&&this.checkAp()},appendItemsSizes:function(){var a=
this,b=0,e=a.itemsAmount-a.options.items;a.$owlItems.each(function(c){var d=f(this);d.css({width:a.itemWidth}).data("owl-item",Number(c));if(0===c%a.options.items||c===e)c>e||(b+=1);d.data("owl-roundPages",b)})},appendWrapperSizes:function(){this.$owlWrapper.css({width:this.$owlItems.length*this.itemWidth*2,left:0});this.appendItemsSizes()},calculateAll:function(){this.calculateWidth();this.appendWrapperSizes();this.loops();this.max()},calculateWidth:function(){this.itemWidth=Math.round(this.$elem.width()/
this.options.items)},max:function(){var a=-1*(this.itemsAmount*this.itemWidth-this.options.items*this.itemWidth);this.options.items>this.itemsAmount?this.maximumPixels=a=this.maximumItem=0:(this.maximumItem=this.itemsAmount-this.options.items,this.maximumPixels=a);return a},min:function(){return 0},loops:function(){var a=0,b=0,e,c;this.positionsInArray=[0];this.pagesInArray=[];for(e=0;e<this.itemsAmount;e+=1)b+=this.itemWidth,this.positionsInArray.push(-b),!0===this.options.scrollPerPage&&(c=f(this.$owlItems[e]),
c=c.data("owl-roundPages"),c!==a&&(this.pagesInArray[a]=this.positionsInArray[e],a=c))},buildControls:function(){if(!0===this.options.navigation||!0===this.options.pagination)this.owlControls=f('<div class="owl-controls"/>').toggleClass("clickable",!this.browser.isTouch).appendTo(this.$elem);!0===this.options.pagination&&this.buildPagination();!0===this.options.navigation&&this.buildButtons()},buildButtons:function(){var a=this,b=f('<div class="owl-buttons"/>');a.owlControls.append(b);a.buttonPrev=
f("<div/>",{"class":"owl-prev",html:a.options.navigationText[0]||""});a.buttonNext=f("<div/>",{"class":"owl-next",html:a.options.navigationText[1]||""});b.append(a.buttonPrev).append(a.buttonNext);b.on("touchstart.owlControls mousedown.owlControls",'div[class^="owl"]',function(a){a.preventDefault()});b.on("touchend.owlControls mouseup.owlControls",'div[class^="owl"]',function(b){b.preventDefault();f(this).hasClass("owl-next")?a.next():a.prev()})},buildPagination:function(){var a=this;a.paginationWrapper=
f('<div class="owl-pagination"/>');a.owlControls.append(a.paginationWrapper);a.paginationWrapper.on("touchend.owlControls mouseup.owlControls",".owl-page",function(b){b.preventDefault();Number(f(this).data("owl-page"))!==a.currentItem&&a.goTo(Number(f(this).data("owl-page")),!0)})},updatePagination:function(){var a,b,e,c,d,g;if(!1===this.options.pagination)return!1;this.paginationWrapper.html("");a=0;b=this.itemsAmount-this.itemsAmount%this.options.items;for(c=0;c<this.itemsAmount;c+=1)0===c%this.options.items&&
(a+=1,b===c&&(e=this.itemsAmount-this.options.items),d=f("<div/>",{"class":"owl-page"}),g=f("<span></span>",{text:!0===this.options.paginationNumbers?a:"","class":!0===this.options.paginationNumbers?"owl-numbers":""}),d.append(g),d.data("owl-page",b===c?e:c),d.data("owl-roundPages",a),this.paginationWrapper.append(d));this.checkPagination()},checkPagination:function(){var a=this;if(!1===a.options.pagination)return!1;a.paginationWrapper.find(".owl-page").each(function(){f(this).data("owl-roundPages")===
f(a.$owlItems[a.currentItem]).data("owl-roundPages")&&(a.paginationWrapper.find(".owl-page").removeClass("active"),f(this).addClass("active"))})},checkNavigation:function(){if(!1===this.options.navigation)return!1;!1===this.options.rewindNav&&(0===this.currentItem&&0===this.maximumItem?(this.buttonPrev.addClass("disabled"),this.buttonNext.addClass("disabled")):0===this.currentItem&&0!==this.maximumItem?(this.buttonPrev.addClass("disabled"),this.buttonNext.removeClass("disabled")):this.currentItem===
this.maximumItem?(this.buttonPrev.removeClass("disabled"),this.buttonNext.addClass("disabled")):0!==this.currentItem&&this.currentItem!==this.maximumItem&&(this.buttonPrev.removeClass("disabled"),this.buttonNext.removeClass("disabled")))},updateControls:function(){this.updatePagination();this.checkNavigation();this.owlControls&&(this.options.items>=this.itemsAmount?this.owlControls.hide():this.owlControls.show())},destroyControls:function(){this.owlControls&&this.owlControls.remove()},next:function(a){if(this.isTransition)return!1;
this.currentItem+=!0===this.options.scrollPerPage?this.options.items:1;if(this.currentItem>this.maximumItem+(!0===this.options.scrollPerPage?this.options.items-1:0))if(!0===this.options.rewindNav)this.currentItem=0,a="rewind";else return this.currentItem=this.maximumItem,!1;this.goTo(this.currentItem,a)},prev:function(a){if(this.isTransition)return!1;this.currentItem=!0===this.options.scrollPerPage&&0<this.currentItem&&this.currentItem<this.options.items?0:this.currentItem-(!0===this.options.scrollPerPage?
this.options.items:1);if(0>this.currentItem)if(!0===this.options.rewindNav)this.currentItem=this.maximumItem,a="rewind";else return this.currentItem=0,!1;this.goTo(this.currentItem,a)},goTo:function(a,b,e){var c=this;if(c.isTransition)return!1;"function"===typeof c.options.beforeMove&&c.options.beforeMove.apply(this,[c.$elem]);a>=c.maximumItem?a=c.maximumItem:0>=a&&(a=0);c.currentItem=c.owl.currentItem=a;if(!1!==c.options.transitionStyle&&"drag"!==e&&1===c.options.items&&!0===c.browser.support3d)return c.swapSpeed(0),
!0===c.browser.support3d?c.transition3d(c.positionsInArray[a]):c.css2slide(c.positionsInArray[a],1),c.afterGo(),c.singleItemTransition(),!1;a=c.positionsInArray[a];!0===c.browser.support3d?(c.isCss3Finish=!1,!0===b?(c.swapSpeed("paginationSpeed"),g.setTimeout(function(){c.isCss3Finish=!0},c.options.paginationSpeed)):"rewind"===b?(c.swapSpeed(c.options.rewindSpeed),g.setTimeout(function(){c.isCss3Finish=!0},c.options.rewindSpeed)):(c.swapSpeed("slideSpeed"),g.setTimeout(function(){c.isCss3Finish=!0},
c.options.slideSpeed)),c.transition3d(a)):!0===b?c.css2slide(a,c.options.paginationSpeed):"rewind"===b?c.css2slide(a,c.options.rewindSpeed):c.css2slide(a,c.options.slideSpeed);c.afterGo()},jumpTo:function(a){"function"===typeof this.options.beforeMove&&this.options.beforeMove.apply(this,[this.$elem]);a>=this.maximumItem||-1===a?a=this.maximumItem:0>=a&&(a=0);this.swapSpeed(0);!0===this.browser.support3d?this.transition3d(this.positionsInArray[a]):this.css2slide(this.positionsInArray[a],1);this.currentItem=
this.owl.currentItem=a;this.afterGo()},afterGo:function(){this.prevArr.push(this.currentItem);this.prevItem=this.owl.prevItem=this.prevArr[this.prevArr.length-2];this.prevArr.shift(0);this.prevItem!==this.currentItem&&(this.checkPagination(),this.checkNavigation(),this.eachMoveUpdate(),!1!==this.options.autoPlay&&this.checkAp());"function"===typeof this.options.afterMove&&this.prevItem!==this.currentItem&&this.options.afterMove.apply(this,[this.$elem])},stop:function(){this.apStatus="stop";g.clearInterval(this.autoPlayInterval)},
checkAp:function(){"stop"!==this.apStatus&&this.play()},play:function(){var a=this;a.apStatus="play";if(!1===a.options.autoPlay)return!1;g.clearInterval(a.autoPlayInterval);a.autoPlayInterval=g.setInterval(function(){a.next(!0)},a.options.autoPlay)},swapSpeed:function(a){"slideSpeed"===a?this.$owlWrapper.css(this.addCssSpeed(this.options.slideSpeed)):"paginationSpeed"===a?this.$owlWrapper.css(this.addCssSpeed(this.options.paginationSpeed)):"string"!==typeof a&&this.$owlWrapper.css(this.addCssSpeed(a))},
addCssSpeed:function(a){return{"-webkit-transition":"all "+a+"ms ease","-moz-transition":"all "+a+"ms ease","-o-transition":"all "+a+"ms ease",transition:"all "+a+"ms ease"}},removeTransition:function(){return{"-webkit-transition":"","-moz-transition":"","-o-transition":"",transition:""}},doTranslate:function(a){return{"-webkit-transform":"translate3d("+a+"px, 0px, 0px)","-moz-transform":"translate3d("+a+"px, 0px, 0px)","-o-transform":"translate3d("+a+"px, 0px, 0px)","-ms-transform":"translate3d("+
a+"px, 0px, 0px)",transform:"translate3d("+a+"px, 0px,0px)"}},transition3d:function(a){this.$owlWrapper.css(this.doTranslate(a))},css2move:function(a){this.$owlWrapper.css({left:a})},css2slide:function(a,b){var e=this;e.isCssFinish=!1;e.$owlWrapper.stop(!0,!0).animate({left:a},{duration:b||e.options.slideSpeed,complete:function(){e.isCssFinish=!0}})},checkBrowser:function(){var a=k.createElement("div");a.style.cssText="  -moz-transform:translate3d(0px, 0px, 0px); -ms-transform:translate3d(0px, 0px, 0px); -o-transform:translate3d(0px, 0px, 0px); -webkit-transform:translate3d(0px, 0px, 0px); transform:translate3d(0px, 0px, 0px)";
a=a.style.cssText.match(/translate3d\(0px, 0px, 0px\)/g);this.browser={support3d:null!==a&&1===a.length,isTouch:"ontouchstart"in g||g.navigator.msMaxTouchPoints}},moveEvents:function(){if(!1!==this.options.mouseDrag||!1!==this.options.touchDrag)this.gestures(),this.disabledEvents()},eventTypes:function(){var a=["s","e","x"];this.ev_types={};!0===this.options.mouseDrag&&!0===this.options.touchDrag?a=["touchstart.owl mousedown.owl","touchmove.owl mousemove.owl","touchend.owl touchcancel.owl mouseup.owl"]:
!1===this.options.mouseDrag&&!0===this.options.touchDrag?a=["touchstart.owl","touchmove.owl","touchend.owl touchcancel.owl"]:!0===this.options.mouseDrag&&!1===this.options.touchDrag&&(a=["mousedown.owl","mousemove.owl","mouseup.owl"]);this.ev_types.start=a[0];this.ev_types.move=a[1];this.ev_types.end=a[2]},disabledEvents:function(){this.$elem.on("dragstart.owl",function(a){a.preventDefault()});this.$elem.on("mousedown.disableTextSelect",function(a){return f(a.target).is("input, textarea, select, option")})},
gestures:function(){function a(a){if(void 0!==a.touches)return{x:a.touches[0].pageX,y:a.touches[0].pageY};if(void 0===a.touches){if(void 0!==a.pageX)return{x:a.pageX,y:a.pageY};if(void 0===a.pageX)return{x:a.clientX,y:a.clientY}}}function b(a){"on"===a?(f(k).on(d.ev_types.move,e),f(k).on(d.ev_types.end,c)):"off"===a&&(f(k).off(d.ev_types.move),f(k).off(d.ev_types.end))}function e(b){b=b.originalEvent||b||g.event;d.newPosX=a(b).x-h.offsetX;d.newPosY=a(b).y-h.offsetY;d.newRelativeX=d.newPosX-h.relativePos;
"function"===typeof d.options.startDragging&&!0!==h.dragging&&0!==d.newRelativeX&&(h.dragging=!0,d.options.startDragging.apply(d,[d.$elem]));(8<d.newRelativeX||-8>d.newRelativeX)&&!0===d.browser.isTouch&&(void 0!==b.preventDefault?b.preventDefault():b.returnValue=!1,h.sliding=!0);(10<d.newPosY||-10>d.newPosY)&&!1===h.sliding&&f(k).off("touchmove.owl");d.newPosX=Math.max(Math.min(d.newPosX,d.newRelativeX/5),d.maximumPixels+d.newRelativeX/5);!0===d.browser.support3d?d.transition3d(d.newPosX):d.css2move(d.newPosX)}
function c(a){a=a.originalEvent||a||g.event;var c;a.target=a.target||a.srcElement;h.dragging=!1;!0!==d.browser.isTouch&&d.$owlWrapper.removeClass("grabbing");d.dragDirection=0>d.newRelativeX?d.owl.dragDirection="left":d.owl.dragDirection="right";0!==d.newRelativeX&&(c=d.getNewPosition(),d.goTo(c,!1,"drag"),h.targetElement===a.target&&!0!==d.browser.isTouch&&(f(a.target).on("click.disable",function(a){a.stopImmediatePropagation();a.stopPropagation();a.preventDefault();f(a.target).off("click.disable")}),
a=f._data(a.target,"events").click,c=a.pop(),a.splice(0,0,c)));b("off")}var d=this,h={offsetX:0,offsetY:0,baseElWidth:0,relativePos:0,position:null,minSwipe:null,maxSwipe:null,sliding:null,dargging:null,targetElement:null};d.isCssFinish=!0;d.$elem.on(d.ev_types.start,".owl-wrapper",function(c){c=c.originalEvent||c||g.event;var e;if(3===c.which)return!1;if(!(d.itemsAmount<=d.options.items)){if(!1===d.isCssFinish&&!d.options.dragBeforeAnimFinish||!1===d.isCss3Finish&&!d.options.dragBeforeAnimFinish)return!1;
!1!==d.options.autoPlay&&g.clearInterval(d.autoPlayInterval);!0===d.browser.isTouch||d.$owlWrapper.hasClass("grabbing")||d.$owlWrapper.addClass("grabbing");d.newPosX=0;d.newRelativeX=0;f(this).css(d.removeTransition());e=f(this).position();h.relativePos=e.left;h.offsetX=a(c).x-e.left;h.offsetY=a(c).y-e.top;b("on");h.sliding=!1;h.targetElement=c.target||c.srcElement}})},getNewPosition:function(){var a=this.closestItem();a>this.maximumItem?a=this.currentItem=this.maximumItem:0<=this.newPosX&&(this.currentItem=
a=0);return a},closestItem:function(){var a=this,b=!0===a.options.scrollPerPage?a.pagesInArray:a.positionsInArray,e=a.newPosX,c=null;f.each(b,function(d,g){e-a.itemWidth/20>b[d+1]&&e-a.itemWidth/20<g&&"left"===a.moveDirection()?(c=g,a.currentItem=!0===a.options.scrollPerPage?f.inArray(c,a.positionsInArray):d):e+a.itemWidth/20<g&&e+a.itemWidth/20>(b[d+1]||b[d]-a.itemWidth)&&"right"===a.moveDirection()&&(!0===a.options.scrollPerPage?(c=b[d+1]||b[b.length-1],a.currentItem=f.inArray(c,a.positionsInArray)):
(c=b[d+1],a.currentItem=d+1))});return a.currentItem},moveDirection:function(){var a;0>this.newRelativeX?(a="right",this.playDirection="next"):(a="left",this.playDirection="prev");return a},customEvents:function(){var a=this;a.$elem.on("owl.next",function(){a.next()});a.$elem.on("owl.prev",function(){a.prev()});a.$elem.on("owl.play",function(b,e){a.options.autoPlay=e;a.play();a.hoverStatus="play"});a.$elem.on("owl.stop",function(){a.stop();a.hoverStatus="stop"});a.$elem.on("owl.goTo",function(b,e){a.goTo(e)});
a.$elem.on("owl.jumpTo",function(b,e){a.jumpTo(e)})},stopOnHover:function(){var a=this;!0===a.options.stopOnHover&&!0!==a.browser.isTouch&&!1!==a.options.autoPlay&&(a.$elem.on("mouseover",function(){a.stop()}),a.$elem.on("mouseout",function(){"stop"!==a.hoverStatus&&a.play()}))},lazyLoad:function(){var a,b,e,c,d;if(!1===this.options.lazyLoad)return!1;for(a=0;a<this.itemsAmount;a+=1)b=f(this.$owlItems[a]),"loaded"!==b.data("owl-loaded")&&(e=b.data("owl-item"),c=b.find(".lazyOwl"),"string"!==typeof c.data("src")?
b.data("owl-loaded","loaded"):(void 0===b.data("owl-loaded")&&(c.hide(),b.addClass("loading").data("owl-loaded","checked")),(d=!0===this.options.lazyFollow?e>=this.currentItem:!0)&&e<this.currentItem+this.options.items&&c.length&&this.lazyPreload(b,c)))},lazyPreload:function(a,b){function e(){a.data("owl-loaded","loaded").removeClass("loading");b.removeAttr("data-src");"fade"===d.options.lazyEffect?b.fadeIn(400):b.show();"function"===typeof d.options.afterLazyLoad&&d.options.afterLazyLoad.apply(this,
[d.$elem])}function c(){f+=1;d.completeImg(b.get(0))||!0===k?e():100>=f?g.setTimeout(c,100):e()}var d=this,f=0,k;"DIV"===b.prop("tagName")?(b.css("background-image","url("+b.data("src")+")"),k=!0):b[0].src=b.data("src");c()},autoHeight:function(){function a(){var a=f(e.$owlItems[e.currentItem]).height();e.wrapperOuter.css("height",a+"px");e.wrapperOuter.hasClass("autoHeight")||g.setTimeout(function(){e.wrapperOuter.addClass("autoHeight")},0)}function b(){d+=1;e.completeImg(c.get(0))?a():100>=d?g.setTimeout(b,
100):e.wrapperOuter.css("height","")}var e=this,c=f(e.$owlItems[e.currentItem]).find("img"),d;void 0!==c.get(0)?(d=0,b()):a()},completeImg:function(a){return!a.complete||"undefined"!==typeof a.naturalWidth&&0===a.naturalWidth?!1:!0},onVisibleItems:function(){var a;!0===this.options.addClassActive&&this.$owlItems.removeClass("active");this.visibleItems=[];for(a=this.currentItem;a<this.currentItem+this.options.items;a+=1)this.visibleItems.push(a),!0===this.options.addClassActive&&f(this.$owlItems[a]).addClass("active");
this.owl.visibleItems=this.visibleItems},transitionTypes:function(a){this.outClass="owl-"+a+"-out";this.inClass="owl-"+a+"-in"},singleItemTransition:function(){var a=this,b=a.outClass,e=a.inClass,c=a.$owlItems.eq(a.currentItem),d=a.$owlItems.eq(a.prevItem),f=Math.abs(a.positionsInArray[a.currentItem])+a.positionsInArray[a.prevItem],g=Math.abs(a.positionsInArray[a.currentItem])+a.itemWidth/2;a.isTransition=!0;a.$owlWrapper.addClass("owl-origin").css({"-webkit-transform-origin":g+"px","-moz-perspective-origin":g+
"px","perspective-origin":g+"px"});d.css({position:"relative",left:f+"px"}).addClass(b).on("webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend",function(){a.endPrev=!0;d.off("webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend");a.clearTransStyle(d,b)});c.addClass(e).on("webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend",function(){a.endCurrent=!0;c.off("webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend");a.clearTransStyle(c,e)})},clearTransStyle:function(a,
b){a.css({position:"",left:""}).removeClass(b);this.endPrev&&this.endCurrent&&(this.$owlWrapper.removeClass("owl-origin"),this.isTransition=this.endCurrent=this.endPrev=!1)},owlStatus:function(){this.owl={userOptions:this.userOptions,baseElement:this.$elem,userItems:this.$userItems,owlItems:this.$owlItems,currentItem:this.currentItem,prevItem:this.prevItem,visibleItems:this.visibleItems,isTouch:this.browser.isTouch,browser:this.browser,dragDirection:this.dragDirection}},clearEvents:function(){this.$elem.off(".owl owl mousedown.disableTextSelect");
f(k).off(".owl owl");f(g).off("resize",this.resizer)},unWrap:function(){0!==this.$elem.children().length&&(this.$owlWrapper.unwrap(),this.$userItems.unwrap().unwrap(),this.owlControls&&this.owlControls.remove());this.clearEvents();this.$elem.attr("style",this.$elem.data("owl-originalStyles")||"").attr("class",this.$elem.data("owl-originalClasses"))},destroy:function(){this.stop();g.clearInterval(this.checkVisible);this.unWrap();this.$elem.removeData()},reinit:function(a){a=f.extend({},this.userOptions,
a);this.unWrap();this.init(a,this.$elem)},addItem:function(a,b){var e;if(!a)return!1;if(0===this.$elem.children().length)return this.$elem.append(a),this.setVars(),!1;this.unWrap();e=void 0===b||-1===b?-1:b;e>=this.$userItems.length||-1===e?this.$userItems.eq(-1).after(a):this.$userItems.eq(e).before(a);this.setVars()},removeItem:function(a){if(0===this.$elem.children().length)return!1;a=void 0===a||-1===a?-1:a;this.unWrap();this.$userItems.eq(a).remove();this.setVars()}};f.fn.owlCarousel=function(a){return this.each(function(){if(!0===
f(this).data("owl-init"))return!1;f(this).data("owl-init",!0);var b=Object.create(l);b.init(a,this);f.data(this,"owlCarousel",b)})};f.fn.owlCarousel.options={items:5,itemsCustom:!1,itemsDesktop:[1199,4],itemsDesktopSmall:[979,3],itemsTablet:[768,2],itemsTabletSmall:!1,itemsMobile:[479,1],singleItem:!1,itemsScaleUp:!1,slideSpeed:200,paginationSpeed:800,rewindSpeed:1E3,autoPlay:!1,stopOnHover:!1,navigation:!1,navigationText:["prev","next"],rewindNav:!0,scrollPerPage:!1,pagination:!0,paginationNumbers:!1,
responsive:!0,responsiveRefreshRate:200,responsiveBaseWidth:g,baseClass:"owl-carousel",theme:"owl-theme",lazyLoad:!1,lazyFollow:!0,lazyEffect:"fade",autoHeight:!1,jsonPath:!1,jsonSuccess:!1,dragBeforeAnimFinish:!0,mouseDrag:!0,touchDrag:!0,addClassActive:!1,transitionStyle:!1,beforeUpdate:!1,afterUpdate:!1,beforeInit:!1,afterInit:!1,beforeMove:!1,afterMove:!1,afterAction:!1,startDragging:!1,afterLazyLoad:!1}})(jQuery,window,document);
/*
 *
 * jqTransform
 * by mathieu vilaplana mvilaplana@dfc-e.com
 * Designer ghyslain armand garmand@dfc-e.com
 *
 *
 * Version 1.0 25.09.08
 * Version 1.1 06.08.09
 * Add event click on Checkbox and Radio
 * Auto calculate the size of a select element
 * Can now, disabled the elements
 * Correct bug in ff if click on select (overflow=hidden)
 * No need any more preloading !!
 * 
 ******************************************** */
 
(function($){
	var defaultOptions = {preloadImg:true};
	var jqTransformImgPreloaded = false;

	var jqTransformPreloadHoverFocusImg = function(strImgUrl) {
		//guillemets to remove for ie
		strImgUrl = strImgUrl.replace(/^url\((.*)\)/,'$1').replace(/^\"(.*)\"$/,'$1');
		var imgHover = new Image();
		imgHover.src = strImgUrl.replace(/\.([a-zA-Z]*)$/,'-hover.$1');
		var imgFocus = new Image();
		imgFocus.src = strImgUrl.replace(/\.([a-zA-Z]*)$/,'-focus.$1');				
	};

	
	/***************************
	  Labels
	***************************/
	var jqTransformGetLabel = function(objfield){
		var selfForm = $(objfield.get(0).form);
		var oLabel = objfield.next();
		if(!oLabel.is('label')) {
			oLabel = objfield.prev();
			if(oLabel.is('label')){
				var inputname = objfield.attr('id');
				if(inputname){
					oLabel = selfForm.find('label[for="'+inputname+'"]');
				} 
			}
		}
		if(oLabel.is('label')){return oLabel.css('cursor','pointer');}
		return false;
	};
	
	/* Hide all open selects */
	var jqTransformHideSelect = function(oTarget){
		var ulVisible = $('.jqTransformSelectWrapper ul:visible');
		ulVisible.each(function(){
			var oSelect = $(this).parents(".jqTransformSelectWrapper:first").find("select").get(0);
			//do not hide if click on the label object associated to the select
			if( !(oTarget && oSelect.oLabel && oSelect.oLabel.get(0) == oTarget.get(0)) ){$(this).hide();}
		});
	};
	/* Check for an external click */
	var jqTransformCheckExternalClick = function(event) {
		if ($(event.target).parents('.jqTransformSelectWrapper').length === 0) { jqTransformHideSelect($(event.target)); }
	};

	/* Apply document listener */
	var jqTransformAddDocumentListener = function (){
		$(document).mousedown(jqTransformCheckExternalClick);
	};	
			
	/* Add a new handler for the reset action */
	var jqTransformReset = function(f){
		var sel;
		$('.jqTransformSelectWrapper select', f).each(function(){sel = (this.selectedIndex<0) ? 0 : this.selectedIndex; $('ul', $(this).parent()).each(function(){$('a:eq('+ sel +')', this).click();});});
		$('a.jqTransformCheckbox, a.jqTransformRadio', f).removeClass('jqTransformChecked');
		$('input:checkbox, input:radio', f).each(function(){if(this.checked){$('a', $(this).parent()).addClass('jqTransformChecked');}});
	};

	/***************************
	  Buttons
	 ***************************/
	$.fn.jqTransInputButton = function(){
		return this.each(function(){
			var newBtn = $('<button id="'+ this.id +'" name="'+ this.name +'" type="'+ this.type +'" class="'+ this.className +' jqTransformButton"><span><span>'+ $(this).attr('value') +'</span></span>')
				.hover(function(){newBtn.addClass('jqTransformButton_hover');},function(){newBtn.removeClass('jqTransformButton_hover')})
				.mousedown(function(){newBtn.addClass('jqTransformButton_click')})
				.mouseup(function(){newBtn.removeClass('jqTransformButton_click')})
			;
			$(this).replaceWith(newBtn);
		});
	};
	
	/***************************
	  Text Fields 
	 ***************************/
	$.fn.jqTransInputText = function(){
		return this.each(function(){
			var $input = $(this);
	
			if($input.hasClass('jqtranformdone') || !$input.is('input')) {return;}
			$input.addClass('jqtranformdone');
	
			var oLabel = jqTransformGetLabel($(this));
			oLabel && oLabel.bind('click',function(){$input.focus();});
	
			var inputSize=$input.width();
			if($input.attr('size')){
				inputSize = $input.attr('size')*10;
				$input.css('width',inputSize);
			}
			
			$input.addClass("jqTransformInput").wrap('<div class="jqTransformInputWrapper"><div class="jqTransformInputInner"><div></div></div></div>');
			var $wrapper = $input.parent().parent().parent();
			$wrapper.css("width", inputSize+10);
			$input
				.focus(function(){$wrapper.addClass("jqTransformInputWrapper_focus");})
				.blur(function(){$wrapper.removeClass("jqTransformInputWrapper_focus");})
				.hover(function(){$wrapper.addClass("jqTransformInputWrapper_hover");},function(){$wrapper.removeClass("jqTransformInputWrapper_hover");})
			;
	
			/* If this is safari we need to add an extra class */
			$.browser.safari && $wrapper.addClass('jqTransformSafari');
			$.browser.safari && $input.css('width',$wrapper.width()+16);
			this.wrapper = $wrapper;
			
		});
	};
	
	/***************************
	  Check Boxes 
	 ***************************/	
	$.fn.jqTransCheckBox = function(){
		return this.each(function(){
			if($(this).hasClass('jqTransformHidden')) {return;}

			var $input = $(this);
			var inputSelf = this;

			//set the click on the label
			var oLabel=jqTransformGetLabel($input);
			oLabel && oLabel.click(function(){aLink.trigger('click');});
			
			var aLink = $('<a href="#" class="jqTransformCheckbox"></a>');
			//wrap and add the link
			$input.addClass('jqTransformHidden').wrap('<span class="jqTransformCheckboxWrapper"></span>').parent().prepend(aLink);
			//on change, change the class of the link
			$input.change(function(){
				this.checked && aLink.addClass('jqTransformChecked') || aLink.removeClass('jqTransformChecked');
				return true;
			});
			// Click Handler, trigger the click and change event on the input
			aLink.click(function(){
				//do nothing if the original input is disabled
				if($input.attr('disabled')){return false;}
				//trigger the envents on the input object
				$input.trigger('click').trigger("change");	
				return false;
			});

			// set the default state
			this.checked && aLink.addClass('jqTransformChecked');		
		});
	};
	/***************************
	  Radio Buttons 
	 ***************************/	
	$.fn.jqTransRadio = function(){
		return this.each(function(){
			if($(this).hasClass('jqTransformHidden')) {return;}

			var $input = $(this);
			var inputSelf = this;
				
			oLabel = jqTransformGetLabel($input);
			oLabel && oLabel.click(function(){aLink.trigger('click');});
	
			var aLink = $('<a href="#" class="jqTransformRadio" rel="'+ this.name +'"></a>');
			$input.addClass('jqTransformHidden').wrap('<span class="jqTransformRadioWrapper"></span>').parent().prepend(aLink);
			
			$input.change(function(){
				inputSelf.checked && aLink.addClass('jqTransformChecked') || aLink.removeClass('jqTransformChecked');
				return true;
			});
			// Click Handler
			aLink.click(function(){
				if($input.attr('disabled')){return false;}
				$input.trigger('click').trigger('change');
	
				// uncheck all others of same name input radio elements
				$('input[name="'+$input.attr('name')+'"]',inputSelf.form).not($input).each(function(){
					$(this).attr('type')=='radio' && $(this).trigger('change');
				});
	
				return false;					
			});
			// set the default state
			inputSelf.checked && aLink.addClass('jqTransformChecked');
		});
	};
	
	/***************************
	  TextArea 
	 ***************************/	
	$.fn.jqTransTextarea = function(){
		return this.each(function(){
			var textarea = $(this);
	
			if(textarea.hasClass('jqtransformdone')) {return;}
			textarea.addClass('jqtransformdone');
	
			oLabel = jqTransformGetLabel(textarea);
			oLabel && oLabel.click(function(){textarea.focus();});
			
			var strTable = '<table cellspacing="0" cellpadding="0" border="0" class="jqTransformTextarea">';
			strTable +='<tr><td id="jqTransformTextarea-tl"></td><td id="jqTransformTextarea-tm"></td><td id="jqTransformTextarea-tr"></td></tr>';
			strTable +='<tr><td id="jqTransformTextarea-ml">&nbsp;</td><td id="jqTransformTextarea-mm"><div></div></td><td id="jqTransformTextarea-mr">&nbsp;</td></tr>';	
			strTable +='<tr><td id="jqTransformTextarea-bl"></td><td id="jqTransformTextarea-bm"></td><td id="jqTransformTextarea-br"></td></tr>';
			strTable +='</table>';					
			var oTable = $(strTable)
					.insertAfter(textarea)
					.hover(function(){
						!oTable.hasClass('jqTransformTextarea-focus') && oTable.addClass('jqTransformTextarea-hover');
					},function(){
						oTable.removeClass('jqTransformTextarea-hover');					
					})
				;
				
			textarea
				.focus(function(){oTable.removeClass('jqTransformTextarea-hover').addClass('jqTransformTextarea-focus');})
				.blur(function(){oTable.removeClass('jqTransformTextarea-focus');})
				.appendTo($('#jqTransformTextarea-mm div',oTable))
			;
			this.oTable = oTable;
			if($.browser.safari){
				$('#jqTransformTextarea-mm',oTable)
					.addClass('jqTransformSafariTextarea')
					.find('div')
						.css('height',textarea.height())
						.css('width',textarea.width())
				;
			}
		});
	};
	
	/***************************
	  Select 
	 ***************************/	
	$.fn.jqTransSelect = function(){
		return this.each(function(index){
			var $select = $(this);

			if($select.hasClass('jqTransformHidden')) {return;}
			if($select.attr('multiple')) {return;}

			var oLabel  =  jqTransformGetLabel($select);
			/* First thing we do is Wrap it */
			var $wrapper = $select
				.addClass('jqTransformHidden')
				.wrap('<div class="jqTransformSelectWrapper"></div>')
				.parent()
				.css({zIndex: 10-index})
			;
			
			/* Now add the html for the select */
			$wrapper.prepend('<div><span></span><a href="#" class="jqTransformSelectOpen"></a></div><ul></ul>');
			var $ul = $('ul', $wrapper).css('width',$select.width()).hide();
			/* Now we add the options */
			$('option', this).each(function(i){
				var oLi = $('<li><a href="#" index="'+ i +'">'+ $(this).html() +'</a></li>');
				$ul.append(oLi);
			});
			
			/* Add click handler to the a */
			$ul.find('a').click(function(){
					$('a.selected', $wrapper).removeClass('selected');
					$(this).addClass('selected');	
					/* Fire the onchange event */
					if ($select[0].selectedIndex != $(this).attr('index') && $select[0].onchange) { $select[0].selectedIndex = $(this).attr('index'); $select[0].onchange(); }
					$select[0].selectedIndex = $(this).attr('index');
					$('span:eq(0)', $wrapper).html($(this).html());
					$ul.hide();
					return false;
			});
			/* Set the default */
			$('a:eq('+ this.selectedIndex +')', $ul).click();
			$('span:first', $wrapper).click(function(){$("a.jqTransformSelectOpen",$wrapper).trigger('click');});
			oLabel && oLabel.click(function(){$("a.jqTransformSelectOpen",$wrapper).trigger('click');});
			this.oLabel = oLabel;
			
			/* Apply the click handler to the Open */
			var oLinkOpen = $('a.jqTransformSelectOpen', $wrapper)
				.click(function(){
					//Check if box is already open to still allow toggle, but close all other selects
					if( $ul.css('display') == 'none' ) {jqTransformHideSelect();} 
					if($select.attr('disabled')){return false;}

					$ul.slideToggle('fast', function(){					
						var offSet = ($('a.selected', $ul).offset().top - $ul.offset().top);
						$ul.animate({scrollTop: offSet});
					});
					return false;
				})
			;

			// Set the new width
			var iSelectWidth = $select.outerWidth();
			var oSpan = $('span:first',$wrapper);
			var newWidth = (iSelectWidth > oSpan.innerWidth())?iSelectWidth+oLinkOpen.outerWidth():$wrapper.width();
			$wrapper.css('width',newWidth);
			$ul.css('width',newWidth-2);
			oSpan.css({width:iSelectWidth});
		
			// Calculate the height if necessary, less elements that the default height
			//show the ul to calculate the block, if ul is not displayed li height value is 0
			$ul.css({display:'block',visibility:'hidden'});
			var iSelectHeight = ($('li',$ul).length)*($('li:first',$ul).height());//+1 else bug ff
			(iSelectHeight < $ul.height()) && $ul.css({height:iSelectHeight,'overflow':'hidden'});//hidden else bug with ff
			$ul.css({display:'none',visibility:'visible'});
			
		});
	};
	$.fn.jqTransform = function(options){
		var opt = $.extend({},defaultOptions,options);
		
		/* each form */
		 return this.each(function(){
			var selfForm = $(this);
			if(selfForm.hasClass('jqtransformdone')) {return;}
			selfForm.addClass('jqtransformdone');
			
			$('input:submit, input:reset, input[type="button"]', this).jqTransInputButton();			
			$('input:text, input:password', this).jqTransInputText();			
			$('input:checkbox', this).jqTransCheckBox();
			$('input:radio', this).jqTransRadio();
			$('textarea', this).jqTransTextarea();
			
			if( $('select', this).jqTransSelect().length > 0 ){jqTransformAddDocumentListener();}
			selfForm.bind('reset',function(){var action = function(){jqTransformReset(this);}; window.setTimeout(action, 10);});
			
			//preloading dont needed anymore since normal, focus and hover image are the same one
			/*if(opt.preloadImg && !jqTransformImgPreloaded){
				jqTransformImgPreloaded = true;
				var oInputText = $('input:text:first', selfForm);
				if(oInputText.length > 0){
					//pour ie on eleve les ""
					var strWrapperImgUrl = oInputText.get(0).wrapper.css('background-image');
					jqTransformPreloadHoverFocusImg(strWrapperImgUrl);					
					var strInnerImgUrl = $('div.jqTransformInputInner',$(oInputText.get(0).wrapper)).css('background-image');
					jqTransformPreloadHoverFocusImg(strInnerImgUrl);
				}
				
				var oTextarea = $('textarea',selfForm);
				if(oTextarea.length > 0){
					var oTable = oTextarea.get(0).oTable;
					$('td',oTable).each(function(){
						var strImgBack = $(this).css('background-image');
						jqTransformPreloadHoverFocusImg(strImgBack);
					});
				}
			}*/
			
			
		}); /* End Form each */
				
	};/* End the Plugin */

})(jQuery);
				   
/*! fancyBox v2.1.5 fancyapps.com | fancyapps.com/fancybox/#license */
(function(r,G,f,v){var J=f("html"),n=f(r),p=f(G),b=f.fancybox=function(){b.open.apply(this,arguments)},I=navigator.userAgent.match(/msie/i),B=null,s=G.createTouch!==v,t=function(a){return a&&a.hasOwnProperty&&a instanceof f},q=function(a){return a&&"string"===f.type(a)},E=function(a){return q(a)&&0<a.indexOf("%")},l=function(a,d){var e=parseInt(a,10)||0;d&&E(a)&&(e*=b.getViewport()[d]/100);return Math.ceil(e)},w=function(a,b){return l(a,b)+"px"};f.extend(b,{version:"2.1.5",defaults:{padding:15,margin:20,
width:800,height:600,minWidth:100,minHeight:100,maxWidth:9999,maxHeight:9999,pixelRatio:1,autoSize:!0,autoHeight:!1,autoWidth:!1,autoResize:!0,autoCenter:!s,fitToView:!0,aspectRatio:!1,topRatio:0.5,leftRatio:0.5,scrolling:"auto",wrapCSS:"",arrows:!0,closeBtn:!0,closeClick:!1,nextClick:!1,mouseWheel:!0,autoPlay:!1,playSpeed:3E3,preload:3,modal:!1,loop:!0,ajax:{dataType:"html",headers:{"X-fancyBox":!0}},iframe:{scrolling:"auto",preload:!0},swf:{wmode:"transparent",allowfullscreen:"true",allowscriptaccess:"always"},
keys:{next:{13:"left",34:"up",39:"left",40:"up"},prev:{8:"right",33:"down",37:"right",38:"down"},close:[27],play:[32],toggle:[70]},direction:{next:"left",prev:"right"},scrollOutside:!0,index:0,type:null,href:null,content:null,title:null,tpl:{wrap:'<div class="fancybox-wrap" tabIndex="-1"><div class="fancybox-skin"><div class="fancybox-outer"><div class="fancybox-inner"></div></div></div></div>',image:'<img class="fancybox-image" src="{href}" alt="" />',iframe:'<iframe id="fancybox-frame{rnd}" name="fancybox-frame{rnd}" class="fancybox-iframe" frameborder="0" vspace="0" hspace="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen'+
(I?' allowtransparency="true"':"")+"></iframe>",error:'<p class="fancybox-error">The requested content cannot be loaded.<br/>Please try again later.</p>',closeBtn:'<a title="Close" class="fancybox-item fancybox-close" href="javascript:;"></a>',next:'<a title="Next" class="fancybox-nav fancybox-next" href="javascript:;"><span></span></a>',prev:'<a title="Previous" class="fancybox-nav fancybox-prev" href="javascript:;"><span></span></a>'},openEffect:"fade",openSpeed:250,openEasing:"swing",openOpacity:!0,
openMethod:"zoomIn",closeEffect:"fade",closeSpeed:250,closeEasing:"swing",closeOpacity:!0,closeMethod:"zoomOut",nextEffect:"elastic",nextSpeed:250,nextEasing:"swing",nextMethod:"changeIn",prevEffect:"elastic",prevSpeed:250,prevEasing:"swing",prevMethod:"changeOut",helpers:{overlay:!0,title:!0},onCancel:f.noop,beforeLoad:f.noop,afterLoad:f.noop,beforeShow:f.noop,afterShow:f.noop,beforeChange:f.noop,beforeClose:f.noop,afterClose:f.noop},group:{},opts:{},previous:null,coming:null,current:null,isActive:!1,
isOpen:!1,isOpened:!1,wrap:null,skin:null,outer:null,inner:null,player:{timer:null,isActive:!1},ajaxLoad:null,imgPreload:null,transitions:{},helpers:{},open:function(a,d){if(a&&(f.isPlainObject(d)||(d={}),!1!==b.close(!0)))return f.isArray(a)||(a=t(a)?f(a).get():[a]),f.each(a,function(e,c){var k={},g,h,j,m,l;"object"===f.type(c)&&(c.nodeType&&(c=f(c)),t(c)?(k={href:c.data("fancybox-href")||c.attr("href"),title:c.data("fancybox-title")||c.attr("title"),isDom:!0,element:c},f.metadata&&f.extend(!0,k,
c.metadata())):k=c);g=d.href||k.href||(q(c)?c:null);h=d.title!==v?d.title:k.title||"";m=(j=d.content||k.content)?"html":d.type||k.type;!m&&k.isDom&&(m=c.data("fancybox-type"),m||(m=(m=c.prop("class").match(/fancybox\.(\w+)/))?m[1]:null));q(g)&&(m||(b.isImage(g)?m="image":b.isSWF(g)?m="swf":"#"===g.charAt(0)?m="inline":q(c)&&(m="html",j=c)),"ajax"===m&&(l=g.split(/\s+/,2),g=l.shift(),l=l.shift()));j||("inline"===m?g?j=f(q(g)?g.replace(/.*(?=#[^\s]+$)/,""):g):k.isDom&&(j=c):"html"===m?j=g:!m&&(!g&&
k.isDom)&&(m="inline",j=c));f.extend(k,{href:g,type:m,content:j,title:h,selector:l});a[e]=k}),b.opts=f.extend(!0,{},b.defaults,d),d.keys!==v&&(b.opts.keys=d.keys?f.extend({},b.defaults.keys,d.keys):!1),b.group=a,b._start(b.opts.index)},cancel:function(){var a=b.coming;a&&!1!==b.trigger("onCancel")&&(b.hideLoading(),b.ajaxLoad&&b.ajaxLoad.abort(),b.ajaxLoad=null,b.imgPreload&&(b.imgPreload.onload=b.imgPreload.onerror=null),a.wrap&&a.wrap.stop(!0,!0).trigger("onReset").remove(),b.coming=null,b.current||
b._afterZoomOut(a))},close:function(a){b.cancel();!1!==b.trigger("beforeClose")&&(b.unbindEvents(),b.isActive&&(!b.isOpen||!0===a?(f(".fancybox-wrap").stop(!0).trigger("onReset").remove(),b._afterZoomOut()):(b.isOpen=b.isOpened=!1,b.isClosing=!0,f(".fancybox-item, .fancybox-nav").remove(),b.wrap.stop(!0,!0).removeClass("fancybox-opened"),b.transitions[b.current.closeMethod]())))},play:function(a){var d=function(){clearTimeout(b.player.timer)},e=function(){d();b.current&&b.player.isActive&&(b.player.timer=
setTimeout(b.next,b.current.playSpeed))},c=function(){d();p.unbind(".player");b.player.isActive=!1;b.trigger("onPlayEnd")};if(!0===a||!b.player.isActive&&!1!==a){if(b.current&&(b.current.loop||b.current.index<b.group.length-1))b.player.isActive=!0,p.bind({"onCancel.player beforeClose.player":c,"onUpdate.player":e,"beforeLoad.player":d}),e(),b.trigger("onPlayStart")}else c()},next:function(a){var d=b.current;d&&(q(a)||(a=d.direction.next),b.jumpto(d.index+1,a,"next"))},prev:function(a){var d=b.current;
d&&(q(a)||(a=d.direction.prev),b.jumpto(d.index-1,a,"prev"))},jumpto:function(a,d,e){var c=b.current;c&&(a=l(a),b.direction=d||c.direction[a>=c.index?"next":"prev"],b.router=e||"jumpto",c.loop&&(0>a&&(a=c.group.length+a%c.group.length),a%=c.group.length),c.group[a]!==v&&(b.cancel(),b._start(a)))},reposition:function(a,d){var e=b.current,c=e?e.wrap:null,k;c&&(k=b._getPosition(d),a&&"scroll"===a.type?(delete k.position,c.stop(!0,!0).animate(k,200)):(c.css(k),e.pos=f.extend({},e.dim,k)))},update:function(a){var d=
a&&a.type,e=!d||"orientationchange"===d;e&&(clearTimeout(B),B=null);b.isOpen&&!B&&(B=setTimeout(function(){var c=b.current;c&&!b.isClosing&&(b.wrap.removeClass("fancybox-tmp"),(e||"load"===d||"resize"===d&&c.autoResize)&&b._setDimension(),"scroll"===d&&c.canShrink||b.reposition(a),b.trigger("onUpdate"),B=null)},e&&!s?0:300))},toggle:function(a){b.isOpen&&(b.current.fitToView="boolean"===f.type(a)?a:!b.current.fitToView,s&&(b.wrap.removeAttr("style").addClass("fancybox-tmp"),b.trigger("onUpdate")),
b.update())},hideLoading:function(){p.unbind(".loading");f("#fancybox-loading").remove()},showLoading:function(){var a,d;b.hideLoading();a=f('<div id="fancybox-loading"><div></div></div>').click(b.cancel).appendTo("body");p.bind("keydown.loading",function(a){if(27===(a.which||a.keyCode))a.preventDefault(),b.cancel()});b.defaults.fixed||(d=b.getViewport(),a.css({position:"absolute",top:0.5*d.h+d.y,left:0.5*d.w+d.x}))},getViewport:function(){var a=b.current&&b.current.locked||!1,d={x:n.scrollLeft(),
y:n.scrollTop()};a?(d.w=a[0].clientWidth,d.h=a[0].clientHeight):(d.w=s&&r.innerWidth?r.innerWidth:n.width(),d.h=s&&r.innerHeight?r.innerHeight:n.height());return d},unbindEvents:function(){b.wrap&&t(b.wrap)&&b.wrap.unbind(".fb");p.unbind(".fb");n.unbind(".fb")},bindEvents:function(){var a=b.current,d;a&&(n.bind("orientationchange.fb"+(s?"":" resize.fb")+(a.autoCenter&&!a.locked?" scroll.fb":""),b.update),(d=a.keys)&&p.bind("keydown.fb",function(e){var c=e.which||e.keyCode,k=e.target||e.srcElement;
if(27===c&&b.coming)return!1;!e.ctrlKey&&(!e.altKey&&!e.shiftKey&&!e.metaKey&&(!k||!k.type&&!f(k).is("[contenteditable]")))&&f.each(d,function(d,k){if(1<a.group.length&&k[c]!==v)return b[d](k[c]),e.preventDefault(),!1;if(-1<f.inArray(c,k))return b[d](),e.preventDefault(),!1})}),f.fn.mousewheel&&a.mouseWheel&&b.wrap.bind("mousewheel.fb",function(d,c,k,g){for(var h=f(d.target||null),j=!1;h.length&&!j&&!h.is(".fancybox-skin")&&!h.is(".fancybox-wrap");)j=h[0]&&!(h[0].style.overflow&&"hidden"===h[0].style.overflow)&&
(h[0].clientWidth&&h[0].scrollWidth>h[0].clientWidth||h[0].clientHeight&&h[0].scrollHeight>h[0].clientHeight),h=f(h).parent();if(0!==c&&!j&&1<b.group.length&&!a.canShrink){if(0<g||0<k)b.prev(0<g?"down":"left");else if(0>g||0>k)b.next(0>g?"up":"right");d.preventDefault()}}))},trigger:function(a,d){var e,c=d||b.coming||b.current;if(c){f.isFunction(c[a])&&(e=c[a].apply(c,Array.prototype.slice.call(arguments,1)));if(!1===e)return!1;c.helpers&&f.each(c.helpers,function(d,e){if(e&&b.helpers[d]&&f.isFunction(b.helpers[d][a]))b.helpers[d][a](f.extend(!0,
{},b.helpers[d].defaults,e),c)});p.trigger(a)}},isImage:function(a){return q(a)&&a.match(/(^data:image\/.*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg)((\?|#).*)?$)/i)},isSWF:function(a){return q(a)&&a.match(/\.(swf)((\?|#).*)?$/i)},_start:function(a){var d={},e,c;a=l(a);e=b.group[a]||null;if(!e)return!1;d=f.extend(!0,{},b.opts,e);e=d.margin;c=d.padding;"number"===f.type(e)&&(d.margin=[e,e,e,e]);"number"===f.type(c)&&(d.padding=[c,c,c,c]);d.modal&&f.extend(!0,d,{closeBtn:!1,closeClick:!1,nextClick:!1,arrows:!1,
mouseWheel:!1,keys:null,helpers:{overlay:{closeClick:!1}}});d.autoSize&&(d.autoWidth=d.autoHeight=!0);"auto"===d.width&&(d.autoWidth=!0);"auto"===d.height&&(d.autoHeight=!0);d.group=b.group;d.index=a;b.coming=d;if(!1===b.trigger("beforeLoad"))b.coming=null;else{c=d.type;e=d.href;if(!c)return b.coming=null,b.current&&b.router&&"jumpto"!==b.router?(b.current.index=a,b[b.router](b.direction)):!1;b.isActive=!0;if("image"===c||"swf"===c)d.autoHeight=d.autoWidth=!1,d.scrolling="visible";"image"===c&&(d.aspectRatio=
!0);"iframe"===c&&s&&(d.scrolling="scroll");d.wrap=f(d.tpl.wrap).addClass("fancybox-"+(s?"mobile":"desktop")+" fancybox-type-"+c+" fancybox-tmp "+d.wrapCSS).appendTo(d.parent||"body");f.extend(d,{skin:f(".fancybox-skin",d.wrap),outer:f(".fancybox-outer",d.wrap),inner:f(".fancybox-inner",d.wrap)});f.each(["Top","Right","Bottom","Left"],function(a,b){d.skin.css("padding"+b,w(d.padding[a]))});b.trigger("onReady");if("inline"===c||"html"===c){if(!d.content||!d.content.length)return b._error("content")}else if(!e)return b._error("href");
"image"===c?b._loadImage():"ajax"===c?b._loadAjax():"iframe"===c?b._loadIframe():b._afterLoad()}},_error:function(a){f.extend(b.coming,{type:"html",autoWidth:!0,autoHeight:!0,minWidth:0,minHeight:0,scrolling:"no",hasError:a,content:b.coming.tpl.error});b._afterLoad()},_loadImage:function(){var a=b.imgPreload=new Image;a.onload=function(){this.onload=this.onerror=null;b.coming.width=this.width/b.opts.pixelRatio;b.coming.height=this.height/b.opts.pixelRatio;b._afterLoad()};a.onerror=function(){this.onload=
this.onerror=null;b._error("image")};a.src=b.coming.href;!0!==a.complete&&b.showLoading()},_loadAjax:function(){var a=b.coming;b.showLoading();b.ajaxLoad=f.ajax(f.extend({},a.ajax,{url:a.href,error:function(a,e){b.coming&&"abort"!==e?b._error("ajax",a):b.hideLoading()},success:function(d,e){"success"===e&&(a.content=d,b._afterLoad())}}))},_loadIframe:function(){var a=b.coming,d=f(a.tpl.iframe.replace(/\{rnd\}/g,(new Date).getTime())).attr("scrolling",s?"auto":a.iframe.scrolling).attr("src",a.href);
f(a.wrap).bind("onReset",function(){try{f(this).find("iframe").hide().attr("src","//about:blank").end().empty()}catch(a){}});a.iframe.preload&&(b.showLoading(),d.one("load",function(){f(this).data("ready",1);s||f(this).bind("load.fb",b.update);f(this).parents(".fancybox-wrap").width("100%").removeClass("fancybox-tmp").show();b._afterLoad()}));a.content=d.appendTo(a.inner);a.iframe.preload||b._afterLoad()},_preloadImages:function(){var a=b.group,d=b.current,e=a.length,c=d.preload?Math.min(d.preload,
e-1):0,f,g;for(g=1;g<=c;g+=1)f=a[(d.index+g)%e],"image"===f.type&&f.href&&((new Image).src=f.href)},_afterLoad:function(){var a=b.coming,d=b.current,e,c,k,g,h;b.hideLoading();if(a&&!1!==b.isActive)if(!1===b.trigger("afterLoad",a,d))a.wrap.stop(!0).trigger("onReset").remove(),b.coming=null;else{d&&(b.trigger("beforeChange",d),d.wrap.stop(!0).removeClass("fancybox-opened").find(".fancybox-item, .fancybox-nav").remove());b.unbindEvents();e=a.content;c=a.type;k=a.scrolling;f.extend(b,{wrap:a.wrap,skin:a.skin,
outer:a.outer,inner:a.inner,current:a,previous:d});g=a.href;switch(c){case "inline":case "ajax":case "html":a.selector?e=f("<div>").html(e).find(a.selector):t(e)&&(e.data("fancybox-placeholder")||e.data("fancybox-placeholder",f('<div class="fancybox-placeholder"></div>').insertAfter(e).hide()),e=e.show().detach(),a.wrap.bind("onReset",function(){f(this).find(e).length&&e.hide().replaceAll(e.data("fancybox-placeholder")).data("fancybox-placeholder",!1)}));break;case "image":e=a.tpl.image.replace("{href}",
g);break;case "swf":e='<object id="fancybox-swf" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="100%" height="100%"><param name="movie" value="'+g+'"></param>',h="",f.each(a.swf,function(a,b){e+='<param name="'+a+'" value="'+b+'"></param>';h+=" "+a+'="'+b+'"'}),e+='<embed src="'+g+'" type="application/x-shockwave-flash" width="100%" height="100%"'+h+"></embed></object>"}(!t(e)||!e.parent().is(a.inner))&&a.inner.append(e);b.trigger("beforeShow");a.inner.css("overflow","yes"===k?"scroll":
"no"===k?"hidden":k);b._setDimension();b.reposition();b.isOpen=!1;b.coming=null;b.bindEvents();if(b.isOpened){if(d.prevMethod)b.transitions[d.prevMethod]()}else f(".fancybox-wrap").not(a.wrap).stop(!0).trigger("onReset").remove();b.transitions[b.isOpened?a.nextMethod:a.openMethod]();b._preloadImages()}},_setDimension:function(){var a=b.getViewport(),d=0,e=!1,c=!1,e=b.wrap,k=b.skin,g=b.inner,h=b.current,c=h.width,j=h.height,m=h.minWidth,u=h.minHeight,n=h.maxWidth,p=h.maxHeight,s=h.scrolling,q=h.scrollOutside?
h.scrollbarWidth:0,x=h.margin,y=l(x[1]+x[3]),r=l(x[0]+x[2]),v,z,t,C,A,F,B,D,H;e.add(k).add(g).width("auto").height("auto").removeClass("fancybox-tmp");x=l(k.outerWidth(!0)-k.width());v=l(k.outerHeight(!0)-k.height());z=y+x;t=r+v;C=E(c)?(a.w-z)*l(c)/100:c;A=E(j)?(a.h-t)*l(j)/100:j;if("iframe"===h.type){if(H=h.content,h.autoHeight&&1===H.data("ready"))try{H[0].contentWindow.document.location&&(g.width(C).height(9999),F=H.contents().find("body"),q&&F.css("overflow-x","hidden"),A=F.outerHeight(!0))}catch(G){}}else if(h.autoWidth||
h.autoHeight)g.addClass("fancybox-tmp"),h.autoWidth||g.width(C),h.autoHeight||g.height(A),h.autoWidth&&(C=g.width()),h.autoHeight&&(A=g.height()),g.removeClass("fancybox-tmp");c=l(C);j=l(A);D=C/A;m=l(E(m)?l(m,"w")-z:m);n=l(E(n)?l(n,"w")-z:n);u=l(E(u)?l(u,"h")-t:u);p=l(E(p)?l(p,"h")-t:p);F=n;B=p;h.fitToView&&(n=Math.min(a.w-z,n),p=Math.min(a.h-t,p));z=a.w-y;r=a.h-r;h.aspectRatio?(c>n&&(c=n,j=l(c/D)),j>p&&(j=p,c=l(j*D)),c<m&&(c=m,j=l(c/D)),j<u&&(j=u,c=l(j*D))):(c=Math.max(m,Math.min(c,n)),h.autoHeight&&
"iframe"!==h.type&&(g.width(c),j=g.height()),j=Math.max(u,Math.min(j,p)));if(h.fitToView)if(g.width(c).height(j),e.width(c+x),a=e.width(),y=e.height(),h.aspectRatio)for(;(a>z||y>r)&&(c>m&&j>u)&&!(19<d++);)j=Math.max(u,Math.min(p,j-10)),c=l(j*D),c<m&&(c=m,j=l(c/D)),c>n&&(c=n,j=l(c/D)),g.width(c).height(j),e.width(c+x),a=e.width(),y=e.height();else c=Math.max(m,Math.min(c,c-(a-z))),j=Math.max(u,Math.min(j,j-(y-r)));q&&("auto"===s&&j<A&&c+x+q<z)&&(c+=q);g.width(c).height(j);e.width(c+x);a=e.width();
y=e.height();e=(a>z||y>r)&&c>m&&j>u;c=h.aspectRatio?c<F&&j<B&&c<C&&j<A:(c<F||j<B)&&(c<C||j<A);f.extend(h,{dim:{width:w(a),height:w(y)},origWidth:C,origHeight:A,canShrink:e,canExpand:c,wPadding:x,hPadding:v,wrapSpace:y-k.outerHeight(!0),skinSpace:k.height()-j});!H&&(h.autoHeight&&j>u&&j<p&&!c)&&g.height("auto")},_getPosition:function(a){var d=b.current,e=b.getViewport(),c=d.margin,f=b.wrap.width()+c[1]+c[3],g=b.wrap.height()+c[0]+c[2],c={position:"absolute",top:c[0],left:c[3]};d.autoCenter&&d.fixed&&
!a&&g<=e.h&&f<=e.w?c.position="fixed":d.locked||(c.top+=e.y,c.left+=e.x);c.top=w(Math.max(c.top,c.top+(e.h-g)*d.topRatio));c.left=w(Math.max(c.left,c.left+(e.w-f)*d.leftRatio));return c},_afterZoomIn:function(){var a=b.current;a&&(b.isOpen=b.isOpened=!0,b.wrap.css("overflow","visible").addClass("fancybox-opened"),b.update(),(a.closeClick||a.nextClick&&1<b.group.length)&&b.inner.css("cursor","pointer").bind("click.fb",function(d){!f(d.target).is("a")&&!f(d.target).parent().is("a")&&(d.preventDefault(),
b[a.closeClick?"close":"next"]())}),a.closeBtn&&f(a.tpl.closeBtn).appendTo(b.skin).bind("click.fb",function(a){a.preventDefault();b.close()}),a.arrows&&1<b.group.length&&((a.loop||0<a.index)&&f(a.tpl.prev).appendTo(b.outer).bind("click.fb",b.prev),(a.loop||a.index<b.group.length-1)&&f(a.tpl.next).appendTo(b.outer).bind("click.fb",b.next)),b.trigger("afterShow"),!a.loop&&a.index===a.group.length-1?b.play(!1):b.opts.autoPlay&&!b.player.isActive&&(b.opts.autoPlay=!1,b.play()))},_afterZoomOut:function(a){a=
a||b.current;f(".fancybox-wrap").trigger("onReset").remove();f.extend(b,{group:{},opts:{},router:!1,current:null,isActive:!1,isOpened:!1,isOpen:!1,isClosing:!1,wrap:null,skin:null,outer:null,inner:null});b.trigger("afterClose",a)}});b.transitions={getOrigPosition:function(){var a=b.current,d=a.element,e=a.orig,c={},f=50,g=50,h=a.hPadding,j=a.wPadding,m=b.getViewport();!e&&(a.isDom&&d.is(":visible"))&&(e=d.find("img:first"),e.length||(e=d));t(e)?(c=e.offset(),e.is("img")&&(f=e.outerWidth(),g=e.outerHeight())):
(c.top=m.y+(m.h-g)*a.topRatio,c.left=m.x+(m.w-f)*a.leftRatio);if("fixed"===b.wrap.css("position")||a.locked)c.top-=m.y,c.left-=m.x;return c={top:w(c.top-h*a.topRatio),left:w(c.left-j*a.leftRatio),width:w(f+j),height:w(g+h)}},step:function(a,d){var e,c,f=d.prop;c=b.current;var g=c.wrapSpace,h=c.skinSpace;if("width"===f||"height"===f)e=d.end===d.start?1:(a-d.start)/(d.end-d.start),b.isClosing&&(e=1-e),c="width"===f?c.wPadding:c.hPadding,c=a-c,b.skin[f](l("width"===f?c:c-g*e)),b.inner[f](l("width"===
f?c:c-g*e-h*e))},zoomIn:function(){var a=b.current,d=a.pos,e=a.openEffect,c="elastic"===e,k=f.extend({opacity:1},d);delete k.position;c?(d=this.getOrigPosition(),a.openOpacity&&(d.opacity=0.1)):"fade"===e&&(d.opacity=0.1);b.wrap.css(d).animate(k,{duration:"none"===e?0:a.openSpeed,easing:a.openEasing,step:c?this.step:null,complete:b._afterZoomIn})},zoomOut:function(){var a=b.current,d=a.closeEffect,e="elastic"===d,c={opacity:0.1};e&&(c=this.getOrigPosition(),a.closeOpacity&&(c.opacity=0.1));b.wrap.animate(c,
{duration:"none"===d?0:a.closeSpeed,easing:a.closeEasing,step:e?this.step:null,complete:b._afterZoomOut})},changeIn:function(){var a=b.current,d=a.nextEffect,e=a.pos,c={opacity:1},f=b.direction,g;e.opacity=0.1;"elastic"===d&&(g="down"===f||"up"===f?"top":"left","down"===f||"right"===f?(e[g]=w(l(e[g])-200),c[g]="+=200px"):(e[g]=w(l(e[g])+200),c[g]="-=200px"));"none"===d?b._afterZoomIn():b.wrap.css(e).animate(c,{duration:a.nextSpeed,easing:a.nextEasing,complete:b._afterZoomIn})},changeOut:function(){var a=
b.previous,d=a.prevEffect,e={opacity:0.1},c=b.direction;"elastic"===d&&(e["down"===c||"up"===c?"top":"left"]=("up"===c||"left"===c?"-":"+")+"=200px");a.wrap.animate(e,{duration:"none"===d?0:a.prevSpeed,easing:a.prevEasing,complete:function(){f(this).trigger("onReset").remove()}})}};b.helpers.overlay={defaults:{closeClick:!0,speedOut:200,showEarly:!0,css:{},locked:!s,fixed:!0},overlay:null,fixed:!1,el:f("html"),create:function(a){a=f.extend({},this.defaults,a);this.overlay&&this.close();this.overlay=
f('<div class="fancybox-overlay"></div>').appendTo(b.coming?b.coming.parent:a.parent);this.fixed=!1;a.fixed&&b.defaults.fixed&&(this.overlay.addClass("fancybox-overlay-fixed"),this.fixed=!0)},open:function(a){var d=this;a=f.extend({},this.defaults,a);this.overlay?this.overlay.unbind(".overlay").width("auto").height("auto"):this.create(a);this.fixed||(n.bind("resize.overlay",f.proxy(this.update,this)),this.update());a.closeClick&&this.overlay.bind("click.overlay",function(a){if(f(a.target).hasClass("fancybox-overlay"))return b.isActive?
b.close():d.close(),!1});this.overlay.css(a.css).show()},close:function(){var a,b;n.unbind("resize.overlay");this.el.hasClass("fancybox-lock")&&(f(".fancybox-margin").removeClass("fancybox-margin"),a=n.scrollTop(),b=n.scrollLeft(),this.el.removeClass("fancybox-lock"),n.scrollTop(a).scrollLeft(b));f(".fancybox-overlay").remove().hide();f.extend(this,{overlay:null,fixed:!1})},update:function(){var a="100%",b;this.overlay.width(a).height("100%");I?(b=Math.max(G.documentElement.offsetWidth,G.body.offsetWidth),
p.width()>b&&(a=p.width())):p.width()>n.width()&&(a=p.width());this.overlay.width(a).height(p.height())},onReady:function(a,b){var e=this.overlay;f(".fancybox-overlay").stop(!0,!0);e||this.create(a);a.locked&&(this.fixed&&b.fixed)&&(e||(this.margin=p.height()>n.height()?f("html").css("margin-right").replace("px",""):!1),b.locked=this.overlay.append(b.wrap),b.fixed=!1);!0===a.showEarly&&this.beforeShow.apply(this,arguments)},beforeShow:function(a,b){var e,c;b.locked&&(!1!==this.margin&&(f("*").filter(function(){return"fixed"===
f(this).css("position")&&!f(this).hasClass("fancybox-overlay")&&!f(this).hasClass("fancybox-wrap")}).addClass("fancybox-margin"),this.el.addClass("fancybox-margin")),e=n.scrollTop(),c=n.scrollLeft(),this.el.addClass("fancybox-lock"),n.scrollTop(e).scrollLeft(c));this.open(a)},onUpdate:function(){this.fixed||this.update()},afterClose:function(a){this.overlay&&!b.coming&&this.overlay.fadeOut(a.speedOut,f.proxy(this.close,this))}};b.helpers.title={defaults:{type:"float",position:"bottom"},beforeShow:function(a){var d=
b.current,e=d.title,c=a.type;f.isFunction(e)&&(e=e.call(d.element,d));if(q(e)&&""!==f.trim(e)){d=f('<div class="fancybox-title fancybox-title-'+c+'-wrap">'+e+"</div>");switch(c){case "inside":c=b.skin;break;case "outside":c=b.wrap;break;case "over":c=b.inner;break;default:c=b.skin,d.appendTo("body"),I&&d.width(d.width()),d.wrapInner('<span class="child"></span>'),b.current.margin[2]+=Math.abs(l(d.css("margin-bottom")))}d["top"===a.position?"prependTo":"appendTo"](c)}}};f.fn.fancybox=function(a){var d,
e=f(this),c=this.selector||"",k=function(g){var h=f(this).blur(),j=d,k,l;!g.ctrlKey&&(!g.altKey&&!g.shiftKey&&!g.metaKey)&&!h.is(".fancybox-wrap")&&(k=a.groupAttr||"data-fancybox-group",l=h.attr(k),l||(k="rel",l=h.get(0)[k]),l&&(""!==l&&"nofollow"!==l)&&(h=c.length?f(c):e,h=h.filter("["+k+'="'+l+'"]'),j=h.index(this)),a.index=j,!1!==b.open(h,a)&&g.preventDefault())};a=a||{};d=a.index||0;!c||!1===a.live?e.unbind("click.fb-start").bind("click.fb-start",k):p.undelegate(c,"click.fb-start").delegate(c+
":not('.fancybox-item, .fancybox-nav')","click.fb-start",k);this.filter("[data-fancybox-start=1]").trigger("click");return this};p.ready(function(){var a,d;f.scrollbarWidth===v&&(f.scrollbarWidth=function(){var a=f('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo("body"),b=a.children(),b=b.innerWidth()-b.height(99).innerWidth();a.remove();return b});if(f.support.fixedPosition===v){a=f.support;d=f('<div style="position:fixed;top:20px;"></div>').appendTo("body");var e=20===
d[0].offsetTop||15===d[0].offsetTop;d.remove();a.fixedPosition=e}f.extend(b.defaults,{scrollbarWidth:f.scrollbarWidth(),fixed:f.support.fixedPosition,parent:f("body")});a=f(r).width();J.addClass("fancybox-lock-test");d=f(r).width();J.removeClass("fancybox-lock-test");f("<style type='text/css'>.fancybox-margin{margin-right:"+(d-a)+"px;}</style>").appendTo("head")})})(window,document,jQuery);
 /*!
 * Buttons helper for fancyBox
 * version: 1.0.5 (Mon, 15 Oct 2012)
 * @requires fancyBox v2.0 or later
 *
 * Usage:
 *     $(".fancybox").fancybox({
 *         helpers : {
 *             buttons: {
 *                 position : 'top'
 *             }
 *         }
 *     });
 *
 */
(function ($) {
	//Shortcut for fancyBox object
	var F = $.fancybox;

	//Add helper object
	F.helpers.buttons = {
		defaults : {
			skipSingle : false, // disables if gallery contains single image
			position   : 'top', // 'top' or 'bottom'
			tpl        : '<div id="fancybox-buttons"><ul><li><a class="btnPrev" title="Previous" href="javascript:;"></a></li><li><a class="btnPlay" title="Start slideshow" href="javascript:;"></a></li><li><a class="btnNext" title="Next" href="javascript:;"></a></li><li><a class="btnToggle" title="Toggle size" href="javascript:;"></a></li><li><a class="btnClose" title="Close" href="javascript:;"></a></li></ul></div>'
		},

		list : null,
		buttons: null,

		beforeLoad: function (opts, obj) {
			//Remove self if gallery do not have at least two items

			if (opts.skipSingle && obj.group.length < 2) {
				obj.helpers.buttons = false;
				obj.closeBtn = true;

				return;
			}

			//Increase top margin to give space for buttons
			obj.margin[ opts.position === 'bottom' ? 2 : 0 ] += 30;
		},

		onPlayStart: function () {
			if (this.buttons) {
				this.buttons.play.attr('title', 'Pause slideshow').addClass('btnPlayOn');
			}
		},

		onPlayEnd: function () {
			if (this.buttons) {
				this.buttons.play.attr('title', 'Start slideshow').removeClass('btnPlayOn');
			}
		},

		afterShow: function (opts, obj) {
			var buttons = this.buttons;

			if (!buttons) {
				this.list = $(opts.tpl).addClass(opts.position).appendTo('body');

				buttons = {
					prev   : this.list.find('.btnPrev').click( F.prev ),
					next   : this.list.find('.btnNext').click( F.next ),
					play   : this.list.find('.btnPlay').click( F.play ),
					toggle : this.list.find('.btnToggle').click( F.toggle ),
					close  : this.list.find('.btnClose').click( F.close )
				}
			}

			//Prev
			if (obj.index > 0 || obj.loop) {
				buttons.prev.removeClass('btnDisabled');
			} else {
				buttons.prev.addClass('btnDisabled');
			}

			//Next / Play
			if (obj.loop || obj.index < obj.group.length - 1) {
				buttons.next.removeClass('btnDisabled');
				buttons.play.removeClass('btnDisabled');

			} else {
				buttons.next.addClass('btnDisabled');
				buttons.play.addClass('btnDisabled');
			}

			this.buttons = buttons;

			this.onUpdate(opts, obj);
		},

		onUpdate: function (opts, obj) {
			var toggle;

			if (!this.buttons) {
				return;
			}

			toggle = this.buttons.toggle.removeClass('btnDisabled btnToggleOn');

			//Size toggle button
			if (obj.canShrink) {
				toggle.addClass('btnToggleOn');

			} else if (!obj.canExpand) {
				toggle.addClass('btnDisabled');
			}
		},

		beforeClose: function () {
			if (this.list) {
				this.list.remove();
			}

			this.list    = null;
			this.buttons = null;
		}
	};

}(jQuery));

/*!
 * Media helper for fancyBox
 * version: 1.0.6 (Fri, 14 Jun 2013)
 * @requires fancyBox v2.0 or later
 *
 * Usage:
 *     $(".fancybox").fancybox({
 *         helpers : {
 *             media: true
 *         }
 *     });
 *
 * Set custom URL parameters:
 *     $(".fancybox").fancybox({
 *         helpers : {
 *             media: {
 *                 youtube : {
 *                     params : {
 *                         autoplay : 0
 *                     }
 *                 }
 *             }
 *         }
 *     });
 *
 * Or:
 *     $(".fancybox").fancybox({,
 *         helpers : {
 *             media: true
 *         },
 *         youtube : {
 *             autoplay: 0
 *         }
 *     });
 *
 *  Supports:
 *
 *      Youtube
 *          http://www.youtube.com/watch?v=opj24KnzrWo
 *          http://www.youtube.com/embed/opj24KnzrWo
 *          http://youtu.be/opj24KnzrWo
 *			http://www.youtube-nocookie.com/embed/opj24KnzrWo
 *      Vimeo
 *          http://vimeo.com/40648169
 *          http://vimeo.com/channels/staffpicks/38843628
 *          http://vimeo.com/groups/surrealism/videos/36516384
 *          http://player.vimeo.com/video/45074303
 *      Metacafe
 *          http://www.metacafe.com/watch/7635964/dr_seuss_the_lorax_movie_trailer/
 *          http://www.metacafe.com/watch/7635964/
 *      Dailymotion
 *          http://www.dailymotion.com/video/xoytqh_dr-seuss-the-lorax-premiere_people
 *      Twitvid
 *          http://twitvid.com/QY7MD
 *      Twitpic
 *          http://twitpic.com/7p93st
 *      Instagram
 *          http://instagr.am/p/IejkuUGxQn/
 *          http://instagram.com/p/IejkuUGxQn/
 *      Google maps
 *          http://maps.google.com/maps?q=Eiffel+Tower,+Avenue+Gustave+Eiffel,+Paris,+France&t=h&z=17
 *          http://maps.google.com/?ll=48.857995,2.294297&spn=0.007666,0.021136&t=m&z=16
 *          http://maps.google.com/?ll=48.859463,2.292626&spn=0.000965,0.002642&t=m&z=19&layer=c&cbll=48.859524,2.292532&panoid=YJ0lq28OOy3VT2IqIuVY0g&cbp=12,151.58,,0,-15.56
 */
(function ($) {
	"use strict";

	//Shortcut for fancyBox object
	var F = $.fancybox,
		format = function( url, rez, params ) {
			params = params || '';

			if ( $.type( params ) === "object" ) {
				params = $.param(params, true);
			}

			$.each(rez, function(key, value) {
				url = url.replace( '$' + key, value || '' );
			});

			if (params.length) {
				url += ( url.indexOf('?') > 0 ? '&' : '?' ) + params;
			}

			return url;
		};

	//Add helper object
	F.helpers.media = {
		defaults : {
			youtube : {
				matcher : /(youtube\.com|youtu\.be|youtube-nocookie\.com)\/(watch\?v=|v\/|u\/|embed\/?)?(videoseries\?list=(.*)|[\w-]{11}|\?listType=(.*)&list=(.*)).*/i,
				params  : {
					autoplay    : 1,
					autohide    : 1,
					fs          : 1,
					rel         : 0,
					hd          : 1,
					wmode       : 'opaque',
					enablejsapi : 1
				},
				type : 'iframe',
				url  : '//www.youtube.com/embed/$3'
			},
			vimeo : {
				matcher : /(?:vimeo(?:pro)?.com)\/(?:[^\d]+)?(\d+)(?:.*)/,
				params  : {
					autoplay      : 1,
					hd            : 1,
					show_title    : 1,
					show_byline   : 1,
					show_portrait : 0,
					fullscreen    : 1
				},
				type : 'iframe',
				url  : '//player.vimeo.com/video/$1'
			},
			metacafe : {
				matcher : /metacafe.com\/(?:watch|fplayer)\/([\w\-]{1,10})/,
				params  : {
					autoPlay : 'yes'
				},
				type : 'swf',
				url  : function( rez, params, obj ) {
					obj.swf.flashVars = 'playerVars=' + $.param( params, true );

					return '//www.metacafe.com/fplayer/' + rez[1] + '/.swf';
				}
			},
			dailymotion : {
				matcher : /dailymotion.com\/video\/(.*)\/?(.*)/,
				params  : {
					additionalInfos : 0,
					autoStart : 1
				},
				type : 'swf',
				url  : '//www.dailymotion.com/swf/video/$1'
			},
			twitvid : {
				matcher : /twitvid\.com\/([a-zA-Z0-9_\-\?\=]+)/i,
				params  : {
					autoplay : 0
				},
				type : 'iframe',
				url  : '//www.twitvid.com/embed.php?guid=$1'
			},
			twitpic : {
				matcher : /twitpic\.com\/(?!(?:place|photos|events)\/)([a-zA-Z0-9\?\=\-]+)/i,
				type : 'image',
				url  : '//twitpic.com/show/full/$1/'
			},
			instagram : {
				matcher : /(instagr\.am|instagram\.com)\/p\/([a-zA-Z0-9_\-]+)\/?/i,
				type : 'image',
				url  : '//$1/p/$2/media/?size=l'
			},
			google_maps : {
				matcher : /maps\.google\.([a-z]{2,3}(\.[a-z]{2})?)\/(\?ll=|maps\?)(.*)/i,
				type : 'iframe',
				url  : function( rez ) {
					return '//maps.google.' + rez[1] + '/' + rez[3] + '' + rez[4] + '&output=' + (rez[4].indexOf('layer=c') > 0 ? 'svembed' : 'embed');
				}
			}
		},

		beforeLoad : function(opts, obj) {
			var url   = obj.href || '',
				type  = false,
				what,
				item,
				rez,
				params;

			for (what in opts) {
				if (opts.hasOwnProperty(what)) {
					item = opts[ what ];
					rez  = url.match( item.matcher );

					if (rez) {
						type   = item.type;
						params = $.extend(true, {}, item.params, obj[ what ] || ($.isPlainObject(opts[ what ]) ? opts[ what ].params : null));

						url = $.type( item.url ) === "function" ? item.url.call( this, rez, params, obj ) : format( item.url, rez, params );

						break;
					}
				}
			}

			if (type) {
				obj.href = url;
				obj.type = type;

				obj.autoHeight = false;
			}
		}
	};

}(jQuery));
 /*!
 * Thumbnail helper for fancyBox
 * version: 1.0.7 (Mon, 01 Oct 2012)
 * @requires fancyBox v2.0 or later
 *
 * Usage:
 *     $(".fancybox").fancybox({
 *         helpers : {
 *             thumbs: {
 *                 width  : 50,
 *                 height : 50
 *             }
 *         }
 *     });
 *
 */
(function ($) {
	//Shortcut for fancyBox object
	var F = $.fancybox;

	//Add helper object
	F.helpers.thumbs = {
		defaults : {
			width    : 50,       // thumbnail width
			height   : 50,       // thumbnail height
			position : 'bottom', // 'top' or 'bottom'
			source   : function ( item ) {  // function to obtain the URL of the thumbnail image
				var href;

				if (item.element) {
					href = $(item.element).find('img').attr('src');
				}

				if (!href && item.type === 'image' && item.href) {
					href = item.href;
				}

				return href;
			}
		},

		wrap  : null,
		list  : null,
		width : 0,

		init: function (opts, obj) {
			var that = this,
				list,
				thumbWidth  = opts.width,
				thumbHeight = opts.height,
				thumbSource = opts.source;

			//Build list structure
			list = '';

			for (var n = 0; n < obj.group.length; n++) {
				list += '<li><a style="width:' + thumbWidth + 'px;height:' + thumbHeight + 'px;" href="javascript:jQuery.fancybox.jumpto(' + n + ');"></a></li>';
			}

			this.wrap = $('<div id="fancybox-thumbs"></div>').addClass(opts.position).appendTo('body');
			this.list = $('<ul>' + list + '</ul>').appendTo(this.wrap);

			//Load each thumbnail
			$.each(obj.group, function (i) {
				var href = thumbSource( obj.group[ i ] );

				if (!href) {
					return;
				}

				$("<img />").load(function () {
					var width  = this.width,
						height = this.height,
						widthRatio, heightRatio, parent;

					if (!that.list || !width || !height) {
						return;
					}

					//Calculate thumbnail width/height and center it
					widthRatio  = width / thumbWidth;
					heightRatio = height / thumbHeight;

					parent = that.list.children().eq(i).find('a');

					if (widthRatio >= 1 && heightRatio >= 1) {
						if (widthRatio > heightRatio) {
							width  = Math.floor(width / heightRatio);
							height = thumbHeight;

						} else {
							width  = thumbWidth;
							height = Math.floor(height / widthRatio);
						}
					}

					$(this).css({
						width  : width,
						height : height,
						top    : Math.floor(thumbHeight / 2 - height / 2),
						left   : Math.floor(thumbWidth / 2 - width / 2)
					});

					parent.width(thumbWidth).height(thumbHeight);

					$(this).hide().appendTo(parent).fadeIn(300);

				}).attr('src', href);
			});

			//Set initial width
			this.width = this.list.children().eq(0).outerWidth(true);

			this.list.width(this.width * (obj.group.length + 1)).css('left', Math.floor($(window).width() * 0.5 - (obj.index * this.width + this.width * 0.5)));
		},

		beforeLoad: function (opts, obj) {
			//Remove self if gallery do not have at least two items
			if (obj.group.length < 2) {
				obj.helpers.thumbs = false;

				return;
			}

			//Increase bottom margin to give space for thumbs
			obj.margin[ opts.position === 'top' ? 0 : 2 ] += ((opts.height) + 15);
		},

		afterShow: function (opts, obj) {
			//Check if exists and create or update list
			if (this.list) {
				this.onUpdate(opts, obj);

			} else {
				this.init(opts, obj);
			}

			//Set active element
			this.list.children().removeClass('active').eq(obj.index).addClass('active');
		},

		//Center list
		onUpdate: function (opts, obj) {
			if (this.list) {
				this.list.stop(true).animate({
					'left': Math.floor($(window).width() * 0.5 - (obj.index * this.width + this.width * 0.5))
				}, 150);
			}
		},

		beforeClose: function () {
			if (this.wrap) {
				this.wrap.remove();
			}

			this.wrap  = null;
			this.list  = null;
			this.width = 0;
		}
	}

}(jQuery));
/*
 * jQuery MiniColors: A tiny color picker built on jQuery
 *
 * Copyright Cory LaViska for A Beautiful Site, LLC. (http://www.abeautifulsite.net/)
 *
 * Licensed under the MIT license: http://opensource.org/licenses/MIT
 *
 */
jQuery&&function(a){function b(b,c){var d=a('<div class="minicolors" />'),e=a.minicolors.defaults;b.data("minicolors-initialized")||(c=a.extend(!0,{},e,c),d.addClass("minicolors-theme-"+c.theme).toggleClass("minicolors-with-opacity",c.opacity),void 0!==c.position&&a.each(c.position.split(" "),function(){d.addClass("minicolors-position-"+this)}),b.addClass("minicolors-input").data("minicolors-initialized",!1).data("minicolors-settings",c).prop("size",7).wrap(d).after('<div class="minicolors-panel minicolors-slider-'+c.control+'">'+'<div class="minicolors-slider">'+'<div class="minicolors-picker"></div>'+"</div>"+'<div class="minicolors-opacity-slider">'+'<div class="minicolors-picker"></div>'+"</div>"+'<div class="minicolors-grid">'+'<div class="minicolors-grid-inner"></div>'+'<div class="minicolors-picker"><div></div></div>'+"</div>"+"</div>"),c.inline||(b.after('<span class="minicolors-swatch"><span class="minicolors-swatch-color"></span></span>'),b.next(".minicolors-swatch").on("click",function(a){a.preventDefault(),b.focus()})),b.parent().find(".minicolors-panel").on("selectstart",function(){return!1}).end(),c.inline&&b.parent().addClass("minicolors-inline"),h(b,!1),b.data("minicolors-initialized",!0))}function c(a){var b=a.parent();a.removeData("minicolors-initialized").removeData("minicolors-settings").removeProp("size").removeClass("minicolors-input"),b.before(a).remove()}function d(a){var b=a.parent(),c=b.find(".minicolors-panel"),d=a.data("minicolors-settings");!a.data("minicolors-initialized")||a.prop("disabled")||b.hasClass("minicolors-inline")||b.hasClass("minicolors-focus")||(e(),b.addClass("minicolors-focus"),c.stop(!0,!0).fadeIn(d.showSpeed,function(){d.show&&d.show.call(a.get(0))}))}function e(){a(".minicolors-focus").each(function(){var b=a(this),c=b.find(".minicolors-input"),d=b.find(".minicolors-panel"),e=c.data("minicolors-settings");d.fadeOut(e.hideSpeed,function(){e.hide&&e.hide.call(c.get(0)),b.removeClass("minicolors-focus")})})}function f(a,b,c){var m,n,o,p,d=a.parents(".minicolors").find(".minicolors-input"),e=d.data("minicolors-settings"),f=a.find("[class$=-picker]"),h=a.offset().left,i=a.offset().top,j=Math.round(b.pageX-h),k=Math.round(b.pageY-i),l=c?e.animationSpeed:0;b.originalEvent.changedTouches&&(j=b.originalEvent.changedTouches[0].pageX-h,k=b.originalEvent.changedTouches[0].pageY-i),0>j&&(j=0),0>k&&(k=0),j>a.width()&&(j=a.width()),k>a.height()&&(k=a.height()),a.parent().is(".minicolors-slider-wheel")&&f.parent().is(".minicolors-grid")&&(m=75-j,n=75-k,o=Math.sqrt(m*m+n*n),p=Math.atan2(n,m),0>p&&(p+=2*Math.PI),o>75&&(o=75,j=75-75*Math.cos(p),k=75-75*Math.sin(p)),j=Math.round(j),k=Math.round(k)),a.is(".minicolors-grid")?f.stop(!0).animate({top:k+"px",left:j+"px"},l,e.animationEasing,function(){g(d,a)}):f.stop(!0).animate({top:k+"px"},l,e.animationEasing,function(){g(d,a)})}function g(a,b){function c(a,b){var c,d;return a.length&&b?(c=a.offset().left,d=a.offset().top,{x:c-b.offset().left+a.outerWidth()/2,y:d-b.offset().top+a.outerHeight()/2}):null}var d,e,f,g,h,j,k,m=a.val(),o=a.attr("data-opacity"),p=a.parent(),r=a.data("minicolors-settings"),s=p.find(".minicolors-swatch"),t=p.find(".minicolors-grid"),u=p.find(".minicolors-slider"),v=p.find(".minicolors-opacity-slider"),w=t.find("[class$=-picker]"),x=u.find("[class$=-picker]"),y=v.find("[class$=-picker]"),z=c(w,t),A=c(x,u),B=c(y,v);if(b.is(".minicolors-grid, .minicolors-slider")){switch(r.control){case"wheel":g=t.width()/2-z.x,h=t.height()/2-z.y,j=Math.sqrt(g*g+h*h),k=Math.atan2(h,g),0>k&&(k+=2*Math.PI),j>75&&(j=75,z.x=69-75*Math.cos(k),z.y=69-75*Math.sin(k)),e=n(j/.75,0,100),d=n(180*k/Math.PI,0,360),f=n(100-Math.floor(A.y*(100/u.height())),0,100),m=q({h:d,s:e,b:f}),u.css("backgroundColor",q({h:d,s:e,b:100}));break;case"saturation":d=n(parseInt(z.x*(360/t.width()),10),0,360),e=n(100-Math.floor(A.y*(100/u.height())),0,100),f=n(100-Math.floor(z.y*(100/t.height())),0,100),m=q({h:d,s:e,b:f}),u.css("backgroundColor",q({h:d,s:100,b:f})),p.find(".minicolors-grid-inner").css("opacity",e/100);break;case"brightness":d=n(parseInt(z.x*(360/t.width()),10),0,360),e=n(100-Math.floor(z.y*(100/t.height())),0,100),f=n(100-Math.floor(A.y*(100/u.height())),0,100),m=q({h:d,s:e,b:f}),u.css("backgroundColor",q({h:d,s:e,b:100})),p.find(".minicolors-grid-inner").css("opacity",1-f/100);break;default:d=n(360-parseInt(A.y*(360/u.height()),10),0,360),e=n(Math.floor(z.x*(100/t.width())),0,100),f=n(100-Math.floor(z.y*(100/t.height())),0,100),m=q({h:d,s:e,b:f}),t.css("backgroundColor",q({h:d,s:100,b:100}))}a.val(l(m,r.letterCase))}b.is(".minicolors-opacity-slider")&&(o=r.opacity?parseFloat(1-B.y/v.height()).toFixed(2):1,r.opacity&&a.attr("data-opacity",o)),s.find("SPAN").css({backgroundColor:m,opacity:o}),i(a,m,o)}function h(a,b){var c,d,e,f,g,h,j,k=a.parent(),o=a.data("minicolors-settings"),p=k.find(".minicolors-swatch"),s=k.find(".minicolors-grid"),t=k.find(".minicolors-slider"),u=k.find(".minicolors-opacity-slider"),v=s.find("[class$=-picker]"),w=t.find("[class$=-picker]"),x=u.find("[class$=-picker]");switch(c=l(m(a.val(),!0),o.letterCase),c||(c=l(m(o.defaultValue,!0),o.letterCase)),d=r(c),b||a.val(c),o.opacity&&(e=""===a.attr("data-opacity")?1:n(parseFloat(a.attr("data-opacity")).toFixed(2),0,1),isNaN(e)&&(e=1),a.attr("data-opacity",e),p.find("SPAN").css("opacity",e),g=n(u.height()-u.height()*e,0,u.height()),x.css("top",g+"px")),p.find("SPAN").css("backgroundColor",c),o.control){case"wheel":h=n(Math.ceil(.75*d.s),0,s.height()/2),j=d.h*Math.PI/180,f=n(75-Math.cos(j)*h,0,s.width()),g=n(75-Math.sin(j)*h,0,s.height()),v.css({top:g+"px",left:f+"px"}),g=150-d.b/(100/s.height()),""===c&&(g=0),w.css("top",g+"px"),t.css("backgroundColor",q({h:d.h,s:d.s,b:100}));break;case"saturation":f=n(5*d.h/12,0,150),g=n(s.height()-Math.ceil(d.b/(100/s.height())),0,s.height()),v.css({top:g+"px",left:f+"px"}),g=n(t.height()-d.s*(t.height()/100),0,t.height()),w.css("top",g+"px"),t.css("backgroundColor",q({h:d.h,s:100,b:d.b})),k.find(".minicolors-grid-inner").css("opacity",d.s/100);break;case"brightness":f=n(5*d.h/12,0,150),g=n(s.height()-Math.ceil(d.s/(100/s.height())),0,s.height()),v.css({top:g+"px",left:f+"px"}),g=n(t.height()-d.b*(t.height()/100),0,t.height()),w.css("top",g+"px"),t.css("backgroundColor",q({h:d.h,s:d.s,b:100})),k.find(".minicolors-grid-inner").css("opacity",1-d.b/100);break;default:f=n(Math.ceil(d.s/(100/s.width())),0,s.width()),g=n(s.height()-Math.ceil(d.b/(100/s.height())),0,s.height()),v.css({top:g+"px",left:f+"px"}),g=n(t.height()-d.h/(360/t.height()),0,t.height()),w.css("top",g+"px"),s.css("backgroundColor",q({h:d.h,s:100,b:100}))}a.data("minicolors-initialized")&&i(a,c,e)}function i(a,b,c){var d=a.data("minicolors-settings"),e=a.data("minicolors-lastChange");e&&e.hex===b&&e.opacity===c||(a.data("minicolors-lastChange",{hex:b,opacity:c}),d.change&&(d.changeDelay?(clearTimeout(a.data("minicolors-changeTimeout")),a.data("minicolors-changeTimeout",setTimeout(function(){d.change.call(a.get(0),b,c)},d.changeDelay))):d.change.call(a.get(0),b,c)),a.trigger("change").trigger("input"))}function j(b){var c=m(a(b).val(),!0),d=t(c),e=a(b).attr("data-opacity");return d?(void 0!==e&&a.extend(d,{a:parseFloat(e)}),d):null}function k(b,c){var d=m(a(b).val(),!0),e=t(d),f=a(b).attr("data-opacity");return e?(void 0===f&&(f=1),c?"rgba("+e.r+", "+e.g+", "+e.b+", "+parseFloat(f)+")":"rgb("+e.r+", "+e.g+", "+e.b+")"):null}function l(a,b){return"uppercase"===b?a.toUpperCase():a.toLowerCase()}function m(a,b){return a=a.replace(/[^A-F0-9]/gi,""),3!==a.length&&6!==a.length?"":(3===a.length&&b&&(a=a[0]+a[0]+a[1]+a[1]+a[2]+a[2]),"#"+a)}function n(a,b,c){return b>a&&(a=b),a>c&&(a=c),a}function o(a){var b={},c=Math.round(a.h),d=Math.round(255*a.s/100),e=Math.round(255*a.b/100);if(0===d)b.r=b.g=b.b=e;else{var f=e,g=(255-d)*e/255,h=(f-g)*(c%60)/60;360===c&&(c=0),60>c?(b.r=f,b.b=g,b.g=g+h):120>c?(b.g=f,b.b=g,b.r=f-h):180>c?(b.g=f,b.r=g,b.b=g+h):240>c?(b.b=f,b.r=g,b.g=f-h):300>c?(b.b=f,b.g=g,b.r=g+h):360>c?(b.r=f,b.g=g,b.b=f-h):(b.r=0,b.g=0,b.b=0)}return{r:Math.round(b.r),g:Math.round(b.g),b:Math.round(b.b)}}function p(b){var c=[b.r.toString(16),b.g.toString(16),b.b.toString(16)];return a.each(c,function(a,b){1===b.length&&(c[a]="0"+b)}),"#"+c.join("")}function q(a){return p(o(a))}function r(a){var b=s(t(a));return 0===b.s&&(b.h=360),b}function s(a){var b={h:0,s:0,b:0},c=Math.min(a.r,a.g,a.b),d=Math.max(a.r,a.g,a.b),e=d-c;return b.b=d,b.s=0!==d?255*e/d:0,b.h=0!==b.s?a.r===d?(a.g-a.b)/e:a.g===d?2+(a.b-a.r)/e:4+(a.r-a.g)/e:-1,b.h*=60,b.h<0&&(b.h+=360),b.s*=100/255,b.b*=100/255,b}function t(a){return a=parseInt(a.indexOf("#")>-1?a.substring(1):a,16),{r:a>>16,g:(65280&a)>>8,b:255&a}}a.minicolors={defaults:{animationSpeed:50,animationEasing:"swing",change:null,changeDelay:0,control:"hue",defaultValue:"",hide:null,hideSpeed:100,inline:!1,letterCase:"lowercase",opacity:!1,position:"bottom left",show:null,showSpeed:100,theme:"default"}},a.extend(a.fn,{minicolors:function(f,g){switch(f){case"destroy":return a(this).each(function(){c(a(this))}),a(this);case"hide":return e(),a(this);case"opacity":return void 0===g?a(this).attr("data-opacity"):(a(this).each(function(){h(a(this).attr("data-opacity",g))}),a(this));case"rgbObject":return j(a(this),"rgbaObject"===f);case"rgbString":case"rgbaString":return k(a(this),"rgbaString"===f);case"settings":return void 0===g?a(this).data("minicolors-settings"):(a(this).each(function(){var b=a(this).data("minicolors-settings")||{};c(a(this)),a(this).minicolors(a.extend(!0,b,g))}),a(this));case"show":return d(a(this).eq(0)),a(this);case"value":return void 0===g?a(this).val():(a(this).each(function(){h(a(this).val(g))}),a(this));default:return"create"!==f&&(g=f),a(this).each(function(){b(a(this),g)}),a(this)}}}),a(document).on("mousedown.minicolors touchstart.minicolors",function(b){a(b.target).parents().add(b.target).hasClass("minicolors")||e()}).on("mousedown.minicolors touchstart.minicolors",".minicolors-grid, .minicolors-slider, .minicolors-opacity-slider",function(b){var c=a(this);b.preventDefault(),a(document).data("minicolors-target",c),f(c,b,!0)}).on("mousemove.minicolors touchmove.minicolors",function(b){var c=a(document).data("minicolors-target");c&&f(c,b)}).on("mouseup.minicolors touchend.minicolors",function(){a(this).removeData("minicolors-target")}).on("mousedown.minicolors touchstart.minicolors",".minicolors-swatch",function(b){var c=a(this).parent().find(".minicolors-input");b.preventDefault(),d(c)}).on("focus.minicolors",".minicolors-input",function(){var b=a(this);b.data("minicolors-initialized")&&d(b)}).on("blur.minicolors",".minicolors-input",function(){var b=a(this),c=b.data("minicolors-settings");b.data("minicolors-initialized")&&(b.val(m(b.val(),!0)),""===b.val()&&b.val(m(c.defaultValue,!0)),b.val(l(b.val(),c.letterCase)))}).on("keydown.minicolors",".minicolors-input",function(b){var c=a(this);if(c.data("minicolors-initialized"))switch(b.keyCode){case 9:e();break;case 13:case 27:e(),c.blur()}}).on("keyup.minicolors",".minicolors-input",function(){var b=a(this);b.data("minicolors-initialized")&&h(b,!0)}).on("paste.minicolors",".minicolors-input",function(){var b=a(this);b.data("minicolors-initialized")&&setTimeout(function(){h(b,!0)},1)})}(jQuery);
/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE_AFL.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    design
 * @package     base_default
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 */
if(typeof Product=='undefined') {
    var Product = {};
}
/**************************** BUNDLE PRODUCT **************************/
Product.Bundle = Class.create();
Product.Bundle.prototype = {
    initialize: function(config){
        this.config = config;

        // Set preconfigured values for correct price base calculation
        if (config.defaultValues) {
            for (var option in config.defaultValues) {
                if (this.config['options'][option].isMulti) {
                    var selected = new Array();
                    for (var i = 0; i < config.defaultValues[option].length; i++) {
                        selected.push(config.defaultValues[option][i]);
                    }
                    this.config.selected[option] = selected;
                } else {
                    this.config.selected[option] = new Array(config.defaultValues[option] + "");
                }
            }
        }

        this.reloadPrice();
    },
    changeSelection: function(selection){
        var parts = selection.id.split('-');
        if (this.config['options'][parts[2]].isMulti) {
            selected = new Array();
            if (selection.tagName == 'SELECT') {
                for (var i = 0; i < selection.options.length; i++) {
                    if (selection.options[i].selected && selection.options[i].value != '') {
                        selected.push(selection.options[i].value);
                    }
                }
            } else if (selection.tagName == 'INPUT') {
                selector = parts[0]+'-'+parts[1]+'-'+parts[2];
                selections = $$('.'+selector);
                for (var i = 0; i < selections.length; i++) {
                    if (selections[i].checked && selections[i].value != '') {
                        selected.push(selections[i].value);
                    }
                }
            }
            this.config.selected[parts[2]] = selected;
        } else {
            if (selection.value != '') {
                this.config.selected[parts[2]] = new Array(selection.value);
            } else {
                this.config.selected[parts[2]] = new Array();
            }
            this.populateQty(parts[2], selection.value);
            var tierPriceElement = $('bundle-option-' + parts[2] + '-tier-prices'),
                tierPriceHtml = '';
            if (selection.value != '' && this.config.options[parts[2]].selections[selection.value].customQty == 1) {
                tierPriceHtml = this.config.options[parts[2]].selections[selection.value].tierPriceHtml;
            }
            tierPriceElement.update(tierPriceHtml);
        }
        this.reloadPrice();
    },

    reloadPrice: function() {
        var calculatedPrice = 0;
        var dispositionPrice = 0;
        var includeTaxPrice = 0;

        for (var option in this.config.selected) {
            if (this.config.options[option]) {
                for (var i=0; i < this.config.selected[option].length; i++) {
                    var prices = this.selectionPrice(option, this.config.selected[option][i]);
                    calculatedPrice += Number(prices[0]);
                    dispositionPrice += Number(prices[1]);
                    includeTaxPrice += Number(prices[2]);
                }
            }
        }

        //Tax is calculated in a different way for the the TOTAL BASED method
        //We round the taxes at the end. Hence we do the same for consistency
        //This variable is set in the bundle.phtml
        if (taxCalcMethod == CACL_TOTAL_BASE) {
            var calculatedPriceFormatted = calculatedPrice.toFixed(10);
            var includeTaxPriceFormatted = includeTaxPrice.toFixed(10);
            var tax = includeTaxPriceFormatted - calculatedPriceFormatted;
            calculatedPrice = includeTaxPrice - Math.round(tax * 100) / 100;
        }

        //make sure that the prices are all rounded to two digits
        //this is needed when tax calculation is based on total for dynamic
        //price bundle product. For fixed price bundle product, the rounding
        //needs to be done after option price is added to base price
        if (this.config.priceType == '0') {
            calculatedPrice = Math.round(calculatedPrice*100)/100;
            dispositionPrice = Math.round(dispositionPrice*100)/100;
            includeTaxPrice = Math.round(includeTaxPrice*100)/100;

        }

        var event = $(document).fire('bundle:reload-price', {
            price: calculatedPrice,
            priceInclTax: includeTaxPrice,
            dispositionPrice: dispositionPrice,
            bundle: this
        });
        if (!event.noReloadPrice) {
            optionsPrice.specialTaxPrice = 'true';
            optionsPrice.changePrice('bundle', calculatedPrice);
            optionsPrice.changePrice('nontaxable', dispositionPrice);
            optionsPrice.changePrice('priceInclTax', includeTaxPrice);
            optionsPrice.reload();
        }

        return calculatedPrice;
    },

    selectionPrice: function(optionId, selectionId) {
        if (selectionId == '' || selectionId == 'none') {
            return 0;
        }
        var qty = null;
        var tierPriceInclTax, tierPriceExclTax;
        if (this.config.options[optionId].selections[selectionId].customQty == 1 && !this.config['options'][optionId].isMulti) {
            if ($('bundle-option-' + optionId + '-qty-input')) {
                qty = $('bundle-option-' + optionId + '-qty-input').value;
            } else {
                qty = 1;
            }
        } else {
            qty = this.config.options[optionId].selections[selectionId].qty;
        }
        if (this.config.priceType == '0') {
            price = this.config.options[optionId].selections[selectionId].price;
            tierPrice = this.config.options[optionId].selections[selectionId].tierPrice;

            for (var i=0; i < tierPrice.length; i++) {
                if (Number(tierPrice[i].price_qty) <= qty && Number(tierPrice[i].price) <= price) {
                    price = tierPrice[i].price;
                    tierPriceInclTax = tierPrice[i].priceInclTax;
                    tierPriceExclTax = tierPrice[i].priceExclTax;
                }
            }
        } else {
            selection = this.config.options[optionId].selections[selectionId];
            if (selection.priceType == '0') {
                price = selection.priceValue;
            } else {
                price = (this.config.basePrice*selection.priceValue)/100;
            }
        }
        //price += this.config.options[optionId].selections[selectionId].plusDisposition;
        //price -= this.config.options[optionId].selections[selectionId].minusDisposition;
        //return price*qty;
        var disposition = this.config.options[optionId].selections[selectionId].plusDisposition +
            this.config.options[optionId].selections[selectionId].minusDisposition;

        if (this.config.specialPrice) {
            newPrice = (price*this.config.specialPrice)/100;
            price = Math.min(newPrice, price);
        }

        selection = this.config.options[optionId].selections[selectionId];
        if (tierPriceInclTax !== undefined && tierPriceExclTax !== undefined) {
            priceInclTax = tierPriceInclTax;
            price = tierPriceExclTax;
        } else if (selection.priceInclTax !== undefined) {
            priceInclTax = selection.priceInclTax;
            price = selection.priceExclTax !== undefined ? selection.priceExclTax : selection.price;
        } else {
            priceInclTax = price;
        }

        if (this.config.priceType == '1' || taxCalcMethod == CACL_TOTAL_BASE) {
            var result = new Array(price*qty, disposition*qty, priceInclTax*qty);
            return result;
        }
        else if (taxCalcMethod == CACL_UNIT_BASE) {
            price = (Math.round(price*100)/100).toString();
            disposition = (Math.round(disposition*100)/100).toString();
            priceInclTax = (Math.round(priceInclTax*100)/100).toString();
            var result = new Array(price*qty, disposition*qty, priceInclTax*qty);
            return result;
        } else { //taxCalcMethod == CACL_ROW_BASE)
            price = (Math.round(price*qty*100)/100).toString();
            disposition = (Math.round(disposition*qty*100)/100).toString();
            priceInclTax = (Math.round(priceInclTax*qty*100)/100).toString();
            var result = new Array(price, disposition, priceInclTax);
            return result;
        }
    },

    populateQty: function(optionId, selectionId){
        if (selectionId == '' || selectionId == 'none') {
            this.showQtyInput(optionId, '0', false);
            return;
        }
        if (this.config.options[optionId].selections[selectionId].customQty == 1) {
            this.showQtyInput(optionId, this.config.options[optionId].selections[selectionId].qty, true);
        } else {
            this.showQtyInput(optionId, this.config.options[optionId].selections[selectionId].qty, false);
        }
    },

    showQtyInput: function(optionId, value, canEdit) {
        elem = $('bundle-option-' + optionId + '-qty-input');
        elem.value = value;
        elem.disabled = !canEdit;
        if (canEdit) {
            elem.removeClassName('qty-disabled');
        } else {
            elem.addClassName('qty-disabled');
        }
    },

    changeOptionQty: function (element, event) {
        var checkQty = true;
        if (typeof(event) != 'undefined') {
            if (event.keyCode == 8 || event.keyCode == 46) {
                checkQty = false;
            }
        }
        if (checkQty && (Number(element.value) == 0 || isNaN(Number(element.value)))) {
            element.value = 1;
        }
        parts = element.id.split('-');
        optionId = parts[2];
        if (!this.config['options'][optionId].isMulti) {
            selectionId = this.config.selected[optionId][0];
            this.config.options[optionId].selections[selectionId].qty = element.value*1;
            this.reloadPrice();
        }
    },

    validationCallback: function (elmId, result){
        if (elmId == undefined || $(elmId) == undefined) {
            return;
        }
        var container = $(elmId).up('ul.options-list');
        if (typeof container != 'undefined') {
            if (result == 'failed') {
                container.removeClassName('validation-passed');
                container.addClassName('validation-failed');
            } else {
                container.removeClassName('validation-failed');
                container.addClassName('validation-passed');
            }
        }
    }
}

var bwish=".col-main .my-account";
var btnAddtocartClass = '.btn-cart';
var closeCFirm = 0;
var windown_compare = '';
var deletePCompare = 0;
var winFocus = 1;
var miniCartForm = Class.create();
var CANFLY = 0;
function reURLPoductsSpecial(){
	$$(btnAddtocartClass).each(function(el){
		link = String(el.readAttribute('onclick'));
		if(link.search('checkout/cart/add') != -1 || link.search('options=cart') != -1){

		}else{
			if( link.search("setLocation") != -1 ){
				link = link.replace("')","?options=cart')");
				el.writeAttribute('onclick', link);
			}
		}
	});
}
function aCConstruct(){
	reURLPoductsSpecial();
	if(typeof productAddToCartForm != 'undefined'){	// form productAddtoCartForm exist
		productAddToCartForm.submit = function(args){
			if(this.validator && this.validator.validate())
				callAjax($('product_addtocart_form').action,'form');
			return false;
		};
	}
	reNewLinkDeleteInCart();

	if(ajax_for_compare){
		reNewLinkCompare();
		reNewLinkRemoveCompare();
		reNewLinkClearCompare();
	}
	if(ajax_for_wishlist){
		reNewLinkRemoveWishList();
		if(isLoggedIn=="1") reNewLinkWishList();
		reNewLinkAddToCartInWishList();
	}
	// var for links & blocks
	mycart_link = ($$('.top-link-cart')!='')?'.top-link-cart':'';
	cart_block = '.mini-cart, .block-cart';
	minicart_block = '.mini-cart';
	wishlist_block = ($$('.mini-wishlist')!='')?'.mini-wishlist':'.block-wishlist';
	compare_block = ($$('.mini-compare')!='')?'.mini-compare':'.block-compare';
}


window.popWin = function(url,newwin,para){
	windown_compare = window.open(url,newwin,para);
	windown_compare.focus();
};
window.onunload = function(){
	if(windown_compare){
		windown_compare.close();
	}
};

window.setLocation = function(args){
	if(args.search('checkout/onepage')!=-1 || args.search('catalog/category')!=-1 ){
		window.location=args;
		return;
	}
	if ( (args.search('checkout/cart/add') != -1 || args.search('options=cart') != -1 || args.search('wishlist/index/cart')!=-1 || args.search('wishlist/index/cart')!=-1)){
        callAjax(args,'url');
	}else if (ajax_for_compare && args.search('catalog/product_compare/remove') != -1 ){
		opener.deletePCompare=1;
		if(winFocus){
			opener.isCPPage=1;
			opener.deletePCompare=1;
			opener.focus();
			opener.callAjax(args,'url');
			exit;
		}
		else
			callAjax(args,'url');
	}else{
        window.location.href = args;
    }
};
window.setPLocation= function(args){
	if ( (args.search('checkout/cart/add') != -1 || args.search('options=cart') != -1 ) ){
		if(winFocus){
			opener.isCPPage=1;
			opener.focus();
        	opener.callAjax(args,'url');
		}else{
			callAjax(args,'url');
		}
	}else if(ajax_for_wishlist && args.search('wishlist/index/add')!=-1 ){
		if(opener.isLoggedIn!='0'){
			if(winFocus){
				opener.isCPPage=1;
				opener.focus();
				opener.callAjax(args,'url');
			}else{
				callAjax(args,'url');
			}
		}else{
			opener.focus();
			opener.location.href=args;
		}
	}else{
		opener.focus();
        opener.location.href = args;
    }
};

function reCreateLink(link, msg, hasConfirm, skipAny){
	var _links = document.links;
	for (var i=0; i<_links.length; i++){
		if (_links[i].href.search(link) != -1  ){
			if(typeof skipAny !="undefined" && skipAny !="" && _links[i].href.search(skipAny) != -1) {
				continue;
			}
			_links[i].onclick = function(e){
				e.preventDefault();
				if(typeof hasConfirm =="undefined"){
					callAjax(this.href,'url');
				}
				else{
					if(confirm(msg)){
						closeCFirm = 1;
						callAjax(this.href,'url');
					}
				}
			};
		}
	}
}

function reNewLinkDeleteInCart(){
	reCreateLink('checkout/cart/delete', 'Are you sure you would like to remove this item from the shopping cart?', true, skiplink);
}
function reNewLinkRemoveCompare(){
	reCreateLink('catalog/product_compare/remove', 'Are you sure you would like to remove this item from the Comparison List?', true);
}
function reNewLinkClearCompare(){
	reCreateLink('catalog/product_compare/clear', 'Are you sure you would like to remove all products from your comparison?', true);
}
function reNewLinkCompare(){
	reCreateLink('catalog/product_compare/add');
}
function reNewLinkRemoveWishList(){
	reCreateLink('wishlist/index/remove', 'Are you sure you would like to remove this item from the your Wish List?', true);
}
function reNewLinkWishList(){
	reCreateLink('wishlist/index/add');
}
function reNewLinkAddToCartInWishList(){
	reCreateLink('wishlist/index/cart');
}

function fixPosWrap(){
	var fixTop=(parseInt(window.innerHeight/2)-parseInt($('sns_ajaxbox').getHeight()/2))+'px';
	$('sns_ajaxinner').setStyle({top:fixTop});
}
function renderAjaxWrap(){
	str='		<div id="sns_ajaxwrap">';
	str=str+'		<div id="sns_ajaxinner" style="top:0px;">';
	str=str+'			<div id="sns_ajaxbox">';
	str=str+'					<div id="ajax_process" style="display:block;"></div>';
	str=str+'					<div id="ajax_content">';
	str=str+'					<div id="confirmbox"></div>';
	str=str+'					<button id="btn-close" class="close" type="button" onclick="closeAll()">×</button></div>';
	str=str+'			</div>';
	str=str+'		</div><div id="ajax_overlay"></div>';
	str=str+'	</div>';
	str=str+'	';
	return str;

}
function closeAll(){
	$('confirmbox').innerHTML='';
	$('sns_ajaxwrap').setStyle({display:'none'});
	$('ajax_overlay').setStyle({display:'none'});
}

function snsAjaxCart(){
	aCConstruct();
	$$('body')[0].insert({top:renderAjaxWrap()});
	setInterval("aCConstruct()",1000);
}

function callAjax(url, action){
	if(action=="url"){
		overlaywrap = (closeCFirm == 1)?'close':'show';
		new Ajax.Request(url, {
			encoding:'UTF-8',
			method: 'post',
			parameters:{
				isCOPage:isCOPage,
				isWLPage:isWLPage
			},
			onSuccess : function(result){
				setResult(result.responseText.evalJSON());
			},
			onLoading : function(){
				$("ajax_content").setStyle({display:"none"});
				$("ajax_process").innerHTML=loader;
				$("ajax_process").setStyle({display:"block"});
				$("sns_ajaxwrap").setStyle({display:"block"});
				$("ajax_overlay").setStyle({display:"block"});
				fixPosWrap();
			},
			onFailure : function(msg){
				Element.setInnerHTML( display, msg.responseText);
			},
			onComplete: function(){
				$("ajax_process").setStyle({display:"none"});
				if(overlaywrap=='close') $("ajax_overlay").setStyle({display:"none"});
			}
		});
	}else{
		$('product_addtocart_form').request({
			encoding:'UTF-8',
			method:'post',
			parameters:{
				isCOPage:isCOPage
			},
			onLoading : function(){
				$("ajax_process").innerHTML=loader;
				$("ajax_process").setStyle({display:"block"})
				$("ajax_content").setStyle({display:"none"});
				$("sns_ajaxwrap").setStyle({display:"block"});
				$("ajax_overlay").setStyle({display:"block"});
				fixPosWrap();
			},
			onComplete: function(result){
				$("ajax_process").setStyle({display:"none"});
				setResult(result.responseText.evalJSON());
			}
		});
	}
}

function setResult(result){
	if(result.addtype=='0'){ // Action about cart
		if(!result.options){
			if(isCOPage=='1'){
				setCartCO(result);
				$("sns_ajaxwrap").setStyle({display:"none"});
				if(closeCFirm!=1)
					getConfirm(result);
				closeCFirm=0;
			}else{
				if(result.wishlist){
					setWlist(result);
				}
				setCartBlock(result);
				if(closeCFirm!=1){
					getConfirm(result); CANFLY = 1;
				}
				closeCFirm=0;
			}
			setMiniCart(result);
			reNewLinkDeleteInCart();
			setCOLinks(result);
			setRelated(result);
			if(isLoggedIn=="1"){
				reNewLinkWishList();
			}
			reNewLinkCompare();
		}else{
			getPOptions(result);
			if(result.wishlist){
				setWlist(result);
			}
			CANFLY = 0;
		}
	}else if(result.addtype=='1'){ // Action about wishlist
		if(isWLPage=='1'){
			setWlist(result);
			if(closeCFirm!=1)
			getConfirm(result);
			closeCFirm=0;
		}else{
			setBlockWList(result);
			if(closeCFirm!=1)
			getConfirm(result);
			closeCFirm=0;
		}
	}else if(result.addtype=='2'){ // Action about compare
		setBlockCompare(result);
		if(isCPPage && deletePCompare){
			windown_compare.location.reload();
		}
		if(closeCFirm!=1)
		getConfirm(result);
		deletePCompare=0;
		closeCFirm=0;
	}
}
function setCartCO(result){
	if(typeof($$(".col-main .cart"))!='undefined'){
		$$(".col-main .cart").each(function(el){ el.innerHTML = result.co_sb; });
	}
}

function setCartBlock(result){
	if(typeof($$(cart_block))!='undefined'){
		$$(cart_block).each(function(blockitem){ blockitem.replace(result.co_sb); } );
		truncPOptions();
	}
}
function setMiniCart(result){
	if(typeof($$(minicart_block))!='undefined'){
		$$(minicart_block).each(function(blockitem){
			if(result.ajaxcart!=""){
				blockitem.replace(result.ajaxcart);
			}
		});
		truncPOptions();
	}
}
function setFlyToCart(result){
	if(result.options == 0){
		//alert('bay thoi');
	}
}
function setRelated(result){
	/*if(typeof($$(".block-related"))!='undefined'){
		$$(".block-related").each(function(el){ el.replace(result.releated); });
	}*/
}
function setBlockWList(result){
	if(typeof($$(wishlist_block))!='undefined'){
		$$(wishlist_block).each(function(el){ el.replace(result.co_sb); })
	}else if(typeof($$(minicart_block))!='undefined'){
		$$(minicart_block).each(function(el){ el.insert({after:result.co_sb}); });
	}
	reNewLinkAddToCartInWishList();
	reNewLinkRemoveWishList();
	setWLlinks(result);
}
function setCOLinks(result){
	$$(mycart_link).each(function(el){ el.innerHTML=result.links; });
}
function setWlist(result){
	var str="";
	if(result.wishlist){
		str=result.wishlist;
	}else{
		str=result.co_sb;
	}
	if(isWLPage=='0'){
		if(typeof($$(wishlist_block))!='undefined'){
			$$(wishlist_block).each(function(el){ el.replace(str); });
		}
		else if(typeof($$(minicart_block))!='undefined'){
			$$(minicart_block).each(function(el){ el.insert({after:str}); });
		}
		reNewLinkAddToCartInWishList();
	}else{
		$$(bwish).each(function(el){
			el.innerHTML="";
			el.innerHTML=str;
		});
	}
	reNewLinkRemoveWishList();
	setWLlinks(result);
}
function setWLlinks(result){
	var strwishlink="";
	if(result.wishlinks){
		strwishlink=result.wishlinks;
	}else{
		strwishlink=result.links;
	}
	$$('ul.links li a').each(function(el){
		if(el.href.search('/wishlist/')!=-1){
			el.innerHTML=strwishlink;
		}
	});
}
function setBlockCompare(result){
	if(typeof($$(compare_block)[0])!='undefined'){
		$$(compare_block)[0].replace(result.co_sb);
		reNewLinkRemoveCompare();
		reNewLinkClearCompare();
	}
}

// For special product
function getPOptions(result){
    var scripts = result.co_sb.extractScripts();
    for (i=0; i<scripts.length; i++){
        if (typeof(scripts[i]) != 'undefined' && i<2){
            try{
				eval(scripts[i]);
			}
			catch(e){
				console.debug(e);
			}
        }
		else{
			break;
		}
    }
	$("confirmbox").innerHTML=result.co_sb.stripScripts();
	$("ajax_overlay").onclick = function(e){
		$("confirmbox").innerHTML='';
		$("ajax_content").setStyle({display:"none"});
		$("sns_ajaxwrap").setStyle({display:"none"});
		$("ajax_overlay").setStyle({display:"none"});
	};
	$("ajax_process").setStyle({display:"none"});

	$("ajax_content").setStyle({display:"block"});
    $("sns_ajaxwrap").setStyle({display:"block"});
	fixPosWrap();
    for (i; i<scripts.length; i++){
        if (typeof(scripts[i]) != 'undefined'){
            try{
				eval(scripts[i]);
			}catch(e){
				console.debug(e);
			}
        }
    }
    productAddToCartForm = new VarienForm('product_addtocart_form');
    decorateGeneric($$('#product-options-wrapper dl'), ['last']);
    if (typeof productAddToCartForm != 'undefined' ){
		productAddToCartForm.submit = function(url){
			if(this.validator && this.validator.validate()){
				url=$('product_addtocart_form').action;
				callAjax(url,'form');
			}
			return false;
		}
	}
}
function truncPOptions() {
	 $$('.truncated').each(function(element){
		 Event.observe(element, 'mouseover', function(){
				 if (element.down('div.truncated_full_value')) {
					element.down('div.truncated_full_value').addClassName('show')
				 }
			 });
		 Event.observe(element, 'mouseout', function(){
			 if (element.down('div.truncated_full_value')) {
				element.down('div.truncated_full_value').removeClassName('show')
			 }
		});
	 });
}

Product.Downloadable = Class.create();
Product.Downloadable.prototype = {
	config : {},
	initialize : function(config){
		this.config = config;
		this.reloadPrice();
	},
	reloadPrice : function(){
		var price = 0;
		config = this.config;
		$$('.product-downloadable-link').each(function(elm){
			if (config[elm.value] && elm.checked) {
				price += parseFloat(config[elm.value]);
			}
		});
		try {
			var _displayZeroPrice = optionsPrice.displayZeroPrice;
			optionsPrice.displayZeroPrice = false;
			optionsPrice.changePrice('downloadable', price);
			optionsPrice.reload();
			optionsPrice.displayZeroPrice = _displayZeroPrice;
		} catch(e) {

		}
	}
};

function validateDownloadableCallback(elmId, result) {
	var container = $('downloadable-links-list');
	if (result == 'failed') {
		container.removeClassName('validation-passed');
		container.addClassName('validation-failed');
	} else {
		container.removeClassName('validation-failed');
		container.addClassName('validation-passed');
	}
}
Product.Options = Class.create();
Product.Options.prototype = {
    initialize : function(config){
        this.config = config;
        this.reloadPrice();
    },
    reloadPrice : function(){
        price = new Number();
        config = this.config;
        skipIds = [];
        $$('.product-custom-option').each(function(element){
            var optionId = 0;
            element.name.sub(/[0-9]+/, function(match){
                optionId = match[0];
            });
            if (this.config[optionId]) {
                if (element.type == 'checkbox' || element.type == 'radio') {
                    if (element.checked) {
                        if (config[optionId][element.getValue()]) {
                            price += parseFloat(config[optionId][element.getValue()]);
                        }
                    }
                } else if(element.hasClassName('datetime-picker') && !skipIds.include(optionId)) {
                    dateSelected = true;
                    $$('.product-custom-option[id^="options_' + optionId + '"]').each(function(dt){
                        if (dt.getValue() == '') {
                            dateSelected = false;
                        }
                    });
                    if (dateSelected) {
                        price += parseFloat(this.config[optionId]);
                        skipIds[optionId] = optionId;
                    }
                } else if(element.type == 'select-one' || element.type == 'select-multiple') {
                    if (element.options) {
                        $A(element.options).each(function(selectOption){
                            if (selectOption.selected) {
                                if (this.config[optionId][selectOption.value]) {
                                    price += parseFloat(this.config[optionId][selectOption.value]);
                                }
                            }
                        });
                    }
                } else {
                    if (element.getValue().strip() != '') {
                        price += parseFloat(this.config[optionId]);
                    }
                }
            }
        });
        try {
            optionsPrice.changePrice('options', price);
            optionsPrice.reload();
        } catch (e) {

        }
    }
}
function validateOptionsCallback(elmId, result){
    var container = $(elmId).up('ul.options-list');
    if (result == 'failed') {
        container.removeClassName('validation-passed');
        container.addClassName('validation-failed');
    } else {
        container.removeClassName('validation-failed');
        container.addClassName('validation-passed');
    }
}

miniCartForm.prototype = {
	initialize: function(form, addressUrl, saveUrl){
		this.form = form;
		if ($(this.form)) {
		     $(this.form).observe('submit', function(event){
		     	this.callAction();
		     	Event.stop(event);
		     }.bind(this));
		}
		this.addressUrl = addressUrl;
		this.saveUrl = saveUrl;
		this.onSave = this.newCart.bindAsEventListener(this);
		this.onComplete = this.closeAll.bindAsEventListener(this);
		this.onFailure = this.loadFailure.bindAsEventListener(this);
		this.onLoading = this.showLoading.bindAsEventListener(this);
		this.onChanged = false;
	},
	callAction: function(){
		var validator = new Validation(this.form);
		if (validator.validate()) {
			if(ajax_for_update){
				var request = new Ajax.Request(
    				this.saveUrl,
    				{
        				method: 'post',
        				onComplete: this.onComplete,
        				onSuccess: this.onSave,
        				onLoading: this.onLoading,
        				parameters: Form.serialize(this.form)+'&isCOPage='+isCOPage,
    				}
				);
			}else{
				$(this.form).submit();
			}
		}
	},
	newCart: function(result){
		closeCFirm = 1;
		setResult(result.responseText.evalJSON());
	},
	loadFailure: function(){

	},
	showLoading: function(){
		$("ajax_content").setStyle({display:"none"});
		$("ajax_process").innerHTML=loader;
		$("ajax_process").setStyle({display:"block"});
		$("sns_ajaxwrap").setStyle({display:"block"});
		$("ajax_overlay").setStyle({display:"block"});
		fixPosWrap();
	},
	closeAll: function(){
		$("ajax_process").setStyle({display:"none"});
		$("ajax_overlay").setStyle({display:"none"});
	}
};
function getCDown(numb){
	if(numb!=1){
		try{
			timenumb=numb-1;
			$("cout_down").innerHTML= timenumb+"s";
			setTimeout("getCDown(timenumb)",1000);
		}catch(e){}
	}else{
		$("ajax_overlay").setStyle({display:"none"});
		$("sns_ajaxwrap").setStyle({display:"none"});
		$('ajax_content').setStyle({display:'none'});
		if(isCPPage) {isCPPage=0; windown_compare.focus();}
		return;
	}
}
(function() {
	document.observe('dom:loaded', snsAjaxCart);
})();
jQuery(document).ready(function($){
	var imgToFly = '';
	if(usingImgFly==1){
		function bindClickAddToCart(){
		  	$('.btn-cart').each(function(){
			  	$(this).bind('click', function(){
			  		if( !$(this).parents('#confirmbox').length && !$(this).parents('.quickview-main').length){
				  		$('.img-to-fly').remove();
				  		// product view
				  		if($('body.catalog-product-view .product-view').length){
				  			if($(this).parents('.item').find('a.product-image, .img-main').find('img').length){
				  				imgP = $(this).parents('.item').find('a.product-image, .img-main').find('img');
				  			}else{
				  				imgP = $(this).parents('.product-essential').find('.product-image-zoom').find('img');
				  			}
				  		}else{
					  		imgP = $(this).parents('.item').find('a.product-image, .img-main').find('img');
						}
						imgToFly = imgP.clone(); //alert(imgToFly.attr('src'));
					  	if($(this).attr('onclick').indexOf("?options=cart") == -1 && CANFLY==1){
					  		flyNow();
					  	}
					}
			  	});
		  	});
	  	}
	  	function canfly(){
	  		if(CANFLY==1 && imgToFly!==''){
	  			flyNow();
	  		}
	  	}
	  	setInterval(function(){bindClickAddToCart()},1000);
	  	setInterval(function(){canfly()},1000);
		function flyNow(){ //console.log(imgToFly.attr('src'));
			imgToFly.offset({ top:imgP.offset().top, left:imgP.offset().left })
	            .addClass('img-to-fly')
	            .css({'opacity':'0.8', 'position':'absolute', 'height':'180px', 'width':'180px', 'z-index':'1000'})
	            .appendTo($('body'))
	            .animate({
	                'top':$('.mini-cart').offset().top + 10,
	                'left':$('.mini-cart').offset().left + 10,
	                'width':50,
	                'height':50
	            }, 1000, 'easeInOutExpo');
	        if(scrollToCart==1){
		        $('body,html').animate({
					scrollTop: $('.mini-cart').offset().top
				}, 1000, 'easeInOutExpo');
			}
	        imgToFly.animate({'width':0, 'height':0});
	  		imgToFly = '';
	  		CANFLY = 0;
		}
	}
});

jQuery(document).ready(function($){
	function cleanHref(){
		var pdpath = arguments[0];
		var preg = /\/[^\/]{0,}$/ig;
		if( typeof pdpath == 'undefined') pdpath = 'null';
		if( pdpath[pdpath.length-1]=="/" ){
			pdpath = pdpath.substring(0,pdpath.length-1);
			return (pdpath.match(preg)+"/");
		}
		return pdpath.match(preg);
	}

	function quickView(){
		var qvpath = 'quickview/index/view';
		if( SNS_QV.SETTING.BASE_URL.indexOf('index.php') == -1 ) qvpath = 'index.php/quickview/index/view';
		var baseUrl = SNS_QV.SETTING.BASE_URL + qvpath;
		$.each($(arguments[0].wrapQuickView), function() {
			// Append quick view
			if( $(this).find("a.sns-btn-quickview").length <= 0 ){
				if( $(this).find("a").length > 0 ){
					link = $(this).find("a");
					var href = cleanHref(link.attr('href'))[0];
					href = (href[0] == "\/") ? href.substring(1, href.length) : href;
					href = baseUrl+"/path/" + href.replace(/^\s+|\s+$/g,""); //console.log(href);
					// product type
					href = href.replace('?options=cart', "");
					//href = href+'?is_quickview=1';
					$(this).append("<a class=\"sns-btn-quickview\" data-original-title=\""+SNS_QV.SETTING.TEXT+"\" data-toggle=\"tooltip\" href=\""+href+"\"><span>"+SNS_QV.SETTING.TEXT+"</span></a>");
				}
			}
		});
		// Insert popup for quick view
		$('.sns-btn-quickview').each(function(){
			$(this).fancybox({
				type		: 'ajax',
				maxWidth	: SNS_QV.SETTING.POP_WIDTH,
				maxHeight	: SNS_QV.SETTING.POP_HEIGHT,
				fitToView	: false,
	//			width		: '70%',
	//			height		: '70%',
				autoSize	: false,
				closeClick	: false,
				openEffect	: 'none',
				closeEffect	: 'none',
				scrollOutside	: false,
		        ajax            : {
		                cache   : false,
		        },
				afterShow 	: function() {
					$(".gallery_img").each(function(){
						$(this).data('owlCarousel').reinit();
					});
				},
				afterClose	: function() {
					$('.fancybox-overlay + .zoomContainer').remove();
				}
			});
		});
//		$('.sns-btn-quickview')
	}
	quickView({wrapQuickView : SNS_QV.SETTING.SELECTOR});
	setInterval(function(){ quickView({wrapQuickView : SNS_QV.SETTING.SELECTOR}) },1000);
});





/********************************************
	-	THEMEPUNCH TOOLS Ver. 1.0     -
	 Last Update of Tools 22.01.2013
*********************************************/

/*! Hammer.JS - v1.0.5 - 2013-04-07
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2013 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(t,e){"use strict";function n(){if(!i.READY){i.event.determineEventTypes();for(var t in i.gestures)i.gestures.hasOwnProperty(t)&&i.detection.register(i.gestures[t]);i.event.onTouch(i.DOCUMENT,i.EVENT_MOVE,i.detection.detect),i.event.onTouch(i.DOCUMENT,i.EVENT_END,i.detection.detect),i.READY=!0}}var i=function(t,e){return new i.Instance(t,e||{})};i.defaults={stop_browser_behavior:{userSelect:"none",touchAction:"none",touchCallout:"none",contentZooming:"none",userDrag:"none",tapHighlightColor:"rgba(0,0,0,0)"}},i.HAS_POINTEREVENTS=navigator.pointerEnabled||navigator.msPointerEnabled,i.HAS_TOUCHEVENTS="ontouchstart"in t,i.MOBILE_REGEX=/mobile|tablet|ip(ad|hone|od)|android/i,i.NO_MOUSEEVENTS=i.HAS_TOUCHEVENTS&&navigator.userAgent.match(i.MOBILE_REGEX),i.EVENT_TYPES={},i.DIRECTION_DOWN="down",i.DIRECTION_LEFT="left",i.DIRECTION_UP="up",i.DIRECTION_RIGHT="right",i.POINTER_MOUSE="mouse",i.POINTER_TOUCH="touch",i.POINTER_PEN="pen",i.EVENT_START="start",i.EVENT_MOVE="move",i.EVENT_END="end",i.DOCUMENT=document,i.plugins={},i.READY=!1,i.Instance=function(t,e){var r=this;return n(),this.element=t,this.enabled=!0,this.options=i.utils.extend(i.utils.extend({},i.defaults),e||{}),this.options.stop_browser_behavior&&i.utils.stopDefaultBrowserBehavior(this.element,this.options.stop_browser_behavior),i.event.onTouch(t,i.EVENT_START,function(t){r.enabled&&i.detection.startDetect(r,t)}),this},i.Instance.prototype={on:function(t,e){for(var n=t.split(" "),i=0;n.length>i;i++)this.element.addEventListener(n[i],e,!1);return this},off:function(t,e){for(var n=t.split(" "),i=0;n.length>i;i++)this.element.removeEventListener(n[i],e,!1);return this},trigger:function(t,e){var n=i.DOCUMENT.createEvent("Event");n.initEvent(t,!0,!0),n.gesture=e;var r=this.element;return i.utils.hasParent(e.target,r)&&(r=e.target),r.dispatchEvent(n),this},enable:function(t){return this.enabled=t,this}};var r=null,o=!1,s=!1;i.event={bindDom:function(t,e,n){for(var i=e.split(" "),r=0;i.length>r;r++)t.addEventListener(i[r],n,!1)},onTouch:function(t,e,n){var a=this;this.bindDom(t,i.EVENT_TYPES[e],function(c){var u=c.type.toLowerCase();if(!u.match(/mouse/)||!s){(u.match(/touch/)||u.match(/pointerdown/)||u.match(/mouse/)&&1===c.which)&&(o=!0),u.match(/touch|pointer/)&&(s=!0);var h=0;o&&(i.HAS_POINTEREVENTS&&e!=i.EVENT_END?h=i.PointerEvent.updatePointer(e,c):u.match(/touch/)?h=c.touches.length:s||(h=u.match(/up/)?0:1),h>0&&e==i.EVENT_END?e=i.EVENT_MOVE:h||(e=i.EVENT_END),h||null===r?r=c:c=r,n.call(i.detection,a.collectEventData(t,e,c)),i.HAS_POINTEREVENTS&&e==i.EVENT_END&&(h=i.PointerEvent.updatePointer(e,c))),h||(r=null,o=!1,s=!1,i.PointerEvent.reset())}})},determineEventTypes:function(){var t;t=i.HAS_POINTEREVENTS?i.PointerEvent.getEvents():i.NO_MOUSEEVENTS?["touchstart","touchmove","touchend touchcancel"]:["touchstart mousedown","touchmove mousemove","touchend touchcancel mouseup"],i.EVENT_TYPES[i.EVENT_START]=t[0],i.EVENT_TYPES[i.EVENT_MOVE]=t[1],i.EVENT_TYPES[i.EVENT_END]=t[2]},getTouchList:function(t){return i.HAS_POINTEREVENTS?i.PointerEvent.getTouchList():t.touches?t.touches:[{identifier:1,pageX:t.pageX,pageY:t.pageY,target:t.target}]},collectEventData:function(t,e,n){var r=this.getTouchList(n,e),o=i.POINTER_TOUCH;return(n.type.match(/mouse/)||i.PointerEvent.matchType(i.POINTER_MOUSE,n))&&(o=i.POINTER_MOUSE),{center:i.utils.getCenter(r),timeStamp:(new Date).getTime(),target:n.target,touches:r,eventType:e,pointerType:o,srcEvent:n,preventDefault:function(){this.srcEvent.preventManipulation&&this.srcEvent.preventManipulation(),this.srcEvent.preventDefault&&this.srcEvent.preventDefault()},stopPropagation:function(){this.srcEvent.stopPropagation()},stopDetect:function(){return i.detection.stopDetect()}}}},i.PointerEvent={pointers:{},getTouchList:function(){var t=this,e=[];return Object.keys(t.pointers).sort().forEach(function(n){e.push(t.pointers[n])}),e},updatePointer:function(t,e){return t==i.EVENT_END?this.pointers={}:(e.identifier=e.pointerId,this.pointers[e.pointerId]=e),Object.keys(this.pointers).length},matchType:function(t,e){if(!e.pointerType)return!1;var n={};return n[i.POINTER_MOUSE]=e.pointerType==e.MSPOINTER_TYPE_MOUSE||e.pointerType==i.POINTER_MOUSE,n[i.POINTER_TOUCH]=e.pointerType==e.MSPOINTER_TYPE_TOUCH||e.pointerType==i.POINTER_TOUCH,n[i.POINTER_PEN]=e.pointerType==e.MSPOINTER_TYPE_PEN||e.pointerType==i.POINTER_PEN,n[t]},getEvents:function(){return["pointerdown MSPointerDown","pointermove MSPointerMove","pointerup pointercancel MSPointerUp MSPointerCancel"]},reset:function(){this.pointers={}}},i.utils={extend:function(t,n,i){for(var r in n)t[r]!==e&&i||(t[r]=n[r]);return t},hasParent:function(t,e){for(;t;){if(t==e)return!0;t=t.parentNode}return!1},getCenter:function(t){for(var e=[],n=[],i=0,r=t.length;r>i;i++)e.push(t[i].pageX),n.push(t[i].pageY);return{pageX:(Math.min.apply(Math,e)+Math.max.apply(Math,e))/2,pageY:(Math.min.apply(Math,n)+Math.max.apply(Math,n))/2}},getVelocity:function(t,e,n){return{x:Math.abs(e/t)||0,y:Math.abs(n/t)||0}},getAngle:function(t,e){var n=e.pageY-t.pageY,i=e.pageX-t.pageX;return 180*Math.atan2(n,i)/Math.PI},getDirection:function(t,e){var n=Math.abs(t.pageX-e.pageX),r=Math.abs(t.pageY-e.pageY);return n>=r?t.pageX-e.pageX>0?i.DIRECTION_LEFT:i.DIRECTION_RIGHT:t.pageY-e.pageY>0?i.DIRECTION_UP:i.DIRECTION_DOWN},getDistance:function(t,e){var n=e.pageX-t.pageX,i=e.pageY-t.pageY;return Math.sqrt(n*n+i*i)},getScale:function(t,e){return t.length>=2&&e.length>=2?this.getDistance(e[0],e[1])/this.getDistance(t[0],t[1]):1},getRotation:function(t,e){return t.length>=2&&e.length>=2?this.getAngle(e[1],e[0])-this.getAngle(t[1],t[0]):0},isVertical:function(t){return t==i.DIRECTION_UP||t==i.DIRECTION_DOWN},stopDefaultBrowserBehavior:function(t,e){var n,i=["webkit","khtml","moz","ms","o",""];if(e&&t.style){for(var r=0;i.length>r;r++)for(var o in e)e.hasOwnProperty(o)&&(n=o,i[r]&&(n=i[r]+n.substring(0,1).toUpperCase()+n.substring(1)),t.style[n]=e[o]);"none"==e.userSelect&&(t.onselectstart=function(){return!1})}}},i.detection={gestures:[],current:null,previous:null,stopped:!1,startDetect:function(t,e){this.current||(this.stopped=!1,this.current={inst:t,startEvent:i.utils.extend({},e),lastEvent:!1,name:""},this.detect(e))},detect:function(t){if(this.current&&!this.stopped){t=this.extendEventData(t);for(var e=this.current.inst.options,n=0,r=this.gestures.length;r>n;n++){var o=this.gestures[n];if(!this.stopped&&e[o.name]!==!1&&o.handler.call(o,t,this.current.inst)===!1){this.stopDetect();break}}return this.current&&(this.current.lastEvent=t),t.eventType==i.EVENT_END&&!t.touches.length-1&&this.stopDetect(),t}},stopDetect:function(){this.previous=i.utils.extend({},this.current),this.current=null,this.stopped=!0},extendEventData:function(t){var e=this.current.startEvent;if(e&&(t.touches.length!=e.touches.length||t.touches===e.touches)){e.touches=[];for(var n=0,r=t.touches.length;r>n;n++)e.touches.push(i.utils.extend({},t.touches[n]))}var o=t.timeStamp-e.timeStamp,s=t.center.pageX-e.center.pageX,a=t.center.pageY-e.center.pageY,c=i.utils.getVelocity(o,s,a);return i.utils.extend(t,{deltaTime:o,deltaX:s,deltaY:a,velocityX:c.x,velocityY:c.y,distance:i.utils.getDistance(e.center,t.center),angle:i.utils.getAngle(e.center,t.center),direction:i.utils.getDirection(e.center,t.center),scale:i.utils.getScale(e.touches,t.touches),rotation:i.utils.getRotation(e.touches,t.touches),startEvent:e}),t},register:function(t){var n=t.defaults||{};return n[t.name]===e&&(n[t.name]=!0),i.utils.extend(i.defaults,n,!0),t.index=t.index||1e3,this.gestures.push(t),this.gestures.sort(function(t,e){return t.index<e.index?-1:t.index>e.index?1:0}),this.gestures}},i.gestures=i.gestures||{},i.gestures.Hold={name:"hold",index:10,defaults:{hold_timeout:500,hold_threshold:1},timer:null,handler:function(t,e){switch(t.eventType){case i.EVENT_START:clearTimeout(this.timer),i.detection.current.name=this.name,this.timer=setTimeout(function(){"hold"==i.detection.current.name&&e.trigger("hold",t)},e.options.hold_timeout);break;case i.EVENT_MOVE:t.distance>e.options.hold_threshold&&clearTimeout(this.timer);break;case i.EVENT_END:clearTimeout(this.timer)}}},i.gestures.Tap={name:"tap",index:100,defaults:{tap_max_touchtime:250,tap_max_distance:10,tap_always:!0,doubletap_distance:20,doubletap_interval:300},handler:function(t,e){if(t.eventType==i.EVENT_END){var n=i.detection.previous,r=!1;if(t.deltaTime>e.options.tap_max_touchtime||t.distance>e.options.tap_max_distance)return;n&&"tap"==n.name&&t.timeStamp-n.lastEvent.timeStamp<e.options.doubletap_interval&&t.distance<e.options.doubletap_distance&&(e.trigger("doubletap",t),r=!0),(!r||e.options.tap_always)&&(i.detection.current.name="tap",e.trigger(i.detection.current.name,t))}}},i.gestures.Swipe={name:"swipe",index:40,defaults:{swipe_max_touches:1,swipe_velocity:.7},handler:function(t,e){if(t.eventType==i.EVENT_END){if(e.options.swipe_max_touches>0&&t.touches.length>e.options.swipe_max_touches)return;(t.velocityX>e.options.swipe_velocity||t.velocityY>e.options.swipe_velocity)&&(e.trigger(this.name,t),e.trigger(this.name+t.direction,t))}}},i.gestures.Drag={name:"drag",index:50,defaults:{drag_min_distance:10,drag_max_touches:1,drag_block_horizontal:!1,drag_block_vertical:!1,drag_lock_to_axis:!1,drag_lock_min_distance:25},triggered:!1,handler:function(t,n){if(i.detection.current.name!=this.name&&this.triggered)return n.trigger(this.name+"end",t),this.triggered=!1,e;if(!(n.options.drag_max_touches>0&&t.touches.length>n.options.drag_max_touches))switch(t.eventType){case i.EVENT_START:this.triggered=!1;break;case i.EVENT_MOVE:if(t.distance<n.options.drag_min_distance&&i.detection.current.name!=this.name)return;i.detection.current.name=this.name,(i.detection.current.lastEvent.drag_locked_to_axis||n.options.drag_lock_to_axis&&n.options.drag_lock_min_distance<=t.distance)&&(t.drag_locked_to_axis=!0);var r=i.detection.current.lastEvent.direction;t.drag_locked_to_axis&&r!==t.direction&&(t.direction=i.utils.isVertical(r)?0>t.deltaY?i.DIRECTION_UP:i.DIRECTION_DOWN:0>t.deltaX?i.DIRECTION_LEFT:i.DIRECTION_RIGHT),this.triggered||(n.trigger(this.name+"start",t),this.triggered=!0),n.trigger(this.name,t),n.trigger(this.name+t.direction,t),(n.options.drag_block_vertical&&i.utils.isVertical(t.direction)||n.options.drag_block_horizontal&&!i.utils.isVertical(t.direction))&&t.preventDefault();break;case i.EVENT_END:this.triggered&&n.trigger(this.name+"end",t),this.triggered=!1}}},i.gestures.Transform={name:"transform",index:45,defaults:{transform_min_scale:.01,transform_min_rotation:1,transform_always_block:!1},triggered:!1,handler:function(t,n){if(i.detection.current.name!=this.name&&this.triggered)return n.trigger(this.name+"end",t),this.triggered=!1,e;if(!(2>t.touches.length))switch(n.options.transform_always_block&&t.preventDefault(),t.eventType){case i.EVENT_START:this.triggered=!1;break;case i.EVENT_MOVE:var r=Math.abs(1-t.scale),o=Math.abs(t.rotation);if(n.options.transform_min_scale>r&&n.options.transform_min_rotation>o)return;i.detection.current.name=this.name,this.triggered||(n.trigger(this.name+"start",t),this.triggered=!0),n.trigger(this.name,t),o>n.options.transform_min_rotation&&n.trigger("rotate",t),r>n.options.transform_min_scale&&(n.trigger("pinch",t),n.trigger("pinch"+(1>t.scale?"in":"out"),t));break;case i.EVENT_END:this.triggered&&n.trigger(this.name+"end",t),this.triggered=!1}}},i.gestures.Touch={name:"touch",index:-1/0,defaults:{prevent_default:!1,prevent_mouseevents:!1},handler:function(t,n){return n.options.prevent_mouseevents&&t.pointerType==i.POINTER_MOUSE?(t.stopDetect(),e):(n.options.prevent_default&&t.preventDefault(),t.eventType==i.EVENT_START&&n.trigger(this.name,t),e)}},i.gestures.Release={name:"release",index:1/0,handler:function(t,e){t.eventType==i.EVENT_END&&e.trigger(this.name,t)}},"object"==typeof module&&"object"==typeof module.exports?module.exports=i:(t.Hammer=i,"function"==typeof t.define&&t.define.amd&&t.define("hammer",[],function(){return i}))})(this),function(t,e){"use strict";t!==e&&(Hammer.event.bindDom=function(n,i,r){t(n).on(i,function(t){var n=t.originalEvent||t;n.pageX===e&&(n.pageX=t.pageX,n.pageY=t.pageY),n.target||(n.target=t.target),n.which===e&&(n.which=n.button),n.preventDefault||(n.preventDefault=t.preventDefault),n.stopPropagation||(n.stopPropagation=t.stopPropagation),r.call(this,n)})},Hammer.Instance.prototype.on=function(e,n){return t(this.element).on(e,n)},Hammer.Instance.prototype.off=function(e,n){return t(this.element).off(e,n)},Hammer.Instance.prototype.trigger=function(e,n){var i=t(this.element);return i.has(n.target).length&&(i=t(n.target)),i.trigger({type:e,gesture:n})},t.fn.hammer=function(e){return this.each(function(){var n=t(this),i=n.data("hammer");i?i&&e&&Hammer.utils.extend(i.options,e):n.data("hammer",new Hammer(this,e||{}))})})}(window.jQuery||window.Zepto);


/*!
 * VERSION: 1.11.5
 * DATE: 2014-02-20
 * UPDATES AND DOCS AT: http://www.greensock.com
 *
 * @license Copyright (c) 2008-2014, GreenSock. All rights reserved.
 * This work is subject to the terms at http://www.greensock.com/terms_of_use.html or for
 * Club GreenSock members, the software agreement that was issued with your membership.
 * 
 * @author: Jack Doyle, jack@greensock.com
 */
(function(t){"use strict";var e=t.GreenSockGlobals||t;if(!e.TweenLite){var i,s,r,n,a,o=function(t){var i,s=t.split("."),r=e;for(i=0;s.length>i;i++)r[s[i]]=r=r[s[i]]||{};return r},l=o("com.greensock"),h=1e-10,_=[].slice,u=function(){},m=function(){var t=Object.prototype.toString,e=t.call([]);return function(i){return null!=i&&(i instanceof Array||"object"==typeof i&&!!i.push&&t.call(i)===e)}}(),f={},p=function(i,s,r,n){this.sc=f[i]?f[i].sc:[],f[i]=this,this.gsClass=null,this.func=r;var a=[];this.check=function(l){for(var h,_,u,m,c=s.length,d=c;--c>-1;)(h=f[s[c]]||new p(s[c],[])).gsClass?(a[c]=h.gsClass,d--):l&&h.sc.push(this);if(0===d&&r)for(_=("com.greensock."+i).split("."),u=_.pop(),m=o(_.join("."))[u]=this.gsClass=r.apply(r,a),n&&(e[u]=m,"function"==typeof define&&define.amd?define((t.GreenSockAMDPath?t.GreenSockAMDPath+"/":"")+i.split(".").join("/"),[],function(){return m}):"undefined"!=typeof module&&module.exports&&(module.exports=m)),c=0;this.sc.length>c;c++)this.sc[c].check()},this.check(!0)},c=t._gsDefine=function(t,e,i,s){return new p(t,e,i,s)},d=l._class=function(t,e,i){return e=e||function(){},c(t,[],function(){return e},i),e};c.globals=e;var v=[0,0,1,1],g=[],T=d("easing.Ease",function(t,e,i,s){this._func=t,this._type=i||0,this._power=s||0,this._params=e?v.concat(e):v},!0),w=T.map={},P=T.register=function(t,e,i,s){for(var r,n,a,o,h=e.split(","),_=h.length,u=(i||"easeIn,easeOut,easeInOut").split(",");--_>-1;)for(n=h[_],r=s?d("easing."+n,null,!0):l.easing[n]||{},a=u.length;--a>-1;)o=u[a],w[n+"."+o]=w[o+n]=r[o]=t.getRatio?t:t[o]||new t};for(r=T.prototype,r._calcEnd=!1,r.getRatio=function(t){if(this._func)return this._params[0]=t,this._func.apply(null,this._params);var e=this._type,i=this._power,s=1===e?1-t:2===e?t:.5>t?2*t:2*(1-t);return 1===i?s*=s:2===i?s*=s*s:3===i?s*=s*s*s:4===i&&(s*=s*s*s*s),1===e?1-s:2===e?s:.5>t?s/2:1-s/2},i=["Linear","Quad","Cubic","Quart","Quint,Strong"],s=i.length;--s>-1;)r=i[s]+",Power"+s,P(new T(null,null,1,s),r,"easeOut",!0),P(new T(null,null,2,s),r,"easeIn"+(0===s?",easeNone":"")),P(new T(null,null,3,s),r,"easeInOut");w.linear=l.easing.Linear.easeIn,w.swing=l.easing.Quad.easeInOut;var y=d("events.EventDispatcher",function(t){this._listeners={},this._eventTarget=t||this});r=y.prototype,r.addEventListener=function(t,e,i,s,r){r=r||0;var o,l,h=this._listeners[t],_=0;for(null==h&&(this._listeners[t]=h=[]),l=h.length;--l>-1;)o=h[l],o.c===e&&o.s===i?h.splice(l,1):0===_&&r>o.pr&&(_=l+1);h.splice(_,0,{c:e,s:i,up:s,pr:r}),this!==n||a||n.wake()},r.removeEventListener=function(t,e){var i,s=this._listeners[t];if(s)for(i=s.length;--i>-1;)if(s[i].c===e)return s.splice(i,1),void 0},r.dispatchEvent=function(t){var e,i,s,r=this._listeners[t];if(r)for(e=r.length,i=this._eventTarget;--e>-1;)s=r[e],s.up?s.c.call(s.s||i,{type:t,target:i}):s.c.call(s.s||i)};var b=t.requestAnimationFrame,k=t.cancelAnimationFrame,A=Date.now||function(){return(new Date).getTime()},S=A();for(i=["ms","moz","webkit","o"],s=i.length;--s>-1&&!b;)b=t[i[s]+"RequestAnimationFrame"],k=t[i[s]+"CancelAnimationFrame"]||t[i[s]+"CancelRequestAnimationFrame"];d("Ticker",function(t,e){var i,s,r,o,l,h=this,_=A(),m=e!==!1&&b,f=function(t){S=A(),h.time=(S-_)/1e3;var e,n=h.time-l;(!i||n>0||t===!0)&&(h.frame++,l+=n+(n>=o?.004:o-n),e=!0),t!==!0&&(r=s(f)),e&&h.dispatchEvent("tick")};y.call(h),h.time=h.frame=0,h.tick=function(){f(!0)},h.sleep=function(){null!=r&&(m&&k?k(r):clearTimeout(r),s=u,r=null,h===n&&(a=!1))},h.wake=function(){null!==r&&h.sleep(),s=0===i?u:m&&b?b:function(t){return setTimeout(t,0|1e3*(l-h.time)+1)},h===n&&(a=!0),f(2)},h.fps=function(t){return arguments.length?(i=t,o=1/(i||60),l=this.time+o,h.wake(),void 0):i},h.useRAF=function(t){return arguments.length?(h.sleep(),m=t,h.fps(i),void 0):m},h.fps(t),setTimeout(function(){m&&(!r||5>h.frame)&&h.useRAF(!1)},1500)}),r=l.Ticker.prototype=new l.events.EventDispatcher,r.constructor=l.Ticker;var x=d("core.Animation",function(t,e){if(this.vars=e=e||{},this._duration=this._totalDuration=t||0,this._delay=Number(e.delay)||0,this._timeScale=1,this._active=e.immediateRender===!0,this.data=e.data,this._reversed=e.reversed===!0,Q){a||n.wake();var i=this.vars.useFrames?G:Q;i.add(this,i._time),this.vars.paused&&this.paused(!0)}});n=x.ticker=new l.Ticker,r=x.prototype,r._dirty=r._gc=r._initted=r._paused=!1,r._totalTime=r._time=0,r._rawPrevTime=-1,r._next=r._last=r._onUpdate=r._timeline=r.timeline=null,r._paused=!1;var C=function(){a&&A()-S>2e3&&n.wake(),setTimeout(C,2e3)};C(),r.play=function(t,e){return arguments.length&&this.seek(t,e),this.reversed(!1).paused(!1)},r.pause=function(t,e){return arguments.length&&this.seek(t,e),this.paused(!0)},r.resume=function(t,e){return arguments.length&&this.seek(t,e),this.paused(!1)},r.seek=function(t,e){return this.totalTime(Number(t),e!==!1)},r.restart=function(t,e){return this.reversed(!1).paused(!1).totalTime(t?-this._delay:0,e!==!1,!0)},r.reverse=function(t,e){return arguments.length&&this.seek(t||this.totalDuration(),e),this.reversed(!0).paused(!1)},r.render=function(){},r.invalidate=function(){return this},r.isActive=function(){var t,e=this._timeline,i=this._startTime;return!e||!this._gc&&!this._paused&&e.isActive()&&(t=e.rawTime())>=i&&i+this.totalDuration()/this._timeScale>t},r._enabled=function(t,e){return a||n.wake(),this._gc=!t,this._active=this.isActive(),e!==!0&&(t&&!this.timeline?this._timeline.add(this,this._startTime-this._delay):!t&&this.timeline&&this._timeline._remove(this,!0)),!1},r._kill=function(){return this._enabled(!1,!1)},r.kill=function(t,e){return this._kill(t,e),this},r._uncache=function(t){for(var e=t?this:this.timeline;e;)e._dirty=!0,e=e.timeline;return this},r._swapSelfInParams=function(t){for(var e=t.length,i=t.concat();--e>-1;)"{self}"===t[e]&&(i[e]=this);return i},r.eventCallback=function(t,e,i,s){if("on"===(t||"").substr(0,2)){var r=this.vars;if(1===arguments.length)return r[t];null==e?delete r[t]:(r[t]=e,r[t+"Params"]=m(i)&&-1!==i.join("").indexOf("{self}")?this._swapSelfInParams(i):i,r[t+"Scope"]=s),"onUpdate"===t&&(this._onUpdate=e)}return this},r.delay=function(t){return arguments.length?(this._timeline.smoothChildTiming&&this.startTime(this._startTime+t-this._delay),this._delay=t,this):this._delay},r.duration=function(t){return arguments.length?(this._duration=this._totalDuration=t,this._uncache(!0),this._timeline.smoothChildTiming&&this._time>0&&this._time<this._duration&&0!==t&&this.totalTime(this._totalTime*(t/this._duration),!0),this):(this._dirty=!1,this._duration)},r.totalDuration=function(t){return this._dirty=!1,arguments.length?this.duration(t):this._totalDuration},r.time=function(t,e){return arguments.length?(this._dirty&&this.totalDuration(),this.totalTime(t>this._duration?this._duration:t,e)):this._time},r.totalTime=function(t,e,i){if(a||n.wake(),!arguments.length)return this._totalTime;if(this._timeline){if(0>t&&!i&&(t+=this.totalDuration()),this._timeline.smoothChildTiming){this._dirty&&this.totalDuration();var s=this._totalDuration,r=this._timeline;if(t>s&&!i&&(t=s),this._startTime=(this._paused?this._pauseTime:r._time)-(this._reversed?s-t:t)/this._timeScale,r._dirty||this._uncache(!1),r._timeline)for(;r._timeline;)r._timeline._time!==(r._startTime+r._totalTime)/r._timeScale&&r.totalTime(r._totalTime,!0),r=r._timeline}this._gc&&this._enabled(!0,!1),(this._totalTime!==t||0===this._duration)&&this.render(t,e,!1)}return this},r.progress=r.totalProgress=function(t,e){return arguments.length?this.totalTime(this.duration()*t,e):this._time/this.duration()},r.startTime=function(t){return arguments.length?(t!==this._startTime&&(this._startTime=t,this.timeline&&this.timeline._sortChildren&&this.timeline.add(this,t-this._delay)),this):this._startTime},r.timeScale=function(t){if(!arguments.length)return this._timeScale;if(t=t||h,this._timeline&&this._timeline.smoothChildTiming){var e=this._pauseTime,i=e||0===e?e:this._timeline.totalTime();this._startTime=i-(i-this._startTime)*this._timeScale/t}return this._timeScale=t,this._uncache(!1)},r.reversed=function(t){return arguments.length?(t!=this._reversed&&(this._reversed=t,this.totalTime(this._timeline&&!this._timeline.smoothChildTiming?this.totalDuration()-this._totalTime:this._totalTime,!0)),this):this._reversed},r.paused=function(t){if(!arguments.length)return this._paused;if(t!=this._paused&&this._timeline){a||t||n.wake();var e=this._timeline,i=e.rawTime(),s=i-this._pauseTime;!t&&e.smoothChildTiming&&(this._startTime+=s,this._uncache(!1)),this._pauseTime=t?i:null,this._paused=t,this._active=this.isActive(),!t&&0!==s&&this._initted&&this.duration()&&this.render(e.smoothChildTiming?this._totalTime:(i-this._startTime)/this._timeScale,!0,!0)}return this._gc&&!t&&this._enabled(!0,!1),this};var R=d("core.SimpleTimeline",function(t){x.call(this,0,t),this.autoRemoveChildren=this.smoothChildTiming=!0});r=R.prototype=new x,r.constructor=R,r.kill()._gc=!1,r._first=r._last=null,r._sortChildren=!1,r.add=r.insert=function(t,e){var i,s;if(t._startTime=Number(e||0)+t._delay,t._paused&&this!==t._timeline&&(t._pauseTime=t._startTime+(this.rawTime()-t._startTime)/t._timeScale),t.timeline&&t.timeline._remove(t,!0),t.timeline=t._timeline=this,t._gc&&t._enabled(!0,!0),i=this._last,this._sortChildren)for(s=t._startTime;i&&i._startTime>s;)i=i._prev;return i?(t._next=i._next,i._next=t):(t._next=this._first,this._first=t),t._next?t._next._prev=t:this._last=t,t._prev=i,this._timeline&&this._uncache(!0),this},r._remove=function(t,e){return t.timeline===this&&(e||t._enabled(!1,!0),t.timeline=null,t._prev?t._prev._next=t._next:this._first===t&&(this._first=t._next),t._next?t._next._prev=t._prev:this._last===t&&(this._last=t._prev),this._timeline&&this._uncache(!0)),this},r.render=function(t,e,i){var s,r=this._first;for(this._totalTime=this._time=this._rawPrevTime=t;r;)s=r._next,(r._active||t>=r._startTime&&!r._paused)&&(r._reversed?r.render((r._dirty?r.totalDuration():r._totalDuration)-(t-r._startTime)*r._timeScale,e,i):r.render((t-r._startTime)*r._timeScale,e,i)),r=s},r.rawTime=function(){return a||n.wake(),this._totalTime};var D=d("TweenLite",function(e,i,s){if(x.call(this,i,s),this.render=D.prototype.render,null==e)throw"Cannot tween a null target.";this.target=e="string"!=typeof e?e:D.selector(e)||e;var r,n,a,o=e.jquery||e.length&&e!==t&&e[0]&&(e[0]===t||e[0].nodeType&&e[0].style&&!e.nodeType),l=this.vars.overwrite;if(this._overwrite=l=null==l?j[D.defaultOverwrite]:"number"==typeof l?l>>0:j[l],(o||e instanceof Array||e.push&&m(e))&&"number"!=typeof e[0])for(this._targets=a=_.call(e,0),this._propLookup=[],this._siblings=[],r=0;a.length>r;r++)n=a[r],n?"string"!=typeof n?n.length&&n!==t&&n[0]&&(n[0]===t||n[0].nodeType&&n[0].style&&!n.nodeType)?(a.splice(r--,1),this._targets=a=a.concat(_.call(n,0))):(this._siblings[r]=B(n,this,!1),1===l&&this._siblings[r].length>1&&q(n,this,null,1,this._siblings[r])):(n=a[r--]=D.selector(n),"string"==typeof n&&a.splice(r+1,1)):a.splice(r--,1);else this._propLookup={},this._siblings=B(e,this,!1),1===l&&this._siblings.length>1&&q(e,this,null,1,this._siblings);(this.vars.immediateRender||0===i&&0===this._delay&&this.vars.immediateRender!==!1)&&this.render(-this._delay,!1,!0)},!0),E=function(e){return e.length&&e!==t&&e[0]&&(e[0]===t||e[0].nodeType&&e[0].style&&!e.nodeType)},I=function(t,e){var i,s={};for(i in t)F[i]||i in e&&"x"!==i&&"y"!==i&&"width"!==i&&"height"!==i&&"className"!==i&&"border"!==i||!(!N[i]||N[i]&&N[i]._autoCSS)||(s[i]=t[i],delete t[i]);t.css=s};r=D.prototype=new x,r.constructor=D,r.kill()._gc=!1,r.ratio=0,r._firstPT=r._targets=r._overwrittenProps=r._startAt=null,r._notifyPluginsOfEnabled=!1,D.version="1.11.5",D.defaultEase=r._ease=new T(null,null,1,1),D.defaultOverwrite="auto",D.ticker=n,D.autoSleep=!0,D.selector=t.$||t.jQuery||function(e){return t.$?(D.selector=t.$,t.$(e)):t.document?t.document.getElementById("#"===e.charAt(0)?e.substr(1):e):e};var O=D._internals={isArray:m,isSelector:E},N=D._plugins={},L=D._tweenLookup={},U=0,F=O.reservedProps={ease:1,delay:1,overwrite:1,onComplete:1,onCompleteParams:1,onCompleteScope:1,useFrames:1,runBackwards:1,startAt:1,onUpdate:1,onUpdateParams:1,onUpdateScope:1,onStart:1,onStartParams:1,onStartScope:1,onReverseComplete:1,onReverseCompleteParams:1,onReverseCompleteScope:1,onRepeat:1,onRepeatParams:1,onRepeatScope:1,easeParams:1,yoyo:1,immediateRender:1,repeat:1,repeatDelay:1,data:1,paused:1,reversed:1,autoCSS:1},j={none:0,all:1,auto:2,concurrent:3,allOnStart:4,preexisting:5,"true":1,"false":0},G=x._rootFramesTimeline=new R,Q=x._rootTimeline=new R;Q._startTime=n.time,G._startTime=n.frame,Q._active=G._active=!0,x._updateRoot=function(){if(Q.render((n.time-Q._startTime)*Q._timeScale,!1,!1),G.render((n.frame-G._startTime)*G._timeScale,!1,!1),!(n.frame%120)){var t,e,i;for(i in L){for(e=L[i].tweens,t=e.length;--t>-1;)e[t]._gc&&e.splice(t,1);0===e.length&&delete L[i]}if(i=Q._first,(!i||i._paused)&&D.autoSleep&&!G._first&&1===n._listeners.tick.length){for(;i&&i._paused;)i=i._next;i||n.sleep()}}},n.addEventListener("tick",x._updateRoot);var B=function(t,e,i){var s,r,n=t._gsTweenID;if(L[n||(t._gsTweenID=n="t"+U++)]||(L[n]={target:t,tweens:[]}),e&&(s=L[n].tweens,s[r=s.length]=e,i))for(;--r>-1;)s[r]===e&&s.splice(r,1);return L[n].tweens},q=function(t,e,i,s,r){var n,a,o,l;if(1===s||s>=4){for(l=r.length,n=0;l>n;n++)if((o=r[n])!==e)o._gc||o._enabled(!1,!1)&&(a=!0);else if(5===s)break;return a}var _,u=e._startTime+h,m=[],f=0,p=0===e._duration;for(n=r.length;--n>-1;)(o=r[n])===e||o._gc||o._paused||(o._timeline!==e._timeline?(_=_||$(e,0,p),0===$(o,_,p)&&(m[f++]=o)):u>=o._startTime&&o._startTime+o.totalDuration()/o._timeScale>u&&((p||!o._initted)&&2e-10>=u-o._startTime||(m[f++]=o)));for(n=f;--n>-1;)o=m[n],2===s&&o._kill(i,t)&&(a=!0),(2!==s||!o._firstPT&&o._initted)&&o._enabled(!1,!1)&&(a=!0);return a},$=function(t,e,i){for(var s=t._timeline,r=s._timeScale,n=t._startTime;s._timeline;){if(n+=s._startTime,r*=s._timeScale,s._paused)return-100;s=s._timeline}return n/=r,n>e?n-e:i&&n===e||!t._initted&&2*h>n-e?h:(n+=t.totalDuration()/t._timeScale/r)>e+h?0:n-e-h};r._init=function(){var t,e,i,s,r=this.vars,n=this._overwrittenProps,a=this._duration,o=r.immediateRender,l=r.ease;if(r.startAt){if(this._startAt&&this._startAt.render(-1,!0),r.startAt.overwrite=0,r.startAt.immediateRender=!0,this._startAt=D.to(this.target,0,r.startAt),o)if(this._time>0)this._startAt=null;else if(0!==a)return}else if(r.runBackwards&&0!==a)if(this._startAt)this._startAt.render(-1,!0),this._startAt=null;else{i={};for(s in r)F[s]&&"autoCSS"!==s||(i[s]=r[s]);if(i.overwrite=0,i.data="isFromStart",this._startAt=D.to(this.target,0,i),r.immediateRender){if(0===this._time)return}else this._startAt.render(-1,!0)}if(this._ease=l?l instanceof T?r.easeParams instanceof Array?l.config.apply(l,r.easeParams):l:"function"==typeof l?new T(l,r.easeParams):w[l]||D.defaultEase:D.defaultEase,this._easeType=this._ease._type,this._easePower=this._ease._power,this._firstPT=null,this._targets)for(t=this._targets.length;--t>-1;)this._initProps(this._targets[t],this._propLookup[t]={},this._siblings[t],n?n[t]:null)&&(e=!0);else e=this._initProps(this.target,this._propLookup,this._siblings,n);if(e&&D._onPluginEvent("_onInitAllProps",this),n&&(this._firstPT||"function"!=typeof this.target&&this._enabled(!1,!1)),r.runBackwards)for(i=this._firstPT;i;)i.s+=i.c,i.c=-i.c,i=i._next;this._onUpdate=r.onUpdate,this._initted=!0},r._initProps=function(e,i,s,r){var n,a,o,l,h,_;if(null==e)return!1;this.vars.css||e.style&&e!==t&&e.nodeType&&N.css&&this.vars.autoCSS!==!1&&I(this.vars,e);for(n in this.vars){if(_=this.vars[n],F[n])_&&(_ instanceof Array||_.push&&m(_))&&-1!==_.join("").indexOf("{self}")&&(this.vars[n]=_=this._swapSelfInParams(_,this));else if(N[n]&&(l=new N[n])._onInitTween(e,this.vars[n],this)){for(this._firstPT=h={_next:this._firstPT,t:l,p:"setRatio",s:0,c:1,f:!0,n:n,pg:!0,pr:l._priority},a=l._overwriteProps.length;--a>-1;)i[l._overwriteProps[a]]=this._firstPT;(l._priority||l._onInitAllProps)&&(o=!0),(l._onDisable||l._onEnable)&&(this._notifyPluginsOfEnabled=!0)}else this._firstPT=i[n]=h={_next:this._firstPT,t:e,p:n,f:"function"==typeof e[n],n:n,pg:!1,pr:0},h.s=h.f?e[n.indexOf("set")||"function"!=typeof e["get"+n.substr(3)]?n:"get"+n.substr(3)]():parseFloat(e[n]),h.c="string"==typeof _&&"="===_.charAt(1)?parseInt(_.charAt(0)+"1",10)*Number(_.substr(2)):Number(_)-h.s||0;h&&h._next&&(h._next._prev=h)}return r&&this._kill(r,e)?this._initProps(e,i,s,r):this._overwrite>1&&this._firstPT&&s.length>1&&q(e,this,i,this._overwrite,s)?(this._kill(i,e),this._initProps(e,i,s,r)):o},r.render=function(t,e,i){var s,r,n,a,o=this._time,l=this._duration;if(t>=l)this._totalTime=this._time=l,this.ratio=this._ease._calcEnd?this._ease.getRatio(1):1,this._reversed||(s=!0,r="onComplete"),0===l&&(a=this._rawPrevTime,(0===t||0>a||a===h)&&a!==t&&(i=!0,a>h&&(r="onReverseComplete")),this._rawPrevTime=a=!e||t||0===a?t:h);else if(1e-7>t)this._totalTime=this._time=0,this.ratio=this._ease._calcEnd?this._ease.getRatio(0):0,(0!==o||0===l&&this._rawPrevTime>h)&&(r="onReverseComplete",s=this._reversed),0>t?(this._active=!1,0===l&&(this._rawPrevTime>=0&&(i=!0),this._rawPrevTime=a=!e||t||0===this._rawPrevTime?t:h)):this._initted||(i=!0);else if(this._totalTime=this._time=t,this._easeType){var _=t/l,u=this._easeType,m=this._easePower;(1===u||3===u&&_>=.5)&&(_=1-_),3===u&&(_*=2),1===m?_*=_:2===m?_*=_*_:3===m?_*=_*_*_:4===m&&(_*=_*_*_*_),this.ratio=1===u?1-_:2===u?_:.5>t/l?_/2:1-_/2}else this.ratio=this._ease.getRatio(t/l);if(this._time!==o||i){if(!this._initted){if(this._init(),!this._initted||this._gc)return;this._time&&!s?this.ratio=this._ease.getRatio(this._time/l):s&&this._ease._calcEnd&&(this.ratio=this._ease.getRatio(0===this._time?0:1))}for(this._active||!this._paused&&this._time!==o&&t>=0&&(this._active=!0),0===o&&(this._startAt&&(t>=0?this._startAt.render(t,e,i):r||(r="_dummyGS")),this.vars.onStart&&(0!==this._time||0===l)&&(e||this.vars.onStart.apply(this.vars.onStartScope||this,this.vars.onStartParams||g))),n=this._firstPT;n;)n.f?n.t[n.p](n.c*this.ratio+n.s):n.t[n.p]=n.c*this.ratio+n.s,n=n._next;this._onUpdate&&(0>t&&this._startAt&&this._startTime&&this._startAt.render(t,e,i),e||(this._time!==o||s)&&this._onUpdate.apply(this.vars.onUpdateScope||this,this.vars.onUpdateParams||g)),r&&(this._gc||(0>t&&this._startAt&&!this._onUpdate&&this._startTime&&this._startAt.render(t,e,i),s&&(this._timeline.autoRemoveChildren&&this._enabled(!1,!1),this._active=!1),!e&&this.vars[r]&&this.vars[r].apply(this.vars[r+"Scope"]||this,this.vars[r+"Params"]||g),0===l&&this._rawPrevTime===h&&a!==h&&(this._rawPrevTime=0)))}},r._kill=function(t,e){if("all"===t&&(t=null),null==t&&(null==e||e===this.target))return this._enabled(!1,!1);e="string"!=typeof e?e||this._targets||this.target:D.selector(e)||e;var i,s,r,n,a,o,l,h;if((m(e)||E(e))&&"number"!=typeof e[0])for(i=e.length;--i>-1;)this._kill(t,e[i])&&(o=!0);else{if(this._targets){for(i=this._targets.length;--i>-1;)if(e===this._targets[i]){a=this._propLookup[i]||{},this._overwrittenProps=this._overwrittenProps||[],s=this._overwrittenProps[i]=t?this._overwrittenProps[i]||{}:"all";break}}else{if(e!==this.target)return!1;a=this._propLookup,s=this._overwrittenProps=t?this._overwrittenProps||{}:"all"}if(a){l=t||a,h=t!==s&&"all"!==s&&t!==a&&("object"!=typeof t||!t._tempKill);for(r in l)(n=a[r])&&(n.pg&&n.t._kill(l)&&(o=!0),n.pg&&0!==n.t._overwriteProps.length||(n._prev?n._prev._next=n._next:n===this._firstPT&&(this._firstPT=n._next),n._next&&(n._next._prev=n._prev),n._next=n._prev=null),delete a[r]),h&&(s[r]=1);!this._firstPT&&this._initted&&this._enabled(!1,!1)}}return o},r.invalidate=function(){return this._notifyPluginsOfEnabled&&D._onPluginEvent("_onDisable",this),this._firstPT=null,this._overwrittenProps=null,this._onUpdate=null,this._startAt=null,this._initted=this._active=this._notifyPluginsOfEnabled=!1,this._propLookup=this._targets?{}:[],this},r._enabled=function(t,e){if(a||n.wake(),t&&this._gc){var i,s=this._targets;if(s)for(i=s.length;--i>-1;)this._siblings[i]=B(s[i],this,!0);else this._siblings=B(this.target,this,!0)}return x.prototype._enabled.call(this,t,e),this._notifyPluginsOfEnabled&&this._firstPT?D._onPluginEvent(t?"_onEnable":"_onDisable",this):!1},D.to=function(t,e,i){return new D(t,e,i)},D.from=function(t,e,i){return i.runBackwards=!0,i.immediateRender=0!=i.immediateRender,new D(t,e,i)},D.fromTo=function(t,e,i,s){return s.startAt=i,s.immediateRender=0!=s.immediateRender&&0!=i.immediateRender,new D(t,e,s)},D.delayedCall=function(t,e,i,s,r){return new D(e,0,{delay:t,onComplete:e,onCompleteParams:i,onCompleteScope:s,onReverseComplete:e,onReverseCompleteParams:i,onReverseCompleteScope:s,immediateRender:!1,useFrames:r,overwrite:0})},D.set=function(t,e){return new D(t,0,e)},D.getTweensOf=function(t,e){if(null==t)return[];t="string"!=typeof t?t:D.selector(t)||t;var i,s,r,n;if((m(t)||E(t))&&"number"!=typeof t[0]){for(i=t.length,s=[];--i>-1;)s=s.concat(D.getTweensOf(t[i],e));for(i=s.length;--i>-1;)for(n=s[i],r=i;--r>-1;)n===s[r]&&s.splice(i,1)}else for(s=B(t).concat(),i=s.length;--i>-1;)(s[i]._gc||e&&!s[i].isActive())&&s.splice(i,1);return s},D.killTweensOf=D.killDelayedCallsTo=function(t,e,i){"object"==typeof e&&(i=e,e=!1);for(var s=D.getTweensOf(t,e),r=s.length;--r>-1;)s[r]._kill(i,t)};var M=d("plugins.TweenPlugin",function(t,e){this._overwriteProps=(t||"").split(","),this._propName=this._overwriteProps[0],this._priority=e||0,this._super=M.prototype},!0);if(r=M.prototype,M.version="1.10.1",M.API=2,r._firstPT=null,r._addTween=function(t,e,i,s,r,n){var a,o;return null!=s&&(a="number"==typeof s||"="!==s.charAt(1)?Number(s)-i:parseInt(s.charAt(0)+"1",10)*Number(s.substr(2)))?(this._firstPT=o={_next:this._firstPT,t:t,p:e,s:i,c:a,f:"function"==typeof t[e],n:r||e,r:n},o._next&&(o._next._prev=o),o):void 0},r.setRatio=function(t){for(var e,i=this._firstPT,s=1e-6;i;)e=i.c*t+i.s,i.r?e=0|e+(e>0?.5:-.5):s>e&&e>-s&&(e=0),i.f?i.t[i.p](e):i.t[i.p]=e,i=i._next},r._kill=function(t){var e,i=this._overwriteProps,s=this._firstPT;if(null!=t[this._propName])this._overwriteProps=[];else for(e=i.length;--e>-1;)null!=t[i[e]]&&i.splice(e,1);for(;s;)null!=t[s.n]&&(s._next&&(s._next._prev=s._prev),s._prev?(s._prev._next=s._next,s._prev=null):this._firstPT===s&&(this._firstPT=s._next)),s=s._next;return!1},r._roundProps=function(t,e){for(var i=this._firstPT;i;)(t[this._propName]||null!=i.n&&t[i.n.split(this._propName+"_").join("")])&&(i.r=e),i=i._next},D._onPluginEvent=function(t,e){var i,s,r,n,a,o=e._firstPT;if("_onInitAllProps"===t){for(;o;){for(a=o._next,s=r;s&&s.pr>o.pr;)s=s._next;(o._prev=s?s._prev:n)?o._prev._next=o:r=o,(o._next=s)?s._prev=o:n=o,o=a}o=e._firstPT=r}for(;o;)o.pg&&"function"==typeof o.t[t]&&o.t[t]()&&(i=!0),o=o._next;return i},M.activate=function(t){for(var e=t.length;--e>-1;)t[e].API===M.API&&(N[(new t[e])._propName]=t[e]);return!0},c.plugin=function(t){if(!(t&&t.propName&&t.init&&t.API))throw"illegal plugin definition.";var e,i=t.propName,s=t.priority||0,r=t.overwriteProps,n={init:"_onInitTween",set:"setRatio",kill:"_kill",round:"_roundProps",initAll:"_onInitAllProps"},a=d("plugins."+i.charAt(0).toUpperCase()+i.substr(1)+"Plugin",function(){M.call(this,i,s),this._overwriteProps=r||[]},t.global===!0),o=a.prototype=new M(i);o.constructor=a,a.API=t.API;for(e in n)"function"==typeof t[e]&&(o[n[e]]=t[e]);return a.version=t.version,M.activate([a]),a},i=t._gsQueue){for(s=0;i.length>s;s++)i[s]();for(r in f)f[r].func||t.console.log("GSAP encountered missing dependency: com.greensock."+r)}a=!1}})(window);


/*!
 * VERSION: 1.11.5
 * DATE: 2014-02-20
 * UPDATES AND DOCS AT: http://www.greensock.com
 *
 * @license Copyright (c) 2008-2014, GreenSock. All rights reserved.
 * This work is subject to the terms at http://www.greensock.com/terms_of_use.html or for
 * Club GreenSock members, the software agreement that was issued with your membership.
 * 
 * @author: Jack Doyle, jack@greensock.com
 */
(window._gsQueue||(window._gsQueue=[])).push(function(){"use strict";window._gsDefine("TimelineLite",["core.Animation","core.SimpleTimeline","TweenLite"],function(t,e,i){var s=function(t){e.call(this,t),this._labels={},this.autoRemoveChildren=this.vars.autoRemoveChildren===!0,this.smoothChildTiming=this.vars.smoothChildTiming===!0,this._sortChildren=!0,this._onUpdate=this.vars.onUpdate;var i,s,r=this.vars;for(s in r)i=r[s],a(i)&&-1!==i.join("").indexOf("{self}")&&(r[s]=this._swapSelfInParams(i));a(r.tweens)&&this.add(r.tweens,0,r.align,r.stagger)},r=1e-10,n=i._internals.isSelector,a=i._internals.isArray,o=[],h=function(t){var e,i={};for(e in t)i[e]=t[e];return i},l=function(t,e,i,s){t._timeline.pause(t._startTime),e&&e.apply(s||t._timeline,i||o)},_=o.slice,u=s.prototype=new e;return s.version="1.11.5",u.constructor=s,u.kill()._gc=!1,u.to=function(t,e,s,r){return e?this.add(new i(t,e,s),r):this.set(t,s,r)},u.from=function(t,e,s,r){return this.add(i.from(t,e,s),r)},u.fromTo=function(t,e,s,r,n){return e?this.add(i.fromTo(t,e,s,r),n):this.set(t,r,n)},u.staggerTo=function(t,e,r,a,o,l,u,p){var f,c=new s({onComplete:l,onCompleteParams:u,onCompleteScope:p,smoothChildTiming:this.smoothChildTiming});for("string"==typeof t&&(t=i.selector(t)||t),n(t)&&(t=_.call(t,0)),a=a||0,f=0;t.length>f;f++)r.startAt&&(r.startAt=h(r.startAt)),c.to(t[f],e,h(r),f*a);return this.add(c,o)},u.staggerFrom=function(t,e,i,s,r,n,a,o){return i.immediateRender=0!=i.immediateRender,i.runBackwards=!0,this.staggerTo(t,e,i,s,r,n,a,o)},u.staggerFromTo=function(t,e,i,s,r,n,a,o,h){return s.startAt=i,s.immediateRender=0!=s.immediateRender&&0!=i.immediateRender,this.staggerTo(t,e,s,r,n,a,o,h)},u.call=function(t,e,s,r){return this.add(i.delayedCall(0,t,e,s),r)},u.set=function(t,e,s){return s=this._parseTimeOrLabel(s,0,!0),null==e.immediateRender&&(e.immediateRender=s===this._time&&!this._paused),this.add(new i(t,0,e),s)},s.exportRoot=function(t,e){t=t||{},null==t.smoothChildTiming&&(t.smoothChildTiming=!0);var r,n,a=new s(t),o=a._timeline;for(null==e&&(e=!0),o._remove(a,!0),a._startTime=0,a._rawPrevTime=a._time=a._totalTime=o._time,r=o._first;r;)n=r._next,e&&r instanceof i&&r.target===r.vars.onComplete||a.add(r,r._startTime-r._delay),r=n;return o.add(a,0),a},u.add=function(r,n,o,h){var l,_,u,p,f,c;if("number"!=typeof n&&(n=this._parseTimeOrLabel(n,0,!0,r)),!(r instanceof t)){if(r instanceof Array||r&&r.push&&a(r)){for(o=o||"normal",h=h||0,l=n,_=r.length,u=0;_>u;u++)a(p=r[u])&&(p=new s({tweens:p})),this.add(p,l),"string"!=typeof p&&"function"!=typeof p&&("sequence"===o?l=p._startTime+p.totalDuration()/p._timeScale:"start"===o&&(p._startTime-=p.delay())),l+=h;return this._uncache(!0)}if("string"==typeof r)return this.addLabel(r,n);if("function"!=typeof r)throw"Cannot add "+r+" into the timeline; it is not a tween, timeline, function, or string.";r=i.delayedCall(0,r)}if(e.prototype.add.call(this,r,n),(this._gc||this._time===this._duration)&&!this._paused&&this._duration<this.duration())for(f=this,c=f.rawTime()>r._startTime;f._timeline;)c&&f._timeline.smoothChildTiming?f.totalTime(f._totalTime,!0):f._gc&&f._enabled(!0,!1),f=f._timeline;return this},u.remove=function(e){if(e instanceof t)return this._remove(e,!1);if(e instanceof Array||e&&e.push&&a(e)){for(var i=e.length;--i>-1;)this.remove(e[i]);return this}return"string"==typeof e?this.removeLabel(e):this.kill(null,e)},u._remove=function(t,i){e.prototype._remove.call(this,t,i);var s=this._last;return s?this._time>s._startTime+s._totalDuration/s._timeScale&&(this._time=this.duration(),this._totalTime=this._totalDuration):this._time=this._totalTime=this._duration=this._totalDuration=0,this},u.append=function(t,e){return this.add(t,this._parseTimeOrLabel(null,e,!0,t))},u.insert=u.insertMultiple=function(t,e,i,s){return this.add(t,e||0,i,s)},u.appendMultiple=function(t,e,i,s){return this.add(t,this._parseTimeOrLabel(null,e,!0,t),i,s)},u.addLabel=function(t,e){return this._labels[t]=this._parseTimeOrLabel(e),this},u.addPause=function(t,e,i,s){return this.call(l,["{self}",e,i,s],this,t)},u.removeLabel=function(t){return delete this._labels[t],this},u.getLabelTime=function(t){return null!=this._labels[t]?this._labels[t]:-1},u._parseTimeOrLabel=function(e,i,s,r){var n;if(r instanceof t&&r.timeline===this)this.remove(r);else if(r&&(r instanceof Array||r.push&&a(r)))for(n=r.length;--n>-1;)r[n]instanceof t&&r[n].timeline===this&&this.remove(r[n]);if("string"==typeof i)return this._parseTimeOrLabel(i,s&&"number"==typeof e&&null==this._labels[i]?e-this.duration():0,s);if(i=i||0,"string"!=typeof e||!isNaN(e)&&null==this._labels[e])null==e&&(e=this.duration());else{if(n=e.indexOf("="),-1===n)return null==this._labels[e]?s?this._labels[e]=this.duration()+i:i:this._labels[e]+i;i=parseInt(e.charAt(n-1)+"1",10)*Number(e.substr(n+1)),e=n>1?this._parseTimeOrLabel(e.substr(0,n-1),0,s):this.duration()}return Number(e)+i},u.seek=function(t,e){return this.totalTime("number"==typeof t?t:this._parseTimeOrLabel(t),e!==!1)},u.stop=function(){return this.paused(!0)},u.gotoAndPlay=function(t,e){return this.play(t,e)},u.gotoAndStop=function(t,e){return this.pause(t,e)},u.render=function(t,e,i){this._gc&&this._enabled(!0,!1);var s,n,a,h,l,_=this._dirty?this.totalDuration():this._totalDuration,u=this._time,p=this._startTime,f=this._timeScale,c=this._paused;if(t>=_?(this._totalTime=this._time=_,this._reversed||this._hasPausedChild()||(n=!0,h="onComplete",0===this._duration&&(0===t||0>this._rawPrevTime||this._rawPrevTime===r)&&this._rawPrevTime!==t&&this._first&&(l=!0,this._rawPrevTime>r&&(h="onReverseComplete"))),this._rawPrevTime=this._duration||!e||t||0===this._rawPrevTime?t:r,t=_+1e-4):1e-7>t?(this._totalTime=this._time=0,(0!==u||0===this._duration&&(this._rawPrevTime>r||0>t&&this._rawPrevTime>=0))&&(h="onReverseComplete",n=this._reversed),0>t?(this._active=!1,0===this._duration&&this._rawPrevTime>=0&&this._first&&(l=!0),this._rawPrevTime=t):(this._rawPrevTime=this._duration||!e||t||0===this._rawPrevTime?t:r,t=0,this._initted||(l=!0))):this._totalTime=this._time=this._rawPrevTime=t,this._time!==u&&this._first||i||l){if(this._initted||(this._initted=!0),this._active||!this._paused&&this._time!==u&&t>0&&(this._active=!0),0===u&&this.vars.onStart&&0!==this._time&&(e||this.vars.onStart.apply(this.vars.onStartScope||this,this.vars.onStartParams||o)),this._time>=u)for(s=this._first;s&&(a=s._next,!this._paused||c);)(s._active||s._startTime<=this._time&&!s._paused&&!s._gc)&&(s._reversed?s.render((s._dirty?s.totalDuration():s._totalDuration)-(t-s._startTime)*s._timeScale,e,i):s.render((t-s._startTime)*s._timeScale,e,i)),s=a;else for(s=this._last;s&&(a=s._prev,!this._paused||c);)(s._active||u>=s._startTime&&!s._paused&&!s._gc)&&(s._reversed?s.render((s._dirty?s.totalDuration():s._totalDuration)-(t-s._startTime)*s._timeScale,e,i):s.render((t-s._startTime)*s._timeScale,e,i)),s=a;this._onUpdate&&(e||this._onUpdate.apply(this.vars.onUpdateScope||this,this.vars.onUpdateParams||o)),h&&(this._gc||(p===this._startTime||f!==this._timeScale)&&(0===this._time||_>=this.totalDuration())&&(n&&(this._timeline.autoRemoveChildren&&this._enabled(!1,!1),this._active=!1),!e&&this.vars[h]&&this.vars[h].apply(this.vars[h+"Scope"]||this,this.vars[h+"Params"]||o)))}},u._hasPausedChild=function(){for(var t=this._first;t;){if(t._paused||t instanceof s&&t._hasPausedChild())return!0;t=t._next}return!1},u.getChildren=function(t,e,s,r){r=r||-9999999999;for(var n=[],a=this._first,o=0;a;)r>a._startTime||(a instanceof i?e!==!1&&(n[o++]=a):(s!==!1&&(n[o++]=a),t!==!1&&(n=n.concat(a.getChildren(!0,e,s)),o=n.length))),a=a._next;return n},u.getTweensOf=function(t,e){for(var s=i.getTweensOf(t),r=s.length,n=[],a=0;--r>-1;)(s[r].timeline===this||e&&this._contains(s[r]))&&(n[a++]=s[r]);return n},u._contains=function(t){for(var e=t.timeline;e;){if(e===this)return!0;e=e.timeline}return!1},u.shiftChildren=function(t,e,i){i=i||0;for(var s,r=this._first,n=this._labels;r;)r._startTime>=i&&(r._startTime+=t),r=r._next;if(e)for(s in n)n[s]>=i&&(n[s]+=t);return this._uncache(!0)},u._kill=function(t,e){if(!t&&!e)return this._enabled(!1,!1);for(var i=e?this.getTweensOf(e):this.getChildren(!0,!0,!1),s=i.length,r=!1;--s>-1;)i[s]._kill(t,e)&&(r=!0);return r},u.clear=function(t){var e=this.getChildren(!1,!0,!0),i=e.length;for(this._time=this._totalTime=0;--i>-1;)e[i]._enabled(!1,!1);return t!==!1&&(this._labels={}),this._uncache(!0)},u.invalidate=function(){for(var t=this._first;t;)t.invalidate(),t=t._next;return this},u._enabled=function(t,i){if(t===this._gc)for(var s=this._first;s;)s._enabled(t,!0),s=s._next;return e.prototype._enabled.call(this,t,i)},u.duration=function(t){return arguments.length?(0!==this.duration()&&0!==t&&this.timeScale(this._duration/t),this):(this._dirty&&this.totalDuration(),this._duration)},u.totalDuration=function(t){if(!arguments.length){if(this._dirty){for(var e,i,s=0,r=this._last,n=999999999999;r;)e=r._prev,r._dirty&&r.totalDuration(),r._startTime>n&&this._sortChildren&&!r._paused?this.add(r,r._startTime-r._delay):n=r._startTime,0>r._startTime&&!r._paused&&(s-=r._startTime,this._timeline.smoothChildTiming&&(this._startTime+=r._startTime/this._timeScale),this.shiftChildren(-r._startTime,!1,-9999999999),n=0),i=r._startTime+r._totalDuration/r._timeScale,i>s&&(s=i),r=e;this._duration=this._totalDuration=s,this._dirty=!1}return this._totalDuration}return 0!==this.totalDuration()&&0!==t&&this.timeScale(this._totalDuration/t),this},u.usesFrames=function(){for(var e=this._timeline;e._timeline;)e=e._timeline;return e===t._rootFramesTimeline},u.rawTime=function(){return this._paused?this._totalTime:(this._timeline.rawTime()-this._startTime)*this._timeScale},s},!0)}),window._gsDefine&&window._gsQueue.pop()();



/*!
 * VERSION: beta 1.9.3
 * DATE: 2013-04-02
 * UPDATES AND DOCS AT: http://www.greensock.com
 *
 * @license Copyright (c) 2008-2014, GreenSock. All rights reserved.
 * This work is subject to the terms at http://www.greensock.com/terms_of_use.html or for
 * Club GreenSock members, the software agreement that was issued with your membership.
 * 
 * @author: Jack Doyle, jack@greensock.com
 **/
(window._gsQueue||(window._gsQueue=[])).push(function(){"use strict";window._gsDefine("easing.Back",["easing.Ease"],function(t){var e,i,s,r=window.GreenSockGlobals||window,n=r.com.greensock,a=2*Math.PI,o=Math.PI/2,h=n._class,l=function(e,i){var s=h("easing."+e,function(){},!0),r=s.prototype=new t;return r.constructor=s,r.getRatio=i,s},_=t.register||function(){},u=function(t,e,i,s){var r=h("easing."+t,{easeOut:new e,easeIn:new i,easeInOut:new s},!0);return _(r,t),r},c=function(t,e,i){this.t=t,this.v=e,i&&(this.next=i,i.prev=this,this.c=i.v-e,this.gap=i.t-t)},p=function(e,i){var s=h("easing."+e,function(t){this._p1=t||0===t?t:1.70158,this._p2=1.525*this._p1},!0),r=s.prototype=new t;return r.constructor=s,r.getRatio=i,r.config=function(t){return new s(t)},s},f=u("Back",p("BackOut",function(t){return(t-=1)*t*((this._p1+1)*t+this._p1)+1}),p("BackIn",function(t){return t*t*((this._p1+1)*t-this._p1)}),p("BackInOut",function(t){return 1>(t*=2)?.5*t*t*((this._p2+1)*t-this._p2):.5*((t-=2)*t*((this._p2+1)*t+this._p2)+2)})),m=h("easing.SlowMo",function(t,e,i){e=e||0===e?e:.7,null==t?t=.7:t>1&&(t=1),this._p=1!==t?e:0,this._p1=(1-t)/2,this._p2=t,this._p3=this._p1+this._p2,this._calcEnd=i===!0},!0),d=m.prototype=new t;return d.constructor=m,d.getRatio=function(t){var e=t+(.5-t)*this._p;return this._p1>t?this._calcEnd?1-(t=1-t/this._p1)*t:e-(t=1-t/this._p1)*t*t*t*e:t>this._p3?this._calcEnd?1-(t=(t-this._p3)/this._p1)*t:e+(t-e)*(t=(t-this._p3)/this._p1)*t*t*t:this._calcEnd?1:e},m.ease=new m(.7,.7),d.config=m.config=function(t,e,i){return new m(t,e,i)},e=h("easing.SteppedEase",function(t){t=t||1,this._p1=1/t,this._p2=t+1},!0),d=e.prototype=new t,d.constructor=e,d.getRatio=function(t){return 0>t?t=0:t>=1&&(t=.999999999),(this._p2*t>>0)*this._p1},d.config=e.config=function(t){return new e(t)},i=h("easing.RoughEase",function(e){e=e||{};for(var i,s,r,n,a,o,h=e.taper||"none",l=[],_=0,u=0|(e.points||20),p=u,f=e.randomize!==!1,m=e.clamp===!0,d=e.template instanceof t?e.template:null,g="number"==typeof e.strength?.4*e.strength:.4;--p>-1;)i=f?Math.random():1/u*p,s=d?d.getRatio(i):i,"none"===h?r=g:"out"===h?(n=1-i,r=n*n*g):"in"===h?r=i*i*g:.5>i?(n=2*i,r=.5*n*n*g):(n=2*(1-i),r=.5*n*n*g),f?s+=Math.random()*r-.5*r:p%2?s+=.5*r:s-=.5*r,m&&(s>1?s=1:0>s&&(s=0)),l[_++]={x:i,y:s};for(l.sort(function(t,e){return t.x-e.x}),o=new c(1,1,null),p=u;--p>-1;)a=l[p],o=new c(a.x,a.y,o);this._prev=new c(0,0,0!==o.t?o:o.next)},!0),d=i.prototype=new t,d.constructor=i,d.getRatio=function(t){var e=this._prev;if(t>e.t){for(;e.next&&t>=e.t;)e=e.next;e=e.prev}else for(;e.prev&&e.t>=t;)e=e.prev;return this._prev=e,e.v+(t-e.t)/e.gap*e.c},d.config=function(t){return new i(t)},i.ease=new i,u("Bounce",l("BounceOut",function(t){return 1/2.75>t?7.5625*t*t:2/2.75>t?7.5625*(t-=1.5/2.75)*t+.75:2.5/2.75>t?7.5625*(t-=2.25/2.75)*t+.9375:7.5625*(t-=2.625/2.75)*t+.984375}),l("BounceIn",function(t){return 1/2.75>(t=1-t)?1-7.5625*t*t:2/2.75>t?1-(7.5625*(t-=1.5/2.75)*t+.75):2.5/2.75>t?1-(7.5625*(t-=2.25/2.75)*t+.9375):1-(7.5625*(t-=2.625/2.75)*t+.984375)}),l("BounceInOut",function(t){var e=.5>t;return t=e?1-2*t:2*t-1,t=1/2.75>t?7.5625*t*t:2/2.75>t?7.5625*(t-=1.5/2.75)*t+.75:2.5/2.75>t?7.5625*(t-=2.25/2.75)*t+.9375:7.5625*(t-=2.625/2.75)*t+.984375,e?.5*(1-t):.5*t+.5})),u("Circ",l("CircOut",function(t){return Math.sqrt(1-(t-=1)*t)}),l("CircIn",function(t){return-(Math.sqrt(1-t*t)-1)}),l("CircInOut",function(t){return 1>(t*=2)?-.5*(Math.sqrt(1-t*t)-1):.5*(Math.sqrt(1-(t-=2)*t)+1)})),s=function(e,i,s){var r=h("easing."+e,function(t,e){this._p1=t||1,this._p2=e||s,this._p3=this._p2/a*(Math.asin(1/this._p1)||0)},!0),n=r.prototype=new t;return n.constructor=r,n.getRatio=i,n.config=function(t,e){return new r(t,e)},r},u("Elastic",s("ElasticOut",function(t){return this._p1*Math.pow(2,-10*t)*Math.sin((t-this._p3)*a/this._p2)+1},.3),s("ElasticIn",function(t){return-(this._p1*Math.pow(2,10*(t-=1))*Math.sin((t-this._p3)*a/this._p2))},.3),s("ElasticInOut",function(t){return 1>(t*=2)?-.5*this._p1*Math.pow(2,10*(t-=1))*Math.sin((t-this._p3)*a/this._p2):.5*this._p1*Math.pow(2,-10*(t-=1))*Math.sin((t-this._p3)*a/this._p2)+1},.45)),u("Expo",l("ExpoOut",function(t){return 1-Math.pow(2,-10*t)}),l("ExpoIn",function(t){return Math.pow(2,10*(t-1))-.001}),l("ExpoInOut",function(t){return 1>(t*=2)?.5*Math.pow(2,10*(t-1)):.5*(2-Math.pow(2,-10*(t-1)))})),u("Sine",l("SineOut",function(t){return Math.sin(t*o)}),l("SineIn",function(t){return-Math.cos(t*o)+1}),l("SineInOut",function(t){return-.5*(Math.cos(Math.PI*t)-1)})),h("easing.EaseLookup",{find:function(e){return t.map[e]}},!0),_(r.SlowMo,"SlowMo","ease,"),_(i,"RoughEase","ease,"),_(e,"SteppedEase","ease,"),f},!0)}),window._gsDefine&&window._gsQueue.pop()();


/*!
 * VERSION: 1.11.5
 * DATE: 2014-02-20
 * UPDATES AND DOCS AT: http://www.greensock.com
 *
 * @license Copyright (c) 2008-2014, GreenSock. All rights reserved.
 * This work is subject to the terms at http://www.greensock.com/terms_of_use.html or for
 * Club GreenSock members, the software agreement that was issued with your membership.
 * 
 * @author: Jack Doyle, jack@greensock.com
 */
(window._gsQueue||(window._gsQueue=[])).push(function(){"use strict";window._gsDefine("plugins.CSSPlugin",["plugins.TweenPlugin","TweenLite"],function(t,e){var i,r,s,n,a=function(){t.call(this,"css"),this._overwriteProps.length=0,this.setRatio=a.prototype.setRatio},o={},l=a.prototype=new t("css");l.constructor=a,a.version="1.11.5",a.API=2,a.defaultTransformPerspective=0,l="px",a.suffixMap={top:l,right:l,bottom:l,left:l,width:l,height:l,fontSize:l,padding:l,margin:l,perspective:l,lineHeight:""};var h,u,_,p,f,c,d=/(?:\d|\-\d|\.\d|\-\.\d)+/g,m=/(?:\d|\-\d|\.\d|\-\.\d|\+=\d|\-=\d|\+=.\d|\-=\.\d)+/g,g=/(?:\+=|\-=|\-|\b)[\d\-\.]+[a-zA-Z0-9]*(?:%|\b)/gi,v=/[^\d\-\.]/g,y=/(?:\d|\-|\+|=|#|\.)*/g,T=/opacity *= *([^)]*)/,x=/opacity:([^;]*)/,w=/alpha\(opacity *=.+?\)/i,b=/^(rgb|hsl)/,P=/([A-Z])/g,S=/-([a-z])/gi,R=/(^(?:url\(\"|url\())|(?:(\"\))$|\)$)/gi,k=function(t,e){return e.toUpperCase()},C=/(?:Left|Right|Width)/i,A=/(M11|M12|M21|M22)=[\d\-\.e]+/gi,O=/progid\:DXImageTransform\.Microsoft\.Matrix\(.+?\)/i,D=/,(?=[^\)]*(?:\(|$))/gi,M=Math.PI/180,L=180/Math.PI,N={},X=document,I=X.createElement("div"),E=X.createElement("img"),F=a._internals={_specialProps:o},Y=navigator.userAgent,z=function(){var t,e=Y.indexOf("Android"),i=X.createElement("div");return _=-1!==Y.indexOf("Safari")&&-1===Y.indexOf("Chrome")&&(-1===e||Number(Y.substr(e+8,1))>3),f=_&&6>Number(Y.substr(Y.indexOf("Version/")+8,1)),p=-1!==Y.indexOf("Firefox"),/MSIE ([0-9]{1,}[\.0-9]{0,})/.exec(Y)&&(c=parseFloat(RegExp.$1)),i.innerHTML="<a style='top:1px;opacity:.55;'>a</a>",t=i.getElementsByTagName("a")[0],t?/^0.55/.test(t.style.opacity):!1}(),U=function(t){return T.test("string"==typeof t?t:(t.currentStyle?t.currentStyle.filter:t.style.filter)||"")?parseFloat(RegExp.$1)/100:1},B=function(t){window.console&&console.log(t)},j="",W="",V=function(t,e){e=e||I;var i,r,s=e.style;if(void 0!==s[t])return t;for(t=t.charAt(0).toUpperCase()+t.substr(1),i=["O","Moz","ms","Ms","Webkit"],r=5;--r>-1&&void 0===s[i[r]+t];);return r>=0?(W=3===r?"ms":i[r],j="-"+W.toLowerCase()+"-",W+t):null},q=X.defaultView?X.defaultView.getComputedStyle:function(){},H=a.getStyle=function(t,e,i,r,s){var n;return z||"opacity"!==e?(!r&&t.style[e]?n=t.style[e]:(i=i||q(t,null))?(t=i.getPropertyValue(e.replace(P,"-$1").toLowerCase()),n=t||i.length?t:i[e]):t.currentStyle&&(n=t.currentStyle[e]),null==s||n&&"none"!==n&&"auto"!==n&&"auto auto"!==n?n:s):U(t)},Q=function(t,e,i,r,s){if("px"===r||!r)return i;if("auto"===r||!i)return 0;var n,a=C.test(e),o=t,l=I.style,h=0>i;return h&&(i=-i),"%"===r&&-1!==e.indexOf("border")?n=i/100*(a?t.clientWidth:t.clientHeight):(l.cssText="border:0 solid red;position:"+H(t,"position")+";line-height:0;","%"!==r&&o.appendChild?l[a?"borderLeftWidth":"borderTopWidth"]=i+r:(o=t.parentNode||X.body,l[a?"width":"height"]=i+r),o.appendChild(I),n=parseFloat(I[a?"offsetWidth":"offsetHeight"]),o.removeChild(I),0!==n||s||(n=Q(t,e,i,r,!0))),h?-n:n},Z=function(t,e,i){if("absolute"!==H(t,"position",i))return 0;var r="left"===e?"Left":"Top",s=H(t,"margin"+r,i);return t["offset"+r]-(Q(t,e,parseFloat(s),s.replace(y,""))||0)},$=function(t,e){var i,r,s={};if(e=e||q(t,null))if(i=e.length)for(;--i>-1;)s[e[i].replace(S,k)]=e.getPropertyValue(e[i]);else for(i in e)s[i]=e[i];else if(e=t.currentStyle||t.style)for(i in e)"string"==typeof i&&void 0===s[i]&&(s[i.replace(S,k)]=e[i]);return z||(s.opacity=U(t)),r=be(t,e,!1),s.rotation=r.rotation,s.skewX=r.skewX,s.scaleX=r.scaleX,s.scaleY=r.scaleY,s.x=r.x,s.y=r.y,we&&(s.z=r.z,s.rotationX=r.rotationX,s.rotationY=r.rotationY,s.scaleZ=r.scaleZ),s.filters&&delete s.filters,s},G=function(t,e,i,r,s){var n,a,o,l={},h=t.style;for(a in i)"cssText"!==a&&"length"!==a&&isNaN(a)&&(e[a]!==(n=i[a])||s&&s[a])&&-1===a.indexOf("Origin")&&("number"==typeof n||"string"==typeof n)&&(l[a]="auto"!==n||"left"!==a&&"top"!==a?""!==n&&"auto"!==n&&"none"!==n||"string"!=typeof e[a]||""===e[a].replace(v,"")?n:0:Z(t,a),void 0!==h[a]&&(o=new _e(h,a,h[a],o)));if(r)for(a in r)"className"!==a&&(l[a]=r[a]);return{difs:l,firstMPT:o}},K={width:["Left","Right"],height:["Top","Bottom"]},J=["marginLeft","marginRight","marginTop","marginBottom"],te=function(t,e,i){var r=parseFloat("width"===e?t.offsetWidth:t.offsetHeight),s=K[e],n=s.length;for(i=i||q(t,null);--n>-1;)r-=parseFloat(H(t,"padding"+s[n],i,!0))||0,r-=parseFloat(H(t,"border"+s[n]+"Width",i,!0))||0;return r},ee=function(t,e){(null==t||""===t||"auto"===t||"auto auto"===t)&&(t="0 0");var i=t.split(" "),r=-1!==t.indexOf("left")?"0%":-1!==t.indexOf("right")?"100%":i[0],s=-1!==t.indexOf("top")?"0%":-1!==t.indexOf("bottom")?"100%":i[1];return null==s?s="0":"center"===s&&(s="50%"),("center"===r||isNaN(parseFloat(r))&&-1===(r+"").indexOf("="))&&(r="50%"),e&&(e.oxp=-1!==r.indexOf("%"),e.oyp=-1!==s.indexOf("%"),e.oxr="="===r.charAt(1),e.oyr="="===s.charAt(1),e.ox=parseFloat(r.replace(v,"")),e.oy=parseFloat(s.replace(v,""))),r+" "+s+(i.length>2?" "+i[2]:"")},ie=function(t,e){return"string"==typeof t&&"="===t.charAt(1)?parseInt(t.charAt(0)+"1",10)*parseFloat(t.substr(2)):parseFloat(t)-parseFloat(e)},re=function(t,e){return null==t?e:"string"==typeof t&&"="===t.charAt(1)?parseInt(t.charAt(0)+"1",10)*Number(t.substr(2))+e:parseFloat(t)},se=function(t,e,i,r){var s,n,a,o,l=1e-6;return null==t?o=e:"number"==typeof t?o=t:(s=360,n=t.split("_"),a=Number(n[0].replace(v,""))*(-1===t.indexOf("rad")?1:L)-("="===t.charAt(1)?0:e),n.length&&(r&&(r[i]=e+a),-1!==t.indexOf("short")&&(a%=s,a!==a%(s/2)&&(a=0>a?a+s:a-s)),-1!==t.indexOf("_cw")&&0>a?a=(a+9999999999*s)%s-(0|a/s)*s:-1!==t.indexOf("ccw")&&a>0&&(a=(a-9999999999*s)%s-(0|a/s)*s)),o=e+a),l>o&&o>-l&&(o=0),o},ne={aqua:[0,255,255],lime:[0,255,0],silver:[192,192,192],black:[0,0,0],maroon:[128,0,0],teal:[0,128,128],blue:[0,0,255],navy:[0,0,128],white:[255,255,255],fuchsia:[255,0,255],olive:[128,128,0],yellow:[255,255,0],orange:[255,165,0],gray:[128,128,128],purple:[128,0,128],green:[0,128,0],red:[255,0,0],pink:[255,192,203],cyan:[0,255,255],transparent:[255,255,255,0]},ae=function(t,e,i){return t=0>t?t+1:t>1?t-1:t,0|255*(1>6*t?e+6*(i-e)*t:.5>t?i:2>3*t?e+6*(i-e)*(2/3-t):e)+.5},oe=function(t){var e,i,r,s,n,a;return t&&""!==t?"number"==typeof t?[t>>16,255&t>>8,255&t]:(","===t.charAt(t.length-1)&&(t=t.substr(0,t.length-1)),ne[t]?ne[t]:"#"===t.charAt(0)?(4===t.length&&(e=t.charAt(1),i=t.charAt(2),r=t.charAt(3),t="#"+e+e+i+i+r+r),t=parseInt(t.substr(1),16),[t>>16,255&t>>8,255&t]):"hsl"===t.substr(0,3)?(t=t.match(d),s=Number(t[0])%360/360,n=Number(t[1])/100,a=Number(t[2])/100,i=.5>=a?a*(n+1):a+n-a*n,e=2*a-i,t.length>3&&(t[3]=Number(t[3])),t[0]=ae(s+1/3,e,i),t[1]=ae(s,e,i),t[2]=ae(s-1/3,e,i),t):(t=t.match(d)||ne.transparent,t[0]=Number(t[0]),t[1]=Number(t[1]),t[2]=Number(t[2]),t.length>3&&(t[3]=Number(t[3])),t)):ne.black},le="(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#.+?\\b";for(l in ne)le+="|"+l+"\\b";le=RegExp(le+")","gi");var he=function(t,e,i,r){if(null==t)return function(t){return t};var s,n=e?(t.match(le)||[""])[0]:"",a=t.split(n).join("").match(g)||[],o=t.substr(0,t.indexOf(a[0])),l=")"===t.charAt(t.length-1)?")":"",h=-1!==t.indexOf(" ")?" ":",",u=a.length,_=u>0?a[0].replace(d,""):"";return u?s=e?function(t){var e,p,f,c;if("number"==typeof t)t+=_;else if(r&&D.test(t)){for(c=t.replace(D,"|").split("|"),f=0;c.length>f;f++)c[f]=s(c[f]);return c.join(",")}if(e=(t.match(le)||[n])[0],p=t.split(e).join("").match(g)||[],f=p.length,u>f--)for(;u>++f;)p[f]=i?p[0|(f-1)/2]:a[f];return o+p.join(h)+h+e+l+(-1!==t.indexOf("inset")?" inset":"")}:function(t){var e,n,p;if("number"==typeof t)t+=_;else if(r&&D.test(t)){for(n=t.replace(D,"|").split("|"),p=0;n.length>p;p++)n[p]=s(n[p]);return n.join(",")}if(e=t.match(g)||[],p=e.length,u>p--)for(;u>++p;)e[p]=i?e[0|(p-1)/2]:a[p];return o+e.join(h)+l}:function(t){return t}},ue=function(t){return t=t.split(","),function(e,i,r,s,n,a,o){var l,h=(i+"").split(" ");for(o={},l=0;4>l;l++)o[t[l]]=h[l]=h[l]||h[(l-1)/2>>0];return s.parse(e,o,n,a)}},_e=(F._setPluginRatio=function(t){this.plugin.setRatio(t);for(var e,i,r,s,n=this.data,a=n.proxy,o=n.firstMPT,l=1e-6;o;)e=a[o.v],o.r?e=e>0?0|e+.5:0|e-.5:l>e&&e>-l&&(e=0),o.t[o.p]=e,o=o._next;if(n.autoRotate&&(n.autoRotate.rotation=a.rotation),1===t)for(o=n.firstMPT;o;){if(i=o.t,i.type){if(1===i.type){for(s=i.xs0+i.s+i.xs1,r=1;i.l>r;r++)s+=i["xn"+r]+i["xs"+(r+1)];i.e=s}}else i.e=i.s+i.xs0;o=o._next}},function(t,e,i,r,s){this.t=t,this.p=e,this.v=i,this.r=s,r&&(r._prev=this,this._next=r)}),pe=(F._parseToProxy=function(t,e,i,r,s,n){var a,o,l,h,u,_=r,p={},f={},c=i._transform,d=N;for(i._transform=null,N=e,r=u=i.parse(t,e,r,s),N=d,n&&(i._transform=c,_&&(_._prev=null,_._prev&&(_._prev._next=null)));r&&r!==_;){if(1>=r.type&&(o=r.p,f[o]=r.s+r.c,p[o]=r.s,n||(h=new _e(r,"s",o,h,r.r),r.c=0),1===r.type))for(a=r.l;--a>0;)l="xn"+a,o=r.p+"_"+l,f[o]=r.data[l],p[o]=r[l],n||(h=new _e(r,l,o,h,r.rxp[l]));r=r._next}return{proxy:p,end:f,firstMPT:h,pt:u}},F.CSSPropTween=function(t,e,r,s,a,o,l,h,u,_,p){this.t=t,this.p=e,this.s=r,this.c=s,this.n=l||e,t instanceof pe||n.push(this.n),this.r=h,this.type=o||0,u&&(this.pr=u,i=!0),this.b=void 0===_?r:_,this.e=void 0===p?r+s:p,a&&(this._next=a,a._prev=this)}),fe=a.parseComplex=function(t,e,i,r,s,n,a,o,l,u){i=i||n||"",a=new pe(t,e,0,0,a,u?2:1,null,!1,o,i,r),r+="";var _,p,f,c,g,v,y,T,x,w,P,S,R=i.split(", ").join(",").split(" "),k=r.split(", ").join(",").split(" "),C=R.length,A=h!==!1;for((-1!==r.indexOf(",")||-1!==i.indexOf(","))&&(R=R.join(" ").replace(D,", ").split(" "),k=k.join(" ").replace(D,", ").split(" "),C=R.length),C!==k.length&&(R=(n||"").split(" "),C=R.length),a.plugin=l,a.setRatio=u,_=0;C>_;_++)if(c=R[_],g=k[_],T=parseFloat(c),T||0===T)a.appendXtra("",T,ie(g,T),g.replace(m,""),A&&-1!==g.indexOf("px"),!0);else if(s&&("#"===c.charAt(0)||ne[c]||b.test(c)))S=","===g.charAt(g.length-1)?"),":")",c=oe(c),g=oe(g),x=c.length+g.length>6,x&&!z&&0===g[3]?(a["xs"+a.l]+=a.l?" transparent":"transparent",a.e=a.e.split(k[_]).join("transparent")):(z||(x=!1),a.appendXtra(x?"rgba(":"rgb(",c[0],g[0]-c[0],",",!0,!0).appendXtra("",c[1],g[1]-c[1],",",!0).appendXtra("",c[2],g[2]-c[2],x?",":S,!0),x&&(c=4>c.length?1:c[3],a.appendXtra("",c,(4>g.length?1:g[3])-c,S,!1)));else if(v=c.match(d)){if(y=g.match(m),!y||y.length!==v.length)return a;for(f=0,p=0;v.length>p;p++)P=v[p],w=c.indexOf(P,f),a.appendXtra(c.substr(f,w-f),Number(P),ie(y[p],P),"",A&&"px"===c.substr(w+P.length,2),0===p),f=w+P.length;a["xs"+a.l]+=c.substr(f)}else a["xs"+a.l]+=a.l?" "+c:c;if(-1!==r.indexOf("=")&&a.data){for(S=a.xs0+a.data.s,_=1;a.l>_;_++)S+=a["xs"+_]+a.data["xn"+_];a.e=S+a["xs"+_]}return a.l||(a.type=-1,a.xs0=a.e),a.xfirst||a},ce=9;for(l=pe.prototype,l.l=l.pr=0;--ce>0;)l["xn"+ce]=0,l["xs"+ce]="";l.xs0="",l._next=l._prev=l.xfirst=l.data=l.plugin=l.setRatio=l.rxp=null,l.appendXtra=function(t,e,i,r,s,n){var a=this,o=a.l;return a["xs"+o]+=n&&o?" "+t:t||"",i||0===o||a.plugin?(a.l++,a.type=a.setRatio?2:1,a["xs"+a.l]=r||"",o>0?(a.data["xn"+o]=e+i,a.rxp["xn"+o]=s,a["xn"+o]=e,a.plugin||(a.xfirst=new pe(a,"xn"+o,e,i,a.xfirst||a,0,a.n,s,a.pr),a.xfirst.xs0=0),a):(a.data={s:e+i},a.rxp={},a.s=e,a.c=i,a.r=s,a)):(a["xs"+o]+=e+(r||""),a)};var de=function(t,e){e=e||{},this.p=e.prefix?V(t)||t:t,o[t]=o[this.p]=this,this.format=e.formatter||he(e.defaultValue,e.color,e.collapsible,e.multi),e.parser&&(this.parse=e.parser),this.clrs=e.color,this.multi=e.multi,this.keyword=e.keyword,this.dflt=e.defaultValue,this.pr=e.priority||0},me=F._registerComplexSpecialProp=function(t,e,i){"object"!=typeof e&&(e={parser:i});var r,s,n=t.split(","),a=e.defaultValue;for(i=i||[a],r=0;n.length>r;r++)e.prefix=0===r&&e.prefix,e.defaultValue=i[r]||a,s=new de(n[r],e)},ge=function(t){if(!o[t]){var e=t.charAt(0).toUpperCase()+t.substr(1)+"Plugin";me(t,{parser:function(t,i,r,s,n,a,l){var h=(window.GreenSockGlobals||window).com.greensock.plugins[e];return h?(h._cssRegister(),o[r].parse(t,i,r,s,n,a,l)):(B("Error: "+e+" js file not loaded."),n)}})}};l=de.prototype,l.parseComplex=function(t,e,i,r,s,n){var a,o,l,h,u,_,p=this.keyword;if(this.multi&&(D.test(i)||D.test(e)?(o=e.replace(D,"|").split("|"),l=i.replace(D,"|").split("|")):p&&(o=[e],l=[i])),l){for(h=l.length>o.length?l.length:o.length,a=0;h>a;a++)e=o[a]=o[a]||this.dflt,i=l[a]=l[a]||this.dflt,p&&(u=e.indexOf(p),_=i.indexOf(p),u!==_&&(i=-1===_?l:o,i[a]+=" "+p));e=o.join(", "),i=l.join(", ")}return fe(t,this.p,e,i,this.clrs,this.dflt,r,this.pr,s,n)},l.parse=function(t,e,i,r,n,a){return this.parseComplex(t.style,this.format(H(t,this.p,s,!1,this.dflt)),this.format(e),n,a)},a.registerSpecialProp=function(t,e,i){me(t,{parser:function(t,r,s,n,a,o){var l=new pe(t,s,0,0,a,2,s,!1,i);return l.plugin=o,l.setRatio=e(t,r,n._tween,s),l},priority:i})};var ve="scaleX,scaleY,scaleZ,x,y,z,skewX,rotation,rotationX,rotationY,perspective".split(","),ye=V("transform"),Te=j+"transform",xe=V("transformOrigin"),we=null!==V("perspective"),be=function(t,e,i,r){if(t._gsTransform&&i&&!r)return t._gsTransform;var s,n,o,l,h,u,_,p,f,c,d,m,g,v=i?t._gsTransform||{skewY:0}:{skewY:0},y=0>v.scaleX,T=2e-5,x=1e5,w=179.99,b=w*M,P=we?parseFloat(H(t,xe,e,!1,"0 0 0").split(" ")[2])||v.zOrigin||0:0;for(ye?s=H(t,Te,e,!0):t.currentStyle&&(s=t.currentStyle.filter.match(A),s=s&&4===s.length?[s[0].substr(4),Number(s[2].substr(4)),Number(s[1].substr(4)),s[3].substr(4),v.x||0,v.y||0].join(","):""),n=(s||"").match(/(?:\-|\b)[\d\-\.e]+\b/gi)||[],o=n.length;--o>-1;)l=Number(n[o]),n[o]=(h=l-(l|=0))?(0|h*x+(0>h?-.5:.5))/x+l:l;if(16===n.length){var S=n[8],R=n[9],k=n[10],C=n[12],O=n[13],D=n[14];if(v.zOrigin&&(D=-v.zOrigin,C=S*D-n[12],O=R*D-n[13],D=k*D+v.zOrigin-n[14]),!i||r||null==v.rotationX){var N,X,I,E,F,Y,z,U=n[0],B=n[1],j=n[2],W=n[3],V=n[4],q=n[5],Q=n[6],Z=n[7],$=n[11],G=Math.atan2(Q,k),K=-b>G||G>b;v.rotationX=G*L,G&&(E=Math.cos(-G),F=Math.sin(-G),N=V*E+S*F,X=q*E+R*F,I=Q*E+k*F,S=V*-F+S*E,R=q*-F+R*E,k=Q*-F+k*E,$=Z*-F+$*E,V=N,q=X,Q=I),G=Math.atan2(S,U),v.rotationY=G*L,G&&(Y=-b>G||G>b,E=Math.cos(-G),F=Math.sin(-G),N=U*E-S*F,X=B*E-R*F,I=j*E-k*F,R=B*F+R*E,k=j*F+k*E,$=W*F+$*E,U=N,B=X,j=I),G=Math.atan2(B,q),v.rotation=G*L,G&&(z=-b>G||G>b,E=Math.cos(-G),F=Math.sin(-G),U=U*E+V*F,X=B*E+q*F,q=B*-F+q*E,Q=j*-F+Q*E,B=X),z&&K?v.rotation=v.rotationX=0:z&&Y?v.rotation=v.rotationY=0:Y&&K&&(v.rotationY=v.rotationX=0),v.scaleX=(0|Math.sqrt(U*U+B*B)*x+.5)/x,v.scaleY=(0|Math.sqrt(q*q+R*R)*x+.5)/x,v.scaleZ=(0|Math.sqrt(Q*Q+k*k)*x+.5)/x,v.skewX=0,v.perspective=$?1/(0>$?-$:$):0,v.x=C,v.y=O,v.z=D}}else if(!(we&&!r&&n.length&&v.x===n[4]&&v.y===n[5]&&(v.rotationX||v.rotationY)||void 0!==v.x&&"none"===H(t,"display",e))){var J=n.length>=6,te=J?n[0]:1,ee=n[1]||0,ie=n[2]||0,re=J?n[3]:1;v.x=n[4]||0,v.y=n[5]||0,u=Math.sqrt(te*te+ee*ee),_=Math.sqrt(re*re+ie*ie),p=te||ee?Math.atan2(ee,te)*L:v.rotation||0,f=ie||re?Math.atan2(ie,re)*L+p:v.skewX||0,c=u-Math.abs(v.scaleX||0),d=_-Math.abs(v.scaleY||0),Math.abs(f)>90&&270>Math.abs(f)&&(y?(u*=-1,f+=0>=p?180:-180,p+=0>=p?180:-180):(_*=-1,f+=0>=f?180:-180)),m=(p-v.rotation)%180,g=(f-v.skewX)%180,(void 0===v.skewX||c>T||-T>c||d>T||-T>d||m>-w&&w>m&&false|m*x||g>-w&&w>g&&false|g*x)&&(v.scaleX=u,v.scaleY=_,v.rotation=p,v.skewX=f),we&&(v.rotationX=v.rotationY=v.z=0,v.perspective=parseFloat(a.defaultTransformPerspective)||0,v.scaleZ=1)}v.zOrigin=P;for(o in v)T>v[o]&&v[o]>-T&&(v[o]=0);return i&&(t._gsTransform=v),v},Pe=function(t){var e,i,r=this.data,s=-r.rotation*M,n=s+r.skewX*M,a=1e5,o=(0|Math.cos(s)*r.scaleX*a)/a,l=(0|Math.sin(s)*r.scaleX*a)/a,h=(0|Math.sin(n)*-r.scaleY*a)/a,u=(0|Math.cos(n)*r.scaleY*a)/a,_=this.t.style,p=this.t.currentStyle;if(p){i=l,l=-h,h=-i,e=p.filter,_.filter="";var f,d,m=this.t.offsetWidth,g=this.t.offsetHeight,v="absolute"!==p.position,x="progid:DXImageTransform.Microsoft.Matrix(M11="+o+", M12="+l+", M21="+h+", M22="+u,w=r.x,b=r.y;if(null!=r.ox&&(f=(r.oxp?.01*m*r.ox:r.ox)-m/2,d=(r.oyp?.01*g*r.oy:r.oy)-g/2,w+=f-(f*o+d*l),b+=d-(f*h+d*u)),v?(f=m/2,d=g/2,x+=", Dx="+(f-(f*o+d*l)+w)+", Dy="+(d-(f*h+d*u)+b)+")"):x+=", sizingMethod='auto expand')",_.filter=-1!==e.indexOf("DXImageTransform.Microsoft.Matrix(")?e.replace(O,x):x+" "+e,(0===t||1===t)&&1===o&&0===l&&0===h&&1===u&&(v&&-1===x.indexOf("Dx=0, Dy=0")||T.test(e)&&100!==parseFloat(RegExp.$1)||-1===e.indexOf("gradient("&&e.indexOf("Alpha"))&&_.removeAttribute("filter")),!v){var P,S,R,k=8>c?1:-1;for(f=r.ieOffsetX||0,d=r.ieOffsetY||0,r.ieOffsetX=Math.round((m-((0>o?-o:o)*m+(0>l?-l:l)*g))/2+w),r.ieOffsetY=Math.round((g-((0>u?-u:u)*g+(0>h?-h:h)*m))/2+b),ce=0;4>ce;ce++)S=J[ce],P=p[S],i=-1!==P.indexOf("px")?parseFloat(P):Q(this.t,S,parseFloat(P),P.replace(y,""))||0,R=i!==r[S]?2>ce?-r.ieOffsetX:-r.ieOffsetY:2>ce?f-r.ieOffsetX:d-r.ieOffsetY,_[S]=(r[S]=Math.round(i-R*(0===ce||2===ce?1:k)))+"px"}}},Se=function(){var t,e,i,r,s,n,a,o,l,h,u,_,f,c,d,m,g,v,y,T,x,w,b,P=this.data,S=this.t.style,R=P.rotation*M,k=P.scaleX,C=P.scaleY,A=P.scaleZ,O=P.perspective;if(p){var D=1e-4;D>k&&k>-D&&(k=A=2e-5),D>C&&C>-D&&(C=A=2e-5),!O||P.z||P.rotationX||P.rotationY||(O=0)}if(R||P.skewX)v=Math.cos(R),y=Math.sin(R),t=v,s=y,P.skewX&&(R-=P.skewX*M,v=Math.cos(R),y=Math.sin(R)),e=-y,n=v;else{if(!(P.rotationY||P.rotationX||1!==A||O))return S[ye]="translate3d("+P.x+"px,"+P.y+"px,"+P.z+"px)"+(1!==k||1!==C?" scale("+k+","+C+")":""),void 0;t=n=1,e=s=0}u=1,i=r=a=o=l=h=_=f=c=0,d=O?-1/O:0,m=P.zOrigin,g=1e5,R=P.rotationY*M,R&&(v=Math.cos(R),y=Math.sin(R),l=u*-y,f=d*-y,i=t*y,a=s*y,u*=v,d*=v,t*=v,s*=v),R=P.rotationX*M,R&&(v=Math.cos(R),y=Math.sin(R),T=e*v+i*y,x=n*v+a*y,w=h*v+u*y,b=c*v+d*y,i=e*-y+i*v,a=n*-y+a*v,u=h*-y+u*v,d=c*-y+d*v,e=T,n=x,h=w,c=b),1!==A&&(i*=A,a*=A,u*=A,d*=A),1!==C&&(e*=C,n*=C,h*=C,c*=C),1!==k&&(t*=k,s*=k,l*=k,f*=k),m&&(_-=m,r=i*_,o=a*_,_=u*_+m),r=(T=(r+=P.x)-(r|=0))?(0|T*g+(0>T?-.5:.5))/g+r:r,o=(T=(o+=P.y)-(o|=0))?(0|T*g+(0>T?-.5:.5))/g+o:o,_=(T=(_+=P.z)-(_|=0))?(0|T*g+(0>T?-.5:.5))/g+_:_,S[ye]="matrix3d("+[(0|t*g)/g,(0|s*g)/g,(0|l*g)/g,(0|f*g)/g,(0|e*g)/g,(0|n*g)/g,(0|h*g)/g,(0|c*g)/g,(0|i*g)/g,(0|a*g)/g,(0|u*g)/g,(0|d*g)/g,r,o,_,O?1+-_/O:1].join(",")+")"},Re=function(t){var e,i,r,s,n,a=this.data,o=this.t,l=o.style;return a.rotationX||a.rotationY||a.z||a.force3D?(this.setRatio=Se,Se.call(this,t),void 0):(a.rotation||a.skewX?(e=a.rotation*M,i=e-a.skewX*M,r=1e5,s=a.scaleX*r,n=a.scaleY*r,l[ye]="matrix("+(0|Math.cos(e)*s)/r+","+(0|Math.sin(e)*s)/r+","+(0|Math.sin(i)*-n)/r+","+(0|Math.cos(i)*n)/r+","+a.x+","+a.y+")"):l[ye]="matrix("+a.scaleX+",0,0,"+a.scaleY+","+a.x+","+a.y+")",void 0)};me("transform,scale,scaleX,scaleY,scaleZ,x,y,z,rotation,rotationX,rotationY,rotationZ,skewX,skewY,shortRotation,shortRotationX,shortRotationY,shortRotationZ,transformOrigin,transformPerspective,directionalRotation,parseTransform,force3D",{parser:function(t,e,i,r,n,a,o){if(r._transform)return n;var l,h,u,_,p,f,c,d=r._transform=be(t,s,!0,o.parseTransform),m=t.style,g=1e-6,v=ve.length,y=o,T={};if("string"==typeof y.transform&&ye)u=m.cssText,m[ye]=y.transform,m.display="block",l=be(t,null,!1),m.cssText=u;else if("object"==typeof y){if(l={scaleX:re(null!=y.scaleX?y.scaleX:y.scale,d.scaleX),scaleY:re(null!=y.scaleY?y.scaleY:y.scale,d.scaleY),scaleZ:re(y.scaleZ,d.scaleZ),x:re(y.x,d.x),y:re(y.y,d.y),z:re(y.z,d.z),perspective:re(y.transformPerspective,d.perspective)},c=y.directionalRotation,null!=c)if("object"==typeof c)for(u in c)y[u]=c[u];else y.rotation=c;l.rotation=se("rotation"in y?y.rotation:"shortRotation"in y?y.shortRotation+"_short":"rotationZ"in y?y.rotationZ:d.rotation,d.rotation,"rotation",T),we&&(l.rotationX=se("rotationX"in y?y.rotationX:"shortRotationX"in y?y.shortRotationX+"_short":d.rotationX||0,d.rotationX,"rotationX",T),l.rotationY=se("rotationY"in y?y.rotationY:"shortRotationY"in y?y.shortRotationY+"_short":d.rotationY||0,d.rotationY,"rotationY",T)),l.skewX=null==y.skewX?d.skewX:se(y.skewX,d.skewX),l.skewY=null==y.skewY?d.skewY:se(y.skewY,d.skewY),(h=l.skewY-d.skewY)&&(l.skewX+=h,l.rotation+=h)}for(we&&null!=y.force3D&&(d.force3D=y.force3D,f=!0),p=d.force3D||d.z||d.rotationX||d.rotationY||l.z||l.rotationX||l.rotationY||l.perspective,p||null==y.scale||(l.scaleZ=1);--v>-1;)i=ve[v],_=l[i]-d[i],(_>g||-g>_||null!=N[i])&&(f=!0,n=new pe(d,i,d[i],_,n),i in T&&(n.e=T[i]),n.xs0=0,n.plugin=a,r._overwriteProps.push(n.n));return _=y.transformOrigin,(_||we&&p&&d.zOrigin)&&(ye?(f=!0,i=xe,_=(_||H(t,i,s,!1,"50% 50%"))+"",n=new pe(m,i,0,0,n,-1,"transformOrigin"),n.b=m[i],n.plugin=a,we?(u=d.zOrigin,_=_.split(" "),d.zOrigin=(_.length>2&&(0===u||"0px"!==_[2])?parseFloat(_[2]):u)||0,n.xs0=n.e=m[i]=_[0]+" "+(_[1]||"50%")+" 0px",n=new pe(d,"zOrigin",0,0,n,-1,n.n),n.b=u,n.xs0=n.e=d.zOrigin):n.xs0=n.e=m[i]=_):ee(_+"",d)),f&&(r._transformType=p||3===this._transformType?3:2),n},prefix:!0}),me("boxShadow",{defaultValue:"0px 0px 0px 0px #999",prefix:!0,color:!0,multi:!0,keyword:"inset"}),me("borderRadius",{defaultValue:"0px",parser:function(t,e,i,n,a){e=this.format(e);var o,l,h,u,_,p,f,c,d,m,g,v,y,T,x,w,b=["borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"],P=t.style;for(d=parseFloat(t.offsetWidth),m=parseFloat(t.offsetHeight),o=e.split(" "),l=0;b.length>l;l++)this.p.indexOf("border")&&(b[l]=V(b[l])),_=u=H(t,b[l],s,!1,"0px"),-1!==_.indexOf(" ")&&(u=_.split(" "),_=u[0],u=u[1]),p=h=o[l],f=parseFloat(_),v=_.substr((f+"").length),y="="===p.charAt(1),y?(c=parseInt(p.charAt(0)+"1",10),p=p.substr(2),c*=parseFloat(p),g=p.substr((c+"").length-(0>c?1:0))||""):(c=parseFloat(p),g=p.substr((c+"").length)),""===g&&(g=r[i]||v),g!==v&&(T=Q(t,"borderLeft",f,v),x=Q(t,"borderTop",f,v),"%"===g?(_=100*(T/d)+"%",u=100*(x/m)+"%"):"em"===g?(w=Q(t,"borderLeft",1,"em"),_=T/w+"em",u=x/w+"em"):(_=T+"px",u=x+"px"),y&&(p=parseFloat(_)+c+g,h=parseFloat(u)+c+g)),a=fe(P,b[l],_+" "+u,p+" "+h,!1,"0px",a);return a},prefix:!0,formatter:he("0px 0px 0px 0px",!1,!0)}),me("backgroundPosition",{defaultValue:"0 0",parser:function(t,e,i,r,n,a){var o,l,h,u,_,p,f="background-position",d=s||q(t,null),m=this.format((d?c?d.getPropertyValue(f+"-x")+" "+d.getPropertyValue(f+"-y"):d.getPropertyValue(f):t.currentStyle.backgroundPositionX+" "+t.currentStyle.backgroundPositionY)||"0 0"),g=this.format(e);if(-1!==m.indexOf("%")!=(-1!==g.indexOf("%"))&&(p=H(t,"backgroundImage").replace(R,""),p&&"none"!==p)){for(o=m.split(" "),l=g.split(" "),E.setAttribute("src",p),h=2;--h>-1;)m=o[h],u=-1!==m.indexOf("%"),u!==(-1!==l[h].indexOf("%"))&&(_=0===h?t.offsetWidth-E.width:t.offsetHeight-E.height,o[h]=u?parseFloat(m)/100*_+"px":100*(parseFloat(m)/_)+"%");m=o.join(" ")}return this.parseComplex(t.style,m,g,n,a)},formatter:ee}),me("backgroundSize",{defaultValue:"0 0",formatter:ee}),me("perspective",{defaultValue:"0px",prefix:!0}),me("perspectiveOrigin",{defaultValue:"50% 50%",prefix:!0}),me("transformStyle",{prefix:!0}),me("backfaceVisibility",{prefix:!0}),me("userSelect",{prefix:!0}),me("margin",{parser:ue("marginTop,marginRight,marginBottom,marginLeft")}),me("padding",{parser:ue("paddingTop,paddingRight,paddingBottom,paddingLeft")}),me("clip",{defaultValue:"rect(0px,0px,0px,0px)",parser:function(t,e,i,r,n,a){var o,l,h;return 9>c?(l=t.currentStyle,h=8>c?" ":",",o="rect("+l.clipTop+h+l.clipRight+h+l.clipBottom+h+l.clipLeft+")",e=this.format(e).split(",").join(h)):(o=this.format(H(t,this.p,s,!1,this.dflt)),e=this.format(e)),this.parseComplex(t.style,o,e,n,a)}}),me("textShadow",{defaultValue:"0px 0px 0px #999",color:!0,multi:!0}),me("autoRound,strictUnits",{parser:function(t,e,i,r,s){return s}}),me("border",{defaultValue:"0px solid #000",parser:function(t,e,i,r,n,a){return this.parseComplex(t.style,this.format(H(t,"borderTopWidth",s,!1,"0px")+" "+H(t,"borderTopStyle",s,!1,"solid")+" "+H(t,"borderTopColor",s,!1,"#000")),this.format(e),n,a)},color:!0,formatter:function(t){var e=t.split(" ");return e[0]+" "+(e[1]||"solid")+" "+(t.match(le)||["#000"])[0]}}),me("borderWidth",{parser:ue("borderTopWidth,borderRightWidth,borderBottomWidth,borderLeftWidth")}),me("float,cssFloat,styleFloat",{parser:function(t,e,i,r,s){var n=t.style,a="cssFloat"in n?"cssFloat":"styleFloat";return new pe(n,a,0,0,s,-1,i,!1,0,n[a],e)}});var ke=function(t){var e,i=this.t,r=i.filter||H(this.data,"filter"),s=0|this.s+this.c*t;100===s&&(-1===r.indexOf("atrix(")&&-1===r.indexOf("radient(")&&-1===r.indexOf("oader(")?(i.removeAttribute("filter"),e=!H(this.data,"filter")):(i.filter=r.replace(w,""),e=!0)),e||(this.xn1&&(i.filter=r=r||"alpha(opacity="+s+")"),-1===r.indexOf("opacity")?0===s&&this.xn1||(i.filter=r+" alpha(opacity="+s+")"):i.filter=r.replace(T,"opacity="+s))};me("opacity,alpha,autoAlpha",{defaultValue:"1",parser:function(t,e,i,r,n,a){var o=parseFloat(H(t,"opacity",s,!1,"1")),l=t.style,h="autoAlpha"===i;return"string"==typeof e&&"="===e.charAt(1)&&(e=("-"===e.charAt(0)?-1:1)*parseFloat(e.substr(2))+o),h&&1===o&&"hidden"===H(t,"visibility",s)&&0!==e&&(o=0),z?n=new pe(l,"opacity",o,e-o,n):(n=new pe(l,"opacity",100*o,100*(e-o),n),n.xn1=h?1:0,l.zoom=1,n.type=2,n.b="alpha(opacity="+n.s+")",n.e="alpha(opacity="+(n.s+n.c)+")",n.data=t,n.plugin=a,n.setRatio=ke),h&&(n=new pe(l,"visibility",0,0,n,-1,null,!1,0,0!==o?"inherit":"hidden",0===e?"hidden":"inherit"),n.xs0="inherit",r._overwriteProps.push(n.n),r._overwriteProps.push(i)),n}});var Ce=function(t,e){e&&(t.removeProperty?t.removeProperty(e.replace(P,"-$1").toLowerCase()):t.removeAttribute(e))},Ae=function(t){if(this.t._gsClassPT=this,1===t||0===t){this.t.className=0===t?this.b:this.e;for(var e=this.data,i=this.t.style;e;)e.v?i[e.p]=e.v:Ce(i,e.p),e=e._next;1===t&&this.t._gsClassPT===this&&(this.t._gsClassPT=null)}else this.t.className!==this.e&&(this.t.className=this.e)};me("className",{parser:function(t,e,r,n,a,o,l){var h,u,_,p,f,c=t.className,d=t.style.cssText;if(a=n._classNamePT=new pe(t,r,0,0,a,2),a.setRatio=Ae,a.pr=-11,i=!0,a.b=c,u=$(t,s),_=t._gsClassPT){for(p={},f=_.data;f;)p[f.p]=1,f=f._next;_.setRatio(1)}return t._gsClassPT=a,a.e="="!==e.charAt(1)?e:c.replace(RegExp("\\s*\\b"+e.substr(2)+"\\b"),"")+("+"===e.charAt(0)?" "+e.substr(2):""),n._tween._duration&&(t.className=a.e,h=G(t,u,$(t),l,p),t.className=c,a.data=h.firstMPT,t.style.cssText=d,a=a.xfirst=n.parse(t,h.difs,a,o)),a}});var Oe=function(t){if((1===t||0===t)&&this.data._totalTime===this.data._totalDuration&&"isFromStart"!==this.data.data){var e,i,r,s,n=this.t.style,a=o.transform.parse;if("all"===this.e)n.cssText="",s=!0;else for(e=this.e.split(","),r=e.length;--r>-1;)i=e[r],o[i]&&(o[i].parse===a?s=!0:i="transformOrigin"===i?xe:o[i].p),Ce(n,i);s&&(Ce(n,ye),this.t._gsTransform&&delete this.t._gsTransform)}};for(me("clearProps",{parser:function(t,e,r,s,n){return n=new pe(t,r,0,0,n,2),n.setRatio=Oe,n.e=e,n.pr=-10,n.data=s._tween,i=!0,n}}),l="bezier,throwProps,physicsProps,physics2D".split(","),ce=l.length;ce--;)ge(l[ce]);l=a.prototype,l._firstPT=null,l._onInitTween=function(t,e,o){if(!t.nodeType)return!1;this._target=t,this._tween=o,this._vars=e,h=e.autoRound,i=!1,r=e.suffixMap||a.suffixMap,s=q(t,""),n=this._overwriteProps;var l,p,c,d,m,g,v,y,T,w=t.style;if(u&&""===w.zIndex&&(l=H(t,"zIndex",s),("auto"===l||""===l)&&(w.zIndex=0)),"string"==typeof e&&(d=w.cssText,l=$(t,s),w.cssText=d+";"+e,l=G(t,l,$(t)).difs,!z&&x.test(e)&&(l.opacity=parseFloat(RegExp.$1)),e=l,w.cssText=d),this._firstPT=p=this.parse(t,e,null),this._transformType){for(T=3===this._transformType,ye?_&&(u=!0,""===w.zIndex&&(v=H(t,"zIndex",s),("auto"===v||""===v)&&(w.zIndex=0)),f&&(w.WebkitBackfaceVisibility=this._vars.WebkitBackfaceVisibility||(T?"visible":"hidden"))):w.zoom=1,c=p;c&&c._next;)c=c._next;y=new pe(t,"transform",0,0,null,2),this._linkCSSP(y,null,c),y.setRatio=T&&we?Se:ye?Re:Pe,y.data=this._transform||be(t,s,!0),n.pop()}if(i){for(;p;){for(g=p._next,c=d;c&&c.pr>p.pr;)c=c._next;(p._prev=c?c._prev:m)?p._prev._next=p:d=p,(p._next=c)?c._prev=p:m=p,p=g}this._firstPT=d}return!0},l.parse=function(t,e,i,n){var a,l,u,_,p,f,c,d,m,g,v=t.style;for(a in e)f=e[a],l=o[a],l?i=l.parse(t,f,a,this,i,n,e):(p=H(t,a,s)+"",m="string"==typeof f,"color"===a||"fill"===a||"stroke"===a||-1!==a.indexOf("Color")||m&&b.test(f)?(m||(f=oe(f),f=(f.length>3?"rgba(":"rgb(")+f.join(",")+")"),i=fe(v,a,p,f,!0,"transparent",i,0,n)):!m||-1===f.indexOf(" ")&&-1===f.indexOf(",")?(u=parseFloat(p),c=u||0===u?p.substr((u+"").length):"",(""===p||"auto"===p)&&("width"===a||"height"===a?(u=te(t,a,s),c="px"):"left"===a||"top"===a?(u=Z(t,a,s),c="px"):(u="opacity"!==a?0:1,c="")),g=m&&"="===f.charAt(1),g?(_=parseInt(f.charAt(0)+"1",10),f=f.substr(2),_*=parseFloat(f),d=f.replace(y,"")):(_=parseFloat(f),d=m?f.substr((_+"").length)||"":""),""===d&&(d=a in r?r[a]:c),f=_||0===_?(g?_+u:_)+d:e[a],c!==d&&""!==d&&(_||0===_)&&(u||0===u)&&(u=Q(t,a,u,c),"%"===d?(u/=Q(t,a,100,"%")/100,e.strictUnits!==!0&&(p=u+"%")):"em"===d?u/=Q(t,a,1,"em"):(_=Q(t,a,_,d),d="px"),g&&(_||0===_)&&(f=_+u+d)),g&&(_+=u),!u&&0!==u||!_&&0!==_?void 0!==v[a]&&(f||"NaN"!=f+""&&null!=f)?(i=new pe(v,a,_||u||0,0,i,-1,a,!1,0,p,f),i.xs0="none"!==f||"display"!==a&&-1===a.indexOf("Style")?f:p):B("invalid "+a+" tween value: "+e[a]):(i=new pe(v,a,u,_-u,i,0,a,h!==!1&&("px"===d||"zIndex"===a),0,p,f),i.xs0=d)):i=fe(v,a,p,f,!0,null,i,0,n)),n&&i&&!i.plugin&&(i.plugin=n);return i},l.setRatio=function(t){var e,i,r,s=this._firstPT,n=1e-6;if(1!==t||this._tween._time!==this._tween._duration&&0!==this._tween._time)if(t||this._tween._time!==this._tween._duration&&0!==this._tween._time||this._tween._rawPrevTime===-1e-6)for(;s;){if(e=s.c*t+s.s,s.r?e=e>0?0|e+.5:0|e-.5:n>e&&e>-n&&(e=0),s.type)if(1===s.type)if(r=s.l,2===r)s.t[s.p]=s.xs0+e+s.xs1+s.xn1+s.xs2;else if(3===r)s.t[s.p]=s.xs0+e+s.xs1+s.xn1+s.xs2+s.xn2+s.xs3;else if(4===r)s.t[s.p]=s.xs0+e+s.xs1+s.xn1+s.xs2+s.xn2+s.xs3+s.xn3+s.xs4;else if(5===r)s.t[s.p]=s.xs0+e+s.xs1+s.xn1+s.xs2+s.xn2+s.xs3+s.xn3+s.xs4+s.xn4+s.xs5;else{for(i=s.xs0+e+s.xs1,r=1;s.l>r;r++)i+=s["xn"+r]+s["xs"+(r+1)];s.t[s.p]=i}else-1===s.type?s.t[s.p]=s.xs0:s.setRatio&&s.setRatio(t);else s.t[s.p]=e+s.xs0;s=s._next}else for(;s;)2!==s.type?s.t[s.p]=s.b:s.setRatio(t),s=s._next;else for(;s;)2!==s.type?s.t[s.p]=s.e:s.setRatio(t),s=s._next},l._enableTransforms=function(t){this._transformType=t||3===this._transformType?3:2,this._transform=this._transform||be(this._target,s,!0)},l._linkCSSP=function(t,e,i,r){return t&&(e&&(e._prev=t),t._next&&(t._next._prev=t._prev),t._prev?t._prev._next=t._next:this._firstPT===t&&(this._firstPT=t._next,r=!0),i?i._next=t:r||null!==this._firstPT||(this._firstPT=t),t._next=e,t._prev=i),t},l._kill=function(e){var i,r,s,n=e;if(e.autoAlpha||e.alpha){n={};for(r in e)n[r]=e[r];n.opacity=1,n.autoAlpha&&(n.visibility=1)}return e.className&&(i=this._classNamePT)&&(s=i.xfirst,s&&s._prev?this._linkCSSP(s._prev,i._next,s._prev._prev):s===this._firstPT&&(this._firstPT=i._next),i._next&&this._linkCSSP(i._next,i._next._next,s._prev),this._classNamePT=null),t.prototype._kill.call(this,n)};var De=function(t,e,i){var r,s,n,a;if(t.slice)for(s=t.length;--s>-1;)De(t[s],e,i);else for(r=t.childNodes,s=r.length;--s>-1;)n=r[s],a=n.type,n.style&&(e.push($(n)),i&&i.push(n)),1!==a&&9!==a&&11!==a||!n.childNodes.length||De(n,e,i)};return a.cascadeTo=function(t,i,r){var s,n,a,o=e.to(t,i,r),l=[o],h=[],u=[],_=[],p=e._internals.reservedProps;for(t=o._targets||o.target,De(t,h,_),o.render(i,!0),De(t,u),o.render(0,!0),o._enabled(!0),s=_.length;--s>-1;)if(n=G(_[s],h[s],u[s]),n.firstMPT){n=n.difs;for(a in r)p[a]&&(n[a]=r[a]);l.push(e.to(_[s],i,n))}return l},t.activate([a]),a},!0)}),window._gsDefine&&window._gsQueue.pop()();

// WAIT FOR IMAGES
/*
 * waitForImages 1.4
 * -----------------
 * Provides a callback when all images have loaded in your given selector.
 * http://www.alexanderdickson.com/
 *
 *
 * Copyright (c) 2011 Alex Dickson
 * Licensed under the MIT licenses.
 * See website for more info.
 *
 */

(function(e,t){
		e.waitForImages={hasImageProperties:["backgroundImage","listStyleImage","borderImage","borderCornerImage"]};e.expr[":"].uncached=function(t){var n=document.createElement("img");n.src=t.src;return e(t).is('img[src!=""]')&&!n.complete};e.fn.waitForImages=function(t,n,r){if(e.isPlainObject(arguments[0])){n=t.each;r=t.waitForAll;t=t.finished}t=t||e.noop;n=n||e.noop;r=!!r;if(!e.isFunction(t)||!e.isFunction(n)){throw new TypeError("An invalid callback was supplied.")}return this.each(function(){var i=e(this),s=[];if(r){var o=e.waitForImages.hasImageProperties||[],u=/url\((['"]?)(.*?)\1\)/g;i.find("*").each(function(){var t=e(this);if(t.is("img:uncached")){s.push({src:t.attr("src"),element:t[0]})}e.each(o,function(e,n){var r=t.css(n);if(!r){return true}var i;while(i=u.exec(r)){s.push({src:i[2],element:t[0]})}})})}else{i.find("img:uncached").each(function(){s.push({src:this.src,element:this})})}var f=s.length,l=0;if(f==0){t.call(i[0])}e.each(s,function(r,s){var o=new Image;e(o).bind("load error",function(e){l++;n.call(s.element,l,f,e.type=="load");if(l==f){t.call(i[0]);return false}});o.src=s.src})})};		
})(jQuery)


/**************************************************************************
 * jquery.themepunch.revolution.js - jQuery Plugin for Revolution Slider
 * @version: 4.3.5 (09.04.2013)
 * @requires jQuery v1.7 or later (tested on 1.9)
 * @author ThemePunch
**************************************************************************/

function revslider_showDoubleJqueryError(e){var t="Revolution Slider Error: You have some jquery.js library include that comes after the revolution files js include.";t+="<br> This includes make eliminates the revolution slider libraries, and make it not work.";t+="<br><br> To fix it you can:<br>&nbsp;&nbsp;&nbsp; 1. In the Slider Settings -> Troubleshooting set option:  <strong><b>Put JS Includes To Body</b></strong> option to true.";t+="<br>&nbsp;&nbsp;&nbsp; 2. Find the double jquery.js include and remove it.";t="<span style='font-size:16px;color:#BC0C06;'>"+t+"</span>";jQuery(e).show().html(t)}(function(e,t){function n(e){var t=[],n;var r=window.location.href.slice(window.location.href.indexOf(e)+1).split("_");for(var i=0;i<r.length;i++){r[i]=r[i].replace("%3D","=");n=r[i].split("=");t.push(n[0]);t[n[0]]=n[1]}return t}function r(n,i){try{if(i.hideThumbsUnderResoluition!=0&&i.navigationType=="thumb"){if(i.hideThumbsUnderResoluition>e(window).width())e(".tp-bullets").css({display:"none"});else e(".tp-bullets").css({display:"block"})}}catch(s){}n.find(".defaultimg").each(function(t){g(e(this),i)});var o=n.parent();if(e(window).width()<i.hideSliderAtLimit){n.trigger("stoptimer");if(o.css("display")!="none")o.data("olddisplay",o.css("display"));o.css({display:"none"})}else{if(n.is(":hidden")){if(o.data("olddisplay")!=t&&o.data("olddisplay")!="undefined"&&o.data("olddisplay")!="none")o.css({display:o.data("olddisplay")});else o.css({display:"block"});n.trigger("restarttimer");setTimeout(function(){r(n,i)},150)}}var u=0;if(i.forceFullWidth=="on")u=0-i.container.parent().offset().left;try{n.parent().find(".tp-bannershadow").css({width:i.width,left:u})}catch(s){}var a=n.find(">ul >li:eq("+i.act+") .slotholder");var f=n.find(">ul >li:eq("+i.next+") .slotholder");S(n,i);f.find(".defaultimg").css({opacity:0});a.find(".defaultimg").css({opacity:1});f.find(".defaultimg").each(function(){var n=e(this);if(n.data("kenburn")!=t)n.data("kenburn").restart()});var l=n.find(">ul >li:eq("+i.next+")");V(l,i,true);m(n,i)}function s(){var e=["android","webos","iphone","ipad","blackberry","Android","webos",,"iPod","iPhone","iPad","Blackberry","BlackBerry"];var t=false;for(i in e){if(navigator.userAgent.split(e[i]).length>1){t=true}}return t}function o(t,n){var r=e('<div style="display:none;"/>').appendTo(e("body"));r.html("<!--[if "+(n||"")+" IE "+(t||"")+"]><a>&nbsp;</a><![endif]-->");var i=r.find("a").length;r.remove();return i}function u(e,t){C(t,e)}function a(n,r){var i=n.parent();if(r.navigationType=="thumb"||r.navsecond=="both"){i.append('<div class="tp-bullets tp-thumbs '+r.navigationStyle+'"><div class="tp-mask"><div class="tp-thumbcontainer"></div></div></div>')}var s=i.find(".tp-bullets.tp-thumbs .tp-mask .tp-thumbcontainer");var o=s.parent();o.width(r.thumbWidth*r.thumbAmount);o.height(r.thumbHeight);o.parent().width(r.thumbWidth*r.thumbAmount);o.parent().height(r.thumbHeight);n.find(">ul:first >li").each(function(e){var i=n.find(">ul:first >li:eq("+e+")");var o=i.find(".defaultimg").css("backgroundColor");if(i.data("thumb")!=t)var u=i.data("thumb");else var u=i.find("img:first").attr("src");s.append('<div class="bullet thumb" style="background-color:'+o+";position:relative;width:"+r.thumbWidth+"px;height:"+r.thumbHeight+"px;background-image:url("+u+') !important;background-size:cover;background-position:center center;"></div>');var a=s.find(".bullet:first")});var a=10;s.find(".bullet").each(function(t){var i=e(this);if(t==r.slideamount-1)i.addClass("last");if(t==0)i.addClass("first");i.width(r.thumbWidth);i.height(r.thumbHeight);if(a<i.outerWidth(true))a=i.outerWidth(true);i.click(function(){if(r.transition==0&&i.index()!=r.act){r.next=i.index();u(r,n)}})});var c=a*n.find(">ul:first >li").length;var h=s.parent().width();r.thumbWidth=a;if(h<c){e(document).mousemove(function(t){e("body").data("mousex",t.pageX)});s.parent().mouseenter(function(){var t=e(this);t.addClass("over");var r=t.offset();var i=e("body").data("mousex")-r.left;var s=t.width();var o=t.find(".bullet:first").outerWidth(true);var u=o*n.find(">ul:first >li").length;var a=u-s+15;var f=a/s;i=i-30;var c=0-i*f;if(c>0)c=0;if(c<0-u+s)c=0-u+s;l(t,c,200)});s.parent().mousemove(function(){var t=e(this);var r=t.offset();var i=e("body").data("mousex")-r.left;var s=t.width();var o=t.find(".bullet:first").outerWidth(true);var u=o*n.find(">ul:first >li").length-1;var a=u-s+15;var f=a/s;i=i-3;if(i<6)i=0;if(i+3>s-6)i=s;var c=0-i*f;if(c>0)c=0;if(c<0-u+s)c=0-u+s;l(t,c,0)});s.parent().mouseleave(function(){var t=e(this);t.removeClass("over");f(n)})}}function f(e){var t=e.parent().find(".tp-bullets.tp-thumbs .tp-mask .tp-thumbcontainer");var n=t.parent();var r=n.offset();var i=n.find(".bullet:first").outerWidth(true);var s=n.find(".bullet.selected").index()*i;var o=n.width();var i=n.find(".bullet:first").outerWidth(true);var u=i*e.find(">ul:first >li").length;var a=u-o;var f=a/o;var c=0-s;if(c>0)c=0;if(c<0-u+o)c=0-u+o;if(!n.hasClass("over")){l(n,c,200)}}function l(e,t,n){TweenLite.to(e.find(".tp-thumbcontainer"),.2,{left:t,ease:Power3.easeOut,overwrite:"auto"})}function c(t,n){if(n.navigationType=="bullet"||n.navigationType=="both"){t.parent().append('<div class="tp-bullets simplebullets '+n.navigationStyle+'"></div>')}var r=t.parent().find(".tp-bullets");t.find(">ul:first >li").each(function(e){var n=t.find(">ul:first >li:eq("+e+") img:first").attr("src");r.append('<div class="bullet"></div>');var i=r.find(".bullet:first")});r.find(".bullet").each(function(r){var i=e(this);if(r==n.slideamount-1)i.addClass("last");if(r==0)i.addClass("first");i.click(function(){var e=false;if(n.navigationArrows=="withbullet"||n.navigationArrows=="nexttobullets"){if(i.index()-1==n.act)e=true}else{if(i.index()==n.act)e=true}if(n.transition==0&&!e){if(n.navigationArrows=="withbullet"||n.navigationArrows=="nexttobullets"){n.next=i.index()-1}else{n.next=i.index()}u(n,t)}})});r.append('<div class="tpclear"></div>');m(t,n)}function h(e,n){var r=e.find(".tp-bullets");var i="";var s=n.navigationStyle;if(n.navigationArrows=="none")i="visibility:hidden;display:none";n.soloArrowStyle="default";if(n.navigationArrows!="none"&&n.navigationArrows!="nexttobullets")s=n.soloArrowStyle;e.parent().append('<div style="'+i+'" class="tp-leftarrow tparrows '+s+'"></div>');e.parent().append('<div style="'+i+'" class="tp-rightarrow tparrows '+s+'"></div>');e.parent().find(".tp-rightarrow").click(function(){if(n.transition==0){if(e.data("showus")!=t&&e.data("showus")!=-1)n.next=e.data("showus")-1;else n.next=n.next+1;e.data("showus",-1);if(n.next>=n.slideamount)n.next=0;if(n.next<0)n.next=0;if(n.act!=n.next)u(n,e)}});e.parent().find(".tp-leftarrow").click(function(){if(n.transition==0){n.next=n.next-1;n.leftarrowpressed=1;if(n.next<0)n.next=n.slideamount-1;u(n,e)}});m(e,n)}function p(n,r){e(document).keydown(function(e){if(r.transition==0&&e.keyCode==39){if(n.data("showus")!=t&&n.data("showus")!=-1)r.next=n.data("showus")-1;else r.next=r.next+1;n.data("showus",-1);if(r.next>=r.slideamount)r.next=0;if(r.next<0)r.next=0;if(r.act!=r.next)u(r,n)}if(r.transition==0&&e.keyCode==37){r.next=r.next-1;r.leftarrowpressed=1;if(r.next<0)r.next=r.slideamount-1;u(r,n)}});m(n,r)}function d(t,n){if(n.touchenabled=="on"){var r=Hammer(t,{drag_block_vertical:n.drag_block_vertical,drag_lock_to_axis:true,swipe_velocity:n.swipe_velocity,swipe_max_touches:n.swipe_max_touches,swipe_min_touches:n.swipe_min_touches,prevent_default:false});r.on("swipeleft",function(){if(n.transition==0){n.next=n.next+1;if(n.next==n.slideamount)n.next=0;u(n,t)}});r.on("swiperight",function(){if(n.transition==0){n.next=n.next-1;n.leftarrowpressed=1;if(n.next<0)n.next=n.slideamount-1;u(n,t)}});r.on("swipeup",function(){e("html, body").animate({scrollTop:t.offset().top+t.height()+"px"})});r.on("swipedown",function(){e("html, body").animate({scrollTop:t.offset().top-e(window).height()+"px"})})}}function v(e,t){var n=e.parent().find(".tp-bullets");var r=e.parent().find(".tparrows");if(n==null){e.append('<div class=".tp-bullets"></div>');var n=e.parent().find(".tp-bullets")}if(r==null){e.append('<div class=".tparrows"></div>');var r=e.parent().find(".tparrows")}e.data("hidethumbs",t.hideThumbs);n.addClass("hidebullets");r.addClass("hidearrows");if(s()){e.hammer().on("touch",function(){e.addClass("hovered");if(t.onHoverStop=="on")e.trigger("stoptimer");clearTimeout(e.data("hidethumbs"));n.removeClass("hidebullets");r.removeClass("hidearrows")});e.hammer().on("release",function(){e.removeClass("hovered");e.trigger("playtimer");if(!e.hasClass("hovered")&&!n.hasClass("hovered"))e.data("hidethumbs",setTimeout(function(){n.addClass("hidebullets");r.addClass("hidearrows");e.trigger("playtimer")},t.hideNavDelayOnMobile))})}else{n.hover(function(){t.overnav=true;if(t.onHoverStop=="on")e.trigger("stoptimer");n.addClass("hovered");clearTimeout(e.data("hidethumbs"));n.removeClass("hidebullets");r.removeClass("hidearrows")},function(){t.overnav=false;e.trigger("playtimer");n.removeClass("hovered");if(!e.hasClass("hovered")&&!n.hasClass("hovered"))e.data("hidethumbs",setTimeout(function(){n.addClass("hidebullets");r.addClass("hidearrows")},t.hideThumbs))});r.hover(function(){t.overnav=true;if(t.onHoverStop=="on")e.trigger("stoptimer");n.addClass("hovered");clearTimeout(e.data("hidethumbs"));n.removeClass("hidebullets");r.removeClass("hidearrows")},function(){t.overnav=false;e.trigger("playtimer");n.removeClass("hovered")});e.on("mouseenter",function(){e.addClass("hovered");if(t.onHoverStop=="on")e.trigger("stoptimer");clearTimeout(e.data("hidethumbs"));n.removeClass("hidebullets");r.removeClass("hidearrows")});e.on("mouseleave",function(){e.removeClass("hovered");e.trigger("playtimer");if(!e.hasClass("hovered")&&!n.hasClass("hovered"))e.data("hidethumbs",setTimeout(function(){n.addClass("hidebullets");r.addClass("hidearrows")},t.hideThumbs))})}}function m(t,n){var r=t.parent();var i=r.find(".tp-bullets");if(n.navigationType=="thumb"){i.find(".thumb").each(function(t){var r=e(this);r.css({width:n.thumbWidth*n.bw+"px",height:n.thumbHeight*n.bh+"px"})});var s=i.find(".tp-mask");s.width(n.thumbWidth*n.thumbAmount*n.bw);s.height(n.thumbHeight*n.bh);s.parent().width(n.thumbWidth*n.thumbAmount*n.bw);s.parent().height(n.thumbHeight*n.bh)}var o=r.find(".tp-leftarrow");var u=r.find(".tp-rightarrow");if(n.navigationType=="thumb"&&n.navigationArrows=="nexttobullets")n.navigationArrows="solo";if(n.navigationArrows=="nexttobullets"){o.prependTo(i).css({"float":"left"});u.insertBefore(i.find(".tpclear")).css({"float":"left"})}var a=0;if(n.forceFullWidth=="on")a=0-n.container.parent().offset().left;if(n.navigationArrows!="none"&&n.navigationArrows!="nexttobullets"){o.css({position:"absolute"});u.css({position:"absolute"});if(n.soloArrowLeftValign=="center")o.css({top:"50%",marginTop:n.soloArrowLeftVOffset-Math.round(o.innerHeight()/2)+"px"});if(n.soloArrowLeftValign=="bottom")o.css({top:"auto",bottom:0+n.soloArrowLeftVOffset+"px"});if(n.soloArrowLeftValign=="top")o.css({bottom:"auto",top:0+n.soloArrowLeftVOffset+"px"});if(n.soloArrowLeftHalign=="center")o.css({left:"50%",marginLeft:a+n.soloArrowLeftHOffset-Math.round(o.innerWidth()/2)+"px"});if(n.soloArrowLeftHalign=="left")o.css({left:0+n.soloArrowLeftHOffset+a+"px"});if(n.soloArrowLeftHalign=="right")o.css({right:0+n.soloArrowLeftHOffset-a+"px"});if(n.soloArrowRightValign=="center")u.css({top:"50%",marginTop:n.soloArrowRightVOffset-Math.round(u.innerHeight()/2)+"px"});if(n.soloArrowRightValign=="bottom")u.css({top:"auto",bottom:0+n.soloArrowRightVOffset+"px"});if(n.soloArrowRightValign=="top")u.css({bottom:"auto",top:0+n.soloArrowRightVOffset+"px"});if(n.soloArrowRightHalign=="center")u.css({left:"50%",marginLeft:a+n.soloArrowRightHOffset-Math.round(u.innerWidth()/2)+"px"});if(n.soloArrowRightHalign=="left")u.css({left:0+n.soloArrowRightHOffset+a+"px"});if(n.soloArrowRightHalign=="right")u.css({right:0+n.soloArrowRightHOffset-a+"px"});if(o.position()!=null)o.css({top:Math.round(parseInt(o.position().top,0))+"px"});if(u.position()!=null)u.css({top:Math.round(parseInt(u.position().top,0))+"px"})}if(n.navigationArrows=="none"){o.css({visibility:"hidden"});u.css({visibility:"hidden"})}if(n.navigationVAlign=="center")i.css({top:"50%",marginTop:n.navigationVOffset-Math.round(i.innerHeight()/2)+"px"});if(n.navigationVAlign=="bottom")i.css({bottom:0+n.navigationVOffset+"px"});if(n.navigationVAlign=="top")i.css({top:0+n.navigationVOffset+"px"});if(n.navigationHAlign=="center")i.css({left:"50%",marginLeft:a+n.navigationHOffset-Math.round(i.innerWidth()/2)+"px"});if(n.navigationHAlign=="left")i.css({left:0+n.navigationHOffset+a+"px"});if(n.navigationHAlign=="right")i.css({right:0+n.navigationHOffset-a+"px"})}function g(n,r){r.container.closest(".forcefullwidth_wrapper_tp_banner").find(".tp-fullwidth-forcer").css({height:r.container.height()});r.container.closest(".rev_slider_wrapper").css({height:r.container.height()});r.width=parseInt(r.container.width(),0);r.height=parseInt(r.container.height(),0);r.bw=r.width/r.startwidth;r.bh=r.height/r.startheight;if(r.bh>r.bw)r.bh=r.bw;if(r.bh<r.bw)r.bw=r.bh;if(r.bw<r.bh)r.bh=r.bw;if(r.bh>1){r.bw=1;r.bh=1}if(r.bw>1){r.bw=1;r.bh=1}r.height=Math.round(r.startheight*(r.width/r.startwidth));if(r.height>r.startheight&&r.autoHeight!="on")r.height=r.startheight;if(r.fullScreen=="on"){r.height=r.bw*r.startheight;var i=r.container.parent().width();var s=e(window).height();if(r.fullScreenOffsetContainer!=t){try{var o=r.fullScreenOffsetContainer.split(",");e.each(o,function(t,n){s=s-e(n).outerHeight(true);if(s<r.minFullScreenHeight)s=r.minFullScreenHeight})}catch(u){}}r.container.parent().height(s);r.container.css({height:"100%"});r.height=s}else{r.container.height(r.height)}r.slotw=Math.ceil(r.width/r.slots);if(r.fullSreen=="on")r.sloth=Math.ceil(e(window).height()/r.slots);else r.sloth=Math.ceil(r.height/r.slots);if(r.autoHeight=="on")r.sloth=Math.ceil(n.height()/r.slots)}function y(n,r){n.find(".tp-caption").each(function(){e(this).addClass(e(this).data("transition"));e(this).addClass("start")});n.find(">ul:first").css({overflow:"hidden",width:"100%",height:"100%",maxHeight:n.parent().css("maxHeight")});if(r.autoHeight=="on"){n.find(">ul:first").css({overflow:"hidden",width:"100%",height:"100%",maxHeight:"none"});n.css({maxHeight:"none"});n.parent().css({maxHeight:"none"})}n.find(">ul:first >li").each(function(n){var r=e(this);r.css({width:"100%",height:"100%",overflow:"hidden"});if(r.data("link")!=t){var i=r.data("link");var s="_self";var o=60;if(r.data("slideindex")=="back")o=0;var u=r.data("linktoslide");if(r.data("target")!=t)s=r.data("target");if(i=="slide"){r.append('<div class="tp-caption sft slidelink" style="width:100%;height:100%;z-index:'+o+';" data-x="0" data-y="0" data-linktoslide="'+u+'" data-start="0"><a style="width:100%;height:100%;display:block"><span style="width:100%;height:100%;display:block"></span></a></div>')}else{u="no";r.append('<div class="tp-caption sft slidelink" style="width:100%;height:100%;z-index:'+o+';" data-x="0" data-y="0" data-linktoslide="'+u+'" data-start="0"><a style="width:100%;height:100%;display:block" target="'+s+'" href="'+i+'"><span style="width:100%;height:100%;display:block"></span></a></div>')}}});n.parent().css({overflow:"visible"});n.find(">ul:first >li >img").each(function(n){var i=e(this);i.addClass("defaultimg");if(i.data("lazyload")!=t&&i.data("lazydone")!=1){}else{g(i,r)}i.wrap('<div class="slotholder" style="width:100%;height:100%;"'+'data-duration="'+i.data("duration")+'"'+'data-zoomstart="'+i.data("zoomstart")+'"'+'data-zoomend="'+i.data("zoomend")+'"'+'data-rotationstart="'+i.data("rotationstart")+'"'+'data-rotationend="'+i.data("rotationend")+'"'+'data-ease="'+i.data("ease")+'"'+'data-duration="'+i.data("duration")+'"'+'data-bgpositionend="'+i.data("bgpositionend")+'"'+'data-bgposition="'+i.data("bgposition")+'"'+'data-duration="'+i.data("duration")+'"'+'data-kenburns="'+i.data("kenburns")+'"'+'data-easeme="'+i.data("ease")+'"'+'data-bgfit="'+i.data("bgfit")+'"'+'data-bgfitend="'+i.data("bgfitend")+'"'+'data-owidth="'+i.data("owidth")+'"'+'data-oheight="'+i.data("oheight")+'"'+"></div>");if(r.dottedOverlay!="none"&&r.dottedOverlay!=t)i.closest(".slotholder").append('<div class="tp-dottedoverlay '+r.dottedOverlay+'"></div>');var s=i.attr("src");var u=i.data("lazyload");var a=i.data("bgfit");var f=i.data("bgrepeat");var l=i.data("bgposition");if(a==t)a="cover";if(f==t)f="no-repeat";if(l==t)l="center center";var c=i.closest(".slotholder");i.replaceWith('<div class="tp-bgimg defaultimg" data-lazyload="'+i.data("lazyload")+'" data-bgfit="'+a+'"data-bgposition="'+l+'" data-bgrepeat="'+f+'" data-lazydone="'+i.data("lazydone")+'" src="'+s+'" data-src="'+s+'" style="background-color:'+i.css("backgroundColor")+";background-repeat:"+f+";background-image:url("+s+");background-size:"+a+";background-position:"+l+';width:100%;height:100%;"></div>');if(o(8)){c.find(".tp-bgimg").css({backgroundImage:"none","background-image":"none"});c.find(".tp-bgimg").append('<img class="ieeightfallbackimage defaultimg" src="'+s+'" style="width:100%">')}i.css({opacity:0});i.data("li-id",n)})}function b(e,n,r,i){var s=e;var u=s.find(".defaultimg");var a=s.data("zoomstart");var f=s.data("rotationstart");if(u.data("currotate")!=t)f=u.data("currotate");if(u.data("curscale")!=t)a=u.data("curscale");g(u,n);var l=u.data("src");var c=u.css("background-color");var h=n.width;var p=n.height;if(n.autoHeight=="on")p=n.container.height();var d=u.data("fxof");if(d==t)d=0;fullyoff=0;var v=0;var m=u.data("bgfit");var y=u.data("bgrepeat");var b=u.data("bgposition");if(m==t)m="cover";if(y==t)y="no-repeat";if(b==t)b="center center";if(s.data("kenburns")=="on"){m=a;if(m.toString().length<4)m=D(m,s,n)}if(o(8)){var w=l;l=""}if(i=="horizontal"){if(!r)var v=0-n.slotw;for(var S=0;S<n.slots;S++){s.append('<div class="slot" style="position:absolute;'+"top:"+(0+fullyoff)+"px;"+"left:"+(d+S*n.slotw)+"px;"+"overflow:hidden;width:"+n.slotw+"px;"+"height:"+p+'px">'+'<div class="slotslide" style="position:absolute;'+"top:0px;left:"+v+"px;"+"width:"+n.slotw+"px;"+"height:"+p+'px;overflow:hidden;">'+'<div style="background-color:'+c+";"+"position:absolute;top:0px;"+"left:"+(0-S*n.slotw)+"px;"+"width:"+h+"px;height:"+p+"px;"+"background-image:url("+l+");"+"background-repeat:"+y+";"+"background-size:"+m+";background-position:"+b+';">'+"</div></div></div>");if(a!=t&&f!=t)TweenLite.set(s.find(".slot").last(),{rotationZ:f});if(o(8)){s.find(".slot ").last().find(".slotslide").append('<img class="ieeightfallbackimage" src="'+w+'" style="width:100%;height:auto">');E(s,n)}}}else{if(!r)var v=0-n.sloth;for(var S=0;S<n.slots+2;S++){s.append('<div class="slot" style="position:absolute;'+"top:"+(fullyoff+S*n.sloth)+"px;"+"left:"+d+"px;"+"overflow:hidden;"+"width:"+h+"px;"+"height:"+n.sloth+'px">'+'<div class="slotslide" style="position:absolute;'+"top:"+v+"px;"+"left:0px;width:"+h+"px;"+"height:"+n.sloth+"px;"+'overflow:hidden;">'+'<div style="background-color:'+c+";"+"position:absolute;"+"top:"+(0-S*n.sloth)+"px;"+"left:0px;"+"width:"+h+"px;height:"+p+"px;"+"background-image:url("+l+");"+"background-repeat:"+y+";"+"background-size:"+m+";background-position:"+b+';">'+"</div></div></div>");if(a!=t&&f!=t)TweenLite.set(s.find(".slot").last(),{rotationZ:f});if(o(8)){s.find(".slot ").last().find(".slotslide").append('<img class="ieeightfallbackimage" src="'+w+'" style="width:100%;height:auto;">');E(s,n)}}}}function w(e,n,r){var i=e;var s=i.find(".defaultimg");var u=i.data("zoomstart");var a=i.data("rotationstart");if(s.data("currotate")!=t)a=s.data("currotate");if(s.data("curscale")!=t)u=s.data("curscale")*100;g(s,n);var f=s.data("src");var l=s.css("backgroundColor");var c=n.width;var h=n.height;if(n.autoHeight=="on")h=n.container.height();var p=s.data("fxof");if(p==t)p=0;fullyoff=0;var d=0;if(o(8)){var v=f;f=""}var m=0;if(n.sloth>n.slotw)m=n.sloth;else m=n.slotw;if(!r){var d=0-m}n.slotw=m;n.sloth=m;var y=0;var b=0;var w=s.data("bgfit");var S=s.data("bgrepeat");var x=s.data("bgposition");if(w==t)w="cover";if(S==t)S="no-repeat";if(x==t)x="center center";if(i.data("kenburns")=="on"){w=u;if(w.toString().length<4)w=D(w,i,n)}for(var T=0;T<n.slots;T++){b=0;for(var N=0;N<n.slots;N++){i.append('<div class="slot" '+'style="position:absolute;'+"top:"+(fullyoff+b)+"px;"+"left:"+(p+y)+"px;"+"width:"+m+"px;"+"height:"+m+"px;"+'overflow:hidden;">'+'<div class="slotslide" data-x="'+y+'" data-y="'+b+'" '+'style="position:absolute;'+"top:"+0+"px;"+"left:"+0+"px;"+"width:"+m+"px;"+"height:"+m+"px;"+'overflow:hidden;">'+'<div style="position:absolute;'+"top:"+(0-b)+"px;"+"left:"+(0-y)+"px;"+"width:"+c+"px;"+"height:"+h+"px;"+"background-color:"+l+";"+"background-image:url("+f+");"+"background-repeat:"+S+";"+"background-size:"+w+";background-position:"+x+';">'+"</div></div></div>");b=b+m;if(o(8)){i.find(".slot ").last().find(".slotslide").append('<img src="'+v+'">');E(i,n)}if(u!=t&&a!=t)TweenLite.set(i.find(".slot").last(),{rotationZ:a})}y=y+m}}function E(e,t){if(o(8)){var n=e.find(".ieeightfallbackimage");var r=n.width(),i=n.height();if(t.startwidth/t.startheight<e.data("owidth")/e.data("oheight"))n.css({width:"auto",height:"100%"});else n.css({width:"100%",height:"auto"});setTimeout(function(){var r=n.width(),i=n.height();if(e.data("bgposition")=="center center")n.css({position:"absolute",top:t.height/2-i/2+"px",left:t.width/2-r/2+"px"});if(e.data("bgposition")=="center top"||e.data("bgposition")=="top center")n.css({position:"absolute",top:"0px",left:t.width/2-r/2+"px"});if(e.data("bgposition")=="center bottom"||e.data("bgposition")=="bottom center")n.css({position:"absolute",bottom:"0px",left:t.width/2-r/2+"px"});if(e.data("bgposition")=="right top"||e.data("bgposition")=="top right")n.css({position:"absolute",top:"0px",right:"0px"});if(e.data("bgposition")=="right bottom"||e.data("bgposition")=="bottom right")n.css({position:"absolute",bottom:"0px",right:"0px"});if(e.data("bgposition")=="right center"||e.data("bgposition")=="center right")n.css({position:"absolute",top:t.height/2-i/2+"px",right:"0px"});if(e.data("bgposition")=="left bottom"||e.data("bgposition")=="bottom left")n.css({position:"absolute",bottom:"0px",left:"0px"});if(e.data("bgposition")=="left center"||e.data("bgposition")=="center left")n.css({position:"absolute",top:t.height/2-i/2+"px",left:"0px"})},20)}}function S(n,r,i){if(i==t)i==80;setTimeout(function(){n.find(".slotholder .slot").each(function(){clearTimeout(e(this).data("tout"));e(this).remove()});r.transition=0},i)}function x(n,r){n.find("img, .defaultimg").each(function(n){var i=e(this);if(i.data("lazyload")!=i.attr("src")&&r<3&&i.data("lazyload")!=t&&i.data("lazyload")!="undefined"){if(i.data("lazyload")!=t&&i.data("lazyload")!="undefined"){i.attr("src",i.data("lazyload"));var s=new Image;s.onload=function(e){i.data("lazydone",1);if(i.hasClass("defaultimg"))T(i,s)};s.error=function(){i.data("lazydone",1)};s.src=i.attr("src");if(s.complete){if(i.hasClass("defaultimg"))T(i,s);i.data("lazydone",1)}}}else{if((i.data("lazyload")===t||i.data("lazyload")==="undefined")&&i.data("lazydone")!=1){var s=new Image;s.onload=function(){if(i.hasClass("defaultimg"))T(i,s);i.data("lazydone",1)};s.error=function(){i.data("lazydone",1)};if(i.attr("src")!=t&&i.attr("src")!="undefined"){s.src=i.attr("src")}else s.src=i.data("src");if(s.complete){if(i.hasClass("defaultimg")){T(i,s)}i.data("lazydone",1)}}}})}function T(e,t){var n=e.closest("li");var r=t.width;var i=t.height;n.data("owidth",r);n.data("oheight",i);n.find(".slotholder").data("owidth",r);n.find(".slotholder").data("oheight",i);n.data("loadeddone",1)}function C(e,n){try{var r=e.find(">ul:first-child >li:eq("+n.act+")")}catch(i){var r=e.find(">ul:first-child >li:eq(1)")}n.lastslide=n.act;var s=e.find(">ul:first-child >li:eq("+n.next+")");var u=s.find(".defaultimg");n.bannertimeronpause=true;e.trigger("stoptimer");n.cd=0;if(u.data("lazyload")!=t&&u.data("lazyload")!="undefined"&&u.data("lazydone")!=1){if(!o(8))u.css({backgroundImage:'url("'+s.find(".defaultimg").data("lazyload")+'")'});else{u.attr("src",s.find(".defaultimg").data("lazyload"))}u.data("src",s.find(".defaultimg").data("lazyload"));u.data("lazydone",1);u.data("orgw",0);s.data("loadeddone",1);TweenLite.set(e.find(".tp-loader"),{display:"block",opacity:0});TweenLite.to(e.find(".tp-loader"),.3,{autoAlpha:1});N(s,function(){k(n,u,e)},n)}else{if(s.data("loadeddone")===t){s.data("loadeddone",1);N(s,function(){k(n,u,e)},n)}else k(n,u,e)}}function k(e,t,n){e.bannertimeronpause=false;e.cd=0;n.trigger("nulltimer");TweenLite.to(n.find(".tp-loader"),.3,{autoAlpha:0});g(t,e);m(n,e);g(t,e);L(n,e)}function L(n,r){function x(){e.each(v,function(e,t){if(t[0]==p||t[8]==p){l=t[1];d=t[2];y=E}E=E+1})}n.trigger("revolution.slide.onbeforeswap");r.transition=1;r.videoplaying=false;try{var i=n.find(">ul:first-child >li:eq("+r.act+")")}catch(s){var i=n.find(">ul:first-child >li:eq(1)")}r.lastslide=r.act;var u=n.find(">ul:first-child >li:eq("+r.next+")");var a=i.find(".slotholder");var f=u.find(".slotholder");i.css({visibility:"visible"});u.css({visibility:"visible"});if(f.data("kenburns")=="on")M(n,r);if(r.ie){if(p=="boxfade")p="boxslide";if(p=="slotfade-vertical")p="slotzoom-vertical";if(p=="slotfade-horizontal")p="slotzoom-horizontal"}if(u.data("delay")!=t){r.cd=0;r.delay=u.data("delay")}else{r.delay=r.origcd}n.trigger("restarttimer");i.css({left:"0px",top:"0px"});u.css({left:"0px",top:"0px"});if(u.data("differentissplayed")=="prepared"){u.data("differentissplayed","done");u.data("transition",u.data("savedtransition"));u.data("slotamount",u.data("savedslotamount"));u.data("masterspeed",u.data("savedmasterspeed"))}if(u.data("fstransition")!=t&&u.data("differentissplayed")!="done"){u.data("savedtransition",u.data("transition"));u.data("savedslotamount",u.data("slotamount"));u.data("savedmasterspeed",u.data("masterspeed"));u.data("transition",u.data("fstransition"));u.data("slotamount",u.data("fsslotamount"));u.data("masterspeed",u.data("fsmasterspeed"));u.data("differentissplayed","prepared")}var l=0;var c=u.data("transition").split(",");var h=u.data("nexttransid");if(h==t){h=0;u.data("nexttransid",h)}else{h=h+1;if(h==c.length)h=0;u.data("nexttransid",h)}var p=c[h];var d=0;if(p=="slidehorizontal"){p="slideleft";if(r.leftarrowpressed==1)p="slideright"}if(p=="slidevertical"){p="slideup";if(r.leftarrowpressed==1)p="slidedown"}var v=[["boxslide",0,1,10,0,"box",false,null,0],["boxfade",1,0,10,0,"box",false,null,1],["slotslide-horizontal",2,0,0,200,"horizontal",true,false,2],["slotslide-vertical",3,0,0,200,"vertical",true,false,3],["curtain-1",4,3,0,0,"horizontal",true,true,4],["curtain-2",5,3,0,0,"horizontal",true,true,5],["curtain-3",6,3,25,0,"horizontal",true,true,6],["slotzoom-horizontal",7,0,0,400,"horizontal",true,true,7],["slotzoom-vertical",8,0,0,0,"vertical",true,true,8],["slotfade-horizontal",9,0,0,500,"horizontal",true,null,9],["slotfade-vertical",10,0,0,500,"vertical",true,null,10],["fade",11,0,1,300,"horizontal",true,null,11],["slideleft",12,0,1,0,"horizontal",true,true,12],["slideup",13,0,1,0,"horizontal",true,true,13],["slidedown",14,0,1,0,"horizontal",true,true,14],["slideright",15,0,1,0,"horizontal",true,true,15],["papercut",16,0,0,600,"",null,null,16],["3dcurtain-horizontal",17,0,20,100,"vertical",false,true,17],["3dcurtain-vertical",18,0,10,100,"horizontal",false,true,18],["cubic",19,0,20,600,"horizontal",false,true,19],["cube",19,0,20,600,"horizontal",false,true,20],["flyin",20,0,4,600,"vertical",false,true,21],["turnoff",21,0,1,1600,"horizontal",false,true,22],["incube",22,0,20,600,"horizontal",false,true,23],["cubic-horizontal",23,0,20,500,"vertical",false,true,24],["cube-horizontal",23,0,20,500,"vertical",false,true,25],["incube-horizontal",24,0,20,500,"vertical",false,true,26],["turnoff-vertical",25,0,1,1600,"horizontal",false,true,27],["fadefromright",12,1,1,0,"horizontal",true,true,28],["fadefromleft",15,1,1,0,"horizontal",true,true,29],["fadefromtop",14,1,1,0,"horizontal",true,true,30],["fadefrombottom",13,1,1,0,"horizontal",true,true,31],["fadetoleftfadefromright",12,2,1,0,"horizontal",true,true,32],["fadetorightfadetoleft",15,2,1,0,"horizontal",true,true,33],["fadetobottomfadefromtop",14,2,1,0,"horizontal",true,true,34],["fadetotopfadefrombottom",13,2,1,0,"horizontal",true,true,35],["parallaxtoright",12,3,1,0,"horizontal",true,true,36],["parallaxtoleft",15,3,1,0,"horizontal",true,true,37],["parallaxtotop",14,3,1,0,"horizontal",true,true,38],["parallaxtobottom",13,3,1,0,"horizontal",true,true,39],["scaledownfromright",12,4,1,0,"horizontal",true,true,40],["scaledownfromleft",15,4,1,0,"horizontal",true,true,41],["scaledownfromtop",14,4,1,0,"horizontal",true,true,42],["scaledownfrombottom",13,4,1,0,"horizontal",true,true,43],["zoomout",13,5,1,0,"horizontal",true,true,44],["zoomin",13,6,1,0,"horizontal",true,true,45],["notransition",26,0,1,0,"horizontal",true,null,46]];var m=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45];var g=[16,17,18,19,20,21,22,23,24,25,26,27];var l=0;var d=1;var y=0;var E=0;var S=new Array;if(p=="random"){p=Math.round(Math.random()*v.length-1);if(p>v.length-1)p=v.length-1}if(p=="random-static"){p=Math.round(Math.random()*m.length-1);if(p>m.length-1)p=m.length-1;p=m[p]}if(p=="random-premium"){p=Math.round(Math.random()*g.length-1);if(p>g.length-1)p=g.length-1;p=g[p]}if(r.isJoomla==true&&p==16){p=Math.round(Math.random()*g.length-2)+1;if(p>g.length-1)p=g.length-1;p=g[p]}x();if(o(8)&&l>15&&l<28){p=Math.round(Math.random()*m.length-1);if(p>m.length-1)p=m.length-1;p=m[p];E=0;x()}var T=-1;if(r.leftarrowpressed==1||r.act>r.next)T=1;r.leftarrowpressed=0;if(l>26)l=26;if(l<0)l=0;var N=300;if(u.data("masterspeed")!=t&&u.data("masterspeed")>99&&u.data("masterspeed")<4001)N=u.data("masterspeed");S=v[y];n.parent().find(".bullet").each(function(){var t=e(this);t.removeClass("selected");if(r.navigationArrows=="withbullet"||r.navigationArrows=="nexttobullets"){if(t.index()-1==r.next)t.addClass("selected")}else{if(t.index()==r.next)t.addClass("selected")}});n.find(">li").each(function(){var t=e(this);if(t.index!=r.act&&t.index!=r.next)t.css({"z-index":16})});i.css({"z-index":18});u.css({"z-index":20});u.css({opacity:0});if(i.index()!=u.index()&&r.firststart!=1){Q(i,r)}V(u,r);if(u.data("slotamount")==t||u.data("slotamount")<1){r.slots=Math.round(Math.random()*12+4);if(p=="boxslide")r.slots=Math.round(Math.random()*6+3);else if(p=="flyin")r.slots=Math.round(Math.random()*4+1)}else{r.slots=u.data("slotamount")}if(u.data("rotate")==t)r.rotate=0;else if(u.data("rotate")==999)r.rotate=Math.round(Math.random()*360);else r.rotate=u.data("rotate");if(!e.support.transition||r.ie||r.ie9)r.rotate=0;if(r.firststart==1){i.css({opacity:0});r.firststart=0}N=N+S[4];if((l==4||l==5||l==6)&&r.slots<3)r.slots=3;if(S[3]!=0)r.slots=Math.min(r.slots,S[3]);if(l==9)r.slots=r.width/20;if(l==10)r.slots=r.height/20;if(S[5]=="box"){if(S[7]!=null)w(a,r,S[7]);if(S[6]!=null)w(f,r,S[6])}else if(S[5]=="vertical"||S[5]=="horizontal"){if(S[7]!=null)b(a,r,S[7],S[5]);if(S[6]!=null)b(f,r,S[6],S[5])}if(l<12||l>16)u.css({opacity:1});if(l==0){f.find(".defaultimg").css({opacity:0});var C=Math.ceil(r.height/r.sloth);var k=0;f.find(".slotslide").each(function(t){var s=e(this);k=k+1;if(k==C)k=0;TweenLite.fromTo(s,N/600,{opacity:0,top:0-r.sloth,left:0-r.slotw,rotation:r.rotate},{opacity:1,transformPerspective:600,top:0,left:0,scale:1,rotation:0,delay:(t*15+k*30)/1500,ease:Power2.easeOut,onComplete:function(){if(t==r.slots*r.slots-1){F(n,r,f,a,u,i)}}})})}if(l==1){f.find(".defaultimg").css({opacity:0});var L;f.find(".slotslide").each(function(t){var n=e(this);rand=Math.random()*N+300;rand2=Math.random()*500+200;if(rand+rand2>L)L=rand2+rand2;TweenLite.fromTo(n,rand/1e3,{opacity:0,transformPerspective:600,rotation:r.rotate},{opacity:1,ease:Power2.easeInOut,rotation:0,delay:rand2/1e3})});setTimeout(function(){F(n,r,f,a,u,i)},N+300)}if(l==2){f.find(".defaultimg").css({opacity:0});a.find(".slotslide").each(function(){var t=e(this);TweenLite.to(t,N/1e3,{left:r.slotw,rotation:0-r.rotate,onComplete:function(){F(n,r,f,a,u,i)}})});f.find(".slotslide").each(function(){var t=e(this);TweenLite.fromTo(t,N/1e3,{left:0-r.slotw,rotation:r.rotate,transformPerspective:600},{left:0,rotation:0,ease:Power2.easeOut,onComplete:function(){F(n,r,f,a,u,i)}})})}if(l==3){f.find(".defaultimg").css({opacity:0});a.find(".slotslide").each(function(){var t=e(this);TweenLite.to(t,N/1e3,{top:r.sloth,rotation:r.rotate,transformPerspective:600,onComplete:function(){F(n,r,f,a,u,i)}})});f.find(".slotslide").each(function(){var t=e(this);TweenLite.fromTo(t,N/1e3,{top:0-r.sloth,rotation:r.rotate,transformPerspective:600},{top:0,rotation:0,ease:Power2.easeOut,onComplete:function(){F(n,r,f,a,u,i)}})})}if(l==4||l==5){f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);var A=N/1e3;var O=A;a.find(".slotslide").each(function(t){var n=e(this);var i=t*A/r.slots;if(l==5)i=(r.slots-t-1)*A/r.slots/1.5;TweenLite.to(n,A*3,{transformPerspective:600,top:0+r.height,opacity:.5,rotation:r.rotate,ease:Power2.easeInOut,delay:i})});f.find(".slotslide").each(function(t){var s=e(this);var o=t*A/r.slots;if(l==5)o=(r.slots-t-1)*A/r.slots/1.5;TweenLite.fromTo(s,A*3,{top:0-r.height,opacity:.5,rotation:r.rotate,transformPerspective:600},{top:0,opacity:1,rotation:0,ease:Power2.easeInOut,delay:o,onComplete:function(){if(t==r.slots-1){F(n,r,f,a,u,i)}}})})}if(l==6){if(r.slots<2)r.slots=2;f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);a.find(".slotslide").each(function(t){var n=e(this);if(t<r.slots/2)var i=(t+2)*60;else var i=(2+r.slots-t)*60;TweenLite.to(n,(N+i)/1e3,{top:0+r.height,opacity:1,rotation:r.rotate,transformPerspective:600,ease:Power2.easeInOut})});f.find(".slotslide").each(function(t){var s=e(this);if(t<r.slots/2)var o=(t+2)*60;else var o=(2+r.slots-t)*60;TweenLite.fromTo(s,(N+o)/1e3,{top:0-r.height,opacity:1,rotation:r.rotate,transformPerspective:600},{top:0,opacity:1,rotation:0,ease:Power2.easeInOut,onComplete:function(){if(t==Math.round(r.slots/2)){F(n,r,f,a,u,i)}}})})}if(l==7){N=N*2;f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);a.find(".slotslide").each(function(){var t=e(this).find("div");TweenLite.to(t,N/1e3,{left:0-r.slotw/2+"px",top:0-r.height/2+"px",width:r.slotw*2+"px",height:r.height*2+"px",opacity:0,rotation:r.rotate,transformPerspective:600,ease:Power2.easeOut})});f.find(".slotslide").each(function(t){var s=e(this).find("div");TweenLite.fromTo(s,N/1e3,{left:0,top:0,opacity:0,transformPerspective:600},{left:0-t*r.slotw+"px",ease:Power2.easeOut,top:0+"px",width:r.width,height:r.height,opacity:1,rotation:0,delay:.1,onComplete:function(){F(n,r,f,a,u,i)}})})}if(l==8){N=N*3;f.find(".defaultimg").css({opacity:0});a.find(".slotslide").each(function(){var t=e(this).find("div");TweenLite.to(t,N/1e3,{left:0-r.width/2+"px",top:0-r.sloth/2+"px",width:r.width*2+"px",height:r.sloth*2+"px",transformPerspective:600,opacity:0,rotation:r.rotate})});f.find(".slotslide").each(function(t){var s=e(this).find("div");TweenLite.fromTo(s,N/1e3,{left:0,top:0,opacity:0,transformPerspective:600},{left:0+"px",top:0-t*r.sloth+"px",width:f.find(".defaultimg").data("neww")+"px",height:f.find(".defaultimg").data("newh")+"px",opacity:1,rotation:0,onComplete:function(){F(n,r,f,a,u,i)}})})}if(l==9||l==10){f.find(".defaultimg").css({opacity:0});var _=0;f.find(".slotslide").each(function(t){var n=e(this);_++;TweenLite.fromTo(n,N/1e3,{opacity:0,transformPerspective:600,left:0,top:0},{opacity:1,ease:Power2.easeInOut,delay:t*4/1e3})});setTimeout(function(){F(n,r,f,a,u,i)},N+_*4)}if(l==11||l==26){f.find(".defaultimg").css({opacity:0,position:"relative"});var _=0;if(l==26)N=0;f.find(".slotslide").each(function(t){var n=e(this);TweenLite.fromTo(n,N/1e3,{opacity:0},{opacity:1,ease:Power2.easeInOut})});setTimeout(function(){F(n,r,f,a,u,i)},N+15)}if(l==12||l==13||l==14||l==15){setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);f.find(".defaultimg").css({opacity:0});var D=r.width;var P=r.height;var H=f.find(".slotslide");if(r.fullWidth=="on"||r.fullSreen=="on"){D=H.width();P=H.height()}var B=0;var j=0;if(l==12)B=D;else if(l==15)B=0-D;else if(l==13)j=P;else if(l==14)j=0-P;var I=1;var q=1;var R=1;var U=Power2.easeInOut;var z=Power2.easeInOut;var W=N/1e3;var X=W;if(d==1)I=0;if(d==2)I=0;if(d==3){U=Power2.easeInOut;z=Power1.easeInOut;i.css({position:"absolute","z-index":20});u.css({position:"absolute","z-index":15});W=N/1200}if(d==4||d==5)q=.6;if(d==6)q=1.4;if(d==5||d==6){R=1.4;I=0;D=0;P=0;B=0;j=0}if(d==6)R=.6;TweenLite.fromTo(H,W,{left:B,top:j,scale:R,opacity:I,rotation:r.rotate},{opacity:1,rotation:0,left:0,top:0,scale:1,ease:z,onComplete:function(){F(n,r,f,a,u,i);i.css({position:"absolute","z-index":18});u.css({position:"absolute","z-index":20})}});var $=a.find(".slotslide");if(d==4||d==5){D=0;P=0}if(d!=1){if(l==12)TweenLite.to($,X,{left:0-D+"px",scale:q,opacity:I,rotation:r.rotate,ease:U});else if(l==15)TweenLite.to($,X,{left:D+"px",scale:q,opacity:I,rotation:r.rotate,ease:U});else if(l==13)TweenLite.to($,X,{top:0-P+"px",scale:q,opacity:I,rotation:r.rotate,ease:U});else if(l==14)TweenLite.to($,X,{top:P+"px",scale:q,opacity:I,rotation:r.rotate,ease:U})}u.css({opacity:1})}if(l==16){i.css({position:"absolute","z-index":20});u.css({position:"absolute","z-index":15});i.wrapInner('<div class="tp-half-one" style="position:relative; width:100%;height:100%"></div>');i.find(".tp-half-one").clone(true).appendTo(i).addClass("tp-half-two");i.find(".tp-half-two").removeClass("tp-half-one");var D=r.width;var P=r.height;if(r.autoHeight=="on")P=n.height();i.find(".tp-half-one .defaultimg").wrap('<div class="tp-papercut" style="width:'+D+"px;height:"+P+'px;"></div>');i.find(".tp-half-two .defaultimg").wrap('<div class="tp-papercut" style="width:'+D+"px;height:"+P+'px;"></div>');i.find(".tp-half-two .defaultimg").css({position:"absolute",top:"-50%"});i.find(".tp-half-two .tp-caption").wrapAll('<div style="position:absolute;top:-50%;left:0px"></div>');TweenLite.set(i.find(".tp-half-two"),{width:D,height:P,overflow:"hidden",zIndex:15,position:"absolute",top:P/2,left:"0px",transformPerspective:600,transformOrigin:"center bottom"});TweenLite.set(i.find(".tp-half-one"),{width:D,height:P/2,overflow:"visible",zIndex:10,position:"absolute",top:"0px",left:"0px",transformPerspective:600,transformOrigin:"center top"});var J=i.find(".defaultimg");var K=Math.round(Math.random()*20-10);var G=Math.round(Math.random()*20-10);var Y=Math.round(Math.random()*20-10);var Z=Math.random()*.4-.2;var et=Math.random()*.4-.2;var tt=Math.random()*1+1;var nt=Math.random()*1+1;TweenLite.fromTo(i.find(".tp-half-one"),N/1e3,{width:D,height:P/2,position:"absolute",top:"0px",left:"0px",transformPerspective:600,transformOrigin:"center top"},{scale:tt,rotation:K,y:0-P-P/4,ease:Power2.easeInOut});setTimeout(function(){TweenLite.set(i.find(".tp-half-one"),{overflow:"hidden"})},50);TweenLite.fromTo(i.find(".tp-half-one"),N/2e3,{opacity:1,transformPerspective:600,transformOrigin:"center center"},{opacity:0,delay:N/2e3});TweenLite.fromTo(i.find(".tp-half-two"),N/1e3,{width:D,height:P,overflow:"hidden",position:"absolute",top:P/2,left:"0px",transformPerspective:600,transformOrigin:"center bottom"},{scale:nt,rotation:G,y:P+P/4,ease:Power2.easeInOut});TweenLite.fromTo(i.find(".tp-half-two"),N/2e3,{opacity:1,transformPerspective:600,transformOrigin:"center center"},{opacity:0,delay:N/2e3});if(i.html()!=null)TweenLite.fromTo(u,(N-200)/1e3,{opacity:0,scale:.8,x:r.width*Z,y:P*et,rotation:Y,transformPerspective:600,transformOrigin:"center center"},{rotation:0,scale:1,x:0,y:0,opacity:1,ease:Power2.easeInOut});f.find(".defaultimg").css({opacity:1});setTimeout(function(){i.css({position:"absolute","z-index":18});u.css({position:"absolute","z-index":20});f.find(".defaultimg").css({opacity:1});a.find(".defaultimg").css({opacity:0});if(i.find(".tp-half-one").length>0){i.find(".tp-half-one .defaultimg").unwrap();i.find(".tp-half-one .slotholder").unwrap()}i.find(".tp-half-two").remove();r.transition=0;r.act=r.next},N);u.css({opacity:1})}if(l==17){f.find(".defaultimg").css({opacity:0});f.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/800,{opacity:0,rotationY:0,scale:.9,rotationX:-110,transformPerspective:600,transformOrigin:"center center"},{opacity:1,top:0,left:0,scale:1,rotation:0,rotationX:0,rotationY:0,ease:Power3.easeOut,delay:t*.06,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}})})}if(l==18){f.find(".defaultimg").css({opacity:0});f.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/500,{opacity:0,rotationY:310,scale:.9,rotationX:10,transformPerspective:600,transformOrigin:"center center"},{opacity:1,top:0,left:0,scale:1,rotation:0,rotationX:0,rotationY:0,ease:Power3.easeOut,delay:t*.06,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}})})}if(l==19||l==22){f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);var rt=u.css("z-index");var it=i.css("z-index");var st=90;var I=1;if(T==1)st=-90;if(l==19){var ot="center center -"+r.height/2;I=0}else{var ot="center center "+r.height/2}TweenLite.fromTo(f,N/2e3,{transformPerspective:600,z:0,x:0,rotationY:0},{rotationY:1,ease:Power1.easeInOut,z:-40});TweenLite.fromTo(f,N/2e3,{transformPerspective:600,z:-40,rotationY:1},{rotationY:0,z:0,ease:Power1.easeInOut,x:0,delay:3*(N/4e3)});TweenLite.fromTo(a,N/2e3,{transformPerspective:600,z:0,x:0,rotationY:0},{rotationY:1,x:0,ease:Power1.easeInOut,z:-40});TweenLite.fromTo(a,N/2e3,{transformPerspective:600,z:-40,x:0,rotationY:1},{rotationY:0,z:0,x:0,ease:Power1.easeInOut,delay:3*(N/4e3)});f.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/1e3,{left:0,rotationY:r.rotate,opacity:I,top:0,scale:.8,transformPerspective:600,transformOrigin:ot,rotationX:st},{left:0,rotationY:0,opacity:1,top:0,z:0,scale:1,rotationX:0,delay:t*50/1e3,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.1,{opacity:1,delay:t*50/1e3+N/3e3})});a.find(".slotslide").each(function(t){var s=e(this);var o=-90;if(T==1)o=90;TweenLite.fromTo(s,N/1e3,{opacity:1,rotationY:0,top:0,z:0,scale:1,transformPerspective:600,transformOrigin:ot,rotationX:0},{opacity:1,rotationY:r.rotate,top:0,scale:.8,rotationX:o,delay:t*50/1e3,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.1,{opacity:0,delay:t*50/1e3+(N/1e3-N/1e4)})})}if(l==20){f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);var rt=u.css("z-index");var it=i.css("z-index");if(T==1){var ut=-r.width;var st=70;var ot="left center -"+r.height/2}else{var ut=r.width;var st=-70;var ot="right center -"+r.height/2}f.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/1500,{left:ut,rotationX:40,z:-600,opacity:I,top:0,transformPerspective:600,transformOrigin:ot,rotationY:st},{left:0,delay:t*50/1e3,ease:Power2.easeInOut});TweenLite.fromTo(s,N/1e3,{rotationX:40,z:-600,opacity:I,top:0,scale:1,transformPerspective:600,transformOrigin:ot,rotationY:st},{rotationX:0,opacity:1,top:0,z:0,scale:1,rotationY:0,delay:t*50/1e3,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.1,{opacity:1,delay:t*50/1e3+N/2e3})});a.find(".slotslide").each(function(t){var s=e(this);if(T!=1){var o=-r.width;var l=70;var c="left center -"+r.height/2}else{var o=r.width;var l=-70;var c="right center -"+r.height/2}TweenLite.fromTo(s,N/1e3,{opacity:1,rotationX:0,top:0,z:0,scale:1,left:0,transformPerspective:600,transformOrigin:c,rotationY:0},{opacity:1,rotationX:40,top:0,z:-600,left:o,scale:.8,rotationY:l,delay:t*50/1e3,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.1,{opacity:0,delay:t*50/1e3+(N/1e3-N/1e4)})})}if(l==21||l==25){f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);var rt=u.css("z-index");var it=i.css("z-index");if(T==1){var ut=-r.width;var st=110;if(l==25){var ot="center top 0";rot2=-st;st=r.rotate}else{var ot="left center 0";rot2=r.rotate}}else{var ut=r.width;var st=-110;if(l==25){var ot="center bottom 0";rot2=-st;st=r.rotate}else{var ot="right center 0";rot2=r.rotate}}f.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/1500,{left:0,rotationX:rot2,z:0,opacity:0,top:0,scale:1,transformPerspective:600,transformOrigin:ot,rotationY:st},{left:0,rotationX:0,top:0,z:0,scale:1,rotationY:0,delay:t*100/1e3+N/1e4,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.3,{opacity:1,delay:t*100/1e3+N*.2/2e3+N/1e4})});if(T!=1){var ut=-r.width;var st=90;if(l==25){var ot="center top 0";rot2=-st;st=r.rotate}else{var ot="left center 0";rot2=r.rotate}}else{var ut=r.width;var st=-90;if(l==25){var ot="center bottom 0";rot2=-st;st=r.rotate}else{var ot="right center 0";rot2=r.rotate}}a.find(".slotslide").each(function(t){var n=e(this);TweenLite.fromTo(n,N/3e3,{left:0,rotationX:0,z:0,opacity:1,top:0,scale:1,transformPerspective:600,transformOrigin:ot,rotationY:0},{left:0,rotationX:rot2,top:0,z:0,scale:1,rotationY:st,delay:t*100/1e3,ease:Power1.easeInOut});TweenLite.to(n,.2,{opacity:0,delay:t*50/1e3+(N/3e3-N/1e4)})})}if(l==23||l==24){f.find(".defaultimg").css({opacity:0});setTimeout(function(){a.find(".defaultimg").css({opacity:0})},100);var rt=u.css("z-index");var it=i.css("z-index");var st=-90;if(T==1)st=90;var I=1;if(l==23){var ot="center center -"+r.width/2;I=0}else{var ot="center center "+r.width/2}var at=0;TweenLite.fromTo(f,N/2e3,{transformPerspective:600,z:0,x:0,rotationY:0},{rotationY:1,ease:Power1.easeInOut,z:-90});TweenLite.fromTo(f,N/2e3,{transformPerspective:600,z:-90,rotationY:1},{rotationY:0,z:0,ease:Power1.easeInOut,x:0,delay:3*(N/4e3)});TweenLite.fromTo(a,N/2e3,{transformPerspective:600,z:0,x:0,rotationY:0},{rotationY:1,x:0,ease:Power1.easeInOut,z:-90});TweenLite.fromTo(a,N/2e3,{transformPerspective:600,z:-90,x:0,rotationY:1},{rotationY:0,z:0,x:0,ease:Power1.easeInOut,delay:3*(N/4e3)});f.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/1e3,{left:at,rotationX:r.rotate,opacity:I,top:0,scale:1,transformPerspective:600,transformOrigin:ot,rotationY:st},{left:0,rotationX:0,opacity:1,top:0,z:0,scale:1,rotationY:0,delay:t*50/1e3,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.1,{opacity:1,delay:t*50/1e3+N/3e3})});st=90;if(T==1)st=-90;a.find(".slotslide").each(function(t){var s=e(this);TweenLite.fromTo(s,N/1e3,{left:0,opacity:1,rotationX:0,top:0,z:0,scale:1,transformPerspective:600,transformOrigin:ot,rotationY:0},{left:at,opacity:1,rotationX:r.rotate,top:0,scale:1,rotationY:st,delay:t*50/1e3,ease:Power2.easeInOut,onComplete:function(){if(t==r.slots-1)F(n,r,f,a,u,i)}});TweenLite.to(s,.1,{opacity:0,delay:t*50/1e3+(N/1e3-N/1e4)})})}var ft={};ft.slideIndex=r.next+1;n.trigger("revolution.slide.onchange",ft);setTimeout(function(){n.trigger("revolution.slide.onafterswap")},N);n.trigger("revolution.slide.onvideostop")}function A(e,t){}function O(t,n){t.find(">ul:first-child >li").each(function(){var t=e(this);for(var r=0;r<10;r++)t.find(".rs-parallaxlevel-"+r).wrapAll('<div style="position:absolute;top:0px;left:0px;width:100%;height:100%;" class="tp-parallax-container" data-parallaxlevel="'+n.parallaxLevels[r]+'"></div>')});t.on("mousemove.hoverdir, mouseleave.hoverdir",function(n){console.log("event:"+n.type);switch(n.type){case"mousemove":var r=t.offset().top,i=t.offset().left,s=r+t.height()/2,o=i+t.width()/2,u=o-n.pageX,a=s-n.pageY;e(".tp-parallax-container").each(function(){var t=e(this),n=parseInt(t.data("parallaxlevel"),0)/100,r=u*n,i=a*n;TweenLite.to(t,.2,{x:r,y:i,ease:Power3.easeOut})});break;case"mouseleave":e(".tp-parallax-container").each(function(){var t=e(this);TweenLite.to(t,.4,{x:0,y:0,ease:Power3.easeOut})});break}});window.ondeviceorientation=function(n){var r=Math.round(n.beta||0),i=Math.round(n.gamma||0),s=360/t.width()*i,o=180/t.height()*r;e(".tp-parallax-container").each(function(){var t=e(this),n=parseInt(t.data("parallaxlevel"),0)/100,r=s*n,i=o*n;TweenLite.to(t,.2,{x:r,y:i,ease:Power3.easeOut})})};e(window).bind("deviceorientation",{option:n,cont:t},function(e){var t=e.data.option;var n=e.data.container;if(!t.desktop&&e.beta!==null&&e.gamma!==null){var r=(e.beta||0)/MAGIC_NUMBER;var i=(e.gamma||0)/MAGIC_NUMBER;var s=window.innerHeight>window.innerWidth}})}function M(n,r){try{var i=n.find(">ul:first-child >li:eq("+r.act+")")}catch(s){var i=n.find(">ul:first-child >li:eq(1)")}r.lastslide=r.act;var o=n.find(">ul:first-child >li:eq("+r.next+")");var u=i.find(".slotholder");var a=o.find(".slotholder");a.find(".defaultimg").each(function(){var n=e(this);if(n.data("kenburn")!=t)n.data("kenburn").restart();TweenLite.killTweensOf(n,false);TweenLite.set(n,{scale:1,rotationZ:0});n.data("bgposition",a.data("bgposition"));n.data("currotate",a.data("rotationstart"));n.data("curscale",a.data("bgfit"))})}function _(n,r){try{var i=n.find(">ul:first-child >li:eq("+r.act+")")}catch(s){var i=n.find(">ul:first-child >li:eq(1)")}r.lastslide=r.act;var u=n.find(">ul:first-child >li:eq("+r.next+")");var a=i.find(".slotholder");var f=u.find(".slotholder");var l=f.data("bgposition"),c=f.data("bgpositionend"),h=f.data("zoomstart")/100,p=f.data("zoomend")/100,d=f.data("rotationstart"),v=f.data("rotationend"),m=f.data("bgfit"),g=f.data("bgfitend"),y=f.data("easeme"),b=f.data("duration")/1e3;if(m==t)m=100;if(g==t)g=100;m=D(m,f,r);g=D(g,f,r);if(h==t)h=1;if(p==t)p=1;if(d==t)d=0;if(v==t)v=0;if(h<1)h=1;if(p<1)p=1;f.find(".defaultimg").each(function(){var t=e(this);t.data("kenburn",TweenLite.fromTo(t,b,{transformPerspective:1200,backgroundSize:m,z:0,backgroundPosition:l,rotationZ:d},{yoyo:2,rotationZ:v,ease:y,backgroundSize:g,backgroundPosition:c,onUpdate:function(){t.data("bgposition",t.css("backgroundPosition"));if(!o(8))t.data("currotate",j(t));if(!o(8))t.data("curscale",t.css("backgroundSize"))}}))})}function D(e,t,n){var r=t.data("owidth");var i=t.data("oheight");var s=n.container.width()/r;var o=i*s;var u=o/n.container.height()*e;return e+"% "+u+"%"}function P(e){var t=e.css("-webkit-transform")||e.css("-moz-transform")||e.css("-ms-transform")||e.css("-o-transform")||e.css("transform");return t}function H(e){return e.replace(/^matrix(3d)?\((.*)\)$/,"$2").split(/, /)}function B(e){var t=H(P(e)),n=1;if(t[0]!=="none"){var r=t[0],i=t[1],s=10;n=Math.round(Math.sqrt(r*r+i*i)*s)/s}return n}function j(e){var t=e.css("-webkit-transform")||e.css("-moz-transform")||e.css("-ms-transform")||e.css("-o-transform")||e.css("transform");if(t!=="none"){var n=t.split("(")[1].split(")")[0].split(",");var r=n[0];var i=n[1];var s=Math.round(Math.atan2(i,r)*(180/Math.PI))}else{var s=0}return s<0?s+=360:s}function F(e,t,n,r,i,s){S(e,t);n.find(".defaultimg").css({opacity:1});if(i.index()!=s.index())r.find(".defaultimg").css({opacity:0});t.act=t.next;f(e);if(n.data("kenburns")=="on")_(e,t)}function I(t){var n=t.target.getVideoEmbedCode();var r=e("#"+n.split('id="')[1].split('"')[0]);var i=r.closest(".tp-simpleresponsive");var s=r.parent().data("player");if(t.data==YT.PlayerState.PLAYING){var o=i.find(".tp-bannertimer");var u=o.data("opt");if(r.closest(".tp-caption").data("volume")=="mute")s.mute();u.videoplaying=true;i.trigger("stoptimer");i.trigger("revolution.slide.onvideoplay")}else{var o=i.find(".tp-bannertimer");var u=o.data("opt");if(t.data!=-1){u.videoplaying=false;i.trigger("playtimer");i.trigger("revolution.slide.onvideostop")}}if(t.data==0&&u.nextslideatend==true)u.container.revnext()}function q(e,t,n){if(e.addEventListener)e.addEventListener(t,n,false);else e.attachEvent(t,n,false)}function R(t,n){var r=$f(t);var i=e("#"+t);var s=i.closest(".tp-simpleresponsive");r.addEvent("ready",function(e){if(n)r.api("play");r.addEvent("play",function(e){var t=s.find(".tp-bannertimer");var n=t.data("opt");n.videoplaying=true;s.trigger("stoptimer");if(i.closest(".tp-caption").data("volume")=="mute")r.api("setVolume","0")});r.addEvent("finish",function(e){var t=s.find(".tp-bannertimer");var n=t.data("opt");n.videoplaying=false;s.trigger("playtimer");s.trigger("revolution.slide.onvideoplay");if(n.nextslideatend==true)n.container.revnext()});r.addEvent("pause",function(e){var t=s.find(".tp-bannertimer");var n=t.data("opt");n.videoplaying=false;s.trigger("playtimer");s.trigger("revolution.slide.onvideostop")})})}function U(e,t){var n=t.width();var r=t.height();var i=e.data("mediaAspect");var s=n/r;e.css({position:"absolute"});var o=e.find("video");if(s<i){e.width(r*i).height(r);e.css("top",0).css("left",-(r*i-n)/2).css("height",r)}else{e.width(n).height(n/i);e.css("top",-(n/i-r)/2).css("left",0).css("height",n/i)}}function z(){var e=new Object;e.x=0;e.y=0;e.rotationX=0;e.rotationY=0;e.rotationZ=0;e.scale=1;e.scaleX=1;e.scaleY=1;e.skewX=0;e.skewY=0;e.opacity=0;e.transformOrigin="center, center";e.transformPerspective=400;e.rotation=0;return e}function W(t,n){var r=n.split(";");e.each(r,function(e,n){n=n.split(":");var r=n[0],i=n[1];if(r=="rotationX")t.rotationX=parseInt(i,0);if(r=="rotationY")t.rotationY=parseInt(i,0);if(r=="rotationZ")t.rotationZ=parseInt(i,0);if(r=="rotationZ")t.rotation=parseInt(i,0);if(r=="scaleX")t.scaleX=parseFloat(i);if(r=="scaleY")t.scaleY=parseFloat(i);if(r=="opacity")t.opacity=parseFloat(i);if(r=="skewX")t.skewX=parseInt(i,0);if(r=="skewY")t.skewY=parseInt(i,0);if(r=="x")t.x=parseInt(i,0);if(r=="y")t.y=parseInt(i,0);if(r=="z")t.z=parseInt(i,0);if(r=="transformOrigin")t.transformOrigin=i.toString();if(r=="transformPerspective")t.transformPerspective=parseInt(i,0)});return t}function X(t){var n=t.split("animation:");var r=new Object;r.animation=W(z(),n[1]);var i=n[0].split(";");e.each(i,function(e,t){t=t.split(":");var n=t[0],i=t[1];if(n=="typ")r.typ=i;if(n=="speed")r.speed=parseInt(i,0)/1e3;if(n=="start")r.start=parseInt(i,0)/1e3;if(n=="elementdelay")r.elementdelay=parseFloat(i);if(n=="ease")r.ease=i});return r}function V(n,r,i){var o=0;var u=0;n.find(".tp-caption").each(function(n){o=r.width/2-r.startwidth*r.bw/2;var a=r.bw;var f=r.bh;if(r.fullScreen=="on")u=r.height/2-r.startheight*r.bh/2;if(r.autoHeight=="on")u=r.container.height()/2-r.startheight*r.bh/2;if(u<0)u=0;var l=e(this);var c=0;if(r.width<r.hideCaptionAtLimit&&l.data("captionhidden")=="on"){l.addClass("tp-hidden-caption");c=1}else{if(r.width<r.hideAllCaptionAtLimit||r.width<r.hideAllCaptionAtLilmit){l.addClass("tp-hidden-caption");c=1}else{l.removeClass("tp-hidden-caption")}}if(c==0){if(l.data("linktoslide")!=t&&!l.hasClass("hasclicklistener")){l.addClass("hasclicklistener");l.css({cursor:"pointer"});if(l.data("linktoslide")!="no"){l.click(function(){var t=e(this);var n=t.data("linktoslide");if(n!="next"&&n!="prev"){r.container.data("showus",n);r.container.parent().find(".tp-rightarrow").click()}else if(n=="next")r.container.parent().find(".tp-rightarrow").click();else if(n=="prev")r.container.parent().find(".tp-leftarrow").click()})}}if(o<0)o=0;var h="iframe"+Math.round(Math.random()*1e3+1);if(l.find("iframe").length>0||l.find("video").length>0){if(l.data("autoplayonlyfirsttime")==true||l.data("autoplayonlyfirsttime")=="true"){l.data("autoplay",true)}l.find("iframe").each(function(){var n=e(this);if(s()){var o=n.attr("src");n.attr("src","");n.attr("src",o)}r.nextslideatend=l.data("nextslideatend");if(l.data("thumbimage")!=t&&l.data("thumbimage").length>2&&l.data("autoplay")!=true&&!i){l.find(".tp-thumb-image").remove();l.append('<div class="tp-thumb-image" style="cursor:pointer; position:absolute;top:0px;left:0px;width:100%;height:100%;background-image:url('+l.data("thumbimage")+'); background-size:cover"></div>')}if(n.attr("src").toLowerCase().indexOf("youtube")>=0){if(!n.hasClass("HasListener")){try{n.attr("id",h);var u;var a=setInterval(function(){if(YT!=t)if(typeof YT.Player!=t&&typeof YT.Player!="undefined"){if(l.data("autoplay")==true){u=new YT.Player(h,{events:{onStateChange:I,onReady:function(e){e.target.playVideo()}}})}else u=new YT.Player(h,{events:{onStateChange:I}});n.addClass("HasListener");l.data("player",u);clearInterval(a)}},100)}catch(f){}}else{if(l.data("autoplay")==true){var u=l.data("player");l.data("timerplay",setTimeout(function(){if(l.data("forcerewind")=="on")u.seekTo(0);u.playVideo()},l.data("start")))}}l.find(".tp-thumb-image").click(function(){TweenLite.to(e(this),.3,{opacity:0,ease:Power3.easeInOut,onComplete:function(){l.find(".tp-thumb-image").remove()}});var t=l.data("player");t.playVideo()})}else{if(n.attr("src").toLowerCase().indexOf("vimeo")>=0){if(!n.hasClass("HasListener")){n.addClass("HasListener");n.attr("id",h);var c=n.attr("src");var p={},d=c,v=/([^&=]+)=([^&]*)/g,m;while(m=v.exec(d)){p[decodeURIComponent(m[1])]=decodeURIComponent(m[2])}if(p["player_id"]!=t)c=c.replace(p["player_id"],h);else c=c+"&player_id="+h;try{c=c.replace("api=0","api=1")}catch(f){}c=c+"&api=1";n.attr("src",c);var u=l.find("iframe")[0];var g=setInterval(function(){if($f!=t)if(typeof $f(h).api!=t&&typeof $f(h).api!="undefined"){$f(u).addEvent("ready",function(){R(h,l.data("autoplay"))});clearInterval(g)}},100)}else{if(l.data("autoplay")==true){var n=l.find("iframe");var y=n.attr("id");var g=setInterval(function(){if($f!=t)if(typeof $f(y).api!=t&&typeof $f(y).api!="undefined"){var e=$f(y);l.data("timerplay",setTimeout(function(){if(l.data("forcerewind")=="on")e.api("seekTo",0);e.api("play")},l.data("start")));clearInterval(g)}},100)}}l.find(".tp-thumb-image").click(function(){TweenLite.to(e(this),.3,{opacity:0,ease:Power3.easeInOut,onComplete:function(){l.find(".tp-thumb-image").remove()}});var n=l.find("iframe");var r=n.attr("id");var i=setInterval(function(){if($f!=t)if(typeof $f(r).api!=t&&typeof $f(r).api!="undefined"){var e=$f(r);e.api("play");clearInterval(i)}},100)})}}});if(l.find("video").length>0){l.find("video").each(function(n){var i=e(this);var s=this;if(!i.parent().hasClass("html5vid")){i.wrap('<div class="html5vid" style="position:relative;top:0px;left:0px;width:auto;height:auto"></div>')}var o=e(this).parent();if(s.addEventListener)s.addEventListener("loadedmetadata",function(){o.data("metaloaded",1)});else s.attachEvent("loadedmetadata",function(){o.data("metaloaded",1)});if(!i.hasClass("HasListener")){i.addClass("HasListener");s.addEventListener("play",function(){o.addClass("videoisplaying");o.find(".tp-poster").remove();if(l.data("volume")=="mute")s.muted=true;r.container.trigger("revolution.slide.onvideoplay");r.videoplaying=true;r.container.trigger("stoptimer")});s.addEventListener("pause",function(){o.removeClass("videoisplaying");r.videoplaying=false;r.container.trigger("playtimer");r.container.trigger("revolution.slide.onvideostop")});s.addEventListener("ended",function(){o.removeClass("videoisplaying");r.videoplaying=false;r.container.trigger("playtimer");r.container.trigger("revolution.slide.onvideostop");if(r.nextslideatend==true)r.container.revnext()})}if(i.attr("poster")!=t&&o.find(".tp-poster").length==0)o.append('<div class="tp-poster" style="position:absolute;z-index:1;width:100%;height:100%;top:0px;left:0px;background:url('+i.attr("poster")+'); background-position:center center;background-size:100%;background-repeat:no-repeat;"></div>');if(i.attr("control")==t&&o.find(".tp-video-play-button").length==0){o.append('<div class="tp-video-play-button"><i class="revicon-right-dir"></i><div class="tp-revstop"></div></div>');o.find(".tp-video-play-button").click(function(){if(o.hasClass("videoisplaying"))s.pause();else s.play()})}if(i.attr("control")==t){o.find("video, .tp-poster").click(function(){if(o.hasClass("videoisplaying"))s.pause();else s.play()})}if(l.data("forcecover")==1){U(o,r.container);o.addClass("fullcoveredvideo");l.addClass("fullcoveredvideo")}if(l.data("forcecover")==1||l.hasClass("fullscreenvideo")){o.css({width:"100%",height:"100%"})}var u=false;if(l.data("autoplayonlyfirsttime")==true||l.data("autoplayonlyfirsttime")=="true")u=true;clearInterval(o.data("interval"));o.data("interval",setInterval(function(){if(o.data("metaloaded")==1||s.duration!=NaN){clearInterval(o.data("interval"));if(l.data("dottedoverlay")!="none"&&l.data("dottedoverlay")!=t)if(l.find(".tp-dottedoverlay").length!=1)o.append('<div class="tp-dottedoverlay '+l.data("dottedoverlay")+'"></div>');var n=16/9;if(l.data("aspectratio")=="4:3")n=4/3;o.data("mediaAspect",n);if(o.closest(".tp-caption").data("forcecover")==1){U(o,r.container);o.addClass("fullcoveredvideo")}i.css({display:"block"});r.nextslideatend=l.data("nextslideatend");if(l.data("autoplay")==true||u==true){var a=e("body").find("#"+r.container.attr("id")).find(".tp-bannertimer");setTimeout(function(){r.videoplaying=true;r.container.trigger("stoptimer")},200);if(l.data("forcerewind")=="on"&&!o.hasClass("videoisplaying"))if(s.currentTime>0)s.currentTime=0;if(l.data("volume")=="mute")s.muted=true;o.data("timerplay",setTimeout(function(){if(l.data("forcerewind")=="on"&&!o.hasClass("videoisplaying"))if(s.currentTime>0)s.currentTime=0;if(l.data("volume")=="mute")s.muted=true;setTimeout(function(){s.play()},500)},10+l.data("start")))}if(o.data("ww")==t)o.data("ww",i.attr("width"));if(o.data("hh")==t)o.data("hh",i.attr("height"));if(!l.hasClass("fullscreenvideo")&&l.data("forcecover")==1){try{o.width(o.data("ww")*r.bw);o.height(o.data("hh")*r.bh)}catch(f){}}clearInterval(o.data("interval"))}}),100)})}if(l.data("autoplay")==true){var p=e("body").find("#"+r.container.attr("id")).find(".tp-bannertimer");setTimeout(function(){r.videoplaying=true;r.container.trigger("stoptimer")},200);r.videoplaying=true;r.container.trigger("stoptimer");if(l.data("autoplayonlyfirsttime")==true||l.data("autoplayonlyfirsttime")=="true"){l.data("autoplay",false);l.data("autoplayonlyfirsttime",false)}}}var d=0;var v=0;if(l.find("img").length>0){var m=l.find("img");if(m.data("ww")==t)m.data("ww",m.width());if(m.data("hh")==t)m.data("hh",m.height());var g=m.data("ww");var y=m.data("hh");m.width(g*r.bw);m.height(y*r.bh);d=m.width();v=m.height()}else{if(l.find("iframe").length>0||l.find("video").length>0){var b=false;var m=l.find("iframe");if(m.length==0){m=l.find("video");b=true}m.css({display:"block"});if(l.data("ww")==t)l.data("ww",m.width());if(l.data("hh")==t)l.data("hh",m.height());var g=l.data("ww");var y=l.data("hh");var w=l;if(w.data("fsize")==t)w.data("fsize",parseInt(w.css("font-size"),0)||0);if(w.data("pt")==t)w.data("pt",parseInt(w.css("paddingTop"),0)||0);if(w.data("pb")==t)w.data("pb",parseInt(w.css("paddingBottom"),0)||0);if(w.data("pl")==t)w.data("pl",parseInt(w.css("paddingLeft"),0)||0);if(w.data("pr")==t)w.data("pr",parseInt(w.css("paddingRight"),0)||0);if(w.data("mt")==t)w.data("mt",parseInt(w.css("marginTop"),0)||0);if(w.data("mb")==t)w.data("mb",parseInt(w.css("marginBottom"),0)||0);if(w.data("ml")==t)w.data("ml",parseInt(w.css("marginLeft"),0)||0);if(w.data("mr")==t)w.data("mr",parseInt(w.css("marginRight"),0)||0);if(w.data("bt")==t)w.data("bt",parseInt(w.css("borderTop"),0)||0);if(w.data("bb")==t)w.data("bb",parseInt(w.css("borderBottom"),0)||0);if(w.data("bl")==t)w.data("bl",parseInt(w.css("borderLeft"),0)||0);if(w.data("br")==t)w.data("br",parseInt(w.css("borderRight"),0)||0);if(w.data("lh")==t)w.data("lh",parseInt(w.css("lineHeight"),0)||0);var E=r.width;var S=r.height;if(E>r.startwidth)E=r.startwidth;if(S>r.startheight)S=r.startheight;if(!l.hasClass("fullscreenvideo"))l.css({"font-size":w.data("fsize")*r.bw+"px","padding-top":w.data("pt")*r.bh+"px","padding-bottom":w.data("pb")*r.bh+"px","padding-left":w.data("pl")*r.bw+"px","padding-right":w.data("pr")*r.bw+"px","margin-top":w.data("mt")*r.bh+"px","margin-bottom":w.data("mb")*r.bh+"px","margin-left":w.data("ml")*r.bw+"px","margin-right":w.data("mr")*r.bw+"px","border-top":w.data("bt")*r.bh+"px","border-bottom":w.data("bb")*r.bh+"px","border-left":w.data("bl")*r.bw+"px","border-right":w.data("br")*r.bw+"px","line-height":w.data("lh")*r.bh+"px",height:y*r.bh+"px"});else{o=0;u=0;l.data("x",0);l.data("y",0);var x=r.height;if(r.autoHeight=="on")x=r.container.height();l.css({width:r.width,height:x})}if(b==false){m.width(g*r.bw);m.height(y*r.bh)}else if(l.data("forcecover")!=1&&!l.hasClass("fullscreenvideo")){m.width(g*r.bw);m.height(y*r.bh)}d=m.width();v=m.height()}else{l.find(".tp-resizeme, .tp-resizeme *").each(function(){K(e(this),r)});if(l.hasClass("tp-resizeme")){l.find("*").each(function(){K(e(this),r)})}K(l,r);v=l.outerHeight(true);d=l.outerWidth(true);var T=l.outerHeight();var N=l.css("backgroundColor");l.find(".frontcorner").css({borderWidth:T+"px",left:0-T+"px",borderRight:"0px solid transparent",borderTopColor:N});l.find(".frontcornertop").css({borderWidth:T+"px",left:0-T+"px",borderRight:"0px solid transparent",borderBottomColor:N});l.find(".backcorner").css({borderWidth:T+"px",right:0-T+"px",borderLeft:"0px solid transparent",borderBottomColor:N});l.find(".backcornertop").css({borderWidth:T+"px",right:0-T+"px",borderLeft:"0px solid transparent",borderTopColor:N})}}if(r.fullScreenAlignForce=="on"){o=0;u=0}if(l.data("voffset")==t)l.data("voffset",0);if(l.data("hoffset")==t)l.data("hoffset",0);var C=l.data("voffset")*a;var k=l.data("hoffset")*a;var L=r.startwidth*a;var A=r.startheight*a;if(r.fullScreenAlignForce=="on"){L=r.container.width();A=r.container.height()}if(l.data("x")=="center"||l.data("xcenter")=="center"){l.data("xcenter","center");l.data("x",L/2-l.outerWidth(true)/2+k)}if(l.data("x")=="left"||l.data("xleft")=="left"){l.data("xleft","left");l.data("x",0/a+k)}if(l.data("x")=="right"||l.data("xright")=="right"){l.data("xright","right");l.data("x",(L-l.outerWidth(true)+k)/a)}if(l.data("y")=="center"||l.data("ycenter")=="center"){l.data("ycenter","center");l.data("y",A/2-l.outerHeight(true)/2+C)}if(l.data("y")=="top"||l.data("ytop")=="top"){l.data("ytop","top");l.data("y",0/r.bh+C)}if(l.data("y")=="bottom"||l.data("ybottom")=="bottom"){l.data("ybottom","bottom");l.data("y",(A-l.outerHeight(true)+C)/a)}if(l.data("start")==t)l.data("start",1e3);var O=l.data("easing");if(O==t)O="Power1.easeOut";var M=l.data("start")/1e3;var _=l.data("speed")/1e3;if(l.data("x")=="center"||l.data("xcenter")=="center")var D=l.data("x")+o;else{var D=a*l.data("x")+o}if(l.data("y")=="center"||l.data("ycenter")=="center")var P=l.data("y")+u;else{var P=r.bh*l.data("y")+u}TweenLite.set(l,{top:P,left:D,overwrite:"auto"});if(!i){if(l.data("timeline")!=t)l.data("timeline").clear();function H(){setTimeout(function(){l.css({transform:"none","-moz-transform":"none","-webkit-transform":"none"})},100)}function B(){l.data("timer",setTimeout(function(){if(l.hasClass("fullscreenvideo"))l.css({display:"block"})},l.data("start")))}var j=new TimelineLite({smoothChildTiming:true,onStart:B});if(r.fullScreenAlignForce=="on"){}var F=l;if(l.data("mySplitText")!=t)l.data("mySplitText").revert();if(l.data("splitin")=="chars"||l.data("splitin")=="words"||l.data("splitin")=="lines"||l.data("splitout")=="chars"||l.data("splitout")=="words"||l.data("splitout")=="lines"){if(l.find("a").length>0)l.data("mySplitText",new SplitText(l.find("a"),{type:"lines,words,chars",charsClass:"tp-splitted",wordsClass:"tp-splitted",linesClass:"tp-splitted"}));else l.data("mySplitText",new SplitText(l,{type:"lines,words,chars",charsClass:"tp-splitted",wordsClass:"tp-splitted",linesClass:"tp-splitted"}));l.addClass("splitted")}if(l.data("splitin")=="chars")F=l.data("mySplitText").chars;if(l.data("splitin")=="words")F=l.data("mySplitText").words;if(l.data("splitin")=="lines")F=l.data("mySplitText").lines;var q=z();var V=z();if(l.data("repeat")!=t)repeatV=l.data("repeat");if(l.data("yoyo")!=t)yoyoV=l.data("yoyo");if(l.data("repeatdelay")!=t)repeatdelayV=l.data("repeatdelay");if(l.hasClass("customin"))q=W(q,l.data("customin"));else if(l.hasClass("randomrotate")){q.scale=Math.random()*3+1;q.rotation=Math.round(Math.random()*200-100);q.x=Math.round(Math.random()*200-100);q.y=Math.round(Math.random()*200-100)}else if(l.hasClass("lfr")||l.hasClass("skewfromright"))q.x=15+r.width;else if(l.hasClass("lfl")||l.hasClass("skewfromleft"))q.x=-15-d;else if(l.hasClass("sfl")||l.hasClass("skewfromleftshort"))q.x=-50;else if(l.hasClass("sfr")||l.hasClass("skewfromrightshort"))q.x=50;else if(l.hasClass("lft"))q.y=-25-v;else if(l.hasClass("lfb"))q.y=25+r.height;else if(l.hasClass("sft"))q.y=-50;else if(l.hasClass("sfb"))q.y=50;if(l.hasClass("skewfromright")||l.hasClass("skewfromrightshort"))q.skewX=-85;else if(l.hasClass("skewfromleft")||l.hasClass("skewfromleftshort"))q.skewX=85;if(l.hasClass("fade")||l.hasClass("sft")||l.hasClass("sfl")||l.hasClass("sfb")||l.hasClass("skewfromleftshort")||l.hasClass("sfr")||l.hasClass("skewfromrightshort"))q.opacity=0;if($().toLowerCase()=="safari"){q.rotationX=0;q.rotationY=0}var J=l.data("elementdelay")==t?0:l.data("elementdelay");V.ease=q.ease=l.data("easing")==t?Power1.easeInOut:l.data("easing");q.data=new Object;q.data.oldx=q.x;q.data.oldy=q.y;V.data=new Object;V.data.oldx=V.x;V.data.oldy=V.y;q.x=q.x*a;q.y=q.y*a;var Q=new TimelineLite;if(l.hasClass("customin")){if(F!=l)j.add(TweenLite.set(l,{opacity:1,scaleX:1,scaleY:1,rotationX:0,rotationY:0,rotationZ:0,skewX:0,skewY:0,z:0,x:0,y:0,visibility:"visible",opacity:1,delay:0,overwrite:"all"}));q.visibility="hidden";V.visibility="visible";V.overwrite="all";V.opacity=1;V.onComplete=H();V.delay=M;j.add(Q.staggerFromTo(F,_,q,V,J),"frame0")}else{q.visibility="visible";q.transformPerspective=600;if(F!=l)j.add(TweenLite.set(l,{opacity:1,scaleX:1,scaleY:1,rotationX:0,rotationY:0,rotationZ:0,skewX:0,skewY:0,z:0,x:0,y:0,visibility:"visible",opacity:1,delay:0,overwrite:"all"}));V.visibility="visible";V.delay=M;V.onComplete=H();V.opacity=1;if(l.hasClass("randomrotate")&&F!=l){for(var n=0;n<F.length;n++){var Z=new Object;var et=new Object;e.extend(Z,q);e.extend(et,V);q.scale=Math.random()*3+1;q.rotation=Math.round(Math.random()*200-100);q.x=Math.round(Math.random()*200-100);q.y=Math.round(Math.random()*200-100);if(n!=0)et.delay=M+n*J;j.append(TweenLite.fromTo(F[n],_,Z,et),"frame0")}}else j.add(Q.staggerFromTo(F,_,q,V,J),"frame0")}l.data("timeline",j);var tt=new Array;if(l.data("frames")!=t){var nt=l.data("frames");nt=nt.replace(/\s+/g,"");nt=nt.replace("{","");var rt=nt.split("}");e.each(rt,function(e,t){if(t.length>0){var n=X(t);G(l,r,n,"frame"+(e+10),a)}})}j=l.data("timeline");if(l.data("end")!=t){Y(l,r,l.data("end")/1e3,q,"frame99",a)}else{Y(l,r,999999,q,"frame99",a)}j=l.data("timeline");l.data("timeline",j)}}if(i){if(l.data("timeline")!=t){var it=l.data("timeline").getTweensOf();e.each(it,function(e,n){if(n.vars.data!=t){var r=n.vars.data.oldx*a;var i=n.vars.data.oldy*a;if(n.progress()!=1&&n.progress()!=0){try{n.vars.x=r;n.vary.y=i}catch(s){}}else{if(n.progress()==1){TweenLite.set(n.target,{x:r,y:i})}}}})}}});var a=e("body").find("#"+r.container.attr("id")).find(".tp-bannertimer");a.data("opt",r)}function $(){var e=navigator.appName,t=navigator.userAgent,n;var r=t.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);if(r&&(n=t.match(/version\/([\.\d]+)/i))!=null)r[2]=n[1];r=r?[r[1],r[2]]:[e,navigator.appVersion,"-?"];return r[0]}function J(){var e=navigator.appName,t=navigator.userAgent,n;var r=t.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\.?\d+(\.\d+)*)/i);if(r&&(n=t.match(/version\/([\.\d]+)/i))!=null)r[2]=n[1];r=r?[r[1],r[2]]:[e,navigator.appVersion,"-?"];return r[1]}function K(e,n){if(e.data("fsize")==t)e.data("fsize",parseInt(e.css("font-size"),0)||0);if(e.data("pt")==t)e.data("pt",parseInt(e.css("paddingTop"),0)||0);if(e.data("pb")==t)e.data("pb",parseInt(e.css("paddingBottom"),0)||0);if(e.data("pl")==t)e.data("pl",parseInt(e.css("paddingLeft"),0)||0);if(e.data("pr")==t)e.data("pr",parseInt(e.css("paddingRight"),0)||0);if(e.data("mt")==t)e.data("mt",parseInt(e.css("marginTop"),0)||0);if(e.data("mb")==t)e.data("mb",parseInt(e.css("marginBottom"),0)||0);if(e.data("ml")==t)e.data("ml",parseInt(e.css("marginLeft"),0)||0);if(e.data("mr")==t)e.data("mr",parseInt(e.css("marginRight"),0)||0);if(e.data("bt")==t)e.data("bt",parseInt(e.css("borderTopWidth"),0)||0);if(e.data("bb")==t)e.data("bb",parseInt(e.css("borderBottomWidth"),0)||0);if(e.data("bl")==t)e.data("bl",parseInt(e.css("borderLeftWidth"),0)||0);if(e.data("br")==t)e.data("br",parseInt(e.css("borderRightWidth"),0)||0);if(e.data("ls")==t)e.data("ls",parseInt(e.css("letterSpacing"),0)||0);if(e.data("lh")==t)e.data("lh",parseInt(e.css("lineHeight"),0)||0);if(e.data("minwidth")==t)e.data("minwidth",parseInt(e.css("minWidth"),0)||0);if(e.data("minheight")==t)e.data("minheight",parseInt(e.css("minHeight"),0)||0);if(e.data("maxwidth")==t)e.data("maxwidth",parseInt(e.css("maxWidth"),0)||"none");if(e.data("maxheight")==t)e.data("maxheight",parseInt(e.css("maxHeight"),0)||"none");if(e.data("wan")==t)e.data("wan",e.css("-webkit-transition"));if(e.data("moan")==t)e.data("moan",e.css("-moz-animation-transition"));if(e.data("man")==t)e.data("man",e.css("-ms-animation-transition"));if(e.data("ani")==t)e.data("ani",e.css("transition"));if(!e.hasClass("tp-splitted")){e.css("-webkit-transition","none");e.css("-moz-transition","none");e.css("-ms-transition","none");e.css("transition","none");TweenLite.set(e,{fontSize:Math.round(e.data("fsize")*n.bw)+"px",letterSpacing:Math.floor(e.data("ls")*n.bw)+"px",paddingTop:Math.round(e.data("pt")*n.bh)+"px",paddingBottom:Math.round(e.data("pb")*n.bh)+"px",paddingLeft:Math.round(e.data("pl")*n.bw)+"px",paddingRight:Math.round(e.data("pr")*n.bw)+"px",marginTop:e.data("mt")*n.bh+"px",marginBottom:e.data("mb")*n.bh+"px",marginLeft:e.data("ml")*n.bw+"px",marginRight:e.data("mr")*n.bw+"px",borderTopWidth:Math.round(e.data("bt")*n.bh)+"px",borderBottomWidth:Math.round(e.data("bb")*n.bh)+"px",borderLeftWidth:Math.round(e.data("bl")*n.bw)+"px",borderRightWidth:Math.round(e.data("br")*n.bw)+"px",lineHeight:Math.round(e.data("lh")*n.bh)+"px",minWidth:e.data("minwidth")*n.bw+"px",minHeight:e.data("minheight")*n.bh+"px",overwrite:"auto"});setTimeout(function(){e.css("-webkit-transition",e.data("wan"));e.css("-moz-transition",e.data("moan"));e.css("-ms-transition",e.data("man"));e.css("transition",e.data("ani"))},30);if(e.data("maxheight")!="none")e.css({maxHeight:e.data("maxheight")*n.bh+"px"});if(e.data("maxwidth")!="none")e.css({maxWidth:e.data("maxwidth")*n.bw+"px"})}}function Q(t,n){t.find(".tp-caption").each(function(t){var n=e(this);if(n.find("iframe").length>0){try{var r=n.find("iframe");var i=r.attr("id");var s=$f(i);s.api("pause");clearTimeout(n.data("timerplay"))}catch(o){}try{var u=n.data("player");u.stopVideo();clearTimeout(n.data("timerplay"))}catch(o){}}if(n.find("video").length>0){try{n.find("video").each(function(t){var n=e(this).parent();var r=n.attr("id");clearTimeout(n.data("timerplay"));var i=this;i.pause()})}catch(o){}}try{var a=n.data("timeline");var f=a.getLabelTime("frame99");var l=a.time();if(f>l){var c=a.getTweensOf(n);e.each(c,function(e,t){if(e!=0)t.pause()});if(n.css("opacity")!=0)a.play("frame99");else a.progress(1,false)}}catch(o){}})}function G(e,n,r,i,s){var o=e.data("timeline");var u=new TimelineLite;var a=e;if(r.typ=="chars")a=e.data("mySplitText").chars;else if(r.typ=="words")a=e.data("mySplitText").words;else if(r.typ=="lines")a=e.data("mySplitText").lines;r.animation.ease=r.ease;if(r.animation.rotationZ!=t)r.animation.rotation=r.animation.rotationZ;r.animation.data=new Object;r.animation.data.oldx=r.animation.x;r.animation.data.oldy=r.animation.y;r.animation.x=r.animation.x*s;r.animation.y=r.animation.y*s;o.add(u.staggerTo(a,r.speed,r.animation,r.elementdelay),r.start);o.addLabel(i,r.start);e.data("timeline",o)}function Y(e,n,r,i,s,o){var u=e.data("timeline");var a=new TimelineLite;var f=z();var l=e.data("endspeed")==t?e.data("speed"):e.data("endspeed");f.ease=e.data("endeasing")==t?Power1.easeInOut:e.data("endeasing");l=l/1e3;if(e.hasClass("ltr")||e.hasClass("ltl")||e.hasClass("str")||e.hasClass("stl")||e.hasClass("ltt")||e.hasClass("ltb")||e.hasClass("stt")||e.hasClass("stb")||e.hasClass("skewtoright")||e.hasClass("skewtorightshort")||e.hasClass("skewtoleft")||e.hasClass("skewtoleftshort")||e.hasClass("fadeout")||e.hasClass("randomrotateout")){if(e.hasClass("skewtoright")||e.hasClass("skewtorightshort"))f.skewX=35;else if(e.hasClass("skewtoleft")||e.hasClass("skewtoleftshort"))f.skewX=-35;if(e.hasClass("ltr")||e.hasClass("skewtoright"))f.x=n.width+60;else if(e.hasClass("ltl")||e.hasClass("skewtoleft"))f.x=0-(n.width+60);else if(e.hasClass("ltt"))f.y=0-(n.height+60);else if(e.hasClass("ltb"))f.y=n.height+60;else if(e.hasClass("str")||e.hasClass("skewtorightshort")){f.x=50;f.opacity=0}else if(e.hasClass("stl")||e.hasClass("skewtoleftshort")){f.x=-50;f.opacity=0}else if(e.hasClass("stt")){f.y=-50;f.opacity=0}else if(e.hasClass("stb")){f.y=50;f.opacity=0}else if(e.hasClass("randomrotateout")){f.x=Math.random()*n.width;f.y=Math.random()*n.height;f.scale=Math.random()*2+.3;f.rotation=Math.random()*360-180;f.opacity=0}else if(e.hasClass("fadeout")){f.opacity=0}if(e.hasClass("skewtorightshort"))f.x=270;else if(e.hasClass("skewtoleftshort"))f.x=-270;f.data=new Object;f.data.oldx=f.x;f.data.oldy=f.y;f.x=f.x*o;f.y=f.y*o;f.overwrite="auto";var c=e;var c=e;if(e.data("splitout")=="chars")c=e.data("mySplitText").chars;else if(e.data("splitout")=="words")c=e.data("mySplitText").words;else if(e.data("splitout")=="lines")c=e.data("mySplitText").lines;var h=e.data("endelementdelay")==t?0:e.data("endelementdelay");u.add(a.staggerTo(c,l,f,h),r)}else if(e.hasClass("customout")){f=W(f,e.data("customout"));var c=e;if(e.data("splitout")=="chars")c=e.data("mySplitText").chars;else if(e.data("splitout")=="words")c=e.data("mySplitText").words;else if(e.data("splitout")=="lines")c=e.data("mySplitText").lines;var h=e.data("endelementdelay")==t?0:e.data("endelementdelay");f.onStart=function(){TweenLite.set(e,{transformPerspective:f.transformPerspective,transformOrigin:f.transformOrigin,overwrite:"auto"})};f.data=new Object;f.data.oldx=f.x;f.data.oldy=f.y;f.x=f.x*o;f.y=f.y*o;u.add(a.staggerTo(c,l,f,h),r)}else{i.delay=0;u.add(TweenLite.to(e,l,i),r)}u.addLabel(s,r);e.data("timeline",u)}function Z(t,n){t.children().each(function(){try{e(this).die("click")}catch(t){}try{e(this).die("mouseenter")}catch(t){}try{e(this).die("mouseleave")}catch(t){}try{e(this).unbind("hover")}catch(t){}});try{t.die("click","mouseenter","mouseleave")}catch(r){}clearInterval(n.cdint);t=null}function et(n,r){r.cd=0;r.loop=0;if(r.stopAfterLoops!=t&&r.stopAfterLoops>-1)r.looptogo=r.stopAfterLoops;else r.looptogo=9999999;if(r.stopAtSlide!=t&&r.stopAtSlide>-1)r.lastslidetoshow=r.stopAtSlide;else r.lastslidetoshow=999;r.stopLoop="off";if(r.looptogo==0)r.stopLoop="on";if(r.slideamount>1&&!(r.stopAfterLoops==0&&r.stopAtSlide==1)){var i=n.find(".tp-bannertimer");n.on("stoptimer",function(){i.data("tween").pause();if(r.hideTimerBar=="on")i.css({visibility:"hidden"})});n.on("starttimer",function(){if(r.conthover!=1&&r.videoplaying!=true&&r.width>r.hideSliderAtLimit&&r.bannertimeronpause!=true&&r.overnav!=true)if(r.stopLoop=="on"&&r.next==r.lastslidetoshow-1){}else{i.css({visibility:"visible"});i.data("tween").play()}if(r.hideTimerBar=="on")i.css({visibility:"hidden"})});n.on("restarttimer",function(){if(r.stopLoop=="on"&&r.next==r.lastslidetoshow-1){}else{i.css({visibility:"visible"});i.data("tween",TweenLite.fromTo(i,r.delay/1e3,{width:"0%"},{width:"100%",ease:Linear.easeNone,onComplete:o,delay:1}))}if(r.hideTimerBar=="on")i.css({visibility:"hidden"})});n.on("nulltimer",function(){i.data("tween").pause(0);if(r.hideTimerBar=="on")i.css({visibility:"hidden"})});function o(){if(e("body").find(n).length==0){Z(n,r);clearInterval(r.cdint)}if(n.data("conthover-changed")==1){r.conthover=n.data("conthover");n.data("conthover-changed",0)}r.act=r.next;r.next=r.next+1;if(r.next>n.find(">ul >li").length-1){r.next=0;r.looptogo=r.looptogo-1;if(r.looptogo<=0){r.stopLoop="on"}}if(r.stopLoop=="on"&&r.next==r.lastslidetoshow-1){n.find(".tp-bannertimer").css({visibility:"hidden"});n.trigger("revolution.slide.onstop")}else{i.data("tween").restart()}C(n,r)}i.data("tween",TweenLite.fromTo(i,r.delay/1e3,{width:"0%"},{width:"100%",ease:Linear.easeNone,onComplete:o,delay:1}));i.data("opt",r);n.hover(function(){if(r.onHoverStop=="on"&&!s()){n.trigger("stoptimer");n.trigger("revolution.slide.onpause");var i=n.find(">ul >li:eq("+r.next+") .slotholder");i.find(".defaultimg").each(function(){var n=e(this);if(n.data("kenburn")!=t)n.data("kenburn").pause()})}},function(){if(n.data("conthover")!=1){n.trigger("revolution.slide.onresume");n.trigger("starttimer");var i=n.find(">ul >li:eq("+r.next+") .slotholder");i.find(".defaultimg").each(function(){var n=e(this);if(n.data("kenburn")!=t)n.data("kenburn").play()})}})}}e.fn.extend({revolution:function(i){e.fn.revolution.defaults={delay:9e3,startheight:500,startwidth:960,fullScreenAlignForce:"off",autoHeight:"off",hideTimerBar:"off",hideThumbs:200,hideNavDelayOnMobile:1500,thumbWidth:100,thumbHeight:50,thumbAmount:3,navigationType:"bullet",navigationArrows:"solo",hideThumbsOnMobile:"off",hideBulletsOnMobile:"off",hideArrowsOnMobile:"off",hideThumbsUnderResoluition:0,navigationStyle:"round",navigationHAlign:"center",navigationVAlign:"bottom",navigationHOffset:0,navigationVOffset:20,soloArrowLeftHalign:"left",soloArrowLeftValign:"center",soloArrowLeftHOffset:20,soloArrowLeftVOffset:0,soloArrowRightHalign:"right",soloArrowRightValign:"center",soloArrowRightHOffset:20,soloArrowRightVOffset:0,keyboardNavigation:"on",touchenabled:"on",onHoverStop:"on",stopAtSlide:-1,stopAfterLoops:-1,hideCaptionAtLimit:0,hideAllCaptionAtLimit:0,hideSliderAtLimit:0,shadow:0,fullWidth:"off",fullScreen:"off",minFullScreenHeight:0,fullScreenOffsetContainer:"",dottedOverlay:"none",forceFullWidth:"off",spinner:"spinner0",swipe_velocity:.4,swipe_max_touches:1,swipe_min_touches:1,drag_block_vertical:false,isJoomla:false,parallax:"off",parallaxLevels:[10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85]};i=e.extend({},e.fn.revolution.defaults,i);return this.each(function(){var o=i;o.desktop=!navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i);if(o.fullWidth!="on"&&o.fullScreen!="on")o.autoHeight="off";if(o.fullScreen=="on")o.autoHeight="on";if(o.fullWidth!="on"&&o.fullScreen!="on")forceFulWidth="off";var u=e(this);if(o.fullWidth=="on"&&o.autoHeight=="off")u.css({maxHeight:o.startheight+"px"});if(s()&&o.hideThumbsOnMobile=="on"&&o.navigationType=="thumb")o.navigationType="none";if(s()&&o.hideBulletsOnMobile=="on"&&o.navigationType=="bullet")o.navigationType="none";if(s()&&o.hideBulletsOnMobile=="on"&&o.navigationType=="both")o.navigationType="none";if(s()&&o.hideArrowsOnMobile=="on")o.navigationArrows="none";if(o.forceFullWidth=="on"){var f=u.parent().offset().left;var l=u.parent().css("marginBottom");var m=u.parent().css("marginTop");if(l==t)l=0;if(m==t)m=0;u.parent().wrap('<div style="position:relative;width:100%;height:auto;margin-top:'+m+";margin-bottom:"+l+'" class="forcefullwidth_wrapper_tp_banner"></div>');u.closest(".forcefullwidth_wrapper_tp_banner").append('<div class="tp-fullwidth-forcer" style="width:100%;height:'+u.height()+'px"></div>');u.css({backgroundColor:u.parent().css("backgroundColor"),backgroundImage:u.parent().css("backgroundImage")});u.parent().css({left:0-f+"px",position:"absolute",width:e(window).width()});o.width=e(window).width()}try{if(o.hideThumbsUnderResolution>e(window).width()&&o.hideThumbsUnderResolution!=0){u.parent().find(".tp-bullets.tp-thumbs").css({display:"none"})}else{u.parent().find(".tp-bullets.tp-thumbs").css({display:"block"})}}catch(g){}if(!u.hasClass("revslider-initialised")){u.addClass("revslider-initialised");if(u.attr("id")==t)u.attr("id","revslider-"+Math.round(Math.random()*1e3+5));o.firefox13=false;o.ie=!e.support.opacity;o.ie9=document.documentMode==9;o.origcd=o.delay;var b=e.fn.jquery.split("."),w=parseFloat(b[0]),E=parseFloat(b[1]),S=parseFloat(b[2]||"0");if(w==1&&E<7){u.html('<div style="text-align:center; padding:40px 0px; font-size:20px; color:#992222;"> The Current Version of jQuery:'+b+" <br>Please update your jQuery Version to min. 1.7 in Case you wish to use the Revolution Slider Plugin</div>")}if(w>1)o.ie=false;if(!e.support.transition)e.fn.transition=e.fn.animate;u.find(".caption").each(function(){e(this).addClass("tp-caption")});if(s()){u.find(".tp-caption").each(function(){if(e(this).data("autoplay")==true)e(this).data("autoplay",false)})}var x=0;var T=0;var N=0;var k="http";if(location.protocol==="https:"){k="https"}u.find(".tp-caption iframe").each(function(t){try{if(e(this).attr("src").indexOf("you")>0&&x==0){x=1;var n=document.createElement("script");var r="https";n.src=r+"://www.youtube.com/iframe_api";var i=document.getElementsByTagName("script")[0];var s=true;e("head").find("*").each(function(){if(e(this).attr("src")==r+"://www.youtube.com/iframe_api")s=false});if(s){i.parentNode.insertBefore(n,i)}}}catch(o){}});u.find(".tp-caption iframe").each(function(t){try{if(e(this).attr("src").indexOf("vim")>0&&T==0){T=1;var n=document.createElement("script");n.src=k+"://a.vimeocdn.com/js/froogaloop2.min.js";var r=document.getElementsByTagName("script")[0];var i=true;e("head").find("*").each(function(){if(e(this).attr("src")==k+"://a.vimeocdn.com/js/froogaloop2.min.js")i=false});if(i)r.parentNode.insertBefore(n,r)}}catch(s){}});u.find(".tp-caption video").each(function(t){e(this).removeClass("video-js").removeClass("vjs-default-skin");e(this).attr("preload","");e(this).css({display:"none"})});if(o.shuffle=="on"){for(var L=0;L<u.find(">ul:first-child >li").length;L++){var A=Math.round(Math.random()*u.find(">ul:first-child >li").length);u.find(">ul:first-child >li:eq("+A+")").prependTo(u.find(">ul:first-child"))}}o.slots=4;o.act=-1;o.next=0;if(o.startWithSlide!=t)o.next=o.startWithSlide;var M=n("#")[0];if(M.length<9){if(M.split("slide").length>1){var _=parseInt(M.split("slide")[1],0);if(_<1)_=1;if(_>u.find(">ul:first >li").length)_=u.find(">ul:first >li").length;o.next=_-1}}o.firststart=1;if(o.navigationHOffset==t)o.navOffsetHorizontal=0;if(o.navigationVOffset==t)o.navOffsetVertical=0;u.append('<div class="tp-loader '+o.spinner+'">'+'<div class="dot1"></div>'+'<div class="dot2"></div>'+'<div class="bounce1"></div>'+'<div class="bounce2"></div>'+'<div class="bounce3"></div>'+"</div>");if(u.find(".tp-bannertimer").length==0)u.append('<div class="tp-bannertimer" style="visibility:hidden"></div>');var D=u.find(".tp-bannertimer");if(D.length>0){D.css({width:"0%"})}u.addClass("tp-simpleresponsive");o.container=u;o.slideamount=u.find(">ul:first >li").length;if(u.height()==0)u.height(o.startheight);if(o.startwidth==t||o.startwidth==0)o.startwidth=u.width();if(o.startheight==t||o.startheight==0)o.startheight=u.height();o.width=u.width();o.height=u.height();o.bw=o.startwidth/u.width();o.bh=o.startheight/u.height();if(o.width!=o.startwidth){o.height=Math.round(o.startheight*(o.width/o.startwidth));u.height(o.height)}if(o.shadow!=0){u.parent().append('<div class="tp-bannershadow tp-shadow'+o.shadow+'"></div>');var f=0;if(o.forceFullWidth=="on")f=0-o.container.parent().offset().left;u.parent().find(".tp-bannershadow").css({width:o.width,left:f})}u.find("ul").css({display:"none"});var P=u;u.find("ul").css({display:"block"});y(u,o);if(o.parallax!="off")O(u,o);if(o.slideamount>1)c(u,o);if(o.slideamount>1)a(u,o);if(o.slideamount>1)h(u,o);if(o.keyboardNavigation=="on")p(u,o);d(u,o);if(o.hideThumbs>0)v(u,o);C(u,o);if(o.slideamount>1)et(u,o);setTimeout(function(){u.trigger("revolution.slide.onloaded")},500);e("body").data("rs-fullScreenMode",false);e(window).on("mozfullscreenchange webkitfullscreenchange fullscreenchange",function(){e("body").data("rs-fullScreenMode",!e("body").data("rs-fullScreenMode"));if(e("body").data("rs-fullScreenMode")){setTimeout(function(){e(window).trigger("resize")},200)}});e(window).resize(function(){if(e("body").find(u)!=0)if(o.forceFullWidth=="on"){var t=o.container.closest(".forcefullwidth_wrapper_tp_banner").offset().left;o.container.parent().css({left:0-t+"px",width:e(window).width()})}if(u.outerWidth(true)!=o.width||u.is(":hidden")){r(u,o)}});try{if(o.hideThumbsUnderResoluition!=0&&o.navigationType=="thumb"){if(o.hideThumbsUnderResoluition>e(window).width())e(".tp-bullets").css({display:"none"});else e(".tp-bullets").css({display:"block"})}}catch(g){}u.find(".tp-scrollbelowslider").on("click",function(){var t=0;try{t=e("body").find(o.fullScreenOffsetContainer).height()}catch(n){}try{t=t-e(this).data("scrolloffset")}catch(n){}e("body,html").animate({scrollTop:u.offset().top+u.find(">ul >li").height()-t+"px"},{duration:400})});var H=u.parent();if(e(window).width()<o.hideSliderAtLimit){u.trigger("stoptimer");if(H.css("display")!="none")H.data("olddisplay",H.css("display"));H.css({display:"none"})}}})},revscroll:function(t){return this.each(function(){var n=e(this);e("body,html").animate({scrollTop:n.offset().top+n.find(">ul >li").height()-t+"px"},{duration:400})})},revredraw:function(t){return this.each(function(){var t=e(this);var n=t.parent().find(".tp-bannertimer");var i=n.data("opt");r(t,i)})},revpause:function(t){return this.each(function(){var t=e(this);t.data("conthover",1);t.data("conthover-changed",1);t.trigger("revolution.slide.onpause");var n=t.parent().find(".tp-bannertimer");var r=n.data("opt");r.bannertimeronpause=true;t.trigger("stoptimer")})},revresume:function(t){return this.each(function(){var t=e(this);t.data("conthover",0);t.data("conthover-changed",1);t.trigger("revolution.slide.onresume");var n=t.parent().find(".tp-bannertimer");var r=n.data("opt");r.bannertimeronpause=false;t.trigger("starttimer")})},revnext:function(t){return this.each(function(){var t=e(this);t.parent().find(".tp-rightarrow").click()})},revprev:function(t){return this.each(function(){var t=e(this);t.parent().find(".tp-leftarrow").click()})},revmaxslide:function(t){return e(this).find(">ul:first-child >li").length},revcurrentslide:function(t){var n=e(this);var r=n.parent().find(".tp-bannertimer");var i=r.data("opt");return i.act},revlastslide:function(t){var n=e(this);var r=n.parent().find(".tp-bannertimer");var i=r.data("opt");return i.lastslide},revshowslide:function(t){return this.each(function(){var n=e(this);n.data("showus",t);n.parent().find(".tp-rightarrow").click()})}});var N=function(n,r,i){x(n,0);var s=setInterval(function(){i.bannertimeronpause=true;i.container.trigger("stoptimer");i.cd=0;var o=0;n.find("img, .defaultimg").each(function(t){if(e(this).data("lazydone")!=1){o++}});if(o>0)x(n,o);else{clearInterval(s);if(r!=t)r()}},100)};})(jQuery);(function(e){"use strict";var t=e.GreenSockGlobals||e,n=function(e){var n,r=e.split("."),i=t;for(n=0;r.length>n;n++)i[r[n]]=i=i[r[n]]||{};return i},r=n("com.greensock.utils"),i=function(e){var t=e.nodeType,n="";if(1===t||9===t||11===t){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=i(e)}else if(3===t||4===t)return e.nodeValue;return n},s=document,o=s.defaultView?s.defaultView.getComputedStyle:function(){},u=/([A-Z])/g,a=function(e,t,n,r){var i;return(n=n||o(e,null))?(e=n.getPropertyValue(t.replace(u,"-$1").toLowerCase()),i=e||n.length?e:n[t]):e.currentStyle&&(n=e.currentStyle,i=n[t]),r?i:parseInt(i,10)||0},f=function(e){return e.length&&e[0]&&(e[0].nodeType&&e[0].style&&!e.nodeType||e[0].length&&e[0][0])?!0:!1},l=function(e){var t,n,r,i=[],s=e.length;for(t=0;s>t;t++)if(n=e[t],f(n))for(r=n.length,r=0;n.length>r;r++)i.push(n[r]);else i.push(n);return i},c=")eefec303079ad17405c",h=/(?:<br>|<br\/>|<br \/>)/gi,p=s.all&&!s.addEventListener,d="<div style='position:relative;display:inline-block;"+(p?"*display:inline;*zoom:1;'":"'"),v=function(e){e=e||"";var t=-1!==e.indexOf("++"),n=1;return t&&(e=e.split("++").join("")),function(){return d+(e?" class='"+e+(t?n++:"")+"'>":">")}},m=r.SplitText=t.SplitText=function(e,t){if("string"==typeof e&&(e=m.selector(e)),!e)throw"cannot split a null element.";this.elements=f(e)?l(e):[e],this.chars=[],this.words=[],this.lines=[],this._originals=[],this.vars=t||{},this.split(t)},g=function(e,t,n,r,u){h.test(e.innerHTML)&&(e.innerHTML=e.innerHTML.replace(h,c));var f,l,p,d,m,g,y,b,w,E,S,x,T,N=i(e),C=t.type||t.split||"chars,words,lines",k=-1!==C.indexOf("lines")?[]:null,L=-1!==C.indexOf("words"),A=-1!==C.indexOf("chars"),O="absolute"===t.position||t.absolute===!0,M=O?"&#173; ":" ",_=-999,D=o(e),P=a(e,"paddingLeft",D),H=a(e,"borderBottomWidth",D)+a(e,"borderTopWidth",D),B=a(e,"borderLeftWidth",D)+a(e,"borderRightWidth",D),j=a(e,"paddingTop",D)+a(e,"paddingBottom",D),F=a(e,"paddingLeft",D)+a(e,"paddingRight",D),I=a(e,"textAlign",D,!0),q=e.clientHeight,R=e.clientWidth,U=N.length,z="</div>",W=v(t.wordsClass),X=v(t.charsClass),V=-1!==(t.linesClass||"").indexOf("++"),$=t.linesClass;for(V&&($=$.split("++").join("")),p=W(),d=0;U>d;d++)g=N.charAt(d),")"===g&&N.substr(d,20)===c?(p+=z+"<BR/>",d!==U-1&&(p+=" "+W()),d+=19):" "===g&&" "!==N.charAt(d-1)&&d!==U-1?(p+=z,d!==U-1&&(p+=M+W())):p+=A&&" "!==g?X()+g+"</div>":g;for(e.innerHTML=p+z,m=e.getElementsByTagName("*"),U=m.length,y=[],d=0;U>d;d++)y[d]=m[d];if(k||O)for(d=0;U>d;d++)b=y[d],l=b.parentNode===e,(l||O||A&&!L)&&(w=b.offsetTop,k&&l&&w!==_&&"BR"!==b.nodeName&&(f=[],k.push(f),_=w),O&&(b._x=b.offsetLeft,b._y=w,b._w=b.offsetWidth,b._h=b.offsetHeight),k&&(L!==l&&A||(f.push(b),b._x-=P),l&&d&&(y[d-1]._wordEnd=!0)));for(d=0;U>d;d++)b=y[d],l=b.parentNode===e,"BR"!==b.nodeName?(O&&(S=b.style,L||l||(b._x+=b.parentNode._x,b._y+=b.parentNode._y),S.left=b._x+"px",S.top=b._y+"px",S.position="absolute",S.display="block",S.width=b._w+1+"px",S.height=b._h+"px"),L?l?r.push(b):A&&n.push(b):l?(e.removeChild(b),y.splice(d--,1),U--):!l&&A&&(w=!k&&!O&&b.nextSibling,e.appendChild(b),w||e.appendChild(s.createTextNode(" ")),n.push(b))):k||O?(e.removeChild(b),y.splice(d--,1),U--):L||e.appendChild(b);if(k){for(O&&(E=s.createElement("div"),e.appendChild(E),x=E.offsetWidth+"px",w=E.offsetParent===e?0:e.offsetLeft,e.removeChild(E)),S=e.style.cssText,e.style.cssText="display:none;";e.firstChild;)e.removeChild(e.firstChild);for(T=!O||!L&&!A,d=0;k.length>d;d++){for(f=k[d],E=s.createElement("div"),E.style.cssText="display:block;text-align:"+I+";position:"+(O?"absolute;":"relative;"),$&&(E.className=$+(V?d+1:"")),u.push(E),U=f.length,m=0;U>m;m++)"BR"!==f[m].nodeName&&(b=f[m],E.appendChild(b),T&&(b._wordEnd||L)&&E.appendChild(s.createTextNode(" ")),O&&(0===m&&(E.style.top=b._y+"px",E.style.left=P+w+"px"),b.style.top="0px",w&&(b.style.left=b._x-w+"px")));L||A||(E.innerHTML=i(E).split(String.fromCharCode(160)).join(" ")),O&&(E.style.width=x,E.style.height=b._h+"px"),e.appendChild(E)}e.style.cssText=S}O&&(q>e.clientHeight&&(e.style.height=q-j+"px",q>e.clientHeight&&(e.style.height=q+H+"px")),R>e.clientWidth&&(e.style.width=R-F+"px",R>e.clientWidth&&(e.style.width=R+B+"px")))},y=m.prototype;y.split=function(e){this.isSplit&&this.revert(),this.vars=e||this.vars,this._originals.length=this.chars.length=this.words.length=this.lines.length=0;for(var t=0;this.elements.length>t;t++)this._originals[t]=this.elements[t].innerHTML,g(this.elements[t],this.vars,this.chars,this.words,this.lines);return this.isSplit=!0,this},y.revert=function(){if(!this._originals)throw"revert() call wasn't scoped properly.";for(var e=this._originals.length;--e>-1;)this.elements[e].innerHTML=this._originals[e];return this.chars=[],this.words=[],this.lines=[],this.isSplit=!1,this},m.selector=e.$||e.jQuery||function(t){return e.$?(m.selector=e.$,e.$(t)):s?s.getElementById("#"===t.charAt(0)?t.substr(1):t):t}})(window||{})
/*********************************************************************
* #### Twitter Post Fetcher v10.0 ####
* Coded by Jason Mayes 2013. A present to all the developers out there.
* www.jasonmayes.com
* Please keep this disclaimer with my code if you use it. Thanks. :-)
* Got feedback or questions, ask here: 
* http://www.jasonmayes.com/projects/twitterApi/
* Updates will be posted to this site.
*********************************************************************/
var twitterFetcher=function(){function x(e){return e.replace(/<b[^>]*>(.*?)<\/b>/gi,function(c,e){return e}).replace(/class=".*?"|data-query-source=".*?"|dir=".*?"|rel=".*?"/gi,"")}function p(e,c){for(var g=[],f=RegExp("(^| )"+c+"( |$)"),a=e.getElementsByTagName("*"),h=0,d=a.length;h<d;h++)f.test(a[h].className)&&g.push(a[h]);return g}var y="",l=20,s=!0,k=[],t=!1,q=!0,r=!0,u=null,v=!0,z=!0,w=null,A=!0;return{fetch:function(e,c,g,f,a,h,d,b,m,n){void 0===g&&(g=20);void 0===f&&(s=!0);void 0===a&&(a=
!0);void 0===h&&(h=!0);void 0===d&&(d="default");void 0===b&&(b=!0);void 0===m&&(m=null);void 0===n&&(n=!0);t?k.push({id:e,domId:c,maxTweets:g,enableLinks:f,showUser:a,showTime:h,dateFunction:d,showRt:b,customCallback:m,showInteraction:n}):(t=!0,y=c,l=g,s=f,r=a,q=h,z=b,u=d,w=m,A=n,c=document.createElement("script"),c.type="text/javascript",c.src="//cdn.syndication.twimg.com/widgets/timelines/"+e+"?&lang=en&callback=twitterFetcher.callback&suppress_response_codes=true&rnd="+Math.random(),document.getElementsByTagName("head")[0].appendChild(c))},
callback:function(e){var c=document.createElement("div");c.innerHTML=e.body;"undefined"===typeof c.getElementsByClassName&&(v=!1);e=[];var g=[],f=[],a=[],h=[],d=0;if(v)for(c=c.getElementsByClassName("tweet");d<c.length;){0<c[d].getElementsByClassName("retweet-credit").length?a.push(!0):a.push(!1);if(!a[d]||a[d]&&z)e.push(c[d].getElementsByClassName("e-entry-title")[0]),h.push(c[d].getAttribute("data-tweet-id")),g.push(c[d].getElementsByClassName("p-author")[0]),f.push(c[d].getElementsByClassName("dt-updated")[0]);
d++}else for(c=p(c,"tweet");d<c.length;)e.push(p(c[d],"e-entry-title")[0]),h.push(c[d].getAttribute("data-tweet-id")),g.push(p(c[d],"p-author")[0]),f.push(p(c[d],"dt-updated")[0]),0<p(c[d],"retweet-credit").length?a.push(!0):a.push(!1),d++;e.length>l&&(e.splice(l,e.length-l),g.splice(l,g.length-l),f.splice(l,f.length-l),a.splice(l,a.length-l));c=[];d=e.length;for(a=0;a<d;){if("string"!==typeof u){var b=new Date(f[a].getAttribute("datetime").replace(/-/g,"/").replace("T"," ").split("+")[0]),b=u(b);
f[a].setAttribute("aria-label",b);if(e[a].innerText)if(v)f[a].innerText=b;else{var m=document.createElement("p"),n=document.createTextNode(b);m.appendChild(n);m.setAttribute("aria-label",b);f[a]=m}else f[a].textContent=b}b="";s?(r&&(b+='<div class="user">'+x(g[a].innerHTML)+"</div>"),b+='<p class="tweet">'+x(e[a].innerHTML)+"</p>",q&&(b+='<p class="timePosted">'+f[a].getAttribute("aria-label")+"</p>")):e[a].innerText?(r&&(b+='<p class="user">'+g[a].innerText+"</p>"),b+='<p class="tweet">'+e[a].innerText+
"</p>",q&&(b+='<p class="timePosted">'+f[a].innerText+"</p>")):(r&&(b+='<p class="user">'+g[a].textContent+"</p>"),b+='<p class="tweet">'+e[a].textContent+"</p>",q&&(b+='<p class="timePosted">'+f[a].textContent+"</p>"));A&&(b+='<p class="interact"><a href="https://twitter.com/intent/tweet?in_reply_to='+h[a]+'" class="twitter_reply_icon">Reply</a><a href="https://twitter.com/intent/retweet?tweet_id='+h[a]+'" class="twitter_retweet_icon">Retweet</a><a href="https://twitter.com/intent/favorite?tweet_id='+
h[a]+'" class="twitter_fav_icon">Favorite</a></p>');c.push(b);a++}if(null==w){e=c.length;g=0;f=document.getElementById(y);for(h="<ul>";g<e;)h+="<li>"+c[g]+"</li>",g++;f.innerHTML=h+"</ul>"}else w(c);t=!1;0<k.length&&(twitterFetcher.fetch(k[0].id,k[0].domId,k[0].maxTweets,k[0].enableLinks,k[0].showUser,k[0].showTime,k[0].dateFunction,k[0].showRt,k[0].customCallback,k[0].showInteraction),k.splice(0,1))}}}();
/*
 Sticky-kit v1.0.4 | WTFPL | Leaf Corcoran 2014 | http://leafo.net
*/
(function(){var b,m;b=this.jQuery;m=b(window);b.fn.stick_in_parent=function(e){var u,n,f,p,B,l,C;null==e&&(e={});p=e.sticky_class;u=e.inner_scrolling;f=e.parent;n=e.offset_top;null==n&&(n=0);null==f&&(f=void 0);null==u&&(u=!0);null==p&&(p="is_stuck");B=function(a,e,l,v,y,q,t){var r,z,k,w,c,d,A,x,g,h;if(!a.data("sticky_kit")){a.data("sticky_kit",!0);d=a.parent();null!=f&&(d=d.closest(f));if(!d.length)throw"failed to find stick parent";r=k=!1;g=b("<div />");g.css("position",a.css("position"));A=function(){var c,
b;c=parseInt(d.css("border-top-width"),10);b=parseInt(d.css("padding-top"),10);e=parseInt(d.css("padding-bottom"),10);l=d.offset().top+c+b;v=d.height();c=k?(k=!1,r=!1,a.insertAfter(g).css({position:"",top:"",width:"",bottom:""}).removeClass(p),g.detach(),!0):void 0;y=a.offset().top-parseInt(a.css("margin-top"),10)-n;q=a.outerHeight(!0);t=a.css("float");g.css({width:a.outerWidth(!0),height:q,display:a.css("display"),"vertical-align":a.css("vertical-align"),"float":t});if(c)return h()};A();if(q!==v)return w=
void 0,c=n,h=function(){var b,h,s,f;s=m.scrollTop();null!=w&&(h=s-w);w=s;k?(f=s+q+c>v+l,r&&!f&&(r=!1,a.css({position:"fixed",bottom:"",top:c}).trigger("sticky_kit:unbottom")),s<y&&(k=!1,c=n,"left"!==t&&"right"!==t||a.insertAfter(g),g.detach(),b={position:"",width:"",top:""},a.css(b).removeClass(p).trigger("sticky_kit:unstick")),u&&(b=m.height(),q>b&&!r&&(c-=h,c=Math.max(b-q,c),c=Math.min(n,c),k&&a.css({top:c+"px"})))):s>y&&(k=!0,b={position:"fixed",top:c},b.width="border-box"===a.css("box-sizing")?
a.outerWidth()+"px":a.width()+"px",a.css(b).addClass(p).after(g),"left"!==t&&"right"!==t||g.append(a),a.trigger("sticky_kit:stick"));if(k&&(null==f&&(f=s+q+c>v+l),!r&&f))return r=!0,"static"===d.css("position")&&d.css({position:"relative"}),a.css({position:"absolute",bottom:e,top:"auto"}).trigger("sticky_kit:bottom")},x=function(){A();return h()},z=function(){m.off("scroll",h);b(document.body).off("sticky_kit:recalc",x);a.off("sticky_kit:detach",z);a.removeData("sticky_kit");a.css({position:"",bottom:"",
top:""});d.position("position","");if(k)return a.insertAfter(g).removeClass(p),g.remove()},m.on("touchmove",h),m.on("scroll",h),m.on("resize",x),b(document.body).on("sticky_kit:recalc",x),a.on("sticky_kit:detach",z),setTimeout(h,0)}};l=0;for(C=this.length;l<C;l++)e=this[l],B(b(e));return this}}).call(this);

// JavaScript Document

jQuery(document).ready(function($){
	/* Begin: Show o hide cpanel */
	$('#sns_config_btn').click(function(){
		if(!$(this).hasClass('open')){
			$('#sns_cpanel').animate({
				'left':'-311px'
			}, 200, function(){
				$('#sns_cpanel').show().animate({
					'left':'0px'
				});
			});
			$(this).addClass('open');
			return;
		}else{
			$('#sns_cpanel').animate({
				'left':'0px'
			}, 200, function(){
				$('#sns_cpanel').show().animate({
					'left':'-311px'
				});
			});
			$(this).removeClass('open');
			return;
		}
	});
	/* End: Show o hide cpanel */
});
var TMPL_NAME = 'sns_xsport';

function cPReset(){
	var elems = document.getElementById('sns_cpanel').getElementsByTagName ('*');
	for (i=0;i<elems.length;i++) {
		var el = elems[i]; 
	    if (el.name && (match=el.name.match(/^sns_cfg_(.*)$/))) {
	    	var name = match[1];
	    	createCookie (TMPL_NAME+'_' + name, '', -1);
	    }
	}
	window.location.reload(true);
}

function cPApply () {
	var elems = document.getElementById('sns_cpanel').getElementsByTagName ('*');
	var usersetting = {};
	for (i=0;i<elems.length;i++) {
		var el = elems[i];
	    if (el.name && (match=el.name.match(/^sns_cfg_(.*)$/))) {
	        var name = match[1];
	        var value = '';
	        if (el.tagName.toLowerCase() == 'input' && (el.type.toLowerCase()=='radio' || el.type.toLowerCase()=='checkbox')) {
	        	if (el.checked) value = el.value;
	        } else {
	        	value = el.value;
	        }
			if(trim(value)){
				if (usersetting[name]) {
					if (value) usersetting[name] = value + ',' + usersetting[name];
				} else {
					usersetting[name] = value;
				}
			}
	    }
	}
	for (var k in usersetting) {
		name = TMPL_NAME + '_' + k; //alert(name);
		value = usersetting[k];
		createCookie(name, value, 0);
	}
	window.location.reload(true);
}

jQuery.cookie = function(name, value, options) {
	if (typeof value != 'undefined') { // name and value given, set cookie
		options = options || {};
		if (value === null) {
			value = '';
			options.expires = -1;
		}
		var expires = '';
		if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
			var date;
			if (typeof options.expires == 'number') {
				date = new Date();
				date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
			} else {
				date = options.expires;
			}
			expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
		}
		// CAUTION: Needed to parenthesize options.path and options.domain
		// in the following expressions, otherwise they evaluate to undefined
		// in the packed version for some reason...
		var path = options.path ? '; path=' + (options.path) : '';
		var domain = options.domain ? '; domain=' + (options.domain) : '';
		var secure = options.secure ? '; secure' : '';
		document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
	} else { // only name given, get cookie
		var cookieValue = null;
		if (document.cookie && document.cookie != '') {
			var cookies = document.cookie.split(';');
			for (var i = 0; i < cookies.length; i++) {
				var cookie = jQuery.trim(cookies[i]);
				// Does this cookie string begin with the name we want?
				if (cookie.substring(0, name.length + 1) == (name + '=')) {
					cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
					break;
				}
			}
		}
		return cookieValue;

	}
};

function trim(str, chars) {
	chars = chars || "\\s";
	str =   str.replace(new RegExp("^[" + chars + "]+", "g"), "");
	str =  str.replace(new RegExp("^[" + chars + "]+", "g"), "");
	return str;
}

function createCookie(name,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}
function getCookie(c_name, defaultvalue){	//alert(document.cookie);
	var i,x,y,arrcookies=document.cookie.split(";");
	for (i=0;i<arrcookies.length;i++){
	  x=arrcookies[i].substr(0,arrcookies[i].indexOf("="));
	  y=arrcookies[i].substr(arrcookies[i].indexOf("=")+1);
	  x=x.replace(/^\s+|\s+$/g,"");
	  if (x==c_name){
		  return unescape(y);
	  }
	}
	return defaultvalue;
}

toggleMenu = function (el, over) {
}
String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, ""); };
jQuery(window).load(function(){
	function viewport() {
	    var e = window, a = 'inner';
	    if (!('innerWidth' in window )) {
	        a = 'client';
	        e = document.documentElement || document.body;
	    }
	    return { width : e[ a+'Width' ] , height : e[ a+'Height' ] };
	}
	
	if( jQuery('.stickynote-top').length ){
		if(jQuery('body.boxed-layout').length){
			jQuery('.stickynote-top').css({'width': jQuery('#sns_wrapper').outerWidth(), 'left':jQuery('#sns_wrapper').offset().left});
		}
		if(!jQuery('.stickynote-top').hasClass('loaded')) jQuery('.stickynote-top').addClass('loaded');
		if(getCookie(TMPL_NAME + '_prstatus')!='close'){
			jQuery('body#bd').addClass('open-stickynote-top', {duration:200});
			jQuery('.stickynote-top').stop().animate({top:'0px'}, {duration:200});
			jQuery('#sns_wrapper').stop().animate({paddingTop:jQuery('.stickynote-top').outerHeight()}, {duration:200});
		}else{
			jQuery('.stickynote-top').stop().animate({top: - jQuery('.stickynote-top').outerHeight()}, {duration:0});
			jQuery('#sns_wrapper').stop().animate({paddingTop:'0px'}, {duration:0});
		}
		jQuery('.stickynote-top .btn-close').bind('click', function(){
			if(jQuery('body#bd').hasClass('open-stickynote-top')){
				jQuery('body#bd').removeClass('open-stickynote-top', {duration:200});
				jQuery('.stickynote-top').stop().animate({top: - jQuery('.stickynote-top').outerHeight()}, {duration:200});
				jQuery('#sns_wrapper').stop().animate({paddingTop:'0px'}, {duration:200});
				if(jQuery('#sns_menu').hasClass('keep-menu')){
					jQuery('#sns_menu.keep-menu').stop().animate({top:'0px'}, {duration:200});
				}
				createCookie(TMPL_NAME + '_prstatus', 'close', 1);
			}else{
				jQuery('body#bd').addClass('open-stickynote-top', {duration:200});
				jQuery('.stickynote-top').stop().animate({top:'0px'}, {duration:200});
				jQuery('#sns_wrapper').stop().animate({paddingTop:jQuery('.stickynote-top').outerHeight()}, {duration:200});
				if(jQuery('#sns_menu').hasClass('keep-menu')){
					jQuery('#sns_menu.keep-menu').stop().animate({top:jQuery('.stickynote-top').outerHeight()}, {duration:200});
				}
				createCookie(TMPL_NAME + '_prstatus', 'close', -1);
			}
		});
	}
	jQuery(window).resize(function(){
		if( jQuery('.stickynote-top').length ){
			if(jQuery('body.boxed-layout').length){
				jQuery('.stickynote-top').css({'width': jQuery('#sns_wrapper').outerWidth(), 'left':jQuery('#sns_wrapper').offset().left});
			}
			if(getCookie(TMPL_NAME + '_prstatus')!='close'){
				jQuery('#sns_wrapper').stop().animate({paddingTop:jQuery('.stickynote-top').outerHeight()}, {duration:200});
			}else{
				jQuery('.stickynote-top').stop().animate({top: - jQuery('.stickynote-top').outerHeight()}, {duration:0});
			}
		}
	});
});


function setHeight(array, status){
	var h=0;
	if(jQuery.isArray(array)){
		for($i=0;$i<array.length; $i++){
			jQuery(array[$i]).css('height', "");
		}
		for($i=0;$i<array.length; $i++){
			if( (h < jQuery(array[$i]).height()) &&  (jQuery(array[$i]).css('display')!="none")){
				h = jQuery(array[$i]).height();
			}
		}
		if(status){
			for($i=0;$i<array.length; $i++){
				jQuery(array[$i]).css('height', h);
			}
		} else {
			for($i=0;$i<array.length; $i++){
				jQuery(array[$i]).css('height', '');
			}
		}
	} else {
		jQuery(array).each(function(){
			if( (h < jQuery(this).height()) &&  (jQuery(this).css('display')!="none")){
				h = jQuery(this).height();
			}
		});
		if(status) jQuery(array).css('height', h);
		else jQuery(array).css('height', '');
	}
}
// fix dropdown bootstrap on magento
(function() {
    var isBootstrapEvent = false;
    if (window.jQuery) {
        var all = jQuery('*');
        jQuery.each(['hide.bs.dropdown', 
            'hide.bs.collapse', 
            'hide.bs.modal', 
            'hide.bs.tooltip',
            'hide.bs.popover'], function(index, eventName) {
            all.on(eventName, function( event ) {
                isBootstrapEvent = true;
            });
        });
    }
    var originalHide = Element.hide;
    Element.addMethods({
        hide: function(element) {
            if(isBootstrapEvent) {
                isBootstrapEvent = false;
                return element;
            }
            return originalHide(element);
        }
    });
})(jQuery);
// end fix dropdown bootstrap on magento
function dump(obj) {
    var out = '';
    for (var i in obj) {
        out += i + ": " + obj[i] + "\n";
    }
    alert(out);
    var pre = document.createElement('pre');
    pre.innerHTML = out;
    document.body.appendChild(pre)
}
(function($){
	$.fn.SnsAccordion = function(options) {
		var $el    = $(this);
		var defaults = {
			active: 'open',
			el_wrap: 'li',
			el_content: 'ul',
			accordion: true,
			expand: true,
			btn_open: '<i class="fa fa-plus-square-o"></i>',
			btn_close: '<i class="fa fa-minus-square-o"></i>'
		};
		var options = $.extend({}, defaults, options);
		
		
		$(document).ready(function() {
			$el.find(options.el_wrap).each(function(){
				$(this).find('> a, > span, > h4').wrap('<div class="accr_header"></div>');
				if(($(this).find(options.el_content)).length){
					$(this).find('> .accr_header').append('<span class="btn_accor">' + options.btn_open + '</span>');
					$(this).find('> '+options.el_content+':not(".accr_header")').wrap('<div class="accr_content"></div>');
				}
			});
			if(options.accordion){
				$('.accr_content').hide();
				$el.find(options.el_wrap).each(function(){
					if($(this).hasClass(options.active)) {
						$(this).find('> .accr_content')
							   .addClass(options.active)
							   .slideDown();
						$(this).find('> .accr_header')
							   .addClass(options.active);
					}
				});
			} else {
				$el.find(options.el_wrap).each(function(){
					if(!options.expand){
						$('.accr_content').hide();
					} else {
						$(this).find('> .accr_content').addClass(options.active);
						$(this).find('> .accr_header').addClass(options.active);
						$(this).find('> .accr_header .btn_accor').html(options.btn_close);
					}
				});
			}
	   });
	    $(window).load(function() {
			$el.find(options.el_wrap).each(function(){
				var $wrap = $(this);
				var $accrhead = $wrap.find('> .accr_header');
				var btn_accor = '.btn_accor';
				
				$accrhead.find(btn_accor).on('click', function(event) {
					event.preventDefault();
					var obj = $(this);
					var slide = true;
					if($accrhead.hasClass(options.active)) {
						slide = false;
					}
					if(options.accordion){
						$wrap.siblings(options.el_wrap).find('> .accr_content').slideUp().removeClass(options.active);
						$wrap.siblings(options.el_wrap).find('> .accr_header').removeClass(options.active);
						$wrap.siblings(options.el_wrap).find('> .accr_header ' + btn_accor).html(options.btn_open);
					}
					if(slide) {
						$accrhead.addClass(options.active);
						obj.html(options.btn_close);
						$accrhead.siblings('.accr_content').addClass(options.active).stop(true, true).slideDown();
					} else {
						$accrhead.removeClass(options.active);
						obj.html(options.btn_open);
						$accrhead.siblings('.accr_content').removeClass(options.active).stop(true, true).slideUp();
					}
					return false;
				});
			});
		});
	};
})(jQuery);
jQuery(document).ready(function($){
	
	if($(window).width() >= 992) setHeight('#sns_footer_top .column', true);
	$(window).resize(function(){
		if($(window).width() >= 992){
			setHeight('#sns_footer_top .column', true);
		} else {
			setHeight('#sns_footer_top .column', false);
		}
	});
	
	if($('#sns_menu') && KEEP_MENU == 1){
		$('#sns_menu').stick_in_parent({
			sticky_class: 'keep-menu'
		});
	}
});
