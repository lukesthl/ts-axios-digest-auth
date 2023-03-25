import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import axios from 'axios';
import * as crypto from 'crypto';
import * as url from 'url';

/**
 * Options to configure the AxiosDigestAuth instance.
 */
export interface AxiosDigestAuthOptions {
  /**
   * optionally provide your own axios instance.
   */
  axios?: AxiosInstance;
  /** the http digest auth password */
  password: string;
  /** the http digest auth username */
  username: string;
}

export class AxiosDigestAuth {
  private readonly axios: AxiosInstance;
  private count: number;
  private readonly password: string;
  private readonly username: string;

  constructor({
    axios: axiosInst,
    password,
    username,
  }: AxiosDigestAuthOptions) {
    this.axios = axiosInst ? axiosInst : axios.create();
    this.count = 0;
    this.password = password;
    this.username = username;
  }

  private authError(error: AxiosError): boolean {
    return !!(
      error.response?.status === 401 ||
      error.response?.headers['www-authenticate']
    );
  }

  public async request<T>(
    opts: AxiosRequestConfig
  ): Promise<AxiosResponse<T, unknown>> {
    try {
      return await this.axios.request(opts);
    } catch (error) {
      if (axios.isAxiosError(error) && !this.authError(error)) {
        throw error;
      } else if (axios.isAxiosError(error) && error.response) {
        const firstResponse = error.response;
        const authDetails = (
          firstResponse.headers['www-authenticate'] as string
        )
          .split(',')
          .map((v: string) => v.split('='));
        if (!authDetails) {
          throw new Error('authDetails is undefined');
        }
        ++this.count;
        const nonceCount = ('00000000' + this.count.toString()).slice(-8);
        const cnonce = crypto.randomBytes(24).toString('hex');
        const realmTmp = authDetails.find(
          el => el[0] && el[0].toLowerCase().indexOf('realm') > -1
        );
        const realm =
          realmTmp && realmTmp[1] ? realmTmp[1].replace(/"/g, '') : undefined;
        const nonceTmp = authDetails.find(
          el => el[0] && el[0].toLowerCase().indexOf('nonce') > -1
        );
        const nonce =
          nonceTmp && nonceTmp[1] ? nonceTmp[1].replace(/"/g, '') : undefined;
        if (!nonce || !realm) {
          throw new Error('nonce or realm is undefined');
        }
        const ha1 = crypto
          .createHash('md5')
          .update(`${this.username}:${realm}:${this.password}`)
          .digest('hex');
        if (!opts.url) {
          throw new Error('opts.url is undefined');
        }
        const path = new url.URL(opts.url).pathname;
        if (!path) {
          throw new Error('path is undefined');
        }
        const ha2 = crypto
          .createHash('md5')
          .update(`${opts.method ?? 'GET'}:${path}`)
          .digest('hex');
        const response = crypto
          .createHash('md5')
          .update(`${ha1}:${nonce}:${nonceCount}:${cnonce}:auth:${ha2}`)
          .digest('hex');
        const authorization =
          `Digest username="${this.username}",realm="${realm}",` +
          `nonce="${nonce}",uri="${path}",qop="auth",algorithm="MD5",` +
          `response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`;
        if (opts.headers) {
          opts.headers['authorization'] = authorization;
        } else {
          opts.headers = { authorization };
        }
        if (opts.auth) {
          delete opts.auth;
        }
        return this.axios.request(opts);
      }
      throw error;
    }
  }
}
