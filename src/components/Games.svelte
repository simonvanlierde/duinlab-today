<script lang="ts">
import { onMount, tick } from "svelte";
import type { Game } from "../lib/types";
import {
	allPlayed,
	amsterdamDay,
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
/** Phones fold the board to one line once all are played; this opens it again. */
let unfolded = $state(false);
let shared = $state("");
let unfoldBtn = $state<HTMLButtonElement>();
let board = $state<HTMLOListElement>();
/** The count is announced only after someone marks or un-marks a game, not when the page loads. */
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

/** One line to paste to each other: the quiz score and the games played today. */
async function share() {
	let quiz = "";
	try {
		const q = JSON.parse(localStorage.getItem("today.quiz.v1") ?? "null");
		if (q?.day === amsterdamDay() && typeof q.score === "number")
			quiz = ` · quiz ${q.score}/${q.picks.length}`;
	} catch {
		// no quiz score then
	}
	const day = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Amsterdam",
		weekday: "short",
		day: "numeric",
		month: "short",
	}).format(new Date());
	const played = games.filter((g) => isPlayed(g.id)).map((g) => g.name);
	const text = `today.duinlab.nl, ${day}${quiz} · games ${played.length}/${games.length}${played.length ? `: ${played.join(", ")}` : ""}`;
	shared = "";
	await tick();
	try {
		if (navigator.share && matchMedia("(pointer: coarse)").matches) {
			await navigator.share({ text });
			return;
		}
		await navigator.clipboard.writeText(text);
		shared = "Copied. Paste it to someone.";
	} catch (e) {
		// the person closed the share sheet
		if (e instanceof DOMException && e.name === "AbortError") return;
		shared = `Copy this: ${text}`;
	}
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
{:else if live}
	<div class="games-foot">
	<details class="streaks">
		<summary>Past 14 days, un-mark</summary>
		<ol class="plain">
			{#each games as g (g.id)}
				{@const n = streak(g.id)}
				<li class="streak-row">
					<span class="streak-name">{g.name}</span>
					<span class="sr">{n} day streak</span>
					<span class="ticks" aria-hidden="true">
						{#each ticks(g.id) as on, i (i)}
							<i class="tick" class:on></i>
						{/each}
					</span>
					{#if isPlayed(g.id)}
						<button type="button" class="undo" onclick={() => {
							announce = true;
							unmark(g.id);
						}} aria-label={`Un-mark ${g.name} as played`}>un-mark</button>
					{/if}
				</li>
			{/each}
		</ol>
	</details>
	{#if playedCount() > 0}
		<button type="button" class="link share" onclick={share}>Share today</button>
	{/if}
	</div>
	<p class="shared" aria-live="polite">{shared}</p>
{/if}
