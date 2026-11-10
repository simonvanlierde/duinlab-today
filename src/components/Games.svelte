<script lang="ts">
import { onMount, tick } from "svelte";
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
} from "./games.svelte";

let { games }: { games: Game[] } = $props();

onMount(() => init(games.map((g) => g.id)));

const live = $derived(store.ready && !store.off);
const done = $derived(live && allPlayed());
/** Phones fold the board to one line once all are played; this opens it again. */
let unfolded = $state(false);
let unfoldBtn = $state<HTMLButtonElement>();
let board = $state<HTMLOListElement>();
/** The count is announced only after someone opens a game, not when the page loads. */
let announce = $state(false);

/** Opening the last game folds the board away; keyboard focus moves to the unfold button. */
async function open(id: string) {
	announce = true;
	mark(id);
	await tick();
	if (done && !unfolded && board && getComputedStyle(board).display === "none")
		unfoldBtn?.focus();
}

async function unfold() {
	unfolded = true;
	await tick();
	board?.querySelector("a")?.focus();
}
</script>

<div class="games-head">
	<h2 class="cue" id="h-games">Games</h2>
	<p class="count" aria-live={announce ? "polite" : "off"}>
		{#if !live}
			{games.length} daily games
		{:else if done}
			<span class="figure some roll" style={`--n:${playedCount()}`} aria-hidden="true"></span><span class="sr">{playedCount()}</span> of {games.length}. The sky agrees.
		{:else}
			<span class="figure roll" class:some={playedCount() > 0} style={`--n:${playedCount()}`} aria-hidden="true"></span><span class="sr">{playedCount()}</span> of {games.length} played
		{/if}
	</p>
</div>

{#if done && !unfolded}
	<button type="button" class="link unfold" bind:this={unfoldBtn} onclick={unfold}>Show the board</button>
{/if}
<ol class="games" bind:this={board} class:off={!live} class:folded={done && !unfolded}>
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
				onclick={() => open(g.id)}
				onauxclick={(e) => e.button === 1 && open(g.id)}
			>
				<span class="mark" class:lit={played} aria-hidden="true"></span>
				<span class="label">{g.name}</span>
				<span class="sr">{live ? (played ? ", played" : ", not yet") : ""}{g.blurb ? `: ${g.blurb}` : ""} (opens in a new tab)</span>
			</a>
			{#if live}
				<span class="hover-ticks" aria-hidden="true">
					{#each ticks(g.id) as on, i (i)}<i class="tick" class:on></i>{/each}
				</span>
			{/if}
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
{/if}

<style>
	.games-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.games-head .cue {
		margin-bottom: 4px;
	}
	.count {
		font-size: 1rem;
		letter-spacing: 0.02em;
	}
	.count .figure {
		font-size: 1.5rem;
	}
	.count .some {
		color: var(--lit-text);
	}
	.first-visit {
		margin-top: 10px;
		font-size: 0.9375rem;
		font-style: italic;
		color: var(--mute);
	}
	.games {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 16px;
		list-style: none;
		padding: 0;
		margin-top: 4px;
	}
	@media (min-width: 700px) and (max-width: 1099px) {
		.games {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}
	@media (min-width: 1100px) {
		.games {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.game {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 45px;
		border-bottom: 1px solid var(--rule);
	}
	.name {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding-block: 6px;
		line-height: 1.2;
		font-weight: 500;
		text-decoration: none;
	}
	.name:hover .label {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.mark {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--mute);
		transition:
			background-color 0.4s,
			border-color 0.4s,
			box-shadow 0.4s;
	}
	.games.off .mark {
		border-style: dotted;
	}
	.mark.lit {
		background: var(--lit);
		border-color: var(--lit);
		box-shadow: 0 1px 6px color-mix(in oklab, var(--lit) 50%, transparent);
	}
	.played .label {
		color: var(--mute);
		font-weight: 400;
	}
	.streak {
		flex: none;
		min-width: 1.5ch;
		text-align: right;
		font-size: 1.0625rem;
		color: var(--mute);
	}
	.played .streak {
		color: var(--lit-text);
	}
	.tick {
		width: 5px;
		height: 4px;
		border-radius: 1px;
		background: color-mix(in oklab, var(--ink) 30%, transparent);
	}
	.tick.on {
		height: 12px;
		background: var(--lit);
	}
	/* the last two weeks, under a game's name on hover */
	.game {
		position: relative;
	}
	.hover-ticks {
		position: absolute;
		left: 24px;
		bottom: 4px;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		opacity: 0;
		translate: 0 3px;
		transition:
			opacity 0.2s,
			translate 0.3s var(--ease-out);
		pointer-events: none;
	}
	.hover-ticks .tick {
		width: 4px;
		height: 2px;
	}
	.hover-ticks .tick.on {
		height: 6px;
	}
	@media (hover: hover) {
		.game:hover .hover-ticks,
		.game:focus-within .hover-ticks {
			opacity: 1;
			translate: 0 0;
		}
	}

	/* a mark lights with a short swell when a game is opened */
	@media (prefers-reduced-motion: no-preference) {
		.mark.lit {
			animation: light 0.6s var(--ease-out);
		}
	}
	@keyframes light {
		from {
			scale: 1.6;
			box-shadow: 0 1px 14px color-mix(in oklab, var(--lit) 80%, transparent);
		}
	}
	/* the count rolls to its new number */
	@property --n {
		syntax: "<integer>";
		inherits: false;
		initial-value: 0;
	}
	.roll {
		counter-reset: n var(--n);
		transition: --n 0.8s var(--ease-out);
	}
	.roll::after {
		content: counter(n);
	}
	@media (prefers-reduced-motion: reduce) {
		.roll {
			transition: none;
		}
	}
	/* the board folds on phones once all ten are played */
	@media (max-width: 1099px) {
		.games.folded {
			display: none;
		}
	}
	@media (min-width: 1100px) {
		.unfold {
			display: none;
		}
	}
	.unfold {
		min-height: 44px;
		font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
		font-weight: 600;
		font-size: 0.9375rem;
		letter-spacing: 0.04em;
		color: var(--mute);
	}
</style>
