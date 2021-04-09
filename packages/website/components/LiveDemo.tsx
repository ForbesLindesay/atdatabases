import 'twin.macro';
import {useCallback, useEffect, useState} from 'react';

type Message = any; // ReturnType<typeof Decode>;
let consoleFeed: null | Promise<typeof import('console-feed')> = null;
function getConsoleFeed() {
  return consoleFeed || (consoleFeed = import('console-feed'));
}
let aceEditor: null | Promise<typeof import('react-ace')> = null;
function getAceEditor() {
  return (
    aceEditor ||
    (aceEditor = import('react-ace').then(async (ace) => {
      await Promise.all([
        import('ace-builds/src-noconflict/mode-javascript'),
        import('ace-builds/src-noconflict/theme-github'),
      ]);
      return ace;
    }))
  );
}
export default function LiveDemo({id, example}: {id: string; example: string}) {
  const [code, setCode] = useState(example);
  const [log, setLog] = useState<Message[]>([]);
  const [Console, setConsole] = useState({
    render: (m: Message[]) => <div />,
  });
  const [Ace, setAce] = useState({
    render: (value: string) => <div />,
  });
  useEffect(() => {
    getAceEditor().then((Ace) =>
      setAce({
        render: (value: string) => (
          <Ace.default
            mode="javascript"
            theme="github"
            value={value}
            onChange={(e) => setCode(e)}
            name={id}
            tabSize={2}
            width="100%"
            minLines={20}
            maxLines={Infinity}
            showGutter={false}
            editorProps={{$blockScrolling: true}}
          />
        ),
      }),
    );
  }, []);

  const appendLog = useCallback(
    (msg: Message) => {
      console.log('msg =', msg);
      setLog((log) => [...log, msg]);
    },
    [setLog],
  );
  useEffect(() => {
    let cancelled = false;
    let cancel = () => {};
    const timeout = setTimeout(() => {
      getConsoleFeed().then((ConsoleFeed) => {
        if (cancelled) return;
        setConsole({
          render: (m) => (
            <ConsoleFeed.Console
              logs={m}
              variant="dark"
              styles={{
                LOG_WARN_COLOR: `white`,
                LOG_ERROR_COLOR: `white`,
                BASE_BACKGROUND_COLOR: `transparent`,
                BASE_FONT_SIZE: `14px`,
                ARROW_FONT_SIZE: `14px`,
                TREENODE_FONT_SIZE: `14px`,
                LOG_ICON_WIDTH: 10,
                LOG_ICON_HEIGHT: 25,
              }}
            />
          ),
        });
        const worker = new Worker(
          new URL('./LiveDemo.worker.ts', import.meta.url),
        );
        setLog([]);
        worker.onmessage = (evt: any) => {
          const e = evt.data;
          switch (e.type) {
            case 'console':
              console.log('e.message =', e.message);
              appendLog(e.message);
              break;
            case 'resolve':
              appendLog({
                method: `info`,
                id: `${Math.random().toString(32).substr(2)}`,
                data: [`finished`],
              });
              worker.terminate();
              break;
            case 'reject':
              appendLog({
                method: `error`,
                id: `${Math.random().toString(32).substr(2)}`,
                data: [e.err],
              });
              worker.terminate();
              break;
          }
        };
        worker.postMessage({code});
        cancel = () => {
          worker.terminate();
        };
      });
    }, 500);
    cancel = () => {
      clearTimeout(timeout);
    };
    return () => {
      cancelled = true;
      cancel();
    };
  }, [code, appendLog, setLog]);
  return (
    <div tw="flex flex-col lg:flex-row gap-4">
      <div tw="lg:w-580px">{Ace.render(code)}</div>
      <div
        tw="h-64 lg:h-auto relative lg:w-0 flex-grow bg-gray-900"
        style={{maxHeight: `100%`, overflow: `scroll`}}
      >
        <div tw="absolute top-0 left-0 bottom-0 right-0 h-full w-full overflow-scroll">
          {Console.render(log)}
        </div>
      </div>
    </div>
  );
}
