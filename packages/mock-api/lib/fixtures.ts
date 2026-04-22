export type FixtureMap = Map<string, string>;

export async function loadFixtures(dir: string): Promise<FixtureMap> {
  const map: FixtureMap = new Map();

  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;

    const path = `${dir}/${entry.name}`;
    const text = await Deno.readTextFile(path);

    // Parse purely to validate at startup (fail loud on malformed fixtures).
    // Store the raw text so the handler can return it directly without per-request stringify.
    try {
      JSON.parse(text);
    } catch (err) {
      throw new Error(
        `Invalid JSON in fixture ${entry.name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const key = entry.name.slice(0, -".json".length);
    map.set(key, text);
  }

  return map;
}
