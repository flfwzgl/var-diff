/**
 * created by flfwzgl
 * github.com/flfwzgl/var-diff
 */

;(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global.diff = factory();
  }
})(typeof window === 'object' ? window : this, function () {
  var hasOwn = Object.prototype.hasOwnProperty;
  var toStr = Object.prototype.toString;

  var is = function (type) {
    return function (e) {
      return toStr.call(e) === '[object ' + type + ']';
    }
  }

  var isObj = is('Object');
  var isArr = is('Array');

  var rtype = /\[object (\w+)\]/;
  var getType = function (e) {
    var arr = toStr.call(e).match(rtype);
    return (arr && arr[1] || '').toLowerCase();
  }

  function apply (data, patches) {
    if (!isArr(patches))
      throw new TypeError('patches must be an array');

    patches.forEach(function (e) {
      var t = e.t
        , p = e.p
        , v = e.v
        , i = e.i
        , d = data
        , pp

      if (!p.length) {
        if (t === 3) return data = v;
      }

      for (var j = 0, l = p.length - 1; j < l; j++) {
        pp = p[j];
        d = d[pp];
      }

      pp = p[p.length - 1];

      switch (t) {
        case 1:
        case 3: d[pp] = v;
          break;
        case 4: swap(d, pp, i);
          break;
        case 2:
          typeof pp === 'number'
            ? d.splice(pp, 1)
            : delete d[pp]
          break;
      }
    });
    return data;
  }

  function swap (arr, i, j) {
    var e = arr[i];
    arr[i] = arr[j];
    arr[j] = e;
  }

  /**
   * 1-create
   * 2-delete
   * 3-update
   * 4-replace [array]
   */
  var CREATE = 1;
  var DELETE = 2;
  var UPDATE = 3;
  var REPLACE = 4;

  var isnan = function (e) {
    return typeof e === 'number' && isNaN(e);
  }

  var isKey = function (id) {
    return typeof id === 'number'
      || typeof id === 'string';
  }

  var format = function (p) {
    return p.reduce(function (prev, e) {
      return typeof e === 'number'
        ? prev + '[' + e + ']'
        : prev && prev + '.' || e
    }, '')
  }

  function get (a, b, key) {
    var patches = [];
    getDiff(a, b, []);
    return patches;

    function getDiff (a, b, p) {
      var k;
      if (a === b || isnan(a) && isnan(b)) return;
      if (isObj(a) && isObj(b)) {
        for (k in a) {
          if (!hasOwn.call(a, k)) continue;
          if (hasOwn.call(b, k)) {
            getDiff(a[k], b[k], p.concat(k));
          } else {
            patches.push({
              t: DELETE,
              p: p.concat(k)
            });
          }
        }
        for (k in b) {
          if (!hasOwn.call(b, k)) continue;
          if (!hasOwn.call(a, k)) {
            patches.push({
              t: CREATE,
              p: p.concat(k),
              v: b[k]
            });
          }
        }
      } else if (isArr(a) && isArr(b)) {
        diffArr(a, b, p);
      } else {
        patches.push({
          t: UPDATE,
          p: p,
          v: b
        });
      }
    }

    function saveIndex (map, e, i, p, d) {
      switch (getType(e)) {
        case 'object':
          if (key !== undefined && isKey(id = e[key])) {
            if (id in map.key)
              throw new Error(
                'repetitive key "'
                + format(p.concat(i + d))
                + '.' + key + ': ' + id
                + '" in ' + map.name + ' variable'
              );
            map.key[id] = i;
          }
          break;
        case 'number':
          e in map.num
            ? map.num[e].push(i)
            : map.num[e] = [i]
          break;
        case 'string':
          e in map.str
            ? map.str[e].push(i)
            : map.str[e] = [i]
          break;
        case 'boolean':
          (e ? map.true : map.false).push(i);
          break;
        case 'null':
          map.null.push(i);
          break;
        case 'undefined':
          map.undef.push(i);
          break;
      }
    }

    function getIndex (map, e) {
      switch (getType(e)) {
        case 'object':
          if (key !== undefined && isKey(id = e[key]) && id in map.key)
            return map.key[id];
          break;
        case 'number':
          if (e in map.num && map.num[e].length)
            return map.num[e].shift();
          break;
        case 'string':
          if (e in map.str && map.str[e].length)
            return map.str[e].shift();
          break;
        case 'boolean':
          if (e && map.true.length) {
            return map.true.shift();
          } else if (!e && map.false.length) {
            return map.false.shift();
          }
          break;
        case 'null':
          if (map.null.length)
            return map.null.shift();
          break;
        case 'undefined':
          if (map.undef.length)
            return map.undef.shift();
          break;
      }
      return -1;
    }

    function diffArr (a, b, p) {
      /**
       * [{a}, b, {c}, d, {a}, b, {e}, f, g, h]
       * [{c}, b, m, {a}, {e}, b, a] 
       *
       * 先移除要删掉的 d, f, g, h
       * [a, b, {c}, b, {e}]
       *
       * 添加 m, a
       * [a, b, {c}, b, {e}, m, a]
       *
       * 交换
       * [{c}, b, a, b, {e}, m, a]
       * [{c}, b, b, m, {e}, m, a]
       * 
       * [{c}, b, , m, {e}, b, a]
       * 
       * 注意: 
       * 1. 任何一次交换都修改原有index
       * 2. a中存在 - 交换(diff), 假设a中位置3移动到b中0
       *  diff在交换之前, diff的时候是 a[3] 和 b[0]对比, 但patch的p是3
       *  diff在交换之后, diff的时候是 a[3] 和 b[0]对比, 但patch的p确是0, 因为diff已经发生在交换之后
       * 
       * 
       * 1-构建b映射
       * 2-遍历a, 删除a多余的, 同时构建a映射
       * 3-添加a不存在的, 同时 replace, 替换过程动态修改a映射
       * 
       */

      var amap = {
        name: 'origin',
        key: {},
        num: {},
        str: {},
        true: [],
        false: [],
        null: [],
        undef: [],
      }

      var bmap = {
        name: 'target',
        key: {},
        num: {},
        str: {},
        true: [],
        false: [],
        null: [],
        undef: []
      }

      var la = a.length
        , lb = b.length
        , i
        , n = 0
        , d = 0
        , ai
        , bi
        , e
        , map = {}
        , map2 = {}
        , ii

      for (i = 0; i < lb; i++) {
        saveIndex(bmap, b[i], i, p, d);
      }

      for (i = 0; i < la; i++) {
        e = a[i];
        bi = getIndex(bmap, e);

        if (~bi) {
          getDiff(e, b[bi], p.concat(i - d));
          saveIndex(amap, a[i], n++, p, d);
        } else {
          patches.push({
            t: DELETE,
            p: p.concat(i - d),
          });
          d++;
        }
      }

      for (i = 0; i < lb; i++) {
        e = b[i];
        ai = getIndex(amap, e);

        if (ai === -1) {
          patches.push({
            t: CREATE,
            p: p.concat(n),
            v: e
          });

          ai = n++;
        }

        ii = ai in map ? map[ai] : ai;
        if (i < ii) {
          patches.push({
            t: REPLACE,
            p: p.concat(ii),
            i: i
          });

          if (map2[i] in map) {
            map[map2[i]] = ii;
            map2[ii] = map2[i];
            delete map2[i];
          } else {
            map[i] = ii;
            map2[ii] = i;
          }
        }
      }
    }
  }

  return {
    get: get,
    apply: apply
  }

});
