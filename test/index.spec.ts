import { AxiosDigestAuth } from '../src';

const PASSWORD = '';
const USERNAME = '';

describe('index', () => {
  describe('AxiosDigestAuth', () => {
    it('should return response', async () => {
      const digestAuth = new AxiosDigestAuth({
        password: PASSWORD,
        username: USERNAME,
      });
      await digestAuth.get('https://cloud.mongodb.com/api/atlas/v1.0/groups');
    });
  });
});
