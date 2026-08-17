import { createInterface } from "node:readline";
import { Writable } from "node:stream";

/**
 * Read one line from stdin without echoing it, so a pasted API key never lands in the terminal
 * scrollback. When stdin is not a TTY (piped input, CI), the value is read as-is — there is nothing
 * to echo. The trailing newline is consumed and the result trimmed.
 */
export function promptHidden(
  question: string,
  input: NodeJS.ReadableStream & { isTTY?: boolean } = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Promise<string> {
  return new Promise((resolve, reject) => {
    let muted = false;
    const gate = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) output.write(chunk, encoding as BufferEncoding);
        callback();
      }
    });
    const rl = createInterface({ input, output: gate, terminal: input.isTTY === true });
    rl.on("error", reject);
    rl.question(question, (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer.trim());
    });
    // Mute after the question has been emitted so keystrokes are hidden but the prompt is visible.
    muted = true;
  });
}
