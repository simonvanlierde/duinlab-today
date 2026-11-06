<script lang="ts">
import { onMount } from "svelte";
import type { Game } from "../lib/types";
import { allPlayed, init, isPlayed, playedCount, store } from "./games.svelte";

let { games }: { games: Game[] } = $props();

onMount(() => init(games.map((g) => g.id)));

const live = $derived(store.ready && !store.off);
const done = $derived(live && allPlayed());
</script>

<div class="board">
	<ol class="dots">
		{#each games as g (g.id)}
			<li>
				<a
					href={`#game-${g.id}`}
					class="dot"
					class:lit={live && isPlayed(g.id)}
					aria-label={live ? `${g.name}, ${isPlayed(g.id) ? "played" : "not yet"}` : g.name}
				></a>
			</li>
		{/each}
	</ol>
	<p class="count" aria-live="polite">
		{#if !live}
			{games.length} daily games
		{:else if done}
			<span class="figure">{playedCount()}</span> of {games.length} played. All {games.length === 10 ? "ten" : "of them"}. The sky agrees.
		{:else}
			<span class="figure">{playedCount()}</span> of {games.length} played
		{/if}
	</p>
</div>
