// Android 11 等旧机型自带 WebView 内核停留在 Chrome 87，
// 缺少 Array.prototype.at（Chrome 92+）等新 API；协议站（Nuxt）初始化阶段就会调用，
// 抛错后直接渲染「页面加载失败」。这里在页面脚本执行前补齐常用新 API。
export const WEBVIEW_COMPAT_SCRIPT = `
(function () {
  function define(target, name, value) {
    try {
      Object.defineProperty(target, name, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (error) {
      target[name] = value;
    }
  }

  function toInteger(value) {
    var number = Number(value);
    if (isNaN(number)) {
      return 0;
    }
    return Math.trunc(number) || 0;
  }

  function relativeIndex(index, length) {
    var key = toInteger(index);
    return key < 0 ? key + length : key;
  }

  function at(index) {
    var length = this.length >>> 0;
    var key = relativeIndex(index, length);
    if (key < 0 || key >= length) {
      return undefined;
    }
    return this[key];
  }

  if (!Array.prototype.at) {
    define(Array.prototype, "at", at);
  }

  if (!String.prototype.at) {
    define(String.prototype, "at", function (index) {
      var text = String(this);
      var key = relativeIndex(index, text.length);
      if (key < 0 || key >= text.length) {
        return undefined;
      }
      return text.charAt(key);
    });
  }

  try {
    var typedArrayPrototype = Object.getPrototypeOf(Int8Array.prototype);
    if (typedArrayPrototype && !typedArrayPrototype.at) {
      define(typedArrayPrototype, "at", at);
    }
  } catch (error) {
    // 极旧内核没有 TypedArray 原型链时忽略
  }

  if (!Object.hasOwn) {
    define(Object, "hasOwn", function (target, key) {
      if (target === null || target === undefined) {
        throw new TypeError("Cannot convert undefined or null to object");
      }
      return Object.prototype.hasOwnProperty.call(Object(target), key);
    });
  }

  if (!Array.prototype.findLast) {
    define(Array.prototype, "findLast", function (predicate, thisArg) {
      var list = Object(this);
      for (var index = (list.length >>> 0) - 1; index >= 0; index--) {
        if (predicate.call(thisArg, list[index], index, list)) {
          return list[index];
        }
      }
      return undefined;
    });
  }

  if (!Array.prototype.findLastIndex) {
    define(Array.prototype, "findLastIndex", function (predicate, thisArg) {
      var list = Object(this);
      for (var index = (list.length >>> 0) - 1; index >= 0; index--) {
        if (predicate.call(thisArg, list[index], index, list)) {
          return index;
        }
      }
      return -1;
    });
  }

  function copyArray(target) {
    var list = Object(target);
    var length = list.length >>> 0;
    var copy = new Array(length);
    for (var index = 0; index < length; index++) {
      copy[index] = list[index];
    }
    return copy;
  }

  if (!Array.prototype.toReversed) {
    define(Array.prototype, "toReversed", function () {
      return copyArray(this).reverse();
    });
  }

  if (!Array.prototype.toSorted) {
    define(Array.prototype, "toSorted", function (compareFn) {
      return copyArray(this).sort(compareFn);
    });
  }

  if (!Array.prototype.toSpliced) {
    define(Array.prototype, "toSpliced", function () {
      var copy = copyArray(this);
      Array.prototype.splice.apply(copy, arguments);
      return copy;
    });
  }

  try {
    if (typeof crypto !== "undefined" && !crypto.randomUUID) {
      define(crypto, "randomUUID", function () {
        var bytes = new Uint8Array(16);
        if (crypto.getRandomValues) {
          crypto.getRandomValues(bytes);
        } else {
          for (var index = 0; index < 16; index++) {
            bytes[index] = Math.floor(Math.random() * 256);
          }
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        var hex = [];
        for (var byteIndex = 0; byteIndex < 16; byteIndex++) {
          hex.push((bytes[byteIndex] + 0x100).toString(16).slice(1));
        }
        return (
          hex.slice(0, 4).join("") +
          "-" +
          hex.slice(4, 6).join("") +
          "-" +
          hex.slice(6, 8).join("") +
          "-" +
          hex.slice(8, 10).join("") +
          "-" +
          hex.slice(10, 16).join("")
        );
      });
    }
  } catch (error) {
    // crypto 在非安全上下文可能不可写，忽略
  }
})();
true;
`;
