import type { Sea } from "../types";
import { getJson, safe } from "../util";

const URL =
	"https://marine-api.open-meteo.com/v1/marine?latitude=52.11&longitude=4.26" +
	"&current=wave_height,sea_surface_temperature";

interface Raw {
	current?: {
		wave_height?: number | null;
		sea_surface_temperature?: number | null;
	};
}

/** Either figure may be missing from the model cell; the sea is null only when both are. */
export function parseSea(r: Raw): Sea | null {
	const num = (v: number | null | undefined) =>
		typeof v === "number" && Number.isFinite(v) ? v : null;
	const temperatureC = num(r.current?.sea_surface_temperature);
	const waveHeightM = num(r.current?.wave_height);
	if (temperatureC === null && waveHeightM === null) return null;
	return {
		temperatureC,
		waveHeightM,
		credit: { name: "Open-Meteo", url: "https://open-meteo.com/" },
	};
}

export const fetchSea = () =>
	safe("sea", async () => parseSea(await getJson<Raw>(URL)));
