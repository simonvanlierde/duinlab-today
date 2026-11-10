<script lang="ts">
import { onMount, tick } from "svelte";
import type { Quiz } from "../lib/types";
import { loadQuiz, quizStreak, saveQuiz } from "./quiz";

let { quiz }: { quiz: Quiz } = $props();

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
let nextBtn = $state<HTMLButtonElement>();
let top = $state<HTMLElement>();

onMount(() => {
	({ picks, done } = loadQuiz(quiz));
	const open = picks.indexOf(null);
	at = open === -1 ? total : open;
});

async function pick(i: number) {
	if (picks[at] !== null && picks[at] !== undefined) return;
	picks[at] = i;
	done = saveQuiz(quiz, picks, done);
	await tick();
	nextBtn?.focus();
}

/** Keyboard focus follows the quiz: to the next question, or to the score. */
async function next() {
	at++;
	await tick();
	top?.focus();
}

const streak = $derived(quizStreak(done));
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
		<p class="q" tabindex="-1" bind:this={top}>{q.question}</p>
		<ul class="answers plain" class:two={q.answers.length === 2}>
			{#each q.answers as a, i (i)}
				<li>
					<button
						type="button"
						class="answer"
						class:right={chosen !== null && i === q.correct}
						class:wrong={chosen === i && i !== q.correct}
						aria-disabled={chosen !== null}
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
				<button type="button" class="next" bind:this={nextBtn} onclick={next}>{at + 1 < total ? "Next question" : "See the score"}</button>
			{:else}
				<a class="src" href={quiz.credit.url}>{quiz.credit.name}</a>
			{/if}
		</p>
	{:else}
		<p class="score" tabindex="-1" bind:this={top}><span class="figure">{score}</span> of {total}. {LINES[Math.round((score / total) * 5)]}</p>
		<p class="quiz-foot">
			<span class="mute">
				{streak > 1 ? `${streak} days in a row.` : "Day 1 of a streak."}
			</span>
			<a class="src" href={quiz.credit.url}>{quiz.credit.name}</a>
		</p>
		<details class="more review">
			<summary>Review answers</summary>
			<ol>
				{#each quiz.questions as question, i (i)}
					<li>
						<p class="review-question">{question.question}</p>
						{#if picks[i] === question.correct}
							<p>Correct: {question.answers[question.correct]}</p>
						{:else}
							<p>Your answer: {question.answers[picks[i]!]}</p>
							<p>Correct answer: {question.answers[question.correct]}</p>
						{/if}
					</li>
				{/each}
			</ol>
		</details>
	{/if}
</div>

<style>
	.review ol {
		padding: 4px 0 4px 1.5em;
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}
	.review li + li {
		margin-top: 16px;
	}
	.review-question {
		margin-bottom: 4px;
		font-weight: 500;
	}
	.qn {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.08em;
	}
	.q {
		font-weight: 500;
		text-wrap: pretty;
	}
	.answers {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
		margin-top: 10px;
	}
	.answer {
		position: relative;
		width: 100%;
		min-height: 44px;
		padding: 8px 12px;
		text-align: left;
		font-size: 0.9375rem;
		line-height: 1.3;
		background: var(--ground-2);
		border: 1px solid var(--rule);
		border-radius: 6px;
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-color 0.2s;
	}
	.answer:hover:not([aria-disabled="true"]) {
		border-color: var(--ink);
	}
	.answer[aria-disabled="true"] {
		cursor: default;
		color: var(--mute);
	}
	/* orange means played; the quiz marks with ink */
	.answer.right {
		color: var(--ink);
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
		background: var(--ground);
	}
	.answer.wrong {
		color: var(--ink);
		text-decoration: line-through;
		text-decoration-color: var(--mute);
	}
	.verdict {
		display: block;
		margin-top: 2px;
		font-size: 0.8125rem;
		color: var(--ink);
		text-decoration: none;
	}
	.wrong .verdict {
		color: var(--mute);
	}
	.quiz-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 16px;
		min-height: 44px;
		margin-top: 4px;
	}
	.next {
		min-height: 44px;
		padding: 0 4px;
		background: none;
		border: 0;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-decoration: underline;
		text-underline-offset: 0.25em;
		cursor: pointer;
	}
	.score {
		font-size: 1.25rem;
		margin-top: 4px;
	}
	.score .figure {
		font-size: 2rem;
	}
	/* the static quiz (noscript) stands in without script */
	:global(html:not(.js)) .quiz-live {
		display: none;
	}
	/* the quiz lifts its own small horizon: a dawn glow that rises with each answer */
	.quiz-live {
		position: relative;
		isolation: isolate;
	}
	.lift {
		position: absolute;
		inset: auto -12px 0;
		z-index: -1;
		height: calc(var(--lift, 0) * 100%);
		background: radial-gradient(
			ellipse 50% 100% at 50% 100%,
			color-mix(in oklab, var(--K3) 40%, transparent),
			transparent 75%
		);
		transition: height 1.2s var(--ease-out);
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.lift {
			transition: none;
		}
	}
</style>
