import { sample } from "./sample";
import type { Today } from "./types";

// shortcut: returns the sample day until the data layer lands.
export async function getToday(_now: Date = new Date()): Promise<Today> {
	return sample;
}
