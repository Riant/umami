import path from 'path';
import requestIp from 'request-ip';
import { browserName, detectOS } from 'detect-browser';
import isLocalhost from 'is-localhost-ip';
import maxmind from 'maxmind';
import fetch from 'node-fetch';
import md5 from 'md5';

import {
  DESKTOP_OS,
  MOBILE_OS,
  DESKTOP_SCREEN_WIDTH,
  LAPTOP_SCREEN_WIDTH,
  MOBILE_SCREEN_WIDTH,
} from './constants';

let lookup;

export function getIpAddress(req) {
  // Custom header
  if (req.headers[process.env.CLIENT_IP_HEADER]) {
    return req.headers[process.env.CLIENT_IP_HEADER];
  }
  // Cloudflare
  else if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }

  return requestIp.getClientIp(req);
}

export function getDevice(screen, browser, os) {
  if (!screen) return;

  const [width] = screen.split('x');

  if (DESKTOP_OS.includes(os)) {
    if (os === 'Chrome OS' || width < DESKTOP_SCREEN_WIDTH) {
      return 'laptop';
    }
    return 'desktop';
  } else if (MOBILE_OS.includes(os)) {
    if (os === 'Amazon OS' || width > MOBILE_SCREEN_WIDTH) {
      return 'tablet';
    }
    return 'mobile';
  }

  if (width >= DESKTOP_SCREEN_WIDTH) {
    return 'desktop';
  } else if (width >= LAPTOP_SCREEN_WIDTH) {
    return 'laptop';
  } else if (width >= MOBILE_SCREEN_WIDTH) {
    return 'tablet';
  } else {
    return 'mobile';
  }
}

export async function getCountry(req, ip) {
  // Cloudflare
  if (req.headers['cf-ipcountry']) {
    return req.headers['cf-ipcountry'];
  }

  // Ignore local ips
  if (await isLocalhost(ip)) {
    return;
  }

  // Database lookup
  if (!lookup) {
    lookup = await maxmind.open(path.resolve('./public/geo/GeoLite2-Country.mmdb'));
  }

  const result = lookup.get(ip);

  return result?.country?.iso_code;
}

export async function getClientInfo(req, { screen }) {
  const userAgent = req.headers['user-agent'];
  const ip = getIpAddress(req);
  const country = await getCountry(req, ip);
  const browser = browserName(userAgent);
  const os = detectOS(userAgent);
  const device = getDevice(screen, browser, os);
  const area = await getIPAreaInBMap(ip);

  return { userAgent, browser, os, ip, country, device, area };
}

export function getJsonBody(req) {
  if ((req.headers['content-type'] || '').indexOf('text/plain') !== -1) {
    return JSON.parse(req.body);
  }

  return req.body;
}

// 通过百度接口获取ip对应的中心城市信息
async function getIPAreaInBMap(ip) {
  const bd_ak = 'H2NFw0SFdm7Hg3soVtVcATYHealTLIeD';
  const bd_sk = 'TPVXU35UpxaPm04MNjF71wRixyfudqF3';
  const url = '/location/ip';
  let query = `ak=${bd_ak}&ip=${ip}`;
  query += '&sn=' + caculateBDAKSN(bd_sk, url, query);
  const response = await fetch(`http://api.map.baidu.com${url}?${query}`);
  const data = await response.json();
  if (!data.status)
    return data.content.address_detail.province + '|' + data.content.address_detail.city;
  return '';
}

function caculateBDAKSN(sk, url, query) {
  // if (method === 'POST') ksort(query)
  return md5(encodeURIComponent(url + '?' + query + sk));
}
