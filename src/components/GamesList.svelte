<script lang="ts">
import { onMount } from "svelte";
import type { Game } from "../lib/types";
import {
	anyHistory,
	init,
	isPlayed,
	mark,
	store,
	streak,
	ticks,
	unmark,
} from "./games.svelte";

let { games }: { games: Game[] } = $props();

onMount(() => init(games.map((g) => g.id)));

const live = $derived(store.ready && !store.off);

/** Ticks of the last 14 days; a run of three or more days is joined by a line. */
function row(id: string) {
	const t = ticks(id);
	const n = streak(id);
	const end = t[13] ? 13 : 12;
	return t.map((on, i) => ({ on, join: n >= 3 && i > end - n && i <= end }));
}
</script>

{#if live && !anyHistory()}
	<p class="first-visit">0 days. Everyone starts in the dark.</p>
{/if}

<ol class="games" class:off={store.off}>
	{#each games as g (g.id)}
		{@const played = live && isPlayed(g.id)}
		{@const n = live ? streak(g.id) : 0}
		<li id={`game-${g.id}`} class="game" class:played>
			<span class="mark" class:lit={played} class:hide={!live} aria-hidden="true"></span>
			<div class="what">
				<a href={g.url} target="_blank" rel="noopener" class="name" onclick={() => mark(g.id)} onauxclick={() => mark(g.id)}>
					{g.name}<span class="sr"> (opens in a new tab)</span>
				</a>
				<span class="state" class:hide={!live}>{played ? "played" : "not yet"}</span>
				<span class="blurb">{g.blurb}</span>
			</div>
			<div class="streak" class:hide={!live} aria-label={`${n} day streak`}>
				<span class="figure">{n}</span>
				<span class="unit">{n === 1 ? "day" : "days"}</span>
			</div>
			<div class="meta" class:hide={!live}>
				<span class="ticks" aria-hidden="true">
					{#each live ? row(g.id) : [] as t, i (i)}
						<i class="tick" class:on={t.on} class:join={t.join}></i>
					{/each}
				</span>
				{#if played}
					<button type="button" class="undo" onclick={() => unmark(g.id)} aria-label={`Un-mark ${g.name} as played`}>un-mark</button>
				{/if}
			</div>
		</li>
	{/each}
</ol>
