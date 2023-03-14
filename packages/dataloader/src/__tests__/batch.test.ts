import batch, {batchGroups} from '../batch';
import createNamespacedCache from '../createNamespacedCache';
import requestsTester from './requestsTester';

test('batch', async () => {
  const requests = requestsTester<string[]>();
  const load = batch<string, {source: string} | undefined>(
    async (req: string[]) => {
      requests.add([...req]);
      return new Map(
        req
          .filter((key) => key !== 'NOT_FOUND')
          .map((key) => [
            key,
            key === 'ERROR_THIS'
              ? Promise.reject(new Error('Errored'))
              : {source: key},
          ]),
      );
    },
  );
  await requests.expect([['hello', 'world']], async () => {
    expect(await Promise.all([load('hello'), load('world')])).toEqual([
      {source: 'hello'},
      {source: 'world'},
    ]);
  });

  await requests.expect(
    [['hello', 'world', 'ERROR_THIS', 'NOT_FOUND']],
    async () => {
      expect(
        await Promise.all([
          load('hello'),
          load('world'),
          load('ERROR_THIS').catch((ex) => ex.message),
          load('NOT_FOUND'),
        ]),
      ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
    },
  );
});

test('batch - maxBatchSize', async () => {
  const requests = requestsTester<string[]>();
  const load = batch(
    async (req: string[]) => {
      requests.add([...req]);
      return new Map<string, Promise<{source: string}>>(
        req
          .filter((key) => key !== 'NOT_FOUND')
          .map((key) => [
            key,
            key === 'ERROR_THIS'
              ? Promise.reject(new Error('Errored'))
              : Promise.resolve({source: key}),
          ]),
      );
    },
    {maxBatchSize: 3},
  );

  await requests.expect([['hello', 'world', 'Forbes'], ['Dima']], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('Forbes'),
        load('Dima'),
      ]),
    ).toEqual([
      {source: 'hello'},
      {source: 'world'},
      {source: 'Forbes'},
      {source: 'Dima'},
    ]);
  });

  await requests.expect(
    [['hello', 'world', 'ERROR_THIS'], ['NOT_FOUND']],
    async () => {
      expect(
        await Promise.all([
          load('hello'),
          load('world'),
          load('ERROR_THIS').catch((ex) => ex.message),
          load('NOT_FOUND').catch((ex) => ex.message),
        ]),
      ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
    },
  );
});

test('batch - dedupe', async () => {
  const requests = requestsTester<string[]>();
  const load = batch<string, {source: string} | undefined>(
    async (req: string[]) => {
      requests.add([...req]);
      return new Map(
        req
          .filter((key) => key !== 'NOT_FOUND')
          .map((key) => [
            key,
            key === 'ERROR_THIS'
              ? Promise.reject(new Error('Errored'))
              : {source: key},
          ]),
      );
    },
  ).dedupe();

  await requests.expect([['hello', 'world']], async () => {
    expect(await Promise.all([load('hello'), load('world')])).toEqual([
      {source: 'hello'},
      {source: 'world'},
    ]);
  });

  await requests.expect([['ERROR_THIS', 'NOT_FOUND']], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });

  await requests.expect([['ERROR_THIS']], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });
});

test('batch - dedupe with shouldCache', async () => {
  const requests = requestsTester<string[]>();
  const load = batch<string, {source: string} | undefined>(
    async (req: string[]) => {
      requests.add([...req]);
      return new Map(
        req
          .filter((key) => key !== 'NOT_FOUND')
          .map((key) => [
            key,
            key === 'ERROR_THIS'
              ? Promise.reject(new Error('Errored'))
              : {source: key},
          ]),
      );
    },
  ).dedupe({shouldCache: (v) => v !== undefined});

  await requests.expect([['hello', 'world']], async () => {
    expect(await Promise.all([load('hello'), load('world')])).toEqual([
      {source: 'hello'},
      {source: 'world'},
    ]);
  });

  await requests.expect([['ERROR_THIS', 'NOT_FOUND']], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });

  await requests.expect([['ERROR_THIS', 'NOT_FOUND']], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });
});

test('batchGroups', async () => {
  const requests = requestsTester<[number, string[]]>();
  const load = batchGroups(async (group: number, req: string[]) => {
    requests.add([group, [...req]]);
    return new Map<string, Promise<{source: string}>>(
      req
        .filter((key) => key !== 'NOT_FOUND')
        .map((key) => [
          key,
          key === 'ERROR_THIS'
            ? Promise.reject(new Error('Errored'))
            : Promise.resolve({group, source: key}),
        ]),
    );
  });

  await requests.expect([[1, ['hello', 'world']]], async () => {
    expect(await Promise.all([load(1, 'hello'), load(1, 'world')])).toEqual([
      {group: 1, source: 'hello'},
      {group: 1, source: 'world'},
    ]);
  });

  await requests.expect(
    [
      [1, ['hello', 'ERROR_THIS']],
      [2, ['world', 'NOT_FOUND']],
    ],
    async () => {
      expect(
        await Promise.all([
          load(1, 'hello'),
          load(2, 'world'),
          load(1, 'ERROR_THIS').catch((ex) => ex.message),
          load(2, 'NOT_FOUND'),
        ]),
      ).toEqual([
        {group: 1, source: 'hello'},
        {group: 2, source: 'world'},
        'Errored',
        undefined,
      ]);
    },
  );
});

