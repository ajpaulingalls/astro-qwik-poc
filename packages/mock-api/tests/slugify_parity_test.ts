import { assertEquals } from "jsr:@std/assert@^1";
import { slugify as tsSlugify } from "../lib/variants.ts";

const SCRIPT_PATH = new URL("../scripts/record-fixtures.sh", import.meta.url).pathname;

async function bashSlugify(input: string): Promise<string> {
  // Source the script (the BASH_SOURCE guard short-circuits the recording
  // loop), then call the slugify function with the input.
  const cmd = new Deno.Command("bash", {
    args: ["-c", `source "${SCRIPT_PATH}"; slugify "$1"`, "_", input],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await cmd.output();
  return new TextDecoder().decode(stdout).replace(/\n$/, "");
}

const PARITY_INPUTS = [
  "middle-east",
  "Middle East",
  "2026/4/21/foo",
  "/news/2026/4/21/some-update-uri",
  "/foo/bar/",
  "Foo  Bar",
  "already-clean",
  "with--double--dashes",
  "trailing/",
  "/leading",
];

for (const input of PARITY_INPUTS) {
  Deno.test(`slugify parity: bash and TS produce identical output for ${JSON.stringify(input)}`, async () => {
    const ts = tsSlugify(input);
    const bash = await bashSlugify(input);
    assertEquals(bash, ts, `bash and TS disagree on slugify(${JSON.stringify(input)})`);
  });
}
