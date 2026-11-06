<script lang="ts">
import { onMount } from "svelte";
import type { Game } from "../lib/types";
import {
	allPlayed,
	anyHistory,
	init,
	isPlayed,
	mark,
	playedCount,
	store,
	streak,
	ticks,
	unmark,
} from "./games.svelte";

let { games }: { games: Game[] } = $props();

onMount(() => init(games.map((g) => g.id)));

const live = $derived(store.ready && !store.off);
const done = $derived(live && allPlayed());
</script>

<div class="games-head">
	<h2 class="cue" id="h-games">Games</h2>
	<p class="count" aria-live="polite">
		{#if !live}
			{games.length} daily games
		{:else if done}
			<span class="figure some">{playedCount()}</span> of {games.length}. The sky agrees.
		{:else}
			<span class="figure" class:some={playedCount() > 0}>{playedCount()}</span> of {games.length} played
		{/if}
	</p>
</div>

<ol class="games" class:off={!live}>
	{#each games as g (g.id)}
		{@const played = live && isPlayed(g.id)}
		{@const n = live ? streak(g.id) : 0}
		<li id={`game-${g.id}`} class="game" class:played>
			<a
				href={g.url}
				target="_blank"
				rel="noopener"
				class="name"
				title={g.blurb}
				onclick={() => mark(g.id)}
				onauxclick={() => mark(g.id)}
			>
				<span class="mark" class:lit={played} aria-hidden="true"></span>
				<span class="label">{g.name}</span>
				<span class="sr">{live ? (played ? ", played" : ", not yet") : ""} (opens in a new tab)</span>
			</a>
			{#if live && n > 0}
				<span class="streak" title={`${n} day streak`}>
					<span class="figure">{n}</span><span class="sr"> day streak</span>
				</span>
			{/if}
		</li>
	{/each}
</ol>

{#if live && !anyHistory()}
	<p class="first-visit">0 days. Everyone starts in the dark.</p>
{:else if live}
	<details class="streaks">
		<summary>Last two weeks, and un-mark</summary>
		<ol class="plain">
			{#each games as g (g.id)}
				{@const n = streak(g.id)}
				<li class="streak-row">
					<span class="streak-name">{g.name}</span>
					<span class="ticks" aria-label={`${n} day streak`}>
						{#each ticks(g.id) as on, i (i)}
							<i class="tick" class:on></i>
						{/each}
					</span>
					{#if isPlayed(g.id)}
						<button type="button" class="undo" onclick={() => unmark(g.id)} aria-label={`Un-mark ${g.name} as played`}>un-mark</button>
					{/if}
				</li>
			{/each}
		</ol>
	</details>
{/if}
