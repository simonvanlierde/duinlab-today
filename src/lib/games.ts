import { site } from "./config";
import type { Game } from "./types";

/** Alphabetical, so a game is easy to find. */
export const games: Game[] = site.games.toSorted((a, b) => a.name.localeCompare(b.name));
