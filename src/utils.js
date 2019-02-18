/* eslint-disable no-param-reassign, array-callback-return */

/**
 * APIのrootパスを取得
 * @param {string} url URLを指定
 */
const getRootPath = url => {
  const match = url.match(/^\/(\w+)\/.+/i);
  if (match && match.length) {
    return match[1];
  }
  throw Error('URL Parse error.');
};

/**
 * エンドポイントを取得する
 * @param {object} obj オブジェクトを指定
 * @param {string} url URLを指定
 */
const getEndpoint = (obj, url) => {
  if (typeof obj !== 'object') throw Error('Not object');
  if (!('paths' in obj)) throw Error('Not paths');
  const { paths } = obj;
  let path;

  Object.keys(paths).forEach(value => {
    const pattern = `^${value.replace(/{\w+}/gi, '[\\w{}%]+')}$`;
    const re = new RegExp(pattern, 'i');
    const match = url.split('?')[0].match(re, value);
    if (match && match.length) {
      path = value;
    }
  });

  if (!path)
    throw Error(
      `Endpoint not found.\n\nThe list of available APIs:\n${Object.keys(paths)
        .map(value => value)
        .join('\n')}`
    );

  return path;
};

/**
 * ネストされたオブジェクトから対象のデータを取得する
 * @param {object} obj objectを指定
 * @param {array} path objectのキーを配列で指定
 */
const getIn = (obj, path = []) => {
  if (path.length === 0) return obj;
  return getIn(obj[path[0]], path.slice(1));
};

/**
 * $refで指定されたパスからデータを取得
 * @param {object} obj オブジェクト
 * @param {string} value 参照先のパス
 */
const getRef = (obj, value = '') => {
  const keyIn = value.split('/');

  if (value.indexOf('#/') === 0) {
    keyIn.shift();
  }

  return getIn(obj, keyIn);
};

/**
 * $refでポインタ参照されているキーに参照先のデータを代入する
 * @param {object} obj オブジェクトを指定
 * @param {object} raw オブジェクトを指定
 */
const parseRef = (obj, raw = {}) => {
  if (obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(value => {
      return parseRef(value, raw);
    });
  }

  if (!Array.isArray(obj) && typeof obj === 'object') {
    Object.keys(obj).map(value => {
      if (value === '$ref') {
        obj = parseRef(getRef(raw, obj[value]), raw);
      } else {
        obj[value] = parseRef(obj[value], raw);
      }
    });
  }

  return obj;
};

module.exports = { getRootPath, getRef, getIn, getEndpoint, parseRef };