test('batchGroups - dedupe with mapKey', async () => {
  const requests = requestsTester<[number, string[]]>();
  const load = batchGroups(async (group: number, req: string[]) => {
    requests.add([group, [...req]]);
    return new Map<string, Promise<{source: string}>>(
      req
        .filter((key) => key !== 'NOT_FOUND')
        .map((key) => [
          key,
          key === 'ERROR_THIS'
            ? Promise.reject(new Error('Errored'))
            : Promise.resolve({group, source: key}),
        ]),
    );
  }).dedupe({
    mapKey: ([group, req]) => `${group}:${req}`,
    shouldCache: (v) => v !== undefined,
  });

  await requests.expect([[1, ['hello', 'world']]], async () => {
    expect(await Promise.all([load(1, 'hello'), load(1, 'world')])).toEqual([
      {group: 1, source: 'hello'},
      {group: 1, source: 'world'},
    ]);
  });

  await requests.expect(
    [
      [1, ['ERROR_THIS']],
      [2, ['world', 'NOT_FOUND']],
    ],
    async () => {
      expect(
        await Promise.all([
          load(1, 'hello'),
          load(2, 'world'),
          load(1, 'ERROR_THIS').catch((ex) => ex.message),
          load(2, 'NOT_FOUND'),
        ]),
      ).toEqual([
        {group: 1, source: 'hello'},
        {group: 2, source: 'world'},
        'Errored',
        undefined,
      ]);
    },
  );

  await requests.expect(
    [
      [1, ['ERROR_THIS']],
      [2, ['NOT_FOUND']],
    ],
    async () => {
      expect(
        await Promise.all([
          load(1, 'hello'),
          load(2, 'world'),
          load(1, 'ERROR_THIS').catch((ex) => ex.message),
          load(2, 'NOT_FOUND'),
        ]),
      ).toEqual([
        {group: 1, source: 'hello'},
        {group: 2, source: 'world'},
        'Errored',
        undefined,
      ]);
    },
  );
});

test('batchGroups - dedupe with leveled cache', async () => {
  const requests = requestsTester<[number, string[]]>();
  const load = batchGroups(async (group: number, req: string[]) => {
    requests.add([group, [...req]]);
    return new Map<string, Promise<{source: string}>>(
      req
        .filter((key) => key !== 'NOT_FOUND')
        .map((key) => [
          key,
          key === 'ERROR_THIS'
            ? Promise.reject(new Error('Errored'))
            : Promise.resolve({group, source: key}),
        ]),
    );
  }).dedupe({
    cache: createNamespacedCache<number>().addNamespace<string>().build(),
    shouldCache: (v) => v !== undefined,
  });

  await requests.expect([[1, ['hello', 'world']]], async () => {
    expect(await Promise.all([load(1, 'hello'), load(1, 'world')])).toEqual([
      {group: 1, source: 'hello'},
      {group: 1, source: 'world'},
    ]);
  });

  await requests.expect(
    [
      [1, ['ERROR_THIS']],
      [2, ['world', 'NOT_FOUND']],
    ],
    async () => {
      expect(
        await Promise.all([
          load(1, 'hello'),
          load(2, 'world'),
          load(1, 'ERROR_THIS').catch((ex) => ex.message),
          load(2, 'NOT_FOUND'),
        ]),
      ).toEqual([
        {group: 1, source: 'hello'},
        {group: 2, source: 'world'},
        'Errored',
        undefined,
      ]);
    },
  );

  await requests.expect(
    [
      [1, ['ERROR_THIS']],
      [2, ['NOT_FOUND']],
    ],
    async () => {
      expect(
        await Promise.all([
          load(1, 'hello'),
          load(2, 'world'),
          load(1, 'ERROR_THIS').catch((ex) => ex.message),
          load(2, 'NOT_FOUND'),
        ]),
      ).toEqual([
        {group: 1, source: 'hello'},
        {group: 2, source: 'world'},
        'Errored',
        undefined,
      ]);
    },
  );
});

for (const [name, options] of [
  [
    `leveled cache`,
    {
      groupMap: createNamespacedCache<number>()
        .addNamespace<number>()
        .addNamespace<number>()
        .build<Promise<{source: string}>>(),
    },
  ],
  [
    `map group key`,
    {mapGroupKey: (group: [number, number, number]) => group.join(`:`)},
  ],
] as const) {
  test(`batchGroups - multi level - ${name}`, async () => {
    const requests = requestsTester<[[number, number, number], string[]]>();
    const load = batchGroups(
      async (group: [number, number, number], req: string[]) => {
        requests.add([group, [...req]]);
        return new Map<string, Promise<{source: string}>>(
          req
            .filter((key) => key !== 'NOT_FOUND')
            .map((key) => [
              key,
              key === 'ERROR_THIS'
                ? Promise.reject(new Error('Errored'))
                : Promise.resolve({group, source: key}),
            ]),
        );
      },
      options as any,
    );

    await requests.expect(
      [
        [
          [1, 1, 1],
          ['hello', 'world'],
        ],
      ],
      async () => {
        expect(
          await Promise.all([
            load([1, 1, 1], 'hello'),
            load([1, 1, 1], 'world'),
          ]),
        ).toEqual([
          {group: [1, 1, 1], source: 'hello'},
          {group: [1, 1, 1], source: 'world'},
        ]);
      },
    );

    await requests.expect(
      [
        [
          [1, 1, 1],
          ['hello', 'ERROR_THIS'],
        ],
        [
          [2, 2, 2],
          ['world', 'NOT_FOUND'],
        ],
      ],
      async () => {
        expect(
          await Promise.all([
            load([1, 1, 1], 'hello'),
            load([2, 2, 2], 'world'),
            load([1, 1, 1], 'ERROR_THIS').catch((ex) => ex.message),
            load([2, 2, 2], 'NOT_FOUND'),
          ]),
        ).toEqual([
          {group: [1, 1, 1], source: 'hello'},
          {group: [2, 2, 2], source: 'world'},
          'Errored',
          undefined,
        ]);
      },
    );
  });
}
