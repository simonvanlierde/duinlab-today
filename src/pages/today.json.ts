import type { APIRoute } from "astro";
import { allFailed } from "../lib/build";
import { getToday } from "../lib/today";

const CORS = { "access-control-allow-origin": "*" };

export const GET: APIRoute = async () => {
	try {
		const today = await getToday();
		// Weather is the shortest-lived part, so the whole document can be reused for at most that long.
		const age = allFailed(today) ? 60 : 300;
		return Response.json(today, {
			headers: {
				"cache-control": `public, max-age=${age}, s-maxage=${age}`,
				...CORS,
			},
		});
	} catch (err) {
		console.warn(`today.json failed: ${err}`);
		return Response.json(
			{ error: "unavailable" },
			{ status: 503, headers: { "cache-control": "no-store", ...CORS } },
		);
	}
};
