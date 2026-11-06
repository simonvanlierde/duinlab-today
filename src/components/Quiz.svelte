<script lang="ts">
import { onMount } from "svelte";
import type { Quiz } from "../lib/types";
import { amsterdamDay, shift } from "./games.svelte";

let { quiz }: { quiz: Quiz } = $props();

const KEY = "today.quiz.v1";
const LINES = [
	"Still dark, then.",
	"A glimmer.",
	"First light.",
	"Getting brighter.",
	"The sun is up, mostly.",
	"Broad daylight.",
];

const total = $derived(quiz.questions.length);
let picks = $state<(number | null)[]>([]);
let at = $state(0);
/** Days on which every question was answered, for the streak. */
let done = $state<string[]>([]);

onMount(() => {
	picks = quiz.questions.map(() => null);
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
		if (Array.isArray(saved?.done))
			done = saved.done.filter((d: unknown) => typeof d === "string");
		if (saved?.day === amsterdamDay() && Array.isArray(saved.picks))
			picks = picks.map((_, i) =>
				typeof saved.picks[i] === "number" ? saved.picks[i] : null,
			);
	} catch {
		// private window: the quiz still works for this visit
	}
	const open = picks.indexOf(null);
	at = open === -1 ? total : open;
});

function pick(i: number) {
	if (picks[at] !== null && picks[at] !== undefined) return;
	picks[at] = i;
	const day = amsterdamDay();
	if (picks.every((p) => p !== null) && !done.includes(day))
		done = [...done, day].slice(-60);
	try {
		const score = picks.filter(
			(p, j) => p === quiz.questions[j].correct,
		).length;
		localStorage.setItem(KEY, JSON.stringify({ day, picks, done, score }));
	} catch {
		// nothing to keep then
	}
}

/** Consecutive days with the whole quiz answered, ending today or yesterday. */
const streak = $derived.by(() => {
	let day = amsterdamDay();
	if (!done.includes(day)) day = shift(day, -1);
	let n = 0;
	while (done.includes(day)) {
		n++;
		day = shift(day, -1);
	}
	return n;
});
const answered = $derived(picks.filter((p) => p !== null).length);

// the page's end line needs to know the quiz is finished
$effect(() => {
	document.documentElement.toggleAttribute(
		"data-quiz-done",
		total > 0 && answered === total,
	);
});

const q = $derived(quiz.questions[at]);
const chosen = $derived(picks[at] ?? null);
const score = $derived(
	picks.filter((p, i) => p !== null && p === quiz.questions[i].correct).length,
);
</script>

<div class="quiz-live" style={`--lift:${total ? answered / total : 0}`}>
	<span class="lift" aria-hidden="true"></span>
	<h2 class="cue" id="h-quiz">
		Quiz
		{#if at < total}<span class="qn">{at + 1} of {total}</span>{/if}
	</h2>
	{#if q}
		<p class="q">{q.question}</p>
		<ul class="answers plain" class:two={q.answers.length === 2}>
			{#each q.answers as a, i (i)}
				<li>
					<button
						type="button"
						class="answer"
						class:right={chosen !== null && i === q.correct}
						class:wrong={chosen === i && i !== q.correct}
						disabled={chosen !== null}
						onclick={() => pick(i)}
					>
						{a}
						{#if chosen !== null && i === q.correct}<span class="verdict">right</span>{/if}
						{#if chosen === i && i !== q.correct}<span class="verdict">not this</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
		<p class="quiz-foot" aria-live="polite">
			{#if chosen !== null}
				<span>{chosen === q.correct ? "Right." : `It was ${q.answers[q.correct]}.`}</span>
				<button type="button" class="next" onclick={() => at++}>{at + 1 < total ? "Next question" : "See the score"}</button>
			{:else}
				<a class="src" href={quiz.credit.url}>{quiz.credit.name}</a>
			{/if}
		</p>
	{:else}
		<p class="score"><span class="figure">{score}</span> of {total}. {LINES[Math.round((score / total) * 5)]}</p>
		<p class="quiz-foot">
			<span class="mute">
				{streak > 1 ? `${streak} days in a row.` : "Day one of a streak."} New questions tomorrow.
			</span>
			<a class="src" href={quiz.credit.url}>{quiz.credit.name}</a>
		</p>
	{/if}
</div>
