import { beforeAll, afterAll } from 'vitest';

// Mock Google Cloud services for testing
beforeAll(() => {
  // Mock environment variables
  process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
  process.env.NODE_ENV = 'test';

  // Mock Firestore
  global.mockFirestore = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => null }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      }),
      where: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] }),
        limit: () => ({
          get: () => Promise.resolve({ empty: true, docs: [] })
        })
      }),
      add: () => Promise.resolve({ id: 'test-doc-id' })
    }),
    runTransaction: (fn: any) => fn({
      get: () => Promise.resolve({ exists: false, data: () => null }),
      set: () => { },
      update: () => { },
      delete: () => { }
    })
  };

  // Mock Secret Manager
  global.mockSecretManager = {
    accessSecretVersion: () => Promise.resolve([{
      payload: { data: Buffer.from('test-secret') }
    }])
  };

  // Mock Pub/Sub
  global.mockPubSub = {
    topic: () => ({
      publishMessage: () => Promise.resolve('test-message-id')
    }),
    createTopic: () => Promise.resolve(),
    getTopics: () => Promise.resolve([[]])
  };
});

afterAll(() => {
  // Cleanup mocks
  delete global.mockFirestore;
  delete global.mockSecretManager;
  delete global.mockPubSub;
});