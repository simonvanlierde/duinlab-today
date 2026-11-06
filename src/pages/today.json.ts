import type { APIRoute } from "astro";
import { getToday } from "../lib/today";

export const GET: APIRoute = async () => {
	const today = await getToday();
	// Weather is the shortest-lived part, so the whole document can be reused for at most that long.
	return Response.json(today, {
		headers: {
			"cache-control": "public, max-age=300, s-maxage=300",
			"access-control-allow-origin": "*",
		},
	});
};
